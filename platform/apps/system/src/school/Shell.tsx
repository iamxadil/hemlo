// The School's frame, dark glass: a living colour field behind everything, a header of floating chips (the school, its
// year, you), a large title, and one floating glass bar at the bottom: the pages, "ask or go anywhere" (Ctrl+K, a
// shadcn Command), and "+" for a new student. Pages blur in. No sidebar: the work gets the whole screen.
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, LayoutGroup, AnimatePresence, useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { DropdownMenu } from 'radix-ui';
import { Sun, Users, ClipboardCheck, Wallet, School, Sparkles, Settings, Globe, LogOut, Search, Plus, ChevronDown, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { go } from '../lib/app';
import { locale } from '../lib/i18n';
import type { Page } from '../pages';
import { useS } from './i18n';
import { Aurora, Avatar, Skeleton, Toaster, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './ui';
import { classLabel, useSetup } from './data';
import './school.css';

const ICONS: Record<string, LucideIcon> = { today: Sun, students: Users, attendance: ClipboardCheck, fees: Wallet, school: School, plan: Sparkles, settings: Settings };
const BAR = ['today', 'students', 'attendance', 'fees', 'school'];

export function SchShell({ pages, current, label, banner, signOut, signOutLabel }: {
  pages: Page[]; current: Page; label(p: Page): string; banner: ReactNode; signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>;
}) {
  const { s, lang, setLang, sys, me, can } = useS();
  const [find, setFind] = useState(false);
  const setup = useSetup();
  const still = useReducedMotion();
  useEffect(() => { document.documentElement.classList.add('sc'); return () => document.documentElement.classList.remove('sc'); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement, typing = /^(input|textarea|select)$/i.test(el?.tagName ?? '') || el?.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setFind(true); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [current.path]);

  const parent: Record<string, string> = { student: 'students' };
  const onPage = (p: Page) => p.path === current.path || parent[current.path] === p.path;
  const bar = pages.filter((p) => BAR.includes(p.path) && !p.hidden);
  const menu = pages.filter((p) => !BAR.includes(p.path) && !p.hidden && p.path !== 'more');
  const View = current.view;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  // the first name, past a title (Ms., Dr., الأستاذة…)
  const first = (me.user.name || '').split(/\s+/).find((w: string) => !/^(ms\.?|mr\.?|mrs\.?|dr\.?|د\.|الأستاذ|الأستاذة|الدكتور|الدكتورة|الست|السيد|السيدة)$/i.test(w)) ?? '';
  const title = current.path === 'today' ? `${hour < 12 ? s.shell.morning : s.shell.evening}${first ? `${lang === 'en' ? ', ' : '، '}${first}` : ''}` : label(current);
  const dateLine = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : `${locale(lang)}-u-nu-latn`, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Baghdad' }).format(new Date());
  const year = setup.data?.school.year?.name;
  const role = s.roles[(sys.role ?? '').split(',')[0]] ?? sys.role ?? '';

  return (
    <>
      <Aurora />
      <Toaster />
      <div className="sc-app">
        {banner}
        <header className="sc-head">
          <a href="#/today" className="sc-head-chip sc-glass"><img src="/brand/hemlo-mark.svg" alt="" /><span className="min-w-0"><b className="truncate">{sys.business.name}</b><small>Hemlo School</small></span></a>
          {year && <span className="sc-year sc-glass max-sm:hidden"><i /><bdi dir="ltr">{year}</bdi></span>}
          <DropdownMenu.Root dir={document.documentElement.dir as any}>
            <DropdownMenu.Trigger className="sc-me-btn sc-glass outline-none"><span className="max-sm:hidden">{me.user.name}</span><Avatar name={me.user.name || '·'} className="size-8 rounded-full text-[12px]" /><ChevronDown className="size-4 opacity-60 max-sm:hidden" /></DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="sc-pop-in z-80 min-w-[230px] rounded-2xl border border-white/10 bg-[rgba(20,22,40,.82)] p-1.5 text-[14.5px] text-foreground shadow-2xl backdrop-blur-2xl">
                <div className="px-3 pt-2 pb-2.5"><b className="block truncate">{me.user.name}</b><span className="text-muted-foreground text-[12.5px]">{role}</span></div>
                <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
                {menu.map((p) => { const I = ICONS[p.path] ?? Settings; return <DropdownMenu.Item key={p.path} onSelect={() => go(`#/${p.path}`)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-white/[.09]"><I className="text-muted-foreground size-[18px]" />{label(p)}</DropdownMenu.Item>; })}
                <DropdownMenu.Item onSelect={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-white/[.09]"><Globe className="text-muted-foreground size-[18px]" />{lang === 'en' ? 'العربية' : 'English'}</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
                <DropdownMenu.Item onSelect={signOut} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-white/[.09]"><LogOut className="text-muted-foreground size-[18px]" />{signOutLabel}</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>

        <div className="sc-title">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={title} initial={still ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }} transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }}>
              <h1 className="sc-glow-text">{title}</h1>
              {current.path === 'today' && <p>{dateLine}</p>}
            </motion.div>
          </AnimatePresence>
        </div>
        <main className="sc-page">
          <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-36 rounded-[28px]" /><Skeleton className="h-72 rounded-[28px]" /></div>}>
            <View key={current.path} />
          </Suspense>
        </main>
      </div>

      <LayoutGroup id="sc-bar">
        <nav className="sc-bar sc-glass" aria-label="menu">
          <div className="sc-bar-nav">
            {bar.map((p) => { const I = ICONS[p.path]; return (
              <a key={p.path} href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined} aria-label={label(p)}>
                {onPage(p) && <motion.span layoutId="sc-bar-pill" className="sc-bar-pill" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
                <I /><span className="sc-bar-tip">{label(p)}</span>
              </a>); })}
          </div>
          <span className="sc-bar-sep" aria-hidden />
          <button className="sc-ask" onClick={() => setFind(true)} aria-label={s.shell.search}><Search /><span className="flex-1 truncate text-start">{s.shell.ask}</span><kbd>Ctrl K</kbd></button>
          {can('students.create') && <a className="sc-plus" href="#/students?add=1" aria-label={s.shell.addStudent} title={s.shell.addStudent}><Plus /></a>}
        </nav>
      </LayoutGroup>
      <Finder open={find} onClose={() => setFind(false)} />
    </>
  );
}

/** Ctrl+K: students (by name, number, a parent's phone) and the common jobs. */
function Finder({ open, onClose }: { open: boolean; onClose(): void }) {
  const { s, can } = useS();
  const [q, setQ] = useState(''), [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 160); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const setup = useSetup();
  const found = useQuery<{ students: any[] }>({ queryKey: ['sch-find', debounced], queryFn: () => api(`/v1/sch/students?limit=8&q=${encodeURIComponent(debounced)}`), enabled: open && debounced.length > 0, staleTime: 10_000 });
  const jump = (hash: string) => { onClose(); go(hash); };
  const actions = useMemo(() => [
    can('students.create') && { key: 'add', icon: Plus, label: s.shell.addStudent, hash: '#/students?add=1' },
    can('attendance.take') && { key: 'roll', icon: ClipboardCheck, label: s.shell.takeRoll, hash: '#/attendance' },
    can('fees.read') && { key: 'fees', icon: Wallet, label: s.nav.fees, hash: '#/fees' },
    { key: 'students', icon: Users, label: s.nav.students, hash: '#/students' },
  ].filter(Boolean) as { key: string; icon: LucideIcon; label: string; hash: string }[], [can, s]);
  return (
    <CommandDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title={s.shell.search} footer={s.shell.keys}>
      <CommandInput value={q} onValueChange={setQ} placeholder={s.shell.searchHint} autoFocus />
      <CommandList>
        {debounced && !found.isLoading && !found.data?.students.length && <CommandEmpty>{s.shell.none.replace('{q}', debounced)}</CommandEmpty>}
        {!!found.data?.students.length && debounced && (
          <CommandGroup heading={s.shell.students}>
            {found.data.students.map((x) => (
              <CommandItem key={x.id} value={x.id} onSelect={() => jump(`#/student?id=${x.id}`)}>
                <Avatar name={x.name} /><span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.name}</b><span className="text-muted-foreground text-[13px]">#{x.number} · {classLabel(setup.data, x.classId) || s.students.noClass}</span></span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!debounced && <CommandGroup heading={s.shell.actions}>{actions.map((a) => <CommandItem key={a.key} value={a.key} onSelect={() => jump(a.hash)}><a.icon />{a.label}</CommandItem>)}</CommandGroup>}
      </CommandList>
    </CommandDialog>
  );
}
