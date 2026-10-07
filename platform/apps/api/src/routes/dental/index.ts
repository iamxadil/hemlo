// Hemlo Systems · Dental edition: every /v1/dent route.
import { Hono } from 'hono';
import { dentalSetupRoutes } from './setup';
import { dentalPatientRoutes } from './patients';
import { dentalScheduleRoutes } from './schedule';
import { dentalChartRoutes } from './chart';
import { dentalVisitRoutes } from './visits';
import { dentalLabRoutes } from './lab';
import { dentalRecordRoutes } from './records';
import { dentalReportRoutes } from './reports';
import { dentalScreenRoutes } from './screen';
import { dentalImportRoutes } from './import';
import type { AppEnv, Deps } from '../../types';

export function dentalRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  for (const make of [dentalSetupRoutes, dentalPatientRoutes, dentalScheduleRoutes, dentalChartRoutes, dentalVisitRoutes, dentalLabRoutes, dentalRecordRoutes, dentalReportRoutes, dentalScreenRoutes, dentalImportRoutes]) r.route('/', make(d));
  return r;
}
