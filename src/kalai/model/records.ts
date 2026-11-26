// Record files: data/records/<table>.json holds a table's design-time rows, one row per line and sorted by id, so a
// git diff shows exactly which rows changed. The files are the source; a preview's IndexedDB is a copy.
import type { Table } from './schema.ts';

export type Row = Record<string, unknown> & { id: string };

export type Change = { op: 'put'; row: Row } | { op: 'delete'; id: string };

export function serializeRows(rows: Row[]): string {
  const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.length ? `[\n${sorted.map((row) => JSON.stringify(row)).join(',\n')}\n]\n` : '[]\n';
}

export function parseRows(text: string): Row[] {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('A record file holds a list of rows');
  return rows.filter((row): row is Row => typeof row?.id === 'string');
}

export function applyChanges(rows: Row[], changes: Change[]): Row[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const change of changes) {
    if (change.op === 'put') byId.set(change.row.id, change.row);
    else byId.delete(change.id);
  }
  return [...byId.values()];
}

/** A short version for a file's text (FNV-1a), so a preview can tell whether its copy is current. */
export function versionOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const kKept = new Set(['id', 'created_at', 'updated_at', 'owner']);

/** Fits rows to a table's new fields: removed fields go, new fields with a default get it. */
export function fitRows(rows: Row[], table: Table): Row[] {
  const fields = new Map(table.fields.map((field) => [field.name, field]));
  return rows.map((row) => {
    const next: Row = { id: row.id };
    for (const [key, value] of Object.entries(row)) if (kKept.has(key) || fields.has(key)) next[key] = value;
    for (const field of table.fields) if (!(field.name in next) && field.default !== undefined) next[field.name] = field.default;
    return next;
  });
}
