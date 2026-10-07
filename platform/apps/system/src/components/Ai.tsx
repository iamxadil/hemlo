// Hemlo AI in the shop: photograph a supplier's invoice (the lines fill in, ready to check), and ask the shop a question.
// The AI is a helper that drafts; the person checks and saves. The month's allowance is shown, never a surprise.
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, upload, ApiError, type UploadedFile } from '../lib/api';
import { prepareImage } from '../lib/images';
import { useApp, fill } from '../lib/app';
import { Icon } from './ui';

export type DraftLine = { name: string; qty: number; unitPrice: number; lineTotal: number; pack: boolean; productId: string | null; productName: string | null; confidence: 'sure' | 'check' | 'none' };
export type Draft = { supplier: { name: string; id: string | null }; reference: string; date: string; currency: 'IQD' | 'USD'; total: number; paid: number; lines: DraftLine[]; sumMatches: boolean };
type Status = { demo: boolean; off: boolean; used: number; allowance: number; available: string | null };

export const useAi = () => useQuery({ queryKey: ['ai'], queryFn: () => api<Status>('/v1/sys/ai'), staleTime: 60_000 });

const toDataUrl = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The "photograph the invoice" panel at the top of a new purchase. */
export function ScanInvoice({ onDraft, onPhoto }: { onDraft(d: Draft): void; onPhoto(f: UploadedFile): void }) {
  const { t, num } = useApp();
  const qc = useQueryClient();
  const ai = useAi();
  const [state, setState] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [read, setRead] = useState<{ n: number; sample: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const s = ai.data;
  if (!s || s.off || (!s.available && !s.demo)) return null;

  const go = async (body: { image?: string; sample?: boolean }) => {
    setState('reading'); setError('');
    try {
      const [r] = await Promise.all([api<{ draft: Draft }>('/v1/sys/ai/invoice', { body }), wait(body.sample ? 1600 : 0)]);
      onDraft(r.draft);
      setRead({ n: r.draft.lines.length, sample: !!body.sample });
      setState('done');
      qc.invalidateQueries({ queryKey: ['ai'] });
    } catch (e) {
      setError(e instanceof ApiError ? t.ai.errors[e.code] ?? t.errors.generic : t.errors.generic);
      setState('error');
    }
  };
  const fromPhoto = async (file: File) => {
    const img = await prepareImage(file, { max: 1600, quality: 0.82 });
    const url = await toDataUrl(img.blob);
    setPreview(url);
    upload('purchase', img).then(onPhoto).catch(() => {}); // the photo is also kept with the purchase
    await go({ image: url });
  };

  return (
    <section className={`ai-scan${state === 'reading' ? ' is-reading' : ''}`} aria-live="polite">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromPhoto(f); }} />
      {state === 'reading' && preview ? (
        <div className="ai-reading">
          <span className="ai-shot"><img src={preview} alt="" /><i className="ai-beam" aria-hidden="true" /></span>
          <span><b>{t.ai.reading}</b><span className="sub block">{t.ai.readingSub}</span></span>
        </div>
      ) : state === 'done' && read ? (
        <div className="ai-done">
          <span className="ai-ico"><Icon n="sparkle" /></span>
          <span className="min-w-0 flex-1"><b>{fill(t.ai.filled, { n: num(read.n) })}</b>{read.sample && <span className="sub block">{t.ai.sampleNote}</span>}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}><Icon n="camera" className="h-4 w-4" />{t.ai.again}</button>
        </div>
      ) : (
        <div className="ai-idle">
          <span className="ai-ico"><Icon n="sparkle" /></span>
          <span className="min-w-0 flex-1"><b>{t.ai.scan}</b><span className="sub block">{t.ai.scanHint}</span>
            {error && <span className="ai-err block">{error}</span>}</span>
          <span className="ai-acts">
            <button type="button" className="btn btn-accent btn-sm" onClick={() => input.current?.click()} disabled={!s.available}><Icon n="camera" className="h-4 w-4" />{t.ai.photo}</button>
            {s.demo && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPreview('/samples/invoice.jpg'); go({ sample: true }); }}>{t.ai.sample}</button>}
          </span>
        </div>
      )}
      <p className="ai-meter">{t.ai.badge} · {fill(t.ai.used, { n: num(s.used), m: num(s.allowance) })}</p>
    </section>
  );
}

