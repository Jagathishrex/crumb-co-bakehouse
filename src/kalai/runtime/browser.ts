// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// The design-time driver: rows live in the preview's IndexedDB (through Dexie) and are saved back to the project's
// record files (data/records/<table>.json) by the dev server (vite.ts). The files are the source: when IndexedDB is
// missing or behind a file, the table is loaded from the file again.
import Dexie, { type Table as DexieTable } from 'dexie';
import type { Change, Row } from '../model/index.ts';
import type { AuthStore, SecretKind } from './auth.ts';
import type { ChangeListener, DataDriver } from './driver.ts';
import { runQuery, type QueryPart } from './query.ts';

interface StoredRow {
  table: string;
  id: string;
  row: Row;
}

interface TableMeta {
  table: string;
  version: string;
}

class Store extends Dexie {
  rows!: DexieTable<StoredRow, [string, string]>;
  meta!: DexieTable<TableMeta, string>;

  constructor(name: string) {
    super(name);
    // One store for every table, so a model change never needs an IndexedDB upgrade.
    this.version(1).stores({ rows: '[table+id], table', meta: 'table' });
  }
}

export interface FileSync {
  /** Each table's file version. */
  versions(): Promise<Record<string, string>>;
  /** One table's rows from its file. */
  load(table: string): Promise<{ version: string; rows: Row[] }>;
  /** Saves changes to the files; returns the new versions. */
  save(changes: (Change & { table: string })[]): Promise<Record<string, string>>;
  /** Calls back when files changed on disk (the AI, an undo, the Records grid). */
  watch?(callback: (versions: Record<string, string>) => void): void;
}

export interface BrowserDriver extends DataDriver {
  ready: Promise<void>;
  subscribe(listener: ChangeListener): () => void;
  /** Throws away this browser's copy and loads every table from the files again. */
  reset(): Promise<void>;
  /** Waits for unsaved changes to reach the files. */
  flush(): Promise<void>;
}

export function browserDriver(options: { project: string; tables: string[]; sync?: FileSync; saveDelay?: number }): BrowserDriver {
  const store = new Store(`kalai-${options.project}`);
  const listeners = new Set<ChangeListener>();
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`kalai-data-${options.project}`);
  const notify = (table: string, fromChannel = false) => {
    for (const listener of listeners) listener(table);
    if (!fromChannel) channel?.postMessage({ table });
  };
  if (channel) channel.onmessage = (event) => notify(event.data.table, true);

  let pending: (Change & { table: string })[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<void> = Promise.resolve();

  async function loadTable(table: string, version: string, rows: Row[]) {
    await store.transaction('rw', store.rows, store.meta, async () => {
      await store.rows.where('table').equals(table).delete();
      await store.rows.bulkPut(rows.map((row) => ({ table, id: row.id, row })));
      await store.meta.put({ table, version });
    });
    notify(table);
  }

  async function catchUp(versions: Record<string, string>) {
    const sync = options.sync!;
    for (const table of options.tables) {
      const have = await store.meta.get(table);
      if (have?.version === versions[table] && versions[table] !== undefined) continue;
      if (have && versions[table] === undefined) continue;
      const file = await sync.load(table);
      await loadTable(table, file.version, file.rows);
    }
  }

  async function start() {
    if (!options.sync) return;
    try {
      await catchUp(await options.sync.versions());
    } catch (error) {
      // No dev server (a static preview): carry on with whatever this browser has.
      console.warn('[kalai] record files unavailable; using this browser’s copy', error);
    }
    options.sync.watch?.((versions) => {
      if (!pending.length) void catchUp(versions);
    });
  }

  const ready = start();

  function queue(table: string, change: Change) {
    if (!options.sync) return;
    pending.push({ table, ...change });
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), options.saveDelay ?? 250);
  }

  function flush(): Promise<void> {
    clearTimeout(timer);
    if (!options.sync || !pending.length) return saving;
    const batch = pending;
    pending = [];
    saving = saving.then(async () => {
      try {
        const versions = await options.sync!.save(batch);
        // The files now match this browser's rows, so record their versions and skip reloading our own change.
        await store.meta.bulkPut(Object.entries(versions).map(([table, version]) => ({ table, version })));
      } catch (error) {
        console.warn('[kalai] could not save records to files', error);
      }
    });
    return saving;
  }

  const rowsOf = async (table: string) => (await store.rows.where('table').equals(table).toArray()).map((stored) => stored.row);

  return {
    ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async reset() {
      await store.rows.clear();
      await store.meta.clear();
      if (options.sync) await catchUp(await options.sync.versions());
    },
    flush,
    async list(table: string, query: QueryPart[]) {
      await ready;
      return runQuery(await rowsOf(table), query);
    },
    async get(table: string, id: string) {
      await ready;
      return (await store.rows.get([table, id]))?.row ?? null;
    },
    async insert(table: string, row: Row) {
      await ready;
      await store.rows.put({ table, id: row.id, row });
      queue(table, { op: 'put', row });
      notify(table);
      return row;
    },
    async update(table: string, id: string, values: Record<string, unknown>) {
      await ready;
      const before = await store.rows.get([table, id]);
      if (!before) return null;
      const row = { ...before.row, ...values, id };
      await store.rows.put({ table, id, row });
      queue(table, { op: 'put', row });
      notify(table);
      return row;
    },
    async remove(table: string, id: string) {
      await ready;
      const had = Boolean(await store.rows.get([table, id]));
      await store.rows.delete([table, id]);
      if (had) {
        queue(table, { op: 'delete', id });
        notify(table);
      }
      return had;
    },
  };
}

/** Talks to the dev server's /__kalai/data endpoints (vite.ts). */
export function devServerSync(base = ''): FileSync {
  const json = async (response: Response) => {
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return response.json();
  };
  return {
    versions: async () => (await json(await fetch(`${base}/__kalai/data/versions`))).versions,
    load: async (table) => json(await fetch(`${base}/__kalai/data/table/${encodeURIComponent(table)}`)),
    save: async (changes) =>
      (await json(await fetch(`${base}/__kalai/data/patch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ changes }) }))).versions,
    watch(callback) {
      import.meta.hot?.on('kalai:data', (data: { versions: Record<string, string> }) => callback(data.versions));
    },
  };
}

interface StoredSecret {
  kind: SecretKind;
  key: string;
  value: unknown;
}

class SecretDatabase extends Dexie {
  secrets!: DexieTable<StoredSecret, [SecretKind, string]>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ secrets: '[kind+key], kind' });
  }
}

/**
 * Sign-in's secrets while designing (password hashes, codes, sessions): this browser's IndexedDB only, in a database
 * of their own, never saved to the project's files. Clearing the preview's data signs everyone out.
 */
export function browserAuthStore(project: string): AuthStore {
  const database = new SecretDatabase(`kalai-auth-${project}`);
  return {
    get: async <T>(kind: SecretKind, key: string) => ((await database.secrets.get([kind, key]))?.value as T | undefined) ?? null,
    put: async (kind, key, value) => void (await database.secrets.put({ kind, key, value })),
    remove: async (kind, key) => void (await database.secrets.delete([kind, key])),
    list: async <T>(kind: SecretKind) => (await database.secrets.where('kind').equals(kind).toArray()).map((secret) => ({ key: secret.key, value: secret.value as T })),
  };
}
