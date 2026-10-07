// Who is on the Hemlo team, and what they may do. The founder is user.role = 'admin'; everyone else is a hemlo_staff row.
import { eq } from 'drizzle-orm';
import { STAFF_PERMISSIONS, normalizePermissions, roleFor, type StaffPermission, type StaffRole } from '@hemlo/core';
import { hemloStaff } from '@hemlo/db/schema';
import type { Deps } from './types';

export type StaffState = 'active' | 'suspended' | 'expired';
export interface Staff {
  userId: string; founder: boolean; role: StaffRole; permissions: StaffPermission[];
  title: string | null; accessUntil: Date | null; state: StaffState;
}

export async function loadStaff(d: Deps, user: { id: string; role?: string | null }): Promise<Staff | null> {
  if (user.role === 'admin') return { userId: user.id, founder: true, role: 'founder', permissions: [...STAFF_PERMISSIONS], title: null, accessUntil: null, state: 'active' };
  const [row] = await d.db.select().from(hemloStaff).where(eq(hemloStaff.userId, user.id));
  return row ? fromRow(row) : null;
}

export function fromRow(row: typeof hemloStaff.$inferSelect): Staff {
  const permissions = normalizePermissions(row.permissions);
  const state: StaffState = row.suspendedAt ? 'suspended' : row.accessUntil && row.accessUntil < new Date() ? 'expired' : 'active';
  return { userId: row.userId, founder: false, role: roleFor(permissions), permissions, title: row.title, accessUntil: row.accessUntil, state };
}
