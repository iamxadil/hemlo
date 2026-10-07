// The demo gym: a believable Baghdad gym with a month of life. Members on every kind of plan (some ending this week,
// some lapsed, one paused, a few owing), the door's history hour by hour, people training right now, coaches with
// personal-training clients, a ladies' Zumba class, a small shop of water and protein, and body measurements that show
// progress. Deterministic, written in one statement like the demo shop; times are around "now" so it always looks alive.
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import {
  sysCustomer, sysSale, sysSaleLine, sysLedger, sysSequence, sysShift, sysProduct, sysExpense, sysSettings,
  gymSettings, gymPlan, gymTrainer, gymMember, gymMembership, gymCheckin, gymClass, gymBooking, gymMeasure, type GymHours,
} from '@hemlo/db/schema';
import { insertAll, rng, type Batch } from './demo-data';
import { PLANS } from './routes/gym/setup';
import { today, addDays, endOf, newCardCode, alertsFrom } from './routes/gym/common';

type Lang = 'ar' | 'en';
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const midnight = (daysAgo: number) => { const n = new Date(Date.now() + 3 * HOUR); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 3 * HOUR - daysAgo * DAY; };
const at = (daysAgo: number, hour: number, minute = 0) => midnight(daysAgo) + hour * HOUR + minute * MIN;
const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export const DEMO_GYM = { ar: { name: 'نادي تايتن للياقة', owner: 'الكابتن مصطفى عادل' }, en: { name: 'Titan Fitness Club', owner: 'Coach Mustafa Adel' } };

