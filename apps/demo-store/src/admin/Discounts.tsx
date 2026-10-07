// Discount codes: percent or fixed, a minimum order, on or off, and how often each has been used. A code made here
// works in the store's bag at once.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { deleteDiscount, saveDiscount } from '../lib/actions';
import { price } from '../lib/format';
import { fill } from '../lib/i18n';
import { doc } from '../lib/store';
import type { Discount } from '../lib/types';
import { Icon, toast } from '../ui/kit';
import { Field, MoneyInput, Switch } from './forms';
import { previewAt } from './state';
import { a } from './strings';

const blank = (): Discount => ({ id: '', code: '', kind: 'percent', value: 10, minTotal: 0, active: true, uses: 0 });

function Form({ d, onDone }: { d: Discount; onDone(): void }) {
  const v = useSignal(structuredClone(d)), t = a.value.d, set = (x: Partial<Discount>) => (v.value = { ...v.value, ...x });
  return (
    <form class="panel form-grid cols-3" onSubmit={(e) => { e.preventDefault(); if (saveDiscount(v.value)) onDone(); else toast(t.taken); }}>
      <Field label={t.code}><input class="input" dir="ltr" value={v.value.code} onInput={(e) => set({ code: (e.target as HTMLInputElement).value.toUpperCase() })} required /></Field>
      <Field label={t.kind}><select class="input" value={v.value.kind} onChange={(e) => set({ kind: (e.target as HTMLSelectElement).value as Discount['kind'], value: 0 })}><option value="percent">{t.percent}</option><option value="fixed">{t.fixed}</option></select></Field>
      {v.value.kind === 'percent'
        ? <Field label={t.value}><input class="input num" inputMode="numeric" dir="ltr" value={v.value.value} onInput={(e) => set({ value: Math.min(100, parseInt((e.target as HTMLInputElement).value.replace(/\D/g, '') || '0', 10)) })} /></Field>
        : <MoneyInput key="fixed" label={t.value} value={v.value.value} onChange={(value) => set({ value: value ?? 0 })} />}
      <MoneyInput label={t.min} value={v.value.minTotal} onChange={(minTotal) => set({ minTotal: minTotal ?? 0 })} />
      <Switch label={t.active} on={v.value.active} onChange={(active) => set({ active })} />
      <div class="actions"><button class="btn btn-solid btn-sm" type="submit">{t.save}</button><button class="btn btn-ghost btn-sm" type="button" onClick={onDone}>×</button></div>
    </form>
  );
}

export function Discounts() {
  useEffect(() => { previewAt.value = '/'; }, []);
  const t = a.value.d, open = useSignal<string | null>(null);
  return (
    <div class="adm-stack">
      <div class="adm-title"><h1 class="adm-h1">{a.value.nav.discounts}</h1><button class="btn btn-solid btn-sm" onClick={() => (open.value = 'new')}><Icon n="plus" />{t.new}</button></div>
      {open.value === 'new' && <Form d={blank()} onDone={() => (open.value = null)} />}
      <ul class="rows panel">
        {doc.value.discounts.map((d) => open.value === d.id ? <li><Form d={d} onDone={() => (open.value = null)} /></li> : (
          <li class="row">
            <span class="code-chip" dir="ltr">{d.code}</span>
            <span class="row-main"><b class="num">{d.kind === 'percent' ? `${d.value}%` : price(d.value)}</b><small class="muted">{d.minTotal ? `≥ ${price(d.minTotal)} · ` : ''}{fill(t.uses, { n: d.uses })}</small></span>
            <span class={`pill${d.active ? ' on' : ''}`}>{d.active ? a.value.p.on : a.value.p.off}</span>
            <button class="icon-btn" onClick={() => (open.value = d.id)} aria-label="edit"><Icon n="edit" /></button>
            <button class="icon-btn" onClick={() => deleteDiscount(d.id)} aria-label={t.delete}><Icon n="trash" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
