// The agency's set-up: its public face (phone, WhatsApp, about), how it works (currency, the dollar rate, the default
// commission, the share message), the team's agent cards, branches, and the official WhatsApp connection (honestly: not
// connected until Meta approves the agency's own number; until then Hemlo opens WhatsApp with the message ready).
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icon, Sheet, toLatin } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Pill, Sec } from './ui';
import { fmt, useSetup, localPhone, type Settings, type TeamMember } from './data';

export function Setup() {
  const { r, lang, toast, err } = useR();
  const setup = useSetup();
  const qc = useQueryClient();
  const [s, setS] = useState<Partial<Settings>>({});
  const [agent, setAgent] = useState<TeamMember | null>(null), [branch, setBranch] = useState('');
  useEffect(() => { if (setup.data) setS(setup.data.settings); }, [setup.data]);
  const save = useMutation({ mutationFn: (body: Record<string, unknown>) => api('/v1/re/settings', { method: 'PUT', body }), onSuccess: () => { toast(r.setup.saved); qc.invalidateQueries({ queryKey: ['re-setup'] }); }, onError: (e) => toast(err(e), 'bad') });
  const addBranch = useMutation({ mutationFn: () => api('/v1/re/branches', { body: { name: branch } }), onSuccess: () => { setBranch(''); qc.invalidateQueries({ queryKey: ['re-setup'] }); }, onError: (e) => toast(err(e), 'bad') });
  if (!setup.data) return <div className="skeleton h-96" />;
  const tpl = s.shareTemplate ?? {};
  return (
    <div className="grid max-w-3xl gap-2">
      <Sec title={r.setup.agency} />
      <div className="panel re-form">
        <div className="row2">
          <label className="field">{r.setup.phone}<input className="input" dir="ltr" value={localPhone(s.phone) || s.phone || ''} onChange={(e) => setS({ ...s, phone: e.target.value })} /></label>
          <label className="field">{r.setup.whatsapp}<input className="input" dir="ltr" value={localPhone(s.whatsapp) || s.whatsapp || ''} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} /></label>
        </div>
        <div className="row2">
          <label className="field">{r.setup.email}<input className="input" dir="ltr" value={s.email ?? ''} onChange={(e) => setS({ ...s, email: e.target.value })} /></label>
          <label className="field">{r.setup.city}<input className="input" value={s.city ?? ''} onChange={(e) => setS({ ...s, city: e.target.value })} /></label>
        </div>
        <label className="field">{r.setup.address}<input className="input" value={s.address ?? ''} onChange={(e) => setS({ ...s, address: e.target.value })} /></label>
        <label className="field">{r.setup.about}<textarea className="input" rows={3} value={s.about?.[lang === 'en' ? 'en' : 'ar'] ?? ''} onChange={(e) => setS({ ...s, about: { ...(s.about ?? {}), [lang === 'en' ? 'en' : 'ar']: e.target.value } })} /></label>
        <div className="row3">
          <div className="field">{r.setup.currency}<div className="seg">{(['USD', 'IQD'] as const).map((c) => <button key={c} aria-pressed={s.currency === c} onClick={() => setS({ ...s, currency: c })}>{c}</button>)}</div></div>
          <label className="field">{r.setup.rate}<input className="input" inputMode="numeric" value={s.usdRate ?? ''} onChange={(e) => setS({ ...s, usdRate: Number(toLatin(e.target.value).replace(/\D/g, '')) || 0 })} /><small>{r.setup.rateHint}</small></label>
          <label className="field">{r.setup.commission}<input className="input" inputMode="decimal" value={(s.defaultCommission ?? 0) / 100} onChange={(e) => setS({ ...s, defaultCommission: Math.round(Number(toLatin(e.target.value)) * 100) || 0 })} /></label>
        </div>
        <button className="btn btn-accent w-fit" disabled={save.isPending} onClick={() => save.mutate({ phone: s.phone, whatsapp: s.whatsapp, email: s.email, city: s.city, address: s.address, about: s.about, currency: s.currency, usdRate: s.usdRate, defaultCommission: s.defaultCommission })}>{r.setup.save}</button>
      </div>

      <Sec title={r.setup.share} />
      <div className="panel re-form">
        <p className="sub">{r.setup.shareHint}</p>
        {(['ar', 'en'] as const).map((l) => <label key={l} className="field">{l === 'ar' ? 'العربية' : 'English'}<textarea className="input" rows={6} dir={l === 'ar' ? 'rtl' : 'ltr'} value={tpl[l] ?? setup.data!.shareDefault[l]} onChange={(e) => setS({ ...s, shareTemplate: { ...tpl, [l]: e.target.value } })} /></label>)}
        <button className="btn btn-accent w-fit" onClick={() => save.mutate({ shareTemplate: { ar: tpl.ar ?? setup.data!.shareDefault.ar, en: tpl.en ?? setup.data!.shareDefault.en } })}>{r.setup.save}</button>
      </div>

      <Sec title={r.setup.team} action={<a href={`https://account.hemlohq.com${lang === 'en' ? '/en' : ''}/business/`} target="_blank" rel="noopener">{r.setup.invite}</a>} />
      <div className="panel">{setup.data.team.map((m) => (
        <button key={m.id} className="re-item" onClick={() => setAgent(m)}><Avatar name={m.name} /><span className="min-w-0 flex-1"><b className="block truncate">{m.name}</b><span className="sub">{[m.title, localPhone(m.whatsapp ?? m.phone), m.agentShare != null && `${m.agentShare / 100}%`].filter(Boolean).join(' · ')}</span></span><Pill>{m.role}</Pill></button>
      ))}</div>

      <Sec title={r.setup.branches} />
      <div className="panel">
        {setup.data.branches.map((b) => <div key={b.id} className="re-item"><Icon n="store" /><span className="flex-1">{b.name}</span><span className="sub">{b.city}</span></div>)}
        <div className="flex gap-2 p-3"><input className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={r.setup.branch} /><button className="btn btn-secondary" disabled={!branch.trim()} onClick={() => addBranch.mutate()}>{r.setup.addBranch}</button></div>
      </div>

      <Sec title={r.setup.wa} />
      <div className="panel re-form">
        <p className="flex items-center gap-2"><Pill tone={s.waApi?.status === 'connected' ? 'ok' : s.waApi?.status === 'requested' ? 'warn' : ''}>{s.waApi?.status === 'requested' ? '⏳' : s.waApi?.status === 'connected' ? '✓' : '—'}</Pill>
          {s.waApi?.status === 'requested' ? fmt(r.setup.waRequested, { date: (s.waApi.requestedAt ?? '').slice(0, 10) }) : r.setup.waOff}</p>
        <p className="sub">{r.setup.waWhy}</p>
        {s.waApi?.status !== 'requested' && s.waApi?.status !== 'connected' && <button className="btn btn-secondary w-fit" onClick={() => save.mutate({ waApi: 'request' })}><Icon n="wa" />{r.setup.waRequest}</button>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.autoMatch} onChange={(e) => { setS({ ...s, autoMatch: e.target.checked }); save.mutate({ autoMatch: e.target.checked }); }} />{r.setup.autoMatch}</label>
      </div>
      {agent && <AgentCard m={agent} onClose={() => setAgent(null)} />}
    </div>
  );
}

