// Contracts: a sale, a rent, a deposit (عربون) receipt, or the owner's brokerage agreement, drawn up in a minute from
// what the agency already knows (the deal, the property, the owner, the buyer), finished by hand, printed and signed.
// The words are kept on the contract itself, so a signed one never changes. The terms are a starting point the agency
// can make its own; Hemlo tells them to have a lawyer read their template once (it is not legal advice).
import { Hono } from 'hono';
import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { reContract, reDeal, reProperty, reOwner, reSettings, reDocument, organization, sysSettings, sysSequence, RE_CONTRACT_KINDS, type ReContractData, type ReParty } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, may, type Actor } from '../sys-common';
import { fileUrl } from '../../files';
import { inRe, str, amount, oneOf, dateOnly, activity, settingsOf, leadOf, memberOf, today, typeName, like } from './common';
import { commissionOf } from './work';
import type { AppEnv, Deps } from '../../types';

type L = 'ar' | 'en';
type Kind = (typeof RE_CONTRACT_KINDS)[number];

/** Hemlo's starting terms, per kind and language: what Iraqi agencies usually write. An agency saves its own. */
export const DEFAULT_TERMS: Record<Kind, Record<L, string[]>> = {
  sale: {
    ar: [
      'باع الطرف الأول إلى الطرف الثاني العقار الموصوف في هذا العقد بالثمن المذكور فيه، وقبل الطرف الثاني الشراء بعد أن عاين العقار معاينة نافية للجهالة.',
      'يقرّ الطرف الأول بأن العقار مملوك له ملكية صحيحة، وأنه خالٍ من أي رهن أو حجز أو دعوى أو حق للغير، ويتحمّل وحده مسؤولية خلاف ذلك.',
      'يلتزم الطرفان بالحضور إلى دائرة التسجيل العقاري المختصة لإتمام نقل الملكية خلال (30) يوماً من تاريخ هذا العقد، ما لم يتّفقا كتابةً على غير ذلك.',
      'يتحمّل الطرف الثاني رسوم التسجيل ونقل الملكية، ويتحمّل الطرف الأول ما على العقار من ضرائب ورسوم وفواتير حتى تاريخ التسليم.',
      'يسلّم الطرف الأول العقار إلى الطرف الثاني خالياً من الشواغل عند استلامه كامل الثمن.',
      'إذا نكل الطرف الثاني عن الشراء خسر المبلغ المدفوع عربوناً، وإذا نكل الطرف الأول عن البيع أعاد العربون ومثله إلى الطرف الثاني.',
      'حُرّر هذا العقد من نسختين، بيد كل طرف نسخة للعمل بموجبها.',
    ],
    en: [
      'The First Party sells to the Second Party the property described in this contract at the price stated in it, and the Second Party accepts, having inspected the property.',
      'The First Party declares that they are the lawful owner of the property and that it is free of any mortgage, attachment, claim or third-party right, and bears sole responsibility otherwise.',
      'Both parties shall attend the competent Real Estate Registration Department to complete the transfer of ownership within (30) days of this contract, unless they agree otherwise in writing.',
      'The Second Party bears the registration and transfer fees; the First Party bears any taxes, fees and bills on the property up to the handover date.',
      'The First Party shall hand the property over vacant on receiving the full price.',
      'If the Second Party withdraws from the purchase, they forfeit the deposit paid; if the First Party withdraws from the sale, they shall return the deposit and an equal amount to the Second Party.',
      'This contract is made in two copies, one for each party.',
    ],
  },
  rent: {
    ar: [
      'أجّر الطرف الأول إلى الطرف الثاني العقار الموصوف في هذا العقد للمدة وبالأجرة المذكورتين فيه، ويستعمله الطرف الثاني للسكن فقط ما لم يُذكر غير ذلك.',
      'تُدفع الأجرة مقدّماً في بداية كل مدة دفع، وإذا تأخر الطرف الثاني عن الدفع أكثر من (15) يوماً حقّ للطرف الأول طلب إنهاء العقد وإخلاء المأجور وفق القانون.',
      'لا يجوز للطرف الثاني تأجير المأجور أو جزء منه إلى الغير، أو تغيير استعماله، أو إجراء أي تغيير فيه، إلا بموافقة تحريرية من الطرف الأول.',
      'يتحمّل الطرف الثاني أجور الكهرباء والماء والمولدة والخدمات طوال مدة الإيجار.',
      'يحافظ الطرف الثاني على المأجور ويعيده عند انتهاء المدة بالحالة التي استلمه بها، إلا ما نتج عن الاستعمال المعتاد.',
      'يُعاد مبلغ التأمين إلى الطرف الثاني عند إخلاء المأجور وتسليمه وتسديد ما بذمّته، بعد خصم كلفة إصلاح ما قد يكون أصابه من ضرر.',
      'يُجدَّد العقد باتفاق الطرفين، على أن يُبلغ من لا يرغب في التجديد الطرفَ الآخر قبل (30) يوماً من انتهاء المدة.',
      'حُرّر هذا العقد من نسختين، بيد كل طرف نسخة للعمل بموجبها.',
    ],
    en: [
      'The First Party lets to the Second Party the property described in this contract for the term and rent stated in it, to be used as a residence only unless stated otherwise.',
      'Rent is paid in advance at the start of each payment period. If the Second Party is more than (15) days late, the First Party may end the contract and seek vacant possession under the law.',
      'The Second Party may not sublet the property or any part of it, change its use, or alter it, without the First Party’s written consent.',
      'The Second Party pays electricity, water, generator and service charges for the whole term.',
      'The Second Party shall look after the property and return it at the end of the term in the condition received, fair wear and tear excepted.',
      'The security deposit is returned to the Second Party on vacating and handing over the property and settling what they owe, less the cost of repairing any damage.',
      'The contract may be renewed by agreement; a party not wishing to renew shall tell the other (30) days before the term ends.',
      'This contract is made in two copies, one for each party.',
    ],
  },
  deposit: {
    ar: [
      'استلم الطرف الأول من الطرف الثاني المبلغ المذكور في هذا الوصل عربوناً عن العقار الموصوف فيه، ويُخصم من الثمن الكلي عند إبرام العقد.',
      'يُحجز العقار للطرف الثاني ولا يُعرض على غيره حتى التاريخ المذكور، ويلتزم الطرفان بإبرام العقد ودفع الباقي قبله.',
      'إذا عدل الطرف الثاني عن الشراء خسر العربون، وإذا عدل الطرف الأول عن البيع أعاد العربون ومثله إلى الطرف الثاني.',
      'حُرّر هذا الوصل من نسختين، بيد كل طرف نسخة.',
    ],
    en: [
      'The First Party has received from the Second Party the amount stated in this receipt as a deposit for the property described in it, to be deducted from the full price when the contract is made.',
      'The property is held for the Second Party and not offered to anyone else until the stated date; both parties shall make the contract and settle the balance before it.',
      'If the Second Party withdraws, they forfeit the deposit; if the First Party withdraws, they shall return the deposit and an equal amount to the Second Party.',
      'This receipt is made in two copies, one for each party.',
    ],
  },
  brokerage: {
    ar: [
      'يفوّض الطرف الأول (المالك) الطرف الثاني (المكتب) بعرض العقار الموصوف في هذا الاتفاق وتسويقه والإعلان عنه ونشر صوره، وترتيب معاينته مع الزبائن.',
      'يسري هذا التفويض حتى التاريخ المذكور فيه، ويمكن تجديده باتفاق الطرفين.',
      'يستحق المكتب العمولة المتفق عليها عند إتمام البيع أو الإيجار لأي زبون قدّمه المكتب، ولو تمّ ذلك خلال (90) يوماً بعد انتهاء التفويض.',
      'يلتزم المالك بإبلاغ المكتب بأي تغيير في السعر أو في حالة العقار أو في رغبته في البيع.',
      'لا يحق للمكتب استلام أي مبلغ نيابة عن المالك، أو الالتزام باسمه، إلا بموافقة تحريرية منه.',
      'حُرّر هذا الاتفاق من نسختين، بيد كل طرف نسخة.',
    ],
    en: [
      'The First Party (the owner) authorises the Second Party (the agency) to offer, market and advertise the property described in this agreement, publish its photos, and arrange viewings with customers.',
      'This authorisation runs until the stated date and may be renewed by agreement.',
      'The agency earns the agreed commission when the property is sold or let to any customer it introduced, including within (90) days after this authorisation ends.',
      'The owner shall tell the agency of any change in the price, in the property’s condition, or in their wish to sell.',
      'The agency may not receive any money on the owner’s behalf, or commit them to anything, without their written consent.',
      'This agreement is made in two copies, one for each party.',
    ],
  },
};

const plusDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400_000).toISOString().slice(0, 10);
const plusYear = (iso: string) => { const d = new Date(iso); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/** Everything a contract can be filled from. */
export type ContractSource = {
  kind: Kind; lang: L; agencyName: string; settings: { phone: string | null; address: string | null; city: string | null; contractTerms?: Record<string, { ar?: string[]; en?: string[] }> | null; defaultCommission: number };
  property: { ref: number; title: string; titleEn: string | null; type: string; purpose: string; price: number | null; currency: string; rentPeriod: string | null; address: string | null; area: string | null; city: string | null;
    size: number | null; land: number | null; bedrooms: number | null; bathrooms: number | null } | null;
  owner: { name: string; phone: string | null; commission: { kind: 'percent' | 'fixed'; value: number } | null } | null;
  lead: { name: string; phone: string | null } | null;
  deal: { purpose: string; asking: number | null; agreed: number | null; currency: string; commissionKind: string; commissionValue: number; agentShare: number } | null;
  agentName: string | null; day?: string;
};

/** A new contract, filled in from what the agency knows: the rest is typed in the editor. */
export function contractDraft(x: ContractSource): ReContractData {
  const { kind, lang, property: p, owner, lead, deal } = x;
  const day = x.day ?? today();
  const purpose = (deal?.purpose ?? p?.purpose) === 'rent' ? 'rent' : 'sale';
  const priceNow = deal ? (deal.agreed ?? deal.asking) : p?.price ?? null;
  const currency = (deal?.currency ?? p?.currency ?? 'USD') === 'IQD' ? 'IQD' : 'USD';
  const rooms = [p?.bedrooms && (lang === 'ar' ? `${p.bedrooms} غرف نوم` : `${p.bedrooms} bedrooms`), p?.bathrooms && (lang === 'ar' ? `${p.bathrooms} حمّامات` : `${p.bathrooms} bathrooms`)].filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
  const agency = { name: x.agencyName, phone: x.settings.phone, address: x.settings.address, agent: x.agentName };
  const ownerParty: ReParty = { name: owner?.name ?? '', phone: owner?.phone ?? null, idNo: null, address: null };
  const leadParty: ReParty = { name: lead?.name ?? '', phone: lead?.phone ?? null, idNo: null, address: null };
  const agencyParty: ReParty = { name: x.agencyName, phone: x.settings.phone, address: x.settings.address, rep: x.agentName, idNo: null };
  const commission = deal ? commissionOf(deal).total : null;
  const ownerTerms = owner?.commission;
  const pct = (bp: number) => `${+(bp / 100).toFixed(2)}%`;
  const money: ReContractData['money'] = { currency };
  if (kind === 'sale') Object.assign(money, { price: priceNow, paid: null, restDue: null, commission, commissionBy: null });
  if (kind === 'rent') Object.assign(money, { rent: priceNow, period: p?.rentPeriod === 'year' ? 'year' : 'month', start: day, end: plusYear(day), payEvery: p?.rentPeriod === 'year' ? 'year' : 'month', insurance: null, commission, commissionBy: null });
  if (kind === 'deposit') Object.assign(money, { price: priceNow, deposit: null, holdUntil: plusDays(day, 7) });
  if (kind === 'brokerage') Object.assign(money, { price: p?.price ?? null, exclusive: false, validUntil: plusDays(day, 90),
    commissionNote: ownerTerms ? (ownerTerms.kind === 'percent' ? pct(ownerTerms.value) : null) : pct(x.settings.defaultCommission), commission: ownerTerms?.kind === 'fixed' ? ownerTerms.value : null });
  return {
    purpose, date: day, place: p?.city ?? x.settings.city ?? null,
    first: ownerParty, second: kind === 'brokerage' ? agencyParty : leadParty, agency,
    property: { type: p ? typeName(p.type, lang) : null, ref: p?.ref ?? null, title: p ? (lang === 'en' && p.titleEn) || p.title : null, address: p?.address ?? null, area: p?.area ?? null, city: p?.city ?? null,
      plot: null, size: p?.size ?? null, land: p?.land ?? null, rooms: rooms || null, details: null },
    money,
    clauses: x.settings.contractTerms?.[kind]?.[lang] ?? DEFAULT_TERMS[kind][lang],
    witnesses: [{ name: '' }, { name: '' }], notes: null,
  };
}

// ---------- checking what the editor sends ----------
const s = (v: unknown, max = 300) => str(v, max, 'BAD_CONTRACT');
const party = (v: any): ReParty => ({ name: s(v?.name, 200) ?? '', idNo: s(v?.idNo, 60), address: s(v?.address, 300), phone: s(v?.phone, 40), rep: s(v?.rep, 200) });
/** The contract's words, as sent by the editor: known fields only, every one checked and bounded. */
export function contractData(v: any): ReContractData {
  if (!v || typeof v !== 'object') bad('BAD_CONTRACT');
  const m = v.money ?? {}, p = v.property ?? {}, a = v.agency ?? {};
  const clauses = Array.isArray(v.clauses) && v.clauses.length <= 40 ? v.clauses.map((c: unknown) => s(c, 3000) ?? '').filter(Boolean) : bad('BAD_CONTRACT');
  const witnesses = Array.isArray(v.witnesses) && v.witnesses.length <= 4 ? v.witnesses.map((w: any) => ({ name: s(w?.name, 200) ?? '', idNo: s(w?.idNo, 60) })) : [];
  const n = (x: unknown) => amount(x, 'BAD_CONTRACT');
  const d = (x: unknown) => dateOnly(x, 'BAD_CONTRACT');
  return {
    purpose: oneOf(v.purpose, ['sale', 'rent'] as const, 'BAD_CONTRACT', 'sale'), date: d(v.date) ?? today(), place: s(v.place, 120),
    first: party(v.first), second: party(v.second),
    agency: { name: s(a.name, 200) ?? '', phone: s(a.phone, 40), address: s(a.address, 300), agent: s(a.agent, 200) },
    property: { type: s(p.type, 60), ref: p.ref == null || p.ref === '' ? null : Number.isInteger(Number(p.ref)) ? Number(p.ref) : bad('BAD_CONTRACT'), title: s(p.title, 300), address: s(p.address, 400), area: s(p.area, 120), city: s(p.city, 120),
      plot: s(p.plot, 200), size: n(p.size), land: n(p.land), rooms: s(p.rooms, 200), details: s(p.details, 2000) },
    money: { currency: oneOf(m.currency, ['USD', 'IQD'] as const, 'BAD_CONTRACT', 'USD'), price: n(m.price), paid: n(m.paid), restDue: d(m.restDue),
      rent: n(m.rent), period: m.period == null ? undefined : oneOf(m.period, ['month', 'year'] as const, 'BAD_CONTRACT'), start: d(m.start), end: d(m.end),
      payEvery: m.payEvery == null ? undefined : oneOf(m.payEvery, ['month', 'quarter', 'half', 'year'] as const, 'BAD_CONTRACT'), insurance: n(m.insurance),
      deposit: n(m.deposit), holdUntil: d(m.holdUntil), commission: n(m.commission), commissionNote: s(m.commissionNote, 200),
      commissionBy: m.commissionBy == null || m.commissionBy === '' ? null : oneOf(m.commissionBy, ['first', 'second', 'both'] as const, 'BAD_CONTRACT'), exclusive: !!m.exclusive, validUntil: d(m.validUntil) },
    clauses, witnesses, notes: s(v.notes, 2000),
  };
}

/** An agent sees the contracts they wrote and their own deals'; managers, the desk and accountants see all. */
const contractScope = (a: Actor): SQL | undefined => (may(a.principal, 'leads', 'read-all') || may(a.principal, 'commission', 'read') ? undefined
  : or(sql`${reContract.createdBy} = ${a.userId ?? "-"}`, sql`${reContract.dealId} in (select id from re_deal where agent_id = ${memberOf(a) ?? '-'})`));

async function nextNumber(tx: Database, org: string) {
  const [x] = await tx.insert(sysSequence).values({ organizationId: org, name: 're_contract', value: 1 })
    .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`${sysSequence.value} + 1` } }).returning({ value: sysSequence.value });
  return x.value;
}
async function contractOf(tx: Database, a: Actor, id: string) {
  const [x] = await tx.select().from(reContract).where(and(eq(reContract.id, id), contractScope(a)));
  if (!x) throw new HttpError(404, 'CONTRACT_NOT_FOUND');
  return x;
}

