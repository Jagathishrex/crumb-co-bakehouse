// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// Sign-in: people make an account with an email and a password, confirm the email with a code, log in and out, and
// reset a forgotten password with a code. Routes on the app's API (/api/auth/*). The people are the rows of the
// `users` table; the secrets (password hashes, codes, sessions) live in an AuthStore apart from the rows, so they are
// never in the record files, the API's answers or the AI's view. Web Crypto only, so the same code runs in the
// preview page while designing and on a server after deploy.
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { kUsersTable, signInSettings, type AppModel, type Row, type Table } from '../model/index.ts';
import type { DataDriver, User } from './driver.ts';
import { q } from './query.ts';
import { checkValues, RuleError } from './rules.ts';

export type SecretKind = 'account' | 'code' | 'session';

/** Where sign-in keeps its secrets: IndexedDB while designing (browser.ts), memory in tests, a database after deploy. */
export interface AuthStore {
  get<T>(kind: SecretKind, key: string): Promise<T | null>;
  put(kind: SecretKind, key: string, value: unknown): Promise<void>;
  remove(kind: SecretKind, key: string): Promise<void>;
  list<T>(kind: SecretKind): Promise<{ key: string; value: T }[]>;
}

export type CodePurpose = 'confirm' | 'reset';

/** An email sign-in sends: while designing it is shown in Kalai, after deploy a mail service sends it. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  code: string;
  purpose: CodePurpose;
}

export interface AuthOptions {
  store: AuthStore;
  sendMail: (mail: Mail) => void | Promise<void>;
  /**
   * While designing: the session comes back in the answer (an API in the page has no cookies), and the sample people
   * in the users records, who have no password yet, log in with any password.
   */
  designTime?: boolean;
  now?: () => number;
  /** "Continue with Google" after deploy: the app's OAuth client and the addresses Google sends people back to. */
  google?: GoogleOptions;
  /** For tests: how the server calls Google. */
  fetch?: typeof fetch;
}

export interface GoogleOptions {
  clientId: string;
  clientSecret: string;
  /** This API's /api/auth/google/callback as the public reaches it (added to the client in Google Cloud Console). */
  redirectUri: string;
  /** The app's page, where people land after signing in when the start named none. */
  appUrl: string;
}

interface Account {
  user: string;
  hash: string;
  salt: string;
  confirmed: boolean;
  failures?: number;
  failedAt?: number;
}

interface CodeRecord {
  hash: string;
  expires: number;
  tries: number;
  sent: number;
}

interface SessionRecord {
  user: string;
  expires: number;
}

export const kSessionCookie = 'kalai_session';
const kMinute = 60 * 1000;
const kCodeLife = 10 * kMinute;
const kCodeTries = 5;
const kResendWait = kMinute;
const kSessionLife = 30 * 24 * 60 * kMinute;
const kLoginTries = 10;
const kLockout = 15 * kMinute;
const kMinPassword = 8;

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const randomHex = (size: number) => hex(crypto.getRandomValues(new Uint8Array(size)));
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100_000 }, key, 256));
}

/** Compares without stopping at the first difference, so timing doesn't tell how much matched. */
function same(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
const cleanEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

function checkEmail(email: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RuleError('Enter a valid email address', 400, 'email');
  return email;
}

function checkPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < kMinPassword) throw new RuleError(`Use a password of at least ${kMinPassword} characters`, 400, 'password');
  if (value.length > 200) throw new RuleError('That password is too long', 400, 'password');
  return value;
}

const tokenOf = (c: Context) => /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1] ?? getCookie(c, kSessionCookie) ?? null;

/** The signed-in person (their users row) for a request's session, or null. */
export async function sessionUser(c: Context, driver: DataDriver, options: AuthOptions): Promise<User | null> {
  const token = tokenOf(c);
  if (!token) return null;
  const key = await sha256(token);
  const session = await options.store.get<SessionRecord>('session', key);
  if (!session) return null;
  if (session.expires < (options.now ?? Date.now)()) {
    await options.store.remove('session', key);
    return null;
  }
  return ((await driver.get(kUsersTable, session.user)) as User | null) ?? null;
}

/** Who is calling: the signed-in person when sign-in is on and set up, else whoever `getUser` says (a pretend person while designing). */
export function userGetter(model: AppModel, options: { driver: DataDriver; getUser: (c: Context) => User | null | Promise<User | null>; auth?: AuthOptions }) {
  if (!model.auth || !options.auth) return options.getUser;
  const auth = options.auth;
  return async (c: Context) => (await sessionUser(c, options.driver, auth)) ?? (await options.getUser(c));
}

