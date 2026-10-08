// What the School screens share: the set-up (one query, kept warm), today's date in Baghdad, WhatsApp links and the
// messages that go in them, the guardian's link, and the hash route's query (#/student?id=…).
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type Klass = { id: string; name: string; gradeId: string; teacherMemberId: string | null; room: string | null; capacity: number | null; students: number };
export type Grade = { id: string; name: string; stage: string; sort: number; active: boolean };
export type FeePlan = { id: string; name: string; gradeId: string | null; installments: { label: string; dueOn: string; amount: number }[]; total: number; active: boolean };
export type Setup = {
  school: { kind: string; city: string | null; phone: string | null; whatsapp: string | null; passMark: number; absentText: { ar?: string; en?: string } | null; feeText: { ar?: string; en?: string } | null; year: { id: string; name: string; startsOn: string; endsOn: string } | null };
  grades: Grade[]; classes: Klass[]; staff: { id: string; role: string; name: string }[]; plans: FeePlan[]; years: { id: string; name: string; startsOn: string; endsOn: string }[];
};

export const useSetup = () => useQuery<Setup>({ queryKey: ['sch-setup'], queryFn: () => api('/v1/sch/setup'), staleTime: 60_000 });

/** A class's full name: "First primary · A". */
export const classLabel = (setup: Setup | undefined, id: string | null | undefined) => {
  const c = setup?.classes.find((x) => x.id === id);
  if (!c) return '';
  const g = setup!.grades.find((x) => x.id === c.gradeId);
  return g ? `${g.name} · ${c.name}` : c.name;
};
export const classOptions = (setup: Setup | undefined) => (setup?.classes ?? []).map((c) => ({ value: c.id, label: classLabel(setup, c.id) }));

export const todayIso = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export const query = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? `{${k}}`) as string);

/** wa.me with a message (an Iraqi number as +964…). */
export const waLink = (phone: string | null | undefined, text: string) => (phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`);
export const familyLink = (token: string) => `${location.origin}/#/family/${token}`;
export const localPhone = (p: string | null | undefined) => (p ? p.replace(/^\+964(\d{3})(\d{3})(\d{4})$/, '0$1 $2 $3') : '');

/** The hash's query (#/students?add=1), re-read whenever the hash changes. */
export function useHashQuery() {
  const [q, setQ] = useState(query);
  useEffect(() => { const on = () => setQ(query()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return q;
}
/** Drop one key from the hash's query without adding a history entry. */
export const clearParam = (key: string) => {
  const [path, qs] = location.hash.split('?'); const p = new URLSearchParams(qs ?? ''); p.delete(key);
  history.replaceState(null, '', `${path}${p.toString() ? `?${p}` : ''}`); window.dispatchEvent(new HashChangeEvent('hashchange'));
};
