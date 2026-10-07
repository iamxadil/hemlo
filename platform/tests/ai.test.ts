// Hemlo AI, phase 1: reading a supplier invoice into a draft purchase, and asking the shop a question. The AI engine is
// a stand-in here (the real ones are Cloudflare's models or Claude); what's tested is everything around it: matching to
// the shop's products, cartons, the allowance, the owner's switch, the demo sample, and that numbers come from our queries.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, createOrg } from './helpers';
import type { Engine, AskJson } from '../apps/api/src/ai/engine';
import { likeness, norm } from '../apps/api/src/ai/invoice';
import { ALLOWANCE } from '../apps/api/src/ai/meter';

// the stand-in engine: answers invoices with a fixed reading, questions by keyword, and remembers what it was asked
const asked: AskJson[] = [];
let failNext = false;
const fake: Engine = {
  name: 'test',
  async json<T>(req: AskJson) {
    asked.push(req);
    if (failNext) { failNext = false; throw new Error('model down'); }
    const pepsi = req.text.split('\n').find((l) => l.includes('Pepsi'))?.split(':')[0];
    const data = req.image
      ? { supplier: 'جملة بغداد للمواد الغذائية', invoiceNo: 'INV-77', date: '2026-09-30', currency: 'IQD', total: 52000, paid: 20000, lines: [
          { name: 'بيبسي 330 مل كارتون', unit: 'كارتون', qty: 4, unitPrice: 10000, total: 40000, productIndex: Number(pepsi), carton: true },
          { name: 'Rice loose', unit: 'kg', qty: 10, unitPrice: 1200, total: 12000, productIndex: -1, carton: false },
          { name: 'شي غريب', unit: 'قطعة', qty: 1, unitPrice: 0, total: 0, productIndex: -1, carton: false },
        ] }
      : { tool: /دين|owe/.test(req.text) ? 'debtors' : /بعت|sell|sold/.test(req.text) ? 'summary' : 'unknown', period: 'today', name: '' };
    return { data: data as T, model: 'stand-in', inputTokens: 1000, outputTokens: 100, costMicros: 0 };
  },
};
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(400);

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser;
const ids: Record<string, string> = {};

beforeAll(async () => {
  t = await setup({}, fake);
  owner = new Browser(t.app);
  await signInEmail(owner, 'ai-shop@example.com');
  await createOrg(owner, 'Al-Amal Market');
  ids.pepsi = (await owner.post('/v1/sys/products', { name: 'Pepsi 330ml', price: 500, cost: 375, stock: 10, packSize: 24, packPrice: 11000 })).json.product.id;
  ids.rice = (await owner.post('/v1/sys/products', { name: 'Rice (loose)', unit: 'kg', price: 1750, cost: 1400, stock: 50 })).json.product.id;
  ids.supplier = (await owner.post('/v1/sys/suppliers', { name: 'جملة بغداد' })).json.supplier.id;
});

describe('matching words', () => {
  it('Arabic spellings are made comparable, and numbers count', () => {
    expect(norm('أبو علي ٣٣٠')).toBe('ابو علي 330');
    expect(likeness('بيبسي 330 مل', 'بيبسي ٣٣٠ مل')).toBe(1);
    expect(likeness('Pepsi 330ml', 'Pepsi 1L')).toBeLessThan(likeness('Pepsi 330 ml', 'Pepsi 330 ml'));
  });
});

