// Members: the lists the desk works from (active, ending soon, lapsed, paused, owing), search by name, phone, number or
// a scanned card, and a new member in a few taps (photo from the camera, health notes a coach must know).
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, upload } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { prepareImage } from '../lib/images';
import { Empty, Icon, Money, Sheet, toLatin } from '../components/ui';
import { Importer } from '../components/Importer';
import { useG } from './i18n';
import { Face, StatePill } from './ui';
import { useSetup, fmt, type MemberRow } from './data';

const FILTERS = ['active', 'ending', 'expired', 'frozen', 'owing', 'all'] as const;

export function Members() {
  const { g, t, can, num, date } = useG();
  const { params } = useRoute();
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [d, setD] = useState('');
  const [status, setStatus] = useState<string>(() => (FILTERS as readonly string[]).includes(params.get('status') ?? '') ? params.get('status')! : 'active');
  const [pages, setPages] = useState(1);
  const [adding, setAdding] = useState(false);
  useEffect(() => { const t = setTimeout(() => setD(toLatin(q.trim())), 160); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPages(1), [d, status]);
  const st = d ? 'all' : status;
  const list = useQuery({
    queryKey: ['gym-members', st, d, pages],
    queryFn: async () => {
      const out = { members: [] as MemberRow[], counts: {} as Record<string, number>, more: false };
      for (let p = 0; p < pages; p++) { const r = await api(`/v1/gym/members?status=${st}&q=${encodeURIComponent(d)}&offset=${p * 60}`); out.members.push(...r.members); out.counts = r.counts; out.more = r.more; }
      return out;
    },
    placeholderData: (x) => x,
  });
  const counts = list.data?.counts ?? {};
  const rows = list.data?.members ?? [];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="search min-w-0 flex-1"><Icon n="search" /><input className="input" placeholder={g.members.search} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {can('members.create') && <button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}><Icon n="upload" className="h-4 w-4" />{t.importer.choice}</button>}
        {can('members.create') && <button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{g.members.new}</button>}
      </div>
      {!d && (
        <div className="gy-filters" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={status === f} className={`gy-filter flt-${f}`} onClick={() => { setStatus(f); history.replaceState(null, '', `#/members?status=${f}`); }}>
              <span>{g.members.filters[f]}</span><b>{counts[f] == null ? '·' : num(counts[f])}</b>
            </button>
          ))}
        </div>
      )}
      <div className="gy-card rows overflow-clip">
        {list.isLoading && !rows.length ? <div className="skeleton m-4 h-48" />
          : !rows.length ? <Empty icon="customers" text={d ? g.members.none : g.members.empty} action={!d && can('members.create') && <div className="flex flex-wrap justify-center gap-2"><button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}>{g.members.new}</button><button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}><Icon n="upload" className="h-4 w-4" />{t.importer.choice}</button></div>} />
          : rows.map((m) => (
            <a key={m.id} className="row gy-mrow" href={`#/member?id=${m.id}`}>
              <Face name={m.name} url={m.photoUrl} state={m.state} />
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-2 truncate font-medium">{m.name}{m.alerts.length > 0 && <span className="gy-alert-dot" title={m.alerts.map((a) => g.form.conditions[a] ?? a).join(' · ')}>!</span>}</b>
                <span className="sub block truncate" dir="auto">{fmt(g.members.no, { n: num(m.memberNo) })}{m.membership ? ` · ${m.membership.name}` : ''}{m.phone ? ` · ${m.phone.replace(/^\+964/, '0')}` : ''}</span>
              </span>
              <span className="hidden text-end sm:grid">
                <StatePill state={m.state} />
                {m.membership && <span className="sub mt-1">{fmt(m.membership.endsOn < new Date().toISOString().slice(0, 10) ? g.members.ended : g.members.ends, { date: date(m.membership.endsOn) })}</span>}
              </span>
              {m.balance > 0 && <span className="gy-owe"><Money v={m.balance} /></span>}
            </a>
          ))}
        {list.data?.more && <button className="row justify-center text-[var(--accent)]" onClick={() => setPages((p) => p + 1)}>{g.members.more}</button>}
      </div>
      {adding && <MemberForm onClose={() => setAdding(false)} onSaved={(m, sell) => go(`#/member?id=${m.id}${sell ? '&sell=1' : ''}`)} />}
      {importing && <Importer kind="members" extra={{ planName: g.importPlan }} onClose={() => setImporting(false)} />}
    </div>
  );
}

