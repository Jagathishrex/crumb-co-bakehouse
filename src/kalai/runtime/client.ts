// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// What screens call: `db.table('tasks').list([q.equal('done', false)])`. It speaks HTTP to the API; while designing,
// the "network" is the API running in the same page (simulated), so the screens' code is the same as in production.
import type { Row } from '../model/index.ts';
import type { ChangeListener, User } from './driver.ts';
import type { QueryPart } from './query.ts';

export type Fetcher = (request: Request) => Response | Promise<Response>;

/** Each table's row and new-row types (src/kalai/types.ts). Written so an interface fits too. */
export type TableTypes<T = Record<string, { row: Row | object; new: object }>> = { [K in keyof T]: { row: object; new: object } };

export class ApiError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(message: string, status: number, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export interface TableClient<R, N> {
  readonly name: string;
  list(query?: QueryPart[]): Promise<R[]>;
  get(id: string): Promise<R>;
  create(values: N): Promise<R>;
  update(id: string, values: Partial<N>): Promise<R>;
  remove(id: string): Promise<void>;
  /** Calls back when this table changes. */
  subscribe(listener: () => void): () => void;
}

/** What a sign-in step gave back: signed in, or a code was emailed to confirm the address first. */
export type AuthResult<U = User> = { user: U; next?: undefined } | { user?: undefined; next: 'confirm'; email: string };

/** Sign-in (auth.ts on the server): the person signed in now, and each step of the flows. */
export interface AuthClient<U = User> {
  /** The person signed in, null for nobody, undefined until it is known. */
  current(): U | null | undefined;
  /**
   * The email waiting for a code: after signUp or logIn answered next: 'confirm', or after forgotPassword. The confirm
   * and reset screens read it, so no screen passes it along; signing in clears it.
   */
  pendingEmail(): string | null;
  /** Asks the server who is signed in. */
  refresh(): Promise<U | null>;
  signUp(values: { email: string; password: string; name?: string } & Record<string, unknown>): Promise<AuthResult<U>>;
  /** The code emailed to confirm an address (after signUp or logIn answered next: 'confirm'). */
  verify(email: string, code: string): Promise<U>;
  logIn(email: string, password: string): Promise<AuthResult<U>>;
  logOut(): Promise<void>;
  /** Emails a code to reset the password (says nothing about whether the email has an account). */
  forgotPassword(email: string): Promise<void>;
  resetPassword(email: string, code: string, password: string): Promise<U>;
  /** Sends a new code: to confirm the email, or to reset the password. */
  resend(email: string, purpose?: 'confirm' | 'reset'): Promise<void>;
  /**
   * "Continue with Google". Hosted, the page goes to Google and comes back signed in, on `screen` when given (its
   * name, as navigate() takes it). While designing, a picker in the page chooses a sample person or any email.
   * Resolves with the person (while designing), or null when the picker was closed.
   */
  signInWithGoogle(screen?: string): Promise<U | null>;
  /** Calls back when someone signs in or out (in this frame or another of the app's). */
  subscribe(listener: (user: U | null) => void): () => void;
}

/** Where the session is kept while designing (the API in the page has no cookies); after deploy a cookie carries it. */
export interface SessionStore {
  get(): string | null;
  set(token: string | null): void;
  /** Calls back when another frame signs in or out ('session'), or asks for a code ('pending'). */
  watch?(callback: (what: 'session' | 'pending') => void): () => void;
  /** Keeps the email waiting for a code, for the next screen of the flow. */
  pending?: { get(): string | null; set(email: string | null): void };
}

/** A session kept in this site's localStorage, shared by every frame of the app, as a cookie would be. */
export function localSession(key = 'kalai:session'): SessionStore {
  return {
    get: () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (token) => {
      try {
        if (token) localStorage.setItem(key, token);
        else localStorage.removeItem(key);
      } catch {
        // Storage blocked: the session lasts as long as this page.
      }
    },
    watch: (callback) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) callback('session');
        else if (event.key === `${key}:email`) callback('pending');
      };
      addEventListener('storage', onStorage);
      return () => removeEventListener('storage', onStorage);
    },
    pending: storedValue(`${key}:email`, () => localStorage),
  };
}

/** One value in web storage, quietly doing nothing where storage is blocked. */
function storedValue(key: string, storage: () => Storage) {
  return {
    get: () => {
      try {
        return storage().getItem(key);
      } catch {
        return null;
      }
    },
    set: (value: string | null) => {
      try {
        if (value) storage().setItem(key, value);
        else storage().removeItem(key);
      } catch {
        // Storage blocked: the next screen asks for the email again.
      }
    },
  };
}

export interface Client<T extends TableTypes<T>> {
  table<K extends keyof T & string>(name: K): TableClient<T[K]['row'], T[K]['new']>;
  me(): Promise<User | null>;
  auth: AuthClient<T extends { users: { row: infer U } } ? U : User>;
  /** Calls one of the app's own routes (server/routes): `db.request('POST', '/api/bookings/book', { class_id })`. */
  request<V = unknown>(method: string, path: string, body?: unknown): Promise<V>;
  /** Calls back when a table changes (while designing: any frame of this project). */
  subscribe(listener: ChangeListener): () => void;
}

