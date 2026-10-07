// Images: upload (a logo, a product photo, a photo of an invoice or receipt), remove, set the shop logo, and show them.
import { Hono } from 'hono';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { sysFile, sysProduct, sysSettings, sysPurchase, sysExpense, dentPatient, dentImage, gymMember } from '@hemlo/db/schema';
import type { Resource } from '@hemlo/auth/permissions';
import { HttpError } from '../principal';
import { actor, bad, type Actor } from './sys-common';
import { isDemoOrg } from './demo';
import { PURPOSES, MAX_BYTES, MAX_ATTACHMENTS, SHORT_LIVED, fileKey, fileUrl, sniffImage, checkFileLink, type Purpose, type FileStore } from '../files';
import type { AppEnv, Deps } from '../types';

const PERM: Record<Purpose, [Resource, string]> = {
  logo: ['settings', 'update'], product: ['products', 'manage'], purchase: ['purchases', 'create'], expense: ['expenses', 'create'],
  clinical: ['clinical', 'write'], consent: ['patients', 'update'], member: ['members', 'update'],
};
const QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB of images per shop, far more than a shop needs
const DEMO_FILES = 30;
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

export type PublicFile = { id: string; url: string | null; width: number | null; height: number | null };
export async function publicFile(d: Deps, f: typeof sysFile.$inferSelect): Promise<PublicFile> {
  return { id: f.id, url: await fileUrl(d.env, f.organizationId, f.id, SHORT_LIVED.includes(f.purpose as Purpose) ? 3600 : undefined), width: f.width, height: f.height };
}
const storeOf = (d: Deps) => d.files ?? (() => { throw new HttpError(503, 'UPLOADS_UNAVAILABLE'); })();

/** Take uploaded files for a record: they must be this shop's, of this purpose, and not already someone else's. */
export async function claimFiles(tx: Database, ids: unknown, purpose: Purpose, refId: string) {
  if (ids == null) return [];
  if (!Array.isArray(ids) || ids.length > MAX_ATTACHMENTS || ids.some((x) => typeof x !== 'string')) bad('BAD_FILE');
  const list = [...new Set(ids as string[])];
  if (!list.length) return [];
  const rows = await tx.select().from(sysFile).where(and(inArray(sysFile.id, list), eq(sysFile.purpose, purpose)));
  if (rows.length !== list.length || rows.some((f) => f.refId && f.refId !== refId)) bad('BAD_FILE');
  await tx.update(sysFile).set({ refId }).where(inArray(sysFile.id, list));
  return rows;
}

/** Delete file rows (inside the caller's transaction) and, after, their bytes. */
export async function dropFiles(d: Deps, tx: Database, where: ReturnType<typeof and>) {
  const gone = await tx.delete(sysFile).where(where).returning({ id: sysFile.id, org: sysFile.organizationId });
  if (gone.length && d.files) await d.files.delete(gone.map((f) => fileKey(f.org, f.id))).catch((e) => console.error('[files] delete', e));
  return gone.length;
}

/** Photos attached to these purchases or expenses, by record. */
export async function attachmentsOf(d: Deps, tx: Database, refIds: string[]) {
  const out: Record<string, PublicFile[]> = {};
  if (!refIds.length) return out;
  const rows = await tx.select().from(sysFile).where(inArray(sysFile.refId, refIds)).orderBy(sysFile.createdAt);
  for (const f of rows) (out[f.refId!] ??= []).push(await publicFile(d, f));
  return out;
}

/** The shop's logo link (null when it has none). */
export async function logoUrl(d: Deps, tx: Database, org: string) {
  const [s] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, org));
  return fileUrl(d.env, org, s?.logoId);
}

