// The School's frame. Computers and tablets: a quiet side rail (the active page slides under a pill), a top bar with one
// search for everything (Ctrl+K or /). Phones: a floating dock. Pages rise in; the search finds a student by name,
// number or a parent's phone and opens their file, or starts the day's common jobs.
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Command } from 'cmdk';
import { motion, LayoutGroup, AnimatePresence, useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go } from '../lib/app';
import { locale, rtl as isRtl } from '../lib/i18n';
import type { Page } from '../pages';
import { useS } from './i18n';
import { SIcon, Avatar, SToaster, Skel } from './ui';
import { classLabel, useSetup } from './data';
import './school.css';

const ICONS: Record<string, string> = { today: 'sun', students: 'users', attendance: 'roll', fees: 'wallet', school: 'school', plan: 'sparkle', settings: 'gear' };
const DOCK = ['today', 'students', 'attendance', 'fees'];

export function SchShell({ pages, current, label, banner, signOut, signOutLabel }: {
  pages: Page[]; current: Page; label(p: Page): string; banner: ReactNode; signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>;
}) {
  const { s, lang, setLang, sys, me, can } = useS();
  const rtl = isRtl(lang);
  const [find, setFind] = useState(false), [more, setMore] = useState(false), [scrolled, setScrolled] = useState(false);
  const setup = useSetup();
  const still = useReducedMotion();
  useEffect(() => { document.documentElement.classList.add('sc'); return () => document.documentElement.classList.remove('sc'); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement, typing = /^(input|textarea|select)$/i.test(el?.tagName ?? '') || el?.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setFind(true); }
    };
    const sc = () => setScrolled(window.scrollY > 8);
    window.addEventListener('keydown', k); window.addEventListener('scroll', sc, { passive: true });
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('scroll', sc); };
  }, []);
  useEffect(() => { setMore(false); window.scrollTo({ top: 0 }); }, [current.path]);

  const parent: Record<string, string> = { student: 'students' };
  const onPage = (p: Page) => p.path === current.path || parent[current.path] === p.path;
  const nav = pages.filter((p) => !p.hidden && p.path !== 'more');
  const dock = nav.filter((p) => DOCK.includes(p.path));
  const rest = nav.filter((p) => !DOCK.includes(p.path));
  const View = current.view;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  // the first name, past a title (Ms., Dr., الأستاذة…)
  const first = (me.user.name || '').split(/\s+/).find((w: string) => !/^(ms\.?|mr\.?|mrs\.?|dr\.?|د\.|الأستاذ|الأستاذة|الدكتور|الدكتورة|الست|السيد|السيدة)$/i.test(w)) ?? '';
  const title = current.path === 'today' ? `${hour < 12 ? s.shell.morning : s.shell.evening}${first ? `${lang === 'en' ? ', ' : '، '}${first}` : ''}` : label(current);
  const year = setup.data?.school.year?.name;

  return (
    <>
    <SToaster rtl={rtl} />
    <div className="sc-app">
      <aside className="sc-side" aria-label={sys.business.name}>
        <a className="sc-brand" href="#/today"><img src="/brand/hemlo-mark.svg" alt="" /><span className="min-w-0"><b>Hemlo School</b><small>{sys.business.name}</small></span></a>
        {year && <span className="sc-year"><i /><bdi dir="ltr">{year}</bdi></span>}
        <LayoutGroup id="sc-side">
          <nav className="grid gap-1">
            {nav.map((p) => (
              <a key={p.path} className="sc-nav" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined}>
                {onPage(p) && <motion.span layoutId="sc-nav-pill" className="sc-nav-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
                <SIcon n={ICONS[p.path] ?? 'more'} /><span>{label(p)}</span>
              </a>
            ))}
          </nav>
        </LayoutGroup>
        <div className="sc-side-foot">
          <div className="sc-me"><Avatar name={me.user.name || '·'} /><span className="min-w-0"><b className="truncate">{me.user.name}</b><small>{s.roles[(sys.role ?? '').split(',')[0]] ?? sys.role ?? ''}</small></span></div>
          <button className="sc-nav" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><SIcon n="globe" /><span>{lang === 'en' ? 'العربية' : 'English'}</span></button>
          <button className="sc-nav" onClick={signOut}><SIcon n="out" /><span>{signOutLabel}</span></button>
        </div>
      </aside>

      <div className="sc-main">
        {banner}
        <header className={`sc-top${scrolled ? ' scrolled' : ''}`}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1 key={title} initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>{title}</motion.h1>
          </AnimatePresence>
          <button className="sc-find" onClick={() => setFind(true)} aria-label={s.shell.search}><SIcon n="search" /><span className="flex-1 truncate text-start">{s.shell.search}</span><kbd>Ctrl K</kbd></button>
          {can('students.create') && <a className="sc-btn sc-btn-primary sc-btn-sm hidden md:inline-flex" href="#/students?add=1"><SIcon n="plus" />{s.shell.addStudent}</a>}
        </header>
        <main className="sc-page">
          <Suspense fallback={<div className="grid gap-4"><Skel h={120} /><Skel h={280} /></div>}>
            <View key={current.path} />
          </Suspense>
        </main>
      </div>

      <LayoutGroup id="sc-dock">
        <nav className="sc-dock" aria-label="menu">
          {dock.map((p) => (
            <a key={p.path} href={`#/${p.path}`} aria-current={onPage(p) && !more ? 'page' : undefined}>
              {onPage(p) && !more && <motion.span layoutId="sc-dock-pill" className="sc-dock-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
              <SIcon n={ICONS[p.path]} /><span>{label(p)}</span>
            </a>
          ))}
          <button onClick={() => setMore((x) => !x)} aria-expanded={more} aria-current={more || rest.some(onPage) ? 'page' : undefined}>
            {(more || rest.some(onPage)) && <motion.span layoutId="sc-dock-pill" className="sc-dock-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <SIcon n="more" /><span>{s.nav.more}</span>
          </button>
        </nav>
      </LayoutGroup>
      <AnimatePresence>
        {more && (
          <motion.div className="sc-card fixed z-40 grid gap-1 p-2" style={{ insetInline: 12, bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))' }}
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18 }}>
            {rest.map((p) => <a key={p.path} className="sc-nav" href={`#/${p.path}`} onClick={() => setMore(false)} aria-current={onPage(p) ? 'page' : undefined}><SIcon n={ICONS[p.path] ?? 'more'} /><span>{label(p)}</span></a>)}
            <button className="sc-nav" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><SIcon n="globe" /><span>{lang === 'en' ? 'العربية' : 'English'}</span></button>
            <button className="sc-nav" onClick={signOut}><SIcon n="out" /><span>{signOutLabel}</span></button>
          </motion.div>
        )}
      </AnimatePresence>

      <Finder open={find} onClose={() => setFind(false)} />
      <span hidden>{locale(lang)}</span>
    </div>
    </>
  );
}

