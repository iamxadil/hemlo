// Your plan: what the business is on (trial, paid until, grace), how much of the plan it uses, the plans it can move to
// (monthly or yearly: a year costs ten months), Enterprise through Hemlo Studio, and the payments made. Choosing a plan
// sends a request; Hemlo's team calls back and takes the payment (FIB, Zain Cash, cash or a transfer), then it's live.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, fill } from '../lib/app';
import { Icon, Money, Sheet } from '../components/ui';
import { ImpactCard } from '../components/Impact';

type Words = { ar: string; en: string; ckb?: string };
type Plan = { id: string; code: string; name: Words; tagline: Words | null; priceMonth: number; priceYear: number; limits: Record<string, number | undefined>; popular: boolean };
type Addon = { id: string; code: string; name: Words; description: Words; priceMonth: number | null; priceYear: number | null; configured: boolean; entitlement: any };
const STUDIO = 'https://studio.hemlohq.com';
const addonCopy = (lang: string) => lang === 'ar' ? {
  optional: 'إضافة اختيارية', title: 'وسّع مساحة عمل Hemlo Real Estate', body: 'أنشئ موقعاً تجارياً بعلامتك، متصلاً مباشرة بمساحة عمل Hemlo.', core: 'النظام الأساسي', addon: 'Hemlo Website', total: 'الإجمالي الدوري التقديري',
  unconfigured: 'لم يُحدّد سعر Hemlo Website بعد. يمكنك الاطلاع على الإضافة، وسيظهر طلب التفعيل عند إعداد السعر.', unconfiguredShort: 'السعر قيد الإعداد', request: 'اطلب تفعيل الموقع', pending: 'طلب التفعيل ينتظر تأكيد Hemlo.', active: 'مفعّل', cancel: 'اطلب الإلغاء', cancelPending: 'طلب الإلغاء ينتظر المراجعة.',
  confirm: 'سيتواصل معك Hemlo لتأكيد الدفع اليدوي. يبدأ الوصول بعد التأكيد فقط.', cancelConfirm: 'سيراجع فريق Hemlo طلب الإلغاء ويتواصل معك بشأن موعده.', confirmAction: 'تأكيد الطلب', manual: 'الدفع يدوي بعد مراجعة Hemlo للطلب.', sent: 'وصل طلب الإضافة، والتفعيل بانتظار تأكيد Hemlo.',
} : lang === 'ckb' ? {
  optional: 'زیادکراوی ئارەزوومەندانە', title: 'شوێنی کاری Hemlo Real Estate فراوان بکە', body: 'ماڵپەڕێکی پیشەیی بە ناوی بازرگانی خۆت دروست بکە، ڕاستەوخۆ پەیوەست بە شوێنی کاری Hemlo.', core: 'سیستەمی بنەڕەتی', addon: 'Hemlo Website', total: 'کۆی دووبارەبوونەوەی خەمڵێنراو',
  unconfigured: 'نرخی Hemlo Website هێشتا دیاری نەکراوە. دوای دانانی نرخ، داوای چالاککردن بەردەست دەبێت.', unconfiguredShort: 'نرخ لە ئامادەکردندایە', request: 'داوای چالاککردنی ماڵپەڕ بکە', pending: 'داواکاری چالاککردن چاوەڕێی پشتڕاستکردنەوەی Hemlo دەکات.', active: 'چالاکە', cancel: 'داوای هەڵوەشاندنەوە بکە', cancelPending: 'داواکاری هەڵوەشاندنەوە چاوەڕێی پێداچوونەوەیە.',
  confirm: 'Hemlo پەیوەندیت پێوە دەکات بۆ پشتڕاستکردنەوەی پارەدانی دەستی. دەستڕاگەیشتن تەنها دوای پشتڕاستکردنەوە دەست پێدەکات.', cancelConfirm: 'تیمی Hemlo داواکاری هەڵوەشاندنەوەکەت پێداچوونەوەی بۆ دەکات و کاتی جێبەجێکردنت پێ دەڵێت.', confirmAction: 'داواکاری پشتڕاست بکەرەوە', manual: 'پارەدان دەستییە و دوای پێداچوونەوەی Hemlo ئەنجام دەدرێت.', sent: 'داواکاری زیادکراوەکەت گەیشت؛ چالاککردن چاوەڕێی پشتڕاستکردنەوەی Hemlo دەکات.',
} : {
  optional: 'Optional add-on', title: 'Extend your Hemlo Real Estate workspace', body: 'Create your own branded business website, connected directly to your Hemlo workspace.', core: 'Core system', addon: 'Hemlo Website', total: 'Estimated recurring total',
  unconfigured: 'Hemlo Website pricing is not configured yet. Activation will appear here once pricing is set.', unconfiguredShort: 'Price being configured', request: 'Request Website activation', pending: 'Activation is pending Hemlo confirmation.', active: 'Active', cancel: 'Request cancellation', cancelPending: 'Cancellation is pending review.',
  confirm: 'Hemlo will contact you to confirm manual payment. Access starts only after confirmation.', cancelConfirm: 'Hemlo will review your cancellation request and confirm its timing with you.', confirmAction: 'Confirm request', manual: 'Payment is handled manually after Hemlo reviews the request.', sent: 'Add-on request received. Activation is pending Hemlo confirmation.',
};

