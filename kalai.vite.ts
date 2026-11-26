// Copied from Kalai (packages/runtime); Kalai replaces this file when it updates the project.
// The dev server's side of the record files: serves each table's rows and version, saves the preview's changes, and
// tells open previews when a file changed on disk. Runs inside the project's Vite (Node), so an exported project's
// `npm run dev` keeps its sample data in data/records without Kalai.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { applyChanges, parseRows, serializeRows, versionOf, type Change, type Row } from './src/kalai/model/index.ts';

const kRecords = 'data/records';

/**
 * Addresses of the app's public files ("/images/cup.jpg", url(/fonts/x.woff2)) made relative, for a build served
 * from a folder (Catalyst's /app/, `vite build --base ./`): from the site's root they would miss the folder. Only
 * names that are in public/ (`entries`: its top-level files and folders) change, so "/api/…" and the like stay.
 * `prefix` is how to reach the build's root from the file: "./" for scripts (they resolve against the page),
 * "../" for a stylesheet in assets/.
 */
export function relativePublicPaths(code: string, entries: string[], prefix: string): string {
  const names = entries.filter((name) => name && !name.startsWith('.')).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (names.length === 0) return code;
  return code.replace(new RegExp(`(["'\`(]\\s*)\\/(${names.join('|')})(?=[/"'\`?#)\\s])`, 'g'), `$1${prefix}$2`);
}

export function kalaiData(): Plugin {
  let root = process.cwd();
  /** A build for a folder (base "./"), and the public folder whose files it copies. */
  let relativeBuild = false;
  let publicDir = '';
  const queues = new Map<string, Promise<unknown>>();

  const fileOf = (table: string) => {
    if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error(`Bad table name ${table}`);
    return path.join(root, kRecords, `${table}.json`);
  };
  const read = async (table: string) => fs.readFile(fileOf(table), 'utf8').catch(() => '[]\n');
  const tablesOf = async () => {
    const model = JSON.parse(await fs.readFile(path.join(root, 'kalai.app.json'), 'utf8'));
    return (model.tables as { name: string }[]).map((table) => table.name);
  };
  const versions = async () => Object.fromEntries(await Promise.all((await tablesOf()).map(async (table) => [table, versionOf(await read(table))])));

  /** Writes to one table's file happen one at a time. */
  const serial = <T>(table: string, work: () => Promise<T>): Promise<T> => {
    const next = (queues.get(table) ?? Promise.resolve()).then(work, work);
    queues.set(table, next);
    return next;
  };

  async function save(changes: (Change & { table: string })[]) {
    const byTable = new Map<string, Change[]>();
    for (const { table, ...change } of changes) byTable.set(table, [...(byTable.get(table) ?? []), change as Change]);
    await Promise.all(
      [...byTable].map(([table, list]) =>
        serial(table, async () => {
          const rows = applyChanges(parseRows(await read(table)), list);
          await fs.mkdir(path.dirname(fileOf(table)), { recursive: true });
          await fs.writeFile(fileOf(table), serializeRows(rows));
        }),
      ),
    );
    return versions();
  }

  const body = (request: import('node:http').IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let text = '';
      request.on('data', (chunk) => (text += chunk));
      request.on('end', () => resolve(text));
      request.on('error', reject);
    });

  return {
    name: 'kalai-data',
    // Kalai's own files (src/kalai: the runtime, the model, db.ts) are swapped in by a full reload, never hot: an open
    // screen keeps its hooks' state across a hot swap, so a runtime hook that gained or lost a hook (useAuth, useRows)
    // would crash it ("change in the order of Hooks").
    handleHotUpdate({ file, server }) {
      if (!path.resolve(file).startsWith(path.join(root, 'src/kalai') + path.sep)) return;
      server.ws.send({ type: 'full-reload' });
      return [];
    },
    configResolved(config) {
      root = config.root;
      relativeBuild = config.command === 'build' && (config.base === './' || config.base === '');
      publicDir = config.publicDir || '';
    },
    // Hosted under a folder: screens' "/images/…" (and the like) point into it, as index.html's links already do.
    async generateBundle(_options, bundle) {
      if (!relativeBuild || !publicDir) return;
      const entries = await fs.readdir(publicDir).catch(() => [] as string[]);
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') item.code = relativePublicPaths(item.code, entries, './');
        else if (item.fileName.endsWith('.css') && typeof item.source === 'string') item.source = relativePublicPaths(item.source, entries, '../'.repeat(item.fileName.split('/').length - 1) || './');
      }
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__kalai/data', async (request, response) => {
        const send = (status: number, data: unknown) => {
          response.statusCode = status;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(data));
        };
        try {
          const url = request.url ?? '/';
          if (request.method === 'GET' && url === '/versions') return send(200, { versions: await versions() });
          const table = /^\/table\/([^/?]+)/.exec(url)?.[1];
          if (request.method === 'GET' && table) {
            const text = await read(decodeURIComponent(table));
            return send(200, { version: versionOf(text), rows: parseRows(text) as Row[] });
          }
          if (request.method === 'POST' && url === '/patch') {
            const { changes } = JSON.parse(await body(request));
            return send(200, { versions: await save(changes) });
          }
          send(404, { error: 'Not found' });
        } catch (error) {
          send(500, { error: String((error as Error).message ?? error) });
        }
      });
      // Files changed on disk (by the Records grid, the AI, an undo): tell every open preview the new versions.
      let timer: ReturnType<typeof setTimeout> | undefined;
      server.watcher.add(path.join(root, kRecords));
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(path.join(root, kRecords))) return;
        clearTimeout(timer);
        timer = setTimeout(async () => server.ws.send({ type: 'custom', event: 'kalai:data', data: { versions: await versions() } }), 100);
      });
    },
  };
}
