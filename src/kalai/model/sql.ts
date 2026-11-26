// The model as Postgres: the tables a new database needs, and the steps that move an old model's database to a new
// model. Steps that lose data are returned apart, so Deploy can show them and ask first.
import { hasOwner, type AppModel, type Field, type Table } from './schema.ts';

export const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

export function columnType(field: Field): string {
  switch (field.type) {
    case 'text':
      return `varchar(${field.maxLength ?? 255})`;
    case 'longtext':
      return 'text';
    case 'number':
      return 'integer';
    case 'bignumber':
      return 'bigint';
    case 'decimal':
      return 'double precision';
    case 'yesno':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
      return 'timestamptz';
    case 'choice':
    case 'link':
      return 'text';
  }
}

const literal = (value: string | number | boolean) => (typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value));

function columnSql(field: Field): string {
  let sql = `${quote(field.name)} ${columnType(field)}`;
  if (field.required) sql += ' NOT NULL';
  if (field.unique) sql += ' UNIQUE';
  if (field.default !== undefined) sql += ` DEFAULT ${literal(field.default)}`;
  return sql;
}

function linkSql(table: Table, field: Field): string {
  const onDelete = field.onDelete === 'cascade' ? 'CASCADE' : 'SET NULL';
  return `ALTER TABLE ${quote(table.name)} ADD CONSTRAINT ${quote(`${table.name}_${field.name}_fk`)} FOREIGN KEY (${quote(field.name)}) REFERENCES ${quote(field.to!)} (id) ON DELETE ${onDelete}`;
}

function createTableSql(table: Table): string {
  const columns = [
    'id text PRIMARY KEY DEFAULT gen_random_uuid()::text',
    'created_at timestamptz NOT NULL DEFAULT now()',
    'updated_at timestamptz NOT NULL DEFAULT now()',
    ...(hasOwner(table) ? ['owner text'] : []),
    ...table.fields.map(columnSql),
  ];
  return `CREATE TABLE ${quote(table.name)} (\n  ${columns.join(',\n  ')}\n)`;
}

export interface Step {
  /** In plain words, for the Deploy preview. */
  description: string;
  sql: string;
}

export interface Migration {
  steps: Step[];
  /** Steps that remove data; run only when the person agrees. */
  destructive: Step[];
  /** Changes Kalai can't make in place (a field's type changed). */
  blocked: string[];
}

/** What turns a database made for `before` (null: an empty database) into one for `after`. */
export function migrate(before: AppModel | null, after: AppModel): Migration {
  const steps: Step[] = [];
  const links: Step[] = [];
  const destructive: Step[] = [];
  const blocked: string[] = [];
  const old = new Map((before?.tables ?? []).map((table) => [table.name, table]));
  for (const table of after.tables) {
    const was = old.get(table.name);
    if (!was) {
      steps.push({ description: `Add the table ${table.name}`, sql: createTableSql(table) });
      for (const field of table.fields) if (field.type === 'link') links.push({ description: `Link ${table.name}.${field.name} to ${field.to}`, sql: linkSql(table, field) });
      continue;
    }
    const oldFields = new Map(was.fields.map((field) => [field.name, field]));
    if (hasOwner(table) && !hasOwner(was)) steps.push({ description: `Keep who made each ${table.name} row`, sql: `ALTER TABLE ${quote(table.name)} ADD COLUMN owner text` });
    for (const field of table.fields) {
      const prior = oldFields.get(field.name);
      if (!prior) {
        // A required field added to a table that may have rows needs a default, or the step fails.
        const sql = columnSql(field.required && field.default === undefined ? { ...field, required: false } : field);
        steps.push({ description: `Add the field ${table.name}.${field.name}`, sql: `ALTER TABLE ${quote(table.name)} ADD COLUMN ${sql}` });
        if (field.type === 'link') links.push({ description: `Link ${table.name}.${field.name} to ${field.to}`, sql: linkSql(table, field) });
      } else if (columnType(prior) !== columnType(field) || prior.to !== field.to) {
        blocked.push(`${table.name}.${field.name} changed from ${prior.type} to ${field.type}; add a new field and copy the data instead`);
      }
    }
    for (const prior of was.fields) {
      if (!table.fields.some((field) => field.name === prior.name)) {
        destructive.push({ description: `Remove the field ${table.name}.${prior.name} and its data`, sql: `ALTER TABLE ${quote(table.name)} DROP COLUMN ${quote(prior.name)}` });
      }
    }
  }
  for (const was of before?.tables ?? []) {
    if (!after.tables.some((table) => table.name === was.name)) {
      destructive.push({ description: `Remove the table ${was.name} and all its rows`, sql: `DROP TABLE ${quote(was.name)} CASCADE` });
    }
  }
  return { steps: [...steps, ...links], destructive, blocked };
}
