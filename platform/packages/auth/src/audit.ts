// Security log and known devices. Writes go through withSystem (auth_event has row-level security).
import { and, eq } from 'drizzle-orm';
import { newId, sha256 } from '@hemlo/core';
import { withSystem, type Database } from '@hemlo/db';
import { authEvent, knownDevice } from '@hemlo/db/schema';

export interface AuditEntry { kind: string; userId?: string | null; organizationId?: string | null; ip?: string | null; userAgent?: string | null; detail?: Record<string, unknown> }

export async function audit(db: Database, e: AuditEntry) {
  try {
    await withSystem(db, (tx) => tx.insert(authEvent).values({
      id: newId(), kind: e.kind, userId: e.userId ?? null, organizationId: e.organizationId ?? null,
      ip: e.ip ?? null, userAgent: e.userAgent?.slice(0, 300) ?? null, detail: e.detail ?? null,
    }));
  } catch (err) { console.error('[audit]', err); } // the log must never break a sign-in
}

/** Records the device; returns true when it's new for someone who has signed in before (→ send an alert). */
export async function rememberDevice(db: Database, userId: string, label: string): Promise<boolean> {
  const deviceHash = await sha256(label);
  const rows = await db.select().from(knownDevice).where(eq(knownDevice.userId, userId));
  const known = rows.find((r) => r.deviceHash === deviceHash);
  if (known) { await db.update(knownDevice).set({ lastSeen: new Date() }).where(and(eq(knownDevice.id, known.id))); return false; }
  await db.insert(knownDevice).values({ id: newId(), userId, deviceHash, label }).onConflictDoNothing();
  return rows.length > 0;
}
