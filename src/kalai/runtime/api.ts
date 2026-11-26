// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// The API made from the model: list, get, create, change and delete rows of every table, with the model's rules and
// access words applied. One Hono app, so the same code runs in the browser while designing, on Vercel, in a Catalyst
// function and on any Node server.
import { Hono, type Context } from 'hono';
import { accessOf, hasOwner, kUsersTable, type Access, type AppModel, type Row, type Table } from '../model/index.ts';
import { authRoutes, userGetter, type AuthOptions } from './auth.ts';
import type { DataDriver, User } from './driver.ts';
import { parseQuery, q, QueryError, type QueryPart } from './query.ts';
import { checkValues, isRuleError, RuleError } from './rules.ts';

export interface ApiOptions {
  model: AppModel;
  driver: DataDriver;
  /** Who is calling; null when nobody is signed in. */
  getUser: (c: Context) => User | null | Promise<User | null>;
  /** Called after a write, so screens showing that table refresh. */
  onChange?: (table: string) => void;
  /** Unique fields and links: the browser driver needs the API to check them; Postgres checks them itself. */
  checkConstraints?: boolean;
  newId?: () => string;
  /** Sign-in's secrets and mail, for a model with sign-in on (model.auth); see auth.ts. */
  auth?: AuthOptions;
}

const kSystem = ['id', 'created_at', 'updated_at', 'owner'];

function allowed(access: Access, user: User | null, row?: Row, table?: Table): boolean {
  switch (access) {
    case 'anyone':
      return true;
    case 'signedIn':
      return Boolean(user);
    case 'owner':
      // A person's own users row is theirs, even a sample one made without an owner.
      return Boolean(user) && (!row || row.owner === user!.id || (table?.name === kUsersTable && row.id === user!.id));
    case 'nobody':
      return false;
  }
}

function deny(access: Access, user: User | null): never {
  throw new RuleError(user || access === 'nobody' ? "You can't do that" : 'Sign in first', user || access === 'nobody' ? 403 : 401);
}

export function createApi(options: ApiOptions): Hono {
  const { model, driver } = options;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const tables = new Map(model.tables.map((table) => [table.name, table]));
  const app = new Hono();
  // With sign-in on, the session says who is calling.
  const getUser = userGetter(model, options);

  const tableOf = (c: Context): Table => {
    const table = tables.get(c.req.param('table') ?? '');
    if (!table) throw new RuleError(`There is no table "${c.req.param('table')}"`, 404);
    return table;
  };

  async function checkConstraints(table: Table, values: Record<string, unknown>, id?: string) {
    if (!options.checkConstraints) return;
    for (const field of table.fields) {
      const value = values[field.name];
      if (value === null || value === undefined) continue;
      if (field.unique) {
        const same = await driver.list(table.name, [q.equal(field.name, value as string), q.limit(2)]);
        if (same.some((row) => row.id !== id)) throw new RuleError(`Another ${table.name} row already has this ${field.name}`, 409, field.name);
      }
      if (field.type === 'link' && !(await driver.get(field.to!, value as string))) {
        throw new RuleError(`${field.name} points at a ${field.to} row that doesn't exist`, 400, field.name);
      }
    }
  }

  /** What deleting a row does to rows that link to it (Postgres does this itself; the browser driver needs it). */
  async function followLinks(table: Table, id: string) {
    if (!options.checkConstraints) return;
    for (const other of model.tables) {
      for (const field of other.fields) {
        if (field.type !== 'link' || field.to !== table.name) continue;
        const linked = await driver.list(other.name, [q.equal(field.name, id), q.limit(1000)]);
        for (const row of linked) {
          if (field.onDelete === 'cascade') {
            await followLinks(other, row.id);
            await driver.remove(other.name, row.id);
          } else await driver.update(other.name, row.id, { [field.name]: null, updated_at: new Date().toISOString() });
          options.onChange?.(other.name);
        }
      }
    }
  }

  app.onError((error, c) => {
    if (isRuleError(error)) return c.json({ error: error.message, field: error.field }, error.status as 400);
    if (error instanceof QueryError) return c.json({ error: error.message }, 400);
    console.error('[kalai api]', error);
    return c.json({ error: 'Something went wrong on the server' }, 500);
  });

  app.get('/api/me', async (c) => c.json({ user: await getUser(c) }));

  if (model.auth && options.auth) app.route('/', authRoutes(model, driver, options.auth, options.onChange, newId));
  else if (model.auth) app.all('/api/auth/*', (c) => c.json({ error: 'Sign-in is on in the model, but this server has no sign-in store' }, 501));

  app.get('/api/data/:table', async (c) => {
    const table = tableOf(c);
    const user = await getUser(c);
    const access = accessOf(table).read;
    if (!allowed(access, user)) deny(access, user);
    const fields = new Set([...kSystem, ...table.fields.map((field) => field.name)]);
    let query: QueryPart[];
    try {
      query = parseQuery(JSON.parse(c.req.query('q') || '[]'), fields);
    } catch (error) {
      throw error instanceof QueryError ? error : new QueryError('The query is not valid JSON');
    }
    if (access === 'owner') query = [q.equal('owner', user!.id), ...query];
    return c.json({ rows: await driver.list(table.name, query) });
  });

  app.get('/api/data/:table/:id', async (c) => {
    const table = tableOf(c);
    const user = await getUser(c);
    const row = await driver.get(table.name, c.req.param('id'));
    const access = accessOf(table).read;
    if (!row) throw new RuleError('Not found', 404);
    if (!allowed(access, user, row, table)) deny(access, user);
    return c.json({ row });
  });

  app.post('/api/data/:table', async (c) => {
    const table = tableOf(c);
    const user = await getUser(c);
    const access = accessOf(table).create;
    if (!allowed(access, user)) deny(access, user);
    const values = checkValues(table, await c.req.json().catch(() => null), true);
    await checkConstraints(table, values);
    const now = new Date().toISOString();
    const row: Row = { id: newId(), created_at: now, updated_at: now, ...(hasOwner(table) ? { owner: user?.id ?? null } : {}), ...values };
    const saved = await driver.insert(table.name, row);
    options.onChange?.(table.name);
    return c.json({ row: saved }, 201);
  });

  app.patch('/api/data/:table/:id', async (c) => {
    const table = tableOf(c);
    const user = await getUser(c);
    const id = c.req.param('id');
    const before = await driver.get(table.name, id);
    if (!before) throw new RuleError('Not found', 404);
    const access = accessOf(table).update;
    if (!allowed(access, user, before, table)) deny(access, user);
    const values = checkValues(table, await c.req.json().catch(() => null), false);
    // A person's email is their sign-in: it isn't changed as a plain field.
    if (model.auth && table.name === kUsersTable && 'email' in values) throw new RuleError("An account's email can't be changed here", 400, 'email');
    for (const field of table.fields) if (field.required && field.name in values && values[field.name] === null) throw new RuleError(`${field.name} is required`, 400, field.name);
    await checkConstraints(table, values, id);
    const row = await driver.update(table.name, id, { ...values, updated_at: new Date().toISOString() });
    options.onChange?.(table.name);
    return c.json({ row });
  });

  app.delete('/api/data/:table/:id', async (c) => {
    const table = tableOf(c);
    const user = await getUser(c);
    const id = c.req.param('id');
    const before = await driver.get(table.name, id);
    if (!before) throw new RuleError('Not found', 404);
    const access = accessOf(table).delete;
    if (!allowed(access, user, before, table)) deny(access, user);
    await followLinks(table, id);
    await driver.remove(table.name, id);
    options.onChange?.(table.name);
    return c.json({ ok: true });
  });

  return app;
}