export interface ClientOptions {
  fetcher?: Fetcher;
  /** The address the API is served from; '' is this site. */
  base?: string;
  headers?: () => Record<string, string>;
  subscribe?: (listener: ChangeListener) => () => void;
  /** Keeps the session token sign-in answers with while designing; without one the server's cookie does. */
  session?: SessionStore;
  /** While designing: who "Continue with Google" signs in (default: a picker drawn in the page). */
  pickPerson?: (people: PretendPerson[]) => Promise<PretendPerson | null>;
}

export interface PretendPerson {
  email: string;
  name?: string | null;
}

/** The design-time stand-in for Google's account chooser: the sample people, or any email typed. */
function pickInPage(people: PretendPerson[]): Promise<PretendPerson | null> {
  if (typeof document === 'undefined') return Promise.resolve(people[0] ?? null);
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-kalai-google-picker', '');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.35);font:14px/1.4 system-ui,sans-serif';
    const box = document.createElement('div');
    box.style.cssText = 'width:min(360px,92vw);background:#fff;color:#1f1f1f;border-radius:14px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.25)';
    const done = (person: PretendPerson | null) => {
      overlay.remove();
      resolve(person);
    };
    const title = document.createElement('div');
    title.textContent = 'Choose an account';
    title.style.cssText = 'font-size:18px;font-weight:600';
    const note = document.createElement('div');
    note.textContent = 'Pretend Google sign-in while designing. The hosted app uses real Google.';
    note.style.cssText = 'margin:4px 0 14px;color:#5f6368;font-size:12px';
    box.append(title, note);
    for (const person of people) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = person.name ? `${person.name} · ${person.email}` : person.email;
      button.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;margin:0 0 6px;border:1px solid #dadce0;border-radius:8px;background:#fff;cursor:pointer;font:inherit';
      button.onclick = () => done(person);
      box.append(button);
    }
    const form = document.createElement('form');
    form.style.cssText = 'display:flex;gap:6px;margin-top:8px';
    const input = document.createElement('input');
    input.type = 'email';
    input.required = true;
    input.placeholder = 'Or type any email';
    input.style.cssText = 'flex:1;padding:8px 10px;border:1px solid #dadce0;border-radius:8px;font:inherit';
    const go = document.createElement('button');
    go.type = 'submit';
    go.textContent = 'Continue';
    go.style.cssText = 'padding:8px 12px;border:0;border-radius:8px;background:#1a73e8;color:#fff;font:inherit;cursor:pointer';
    form.append(input, go);
    form.onsubmit = (event) => {
      event.preventDefault();
      done({ email: input.value.trim() });
    };
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'margin-top:12px;border:0;background:none;color:#5f6368;cursor:pointer;font:inherit';
    cancel.onclick = () => done(null);
    box.append(form, cancel);
    overlay.onclick = (event) => event.target === overlay && done(null);
    overlay.append(box);
    document.body.append(overlay);
  });
}

