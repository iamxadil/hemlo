// The demo clinic: a believable Baghdad dental clinic with a month of patients, today's list (someone in the chair,
// someone waiting), plans with a choice to make, lab work back and late, instalments due. Deterministic, and written in
// one statement like the demo shop. Times are around "now" so the day always looks alive.
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import {
  sysCustomer, sysSale, sysSaleLine, sysLedger, sysSequence, sysShift, sysSupplier, sysSupplierLedger,
  dentSettings, dentChair, dentDentist, dentProcedure, dentPatient, dentAppointment, dentFinding, dentPlan, dentPlanItem,
  dentVisit, dentVisitItem, dentRx, dentLabOrder, dentInstallment,
} from '@hemlo/db/schema';
import { insertAll } from './demo-data';
import { CATALOG, DEFAULT_HOURS } from './routes/dental/catalog';
import { alertsFrom } from './routes/dental/common';

type Lang = 'ar' | 'en';
type Batch = Parameters<typeof insertAll>[1][number];
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR, RATE = 1450;
const baghdadMidnight = (daysAgo: number) => { const now = new Date(Date.now() + 3 * HOUR); return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * HOUR - daysAgo * DAY; };
const dateOf = (t: number) => new Date(t + 3 * HOUR).toISOString().slice(0, 10);
/** An open-hours time N days ago (Friday is closed, so it moves to Thursday). */
const dayAt = (daysAgo: number, hour: number) => {
  let t = baghdadMidnight(daysAgo) + hour * HOUR;
  if (new Date(t + 3 * HOUR).getUTCDay() === 5) t -= DAY * Math.sign(daysAgo || 1);
  return t;
};

// catalog positions used below
const P = { exam: 0, pa: 1, opg: 2, scaling: 3, deep: 4, compFront: 5, compBack: 6, rctPre: 9, rctMolar: 10, post: 12, ext: 13, wisdom: 15, zirc: 17, veneer: 19,
  implant: 20, implantCrown: 21, partial: 23, whitening: 24, sealant: 25, pulpotomy: 27, ssCrown: 28, braces: 29, bracesVisit: 30 };

export const DEMO_CLINIC = { ar: { name: 'عيادة ابتسامة بغداد لطب الأسنان', owner: 'د. سامر العبيدي' }, en: { name: 'Baghdad Smile Dental Clinic', owner: 'Dr Samer Al-Obaidi' } };