// [ar, en, gender, age, goal, plan index (PLANS), days until it ends (negative: ended), extra]
type Who = [string, string, 'm' | 'f', number, string, number, number, { owe?: number; frozen?: boolean; pt?: 'haider' | 'noor'; hour?: number; health?: Record<string, unknown>; long?: boolean; visitsUsed?: number }?];
const PEOPLE: Who[] = [
  ['علي حسين', 'Ali Hussein', 'm', 27, 'build', 1, 41, { pt: 'haider', hour: 19, long: true }],
  ['حيدر كريم', 'Haidar Kareem', 'm', 31, 'strength', 3, 210, { hour: 20, long: true }],
  ['زينب علي', 'Zainab Ali', 'f', 24, 'lose', 7, 12, { hour: 10, pt: 'noor' }],
  ['مصطفى جاسم', 'Mustafa Jasim', 'm', 22, 'build', 0, 2, { hour: 18 }],
  ['سارة أحمد', 'Sara Ahmed', 'f', 29, 'fit', 4, 9, { hour: 11, visitsUsed: 9 }],
  ['محمد عباس', 'Mohammed Abbas', 'm', 35, 'lose', 0, -3, { hour: 21, health: { hypertension: true } }],
  ['يوسف عمار', 'Yousif Ammar', 'm', 19, 'build', 0, 17, { hour: 17 }],
  ['نور الهدى', 'Noor Al-Huda', 'f', 33, 'lose', 2, 96, { hour: 10, long: true }],
  ['كرار حميد', 'Karrar Hameed', 'm', 26, 'strength', 0, 1, { hour: 20, owe: 20000 }],
  ['حسن فلاح', 'Hassan Falah', 'm', 41, 'rehab', 6, 30, { pt: 'haider', hour: 16, health: { back: true, notes: 'Lower-back disc, no heavy deadlifts' } }],
  ['رقية سلام', 'Ruqaya Salam', 'f', 21, 'fit', 7, -6, { hour: 11 }],
  ['عمر صباح', 'Omar Sabah', 'm', 30, 'build', 1, 63, { hour: 22, long: true }],
  ['أحمد رعد', 'Ahmed Raad', 'm', 24, 'sport', 0, 22, { hour: 19 }],
  ['فاطمة كاظم', 'Fatima Kadhim', 'f', 38, 'lose', 0, 4, { hour: 10, health: { diabetes: true } }],
  ['عباس ناصر', 'Abbas Nasser', 'm', 28, 'build', 0, -11, { hour: 21 }],
  ['ليث مهدي', 'Laith Mahdi', 'm', 33, 'strength', 2, 120, { hour: 6, long: true }],
  ['مريم صادق', 'Maryam Sadiq', 'f', 26, 'fit', 0, 15, { hour: 17, frozen: true }],
  ['سجاد كامل', 'Sajjad Kamel', 'm', 20, 'build', 0, 26, { hour: 18 }],
  ['آيات حسن', 'Ayat Hassan', 'f', 31, 'lose', 7, 19, { hour: 10 }],
  ['منتظر علي', 'Muntadhar Ali', 'm', 25, 'sport', 4, 5, { hour: 20, visitsUsed: 10 }],
  ['علي جبار', 'Ali Jabbar', 'm', 45, 'rehab', 0, 11, { hour: 7, health: { heart: true, notes: 'Cardiac rehab: keep heart rate under 140' } }],
  ['زهراء محمد', 'Zahraa Mohammed', 'f', 23, 'fit', 1, 33, { hour: 11 }],
  ['حسين عادل', 'Hussein Adel', 'm', 29, 'build', 0, 0, { hour: 21 }],
  ['بنين قاسم', 'Baneen Qasim', 'f', 27, 'lose', 6, 40, { pt: 'noor', hour: 16 }],
  ['ذو الفقار سعد', 'Thulfiqar Saad', 'm', 32, 'strength', 1, 8, { hour: 22, owe: 30000 }],
  ['همام طارق', 'Hammam Tariq', 'm', 18, 'build', 0, -2, { hour: 17 }],
  ['دعاء رحيم', 'Duaa Raheem', 'f', 35, 'fit', 7, 27, { hour: 10 }],
  ['مرتضى هادي', 'Murtadha Hadi', 'm', 27, 'lose', 0, 13, { hour: 19, health: { knee: true } }],
  ['جعفر صالح', 'Jaafar Salih', 'm', 39, 'fit', 2, 150, { hour: 6, long: true }],
  ['تبارك يوسف', 'Tabarak Yousif', 'f', 20, 'fit', 0, -9, { hour: 11 }],
  ['أمير قحطان', 'Ameer Qahtan', 'm', 23, 'build', 0, 20, { hour: 20 }],
  ['ضياء حمزة', 'Diyaa Hamza', 'm', 34, 'strength', 1, 3, { hour: 18 }],
  ['شهد نبيل', 'Shahad Nabeel', 'f', 25, 'lose', 0, 6, { hour: 16 }],
  ['باقر مجيد', 'Baqir Majeed', 'm', 21, 'sport', 0, 24, { hour: 19, owe: 15000 }],
  ['رسل عدنان', 'Rusul Adnan', 'f', 30, 'fit', 7, -4, { hour: 10 }],
  ['سيف الدين', 'Saif Al-Din', 'm', 37, 'lose', 1, 52, { hour: 21, health: { asthma: true } }],
  ['حوراء جواد', 'Hawraa Jawad', 'f', 28, 'lose', 0, 18, { hour: 11 }],
  ['مهند فاضل', 'Muhannad Fadhil', 'm', 26, 'build', 0, 9, { hour: 20 }],
  ['أنور خليل', 'Anwar Khalil', 'm', 43, 'fit', 3, 300, { hour: 7, long: true }],
  ['هبة سمير', 'Hiba Sameer', 'f', 32, 'fit', 0, 28, { hour: 17 }],
  ['عقيل حامد', 'Aqeel Hamid', 'm', 24, 'build', 0, 16, { hour: 22 }],
  ['ميس فراس', 'Mais Firas', 'f', 19, 'fit', 5, -1, { hour: 16 }],
];

