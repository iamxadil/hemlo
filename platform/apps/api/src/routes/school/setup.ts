// Starting a school (self-serve, 30-day free trial) and its set-up: the school's details, academic years, grades and
// their classes. A new school opens ready to use: this year, its grades (by the kind of school), one section each.
import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { organization, member, hemloSubscription, sysSettings, schSettings, schYear, schGrade, schClass, SCH_KINDS, SCH_STAGES } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireUser, forgetPrincipal } from '../../principal';
import { actor, bad } from '../sys-common';
import { isDemoEmail } from '../demo';
import { TRIAL_DAYS, subscriptionOf } from '../../subscription';
import { inSch, schoolOf, currentYear, rowsOf, str, phone, oneOf, intIn, dateOnly, today, academicYear, presetGrades, firstSection } from './common';
import type { AppEnv, Deps } from '../../types';

export function schSetupRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Start a school: the business, a 30-day trial, the owner, this academic year, its grades and a first section each. */
  r.post('/start', async (c) => {
    const p = requireUser(c);
    if (isDemoEmail(p.user.email)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const name = str(b.name, 80, 'BAD_NAME', true)!;
    if (name.length < 2) bad('BAD_NAME');
    const city = str(b.city, 60, 'BAD_CITY');
    const kind = oneOf(b.kind, SCH_KINDS, 'BAD_KIND', 'school');
    const ph = phone(b.phone);
    const lang = b.lang === 'en' ? 'en' as const : 'ar' as const;
    const [used] = await withSystem(d.db, async (tx) => rowsOf(await tx.execute(sql`select 1 from hemlo_subscription s join member m on m.organization_id = s.organization_id
      where s.edition = 'school' and m.user_id = ${p.userId} and m.role like '%owner%' limit 1`)));
    if (used) throw new HttpError(409, 'TRIAL_USED');

    const orgId = newId(), now = new Date(), trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'school'}-${orgId.slice(0, 6).toLowerCase()}`;
    const ay = academicYear(today()), yearId = newId();
    const grades = presetGrades(kind, lang).map((g, i) => ({ id: newId(), organizationId: orgId, name: g.name, stage: g.stage, sort: i + 1 }));
    await withOrg(d.db, orgId, async (tx) => {
      await tx.insert(organization).values({ id: orgId, name, slug, createdAt: now, metadata: JSON.stringify({ kind: 'school', city }) });
      await tx.insert(member).values({ id: newId(), organizationId: orgId, userId: p.userId, role: 'owner', createdAt: now } as any);
      await tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'school', status: 'trial', seats: 1, trialEndsAt });
      await tx.insert(sysSettings).values({ organizationId: orgId });
      await tx.insert(schYear).values({ id: yearId, organizationId: orgId, name: ay.name, startsOn: ay.startsOn, endsOn: ay.endsOn });
      await tx.insert(schSettings).values({ organizationId: orgId, kind, city, phone: ph, whatsapp: ph, currentYearId: yearId });
      await tx.insert(schGrade).values(grades);
      await tx.insert(schClass).values(grades.map((g) => ({ id: newId(), organizationId: orgId, yearId, gradeId: g.id, name: firstSection(lang) })));
    });
    forgetPrincipal(c);
    await audit(d.db, { kind: 'sch.trial_started', userId: p.userId, organizationId: orgId, detail: { name, city, kind } });
    return c.json({ organizationId: orgId, trialEndsAt }, 201);
  });

  /** What every screen shares: the school, its year, grades and classes (with how many students), the staff, fee plans. */
  r.get('/setup', async (c) => {
    const a = actor(c, 'students', 'read');
    const out = await inSch(d, a, async (tx) => {
      const school = await schoolOf(tx, a.organizationId);
      const yearId = school.year?.id ?? '';
      const [grades, classes, staff, plans, years] = await Promise.all([
        tx.execute(sql`select id, name, stage, sort, active from sch_grade where organization_id = ${a.organizationId} order by sort, name`),
        tx.execute(sql`select c.id, c.name, c.grade_id as "gradeId", c.teacher_member_id as "teacherMemberId", c.room, c.capacity,
            (select count(*)::int from sch_enrollment e join sch_student s on s.id = e.student_id
              where e.organization_id = ${a.organizationId} and e.class_id = c.id and e.status = 'enrolled' and s.status = 'active') as students
          from sch_class c join sch_grade g on g.id = c.grade_id where c.organization_id = ${a.organizationId} and c.year_id = ${yearId} order by g.sort, c.name`),
        tx.execute(sql`select m.id, m.role, u.name from member m join "user" u on u.id = m.user_id where m.organization_id = ${a.organizationId} order by u.name`),
        tx.execute(sql`select id, name, grade_id as "gradeId", installments, total, active from sch_fee_plan where organization_id = ${a.organizationId} and year_id = ${yearId} order by created_at`),
        tx.execute(sql`select id, name, starts_on as "startsOn", ends_on as "endsOn" from sch_year where organization_id = ${a.organizationId} order by starts_on desc`),
      ]);
      return { school, grades: rowsOf(grades), classes: rowsOf(classes), staff: rowsOf(staff), plans: rowsOf(plans), years: rowsOf(years) };
    });
    return c.json({ ...out, subscription: await subscriptionOf(d.db, a.organizationId) });
  });

  r.put('/settings', async (c) => {
    const a = actor(c, 'school', 'configure');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.kind !== undefined) set.kind = oneOf(b.kind, SCH_KINDS, 'BAD_KIND');
    if (b.city !== undefined) set.city = str(b.city, 60, 'BAD_CITY');
    if (b.phone !== undefined) set.phone = phone(b.phone);
    if (b.whatsapp !== undefined) set.whatsapp = phone(b.whatsapp);
    if (b.passMark !== undefined) set.passMark = intIn(b.passMark, 1, 100, 'BAD_PASS_MARK');
    for (const k of ['absentText', 'feeText'] as const) if (b[k] !== undefined) {
      const v = b[k] as Record<string, unknown> | null;
      set[k] = v ? { ar: str(v.ar, 500, 'BAD_TEXT') ?? undefined, en: str(v.en, 500, 'BAD_TEXT') ?? undefined } : null;
    }
    await inSch(d, a, (tx) => tx.update(schSettings).set(set).where(eq(schSettings.organizationId, a.organizationId)));
    return c.json({ ok: true });
  });

  // ---------- grades ----------
  r.post('/grades', async (c) => {
    const a = actor(c, 'school', 'configure');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const name = str(b.name, 60, 'BAD_NAME', true)!, stage = oneOf(b.stage, SCH_STAGES, 'BAD_STAGE', 'primary');
    const lang = b.lang === 'en' ? 'en' as const : 'ar' as const;
    const out = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      const [{ next }] = rowsOf(await tx.execute(sql`select coalesce(max(sort), 0) + 1 as next from sch_grade where organization_id = ${a.organizationId}`));
      const id = newId();
      await tx.insert(schGrade).values({ id, organizationId: a.organizationId, name, stage, sort: Number(next) });
      // a grade with no class can't take a student: it starts with its first section
      await tx.insert(schClass).values({ id: newId(), organizationId: a.organizationId, yearId: year.id, gradeId: id, name: firstSection(lang) });
      return id;
    });
    return c.json({ id: out }, 201);
  });
  r.patch('/grades/:id', async (c) => {
    const a = actor(c, 'school', 'configure');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const set: Record<string, unknown> = {};
    if (b.name !== undefined) set.name = str(b.name, 60, 'BAD_NAME', true);
    if (b.stage !== undefined) set.stage = oneOf(b.stage, SCH_STAGES, 'BAD_STAGE');
    if (b.sort !== undefined) set.sort = intIn(b.sort, 0, 999, 'BAD_SORT');
    if (b.active !== undefined) set.active = !!b.active;
    if (!Object.keys(set).length) bad('NOTHING');
    const [row] = await inSch(d, a, (tx) => tx.update(schGrade).set(set).where(eq(schGrade.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ grade: row });
  });

  // ---------- classes (a grade's sections, in the current year) ----------
  const classFields = async (tx: any, org: string, b: Record<string, unknown>, partial: boolean) => {
    const set: Record<string, unknown> = {};
    if (!partial || b.name !== undefined) set.name = str(b.name, 40, 'BAD_NAME', true);
    if (b.room !== undefined) set.room = str(b.room, 40, 'BAD_ROOM');
    if (b.capacity !== undefined) set.capacity = intIn(b.capacity, 1, 200, 'BAD_CAPACITY');
    if (b.teacherMemberId !== undefined) {
      if (b.teacherMemberId === null || b.teacherMemberId === '') set.teacherMemberId = null;
      else {
        const [m] = rowsOf(await tx.execute(sql`select id from member where id = ${String(b.teacherMemberId)} and organization_id = ${org}`));
        if (!m) bad('BAD_TEACHER');
        set.teacherMemberId = m.id;
      }
    }
    return set;
  };
  r.post('/classes', async (c) => {
    const a = actor(c, 'school', 'configure');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const id = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      const [g] = await tx.select().from(schGrade).where(eq(schGrade.id, String(b.gradeId ?? '')));
      if (!g) bad('BAD_GRADE');
      const id = newId();
      await tx.insert(schClass).values({ id, organizationId: a.organizationId, yearId: year.id, gradeId: g.id, ...(await classFields(tx, a.organizationId, b, false)) } as any);
      return id;
    });
    return c.json({ id }, 201);
  });
  r.patch('/classes/:id', async (c) => {
    const a = actor(c, 'school', 'configure');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const row = await inSch(d, a, async (tx) => {
      const set = await classFields(tx, a.organizationId, b, true);
      if (!Object.keys(set).length) bad('NOTHING');
      const [row] = await tx.update(schClass).set(set).where(eq(schClass.id, c.req.param('id'))).returning();
      return row;
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ class: row });
  });
  r.delete('/classes/:id', async (c) => {
    const a = actor(c, 'school', 'configure');
    await inSch(d, a, async (tx) => {
      const [busy] = rowsOf(await tx.execute(sql`select 1 from sch_enrollment where organization_id = ${a.organizationId} and class_id = ${c.req.param('id')} limit 1`));
      if (busy) throw new HttpError(409, 'CLASS_HAS_STUDENTS');
      await tx.delete(schClass).where(eq(schClass.id, c.req.param('id')));
    });
    return c.json({ ok: true });
  });

  // ---------- academic years ----------
  /** A new year: its classes copied from the current one (same grades and sections, teachers kept), made current. */
  r.post('/years', async (c) => {
    const a = actor(c, 'school', 'configure');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const startsOn = dateOnly(b.startsOn) ?? bad('BAD_DATE'), endsOn = dateOnly(b.endsOn) ?? bad('BAD_DATE');
    if (endsOn <= startsOn) bad('BAD_DATE');
    const name = str(b.name, 30, 'BAD_NAME') ?? `${startsOn.slice(0, 4)}–${endsOn.slice(0, 4)}`;
    const id = await inSch(d, a, async (tx) => {
      const school = await schoolOf(tx, a.organizationId);
      const id = newId();
      await tx.insert(schYear).values({ id, organizationId: a.organizationId, name, startsOn, endsOn });
      if (school.year && b.copyClasses !== false) await tx.execute(sql`insert into sch_class (id, organization_id, year_id, grade_id, name, teacher_member_id, room, capacity)
        select md5(random()::text || id), organization_id, ${id}, grade_id, name, teacher_member_id, room, capacity from sch_class where organization_id = ${a.organizationId} and year_id = ${school.year.id}`);
      if (b.makeCurrent !== false) await tx.update(schSettings).set({ currentYearId: id, updatedAt: new Date() }).where(eq(schSettings.organizationId, a.organizationId));
      return id;
    });
    await audit(d.db, { kind: 'sch.year_added', userId: a.userId, organizationId: a.organizationId, detail: { name } });
    return c.json({ id }, 201);
  });
  r.post('/years/:id/current', async (c) => {
    const a = actor(c, 'school', 'configure');
    await inSch(d, a, async (tx) => {
      const [y] = await tx.select().from(schYear).where(and(eq(schYear.id, c.req.param('id')), eq(schYear.organizationId, a.organizationId)));
      if (!y) throw new HttpError(404, 'NOT_FOUND');
      await tx.update(schSettings).set({ currentYearId: y.id, updatedAt: new Date() }).where(eq(schSettings.organizationId, a.organizationId));
    });
    return c.json({ ok: true });
  });

  return r;
}