/** Ctrl+K: students (by name, number, a parent's phone) and the common jobs. */
function Finder({ open, onClose }: { open: boolean; onClose(): void }) {
  const { s, can, lang } = useS();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 160); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const setup = useSetup();
  const found = useQuery<{ students: any[] }>({ queryKey: ['sch-find', debounced], queryFn: () => api(`/v1/sch/students?limit=8&q=${encodeURIComponent(debounced)}`), enabled: open && debounced.length > 0, staleTime: 10_000 });
  const jump = (hash: string) => { onClose(); go(hash); };
  const actions = useMemo(() => [
    can('students.create') && { key: 'add', icon: 'plus', label: s.shell.addStudent, hash: '#/students?add=1' },
    can('attendance.take') && { key: 'roll', icon: 'roll', label: s.shell.takeRoll, hash: '#/attendance' },
    can('fees.read') && { key: 'fees', icon: 'wallet', label: s.nav.fees, hash: '#/fees' },
  ].filter(Boolean) as { key: string; icon: string; label: string; hash: string }[], [can, s]);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="sc-cmd-overlay" />
        <Dialog.Content className="sc-cmd" dir={isRtl(lang) ? 'rtl' : 'ltr'} aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{s.shell.search}</Dialog.Title>
          <Command shouldFilter={false} loop>
            <Command.Input value={q} onValueChange={setQ} placeholder={s.shell.searchHint} autoFocus />
            <Command.List>
              {debounced && !found.isLoading && !found.data?.students.length && <Command.Empty>{s.shell.none.replace('{q}', debounced)}</Command.Empty>}
              {!!found.data?.students.length && debounced && (
                <Command.Group heading={s.shell.students}>
                  {found.data.students.map((x) => (
                    <Command.Item key={x.id} value={x.id} onSelect={() => jump(`#/student?id=${x.id}`)}>
                      <Avatar name={x.name} /><span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.name}</b><span className="sc-sub">#{x.number} · {classLabel(setup.data, x.classId) || s.students.noClass}</span></span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!debounced && <Command.Group heading={s.shell.actions}>{actions.map((a) => <Command.Item key={a.key} value={a.key} onSelect={() => jump(a.hash)}><SIcon n={a.icon} />{a.label}</Command.Item>)}</Command.Group>}
            </Command.List>
          </Command>
          <div className="sc-cmd-foot">{s.shell.keys}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
