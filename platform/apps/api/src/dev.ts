// Local development: `npm run dev:api` → http://localhost:8787, with an embedded Postgres saved in .data/
// Every message (codes, invitations) is printed in this terminal instead of being sent.
process.env.TZ = 'UTC';
import { serve } from '@hono/node-server';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from './app';
import { memoryStore } from './files';
import type { Env } from './types';

const env: Env = {
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'dev-secret-dev-secret-dev-secret-0000',
  API_URL: 'http://localhost:8787',
  ACCOUNT_URL: 'http://localhost:4321',
  TRUSTED_ORIGINS: 'http://localhost:4321,http://localhost:8787',
  PASSKEY_RP_ID: 'localhost',
  PHONE_SIGN_IN: '1',
  DEV_CONSOLE_MESSAGES: '1',
  ALLOWED_RETURN_HOSTS: 'localhost',
};

const { db } = await createPgliteDb(process.env.PGLITE_DIR ?? '.data/dev-db');
const { app } = createApp({ db, env, files: memoryStore() }); // uploads live in memory while developing
serve({ fetch: app.fetch, port: 8787 }, () => console.log('Hemlo API → http://localhost:8787  (codes print here)'));