function AgentCard({ m, onClose }: { m: TeamMember; onClose(): void }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const [x, setX] = useState({ title: m.title ?? '', phone: m.phone ?? '', whatsapp: m.whatsapp ?? '', agentShare: (m.agentShare ?? 4000) / 100 });
  const save = useMutation({ mutationFn: () => api(`/v1/re/agents/${m.id}`, { method: 'PUT', body: { ...x, agentShare: Math.round(x.agentShare * 100) } }), onSuccess: () => { toast(r.setup.saved); qc.invalidateQueries({ queryKey: ['re-setup'] }); onClose(); }, onError: (e) => toast(err(e), 'bad') });
  return (
    <Sheet title={m.name} sub={r.setup.agentCard} onClose={onClose} center footer={<button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{r.setup.save}</button>}>
      <label className="field">{r.setup.title2}<input className="input" value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{r.setup.phone}<input className="input" dir="ltr" value={x.phone} onChange={(e) => setX({ ...x, phone: e.target.value })} /></label>
        <label className="field">{r.setup.whatsapp}<input className="input" dir="ltr" value={x.whatsapp} onChange={(e) => setX({ ...x, whatsapp: e.target.value })} /></label>
      </div>
      <label className="field">{r.setup.agentShare}<input className="input" inputMode="decimal" value={x.agentShare} onChange={(e) => setX({ ...x, agentShare: Number(toLatin(e.target.value)) || 0 })} /></label>
    </Sheet>
  );
}