// the gym's little shop: [ar, en, price, cost, stock, low]
const SHOP: [string, string, number, number, number, number | null][] = [
  ['ماء 500 مل', 'Water 500ml', 500, 250, 140, 24], ['مشروب طاقة', 'Energy drink', 2000, 1400, 36, 12], ['جاتوريد', 'Gatorade', 1500, 1000, 40, 12],
  ['لوح بروتين', 'Protein bar', 2500, 1600, 48, 12], ['سكوب واي بروتين', 'Whey protein scoop', 3000, 1500, 200, null], ['واي بروتين 2 باوند', 'Whey protein 2 lb', 75000, 58000, 6, 2],
  ['كرياتين 300غ', 'Creatine 300g', 45000, 33000, 5, 2], ['شيكر', 'Shaker bottle', 7000, 3500, 14, 4], ['منشفة رياضية', 'Gym towel', 5000, 2500, 20, 5],
];

export async function seedDemoGym(tx: Database, org: string, userId: string, memberId: string, lang: Lang, first: Batch[] = []) {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const r = rng(20261005);
  const now = Date.now(), day = today();
  const nowHour = new Date(now + 3 * HOUR).getUTCHours() + new Date(now).getUTCMinutes() / 60;

  // ---- the gym ----
  const ladies = [{ from: '06:00', to: '09:00', who: 'all' as const }, { from: '09:00', to: '12:00', who: 'f' as const }, { from: '12:00', to: '23:59', who: 'all' as const }];
  const hours: GymHours = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, k === '5' ? [{ from: '14:00', to: '23:00', who: 'all' }] : ['1', '3', '6'].includes(k) ? ladies : [{ from: '06:00', to: '23:59', who: 'all' }]]));
  const plans = PLANS.map(([ar, en, category, duration, unit, visits, price, freezeDays], i) => ({ id: newId(), organizationId: org, name: L(ar, en), category, duration, unit, visits, price, freezeDays, gender: 'all', sort: i }));
  const coach = (name: [string, string], gender: string, specialty: [string, string], color: string, ptShare: number, mid: string | null = null) =>
    ({ id: newId(), organizationId: org, memberId: mid, name: L(...name), gender, specialty: L(...specialty), color, ptShare, phone: `+96477012${String(Math.floor(r() * 90000) + 10000)}`, active: true });
  const trainers = {
    mustafa: coach([DEMO_GYM.ar.owner, DEMO_GYM.en.owner], 'm', ['مدير النادي', 'Head coach'], '#0E1420', 0, memberId),
    haider: coach(['الكابتن حيدر سلمان', 'Coach Haider Salman'], 'm', ['قوة وبناء أجسام', 'Strength & bodybuilding'], '#E4572E', 40),
    noor: coach(['الكابتن نور الزهراء', 'Coach Noor Al-Zahraa'], 'f', ['لياقة وزومبا', 'Fitness & Zumba'], '#C2410C', 50),
    yaser: coach(['الكابتن ياسر خالد', 'Coach Yaser Khalid'], 'm', ['كيك بوكسينغ', 'Kickboxing'], '#1F7A4D', 40),
  };
  const K = (name: [string, string], t: typeof trainers.noor, days: number[], startsAt: string, minutes: number, capacity: number, gender: string, color: string) =>
    days.map((dd) => ({ id: newId(), organizationId: org, name: L(...name), trainerId: t.id, day: dd, startsAt, minutes, capacity, gender, color, active: true }));
  const classes = [
    ...K(['زومبا للسيدات', 'Ladies\' Zumba'], trainers.noor, [1, 3, 6], '10:00', 50, 20, 'f', '#C2410C'),
    ...K(['يوغا للسيدات', 'Ladies\' Yoga'], trainers.noor, [4], '11:00', 60, 15, 'f', '#9A6B2F'),
    ...K(['كيك بوكسينغ', 'Kickboxing'], trainers.yaser, [0, 2, 4], '19:00', 60, 16, 'm', '#1F7A4D'),
    ...K(['كروس فت', 'CrossFit'], trainers.haider, [1, 3, 6], '20:00', 50, 12, 'all', '#E4572E'),
    ...K(['سبينينغ', 'Spinning'], trainers.haider, [0, 2], '18:00', 45, 10, 'all', '#2F5DA8'),
  ];

  // ---- members ----
  const thisYear = new Date().getUTCFullYear();
  const customers: any[] = [], members: any[] = [], memberships: any[] = [], checkins: any[] = [], sales: any[] = [], lines: any[] = [], money: { customerId: string; at: number; amount: number; kind: string; saleId?: string }[] = [];
  let saleNo = 0;
  const shiftId = newId(), shiftOpen = at(0, 7);
  const sale = (customerId: string | null, when: number, items: { name: string; price: number; qty?: number; cost?: number; productId?: string | null }[], paid: 'all' | number, note: string | null, method = 'cash') => {
    const total = items.reduce((s, x) => s + x.price * (x.qty ?? 1), 0), p = paid === 'all' ? total : Math.min(paid, total), due = total - p;
    const id = newId();
    sales.push({ id, organizationId: org, number: ++saleNo, createdAt: new Date(when), userId, customerId, subtotal: total, discount: 0, total, paid: p, due,
      method: due === 0 ? method : p > 0 ? 'mixed' : 'credit', cost: items.reduce((s, x) => s + (x.cost ?? 0) * (x.qty ?? 1), 0), note, shiftId: when >= shiftOpen && p > 0 ? shiftId : null });
    for (const x of items) lines.push({ id: newId(), organizationId: org, saleId: id, productId: x.productId ?? null, name: x.name, qty: x.qty ?? 1, price: x.price, total: x.price * (x.qty ?? 1), cost: x.cost ?? 0 });
    if (due > 0 && customerId) money.push({ customerId, at: when, amount: due, kind: 'sale', saleId: id });
    return id;
  };
  const sellMs = (cust: string, plan: typeof plans[number], startsOn: string, opts: { owe?: number; trainerId?: string | null; visitsUsed?: number; frozen?: boolean } = {}) => {
    const endsOn = endOf(startsOn, plan.duration, plan.unit);
    const soldAt = Math.min(now - 30 * MIN, Date.parse(`${startsOn}T00:00:00+03:00`) + (16 + Math.floor(r() * 5)) * HOUR);
    const saleId = sale(cust, soldAt, [{ name: `${plan.name} · ${startsOn} → ${endsOn}`, price: plan.price }], plan.price - (opts.owe ?? 0), 'gym');
    const ms = { id: newId(), organizationId: org, memberId: cust, planId: plan.id, name: plan.name, category: plan.category, startsOn, endsOn, visits: plan.visits, visitsUsed: opts.visitsUsed ?? 0,
      price: plan.price, discount: 0, saleId, trainerId: opts.trainerId ?? null, status: opts.frozen ? 'frozen' : 'active', freezeDays: plan.freezeDays, frozenFrom: opts.frozen ? addDays(day, -4) : null,
      frozenDays: 0, createdBy: userId, createdAt: new Date(soldAt) };
    memberships.push(ms);
    return ms;
  };

  PEOPLE.forEach(([ar, en, gender, age, goal, planIx, endIn, x = {}], i) => {
    const id = newId(), plan = plans[planIx];
    const joined = x.long ? 120 + Math.floor(r() * 200) : 35 + Math.floor(r() * 60);
    customers.push({ id, organizationId: org, name: L(ar, en), phone: `+96477${String(10000000 + Math.floor(r() * 89999999))}`, balance: 0, createdAt: new Date(at(joined, 17)), updatedAt: new Date() });
    const health = x.health ?? {};
    members.push({ customerId: id, organizationId: org, memberNo: i + 1, cardCode: newCardCode(), gender, birthDate: `${thisYear - age}-${String(1 + ((i * 5) % 12)).padStart(2, '0')}-${String(2 + ((i * 7) % 26)).padStart(2, '0')}`,
      goal, health, alerts: alertsFrom(health as any), trainerId: x.pt ? trainers[x.pt].id : null, referral: [L('إنستغرام', 'Instagram'), L('صديق', 'A friend'), L('تيك توك', 'TikTok'), L('مرّ من الشارع', 'Walked in')][i % 4],
      emergencyName: i % 3 === 0 ? L('الوالد', 'Father') : null, createdAt: new Date(at(joined, 17)), updatedAt: new Date() });
    // the current membership, and the one before it (most people renew)
    const endsOn = addDays(day, endIn);
    const startsOn = plan.unit === 'day' ? endsOn : addDays(endOf(endsOn, -plan.duration, plan.unit), 2); // the start that makes it end on endsOn
    const cur = sellMs(id, plan, startsOn, { owe: x.owe, visitsUsed: x.visitsUsed ?? (plan.visits ? Math.min(plan.visits - 1, Math.floor(r() * plan.visits)) : 0), frozen: x.frozen });
    const before = plans[planIx === 4 || planIx === 5 ? 0 : planIx];
    const prevStart = addDays(startsOn, -1);
    if (r() < 0.75 && before.unit === 'month') sellMs(id, before, addDays(endOf(prevStart, -before.duration, before.unit), 2));
    if (x.pt) sellMs(id, plans[6], addDays(day, -20 - Math.floor(r() * 10)), { trainerId: trainers[x.pt].id, visitsUsed: 0 });
    if (gender === 'f' && planIx !== 7 && r() < 0.4) sellMs(id, plans[7], addDays(day, -Math.floor(r() * 20)));
    // ---- the door: the last 30 days, at their usual hour ----
    const hour = x.hour ?? 18, perWeek = 3 + Math.floor(r() * 3);
    const mine = memberships.filter((m) => m.memberId === id && ['gym', 'class'].includes(m.category));
    for (let back = 30; back >= 0; back--) {
      const date = addDays(day, -back);
      const ms = mine.find((m) => m.startsOn <= date && m.endsOn >= date);
      const dow = dowOf(date);
      if (dow === 5 && r() < 0.7) continue; // Fridays are quiet
      const when = at(back, hour, Math.floor(r() * 50)) + (r() < 0.3 ? HOUR : 0);
      if (when > now - 5 * MIN) continue;
      if (back === 0 && when < now - 80 * MIN && r() < 0.2) continue;
      if (!ms) { if (back <= 3 && endIn < 0 && endIn >= -6 && r() < 0.35) checkins.push({ id: newId(), organizationId: org, memberId: id, membershipId: cur.id, at: new Date(when), via: 'desk', result: 'denied', reason: 'expired', counted: false, userId }); continue; }
      if (ms.status === 'frozen' && date >= ms.frozenFrom) continue;
      if (r() > perWeek / 7 && back !== 0) continue;
      checkins.push({ id: newId(), organizationId: org, memberId: id, membershipId: ms.id, at: new Date(when), via: r() < 0.15 ? 'door' : 'desk', result: 'ok', counted: ms.visits != null, userId });
      members[i].lastVisitAt = new Date(when);
    }
    for (const m of memberships.filter((mm) => mm.memberId === id && mm.visits != null && mm.category !== 'pt')) m.visitsUsed = Math.max(m.visitsUsed, checkins.filter((c) => c.membershipId === m.id).length);
  });

  // whatever the hour a visitor opens the demo, a few people came in within the last hour (a demo should feel alive)
  const recent = members.filter((m) => !checkins.some((c) => c.memberId === m.customerId && +c.at > now - 70 * MIN && c.result !== 'denied'));
  for (let k = 0; k < 7 && k < recent.length; k++) {
    const m = recent[(k * 5 + 3) % recent.length];
    const ms = memberships.find((x) => x.memberId === m.customerId && ['gym', 'class'].includes(x.category) && x.status === 'active' && x.startsOn <= day && x.endsOn >= day && (x.visits == null || x.visitsUsed < x.visits));
    if (!ms || checkins.some((c) => c.memberId === m.customerId && +c.at > now - 70 * MIN)) continue;
    const when = now - (6 + k * 9) * MIN;
    checkins.push({ id: newId(), organizationId: org, memberId: m.customerId, membershipId: ms.id, at: new Date(when), via: k % 3 === 0 ? 'door' : 'desk', result: 'ok', counted: ms.visits != null, userId });
    if (ms.visits != null) ms.visitsUsed++;
    m.lastVisitAt = new Date(when);
  }

  // personal training: two sessions a week with their coach
  for (const m of memberships.filter((x) => x.category === 'pt')) {
    let used = 0;
    for (let back = 18; back >= 0; back -= 3 + Math.floor(r() * 2)) {
      const when = at(back, 16 + Math.floor(r() * 4), 15);
      if (when > now - 30 * MIN || addDays(day, -back) < m.startsOn) continue;
      checkins.push({ id: newId(), organizationId: org, memberId: m.memberId, membershipId: m.id, at: new Date(when), via: 'pt', result: 'ok', counted: true, trainerId: m.trainerId, userId });
      used++;
    }
    m.visitsUsed = used;
  }

  const ids = customers.map((c) => c.id);

  // ---- body measurements: four months of progress for some ----
  const measures: any[] = [];
  const progress = (idx: number, w0: number, w1: number, f0: number, f1: number, waist0: number, waist1: number) => {
    for (let k = 0; k < 5; k++) {
      const p = k / 4;
      measures.push({ id: newId(), organizationId: org, memberId: ids[idx], at: new Date(at(110 - k * 26, 18)), weight: Math.round((w0 + (w1 - w0) * p) * 10) / 10, height: idx === 2 ? 163 : 178,
        bodyFat: Math.round((f0 + (f1 - f0) * p) * 10) / 10, waist: Math.round(waist0 + (waist1 - waist0) * p), muscle: Math.round((w0 * (1 - f0 / 100) * 0.55 + p * 2.4) * 10) / 10, userId });
    }
  };
  progress(0, 74, 81.5, 15, 13, 80, 81);   // Ali: building
  progress(2, 78, 69.4, 34, 27, 92, 81);   // Zainab: losing
  progress(5, 104, 96.2, 31, 26, 108, 99); // Mohammed
  progress(9, 92, 88, 27, 24, 99, 95);     // Hassan: rehab

  // ---- bookings: the coming week, and who came last week ----
  const bookings: any[] = [];
  const women = members.filter((m) => m.gender === 'f').map((m) => m.customerId), men = members.filter((m) => m.gender === 'm').map((m) => m.customerId);
  for (let off = -6; off <= 6; off++) {
    const date = addDays(day, off), dow = dowOf(date);
    for (const k of classes.filter((c) => c.day === dow)) {
      const pool = k.gender === 'f' ? women : k.gender === 'm' ? men : ids;
      const n = Math.min(k.capacity, Math.floor(k.capacity * (0.45 + r() * 0.5)) - (off > 2 ? 4 : 0));
      const seen = new Set<string>();
      for (let j = 0; j < n; j++) {
        const mid = pool[Math.floor(r() * pool.length)];
        if (seen.has(mid)) continue;
        seen.add(mid);
        const past = off < 0 || (off === 0 && Number(k.startsAt.slice(0, 2)) + 1 <= nowHour);
        bookings.push({ id: newId(), organizationId: org, classId: k.id, date, memberId: mid, status: past ? (r() < 0.85 ? 'attended' : 'no_show') : 'booked', createdAt: new Date(at(Math.max(0, -off + 1), 12)) });
      }
    }
  }

  // ---- the shop: a week of water, protein and shakers ----
  const products = SHOP.map(([ar, en, price, cost, stock, low]) => ({ id: newId(), organizationId: org, name: L(ar, en), category: L('المتجر', 'Shop'), unit: 'piece', price, cost, stock, lowStock: low, trackStock: true }));
  for (let back = 6; back >= 0; back--) {
    const count = back === 0 ? Math.max(2, Math.floor((nowHour - 8) / 1.5)) : 9 + Math.floor(r() * 6);
    for (let k = 0; k < count; k++) {
      const when = at(back, 9 + Math.floor(r() * 13), Math.floor(r() * 60));
      if (when > now - 10 * MIN) continue;
      const picks = [products[0], products[0], products[1], products[2], products[3], products[4], products[4], products[7], products[8], products[5], products[6]];
      const p = picks[Math.floor(r() * picks.length)];
      sale(null, when, [{ name: p.name, price: p.price, cost: p.cost!, productId: p.id, qty: p.price < 3000 ? 1 + Math.floor(r() * 2) : 1 }], 'all', null, r() < 0.2 ? 'card' : 'cash');
    }
  }
  // a debt paid off partly
  money.push({ customerId: ids[24], at: at(2, 20), amount: -10000, kind: 'payment' });

  const expenses = [
    { id: newId(), organizationId: org, at: new Date(at(26, 11)), category: 'rent', amount: 3500000, note: L('إيجار القاعة', 'Hall rent'), userId },
    { id: newId(), organizationId: org, at: new Date(at(20, 12)), category: 'generator', amount: 420000, note: L('اشتراك المولدة', 'Generator subscription'), userId },
    { id: newId(), organizationId: org, at: new Date(at(5, 13)), category: 'salaries', amount: 2400000, note: L('رواتب المدربين', 'Coaches\' salaries'), userId },
    { id: newId(), organizationId: org, at: new Date(at(3, 15)), category: 'supplies', amount: 185000, note: L('منظفات ومناشف', 'Cleaning and towels'), userId },
  ];

  // ---- balances, in time order ----
  money.sort((a, b) => a.at - b.at);
  const ledger = money.map((m) => {
    const c = customers.find((x) => x.id === m.customerId)!;
    c.balance += m.amount;
    return { id: newId(), organizationId: org, customerId: c.id, at: new Date(m.at), kind: m.kind, amount: m.amount, balance: c.balance, saleId: m.saleId ?? null, method: m.kind === 'payment' ? 'cash' : null, userId };
  });

  await insertAll(tx, [
    ...first,
    [sysSettings, [{ organizationId: org }]],
    [gymSettings, [{ organizationId: org, hours, reentryMinutes: 180, graceDays: 0, selfCheckin: true,
      reminderText: L('أهلاً {name} 👋 اشتراكك في {gym} ينتهي {date}. جدّد اليوم وحافظ على تقدّمك 💪', 'Hi {name} 👋 your {gym} membership ends {date}. Renew today and keep your progress going 💪') }]],
    [gymPlan, plans], [gymTrainer, Object.values(trainers)], [gymClass, classes],
    [sysCustomer, customers], [gymMember, members],
    [sysShift, [{ id: shiftId, organizationId: org, openedAt: new Date(shiftOpen), openedBy: userId, openingCash: 100000 }]],
    [sysProduct, products], [sysSale, sales], [sysSaleLine, lines], [sysLedger, ledger],
    [gymMembership, memberships], [gymCheckin, checkins], [gymBooking, bookings], [gymMeasure, measures], [sysExpense, expenses],
    [sysSequence, [{ organizationId: org, name: 'sale', value: saleNo }, { organizationId: org, name: 'member', value: customers.length }]],
  ]);
  return { members: customers.length, checkins: checkins.length };
}
