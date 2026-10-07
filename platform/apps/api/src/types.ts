import type { Database } from '@hemlo/db';
import type { Auth, AuthEnv } from '@hemlo/auth/server';
import type { Notifier, NotifyEnv } from '@hemlo/notify';
import type { Principal } from './principal';
import type { Staff } from './staff';
import type { FileStore } from './files';
import type { Engine } from './ai/engine';

export type Env = AuthEnv & NotifyEnv & { ALLOWED_RETURN_HOSTS?: string; EARLY_ACCESS_NOTIFY?: string; ADMIN_URL?: string; FIB_BASE_URL?: string;
  // usage tracker (admin): read-only keys for live plan meters, and the plan limits (defaults: the free plans)
  NEON_API_KEY?: string; NEON_PROJECT_ID?: string; CF_API_TOKEN?: string; CF_ACCOUNT_ID?: string;
  LIMIT_DB_MB?: string; LIMIT_CU_HOURS?: string; LIMIT_REQUESTS_DAY?: string;
  // Hemlo AI: the paid engine (when set), Hemlo's monthly budget for it, and an off switch for every AI feature
  ANTHROPIC_API_KEY?: string; AI_BUDGET_USD?: string; AI_OFF?: string;
  // where the system app lives (the demo agency's photographs are its static files), and the public pages' site
  SYSTEM_URL?: string; PUBLIC_SITE_URL?: string };

export interface Deps { db: Database; auth: Auth; env: Env; notifier: Notifier; files?: FileStore; ai?: Engine;
  /** tell a clinic's waiting-room screens that its queue changed (the Worker's ScreenHub; absent in tests) */
  screens?: { changed(org: string): void } }

export type AppEnv = { Variables: { principal: Principal | null; deps: Deps; staff?: Staff } };
