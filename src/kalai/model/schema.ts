// The shape of kalai.app.json. Only types every target can store are offered (Catalyst Data Store is the narrowest:
// Var Char, Text, Int, BigInt, Double, Boolean, Date, DateTime and Foreign Key), so a model that passes here deploys
// to Catalyst and to Postgres alike.
import { z } from 'zod';

/** Lower-case words joined by underscores; Catalyst and Postgres both accept it unquoted. */
export const kName = /^[a-z][a-z0-9_]{0,49}$/;

export const kFieldTypes = ['text', 'longtext', 'number', 'bignumber', 'decimal', 'yesno', 'date', 'datetime', 'choice', 'link'] as const;
export type FieldType = (typeof kFieldTypes)[number];

/** What a designer sees for each type. */
export const kFieldTypeLabels: Record<FieldType, string> = {
  text: 'Short text',
  longtext: 'Long text',
  number: 'Whole number',
  bignumber: 'Big number',
  decimal: 'Decimal',
  yesno: 'Yes / no',
  date: 'Date',
  datetime: 'Date and time',
  choice: 'Choice',
  link: 'Link to a table',
};

export const kAccess = ['anyone', 'signedIn', 'owner', 'nobody'] as const;
export type Access = (typeof kAccess)[number];

const name = z.string().regex(kName, 'Use lower-case letters, numbers and _, starting with a letter (at most 50)');

