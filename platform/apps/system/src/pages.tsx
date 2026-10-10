// Which pages each edition has. Stores & Markets load with the app; the Dental edition's screens load only for clinics.
import { lazy, type ComponentType } from 'react';
import { Home } from './views/Home';
import { Sell } from './views/Sell';
import { Products } from './views/Products';
import { Customers } from './views/Customers';
import { Sales } from './views/Sales';
import { Purchases } from './views/Purchases';
import { Expenses } from './views/Expenses';
import { Shifts } from './views/Shifts';
import { Settings } from './views/Settings';
import { PlanPage } from './views/Plan';


export type Page = {
  path: string; icon: string; need: string | null; view: ComponentType;
  tab?: boolean;            // in the phone's tab bar
  hidden?: boolean;         // opened from elsewhere (a patient's file), not in the menu
  gapBefore?: boolean;      // a little space above it in the side menu
  label?: (t: any) => string;
};

const PLAN: Page = { path: 'plan', icon: 'sparkle', need: null, label: (t) => t.planPage.nav, view: PlanPage };

// ---- Website: the add-on every edition shares (its own chunk, loaded only when opened) ----
const site = () => import('./website');
const WebsitePage = lazy(() => site().then((m) => ({ default: m.Site })));
const WEBSITE: Page = { path: 'website', icon: 'globe', need: 'website.manage', view: WebsitePage, gapBefore: true };

// ---- Hemlo Connect: WhatsApp inbox, assistant and automations (real estate first; its own chunk) ----
const ConnectPage = lazy(() => import('./connect').then((m) => ({ default: m.Connect })));
const CONNECT: Page = { path: 'connect', icon: 'wa', need: 'leads.read', view: ConnectPage, label: (t) => t.nav.connect };

export const STORE_PAGES: Page[] = [
  { path: 'home', icon: 'home', need: 'reports.read', tab: true, view: Home },
  { path: 'sell', icon: 'sell', need: 'sales.create', tab: true, view: Sell },
  { path: 'products', icon: 'products', need: null, tab: true, view: Products },
  { path: 'customers', icon: 'customers', need: null, tab: true, view: Customers },
  { path: 'sales', icon: 'sales', need: 'sales.read', view: Sales },
  { path: 'purchases', icon: 'truck', need: 'purchases.read', label: (t) => t.purchases.title, view: Purchases, gapBefore: true },
  { path: 'expenses', icon: 'wallet', need: 'expenses.read', label: (t) => t.expenses.title, view: Expenses },
  { path: 'shifts', icon: 'drawer', need: 'reports.read', label: (t) => t.drawer.history, view: Shifts },
  PLAN,
  { path: 'settings', icon: 'gear', need: null, label: (t) => t.settings.title, view: Settings },
];

// ---- Gym: its own chunk ----
const gym = () => import('./gym');
const G = (name: string) => lazy(() => gym().then((m: any) => ({ default: m[name] })));
const gl = (k: string) => (t: any) => t.gnav[k] as string;
export const GYM_PAGES: Page[] = [
  { path: 'desk', icon: 'door', need: 'members.read', tab: true, view: G('Desk'), label: gl('desk') },
  { path: 'members', icon: 'customers', need: 'members.read', tab: true, view: G('Members'), label: gl('members') },
  { path: 'member', icon: 'user', need: 'members.read', hidden: true, view: G('MemberFile'), label: gl('member') },
  { path: 'renewals', icon: 'bell', need: 'members.read', tab: true, view: G('Renewals'), label: gl('renewals') },
  { path: 'classes', icon: 'calendar', need: 'members.read', view: G('Classes'), label: gl('classes') },
  { path: 'reports', icon: 'chart', need: 'reports.read', view: G('Reports'), label: gl('reports') },
  { path: 'sell', icon: 'sell', need: 'sales.create', view: Sell, label: gl('shop'), gapBefore: true },
  { path: 'products', icon: 'products', need: 'stock.read', view: Products },
  { path: 'customers', icon: 'wallet', need: 'customers.read', view: Customers, label: gl('accounts') },
  { path: 'sales', icon: 'sales', need: 'sales.read', view: Sales },
  { path: 'expenses', icon: 'wallet', need: 'expenses.read', label: (t) => t.expenses.title, view: Expenses },
  { path: 'shifts', icon: 'drawer', need: 'reports.read', label: (t) => t.drawer.history, view: Shifts },
  { path: 'gym', icon: 'dumbbell', need: 'gym.configure', view: G('Setup'), label: gl('gym') },
  PLAN,
  { path: 'settings', icon: 'gear', need: null, label: (t) => t.settings.title, view: Settings },
];

