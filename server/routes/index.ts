// Written by Kalai from the route files beside it (kalai_write_route): change those, not this.
// Each file's register(app, options) adds the app's own endpoints, using only `driver` (never SQL), so the same
// code runs while designing and after deploy.
import { Hono } from 'hono';
import type { AppOptions } from '../app.ts';

export function routes(_options: AppOptions) {
  const app = new Hono();
  return app;
}