export const Field = z.object({
  name,
  type: z.enum(kFieldTypes),
  label: z.string().optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  /** A plain value; for a link, none. */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** text only: the longest value (Catalyst's Var Char allows 255). */
  maxLength: z.number().int().min(1).max(255).optional(),
  /** choice only: the values it may have, in the order they are offered. */
  options: z.array(z.string().min(1).max(255)).optional(),
  /** link only: the table it points at. */
  to: name.optional(),
  /** link only: what happens to this row when the linked row is deleted. */
  onDelete: z.enum(['setNull', 'cascade']).optional(),
});
export type Field = z.infer<typeof Field>;

export const TableAccess = z.object({
  read: z.enum(kAccess).default('anyone'),
  create: z.enum(kAccess).default('anyone'),
  update: z.enum(kAccess).default('anyone'),
  delete: z.enum(kAccess).default('anyone'),
});
export type TableAccess = z.infer<typeof TableAccess>;

export const Table = z.object({
  name,
  label: z.string().optional(),
  fields: z.array(Field),
  access: TableAccess.optional(),
  /** Where the Data view draws the table; not part of the data. */
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  /** The colour of its strip on the diagram (#rrggbb); not part of the data. */
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
export type Table = z.infer<typeof Table>;

/**
 * Sign-in: people make an account with their email and a password, and/or continue with Google. On when present; the
 * people are the rows of the `users` table. Emailed codes (confirm the email, reset a forgotten password) are off by
 * default: a hosted app can only send them once email is set up (on Catalyst, a sender on a DNS-verified domain).
 */
export const kSignInMethods = ['password', 'google'] as const;
export type SignInMethod = (typeof kSignInMethods)[number];

const SignInSettings = z.object({
  /**
   * How people sign in: an email and a password, and/or "Continue with Google" (Google has checked the email, so no
   * codes or emails are needed).
   */
  methods: z.array(z.enum(kSignInMethods)).min(1, 'Pick at least one way to sign in').default(['password']),
  /** Who may make an account: anyone, or nobody (the app's people are added by hand). */
  signUp: z.enum(['anyone', 'nobody']).default('anyone'),
  /**
   * Codes by email (email and password only): a new account confirms its email with a code, and a forgotten password
   * is reset with one. Off by default, because a hosted app needs email set up to send them; off, an account works as
   * soon as it is made and there is no "Forgot password".
   */
  emailCodes: z.boolean().default(false),
  /** Google's OAuth client for this app. The id isn't secret; the secret is kept by Nila, never in the project. */
  google: z.object({ clientId: z.string().max(300) }).optional(),
});
/** Models saved before 27 Nov 2026 called emailCodes "confirmEmail" (and its default was on). */
export const SignIn = z.preprocess(
  (value) => (value && typeof value === 'object' && 'confirmEmail' in value && !('emailCodes' in value) ? { ...value, emailCodes: (value as { confirmEmail: unknown }).confirmEmail } : value),
  SignInSettings,
);
export type SignIn = z.infer<typeof SignInSettings>;

export const AppModel = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  tables: z.array(Table),
  auth: SignIn.optional(),
});
export type AppModel = z.infer<typeof AppModel>;

/** The table that holds the app's people when sign-in is on. */
export const kUsersTable = 'users';

/** The users table's fields sign-in needs; the app may add its own (a role, a plan) after them. */
export const kUserFields: Field[] = [
  { name: 'email', type: 'text', required: true, unique: true },
  { name: 'name', type: 'text' },
];

/** Who may do what with the users rows: signed-in people see them, each changes only their own, and accounts are made by signing up. */
export const kUserAccess: TableAccess = { read: 'signedIn', create: 'nobody', update: 'owner', delete: 'nobody' };

/** Sign-in turned on: the settings, and a users table holding email and name (an existing one keeps its own fields). */
export function withSignIn(model: AppModel, settings: Partial<SignIn> = {}): AppModel {
  const auth = SignIn.parse({ ...model.auth, ...settings });
  const users = model.tables.find((table) => table.name === kUsersTable);
  const fields = users ? [...kUserFields.map((field) => ({ ...users.fields.find((own) => own.name === field.name), ...field })), ...users.fields.filter((own) => !kUserFields.some((field) => field.name === own.name))] : kUserFields;
  const table: Table = { ...(users ?? { name: kUsersTable, label: 'Users', position: { x: 0, y: 80 } }), fields, access: users?.access ?? kUserAccess };
  return { ...model, auth, tables: users ? model.tables.map((each) => (each.name === kUsersTable ? table : each)) : [table, ...model.tables] };
}

/** Sign-in turned off; the users table and its rows stay. */
export function withoutSignIn(model: AppModel): AppModel {
  const { auth: _auth, ...rest } = model;
  return rest;
}

/** The sign-in methods a model offers (password when sign-in is off, for older models). */
export const signInMethods = (model: AppModel): SignInMethod[] => model.auth?.methods ?? ['password'];

/**
 * A model's sign-in settings with the defaults filled in. kalai.app.json can be read as it is (unparsed), so a model
 * saved before a setting existed lacks it, and an older one says confirmEmail for emailCodes.
 */
export function signInSettings(auth: unknown): SignIn {
  const parsed = SignIn.safeParse(auth ?? {});
  return parsed.success ? parsed.data : SignIn.parse({});
}

/** True for a users field sign-in relies on: it can't be renamed, retyped or removed while sign-in is on. */
export const isSignInField = (model: AppModel, table: string, field: string) => Boolean(model.auth) && table === kUsersTable && kUserFields.some((each) => each.name === field);

/** Columns every table has; a field can't use these names. */
export const kSystemFields = ['id', 'created_at', 'updated_at', 'owner'] as const;

/** Names Catalyst keeps for itself or Postgres treats as keywords. */
export const kReservedNames = new Set(['rowid', 'creatorid', 'createdtime', 'modifiedtime', 'user', 'order', 'select', 'table', 'group', 'from', 'where']);

export const emptyModel = (appName: string): AppModel => ({ version: 1, name: appName, tables: [] });

/** A table's access rules with the defaults filled in. */
export const accessOf = (table: Table): TableAccess => TableAccess.parse(table.access ?? {});

/** True when a row of this table belongs to the person who made it (an `owner` column is kept). */
export const hasOwner = (table: Table) => Object.values(accessOf(table)).includes('owner');
