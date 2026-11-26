// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// A data driver stores rows. The API (api.ts) does the checking (fields, required, unique, links, who may do what),
// so a driver only reads and writes.
import type { Row } from '../model/index.ts';
import type { QueryPart } from './query.ts';

export interface DataDriver {
  list(table: string, query: QueryPart[]): Promise<Row[]>;
  get(table: string, id: string): Promise<Row | null>;
  insert(table: string, row: Row): Promise<Row>;
  update(table: string, id: string, values: Record<string, unknown>): Promise<Row | null>;
  remove(table: string, id: string): Promise<boolean>;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
}

/** Tells the screens that a table changed, so lists refresh. */
export type ChangeListener = (table: string) => void;