// ---- Real Estate: its own chunk ----
const estate = () => import('./realestate');
const R = (name: string) => lazy(() => estate().then((m: any) => ({ default: m[name] })));
const rl = (k: string) => (t: any) => t.renav[k] as string;
export const RE_PAGES: Page[] = [
  { path: 'today', icon: 'home', need: 'listings.read', tab: true, view: R('Today'), label: rl('today') },
  { path: 'properties', icon: 'store', need: 'listings.read', tab: true, view: R('Properties'), label: rl('properties') },
  { path: 'property', icon: 'store', need: 'listings.read', hidden: true, view: R('PropertyFile'), label: rl('property') },
  { path: 'studio', icon: 'plus', need: 'listings.create', hidden: true, view: R('Studio'), label: rl('studio') },
  { path: 'leads', icon: 'customers', need: 'leads.read', tab: true, view: R('Leads'), label: rl('leads') },
  { path: 'lead', icon: 'user', need: 'leads.read', hidden: true, view: R('LeadFile'), label: rl('lead') },
  { path: 'agenda', icon: 'calendar', need: 'viewings.read', tab: true, view: R('Agenda'), label: rl('agenda') },
  { path: 'deals', icon: 'wallet', need: 'deals.read', view: R('Deals'), label: rl('deals') },
  { path: 'contracts', icon: 'pen', need: 'deals.read', view: R('Contracts'), label: rl('contracts') },
  { path: 'contract', icon: 'pen', need: 'deals.read', hidden: true, view: R('ContractEditor'), label: rl('contract') },
  { path: 'owners', icon: 'user', need: 'listings.read', view: R('Owners'), label: rl('owners'), gapBefore: true },
  { path: 'collections', icon: 'clip', need: 'listings.read', view: R('Collections'), label: rl('collections') },
  { path: 'map', icon: 'globe', need: 'listings.read', view: R('MapView'), label: rl('map') },
  { path: 'reports', icon: 'chart', need: 'reports.read', view: R('Reports'), label: rl('reports') },
  { path: 'agency', icon: 'gear', need: 'agency.configure', view: R('Setup'), label: rl('agency') },
  CONNECT,
  WEBSITE,
  PLAN,
  { path: 'settings', icon: 'gear', need: null, label: (t) => t.settings.title, view: Settings },
];

// ---- School: its own chunk ----
const school = () => import('./school');
const SC = (name: string) => lazy(() => school().then((m: any) => ({ default: m[name] })));
const sl = (k: string) => (t: any) => t.snav[k] as string;
export const SCHOOL_PAGES: Page[] = [
  { path: 'today', icon: 'home', need: 'students.read', tab: true, view: SC('Today'), label: sl('today') },
  { path: 'students', icon: 'customers', need: 'students.read', tab: true, view: SC('Students'), label: sl('students') },
  { path: 'student', icon: 'user', need: 'students.read', hidden: true, view: SC('StudentFile'), label: sl('student') },
  { path: 'attendance', icon: 'calendar', need: 'attendance.read', tab: true, view: SC('Attendance'), label: sl('attendance') },
  { path: 'fees', icon: 'wallet', need: 'fees.read', tab: true, view: SC('Fees'), label: sl('fees') },
  { path: 'school', icon: 'gear', need: 'students.read', view: SC('Setup'), label: sl('school') },
  PLAN,
  { path: 'settings', icon: 'gear', need: null, label: (t) => t.settings.title, view: Settings },
];

// ---- Dental: its own chunk ----
const dental = () => import('./dental');
const D = (name: string) => lazy(() => dental().then((m: any) => ({ default: m[name] })));
export const DENTAL_PAGES: Page[] = [
  { path: 'today', icon: 'home', need: 'appointments.read', tab: true, view: D('Today'), label: (t) => t.dnav.today },
  { path: 'schedule', icon: 'calendar', need: 'appointments.read', tab: true, view: D('Schedule'), label: (t) => t.dnav.schedule },
  { path: 'patients', icon: 'customers', need: 'patients.read', tab: true, view: D('Patients'), label: (t) => t.dnav.patients },
  { path: 'patient', icon: 'user', need: 'patients.read', hidden: true, view: D('PatientFile'), label: (t) => t.dnav.patient },
  { path: 'lab', icon: 'flask', need: 'lab.read', tab: true, view: D('Lab'), label: (t) => t.dnav.lab },
  { path: 'customers', icon: 'wallet', need: 'customers.read', view: Customers, label: (t) => t.dnav.accounts },
  { path: 'reports', icon: 'chart', need: 'reports.read', view: D('Reports'), label: (t) => t.dnav.reports },
  { path: 'products', icon: 'products', need: 'stock.read', view: Products, label: (t) => t.dnav.materials, gapBefore: true },
  { path: 'purchases', icon: 'truck', need: 'purchases.read', label: (t) => t.purchases.title, view: Purchases },
  { path: 'expenses', icon: 'wallet', need: 'expenses.read', label: (t) => t.expenses.title, view: Expenses },
  { path: 'shifts', icon: 'drawer', need: 'reports.read', label: (t) => t.drawer.history, view: Shifts },
  { path: 'clinic', icon: 'tooth', need: 'clinic.configure', view: D('Clinic'), label: (t) => t.dnav.clinic },
  PLAN,
  { path: 'settings', icon: 'gear', need: null, label: (t) => t.settings.title, view: Settings },
];
