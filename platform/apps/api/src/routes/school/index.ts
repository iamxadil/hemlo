// Hemlo School: every /v1/sch route. /v1/sch/pub/* is the guardian's page (no sign-in).
import { Hono } from 'hono';
import { schSetupRoutes } from './setup';
import { schStudentRoutes } from './students';
import { schFeeRoutes } from './fees';
import { schAttendanceRoutes } from './attendance';
import { schPublicRoutes } from './public';
import type { AppEnv, Deps } from '../../types';

export function schoolRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.route('/pub', schPublicRoutes(d));
  for (const make of [schSetupRoutes, schStudentRoutes, schFeeRoutes, schAttendanceRoutes]) r.route('/', make(d));
  return r;
}
