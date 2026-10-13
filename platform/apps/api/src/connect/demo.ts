// The public Connect demo on hemlohq.com: a visitor writes as a customer of the sample agency (the same homes as the
// sample website) and the real assistant answers, with the same rules and the same guard against invented numbers.
// Nothing is stored and nothing goes to WhatsApp. Kept cheap: a few replies per visitor an hour, a daily cap for all.
import { sql } from 'drizzle-orm';
import { newId, hmac } from '@hemlo/core';
import { engineFor } from '../ai/router';
import { overBudget, DEFAULT_BUDGET_USD } from '../ai/meter';
import { sampleListings } from '../routes/website/sample';
import { HttpError } from '../principal';
import { ASSISTANT, REPLY_SCHEMA, inventedNumbers, type Reply } from './core';
import type { Deps } from '../types';

const PER_IP_HOUR = 20, PER_DAY = 300;
export const DEMO_ORIGIN = 'https://business.hemlohq.com/s/sample';
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** One counter in the shared rate_limit table: true while under the limit for this window. */
async function under(d: Deps, key: string, windowMs: number, limit: number) {
  const now = Date.now();
  const r = rowsOf(await d.db.execute(sql`insert into rate_limit (id, key, count, last_request) values (${newId()}, ${key}, 1, ${now})
    on conflict (key) do update set count = case when rate_limit.last_request < ${now - windowMs} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${now - windowMs} then ${now} else rate_limit.last_request end returning count`));
  return Number(r[0]?.count ?? 0) <= limit;
}

export type DemoTurn = { from: 'customer' | 'agency'; text: string };
export async function demoReply(d: Deps, ip: string, lang: 'ar' | 'en', turns: DemoTurn[]) {
  const chat = turns.filter((t) => (t.from === 'customer' || t.from === 'agency') && typeof t.text === 'string' && t.text.trim()).slice(-10)
    .map((t) => ({ from: t.from, text: t.text.trim().slice(0, 500) }));
  if (!chat.length || chat[chat.length - 1].from !== 'customer') throw new HttpError(400, 'BAD_TEXT');
  if (!(await under(d, `connect-demo-${await hmac(d.env.AUTH_SECRET, `ip:${ip}`)}`, 3600_000, PER_IP_HOUR))) throw new HttpError(429, 'TOO_MANY');
  if (!(await under(d, 'connect-demo-day', 86400_000, PER_DAY))) throw new HttpError(429, 'DEMO_BUSY');
  const engine = await engineFor(d, 'realestate', 'connect_reply');
  if (!engine) throw new HttpError(503, 'AI_UNAVAILABLE');
  if (engine.paid && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) throw new HttpError(503, 'AI_BUSY');

  const photos = d.env.SYSTEM_URL ?? 'https://system.hemlohq.com';
  const list = sampleListings(lang, photos, DEMO_ORIGIN, { limit: 14 }).map((l, i) => ({ ...l, ref: 1001 + i }));
  const facts = list.map((p) => `#${p.ref} | ${p.type} for ${p.purpose} | ${[p.area, p.city].filter(Boolean).join(', ')} | ${p.bedrooms ?? '-'} bedrooms | ${p.size ?? '-'} m² | ${p.price}`).join('\n');
  const talk = chat.map((m) => `${m.from === 'customer' ? 'Customer' : 'Agency'}: ${m.text}`).join('\n');
  const agency = lang === 'ar' ? 'دار النخيل للعقارات' : 'Nakheel Real Estate';
  let out: Reply;
  try {
    out = (await engine.json<Reply>({ system: ASSISTANT(agency, { hours: lang === 'ar' ? 'السبت إلى الخميس، ٩ صباحاً إلى ٧ مساءً' : 'Saturday to Thursday, 9 am to 7 pm' }),
      text: `Listings available now (the only ones you may mention):\n${facts}\n\nThe conversation so far:\n${talk}\n\nWrite the agency's next reply.`, schema: REPLY_SCHEMA, maxTokens: 600 })).data;
  } catch { throw new HttpError(503, 'AI_FAILED'); }
  const reply = String(out?.reply ?? '').trim().slice(0, 1000);
  const ar = /[؀-ۿ]/.test(chat[chat.length - 1].text);
  const invented = inventedNumbers(reply, `${facts}\n${talk}`).length > 0;
  const safe = ar ? 'شكراً لرسالتك. سيرد عليك أحد زملائنا بعد قليل.' : 'Thank you for your message. A colleague will reply shortly.';
  const cards = (Array.isArray(out?.refs) ? out.refs : []).map(Number).map((r) => list.find((p) => p.ref === r)).filter(Boolean).slice(0, 3)
    .map((p) => ({ title: p!.title, price: p!.price, href: p!.href, image: p!.cover, area: [p!.area, p!.city].filter(Boolean).join('، ') }));
  const viewing = !invented && Number(out?.viewingRef) > 0 && out?.viewingWhen ? { when: String(out.viewingWhen).slice(0, 80), title: list.find((p) => p.ref === Number(out.viewingRef))?.title ?? null } : null;
  return { reply: invented || !reply ? safe : reply, cards: invented ? [] : cards, handoff: !!out?.handoff || invented || !!viewing, viewing };
}
