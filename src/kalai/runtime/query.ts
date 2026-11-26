// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// Queries are plain data (as in Appwrite): a list of small parts, not SQL. The same list runs over IndexedDB rows
// in the browser, as Postgres SQL, and later as ZCQL, and it is all an app's code (or the AI) may write.
import type { Row } from '../model/index.ts';

export type Scalar = string | number | boolean;

export type QueryPart =
  | { op: 'equal' | 'notEqual' | 'less' | 'lessEqual' | 'greater' | 'greaterEqual'; field: string; value: Scalar }
  | { op: 'contains'; field: string; value: string }
  | { op: 'isNull' | 'isNotNull'; field: string }
  | { op: 'orderAsc' | 'orderDesc'; field: string }
  | { op: 'limit' | 'offset'; value: number };

export const q = {
  equal: (field: string, value: Scalar): QueryPart => ({ op: 'equal', field, value }),
  notEqual: (field: string, value: Scalar): QueryPart => ({ op: 'notEqual', field, value }),
  less: (field: string, value: Scalar): QueryPart => ({ op: 'less', field, value }),
  lessEqual: (field: string, value: Scalar): QueryPart => ({ op: 'lessEqual', field, value }),
  greater: (field: string, value: Scalar): QueryPart => ({ op: 'greater', field, value }),
  greaterEqual: (field: string, value: Scalar): QueryPart => ({ op: 'greaterEqual', field, value }),
  contains: (field: string, value: string): QueryPart => ({ op: 'contains', field, value }),
  isNull: (field: string): QueryPart => ({ op: 'isNull', field }),
  isNotNull: (field: string): QueryPart => ({ op: 'isNotNull', field }),
  orderAsc: (field: string): QueryPart => ({ op: 'orderAsc', field }),
  orderDesc: (field: string): QueryPart => ({ op: 'orderDesc', field }),
  limit: (value: number): QueryPart => ({ op: 'limit', value }),
  offset: (value: number): QueryPart => ({ op: 'offset', value }),
};

export const kDefaultLimit = 100;
export const kMaxLimit = 1000;

const kOps = new Set(['equal', 'notEqual', 'less', 'lessEqual', 'greater', 'greaterEqual', 'contains', 'isNull', 'isNotNull', 'orderAsc', 'orderDesc', 'limit', 'offset']);

/** Checks a query that came over the network; every field must be one of `fields`. */
export function parseQuery(input: unknown, fields: Set<string>): QueryPart[] {
  if (input === undefined || input === null || input === '') return [];
  if (!Array.isArray(input)) throw new QueryError('A query is a list');
  return input.map((part) => {
    if (!part || typeof part !== 'object' || !kOps.has(part.op)) throw new QueryError(`Unknown query part ${JSON.stringify(part)}`);
    if ('field' in part && !fields.has(part.field)) throw new QueryError(`There is no field "${part.field}"`);
    if ((part.op === 'limit' || part.op === 'offset') && !(Number.isInteger(part.value) && part.value >= 0)) throw new QueryError(`${part.op} needs a whole number`);
    if (part.op === 'contains' && typeof part.value !== 'string') throw new QueryError('contains needs text');
    return part as QueryPart;
  });
}

export class QueryError extends Error {}

const compare = (a: unknown, b: unknown) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as Scalar) < (b as Scalar) ? -1 : 1;
};

/** Runs a query over rows in memory (the browser driver). */
export function runQuery(rows: Row[], query: QueryPart[]): Row[] {
  let out = rows.filter((row) =>
    query.every((part) => {
      const value = 'field' in part ? row[part.field] : undefined;
      switch (part.op) {
        case 'equal':
          return value === part.value;
        case 'notEqual':
          return value !== part.value;
        case 'less':
          return value !== null && value !== undefined && compare(value, part.value) < 0;
        case 'lessEqual':
          return value !== null && value !== undefined && compare(value, part.value) <= 0;
        case 'greater':
          return compare(value, part.value) > 0;
        case 'greaterEqual':
          return compare(value, part.value) >= 0;
        case 'contains':
          return typeof value === 'string' && value.toLowerCase().includes(part.value.toLowerCase());
        case 'isNull':
          return value === null || value === undefined;
        case 'isNotNull':
          return value !== null && value !== undefined;
        default:
          return true;
      }
    }),
  );
  const orders = query.filter((part): part is Extract<QueryPart, { op: 'orderAsc' | 'orderDesc' }> => part.op === 'orderAsc' || part.op === 'orderDesc');
  if (orders.length) {
    out = [...out].sort((a, b) => {
      for (const order of orders) {
        const result = compare(a[order.field], b[order.field]);
        if (result) return order.op === 'orderAsc' ? result : -result;
      }
      return 0;
    });
  }
  const { limit, offset } = pagingOf(query);
  return out.slice(offset, offset + limit);
}

export function pagingOf(query: QueryPart[]) {
  let limit = kDefaultLimit;
  let offset = 0;
  for (const part of query) {
    if (part.op === 'limit') limit = Math.min(part.value, kMaxLimit);
    if (part.op === 'offset') offset = part.value;
  }
  return { limit, offset };
}

/** The query as Postgres SQL with numbered parameters. Field names were checked by parseQuery. */
export function toSql(table: string, query: QueryPart[]): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const where: string[] = [];
  const name = (field: string) => `"${field.replace(/"/g, '""')}"`;
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const kCompare = { equal: '=', notEqual: 'IS DISTINCT FROM', less: '<', lessEqual: '<=', greater: '>', greaterEqual: '>=' } as const;
  for (const part of query) {
    if (part.op in kCompare && 'value' in part && 'field' in part) where.push(`${name(part.field)} ${kCompare[part.op as keyof typeof kCompare]} ${param(part.value)}`);
    else if (part.op === 'contains') where.push(`${name(part.field)} ILIKE ${param(`%${part.value.replace(/[%_\\]/g, '\\$&')}%`)}`);
    else if (part.op === 'isNull') where.push(`${name(part.field)} IS NULL`);
    else if (part.op === 'isNotNull') where.push(`${name(part.field)} IS NOT NULL`);
  }
  const orders = query.flatMap((part) => (part.op === 'orderAsc' ? [`${name(part.field)} ASC`] : part.op === 'orderDesc' ? [`${name(part.field)} DESC`] : []));
  const { limit, offset } = pagingOf(query);
  let text = `SELECT * FROM ${name(table)}`;
  if (where.length) text += ` WHERE ${where.join(' AND ')}`;
  text += ` ORDER BY ${orders.length ? orders.join(', ') : 'created_at ASC'}`;
  text += ` LIMIT ${param(limit)} OFFSET ${param(offset)}`;
  return { text, values };
}
