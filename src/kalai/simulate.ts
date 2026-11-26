// The design-time backend: the app's own server code (server/app.ts) running in this page, over IndexedDB, with
// changes saved to data/records by the dev server (kalai.vite.ts). Not part of a production build.
import { browserAuthStore, browserDriver, devServerSync } from './runtime/browser.ts';
import type { Mail } from './runtime/auth.ts';
import type { AppModel } from './model/index.ts';
import model from '../../kalai.app.json';
import project from '../../package.json';
import { createApp } from '../../server/app.ts';

export function start() {
  const driver = browserDriver({ project: project.name, tables: (model as AppModel).tables.map((table) => table.name), sync: devServerSync() });
  const app = createApp({
    driver,
    checkConstraints: true,
    getUser: (c) => {
      const id = c.req.header('x-kalai-user');
      return id ? { id } : null;
    },
    // Sign-in while designing: secrets in this browser only, and emails shown in Kalai instead of sent.
    auth: { store: browserAuthStore(project.name), sendMail: showMail, designTime: true },
  });
  // Kalai opens the app with ?kalai-reset to start again from the record files.
  if (new URLSearchParams(location.search).has('kalai-reset')) void driver.reset();
  return { app, driver };
}

/** An email sign-in would send: Kalai shows it beside the app (and the console has it), so the code can be typed in. */
function showMail(mail: Mail) {
  console.info(`[kalai] Email to ${mail.to}: ${mail.subject}`);
  for (const target of new Set([window.parent, window.opener as Window | null, window.top])) {
    if (target && target !== window) target.postMessage({ type: 'kalai:mail', mail }, '*');
  }
}