export function PlanPage() {
  const { t, lang, num, date, money, toast, errorText, sys } = useApp();
  const p = t.planPage;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['billing'], queryFn: () => api(`/v1/billing?edition=${sys.business.kind ?? 'store'}`) });
  const aq = useQuery({ queryKey: ['billing-addons'], queryFn: () => api('/v1/billing/addons') });
  const [cycle, setCycle] = useState<'month' | 'year'>('month');
  const [asking, setAsking] = useState<Plan | 'enterprise' | null>(null);
  const [note, setNote] = useState('');
  const [addonAction, setAddonAction] = useState<'activate' | 'cancel' | null>(null);
  const ask = useMutation({
    mutationFn: () => api('/v1/billing/request', { body: { planId: asking === 'enterprise' ? null : asking?.id, billing: cycle, message: note || undefined } }),
    onSuccess: () => { setAsking(null); setNote(''); qc.invalidateQueries({ queryKey: ['billing'] }); toast(p.sent); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const askAddon = useMutation({
    mutationFn: () => api(`/v1/billing/addons/website/${addonAction === 'cancel' ? 'cancel-request' : 'request'}`, { body: { billing: cycle } }),
    onSuccess: () => { setAddonAction(null); qc.invalidateQueries({ queryKey: ['billing-addons'] }); qc.invalidateQueries({ queryKey: ['web-site'] }); toast(addonCopy(lang).sent); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  if (!q.data) return <div className="grid gap-4"><div className="skeleton h-32" /><div className="skeleton h-72" /></div>;
  const { subscription: s, usage, over, plans, payments, request, owner } = q.data as { subscription: any; usage: Record<string, number>; over: string[]; plans: Plan[]; payments: any[]; request: any; owner: boolean };
  const name = (w: Words | null | undefined) => (w ? (lang === 'ckb' ? w.ckb || w.ar : w[lang]) : '');
  const current = plans.find((x) => x.id === s.planId || x.id === s.plan?.id);
  const addonData = aq.data as { addons?: Addon[]; requests?: any[] } | undefined;
  const website = addonData?.addons?.find((x) => x.code === 'website');
  const pendingAddon = addonData?.requests?.find((x) => x.addonId === website?.id && x.status === 'new');
  const websiteCopy = addonCopy(lang);
  const priceOf = (x: Plan) => (cycle === 'year' ? x.priceYear : x.priceMonth);
  const addonPrice = cycle === 'year' ? website?.priceYear : website?.priceMonth;
  const corePrice = current ? (s.price != null && s.billing === cycle && current.id === s.planId ? s.price : priceOf(current)) : null;
  const canRequestAddon = owner && !!website?.configured && !website.entitlement?.active && !pendingAddon && ['trial', 'active', 'grace'].includes(s.status);
  const limits = s.limits ?? {};
  const keys = (['users', 'devices', 'dentists', 'members'] as const).filter((k) => limits[k] != null || (k === 'members' && sys.business.kind === 'gym') || (k === 'dentists' && sys.business.kind === 'dental'));
  const head = s.status === 'trial' ? fill(p.trialHead, { n: num(s.daysLeft ?? 0), plan: name(s.plan?.name) })
    : s.status === 'active' ? fill(p.activeHead, { plan: name(s.plan?.name) || '—', date: s.paidUntil ? date(s.paidUntil) : '' })
    : s.status === 'grace' ? fill(p.graceHead, { n: num(s.daysLeft ?? 0) })
    : s.status === 'free' ? p.freeHead : p.endedHead;
  return (
    <div className="grid max-w-5xl gap-6">
      <section className={`panel plan-now st-${s.status}`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="sec-t !mb-1">{p.now}</p>
            <h2 className="text-xl font-semibold">{head}</h2>
            {s.status === 'trial' && <p className="sub mt-1">{p.trialBody}</p>}
            {(s.status === 'grace' || s.status === 'ended') && <p className="sub mt-1">{p.dueBody}</p>}
          </div>
          {request && <span className="pill warn"><Icon n="clock" className="h-4 w-4" />{fill(p.pending, { plan: request.planId ? name(plans.find((x) => x.id === request.planId)?.name) : p.enterprise })}</span>}
        </div>
        {keys.length > 0 && (
          <div className="plan-meters">
            {keys.map((k) => {
              const used = usage[k] ?? 0, max = limits[k];
              const pct = max ? Math.min(100, (used / max) * 100) : 0;
              return (
                <div key={k} className={`plan-meter${over.includes(k) ? ' over' : ''}`}>
                  <span>{p.limits[k]}</span>
                  <b>{num(used)}<small> / {max == null ? p.unlimited : num(max)}</small></b>
                  <i><em style={{ width: `${max == null ? 4 : pct}%` }} /></i>
                </div>
              );
            })}
          </div>
        )}
        {over.length > 0 && <p className="note warn mt-3"><Icon n="info" />{p.overNote}</p>}
      </section>
      {(sys.business.kind === 'gym' || !sys.business.kind || sys.business.kind === 'store') && <ImpactCard kind={sys.business.kind === 'gym' ? 'gym' : 'store'} />}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{p.choose}</h2><p className="sub">{p.allFeatures}</p></div>
          <div className="seg w-auto"><button aria-pressed={cycle === 'month'} onClick={() => setCycle('month')}>{p.monthly}</button><button aria-pressed={cycle === 'year'} onClick={() => setCycle('year')}>{p.yearly}<span className="pill ok ms-2 !text-[.7rem]">{p.twoFree}</span></button></div>
        </div>
        <div className="plan-grid">
          {plans.map((x) => {
            const isCurrent = s.status !== 'trial' && x.id === current?.id;
            return (
              <article key={x.id} className={`panel plan-card${x.popular ? ' popular' : ''}${isCurrent ? ' current' : ''}`}>
                {x.popular && <span className="plan-badge">{p.popular}</span>}
                <h3>{name(x.name)}</h3>
                <p className="sub">{name(x.tagline)}</p>
                <p className="plan-price"><Money v={priceOf(x)} /><small>{cycle === 'year' ? p.perYear : p.perMonth}</small></p>
                {cycle === 'year' && <p className="sub">{fill(p.monthlyEq, { v: money(Math.round(x.priceYear / 12)) })}</p>}
                <ul className="plan-limits">
                  {(['users', 'devices', 'dentists', 'members', 'ai'] as const).filter((k) => x.limits[k] != null || (k === 'members' && sys.business.kind === 'gym')).map((k) => (
                    <li key={k}><Icon n="check" className="h-4 w-4" />{x.limits[k] == null ? fill(p.unlimitedOf, { what: p.limits[k] }) : x.limits[k] === 1 ? (p.one?.[k] ?? fill(p.upTo, { n: '1', what: p.limits[k] })) : fill(p.upTo, { n: num(x.limits[k]!), what: p.limits[k] })}</li>
                  ))}
                  <li><Icon n="check" className="h-4 w-4" />{p.everything}</li>
                </ul>
                {owner && (isCurrent ? <span className="btn btn-secondary btn-sm justify-center opacity-70">{p.current}</span>
                  : <button className={`btn btn-sm justify-center ${x.popular ? 'btn-accent' : 'btn-secondary'}`} onClick={() => setAsking(x)}>{p.pick}</button>)}
              </article>
            );
          })}
          <article className="panel plan-card enterprise">
            <h3>{p.enterprise}</h3>
            <p className="sub">{p.enterpriseTag}</p>
            <p className="plan-price"><span className="text-xl font-semibold">{p.quote}</span></p>
            <ul className="plan-limits">{p.enterpriseList.map((x: string) => <li key={x}><Icon n="check" className="h-4 w-4" />{x}</li>)}</ul>
            {owner && <button className="btn btn-secondary btn-sm justify-center" onClick={() => setAsking('enterprise')}>{p.talk}</button>}
            <a className="link-arrow justify-self-center text-sm" href={`${STUDIO}${lang === 'en' ? '/en' : ''}/?from=systems&edition=${sys.business.kind ?? 'store'}`} target="_blank" rel="noopener">{p.studio} →</a>
          </article>
        </div>
        {aq.isLoading ? <div className="skeleton h-36" /> : website && (
          <section className="panel grid gap-4 border border-[var(--line)] p-5 sm:p-6" aria-labelledby="website-addon-title">
            <div className="grid gap-1">
              <p className="sec-t !mb-0">{websiteCopy.optional}</p>
              <h3 id="website-addon-title" className="text-lg font-semibold">{websiteCopy.title}</h3>
              <p className="sub max-w-2xl">{name(website.description) || websiteCopy.body}</p>
            </div>
            <div className="grid gap-2 rounded-xl bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-4 text-sm"><span>{websiteCopy.core}{current ? ` · ${name(s.plan?.name ?? current.name)}` : ''}</span><span className="font-medium">{corePrice == null ? '—' : <>{money(corePrice)} <small>{cycle === 'year' ? p.perYear : p.perMonth}</small></>}</span></div>
              <div className="flex items-center justify-between gap-4 text-sm"><span>{name(website.name) || websiteCopy.addon}</span><span className="font-medium">{website.configured && addonPrice != null ? <>{money(addonPrice)} <small>{cycle === 'year' ? p.perYear : p.perMonth}</small></> : websiteCopy.unconfiguredShort}</span></div>
              {website.configured && addonPrice != null && corePrice != null && <div className="mt-1 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-3"><b>{websiteCopy.total}</b><b><Money v={corePrice + addonPrice} /><small>{cycle === 'year' ? p.perYear : p.perMonth}</small></b></div>}
            </div>
            {website.entitlement?.active ? <div className="flex flex-wrap items-center justify-between gap-3"><span className="pill ok"><Icon n="check" className="h-4 w-4" />{websiteCopy.active}{website.entitlement.paidUntil ? ` · ${date(website.entitlement.paidUntil)}` : ''}</span>
              {pendingAddon?.action === 'cancel' ? <span className="pill warn"><Icon n="clock" className="h-4 w-4" />{websiteCopy.cancelPending}</span>
                : owner && <button className="btn btn-secondary btn-sm" onClick={() => setAddonAction('cancel')}>{websiteCopy.cancel}</button>}</div>
              : pendingAddon ? <span className="pill warn"><Icon n="clock" className="h-4 w-4" />{pendingAddon.action === 'cancel' ? websiteCopy.cancelPending : websiteCopy.pending}</span>
                : <div className="flex flex-wrap items-center justify-between gap-3"><p className="sub">{website.configured ? websiteCopy.manual : websiteCopy.unconfigured}</p>
                  {owner && <button className="btn btn-accent btn-sm" disabled={!canRequestAddon} onClick={() => setAddonAction('activate')}>{websiteCopy.request}</button>}</div>}
            {!owner && <p className="sub">{p.ownerOnly}</p>}
          </section>
        )}
        {!owner && <p className="sub">{p.ownerOnly}</p>}
        <p className="sub">{p.howToPay}</p>
      </section>

      {owner && payments.length > 0 && (
        <section className="panel rows overflow-clip">
          <p className="sec-t px-5 pt-4">{p.payments}</p>
          {payments.map((x) => (
            <div key={x.id} className="row">
              <span className="min-w-0 flex-1"><b className="block font-medium">{date(x.createdAt)}</b><span className="sub">{p.methods[x.method] ?? x.method} · {fill(p.months, { n: num(x.months) })} · {fill(p.until, { date: date(x.paidUntil) })}</span></span>
              <Money v={x.amount} className="font-semibold" />
            </div>
          ))}
        </section>
      )}

      {asking && (
        <Sheet title={asking === 'enterprise' ? p.enterprise : name(asking.name)} sub={asking === 'enterprise' ? p.enterpriseTag : `${money(priceOf(asking))} ${cycle === 'year' ? p.perYear : p.perMonth}`} onClose={() => setAsking(null)} center
          footer={<button className="btn btn-accent justify-center" disabled={ask.isPending} onClick={() => ask.mutate()}>{p.send}</button>}>
          <p className="text-[.95rem]">{p.askBody}</p>
          <label className="field">{p.message}<textarea className="input" value={note} maxLength={500} placeholder={asking === 'enterprise' ? p.enterprisePh : p.messagePh} onChange={(e) => setNote(e.target.value)} /></label>
        </Sheet>
      )}
      {addonAction && website && (
        <Sheet title={addonAction === 'cancel' ? websiteCopy.cancel : websiteCopy.request}
          sub={addonAction === 'cancel' ? websiteCopy.cancelConfirm : `${money(Number(corePrice ?? 0) + Number(addonPrice ?? 0))} ${cycle === 'year' ? p.perYear : p.perMonth}`}
          onClose={() => setAddonAction(null)} center
          footer={<button className="btn btn-accent justify-center" disabled={askAddon.isPending} onClick={() => askAddon.mutate()}>{askAddon.isPending ? p.send : websiteCopy.confirmAction}</button>}>
          <p className="text-[.95rem]">{addonAction === 'cancel' ? websiteCopy.cancelConfirm : websiteCopy.confirm}</p>
        </Sheet>
      )}
    </div>
  );
}
