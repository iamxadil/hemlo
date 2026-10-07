// The inventory: every listing as a photo card (or a compact list), filtered the way agents ask ("live villas for sale,
// cheapest first"), with bulk actions for the boring part (publish, archive, assign). And the map: the same inventory
// where it is, for showing a customer what's available in an area.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet } from '../components/ui';
import { useR } from './i18n';
import { Empty, PropCard, StatusPill, RIcon } from './ui';
import { fmt, price, titleOf, useSetup, type Card } from './data';

const TABS = ['live', 'draft', 'sold', 'archived', 'all'] as const;

export function Properties() {
  const { r, lang, can, toast, err } = useR();
  const { params } = useRoute();
  const setup = useSetup();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>(params.get('status') ?? 'live');
  const [q, setQ] = useState(''), [dq, setDq] = useState('');
  const [type, setType] = useState(''), [purpose, setPurpose] = useState(''), [sort, setSort] = useState('updatedAt'), [mine, setMine] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>(() => { try { return (localStorage.getItem('re.view') as any) || 'grid'; } catch { return 'grid'; } });
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [assign, setAssign] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  useEffect(() => { try { localStorage.setItem('re.view', view); } catch {} }, [view]);
  const query = new URLSearchParams({ status: tab === 'sold' ? 'sold' : tab, ...(dq ? { q: dq } : {}), ...(type ? { type } : {}), ...(purpose ? { purpose } : {}), ...(mine ? { agent: 'me' } : {}), sort });
  const list = useInfiniteQuery<{ properties: Card[]; total: number }>({
    queryKey: ['re-props', query.toString()], initialPageParam: 0,
    queryFn: ({ pageParam }) => api(`/v1/re/properties?${query}&limit=30&offset=${pageParam}`),
    getNextPageParam: (last, all) => { const n = all.reduce((s, p) => s + p.properties.length, 0); return n < last.total ? n : undefined; },
  });
  const items = list.data?.pages.flatMap((p) => p.properties) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s ?? []); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (action: string, extra: Record<string, unknown> = {}) => {
    try {
      const x = await api<{ done: number; skipped: number[] }>('/v1/re/properties/bulk', { body: { ids: [...(sel ?? [])], action, ...extra } });
      toast(x.skipped.length ? `${fmt(r.props.bulkDone, { n: x.done })} · ${fmt(r.props.bulkSkipped, { refs: x.skipped.map((n) => '#' + n).join(' ') })}` : fmt(r.props.bulkDone, { n: x.done }));
      setSel(null); setAssign(false); qc.invalidateQueries({ queryKey: ['re-props'] });
    } catch (e) { toast(err(e), 'bad'); }
  };
  const types = setup.data?.types ?? {};
  return (
    <div>
      <div className="re-tools">
        <div className="search"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.props.search} /></div>
        <select className="re-select" value={type} onChange={(e) => setType(e.target.value)} aria-label={r.studio.type}><option value="">{r.props.anyType}</option>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v[lang === 'en' ? 'en' : 'ar']}</option>)}</select>
        <select className="re-select" value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label={r.studio.purpose}><option value="">{r.props.anyPurpose}</option><option value="sale">{r.purpose.sale}</option><option value="rent">{r.purpose.rent}</option></select>
        <select className="re-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="sort">{Object.entries(r.props.sort).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {can('listings.create') && <a className="btn btn-accent" href="#/studio"><Icon n="plus" />{r.props.new}</a>}
      </div>
      <div className="re-tools">
        <div className="re-tabs">
          {TABS.map((k) => <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setSel(null); }}>{k === 'live' ? r.props.live : k === 'draft' ? r.props.drafts : k === 'sold' ? r.props.sold : k === 'archived' ? r.props.archived : r.props.all}{tab === k && !list.isLoading && <span className="c">{total}</span>}</button>)}
          <button aria-pressed={mine} onClick={() => setMine(!mine)}>{r.props.mine}</button>
        </div>
        <span className="flex-1" />
        {can('listings.update') && <button className={`chip${sel ? '' : ''}`} aria-pressed={!!sel} onClick={() => setSel(sel ? null : new Set())}>{r.props.select}</button>}
        <div className="re-tabs">
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label={r.props.grid}><RIcon n="grid" className="h-4 w-4" /></button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label={r.props.list}><Icon n="sales" className="h-4 w-4" /></button>
          <button onClick={() => go('#/map')} aria-label={r.props.map}><RIcon n="map" className="h-4 w-4" /></button>
        </div>
      </div>

      {list.isLoading ? <div className="re-cards">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '4 / 4.6' }} />)}</div>
        : !items.length ? <div className="panel">{tab === 'live' && !dq && !type && !purpose && !mine
          ? <Empty icon="store" title={r.props.empty} body={r.props.emptyBody} action={can('listings.create') && <a className="btn btn-accent" href="#/studio"><Icon n="plus" />{r.props.new}</a>} />
          : <Empty icon="search" title={r.props.none} />}</div>
        : view === 'grid' ? <div className="re-cards">{items.map((p) => <PropCard key={p.id} p={p} selected={sel?.has(p.id)} onSelect={sel ? () => toggle(p.id) : undefined} onClick={sel ? () => toggle(p.id) : undefined} />)}</div>
        : <div className="panel">{items.map((p) => (
          <button key={p.id} className="re-row-p" onClick={() => (sel ? toggle(p.id) : go(`#/property?id=${p.id}`))} style={sel?.has(p.id) ? { background: 'var(--accent-soft)' } : undefined}>
            {p.cover ? <img src={p.cover} alt="" loading="lazy" /> : <span className="ph" />}
            <span className="min-w-0 flex-1"><b className="block truncate font-medium">{titleOf(p, lang)}</b><span className="sub">#{p.ref} · {[p.area, p.size && fmt(r.props.m2, { n: p.size }), p.bedrooms && fmt(r.props.beds, { n: p.bedrooms })].filter(Boolean).join(' · ')}</span></span>
            <span className="grid justify-items-end gap-1"><b className="re-num">{price(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}</b><StatusPill status={p.status} /></span>
          </button>
        ))}</div>}
      {list.hasNextPage && <div className="mt-5 grid place-items-center"><button className="btn btn-secondary" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>{r.props.more}</button></div>}

      {sel && sel.size > 0 && (
        <div className="re-bulk">
          <b className="me-2">{fmt(r.props.selected, { n: sel.size })}</b>
          {can('listings.publish') && <><button className="btn" onClick={() => bulk('publish')}>{r.props.bulk.publish}</button><button className="btn" onClick={() => bulk('unpublish')}>{r.props.bulk.unpublish}</button></>}
          <button className="btn" onClick={() => setAssign(true)}>{r.props.bulk.assign}</button>
          {can('listings.archive') && <button className="btn" onClick={() => bulk('archive')}>{r.props.bulk.archive}</button>}
          <span className="flex-1" /><button className="icon-btn" style={{ color: 'inherit' }} onClick={() => setSel(null)} aria-label={r.common.close}><Icon n="close" /></button>
        </div>
      )}
      {assign && <Sheet title={r.props.bulk.assign} onClose={() => setAssign(false)} center>
        <div className="grid gap-2">{(setup.data?.team ?? []).map((m) => <button key={m.id} className="re-item panel" onClick={() => bulk('assign', { agentId: m.id })}><span className="re-av">{m.name[0]}</span><span className="flex-1">{m.name}</span></button>)}</div>
      </Sheet>}
    </div>
  );
}