/** The /api/auth routes. `onChange` is told when a users row is made, so screens listing people refresh. */
export function authRoutes(model: AppModel, driver: DataDriver, options: AuthOptions, onChange?: (table: string) => void, newId: () => string = () => crypto.randomUUID()): Hono {
  // A model saved before a setting existed lacks it (kalai.app.json is read as it is): the defaults fill it.
  const settings = signInSettings(model.auth);
  const users = model.tables.find((table) => table.name === kUsersTable) as Table;
  const { store } = options;
  const now = options.now ?? Date.now;
  const app = new Hono();

  const findUser = async (email: string) => (await driver.list(kUsersTable, [q.equal('email', email), q.limit(1)]))[0] ?? null;
  const body = async (c: Context): Promise<Record<string, unknown>> => {
    const value = await c.req.json().catch(() => null);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuleError('Send the values as an object', 400);
    return value as Record<string, unknown>;
  };

  async function sendCode(purpose: CodePurpose, email: string, quiet = false): Promise<void> {
    const key = `${purpose}:${email}`;
    const before = await store.get<CodeRecord>('code', key);
    if (before && now() - before.sent < kResendWait) {
      if (quiet) return;
      throw new RuleError('A code was sent less than a minute ago. Check your email, or wait a moment and ask again.', 429);
    }
    const code = newCode();
    const what = purpose === 'confirm' ? `confirm your email for ${model.name}` : `reset your ${model.name} password`;
    // The code is kept only once its email went out: after a failed send, asking again sends a new one at once.
    await options.sendMail({ to: email, subject: `${code} is your ${model.name} code`, text: `Enter ${code} to ${what}. It works for 10 minutes. If you didn't ask for it, ignore this email.`, code, purpose });
    await store.put('code', key, { hash: await sha256(`${key}:${code}`), expires: now() + kCodeLife, tries: 0, sent: now() } satisfies CodeRecord);
  }

  async function useCode(purpose: CodePurpose, email: string, code: unknown): Promise<void> {
    const key = `${purpose}:${email}`;
    const record = await store.get<CodeRecord>('code', key);
    if (!record || record.expires < now()) {
      if (record) await store.remove('code', key);
      throw new RuleError('That code has expired. Ask for a new one.', 400, 'code');
    }
    if (record.tries >= kCodeTries) {
      await store.remove('code', key);
      throw new RuleError('Too many wrong codes. Ask for a new one.', 400, 'code');
    }
    const typed = typeof code === 'string' || typeof code === 'number' ? String(code).replace(/\s+/g, '') : '';
    if (!same(await sha256(`${key}:${typed}`), record.hash)) {
      const left = kCodeTries - record.tries - 1;
      await store.put('code', key, { ...record, tries: record.tries + 1 });
      throw new RuleError(left > 0 ? `That code is wrong. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Ask for a new one.', 400, 'code');
    }
    await store.remove('code', key);
  }

  async function newAccount(user: Row, password: string, confirmed: boolean): Promise<void> {
    const salt = randomHex(16);
    await store.put('account', user.id, { user: user.id, salt, hash: await hashPassword(password, salt), confirmed } satisfies Account);
  }

  async function startSession(c: Context, user: Row): Promise<string> {
    const token = randomHex(32);
    await store.put('session', await sha256(token), { user: user.id, expires: now() + kSessionLife } satisfies SessionRecord);
    if (!options.designTime) setCookie(c, kSessionCookie, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: kSessionLife / 1000 });
    return token;
  }

  async function signedIn(c: Context, user: Row) {
    const token = await startSession(c, user);
    return c.json({ user, ...(options.designTime ? { session: token } : {}) });
  }

  /** The person with this email, made when they are new (Google has checked the email, so no code is needed). */
  async function personFor(email: string, name: string | undefined): Promise<Row> {
    const existing = await findUser(email);
    if (existing) return existing;
    if (settings.signUp === 'nobody') throw new RuleError("This app doesn't take new accounts. Ask its owner to add you.", 403);
    const values = checkValues(users, { email, ...(name && users.fields.some((field) => field.name === 'name') ? { name: name.slice(0, 255) } : {}) }, true);
    const id = newId();
    const at = new Date(now()).toISOString();
    const user = await driver.insert(kUsersTable, { id, created_at: at, updated_at: at, owner: id, ...values });
    onChange?.(kUsersTable);
    return user;
  }

  async function endSessionsOf(user: string): Promise<void> {
    for (const { key, value } of await store.list<SessionRecord>('session')) if (value.user === user) await store.remove('session', key);
  }

  // An app that signs in with Google only takes no passwords, codes or emails; one without email codes sends none.
  app.use('/api/auth/*', async (c, next) => {
    if (!settings.methods.includes('password') && /\/api\/auth\/(signup|verify|resend|login|forgot|reset)$/.test(c.req.path)) throw new RuleError('This app signs in with Google', 404);
    if (!settings.emailCodes && /\/api\/auth\/(verify|resend|forgot|reset)$/.test(c.req.path)) throw new RuleError("This app doesn't email codes, so a forgotten password can't be reset here. Ask the app's owner.", 404);
    await next();
  });

  app.post('/api/auth/signup', async (c) => {
    if (settings.signUp === 'nobody') throw new RuleError("This app doesn't take new accounts. Ask its owner to add you.", 403);
    const { email: rawEmail, password: rawPassword, ...rest } = await body(c);
    const email = checkEmail(cleanEmail(rawEmail));
    const password = checkPassword(rawPassword);
    const existing = await findUser(email);
    const account = existing ? await store.get<Account>('account', existing.id) : null;
    // An account whose email was never confirmed can be signed up for again (the first try may have had a typo'd password).
    if (existing && (!account || account.confirmed || !settings.emailCodes)) throw new RuleError('There is already an account with this email. Log in instead.', 409, 'email');
    const values = checkValues(users, { ...rest, email }, !existing);
    let user: Row;
    if (existing) user = (await driver.update(kUsersTable, existing.id, { ...values, updated_at: new Date(now()).toISOString() })) ?? existing;
    else {
      const id = newId();
      const at = new Date(now()).toISOString();
      user = await driver.insert(kUsersTable, { id, created_at: at, updated_at: at, owner: id, ...values });
      onChange?.(kUsersTable);
    }
    await newAccount(user, password, !settings.emailCodes);
    if (!settings.emailCodes) return signedIn(c, user);
    await sendCode('confirm', email, Boolean(existing));
    return c.json({ next: 'confirm', email });
  });

  app.post('/api/auth/verify', async (c) => {
    const values = await body(c);
    const email = cleanEmail(values.email);
    const user = email ? await findUser(email) : null;
    const account = user ? await store.get<Account>('account', user.id) : null;
    if (!user || !account) throw new RuleError('That code has expired. Ask for a new one.', 400, 'code');
    await useCode('confirm', email, values.code);
    await store.put('account', user.id, { ...account, confirmed: true });
    return signedIn(c, user);
  });

  app.post('/api/auth/resend', async (c) => {
    const values = await body(c);
    const email = checkEmail(cleanEmail(values.email));
    const purpose: CodePurpose = values.purpose === 'reset' ? 'reset' : 'confirm';
    const user = await findUser(email);
    if (purpose === 'reset') {
      // Says the same whether or not there is an account, so nobody can test which emails have one.
      if (user) await sendCode('reset', email, true);
    } else {
      const account = user ? await store.get<Account>('account', user.id) : null;
      if (account && !account.confirmed) await sendCode('confirm', email);
    }
    return c.json({ ok: true });
  });

  app.post('/api/auth/login', async (c) => {
    const values = await body(c);
    const email = cleanEmail(values.email);
    const password = typeof values.password === 'string' ? values.password : '';
    const wrong = () => new RuleError('That email or password is wrong', 401);
    const user = email ? await findUser(email) : null;
    if (!user) throw wrong();
    const account = await store.get<Account>('account', user.id);
    // A sample person from the records has no password yet: while designing any password works for them.
    if (!account) {
      if (options.designTime) return signedIn(c, user);
      throw wrong();
    }
    if ((account.failures ?? 0) >= kLoginTries && now() - (account.failedAt ?? 0) < kLockout) throw new RuleError('Too many wrong passwords. Wait 15 minutes, or reset your password.', 429);
    if (!same(await hashPassword(password, account.salt), account.hash)) {
      const failures = now() - (account.failedAt ?? 0) < kLockout ? (account.failures ?? 0) + 1 : 1;
      await store.put('account', user.id, { ...account, failures, failedAt: now() });
      throw wrong();
    }
    if (account.failures) await store.put('account', user.id, { ...account, failures: 0, failedAt: undefined });
    if (!account.confirmed && settings.emailCodes) {
      await sendCode('confirm', email, true);
      return c.json({ next: 'confirm', email });
    }
    return signedIn(c, user);
  });

  app.post('/api/auth/logout', async (c) => {
    const token = tokenOf(c);
    if (token) await store.remove('session', await sha256(token));
    deleteCookie(c, kSessionCookie, { path: '/' });
    return c.json({ ok: true });
  });

  app.post('/api/auth/forgot', async (c) => {
    const email = checkEmail(cleanEmail((await body(c)).email));
    // The same answer whether or not there is an account, so nobody can test which emails have one.
    if (await findUser(email)) await sendCode('reset', email, true);
    return c.json({ next: 'reset', email });
  });

  app.post('/api/auth/reset', async (c) => {
    const values = await body(c);
    const email = cleanEmail(values.email);
    const password = checkPassword(values.password);
    const user = email ? await findUser(email) : null;
    if (!user) throw new RuleError('That code has expired. Ask for a new one.', 400, 'code');
    await useCode('reset', email, values.code);
    // The code came to their email, so the email is confirmed too. Every other session ends.
    await newAccount(user, password, true);
    await endSessionsOf(user.id);
    return signedIn(c, user);
  });

  if (settings.methods.includes('google')) {
    const google = options.google;
    const http = options.fetch ?? fetch;
    const kStateCookie = 'kalai_google_state';

    // While designing: Google can't send people back to a preview, so "Continue with Google" picks a sample person
    // (or any email typed) in the page instead.
    if (options.designTime) {
      app.get('/api/auth/google/pretend', async (c) => c.json({ people: (await driver.list(kUsersTable, [q.limit(20)])).map((row) => ({ email: row.email, name: row.name ?? null })) }));
      app.post('/api/auth/google/pretend', async (c) => {
        const values = await body(c);
        const email = checkEmail(cleanEmail(values.email));
        return signedIn(c, await personFor(email, typeof values.name === 'string' ? values.name : undefined));
      });
    }

    /** Only the app's own pages are places to come back to. */
    const backTo = (wanted: string | undefined) => {
      if (!google) return '/';
      try {
        const url = new URL(wanted ?? '', google.appUrl);
        return url.origin === new URL(google.appUrl).origin ? url.href : google.appUrl;
      } catch {
        return google.appUrl;
      }
    };

    app.get('/api/auth/google/start', (c) => {
      if (!google) throw new RuleError("Google sign-in isn't set up for this app yet. Add its client ID and secret in Nila's Backend → Sign-in, then host it again.", 501);
      const state = randomHex(16);
      setCookie(c, kStateCookie, `${state}|${backTo(c.req.query('return'))}`, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
      const query = new URLSearchParams({ client_id: google.clientId, redirect_uri: google.redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
      return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
    });

    app.get('/api/auth/google/callback', async (c) => {
      if (!google) throw new RuleError("Google sign-in isn't set up for this app yet", 501);
      const [state, back] = (getCookie(c, kStateCookie) ?? '').split('|');
      deleteCookie(c, kStateCookie, { path: '/' });
      const home = back ? backTo(back) : google.appUrl;
      // Refused, cancelled, or not the browser that started it: back to the app, still signed out.
      if (!state || !same(state, c.req.query('state') ?? '') || !c.req.query('code')) return c.redirect(home);
      const exchanged = await http('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: c.req.query('code')!, client_id: google.clientId, client_secret: google.clientSecret, redirect_uri: google.redirectUri, grant_type: 'authorization_code' }),
      });
      const tokens = (await exchanged.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
      if (!exchanged.ok || !tokens.id_token) throw new RuleError(`Google didn't sign you in: ${tokens.error_description ?? exchanged.status}`, 502);
      // Google checks its own token (signature, expiry) and says whose it is.
      const info = (await (await http(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`)).json().catch(() => ({}))) as { aud?: string; iss?: string; email?: string; email_verified?: string | boolean; name?: string };
      const verified = info.email_verified === true || info.email_verified === 'true';
      if (info.aud !== google.clientId || !/^(https:\/\/)?accounts\.google\.com$/.test(info.iss ?? '') || !verified || !info.email) throw new RuleError("Google's answer wasn't for this app, or its email isn't verified", 401);
      await startSession(c, await personFor(cleanEmail(info.email), info.name));
      return c.redirect(home);
    });
  }

  return app;
}

/** Secrets in memory: tests, and a server that keeps none between restarts. */
export function memoryAuthStore(): AuthStore {
  const data = new Map<string, unknown>();
  const id = (kind: SecretKind, key: string) => `${kind}\u0000${key}`;
  return {
    get: async <T>(kind: SecretKind, key: string) => (data.get(id(kind, key)) as T | undefined) ?? null,
    put: async (kind, key, value) => void data.set(id(kind, key), structuredClone(value)),
    remove: async (kind, key) => void data.delete(id(kind, key)),
    list: async <T>(kind: SecretKind) =>
      [...data].filter(([full]) => full.startsWith(`${kind}\u0000`)).map(([full, value]) => ({ key: full.slice(kind.length + 1), value: value as T })),
  };
}
