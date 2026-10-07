// Used only by `npx auth generate` to write packages/db/src/auth-schema.ts. Not part of the app.
import { drizzle } from 'drizzle-orm/pglite';
import { createAuth } from './server';
import { createNotifier } from '@hemlo/notify';

export const auth = createAuth({
  db: drizzle({} as any) as any,
  notifier: createNotifier({ DEV_CONSOLE_MESSAGES: '1' }),
  env: { AUTH_SECRET: 'cli-only-secret-cli-only-secret-00', API_URL: 'http://localhost:8787', ACCOUNT_URL: 'http://localhost:4321', TRUSTED_ORIGINS: 'http://localhost:4321', PASSKEY_RP_ID: 'localhost', GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', PHONE_SIGN_IN: '1' },
});