/** Fill a new contract from a deal, or a property (and maybe a lead), inside the agency's transaction. */
export async function draftFor(tx: Database, a: Actor, kind: Kind, lang: L, refs: { dealId?: string | null; propertyId?: string | null; leadId?: string | null }) {
  let deal: typeof reDeal.$inferSelect | null = null;
  if (refs.dealId) {
    const [x] = await tx.select().from(reDeal).where(eq(reDeal.id, refs.dealId));
    if (!x || (!may(a.principal, 'leads', 'read-all') && !may(a.principal, 'commission', 'read') && x.agentId && x.agentId !== memberOf(a))) throw new HttpError(404, 'DEAL_NOT_FOUND');
    deal = x;
  }
  const propertyId = deal?.propertyId ?? refs.propertyId ?? null;
  const [p] = propertyId ? await tx.select().from(reProperty).where(eq(reProperty.id, propertyId)) : [];
  if (propertyId && !p) throw new HttpError(404, 'PROPERTY_NOT_FOUND');
  if (!p && kind === 'brokerage') throw new HttpError(400, 'NEEDS_PROPERTY');
  const leadId = deal?.leadId ?? refs.leadId ?? null;
  const lead = leadId ? await leadOf(tx, a, leadId) : null;
  const ownerId = deal?.ownerId ?? p?.ownerId ?? null;
  const [owner] = ownerId ? await tx.select().from(reOwner).where(eq(reOwner.id, ownerId)) : [];
  const [o] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, a.organizationId));
  const settings = await settingsOf(tx, a.organizationId);
  const agentMember = deal?.agentId ?? p?.agentId ?? memberOf(a);
  const [agent] = agentMember ? rowsOfName(await tx.execute(sql`select coalesce(g.name, u.name) as name from member m join "user" u on u.id = m.user_id left join re_agent g on g.member_id = m.id where m.id = ${agentMember}`)) : [];
  const data = contractDraft({ kind, lang, agencyName: o?.name ?? '', settings: settings as any, property: p ?? null, owner: owner ? { name: owner.name, phone: owner.phone, commission: owner.commission ?? null } : null,
    lead: lead ? { name: lead.name, phone: lead.phone } : null, deal, agentName: agent?.name ?? null });
  return { data, dealId: deal?.id ?? null, propertyId: p?.id ?? null, leadId: lead?.id ?? null, ownerId: owner?.id ?? null };
}
const rowsOfName = (r: any): { name: string }[] => (Array.isArray(r) ? r : r?.rows ?? []);