/** A new member, or editing one: who they are, a photo, their goal and health, an emergency contact. */
export function MemberForm({ member, quickName = '', onClose, onSaved }: { member?: any; quickName?: string; onClose(): void; onSaved(m: { id: string; name: string }, sell?: boolean): void }) {
  const { g, can, toast, err } = useG();
  const qc = useQueryClient();
  const setup = useSetup();
  const digits = /\d{5,}/.test(quickName);
  const [f, setF] = useState({
    name: member?.name ?? (digits ? '' : quickName), phone: (member?.phone ?? (digits ? quickName : '')).replace(/^\+964/, '0'), gender: member?.gender ?? '', birthDate: member?.birthDate ?? '',
    goal: member?.goal ?? '', emergencyName: member?.emergencyName ?? '', emergencyPhone: (member?.emergencyPhone ?? '').replace(/^\+964/, '0'), referral: member?.referral ?? '', notes: member?.notes ?? '', trainerId: member?.trainerId ?? '',
  });
  const [health, setHealth] = useState<Record<string, any>>(member?.health ?? {});
  const [photo, setPhoto] = useState<{ id: string; url: string | null } | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [more, setMore] = useState(!!member);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const takePhoto = async (fl: File | undefined) => {
    if (!fl) return;
    setBusyPhoto(true);
    try { const img = await prepareImage(fl, { max: 640, quality: 0.82 }); const up = await upload('member', img); setPhoto({ id: up.id, url: up.url }); }
    catch (e) { toast(err(e), 'bad'); }
    finally { setBusyPhoto(false); }
  };
  const save = useMutation({
    mutationFn: (_sell: boolean) => {
      const body = { ...f, phone: f.phone || null, emergencyPhone: f.emergencyPhone || null, gender: f.gender || null, birthDate: f.birthDate || null, goal: f.goal || null, trainerId: f.trainerId || null, health, ...(photo ? { photoId: photo.id } : {}) };
      return member ? api(`/v1/gym/members/${member.id}`, { method: 'PATCH', body }) : api('/v1/gym/members', { body });
    },
    onSuccess: (r: any, sell) => { qc.invalidateQueries({ queryKey: ['gym-members'] }); qc.invalidateQueries({ queryKey: ['gym-member'] }); toast(member ? g.form.saved : g.form.created); onSaved(r.member, sell); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const shown = photo?.url ?? member?.photoUrl ?? null;
  return (
    <Sheet title={member ? g.form.edit : g.form.new} onClose={onClose}
      footer={<>
        <button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending || busyPhoto} onClick={() => save.mutate(!member && can('memberships.sell'))}>{!member && can('memberships.sell') ? g.form.andSell : g.form.save}</button>
        {!member && can('memberships.sell') && <button className="btn btn-ghost btn-sm justify-center" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate(false)}>{g.form.save}</button>}
      </>}>
      <div className="gy-photo-row">
        <button type="button" className="gy-photo" onClick={() => file.current?.click()} aria-label={shown ? g.form.changePhoto : g.form.takePhoto}>
          {shown ? <img src={shown} alt="" /> : <Icon n="camera" />}
          {busyPhoto && <span className="spinner" />}
        </button>
        <input ref={file} type="file" accept="image/*" capture="user" hidden onChange={(e) => takePhoto(e.target.files?.[0])} />
        <label className="field flex-1">{g.form.name}<input className="input" autoFocus={!quickName} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{g.form.phone}<input className="input" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="field">{g.form.birth}<input className="input" type="date" dir="ltr" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></label>
      </div>
      <div className="seg">{(['m', 'f'] as const).map((x) => <button key={x} type="button" aria-pressed={f.gender === x} onClick={() => set('gender', f.gender === x ? '' : x)}>{g.form[x]}</button>)}</div>
      <section className="grid gap-2">
        <p className="sec-t !mb-0">{g.form.goal}</p>
        <div className="chips">{Object.entries(g.form.goals).map(([k, v]) => <button key={k} type="button" className="chip" aria-pressed={f.goal === k} onClick={() => set('goal', f.goal === k ? '' : k)}>{v}</button>)}</div>
      </section>
      <section className="grid gap-2">
        <p className="sec-t !mb-0">{g.form.health}</p>
        <p className="sub">{g.form.healthHint}</p>
        <div className="chips">{Object.entries(g.form.conditions).filter(([k]) => k !== 'pregnant' || f.gender !== 'm').map(([k, v]) => (
          <button key={k} type="button" className="chip danger" aria-pressed={!!health[k]} onClick={() => setHealth((h) => ({ ...h, [k]: !h[k] }))}>{v}</button>
        ))}</div>
        <input className="input" placeholder={g.form.healthNotes} value={health.notes ?? ''} onChange={(e) => setHealth((h) => ({ ...h, notes: e.target.value }))} />
      </section>
      {!more ? <button type="button" className="link-arrow justify-self-start" onClick={() => setMore(true)}>{g.form.more} ↓</button> : <>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{g.form.emergency}<input className="input" value={f.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} /></label>
          <label className="field">{g.form.emergencyPhone}<input className="input" dir="ltr" inputMode="tel" value={f.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{g.form.trainer}<select className="input" value={f.trainerId} onChange={(e) => set('trainerId', e.target.value)}>
            <option value="">{g.form.noTrainer}</option>{(setup.data?.trainers ?? []).filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="field">{g.form.referral}<input className="input" list="gym-referrals" value={f.referral} onChange={(e) => set('referral', e.target.value)} />
            <datalist id="gym-referrals">{g.form.referrals.map((r) => <option key={r} value={r} />)}</datalist></label>
        </div>
        <label className="field">{g.form.notes}<textarea className="input min-h-20" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      </>}
    </Sheet>
  );
}
