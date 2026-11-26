// Checks a model beyond its shape: names are unique, links point at real tables, and nothing breaks a target's
// limits. Errors stop a save; warnings are shown in the Data view.
import { AppModel, kReservedNames, kSystemFields, kUserFields, kUsersTable, type Table } from './schema.ts';

export interface Problem {
  path: string;
  message: string;
}

export interface Checked {
  model?: AppModel;
  errors: Problem[];
  warnings: Problem[];
}

const kCatalystMaxColumns = 100;
/** Catalyst adds ROWID, CREATORID, CREATEDTIME and MODIFIEDTIME; Kalai adds id, created_at, updated_at, owner. */
const kExtraColumns = 8;

export function checkModel(input: unknown): Checked {
  const parsed = AppModel.safeParse(input);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })), warnings: [] };
  }
  const model = parsed.data;
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const tableNames = new Set<string>();
  for (const [t, table] of model.tables.entries()) {
    const at = `tables.${t}`;
    if (tableNames.has(table.name)) errors.push({ path: `${at}.name`, message: `There are two tables called "${table.name}"` });
    tableNames.add(table.name);
    if (kReservedNames.has(table.name)) errors.push({ path: `${at}.name`, message: `"${table.name}" is a reserved word; pick another name` });
    checkFields(table, at, errors, warnings);
  }
  if (model.auth) {
    const t = model.tables.findIndex((table) => table.name === kUsersTable);
    const users = model.tables[t];
    if (!users) errors.push({ path: 'auth', message: `Sign-in keeps the app's people in a "${kUsersTable}" table, and there is none` });
    for (const needed of users ? kUserFields : []) {
      const field = users!.fields.find((each) => each.name === needed.name);
      if (!field || field.type !== needed.type) errors.push({ path: `tables.${t}.fields`, message: `Sign-in needs "${kUsersTable}" to keep a short text "${needed.name}" field` });
      else if (needed.unique && (!field.unique || !field.required)) errors.push({ path: `tables.${t}.fields`, message: `Sign-in needs "${kUsersTable}.${needed.name}" to be required and unique` });
    }
  }
  for (const [t, table] of model.tables.entries()) {
    for (const [f, field] of table.fields.entries()) {
      if (field.type === 'link' && field.to && !tableNames.has(field.to)) {
        errors.push({ path: `tables.${t}.fields.${f}.to`, message: `"${field.name}" links to "${field.to}", which isn't a table` });
      }
    }
  }
  return { model: errors.length ? undefined : model, errors, warnings };
}

function checkFields(table: Table, at: string, errors: Problem[], warnings: Problem[]) {
  const names = new Set<string>();
  for (const [f, field] of table.fields.entries()) {
    const path = `${at}.fields.${f}`;
    if (names.has(field.name)) errors.push({ path: `${path}.name`, message: `"${table.name}" has two fields called "${field.name}"` });
    names.add(field.name);
    if ((kSystemFields as readonly string[]).includes(field.name)) errors.push({ path: `${path}.name`, message: `"${field.name}" is made by Kalai for every table` });
    if (kReservedNames.has(field.name)) errors.push({ path: `${path}.name`, message: `"${field.name}" is a reserved word; pick another name` });
    if (field.type === 'link' && !field.to) errors.push({ path: `${path}.to`, message: `"${field.name}" is a link but doesn't say which table` });
    if (field.type !== 'link' && (field.to || field.onDelete)) errors.push({ path: path, message: `"${field.name}" isn't a link, so it can't point at a table` });
    if (field.type === 'link' && field.default !== undefined) errors.push({ path: `${path}.default`, message: 'A link has no default' });
    if (field.type === 'choice' && !field.options?.length) errors.push({ path: `${path}.options`, message: `"${field.name}" is a choice but has no values to choose from` });
    if (field.type === 'choice' && field.options && new Set(field.options).size !== field.options.length) errors.push({ path: `${path}.options`, message: `"${field.name}" offers the same value twice` });
    if (field.type !== 'choice' && field.options) errors.push({ path: `${path}.options`, message: `"${field.name}" isn't a choice, so it has no values to choose from` });
    if (field.type === 'choice' && typeof field.default === 'string' && field.options && !field.options.includes(field.default)) errors.push({ path: `${path}.default`, message: `The default "${field.default}" isn't one of "${field.name}"'s values` });
    if (field.maxLength && field.type !== 'text') errors.push({ path: `${path}.maxLength`, message: 'Only short text has a longest length' });
    if (field.unique && field.type === 'longtext') warnings.push({ path, message: `Catalyst can't make long text unique; "${field.name}" will be checked by Kalai only` });
    if (field.default !== undefined && !defaultFits(field.type, field.default)) errors.push({ path: `${path}.default`, message: `The default doesn't fit a ${field.type} field` });
  }
  if (table.fields.length + kExtraColumns > kCatalystMaxColumns) {
    warnings.push({ path: at, message: `Catalyst allows ${kCatalystMaxColumns} columns per table; "${table.name}" would have ${table.fields.length + kExtraColumns}` });
  }
}

function defaultFits(type: string, value: string | number | boolean): boolean {
  switch (type) {
    case 'yesno':
      return typeof value === 'boolean';
    case 'number':
    case 'bignumber':
      return Number.isInteger(value);
    case 'decimal':
      return typeof value === 'number';
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value));
    default:
      return typeof value === 'string';
  }
}