const out = (x: typeof reContract.$inferSelect) => ({ ...x });

export function reContractRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/contracts', async (c) => {
    const a = actor(c, 'deals', 'read');
    const q = c.req.query();
    const rows = await inRe(d, a, (tx) => {
      const where = [contractScope(a)];
      if (q.kind) where.push(eq(reContract.kind, oneOf(q.kind, RE_CONTRACT_KINDS, 'BAD_KIND')));
      if (q.status) where.push(eq(reContract.status, oneOf(q.status, ['draft', 'signed', 'void'] as const, 'BAD_STATUS')));
      if (q.dealId) where.push(eq(reContract.dealId, q.dealId));
      if (q.propertyId) where.push(eq(reContract.propertyId, q.propertyId));
      const t = (q.q ?? '').trim().slice(0, 80);
      if (t) where.push(or(like(sql`${reContract.data}->'first'->>'name'`, t), like(sql`${reContract.data}->'second'->>'name'`, t), like(sql`${reContract.data}->'property'->>'title'`, t),
        /^\d+$/.test(t) ? eq(reContract.number, Number(t)) : undefined));
      return tx.select({ id: reContract.id, number: reContract.number, kind: reContract.kind, status: reContract.status, lang: reContract.lang, dealId: reContract.dealId, propertyId: reContract.propertyId,
        first: sql<string>`${reContract.data}->'first'->>'name'`, second: sql<string>`${reContract.data}->'second'->>'name'`, title: sql<string>`${reContract.data}->'property'->>'title'`,
        currency: sql<string>`${reContract.data}->'money'->>'currency'`,
        amount: sql<string | null>`coalesce(${reContract.data}->'money'->>'price', ${reContract.data}->'money'->>'rent')`, deposit: sql<string | null>`${reContract.data}->'money'->>'deposit'`,
        date: sql<string>`${reContract.data}->>'date'`, signedAt: reContract.signedAt, updatedAt: reContract.updatedAt })
        .from(reContract).where(and(...where)).orderBy(desc(reContract.updatedAt)).limit(200);
    });
    return c.json({ contracts: rows.map((x) => ({ ...x, amount: x.kind === 'deposit' ? (x.deposit == null ? null : Number(x.deposit)) : x.amount == null ? null : Number(x.amount), deposit: undefined })) });
  });

  /** The agency's terms for a kind of contract (its own, or Hemlo's), to start again from. */
  r.get('/contracts/terms', async (c) => {
    const a = actor(c, 'deals', 'read');
    const kind = oneOf(c.req.query('kind'), RE_CONTRACT_KINDS, 'BAD_KIND'), lang = oneOf(c.req.query('lang'), ['ar', 'en'] as const, 'BAD_LANG', 'ar');
    const s0 = await inRe(d, a, (tx) => settingsOf(tx, a.organizationId));
    const own = (s0 as any).contractTerms?.[kind]?.[lang] as string[] | undefined;
    return c.json({ clauses: own ?? DEFAULT_TERMS[kind][lang], own: !!own, hemlo: DEFAULT_TERMS[kind][lang] });
  });
  /** Keep these terms as the agency's own for this kind and language (or go back to Hemlo's with an empty list). */
  r.put('/contracts/terms', async (c) => {
    const a = actor(c, 'agency', 'configure');
    const b = await c.req.json<any>();
    const kind = oneOf(b.kind, RE_CONTRACT_KINDS, 'BAD_KIND'), lang = oneOf(b.lang, ['ar', 'en'] as const, 'BAD_LANG');
    const clauses = Array.isArray(b.clauses) && b.clauses.length <= 40 ? b.clauses.map((x: unknown) => s(x, 3000) ?? '').filter(Boolean) as string[] : bad('BAD_CONTRACT');
    await inRe(d, a, async (tx) => {
      const cur = ((await settingsOf(tx, a.organizationId)) as any).contractTerms ?? {};
      const next = { ...cur, [kind]: { ...(cur[kind] ?? {}), [lang]: clauses.length ? clauses : undefined } };
      await tx.insert(reSettings).values({ organizationId: a.organizationId, contractTerms: next })
        .onConflictDoUpdate({ target: reSettings.organizationId, set: { contractTerms: next, updatedAt: new Date() } });
    });
    return c.json({ ok: true });
  });

  r.get('/contracts/:id', async (c) => {
    const a = actor(c, 'deals', 'read');
    const res = await inRe(d, a, async (tx) => {
      const x = await contractOf(tx, a, c.req.param('id'));
      const [ss] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, a.organizationId));
      const [doc] = x.documentId ? await tx.select().from(reDocument).where(eq(reDocument.id, x.documentId)) : [];
      return { contract: out(x), logo: await fileUrl(d.env, a.organizationId, ss?.logoId), signedCopy: doc ? { id: doc.id, title: doc.title, url: await fileUrl(d.env, a.organizationId, doc.fileId, 3600) } : null };
    });
    return c.json(res);
  });

  /** A new contract, filled from a deal or a property (and a lead); the editor opens on it straight away. */
  r.post('/contracts', async (c) => {
    const a = actor(c, 'deals', 'manage');
    const b = await c.req.json<any>();
    const kind = oneOf(b.kind, RE_CONTRACT_KINDS, 'BAD_KIND'), lang = oneOf(b.lang, ['ar', 'en'] as const, 'BAD_LANG', 'ar');
    const res = await inRe(d, a, async (tx) => {
      const f = await draftFor(tx, a, kind, lang, { dealId: b.dealId ?? null, propertyId: b.propertyId ?? null, leadId: b.leadId ?? null });
      const id = newId();
      const [x] = await tx.insert(reContract).values({ id, organizationId: a.organizationId, number: await nextNumber(tx, a.organizationId), kind, lang, data: f.data,
        dealId: f.dealId, propertyId: f.propertyId, leadId: f.leadId, ownerId: f.ownerId, createdBy: a.userId }).returning();
      await activity(tx, a.organizationId, 'contract.created', { dealId: f.dealId, propertyId: f.propertyId, leadId: f.leadId, ownerId: f.ownerId }, { title: `#${x.number}`, kind }, a.userId);
      return out(x);
    });
    return c.json({ contract: res }, 201);
  });

  /** Edit a draft (its words, its language); sign it or void it; attach the signed copy. Signed or void, the words stay. */
  r.patch('/contracts/:id', async (c) => {
    const a = actor(c, 'deals', 'manage');
    const b = await c.req.json<any>();
    const res = await inRe(d, a, async (tx) => {
      const x = await contractOf(tx, a, c.req.param('id'));
      const set: Partial<typeof reContract.$inferInsert> = { updatedAt: new Date() };
      if (b.data !== undefined || b.lang !== undefined) {
        if (x.status !== 'draft') throw new HttpError(409, 'CONTRACT_LOCKED');
        if (b.data !== undefined) set.data = contractData(b.data);
        if (b.lang !== undefined) set.lang = oneOf(b.lang, ['ar', 'en'] as const, 'BAD_LANG');
      }
      if (b.status !== undefined && b.status !== x.status) {
        const to = oneOf(b.status, ['signed', 'void'] as const, 'BAD_STATUS');
        if (x.status === 'void' || (to === 'signed' && x.status !== 'draft')) throw new HttpError(409, 'CONTRACT_LOCKED');
        set.status = to;
        if (to === 'signed') set.signedAt = new Date();
        await activity(tx, a.organizationId, `contract.${to}`, { dealId: x.dealId, propertyId: x.propertyId, leadId: x.leadId, ownerId: x.ownerId }, { title: `#${x.number}`, kind: x.kind }, a.userId);
      }
      if (b.documentId !== undefined) {
        if (b.documentId === null) set.documentId = null;
        else {
          const [doc] = await tx.select({ id: reDocument.id }).from(reDocument).where(eq(reDocument.id, String(b.documentId)));
          if (!doc) throw new HttpError(404, 'DOCUMENT_NOT_FOUND');
          set.documentId = doc.id;
        }
      }
      const [y] = await tx.update(reContract).set(set).where(eq(reContract.id, x.id)).returning();
      return out(y);
    });
    return c.json({ contract: res });
  });

  /** A draft nobody needs can go; a signed or void contract stays on the record. */
  r.delete('/contracts/:id', async (c) => {
    const a = actor(c, 'deals', 'manage');
    await inRe(d, a, async (tx) => {
      const x = await contractOf(tx, a, c.req.param('id'));
      if (x.status !== 'draft') throw new HttpError(409, 'CONTRACT_LOCKED');
      await tx.delete(reContract).where(eq(reContract.id, x.id));
    });
    return c.json({ ok: true });
  });

  return r;
}
