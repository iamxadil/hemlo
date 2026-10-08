// Read a page of a gym's register (the notebook at the desk) from a photo: who each member is, their phone, the membership
// they're on and when it ends, and what they still owe. Nothing is saved here: the desk checks the rows, then they go
// through the ordinary member import (which matches people already in the gym and never adds a membership twice).
// Every value the model gives is checked again here, and anything doubtful is flagged for the person to look at.
import type { Engine, JsonSchema } from './engine';
import { likeness, norm } from './invoice';

export type ReadRow = { name: string; phone: string; plan: string; planIndex: number; startsOn: string; endsOn: string; paid: number; owes: number; notes: string };
export type GymPlanLite = { id: string; name: string; duration: number; unit: string };
export type Check = 'name' | 'phone' | 'plan' | 'date';
export type RegisterRow = { name: string; phone: string; plan: string; planId: string | null; startsOn: string; endsOn: string; balance: number; notes: string; check: Check[] };

export const REGISTER_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['rows'],
  properties: {
    rows: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['name', 'phone', 'plan', 'planIndex', 'startsOn', 'endsOn', 'paid', 'owes', 'notes'],
      properties: { name: { type: 'string' }, phone: { type: 'string' }, plan: { type: 'string' }, planIndex: { type: 'integer' }, startsOn: { type: 'string' }, endsOn: { type: 'string' },
        paid: { type: 'number' }, owes: { type: 'number' }, notes: { type: 'string' } },
    } },
  },
};

const SYSTEM = `You read a page of a gym's member register in Iraq: a notebook or printed sheet, usually handwritten in Arabic (often Ruqaa), sometimes English or Kurdish.
One row in "rows" for each member on the page. Rules:
- Copy each name exactly as written. Skip column headings, totals, and rows that are crossed out.
- "phone": the member's mobile, digits only. Convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to 0-9. Iraqi mobiles look like 07XXXXXXXXX (11 digits). "" if not written.
- "plan": the membership as written (شهر، شهرين، ٣ أشهر، سنة، ١٢ زيارة، كلاسات، تدريب شخصي…). "planIndex": the number of the matching membership from the gym's list (by meaning: "شهر" is "One month"), or -1 if none matches. Never guess.
- Dates as YYYY-MM-DD. Registers often write day/month or day/month/year (12/10 is 12 October). When the year is missing, use the year that puts the date closest to today. "startsOn": when it started; "endsOn": when it ends (ينتهي، الانتهاء، لغاية). "" if not written.
- "owes": what the member still owes (الباقي، المتبقي، دين، باقي عليه), 0 if nothing. "paid": what they paid (المدفوع، الواصل), 0 if not written. Plain numbers, no separators; "25 الف" is 25000.
- "notes": anything else short on the row (a phone note, "مجمد", a health note), "" if none.
- Never invent a person, a number or a date: leave it empty instead.
Return only the JSON.`;

export function registerPrompt(plans: GymPlanLite[], day: string) {
  const list = plans.slice(0, 60).map((p, i) => `${i}: ${p.name}`).join('\n');
  return `Today is ${day}.\nThe gym's memberships:\n${list || '(none yet)'}\n\nRead this page of the register.`;
}

export async function readRegister(engine: Engine, image: string, plans: GymPlanLite[], day: string) {
  return engine.json<{ rows: ReadRow[] }>({ system: SYSTEM, text: registerPrompt(plans, day), image, schema: REGISTER_SCHEMA, maxTokens: 3000 });
}

// ---------- checking what the model read ----------
const latin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
/** An Iraqi mobile as the desk writes it (07…), or what was read if it isn't one (flagged). */
export function phoneFrom(v: unknown): { phone: string; ok: boolean } {
  const d = latin(String(v ?? '')).replace(/\D/g, '');
  if (!d) return { phone: '', ok: true };
  const local = d.startsWith('9647') && d.length === 13 ? `0${d.slice(3)}` : d.startsWith('7') && d.length === 10 ? `0${d}` : d;
  return { phone: local, ok: /^07[3-9]\d{8}$/.test(local) };
}
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
function addMonths(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1)), last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
const endOf = (start: string, p: GymPlanLite) => addDays(p.unit === 'day' ? addDays(start, p.duration) : addMonths(start, p.duration), -1);