type Answer = { tool: string; period: string; data: any };
/** "Ask your shop": a question box, a few ready questions, and the answer in plain words with the numbers that matter. */
export function AskShop() {
  const { t, money, num, qty } = useApp();
  const qc = useQueryClient();
  const ai = useAi();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState('');
  const ask = useMutation({
    mutationFn: (body: { question?: string; plan?: { tool: string; period: string } }) => api<{ answer: Answer }>('/v1/sys/ai/ask', { body }),
    onSuccess: (r) => { setAnswer(r.answer); setError(''); qc.invalidateQueries({ queryKey: ['ai'] }); },
    onError: (e) => setError(e instanceof ApiError ? t.ai.errors[e.code] ?? t.errors.generic : t.errors.generic),
  });
  useEffect(() => { if (ask.isPending) setAnswer(null); }, [ask.isPending]);
  const s = ai.data;
  if (!s || s.off) return null;
  const A = t.ai.answers, period = (p: string) => t.ai.periods[p] ?? p;
  const list = (rows: [string, string][]) => <ol className="ai-list">{rows.map(([a, b], i) => <li key={i}><span className="min-w-0 flex-1 truncate">{a}</span><b>{b}</b></li>)}</ol>;
  const render = (x: Answer) => {
    const d = x.data;
    switch (x.tool) {
      case 'summary': return !d.receipts ? <p>{fill(A.none, { period: period(x.period) })}</p> : <>
        <p>{fill(A.summary, { period: period(x.period), sales: money(d.sales), n: num(d.receipts), profit: money(d.profit) })}</p>
        {list([[t.ai.labels.collected, money(d.collected)], [t.ai.labels.onAccount, money(d.onAccount)], [t.ai.labels.expenses, money(d.expenses)], [t.ai.labels.discounts, money(d.discounts)]])}</>;
      case 'top_products': return d.items.length ? <><p>{fill(A.top, { period: period(x.period) })}</p>{list(d.items.map((i: any) => [`${i.name} × ${num(i.qty)}`, money(i.total)]))}</> : <p>{fill(A.none, { period: period(x.period) })}</p>;
      case 'slow_products': return <><p>{fill(A.slow, { period: period(x.period) })}</p>{list(d.items.map((i: any) => [i.name, num(i.stock)]))}</>;
      case 'debtors': return d.items.length ? <><p>{fill(A.debtors, { n: num(d.people), total: money(d.owed) })}</p>{list(d.items.map((i: any) => [i.name, money(i.balance)]))}</> : <p>{A.noDebt}</p>;
      case 'low_stock': return d.items.length ? <><p>{A.low}</p>{list(d.items.map((i: any) => [i.name, qty(i.stock, i.unit)]))}</> : <p>{A.noLow}</p>;
      case 'product': return d.found ? <p>{fill(A.product, { name: d.name, stock: qty(d.stock, d.unit), price: money(d.price), sold: num(d.sold30) })}</p> : <p>{fill(A.notFound, { q: d.asked })}</p>;
      case 'suppliers_owed': return d.items.length ? <><p>{fill(A.suppliers, { total: money(d.owed) })}</p>{list(d.items.map((i: any) => [i.name, money(i.balance)]))}</> : <p>{A.noSuppliers}</p>;
      default: return <p>{A.unknown}</p>;
    }
  };
  return (
    <section className="panel ai-ask">
      <div className="panel-h"><h2 className="flex items-center gap-2"><span className="ai-ico sm"><Icon n="sparkle" /></span>{t.ai.ask}</h2><span className="ai-meter !m-0">{fill(t.ai.used, { n: num(s.used), m: num(s.allowance) })}</span></div>
      <form className="ai-q" onSubmit={(e) => { e.preventDefault(); if (q.trim().length > 1) ask.mutate({ question: q.trim() }); }}>
        <input className="input" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.ai.askPh} maxLength={400} disabled={!s.available} />
        <button className="btn btn-accent" disabled={!s.available || q.trim().length < 2 || ask.isPending}>{t.ai.askGo}</button>
      </form>
      <div className="chips ai-presets">{t.ai.presets.map(([label, tool, p]) => <button key={label} type="button" className="chip" onClick={() => { setQ(''); ask.mutate({ plan: { tool, period: p } }); }}>{label}</button>)}</div>
      {(ask.isPending || answer || error) && <div className="ai-answer">
        {ask.isPending ? <p className="sub flex items-center gap-2"><span className="spinner" />{t.ai.thinking}</p> : error ? <p className="ai-err">{error}</p> : answer && render(answer)}
      </div>}
    </section>
  );
}