export function createClient<T extends TableTypes<T>>(options: ClientOptions = {}): Client<T> {
  const fetcher: Fetcher = options.fetcher ?? ((request) => fetch(request));
  const origin = options.base ?? (typeof location === 'undefined' ? 'http://localhost' : location.origin);
  const local = new Set<ChangeListener>();
  const token = () => options.session?.get() ?? null;

  async function call<V>(method: string, path: string, body?: unknown): Promise<V> {
    const session = token();
    const request = new Request(`${origin}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(options.headers?.() ?? {}), ...(session ? { authorization: `Bearer ${session}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
    const response = await fetcher(request);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error ?? `The server answered ${response.status}`, response.status, data.field);
    return data as V;
  }

  const subscribe = (listener: ChangeListener) => {
    if (options.subscribe) return options.subscribe(listener);
    local.add(listener);
    return () => {
      local.delete(listener);
    };
  };

  type Person = T extends { users: { row: infer U } } ? U : User;
  let person: Person | null | undefined;
  const people = new Set<(user: Person | null) => void>();
  const tell = (user: Person | null) => {
    const idOf = (who: Person | null | undefined) => (who as { id?: string } | null | undefined)?.id ?? null;
    // The first answer only says who loaded the lists already; a different person afterwards is a change.
    const changed = person !== undefined && idOf(user) !== idOf(person);
    person = user;
    for (const listener of people) listener(user);
    // Lists that depend on who is signed in (rows only their owner sees) load again.
    if (changed) for (const listener of signedListeners) listener();
  };
  const signedListeners = new Set<() => void>();
  const refresh = async () => {
    const user = (await call<{ user: Person | null }>('GET', '/api/me')).user;
    tell(user);
    return user;
  };
  // After deploy (no session store) the waiting email lives in this tab's sessionStorage.
  const kept = options.session?.pending ?? storedValue('kalai:pending-email', () => sessionStorage);
  // A new waiting email reaches the screens showing it (useAuth renders again).
  const pending = {
    get: kept.get,
    set: (email: string | null) => {
      if (kept.get() === email) return;
      kept.set(email);
      for (const listener of people) listener(person ?? null);
    },
  };
  const signedIn = (answer: { user: Person; session?: string }) => {
    if (answer.session) options.session?.set(answer.session);
    // Telling who signed in below is the screens' cue; clearing the email needs none of its own.
    kept.set(null);
    tell(answer.user);
    return answer.user;
  };
  const step = async (path: string, body: unknown): Promise<AuthResult<Person>> => {
    const answer = await call<{ user?: Person; session?: string; next?: 'confirm'; email?: string }>('POST', path, body);
    if (answer.user) return { user: signedIn(answer as { user: Person; session?: string }) };
    pending.set(answer.email ?? null);
    return { next: 'confirm', email: answer.email ?? '' };
  };
  options.session?.watch?.((what) => {
    if (what === 'pending') for (const listener of people) listener(person ?? null);
    else void refresh().catch(() => undefined);
  });

  const auth: AuthClient<Person> = {
    current: () => person,
    pendingEmail: () => pending.get(),
    refresh,
    signUp: (values) => step('/api/auth/signup', values),
    verify: async (email, code) => signedIn(await call('POST', '/api/auth/verify', { email, code })),
    logIn: (email, password) => step('/api/auth/login', { email, password }),
    logOut: async () => {
      await call('POST', '/api/auth/logout', {}).catch(() => undefined);
      options.session?.set(null);
      tell(null);
    },
    forgotPassword: async (email) => {
      const answer = await call<{ email?: string }>('POST', '/api/auth/forgot', { email });
      pending.set(answer.email ?? email.trim().toLowerCase());
    },
    resetPassword: async (email, code, password) => signedIn(await call('POST', '/api/auth/reset', { email, code, password })),
    resend: async (email, purpose = 'confirm') => void (await call('POST', '/api/auth/resend', { email, purpose })),
    signInWithGoogle: async (screen) => {
      // While designing there is a session store (the API runs in the page): pretend.
      if (options.session) {
        const { people } = await call<{ people: PretendPerson[] }>('GET', '/api/auth/google/pretend');
        const person = await (options.pickPerson ?? pickInPage)(people);
        if (!person) return null;
        return signedIn(await call('POST', '/api/auth/google/pretend', person));
      }
      const back = typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}${location.search}${screen ? `#/${encodeURIComponent(screen)}` : location.hash}`;
      location.assign(`${origin}/api/auth/google/start?return=${encodeURIComponent(back)}`);
      // The page is leaving for Google.
      return new Promise<never>(() => undefined);
    },
    subscribe: (listener) => {
      people.add(listener);
      return () => {
        people.delete(listener);
      };
    },
  };

  const tables = new Map<string, TableClient<never, never>>();

  return {
    table(name) {
      // One object per table, so hooks that depend on it don't rerun on every render.
      const known = tables.get(name);
      if (known) return known;
      const path = `/api/data/${encodeURIComponent(name)}`;
      const changed = () => {
        if (!options.subscribe) for (const listener of local) listener(name);
      };
      const client: TableClient<T[typeof name]['row'], T[typeof name]['new']> = {
        name,
        list: async (query = []) => (await call<{ rows: never[] }>('GET', `${path}?q=${encodeURIComponent(JSON.stringify(query))}`)).rows,
        get: async (id) => (await call<{ row: never }>('GET', `${path}/${encodeURIComponent(id)}`)).row,
        create: async (values) => {
          const { row } = await call<{ row: never }>('POST', path, values);
          changed();
          return row;
        },
        update: async (id, values) => {
          const { row } = await call<{ row: never }>('PATCH', `${path}/${encodeURIComponent(id)}`, values);
          changed();
          return row;
        },
        remove: async (id) => {
          await call('DELETE', `${path}/${encodeURIComponent(id)}`);
          changed();
        },
        // '*': one of the app's own routes changed something, maybe this table.
        subscribe: (listener) => {
          const stop = subscribe((table) => (table === name || table === '*') && listener());
          signedListeners.add(listener);
          return () => {
            stop();
            signedListeners.delete(listener);
          };
        },
      };
      tables.set(name, client as TableClient<never, never>);
      return client;
    },
    me: async () => (await call<{ user: User | null }>('GET', '/api/me')).user,
    auth,
    request: async <V>(method: string, path: string, body?: unknown) => {
      const answer = await call<V>(method.toUpperCase(), path, body);
      // While designing the driver says which tables changed; after deploy, refresh every list.
      if (method.toUpperCase() !== 'GET' && !options.subscribe) for (const listener of local) listener('*');
      return answer;
    },
    subscribe,
  };
}