/** The model's reading → rows the desk can check: phones in the local form, plans matched to the gym's, dates sane. */
export function toRows(read: { rows?: ReadRow[] }, plans: GymPlanLite[], day: string): RegisterRow[] {
  const out: RegisterRow[] = [];
  for (const x of read.rows ?? []) {
    const name = String(x?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name || /^[\d\s\-.,:]+$/.test(name)) continue;
    const check: Check[] = [];
    if (name.length < 3) check.push('name');
    const { phone, ok } = phoneFrom(x.phone);
    if (!ok) check.push('phone');
    // the membership: the model's pick if the names agree enough, else our own best match, else as written
    const written = String(x.plan ?? '').trim().slice(0, 80);
    let plan: GymPlanLite | undefined = Number.isInteger(x.planIndex) && x.planIndex >= 0 ? plans[x.planIndex] : undefined;
    if (!plan && written) { let best = 0; for (const p of plans) { const k = likeness(written, p.name); if (k > best) { best = k; plan = p; } } if (best < 0.5) plan = undefined; }
    if (written && !plan) check.push('plan');
    // dates: real days, within a sensible distance of today; the end worked out from the start and the plan when missing
    let startsOn = isDay(String(x.startsOn ?? '')) ? String(x.startsOn) : '';
    let endsOn = isDay(String(x.endsOn ?? '')) ? String(x.endsOn) : '';
    if (!endsOn && startsOn && plan) endsOn = endOf(startsOn, plan);
    const far = (s: string) => !!s && (s < addDays(day, -400) || s > addDays(day, 400));
    if (far(startsOn) || far(endsOn) || (startsOn && endsOn && startsOn > endsOn)) { check.push('date'); if (startsOn && endsOn && startsOn > endsOn) startsOn = ''; }
    if ((written || plan) && !endsOn) check.push('date');
    const owes = Math.max(0, Math.round(Number(latin(String(x.owes ?? 0)).replace(/[^\d.]/g, '')) || 0));
    out.push({ name, phone, plan: plan?.name ?? written, planId: plan?.id ?? null, startsOn, endsOn, balance: Math.min(owes, 100_000_000), notes: String(x.notes ?? '').trim().slice(0, 200), check });
  }
  return out.slice(0, 80);
}
export { norm };

// ---------- the ready-made sample (the demo's "try a sample page") ----------
// A register page as a desk writes it (Arabic names, day/month dates, the membership in a word or two), always dated
// around today; the app draws it as the "photo", and these are the rows it reads to. Prepared, so it costs nothing.
// [name, phone as written, membership as written, plan index (routes/gym/setup.ts PLANS), started (days from today), owes, note]
const SAMPLE: [string, string, string, number, number, number, string][] = [
  ['كرار حسين', '07712345601', 'شهر', 0, -12, 0, ''],
  ['زينب عباس', '٠٧٨٠١٢٣٤٥٠٢', '٣ أشهر', 1, -40, 20000, ''],
  ['مصطفى جاسم', '07501234503', 'شهر', 0, -27, 0, ''],
  ['نور الهدى', '٠٧٧١١٢٣٤٥٠٤', 'كلاسات', 7, -5, 0, 'زومبا'],
  ['حيدر علي', '0790123450', 'شهر', 0, -31, 10000, ''],
  ['سارة محمد', '07821234506', '٦ أشهر', 2, -60, 0, 'سافرت أسبوعين'],
  ['علي كريم', '07731234507', '١٢ زيارة', 4, -9, 0, ''],
];
const arDigits = (s: string) => s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
/** The page as written, for the app to draw. */
export const samplePage = (day: string) => SAMPLE.map(([name, phone, plan, , start, owes, note]) => {
  const d = addDays(day, start);
  return { name, phone, plan, from: arDigits(`${Number(d.slice(8))}/${Number(d.slice(5, 7))}`), owes: owes ? arDigits(String(owes / 1000)) + ' الف' : '', note };
});
export function sampleRows(plans: GymPlanLite[], day: string): RegisterRow[] {
  const read: ReadRow[] = SAMPLE.map(([name, phone, plan, ix, start, owes, notes]) => ({
    name, phone, plan, planIndex: ix < plans.length ? ix : -1, startsOn: addDays(day, start), endsOn: '', paid: 0, owes, notes,
  }));
  return toRows({ rows: read }, plans, day);
}
