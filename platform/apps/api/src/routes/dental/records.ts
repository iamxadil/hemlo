// The rest of the clinical file: the gum chart, X-rays and photos (shown through links that last an hour), and signed
// consents (the exact text signed, the signature, kept forever).
import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { dentPerio, dentImage, dentConsent, sysFile } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, text } from '../sys-common';
import { claimFiles } from '../files';
import { fileUrl } from '../../files';
import { inClinic, patientOf, logAccess, tooth, instant, myDentist, PERMANENT, PRIMARY } from './common';
import type { AppEnv, Deps } from '../../types';

const IMAGE_KINDS = ['periapical', 'bitewing', 'panoramic', 'cephalometric', 'cbct', 'photo', 'document'] as const;
const TEETH = new Set([...PERMANENT, ...PRIMARY].map(String));

/** One tooth's gum readings: 6 pocket depths (0–15 mm), 6 bleeding points, mobility 0–3, furcation 0–3. */
function perioData(v: unknown) {
  if (!v || typeof v !== 'object') bad('BAD_PERIO');
  const out: Record<string, any> = {};
  for (const [k, x] of Object.entries(v as Record<string, any>)) {
    if (!TEETH.has(k) || !x || typeof x !== 'object') bad('BAD_PERIO');
    const t: any = {};
    if (x.missing) t.missing = true;
    if (x.pd != null) { if (!Array.isArray(x.pd) || x.pd.length !== 6 || x.pd.some((n: any) => n != null && !(Number.isInteger(n) && n >= 0 && n <= 15))) bad('BAD_PERIO'); t.pd = x.pd; }
    if (x.bop != null) { if (!Array.isArray(x.bop) || x.bop.length !== 6) bad('BAD_PERIO'); t.bop = x.bop.map(Boolean); }
    if (x.mob != null) t.mob = [0, 1, 2, 3].includes(x.mob) ? x.mob : bad('BAD_PERIO');
    if (x.furc != null) t.furc = [0, 1, 2, 3].includes(x.furc) ? x.furc : bad('BAD_PERIO');
    out[k] = t;
  }
  return out;
}

export function dentalRecordRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  // ---- the gum chart ----
  r.get('/patients/:id/perio', async (c) => {
    const a = actor(c, 'clinical', 'read');
    const rows = await inClinic(d, a, (tx) => tx.select().from(dentPerio).where(eq(dentPerio.patientId, c.req.param('id'))).orderBy(desc(dentPerio.at)).limit(50));
    return c.json({ charts: rows });
  });
  r.post('/perio', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const data = perioData(b.data);
    const [row] = await inClinic(d, a, async (tx) => {
      await patientOf(tx, String(b.patientId ?? ''));
      const me = await myDentist(tx, a);
      return tx.insert(dentPerio).values({ id: newId(), organizationId: a.organizationId, patientId: b.patientId, dentistId: b.dentistId || me?.id || null, data, note: text(b.note, 1000, 'BAD_TEXT'), createdBy: a.userId }).returning();
    });
    return c.json({ chart: row }, 201);
  });

  // ---- X-rays and photos ----
  /** Every X-ray, photo and document on the file (including ones uploaded but not yet described). */
  r.get('/patients/:id/images', async (c) => {
    const a = actor(c, 'clinical', 'read');
    const id = c.req.param('id');
    const out = await inClinic(d, a, async (tx) => {
      await patientOf(tx, id);
      await logAccess(tx, a, id, 'images');
      const rows = await tx.select({ f: sysFile, m: dentImage }).from(sysFile).leftJoin(dentImage, eq(dentImage.fileId, sysFile.id))
        .where(and(eq(sysFile.refId, id), eq(sysFile.purpose, 'clinical'))).orderBy(desc(sysFile.createdAt)).limit(500);
      return Promise.all(rows.map(async (x) => ({ id: x.f.id, url: await fileUrl(d.env, a.organizationId, x.f.id, 3600), width: x.f.width, height: x.f.height,
        kind: x.m?.kind ?? 'photo', teeth: x.m?.teeth ?? [], visitId: x.m?.visitId ?? null, takenAt: x.m?.takenAt ?? x.f.createdAt, note: x.m?.note ?? null })));
    });
    return c.json({ images: out });
  });

  /** Describe an uploaded X-ray or photo: what kind, which teeth, which visit. */
  r.put('/images/:fileId', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const kind = IMAGE_KINDS.includes(b.kind) ? b.kind : bad('BAD_KIND');
    const teeth = (Array.isArray(b.teeth) ? b.teeth : []).map((t: unknown) => tooth(t, true)) as number[];
    const row = await inClinic(d, a, async (tx) => {
      const [f] = await tx.select().from(sysFile).where(and(eq(sysFile.id, c.req.param('fileId')), eq(sysFile.purpose, 'clinical')));
      if (!f) throw new HttpError(404, 'NOT_FOUND');
      const v = { kind, teeth, visitId: b.visitId || null, note: text(b.note, 300, 'BAD_TEXT'), takenAt: b.takenAt ? instant(b.takenAt) : f.createdAt };
      const [x] = await tx.insert(dentImage).values({ fileId: f.id, organizationId: a.organizationId, patientId: f.refId!, createdBy: a.userId, ...v })
        .onConflictDoUpdate({ target: dentImage.fileId, set: v }).returning();
      return x;
    });
    return c.json({ image: row });
  });

  // ---- consents ----
  r.get('/patients/:id/consents', async (c) => {
    const a = actor(c, 'patients', 'read');
    const rows = await inClinic(d, a, (tx) => tx.select().from(dentConsent).where(eq(dentConsent.patientId, c.req.param('id'))).orderBy(desc(dentConsent.signedAt)));
    return c.json({ consents: await Promise.all(rows.map(async (x) => ({ ...x, signatureUrl: await fileUrl(d.env, a.organizationId, x.signatureFileId, 3600) }))) });
  });
  /** Signed on the clinic's tablet: the text exactly as shown, the name, and the drawn signature (uploaded first). */
  r.post('/consents', async (c) => {
    const a = actor(c, 'patients', 'update');
    const b = await c.req.json<any>();
    const [row] = await inClinic(d, a, async (tx) => {
      await patientOf(tx, String(b.patientId ?? ''));
      if (b.signatureFileId) await claimFiles(tx, [b.signatureFileId], 'consent', b.patientId);
      return tx.insert(dentConsent).values({ id: newId(), organizationId: a.organizationId, patientId: b.patientId, kind: text(b.kind, 40, 'BAD_KIND', true)!,
        text: text(b.text, 8000, 'BAD_TEXT', true)!, signedName: text(b.signedName, 100, 'BAD_NAME', true)!, signatureFileId: b.signatureFileId || null, createdBy: a.userId }).returning();
    });
    return c.json({ consent: row }, 201);
  });

  return r;
}
