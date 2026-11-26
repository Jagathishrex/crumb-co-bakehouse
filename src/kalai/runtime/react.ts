// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// React hooks over the client: a list that refreshes when its table changes, the signed-in person, and sign-in.
import { createElement, Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AuthClient, TableClient } from './client.ts';
import type { User } from './driver.ts';
import type { QueryPart } from './query.ts';

export interface RowsState<R> {
  rows: R[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useRows<R, N>(table: TableClient<R, N>, query: QueryPart[] = []): RowsState<R> {
  const [state, setState] = useState<{ rows: R[]; loading: boolean; error: Error | null }>({ rows: [], loading: true, error: null });
  const key = JSON.stringify(query);
  const run = useRef(0);
  const reload = useCallback(() => {
    const mine = ++run.current;
    table
      .list(JSON.parse(key))
      .then((rows) => mine === run.current && setState({ rows, loading: false, error: null }))
      .catch((error: Error) => mine === run.current && setState((was) => ({ ...was, loading: false, error })));
  }, [table, key]);
  useEffect(() => {
    reload();
    return table.subscribe(reload);
  }, [table, reload]);
  return { ...state, reload };
}

export function useUser(client: { me(): Promise<User | null> }): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    client.me().then(setUser, () => setUser(null));
  }, [client]);
  return user;
}

export interface AuthState<U> extends Omit<AuthClient<U>, 'current' | 'subscribe' | 'refresh' | 'pendingEmail'> {
  /** The person signed in (their users row), or null. */
  user: U | null;
  /** The email waiting for a code (to confirm it, or to reset its password), for the screen that asks for the code. */
  email: string | null;
  status: 'loading' | 'signedIn' | 'signedOut';
}

/** Who is signed in, following sign-in and sign-out in any frame, plus every sign-in step. */
export function useAuth<U>(client: { auth: AuthClient<U> }): AuthState<U> {
  const auth = client.auth;
  const [user, setUser] = useState<U | null | undefined>(() => auth.current());
  // Renders again when only the waiting email changed (the person is the same).
  const [, setSeen] = useState(0);
  useEffect(() => {
    const stop = auth.subscribe((next) => {
      setUser(next);
      setSeen((count) => count + 1);
    });
    if (auth.current() === undefined) auth.refresh().catch(() => setUser(null));
    else setUser(auth.current());
    return stop;
  }, [auth]);
  return {
    user: user ?? null,
    status: user === undefined ? 'loading' : user ? 'signedIn' : 'signedOut',
    email: auth.pendingEmail(),
    signUp: auth.signUp,
    verify: auth.verify,
    logIn: auth.logIn,
    logOut: auth.logOut,
    forgotPassword: auth.forgotPassword,
    resetPassword: auth.resetPassword,
    resend: auth.resend,
    signInWithGoogle: auth.signInWithGoogle,
  };
}

/** Shows its children only to signed-in people (`when: 'signedIn'`) or only to signed-out ones; `fallback` otherwise. */
export function AuthGate<U>({ client, when, children, fallback = null }: { client: { auth: AuthClient<U> }; when: 'signedIn' | 'signedOut'; children?: ReactNode; fallback?: ReactNode }): ReactNode {
  const { status } = useAuth(client);
  if (status === 'loading') return null;
  return createElement(Fragment, null, (status === 'signedIn') === (when === 'signedIn') ? children : fallback);
}
