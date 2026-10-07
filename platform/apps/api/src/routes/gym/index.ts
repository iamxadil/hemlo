// Hemlo Systems · Gym edition: every /v1/gym route.
import { Hono } from 'hono';
import { gymSetupRoutes } from './setup';
import { gymMemberRoutes } from './members';
import { gymMembershipRoutes } from './memberships';
import { gymCheckinRoutes } from './checkin';
import { gymClassRoutes } from './classes';
import { gymReportRoutes } from './reports';
import { gymDoorRoutes } from './door';
import { gymImportRoutes } from './import';
import type { AppEnv, Deps } from '../../types';

export function gymRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  for (const make of [gymSetupRoutes, gymMemberRoutes, gymMembershipRoutes, gymCheckinRoutes, gymClassRoutes, gymReportRoutes, gymDoorRoutes, gymImportRoutes]) r.route('/', make(d));
  return r;
}
