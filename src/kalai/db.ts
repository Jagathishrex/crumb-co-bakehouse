// The app's data. While designing, the API runs inside this page over IndexedDB and every change is saved to
// data/records; after deploy it is the real server. Screens use the same `db` either way:
//   const classes = db.table('classes');
//   const { rows, loading } = useRows(classes, [q.orderAsc('starts_at')]);
import { useEffect, useState, type ReactNode } from 'react';
import { createClient, localSession, type ChangeListener } from './runtime/index.ts';
import { q } from './runtime/query.ts';
import { AuthGate, useAuth as useAuthOf } from './runtime/react.ts';
import type { Tables } from './types.ts';

export { q };
export { useRows, useUser } from './runtime/react.ts';

/** Who is signed in while designing (a row id from the users records); production uses real sign-in. */
export const kUserKey = 'kalai:user';

const simulated = import.meta.env.DEV ? import('./simulate.ts').then((module) => module.start()) : null;

export const db = createClient<Tables>({
  // Hosted on Catalyst the app's server answers under /server/api (set when Nila builds the app to host it).
  base: import.meta.env.VITE_KALAI_API_BASE ? `${location.origin}${import.meta.env.VITE_KALAI_API_BASE}` : undefined,
  fetcher: simulated ? async (request) => (await simulated).app.fetch(request) : undefined,
  // Sign-in's session: kept in this site's storage while designing, a cookie after deploy.
  session: import.meta.env.DEV ? localSession() : undefined,
  headers: () => {
    const user = import.meta.env.DEV ? localStorage.getItem(kUserKey) : null;
    return user ? { 'x-kalai-user': user } : ({} as Record<string, string>);
  },
  subscribe: simulated
    ? (listener: ChangeListener) => {
        let stop: (() => void) | undefined;
        let stopped = false;
        void simulated.then((simulation) => {
          if (!stopped) stop = simulation.driver.subscribe(listener);
        });
        return () => {
          stopped = true;
          stop?.();
        };
      }
    : undefined,
});

/**
 * Sign-in (when it is on in the Backend tab): who is signed in, and each step.
 *   const { user, status, email, signUp, verify, logIn, logOut, forgotPassword, resetPassword, resend, signInWithGoogle } = useAuth();
 * signUp and logIn answer { user } when signed in, or { next: 'confirm', email } when a code was emailed first;
 * `email` is the address waiting for a code, for the confirm and reset screens.
 * "Continue with Google" (when the Backend's Sign-in tab offers Google): await signInWithGoogle('Journal'), then
 * navigate('Journal'). It is real: while designing it shows a chooser of the sample people (or any email); hosted,
 * it goes to Google and comes back signed in on that screen. Never fake it with logIn and a made-up password.
 */
export const useAuth = () => useAuthOf(db);

/** Shows its children only to signed-in people; `fallback` (a sign-in prompt) to everyone else. */
export function SignedIn({ children, fallback }: { children?: ReactNode; fallback?: ReactNode }) {
  return AuthGate({ client: db, when: 'signedIn', children, fallback });
}

/** Shows its children only to people who aren't signed in. */
export function SignedOut({ children, fallback }: { children?: ReactNode; fallback?: ReactNode }) {
  return AuthGate({ client: db, when: 'signedOut', children, fallback });
}

const selectedKey = (table: string) => `kalai:selected:${table}`;

/** Remembers the row a list opened, for the detail screen it navigates to: select('classes', row.id), then navigate('ClassDetail'). */
export function select(table: keyof Tables & string, id: string): void {
  sessionStorage.setItem(selectedKey(table), id);
}

/**
 * The row a list opened with select(); on Kalai's canvas, where a detail screen is shown on its own, the table's first
 * row, so it shows real data. Follows changes to the table.
 */
export function useSelected<K extends keyof Tables & string>(name: K): { row: Tables[K]['row'] | null; loading: boolean } {
  const [state, setState] = useState<{ row: Tables[K]['row'] | null; loading: boolean }>({ row: null, loading: true });
  useEffect(() => {
    const table = db.table(name);
    let live = true;
    const load = async () => {
      const id = sessionStorage.getItem(selectedKey(name));
      const row = (id ? await table.get(id).catch(() => null) : null) ?? (await table.list([q.limit(1)]))[0] ?? null;
      if (live) setState({ row, loading: false });
    };
    void load();
    const stop = table.subscribe(() => void load());
    return () => {
      live = false;
      stop();
    };
  }, [name]);
  return state;
}