export async function seedDemoClinic(tx: Database, org: string, userId: string, memberId: string, lang: Lang, first: Batch[] = []) {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const now = Date.now();

  // ---- the clinic ----
  const chairs = [L('كرسي 1', 'Chair 1'), L('كرسي 2', 'Chair 2')].map((name, i) => ({ id: newId(), organizationId: org, name, sort: i }));
  const dentists = [
    { id: newId(), organizationId: org, memberId, name: DEMO_CLINIC[lang].owner, specialty: 'prostho', color: '#A8532E', sharePercent: 0, shareBasis: 'collected', labDeduct: true },
    { id: newId(), organizationId: org, memberId: null, name: L('د. رنا الخفاجي', 'Dr Rana Al-Khafaji'), specialty: 'endo', color: '#2F5DA8', sharePercent: 40, shareBasis: 'collected', labDeduct: true },
    { id: newId(), organizationId: org, memberId: null, name: L('د. أحمد الجبوري', 'Dr Ahmed Al-Jubouri'), specialty: 'ortho', color: '#1F7A4D', sharePercent: 35, shareBasis: 'collected', labDeduct: true },
  ];
  const [OWNER, RANA, AHMED] = dentists;
  const procs = CATALOG.map(([ar, en, category, currency, price, minutes, scope, mark, lab], i) => ({
    id: newId(), organizationId: org, name: L(ar, en), category, currency, price, minutes, scope, mark, labWork: !!lab, sort: i }));
  const labs = [L('مختبر الرافدين للأسنان', 'Al-Rafidain Dental Lab'), L('مختبر النخبة', 'Al-Nukhba Lab')]
    .map((name, i) => ({ id: newId(), organizationId: org, name, phone: `+96478012345${i}0`, kind: 'lab', balance: 0 }));

  // ---- patients ----
  const REF = { insta: L('انستغرام', 'Instagram'), friend: L('صديق أو قريب', 'A friend'), maps: L('خرائط كوكل', 'Google Maps'), walk: L('مرّ من الشارع', 'Walked in') };
  const people: [string, string, 'f' | 'm', number, string, Record<string, any>, string?][] = [
    ['زينب حسين', 'Zainab Hussein', 'f', 34, REF.insta, {}],
    ['علي كاظم', 'Ali Kadhim', 'm', 52, REF.friend, { diabetes: true, hypertension: true }],
    ['مريم عبد الله', 'Maryam Abdullah', 'f', 27, REF.insta, { pregnant: true }],
    ['حيدر جاسم', 'Haider Jasim', 'm', 61, REF.maps, { anticoagulants: true, heart: true }],
    ['نور الهدى سالم', 'Noor Al-Huda Salem', 'f', 19, REF.insta, {}],
    ['مصطفى رعد', 'Mustafa Raad', 'm', 41, REF.friend, { allergies: { penicillin: true } }],
    ['سارة فلاح', 'Sara Falah', 'f', 30, REF.walk, {}],
    ['يوسف أحمد', 'Yousif Ahmed', 'm', 8, REF.friend, {}, L('أحمد يوسف (الأب)', 'Ahmed Yousif (father)')],
    ['فاطمة كريم', 'Fatima Karim', 'f', 45, REF.maps, { asthma: true }],
    ['عمر صباح', 'Omar Sabah', 'm', 36, REF.insta, {}],
    ['رقية محمد', 'Ruqaya Mohammed', 'f', 23, REF.insta, {}],
    ['حسن علي', 'Hassan Ali', 'm', 57, REF.friend, { allergies: { nsaids: true } }],
    ['آية ستار', 'Aya Sattar', 'f', 29, REF.walk, {}],
    ['كرار حميد', 'Karrar Hameed', 'm', 33, REF.maps, {}],
  ];
  const firstSeen = [21, 14, 0, 10, 32, 5, 16, 9, 20, 6, 2, 25, 1, 3];
  const thisYear = new Date().getUTCFullYear();
  const customers = people.map(([ar, en], i) => ({ id: newId(), organizationId: org, name: L(ar, en), phone: `+9647701234${String(500 + i * 7)}`, balance: 0,
    createdAt: new Date(dayAt(firstSeen[i], 14) - 20 * MIN), updatedAt: new Date() }));
  const patients = people.map(([, , gender, age, referral, medical, guardian], i) => ({
    customerId: customers[i].id, organizationId: org, fileNo: i + 1, gender, birthDate: `${thisYear - age}-${String(1 + ((i * 5) % 12)).padStart(2, '0')}-${String(3 + ((i * 7) % 25)).padStart(2, '0')}`,
    referral, guardian: guardian ?? null, medical, alerts: alertsFrom(medical), recallDue: null as string | null, createdAt: customers[i].createdAt, updatedAt: new Date() }));
  const [ZAINAB, ALI, MARYAM, HAIDER, NOOR, MUSTAFA, SARA, YOUSIF, FATIMA, OMAR, RUQAYA, HASSAN, AYA, KARRAR] = customers.map((c) => c.id);
  patients[3].recallDue = dateOf(now + 5 * DAY);  // Haider: check-up soon, nothing booked
  patients[12].recallDue = dateOf(now - 4 * DAY); // Aya: overdue check-up
  patients[9].recallDue = dateOf(now + 9 * DAY);

  // ---- collectors ----
  const appts: (typeof dentAppointment.$inferInsert)[] = [], findings: (typeof dentFinding.$inferInsert)[] = [];
  const plans: (typeof dentPlan.$inferInsert)[] = [], planItems: (typeof dentPlanItem.$inferInsert)[] = [];
  const visits: (typeof dentVisit.$inferInsert)[] = [], vItems: (typeof dentVisitItem.$inferInsert)[] = [];
  const sales: (typeof sysSale.$inferInsert)[] = [], lines: (typeof sysSaleLine.$inferInsert)[] = [];
  const money: { customerId: string; at: number; amount: number; kind: 'sale' | 'payment'; saleId?: string; shiftId?: string | null }[] = [];
  const shiftId = newId(), shiftOpen = Math.min(now - 10 * MIN, baghdadMidnight(0) + 13 * HOUR);
  let saleNo = 0;
  const amountOf = (p: (typeof procs)[number]) => (p.currency === 'USD' ? Math.round((p.price * RATE) / 250) * 250 : p.price);

  const existing = (patientId: string, at: number, list: [number, string, string?][]) => {
    for (const [tooth, kind, surfaces] of list) findings.push({ id: newId(), organizationId: org, patientId, tooth, surfaces: surfaces ?? null, kind, status: 'existing', createdAt: new Date(at), createdBy: userId });
  };
  const appt = (patientId: string, start: number, minutes: number, dentist: typeof OWNER, chair: number, status: string, reason: string | null, extra: Partial<typeof dentAppointment.$inferInsert> = {}) => {
    const id = newId();
    appts.push({ id, organizationId: org, patientId, dentistId: dentist.id, chairId: chairs[chair].id, startsAt: new Date(start), endsAt: new Date(start + minutes * MIN), status, reason,
      bookedBy: userId, createdAt: new Date(start - 3 * DAY),
      arrivedAt: ['arrived', 'seated', 'done'].includes(status) ? new Date(start - 8 * MIN) : null,
      seatedAt: ['seated', 'done'].includes(status) ? new Date(start + 2 * MIN) : null,
      finishedAt: status === 'done' ? new Date(start + (minutes - 3) * MIN) : null, ...extra });
    return id;
  };
  type Line = { proc: number; tooth?: number; surfaces?: string; planItemId?: string; dentist?: typeof OWNER };
  /** A visit: its items, the bill, what the patient paid, what the chart now shows. */
  const visit = (patientId: string, at: number, dentist: typeof OWNER, items: Line[], paid: 'all' | number, o: { notes?: string; complaint?: string; anesthesia?: string; appointmentId?: string; method?: 'cash' | 'card' } = {}) => {
    const visitId = newId();
    const priced = items.map((l) => ({ ...l, p: procs[l.proc], amount: amountOf(procs[l.proc]) }));
    const total = priced.reduce((s, l) => s + l.amount, 0);
    const pay = paid === 'all' ? total : Math.min(total, paid);
    let saleId: string | null = null;
    if (total > 0) {
      saleId = newId();
      const method = o.method ?? 'cash', today = at >= baghdadMidnight(0);
      const sid = pay > 0 && method === 'cash' && today ? shiftId : null;
      sales.push({ id: saleId, organizationId: org, number: ++saleNo, createdAt: new Date(at), userId, customerId: patientId, subtotal: total, discount: 0, total, paid: pay, due: total - pay,
        method: total - pay === 0 ? method : pay > 0 ? 'mixed' : 'credit', cost: 0, note: 'dental', shiftId: sid });
      for (const l of priced) lines.push({ id: newId(), organizationId: org, saleId, productId: null, name: l.tooth ? `${l.p.name} · ${l.tooth}${l.surfaces ? ' ' + l.surfaces : ''}` : l.p.name, qty: 1, baseQty: 1, price: l.amount, total: l.amount, cost: 0 });
      if (total - pay > 0) money.push({ customerId: patientId, at, amount: total - pay, kind: 'sale', saleId });
    }
    visits.push({ id: visitId, organizationId: org, patientId, appointmentId: o.appointmentId ?? null, dentistId: dentist.id, at: new Date(at), complaint: o.complaint ?? null, notes: o.notes ?? null,
      anesthesia: o.anesthesia ?? null, saleId, createdBy: userId });
    for (const l of priced) {
      vItems.push({ id: newId(), organizationId: org, visitId, procedureId: l.p.id, name: l.p.name, tooth: l.tooth ?? null, surfaces: l.surfaces ?? null, currency: l.p.currency,
        priceOriginal: l.p.price, usdRate: l.p.currency === 'USD' ? RATE : null, amount: l.amount, dentistId: (l.dentist ?? dentist).id, planItemId: l.planItemId ?? null, labCost: 0 });
      if (l.planItemId) { const pi = planItems.find((x) => x.id === l.planItemId)!; pi.status = 'done'; pi.visitId = visitId; }
      if (l.p.mark && l.tooth) {
        const f = findings.find((x) => x.planItemId && x.planItemId === l.planItemId);
        if (f) { f.status = 'done'; f.visitId = visitId; }
        else findings.push({ id: newId(), organizationId: org, patientId, tooth: l.tooth, surfaces: l.surfaces ?? null, kind: l.p.mark, status: 'done', visitId, createdAt: new Date(at), createdBy: userId });
        // treated: the decay on that tooth is gone
        for (const c of findings) if (c.patientId === patientId && c.tooth === l.tooth && c.kind === 'caries' && !c.removedAt) c.removedAt = new Date(at);
      }
    }
    return visitId;
  };
  const plan = (patientId: string, at: number, dentist: typeof OWNER, title: string, status: string, items: Line[], o: { kind?: string; group?: string; phaseOf?: (i: number) => number } = {}) => {
    const id = newId();
    plans.push({ id, organizationId: org, patientId, title, kind: o.kind ?? 'general', status, optionGroup: o.group ?? null, dentistId: dentist.id, createdBy: userId, createdAt: new Date(at),
      decidedAt: ['accepted', 'in_progress', 'completed', 'declined'].includes(status) ? new Date(at + HOUR) : null });
    return items.map((l, i) => {
      const p = procs[l.proc], itemId = newId();
      planItems.push({ id: itemId, organizationId: org, planId: id, procedureId: p.id, name: p.name, tooth: l.tooth ?? null, surfaces: l.surfaces ?? null, phase: o.phaseOf?.(i) ?? 1, currency: p.currency, price: p.price, status: 'planned', sort: i });
      if (p.mark && l.tooth) findings.push({ id: newId(), organizationId: org, patientId, tooth: l.tooth, surfaces: l.surfaces ?? null, kind: p.mark, status: 'planned', planItemId: itemId, createdAt: new Date(at), createdBy: userId });
      return itemId;
    });
  };
  const pay = (customerId: string, at: number, amount: number) => money.push({ customerId, at, amount: -amount, kind: 'payment', shiftId: at >= baghdadMidnight(0) ? shiftId : null });

  // ---- the last month ----
  // Zainab: exam, root canal on 36 (Dr Rana), zirconia crown back from the lab and fitting today
  existing(ZAINAB, dayAt(21, 14), [[26, 'filling', 'O'], [36, 'caries', 'O'], [46, 'caries', 'OD'], [18, 'missing']]);
  const zPlan = plan(ZAINAB, dayAt(21, 14) + 30 * MIN, OWNER, L('علاج الضرس 36 وحشوة 46', 'Tooth 36 and filling on 46'), 'in_progress',
    [{ proc: P.rctMolar, tooth: 36 }, { proc: P.zirc, tooth: 36 }, { proc: P.compBack, tooth: 46, surfaces: 'OD' }], { phaseOf: (i) => (i === 2 ? 2 : 1) });
  visit(ZAINAB, dayAt(21, 14), OWNER, [{ proc: P.exam }, { proc: P.opg }], 'all', { complaint: L('ألم عند الأكل في الجهة اليسرى', 'Pain on chewing, left side'), notes: L('تسوس عميق في 36 قريب من العصب، و46 تسوس بين الأسنان. الخطة: عصب 36 ثم تاج زيركون.', 'Deep decay on 36 near the pulp; 46 interproximal decay. Plan: root canal on 36, then a zirconia crown.') });
  visit(ZAINAB, dayAt(18, 16), RANA, [{ proc: P.rctMolar, tooth: 36, planItemId: zPlan[0] }], 100000, { anesthesia: L('ليدوكائين 2% كاربولة واحدة', 'Lidocaine 2%, one cartridge'), notes: L('ثلاث قنوات، الطول بجهاز الأبكس. حشوة مؤقتة.', 'Three canals, working length by apex locator. Temporary filling.') });
  pay(ZAINAB, dayAt(11, 18), 50000);

  // Ali (diabetic): cleaning, 46 out; choosing implant or bridge
  existing(ALI, dayAt(14, 17), [[16, 'crown'], [17, 'missing'], [26, 'filling', 'MO'], [46, 'caries'], [37, 'filling', 'O']]);
  visit(ALI, dayAt(14, 17), OWNER, [{ proc: P.exam }, { proc: P.scaling }], 'all', { notes: L('سكري مسيطر عليه (HbA1c 7.1). 46 متهدم لا يمكن إنقاذه.', 'Diabetes controlled (HbA1c 7.1). 46 broken down, not restorable.') });
  visit(ALI, dayAt(7, 18), OWNER, [{ proc: P.ext, tooth: 46 }], 0, { anesthesia: L('ليدوكائين 2% كاربولتان', 'Lidocaine 2%, two cartridges'), notes: L('قلع بدون مضاعفات. تعليمات ما بعد القلع.', 'Uneventful extraction. Post-op instructions given.') });
  plan(ALI, dayAt(7, 18) + 20 * MIN, OWNER, L('الخيار أ: زرعة للسن 46', 'Option A: implant for 46'), 'proposed', [{ proc: P.implant, tooth: 46 }, { proc: P.implantCrown, tooth: 46 }], { kind: 'implant', group: 'ali-46', phaseOf: (i) => i + 1 });
  plan(ALI, dayAt(7, 18) + 25 * MIN, OWNER, L('الخيار ب: جسر زيركون 45–47', 'Option B: zirconia bridge 45–47'), 'proposed', [{ proc: P.zirc, tooth: 45 }, { proc: P.zirc, tooth: 46 }, { proc: P.zirc, tooth: 47 }], { group: 'ali-46' });

  // Haider (blood thinners): filling on 26
  existing(HAIDER, dayAt(10, 15), [[36, 'rct'], [36, 'crown'], [47, 'missing'], [26, 'caries', 'MO'], [11, 'filling', 'M']]);
  visit(HAIDER, dayAt(10, 15), OWNER, [{ proc: P.exam }, { proc: P.pa, tooth: 26 }, { proc: P.compBack, tooth: 26, surfaces: 'MO' }], 'all', { method: 'card', notes: L('يتناول الوارفارين — INR اليوم 2.3. تجنّب القلع دون استشارة طبيبه.', 'On warfarin — INR today 2.3. No extractions without asking his physician.') });

  // Noor: braces (Dr Ahmed), paying in monthly instalments
  const nPlan = plan(NOOR, dayAt(32, 15), AHMED, L('تقويم ثابت', 'Fixed braces'), 'in_progress', [{ proc: P.braces }], { kind: 'ortho' });
  visit(NOOR, dayAt(32, 15), AHMED, [{ proc: P.braces, planItemId: nPlan[0] }], 400000, { notes: L('تركيب الأقواس العلوية والسفلية. سلك NiTi 0.014.', 'Upper and lower brackets bonded. 0.014 NiTi wire.') });
  const noorPlanId = plans[plans.length - 1].id;
  const braces = amountOf(procs[P.braces]);

  // Mustafa (penicillin allergy): root canal on 24 by Dr Rana; a prescription without penicillin
  existing(MUSTAFA, dayAt(5, 16), [[24, 'caries', 'D'], [14, 'filling', 'MO']]);
  const mVisit = visit(MUSTAFA, dayAt(5, 16), RANA, [{ proc: P.exam }, { proc: P.rctPre, tooth: 24 }], 60000, { complaint: L('ألم ليلي في الضاحك العلوي', 'Night pain, upper premolar'), anesthesia: L('ارتيكائين 4%', 'Articaine 4%'), notes: L('التهاب لب غير عكوس في 24. قناتان.', 'Irreversible pulpitis on 24. Two canals.') });

  // Sara: whitening, now thinking about veneers
  visit(SARA, dayAt(16, 17), OWNER, [{ proc: P.exam }, { proc: P.whitening }], 'all', { method: 'card' });
  plan(SARA, dayAt(3, 18), OWNER, L('فينير للأسنان الأمامية', 'Veneers, front teeth'), 'proposed', [{ proc: P.veneer, tooth: 11 }, { proc: P.veneer, tooth: 21 }, { proc: P.veneer, tooth: 12 }, { proc: P.veneer, tooth: 22 }], { kind: 'general' });

  // Yousif (8): sealants and a baby-tooth pulpotomy, father pays
  existing(YOUSIF, dayAt(9, 15), [[84, 'caries', 'O']]);
  visit(YOUSIF, dayAt(9, 15), RANA, [{ proc: P.exam }, { proc: P.sealant, tooth: 36 }, { proc: P.sealant, tooth: 46 }, { proc: P.pulpotomy, tooth: 84 }, { proc: P.ssCrown, tooth: 84 }], 'all', { notes: L('طفل متعاون. بتر لب 84 وتاج ستانلس.', 'Cooperative child. Pulpotomy on 84 and a stainless steel crown.') });

  // Fatima: deep cleaning, a filling, still owes a little
  existing(FATIMA, dayAt(20, 14), [[15, 'caries', 'MOD'], [25, 'crown'], [38, 'missing'], [48, 'missing']]);
  visit(FATIMA, dayAt(20, 14), OWNER, [{ proc: P.exam }, { proc: P.deep }], 'all');
  visit(FATIMA, dayAt(12, 15), OWNER, [{ proc: P.compBack, tooth: 15, surfaces: 'MOD' }], 15000);

  // Omar: impacted wisdom tooth out
  existing(OMAR, dayAt(6, 17), [[38, 'impacted']]);
  visit(OMAR, dayAt(6, 17), OWNER, [{ proc: P.exam }, { proc: P.opg }, { proc: P.wisdom, tooth: 38 }], 'all', { anesthesia: L('تخدير عصب سنخي سفلي', 'Inferior alveolar nerve block'), notes: L('قلع جراحي مع إزالة عظم. 3 غرز. موعد فك الغرز بعد أسبوع.', 'Surgical removal with bone removal. 3 sutures, out in a week.') });

  // Ruqaya, Aya: quick visits
  visit(RUQAYA, dayAt(2, 19), RANA, [{ proc: P.exam }, { proc: P.compFront, tooth: 11, surfaces: 'M' }], 'all');
  visit(AYA, dayAt(1, 16), OWNER, [{ proc: P.scaling }], 'all');

  // Hassan: a partial denture at the lab, and it's late
  existing(HASSAN, dayAt(25, 16), [[35, 'missing'], [36, 'missing'], [37, 'missing'], [45, 'missing'], [46, 'missing']]);
  const hPlan = plan(HASSAN, dayAt(25, 16), OWNER, L('طقم جزئي سفلي', 'Lower partial denture'), 'in_progress', [{ proc: P.partial }]);
  visit(HASSAN, dayAt(9, 16), OWNER, [{ proc: P.exam }, { proc: P.partial, planItemId: hPlan[0] }], 100000, { notes: L('طبعة نهائية للفك السفلي. يتحسس من المسكنات (NSAIDs).', 'Final lower impression. Sensitive to NSAIDs.') });

  // Karrar: missed his first appointment
  appt(KARRAR, dayAt(3, 18), 30, OWNER, 0, 'no_show', L('فحص', 'Check-up'));
  appt(AYA, dayAt(9, 19), 30, OWNER, 1, 'no_show', L('تنظيف', 'Cleaning'));

  // past visits' appointments
  for (const v of visits) {
    const id = appt(v.patientId, +v.at! - 5 * MIN, 45, dentists.find((x) => x.id === v.dentistId)!, v.dentistId === RANA.id ? 1 : 0, 'done', null);
    v.appointmentId = id;
  }

  // ---- today, around now (inside the demo clinic's 09:00–22:00; what's already over is done, and billed) ----
  const anchor = Math.min(Math.max(now, baghdadMidnight(0) + 12 * HOUR), baghdadMidnight(0) + 20 * HOUR);
  const slot = (m: number) => Math.round((anchor + m * MIN) / (15 * MIN)) * 15 * MIN;
  const over = (t: number, mins: number) => t + mins * MIN <= now;
  const t1 = slot(-180), t2 = slot(-135), t3 = slot(-90);
  existing(MARYAM, t1, [[16, 'filling', 'O'], [26, 'filling', 'O']]);
  if (over(t1, 30)) {
    const a1 = appt(MARYAM, t1, 30, OWNER, 0, 'done', L('فحص — حامل', 'Check-up — pregnant'));
    visit(MARYAM, t1 + 5 * MIN, OWNER, [{ proc: P.exam }], 'all', { appointmentId: a1, notes: L('حامل بالشهر الخامس. تأجيل الأشعة. تنظيف بعد الولادة.', 'Five months pregnant. X-rays postponed. Cleaning after the birth.') });
  } else appt(MARYAM, t1, 30, OWNER, 0, 'confirmed', L('فحص — حامل', 'Check-up — pregnant'));
  existing(KARRAR, t2, [[36, 'caries', 'MO'], [27, 'filling', 'O']]);
  if (over(t2, 45)) {
    const a2 = appt(KARRAR, t2, 45, RANA, 1, 'done', L('فحص', 'Check-up'));
    visit(KARRAR, t2 + 5 * MIN, RANA, [{ proc: P.exam }, { proc: P.pa, tooth: 36 }], 'all', { appointmentId: a2 });
    plan(KARRAR, t2 + 30 * MIN, RANA, L('حشوة 36', 'Filling on 36'), 'accepted', [{ proc: P.compBack, tooth: 36, surfaces: 'MO' }]);
  } else appt(KARRAR, t2, 45, RANA, 1, 'confirmed', L('فحص', 'Check-up'));
  if (over(t3, 45)) {
    const a3 = appt(MUSTAFA, t3, 45, RANA, 1, 'done', L('إكمال العصب 24', 'Finish root canal 24'));
    visit(MUSTAFA, t3 + 5 * MIN, RANA, [{ proc: P.post, tooth: 24 }], 25000, { appointmentId: a3, notes: L('حشو القنوات بالكوتابيركا. وتد ليفي.', 'Canals obturated with gutta-percha. Fibre post.') });
  } else appt(MUSTAFA, t3, 45, RANA, 1, 'confirmed', L('إكمال العصب 24', 'Finish root canal 24'));
  appt(ZAINAB, slot(-30), 60, OWNER, 0, now >= slot(-30) ? 'seated' : 'confirmed', L('تركيب تاج 36', 'Fit crown on 36'));
  appt(NOOR, slot(-10), 30, AHMED, 1, now >= slot(-10) - 10 * MIN ? 'arrived' : 'confirmed', L('مراجعة تقويم', 'Braces check'));
  appt(YOUSIF, slot(20), 30, RANA, 1, 'confirmed', L('مراجعة', 'Follow-up'), { remindedAt: new Date(now - 20 * HOUR) });
  appt(ALI, slot(60), 45, OWNER, 0, 'booked', L('استشارة زرعة أو جسر', 'Implant or bridge: consult'), { remindedAt: new Date(now - 22 * HOUR) });
  appt(OMAR, slot(120), 15, OWNER, 0, 'booked', L('فك الغرز', 'Suture removal'));
  appt(FATIMA, slot(150), 30, OWNER, 1, 'booked', L('مراجعة', 'Review'));

  // ---- the coming week ----
  ([[1, 15, SARA, OWNER, 0, 45, L('استشارة فينير', 'Veneers consult')], [1, 17, HASSAN, OWNER, 0, 30, L('تجربة الطقم', 'Denture try-in')], [2, 16, RUQAYA, RANA, 1, 30, L('مراجعة', 'Follow-up')],
    [3, 14, KARRAR, RANA, 1, 45, L('حشوة 36', 'Filling 36')], [3, 18, NOOR, AHMED, 1, 30, L('تغيير السلك', 'Wire change')], [4, 19, ZAINAB, OWNER, 0, 45, L('حشوة 46', 'Filling 46')],
    [6, 16, AYA, OWNER, 0, 30, L('فحص دوري', 'Check-up')]] as const).forEach(([ahead, h, p, dn, ch, mins, reason]) => appt(p, dayAt(-ahead, h), mins, dn, ch, 'booked', reason));

  // ---- instalments: braces, monthly; the first one is due ----
  const left = braces - 400000, each = Math.round(left / 4 / 1000) * 1000;
  const installments = [0, 1, 2, 3].map((k) => ({ id: newId(), organizationId: org, patientId: NOOR, planId: noorPlanId, dueDate: dateOf(dayAt(32, 15) + (k + 1) * 30 * DAY), amount: k === 3 ? left - each * 3 : each, paidAt: null }));

  // ---- lab work ----
  const labOrders = [
    { id: newId(), organizationId: org, patientId: ZAINAB, labId: labs[0].id, dentistId: OWNER.id, work: L('تاج زيركون', 'Zirconia crown'), teeth: '36', shade: 'A2', material: L('زيركون', 'Zirconia'),
      status: 'received', cost: 60000, sentAt: new Date(dayAt(8, 18)), dueAt: new Date(dayAt(1, 12)), receivedAt: new Date(dayAt(1, 13)), createdBy: userId },
    { id: newId(), organizationId: org, patientId: HASSAN, labId: labs[1].id, dentistId: OWNER.id, work: L('طقم جزئي', 'Partial denture'), teeth: '35-37, 45-46', shade: 'A3', material: L('أكريلك', 'Acrylic'),
      status: 'in_progress', cost: 90000, sentAt: new Date(dayAt(9, 17)), dueAt: new Date(dayAt(2, 12)), createdBy: userId },
  ];
  labs[0].balance = 60000;
  const labLedger = [{ id: newId(), organizationId: org, supplierId: labs[0].id, at: new Date(dayAt(1, 13)), kind: 'purchase', amount: 60000, balance: 60000, note: `${labOrders[0].work} · 36`, userId }];

  const rx = [{ id: newId(), organizationId: org, patientId: MUSTAFA, visitId: mVisit, dentistId: RANA.id, createdBy: userId, createdAt: new Date(dayAt(5, 16) + 40 * MIN),
    items: [{ drug: 'Clindamycin 300 mg', how: L('كبسولة كل 8 ساعات', '1 capsule every 8 hours'), days: 5 }, { drug: 'Ibuprofen 400 mg', how: L('حبة عند الألم بعد الأكل', '1 tablet after food when needed'), days: 3 }],
    note: L('بديل البنسلين (حساسية)', 'Instead of penicillin (allergy)') }];

  // ---- balances, in time order ----
  money.sort((a, b) => a.at - b.at);
  const ledger = money.map((m) => {
    const c = customers.find((x) => x.id === m.customerId)!;
    c.balance += m.amount;
    return { id: newId(), organizationId: org, customerId: c.id, at: new Date(m.at), kind: m.kind, amount: m.amount, balance: c.balance, saleId: m.saleId ?? null, method: m.kind === 'payment' ? 'cash' : null, shiftId: m.shiftId ?? null, userId };
  });

  await insertAll(tx, [
    ...first,
    [dentSettings, [{ organizationId: org, usdRate: RATE, slotMinutes: 15, hours: Object.fromEntries(Object.entries(DEFAULT_HOURS).map(([k, v]) => [k, v && ['09:00', '22:00']])), recallMonths: 6,
      rxHeader: L(`${DEMO_CLINIC.ar.owner}\nاختصاص تعويضات الأسنان — عضو نقابة أطباء الأسنان العراقية\nبغداد، المنصور · 0770 123 4567`, `${DEMO_CLINIC.en.owner}\nProsthodontist — Iraqi Dental Association\nAl-Mansour, Baghdad · 0770 123 4567`) }]],
    [dentChair, chairs], [dentDentist, dentists], [dentProcedure, procs], [sysSupplier, labs],
    [sysCustomer, customers], [dentPatient, patients],
    [sysShift, [{ id: shiftId, organizationId: org, openedAt: new Date(shiftOpen), openedBy: userId, openingCash: 50000 }]],
    [sysSale, sales], [sysSaleLine, lines], [sysLedger, ledger],
    [dentAppointment, appts], [dentPlan, plans], [dentPlanItem, planItems], [dentVisit, visits], [dentVisitItem, vItems], [dentFinding, findings],
    [dentInstallment, installments], [dentLabOrder, labOrders], [sysSupplierLedger, labLedger], [dentRx, rx],
    [sysSequence, [{ organizationId: org, name: 'sale', value: saleNo }, { organizationId: org, name: 'patient', value: customers.length }]],
  ]);
  return { patients: customers.length, appointments: appts.length };
}