describe('reading a supplier invoice', () => {
  it('a photo becomes a draft: lines matched to the shop’s products, cartons spotted, the supplier found; nothing saved', async () => {
    const before = (await owner.get('/v1/sys/purchases')).json.purchases.length;
    const r = await owner.post('/v1/sys/ai/invoice', { image: PHOTO });
    expect(r.status).toBe(200);
    const d = r.json.draft;
    expect(d.supplier).toEqual({ name: 'جملة بغداد للمواد الغذائية', id: ids.supplier });
    expect(d.reference).toBe('INV-77');
    expect(d.paid).toBe(20000);
    expect(d.lines[0]).toMatchObject({ productId: ids.pepsi, pack: true, qty: 4, unitPrice: 10000 });
    expect(d.lines[1]).toMatchObject({ productId: ids.rice, confidence: 'check' }); // the model passed; our own match, to be checked
    expect(d.lines[2]).toMatchObject({ productId: null, confidence: 'none' });
    expect(r.json).toMatchObject({ used: 1, allowance: ALLOWANCE.free, engine: 'test' });
    // the model was shown the shop's own product list, never another shop's
    expect(asked.at(-1)!.text).toContain('Pepsi 330ml');
    expect((await owner.get('/v1/sys/purchases')).json.purchases.length).toBe(before); // a draft only
  });

  it('a bad photo is refused before any AI is used; a failed AI call is recorded but not counted', async () => {
    expect((await owner.post('/v1/sys/ai/invoice', { image: 'not a photo' })).json.error).toBe('BAD_IMAGE');
    failNext = true;
    expect((await owner.post('/v1/sys/ai/invoice', { image: PHOTO })).json.error).toBe('AI_FAILED');
    expect((await owner.get('/v1/sys/ai')).json.used).toBe(1);
  });

  it('the ready-made sample is instant and free', async () => {
    const r = await owner.post('/v1/sys/ai/invoice', { sample: true });
    expect(r.json.engine).toBe('sample');
    expect(r.json.draft.lines).toHaveLength(4);
    expect(r.json.used).toBe(1);
  });
});

describe('asking the shop', () => {
  it('a preset question is answered from our own numbers, free', async () => {
    await owner.post('/v1/sys/sales', { clientId: 'ai-1', method: 'cash', lines: [{ productId: ids.pepsi, qty: 2 }] });
    const r = await owner.post('/v1/sys/ai/ask', { plan: { tool: 'summary', period: 'today' } });
    expect(r.json.answer).toMatchObject({ tool: 'summary', data: { receipts: 1, sales: 1000, profit: 250 } });
    expect(r.json.used).toBe(1);
  });

  it('a question in Iraqi Arabic: the AI picks the report (one action), the numbers are ours', async () => {
    const r = await owner.post('/v1/sys/ai/ask', { question: 'شكد بعت اليوم؟' });
    expect(r.json.answer.data.sales).toBe(1000);
    expect(r.json.used).toBe(2);
    expect((await owner.post('/v1/sys/ai/ask', { question: 'شنو الطقس باچر؟' })).json.answer.tool).toBe('unknown');
    expect((await owner.post('/v1/sys/ai/ask', { plan: { tool: 'drop_tables', period: 'today' } })).json.error).toBe('BAD_PLAN');
  });
});

describe('limits and the owner’s switch', () => {
  it('the owner can switch AI off; then nothing runs', async () => {
    expect((await owner.put('/v1/sys/ai/settings', { off: true })).json.off).toBe(true);
    expect((await owner.post('/v1/sys/ai/invoice', { image: PHOTO })).json.error).toBe('AI_OFF');
    expect((await owner.put('/v1/sys/ai/settings', { off: false })).json.off).toBe(false);
  });

  it('the month’s allowance is a hard stop', async () => {
    await t.client.transaction(async (tx: any) => {
      await tx.query("select set_config('app.system', 'on', true)");
      await tx.query(`insert into ai_usage (id, organization_id, feature, engine, ok, counted) select 'x' || g, o.id, 'ask', 'test', true, true
        from generate_series(1, ${ALLOWANCE.free}) g, organization o where o.name = 'Al-Amal Market'`);
    });
    expect((await owner.post('/v1/sys/ai/ask', { question: 'شكد بعت اليوم؟' })).json.error).toBe('AI_LIMIT');
    expect((await owner.post('/v1/sys/ai/ask', { plan: { tool: 'debtors', period: 'today' } })).status).toBe(200); // presets still work
  });

  it('another shop never sees this shop’s AI use, and a shop without AI is told so', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'ai-other@example.com');
    await createOrg(other, 'Other Market');
    expect((await other.get('/v1/sys/ai')).json.used).toBe(0);
    const bare = await setup();
    const b = new Browser(bare.app);
    await signInEmail(b, 'no-ai@example.com');
    await createOrg(b, 'Plain Market');
    expect((await b.post('/v1/sys/ai/invoice', { image: PHOTO })).json.error).toBe('AI_UNAVAILABLE');
  });
});
