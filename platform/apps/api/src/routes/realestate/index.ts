// Hemlo Systems · Real Estate edition: every /v1/re route. /v1/re/pub/* are the public pages (no sign-in).
import { Hono } from 'hono';
import { reSetupRoutes } from './setup';
import { rePropertyRoutes } from './properties';
import { reLeadRoutes } from './leads';
import { reWorkRoutes } from './work';
import { reTodayRoutes } from './today';
import { reAiRoutes } from './ai';
import { reContractRoutes } from './contracts';
import { rePublicRoutes } from './public';
import type { AppEnv, Deps } from '../../types';

export function reRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.route('/pub', rePublicRoutes(d));
  for (const make of [reSetupRoutes, rePropertyRoutes, reLeadRoutes, reWorkRoutes, reTodayRoutes, reAiRoutes, reContractRoutes]) r.route('/', make(d));
  return r;
}