/** The inventory on a map: prices as pins; tap one for its card. Only listings with a location. */
export function MapView() {
  const { r, lang } = useR();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null), layer = useRef<any>(null);
  const [purpose, setPurpose] = useState(''), [type, setType] = useState(''), [max, setMax] = useState('');
  const [picked, setPicked] = useState<Card | null>(null), [ready, setReady] = useState(false);
  const setup = useSetup();
  const data = useQuery<{ properties: Card[] }>({ queryKey: ['re-props', 'map', purpose, type, max], queryFn: () => api(`/v1/re/properties?map=1&status=live&limit=500${purpose ? `&purpose=${purpose}` : ''}${type ? `&type=${type}` : ''}${max ? `&max=${max}` : ''}`) });
  const props = useMemo(() => (data.data?.properties ?? []).filter((p) => p.lat != null && p.lng != null), [data.data]);
  useEffect(() => {
    let on = true;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!on || !box.current || map.current) return;
      map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([36.19, 44.01], 12); // Erbil, until the pins say otherwise
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      map.current.on('click', () => setPicked(null));
      setReady(true); // the pins may already be here: draw them now
    })();
    return () => { on = false; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    (async () => {
      const L = (await import('leaflet')).default;
      if (!map.current || !layer.current) return;
      layer.current.clearLayers();
      for (const p of props) {
        const icon = L.divIcon({ className: '', html: `<span class="re-marker${picked?.id === p.id ? ' on' : ''}">${price(p.price, p.currency, lang, null, true)}</span>`, iconSize: [0, 0] });
        L.marker([p.lat!, p.lng!], { icon }).addTo(layer.current).on('click', (e: any) => { L.DomEvent.stopPropagation(e); setPicked(p); });
      }
      if (props.length && !picked) map.current.fitBounds(L.latLngBounds(props.map((p) => [p.lat!, p.lng!] as [number, number])).pad(0.2), { maxZoom: 15 });
    })();
  }, [props, picked, lang, ready]);
  return (
    <div className="re-map">
      <div ref={box} />
      <div className="re-map-filters">
        <select className="re-select" value={purpose} onChange={(e) => setPurpose(e.target.value)}><option value="">{r.props.anyPurpose}</option><option value="sale">{r.purpose.sale}</option><option value="rent">{r.purpose.rent}</option></select>
        <select className="re-select" value={type} onChange={(e) => setType(e.target.value)}><option value="">{r.props.anyType}</option>{Object.entries(setup.data?.types ?? {}).map(([k, v]) => <option key={k} value={k}>{v[lang === 'en' ? 'en' : 'ar']}</option>)}</select>
        <select className="re-select" value={max} onChange={(e) => setMax(e.target.value)}><option value="">{r.leads.budget}</option>{[100000, 150000, 200000, 300000, 500000].map((v) => <option key={v} value={v}>{fmt(r.leads.upTo, { v: price(v, 'USD', lang, null, true) })}</option>)}</select>
      </div>
      {!data.isLoading && !props.length && <div className="re-map-card panel p-4"><p className="sub">{r.props.none}</p></div>}
      {picked && <div className="re-map-card"><PropCard p={picked} /></div>}
    </div>
  );
}