export function sysFileRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const inOrg = <T>(a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);

  /** Upload one image. The body is the image itself (the app shrinks it first). ?purpose=…&ref=… (&w=…&h=…) */
  r.post('/', async (c) => {
    const purpose = c.req.query('purpose') as Purpose;
    if (!PURPOSES.includes(purpose)) bad('BAD_PURPOSE');
    const a = actor(c, ...PERM[purpose]);
    const store = storeOf(d);
    if (Number(c.req.header('content-length') ?? 0) > MAX_BYTES) throw new HttpError(413, 'FILE_TOO_BIG');
    const body = await c.req.arrayBuffer();
    if (!body.byteLength) bad('EMPTY_FILE');
    if (body.byteLength > MAX_BYTES) throw new HttpError(413, 'FILE_TOO_BIG');
    const mime = sniffImage(body) ?? bad('NOT_AN_IMAGE');
    const dim = (v: string | undefined) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 20000 ? n : null; };
    const ref = c.req.query('ref') || null;
    const demo = await isDemoOrg(d, a.organizationId);

    const id = newId();
    const row = await inOrg(a, async (tx) => {
      const [use] = rowsOf(await tx.execute(sql`select count(*)::int as n, coalesce(sum(bytes), 0)::bigint as bytes from sys_file`));
      if (demo && use.n >= DEMO_FILES) throw new HttpError(409, 'DEMO_FILES_FULL');
      if (Number(use.bytes) + body.byteLength > QUOTA_BYTES) throw new HttpError(409, 'STORAGE_FULL');
      if (purpose === 'clinical' || purpose === 'consent') { // a patient's X-ray, photo or signature: always on a patient
        if (!ref) bad('BAD_REF');
        const [p] = await tx.select({ id: dentPatient.customerId }).from(dentPatient).where(eq(dentPatient.customerId, ref!));
        if (!p) throw new HttpError(404, 'PATIENT_NOT_FOUND');
      } else if (ref) { // attaching straight to an existing purchase or expense
        if (purpose !== 'purchase' && purpose !== 'expense') bad('BAD_REF');
        const table = purpose === 'purchase' ? sysPurchase : sysExpense;
        const [exists] = await tx.select({ id: table.id }).from(table).where(eq(table.id, ref));
        if (!exists) throw new HttpError(404, 'NOT_FOUND');
        const [n] = rowsOf(await tx.execute(sql`select count(*)::int as n from sys_file where ref_id = ${ref}`));
        if (n.n >= MAX_ATTACHMENTS) throw new HttpError(409, 'TOO_MANY_FILES');
      }
      await store.put(fileKey(a.organizationId, id), body, mime);
      const [f] = await tx.insert(sysFile).values({ id, organizationId: a.organizationId, purpose, refId: ref, mime, bytes: body.byteLength,
        width: dim(c.req.query('w')), height: dim(c.req.query('h')), createdBy: a.userId }).returning();
      return f;
    });
    return c.json({ file: await publicFile(d, row) }, 201);
  });

  /** Remove an image (and wherever it's used: a product photo, the logo, an attachment). */
  r.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await withOrg(d.db, actorOrg(c), (tx) => tx.select().from(sysFile).where(eq(sysFile.id, id)));
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    const a = actor(c, ...PERM[row.purpose as Purpose]);
    await inOrg(a, async (tx) => {
      if (row.purpose === 'product') await tx.update(sysProduct).set({ imageId: null, updatedAt: new Date() }).where(eq(sysProduct.imageId, id));
      if (row.purpose === 'member') await tx.update(gymMember).set({ photoId: null, updatedAt: new Date() }).where(eq(gymMember.photoId, id));
      if (row.purpose === 'logo') await tx.update(sysSettings).set({ logoId: null, updatedAt: new Date() }).where(eq(sysSettings.logoId, id));
      if (row.purpose === 'consent') throw new HttpError(409, 'CONSENT_IS_KEPT'); // a signed consent is a record: never deleted
      if (row.purpose === 'clinical') await tx.delete(dentImage).where(eq(dentImage.fileId, id));
      await dropFiles(d, tx, and(eq(sysFile.id, id)));
    });
    return c.json({ ok: true });
  });

  /** Set (or clear, with null) the shop's logo. The previous logo is deleted. */
  r.put('/logo', async (c) => {
    const a = actor(c, 'settings', 'update');
    const b = await c.req.json<{ fileId?: string | null }>();
    const fileId = b.fileId ?? null;
    const url = await inOrg(a, async (tx) => {
      if (fileId) await claimFiles(tx, [fileId], 'logo', a.organizationId);
      const [cur] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, a.organizationId));
      await tx.insert(sysSettings).values({ organizationId: a.organizationId, logoId: fileId })
        .onConflictDoUpdate({ target: sysSettings.organizationId, set: { logoId: fileId, updatedAt: new Date() } });
      if (cur?.logoId && cur.logoId !== fileId) await dropFiles(d, tx, and(eq(sysFile.id, cur.logoId)));
      return fileUrl(d.env, a.organizationId, fileId);
    });
    return c.json({ logoUrl: url });
  });

  return r;
}
/** Any signed-in member of the shop (the right permission is checked once the file's purpose is known). */
const actorOrg = (c: any) => actor(c, 'stock', 'read').organizationId;

/** Showing an image: a signed link, no sign-in, no database. Cached by the browser for the life of the link. */
export function publicFileRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.get('/:org/:id', async (c) => {
    const { org, id } = c.req.param();
    if (!(await checkFileLink(d.env.AUTH_SECRET, org, id, c.req.query('e'), c.req.query('s')))) return c.json({ error: 'NOT_FOUND' }, 404);
    const f = d.files ? await d.files.get(fileKey(org, id)) : null;
    if (!f) return c.json({ error: 'NOT_FOUND' }, 404);
    const maxAge = Math.max(60, Number(c.req.query('e')) - Math.floor(Date.now() / 1000));
    return new Response(f.body as any, { headers: {
      'content-type': f.contentType, 'content-length': String(f.size), 'cache-control': `private, max-age=${maxAge}, immutable`,
      'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin', 'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'", 'content-disposition': 'inline',
    } });
  });
  return r;
}

/** Clean-up (the 6-hourly cron): photos uploaded but never attached, and logos never set, after a day. */
export async function purgeOrphanFiles(db: Database, files: FileStore | undefined) {
  const gone = await withSystem(db, async (tx) => rowsOf(await tx.execute(sql`
    delete from sys_file where created_at < now() - interval '1 day' and (
      (purpose in ('product', 'purchase', 'expense', 'member') and ref_id is null)
      or (purpose = 'logo' and id not in (select logo_id from sys_settings where logo_id is not null)))
    returning id, organization_id`)));
  if (gone.length && files) await files.delete(gone.map((f) => fileKey(f.organization_id, f.id)));
  return gone.length;
}

