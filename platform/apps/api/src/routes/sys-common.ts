// Shared by the Hemlo Systems routes: who is acting, input checks, and the open cash drawer.
import type { Context } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@hemlo/db';
import { sysShift } from '@hemlo/db/schema';
import { roleCan, counterCan, type Resource } from '@hemlo/auth/permissions';
import { HttpError, requirePermission, type Principal } from '../principal';
import type { AppEnv } from '../types';

export const UNITS = ['piece', 'kg', 'g', 'l', 'box', 'pack'] as const;
export const WHOLE_UNITS = ['piece', 'box', 'pack'];
export const MAX_IQD = 2_000_000_000;

export type Actor = { organizationId: string; principal: Principal; userId: string | null; deviceId: string | null };
export function actor(c: Context<AppEnv>, resource: Resource, action: string): Actor {
  const { organizationId, principal } = requirePermission(c, resource, action);
  const userId = principal.kind === 'user' ? principal.userId : principal.kind === 'counter' ? principal.userId : null;
  return { organizationId, principal, userId, deviceId: principal.kind === 'counter' ? principal.deviceId : null };
}
/** May this principal do resource:action? (for optional powers such as custom prices) */
export function may(p: Principal, resource: Resource, action: string) {
  if (p.kind === 'user') return !!p.role && roleCan(p.role, resource, action);
  if (p.kind === 'counter') return !!p.role && counterCan(p.role, resource, action);
  return !!p.permissions?.[resource]?.includes(action);
}

export const bad = (code: string): never => { throw new HttpError(400, code); };
export const text = (v: unknown, max: number, code: string, required = false) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : bad(code);
  if (required && !s) bad(code);
  if ((s as string).length > max) bad(code);
  return (s as string) || null;
};
export const iqd = (v: unknown, code: string, { allowNull = false } = {}) => {
  if (v == null || v === '') return allowNull ? null : bad(code);
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_IQD) bad(code);
  return n;
};
export const quantity = (v: unknown, unit: string, code = 'BAD_QTY') => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) bad(code);
  if (WHOLE_UNITS.includes(unit) && !Number.isInteger(n)) bad(code);
  return Math.round(n * 1000) / 1000;
};
export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const dateParam = (v: string | undefined, fallback: Date) => { const d = v ? new Date(v) : fallback; return Number.isNaN(d.getTime()) ? bad('BAD_DATE') : d; };

/** Which till's drawer: a shop device has its own; people signed in on their own share the main till (null). */
export const tillOf = (a: Actor) => a.deviceId;
export const tillIs = (deviceId: string | null) => (deviceId ? eq(sysShift.deviceId, deviceId) : isNull(sysShift.deviceId));

/** This till's open cash drawer, if any (money in and out is attached to it). */
export async function openShiftId(tx: Database, deviceId: string | null) {
  const [s] = await tx.select({ id: sysShift.id }).from(sysShift).where(and(isNull(sysShift.closedAt), tillIs(deviceId))).limit(1);
  return s?.id ?? null;
}
