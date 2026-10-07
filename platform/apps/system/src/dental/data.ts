// Dental data: what the API returns, the clinic set-up everyone shares, and small helpers (teeth, age, two currencies).
import { useQuery } from '@tanstack/react-query';
import { api, remembered } from '../lib/api';
import { useApp } from '../lib/app';

export interface Dentist { id: string; memberId: string | null; name: string; specialty: string | null; color: string; sharePercent: number; shareBasis: string; labDeduct: boolean; active: boolean }
export interface Chair { id: string; name: string; sort: number; archivedAt: string | null }
export interface Procedure { id: string; code: string | null; name: string; category: string; currency: 'IQD' | 'USD'; price: number; minutes: number; scope: string; mark: string | null; labWork: boolean; active: boolean; sort: number }
export interface DSettings { usdRate: number; slotMinutes: number; hours: Record<string, [string, string] | null> | null; recallMonths: number; rxHeader: string | null; reminderText: string | null }
export interface Setup { settings: DSettings; chairs: Chair[]; dentists: Dentist[]; procedures: Procedure[]; members: { id: string; role: string; name: string }[] }
export interface PatientCard { id: string; fileNo: number; name: string; phone: string | null; balance: number; gender: string | null; birthDate: string | null; alerts: string[]; recallDue: string | null; nextAppointment?: string | null; lastVisit?: string | null }
export interface Appointment { id: string; patientId: string; dentistId: string | null; chairId: string | null; startsAt: string; endsAt: string; status: string; reason: string | null; note: string | null; remindedAt: string | null; arrivedAt: string | null; patient: { id: string; fileNo: number; alerts: string[]; name: string; phone: string | null; balance: number } | null }
export interface Finding { id: string; tooth: number; surfaces: string | null; kind: string; status: 'existing' | 'planned' | 'done'; note: string | null; planItemId: string | null; createdAt: string; removedAt: string | null }
export interface PlanItem { id: string; planId: string; procedureId: string | null; name: string; tooth: number | null; surfaces: string | null; phase: number; currency: 'IQD' | 'USD'; price: number; status: string; visitId: string | null }
export interface Plan { id: string; patientId: string; title: string; kind: string; status: string; optionGroup: string | null; discount: number; note: string | null; dentistId: string | null; createdAt: string; items: PlanItem[]; installments: { id: string; dueDate: string; amount: number; paidAt: string | null; note: string | null }[]; totals: { iqd: number; usd: number; net: number; done: number; count: number; rate: number } }

export function useSetup() {
  const { sys } = useApp();
  return useQuery<Setup>({ queryKey: ['dent-setup'], queryFn: () => remembered(`dent-setup.${sys.business.id}`, () => api('/v1/dent/setup')), staleTime: 60_000 });
}

/** Upper then lower, as a dentist faces the patient: 18…11 | 21…28 over 48…41 | 31…38 (primary: 55…51 | 61…65 over 85…81 | 71…75). */
export const ARCHES = {
  adult: { upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] },
  child: { upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65], lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] },
};
export const isUpper = (t: number) => [1, 2, 5, 6].includes(Math.floor(t / 10));
export const isAnterior = (t: number) => t % 10 <= 3;

export function ageOf(birth: string | null | undefined, d: { patients: { age: string; ageMonths: string } }) {
  if (!birth) return null;
  const b = new Date(birth), now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) y--;
  if (y >= 2) return d.patients.age.replace('{n}', String(y));
  const m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  return d.patients.ageMonths.replace('{n}', String(Math.max(0, m)));
}
export const isChild = (birth: string | null | undefined) => !!birth && Date.now() - +new Date(birth) < 12 * 365.25 * 86400_000;

/** Prices: IQD as money, USD as $n. */
export function usePrice() {
  const { money } = useApp();
  return (currency: string, price: number) => (currency === 'USD' ? `$${new Intl.NumberFormat('en-US').format(price)}` : money(price));
}
export const toIqd = (currency: string, price: number, rate: number) => (currency === 'USD' ? Math.round((price * rate) / 250) * 250 : price);

/** The day in Baghdad, as from/to instants (for the schedule). */
export function dayBounds(date: string) {
  const from = new Date(`${date}T00:00:00+03:00`);
  return { from, to: new Date(+from + 86400_000) };
}
export const todayISO = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(+new Date(`${date}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
export const hhmm = (d: string | Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date(d));
export const waLink = (phone: string | null | undefined, text?: string) => (phone ? `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null);
