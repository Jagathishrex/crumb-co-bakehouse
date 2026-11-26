// The app's server: the API Kalai makes from kalai.app.json, plus the app's own routes (server/routes). Browser-safe
// on purpose: while designing it runs inside the preview page; after deploy it runs on a server.
import { Hono, type Context } from 'hono';
import { createApi, userGetter, type AuthOptions, type DataDriver, type User } from '../src/kalai/runtime/index.ts';
import type { AppModel } from '../src/kalai/model/index.ts';
import model from '../kalai.app.json';
import { routes } from './routes/index.ts';

export interface AppOptions {
  driver: DataDriver;
  getUser: (c: Context) => User | null | Promise<User | null>;
  checkConstraints?: boolean;
  /** Sign-in's secrets and email (when it is on in the model). */
  auth?: AuthOptions;
}

export function createApp(options: AppOptions) {
  const app = new Hono();
  // The app's own routes see the signed-in person too.
  const getUser = userGetter(model as AppModel, options);
  app.route('/', routes({ ...options, getUser }));
  app.route('/', createApi({ model: model as AppModel, ...options }));
  return app;
}
