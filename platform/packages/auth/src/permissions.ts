// Who can do what inside a business. One list, used by the server (Better Auth + our API) and by the screens.
// Permissions are resource:action pairs. Editions add their own resources (jobs, warranty, parts … for Workshops).
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';

export const statements = {
  ...defaultStatements, // organization, member, invitation, team, ac (used by Better Auth's own endpoints)
  billing: ['manage'],
  settings: ['update'],
  counter: ['manage'],
  apikey: ['manage'],
  audit: ['read'],
  customers: ['create', 'read', 'update', 'delete'],
  sales: ['create', 'read', 'refund'],
  stock: ['read', 'adjust'],
  products: ['manage'],
  purchases: ['create', 'read'],
  expenses: ['create', 'read'],
  reports: ['read', 'export'],
  // Workshops edition
  jobs: ['create', 'read', 'update', 'update-own'],
  warranty: ['approve'],
  parts: ['use'],
  // Dental edition: patients (profile + medical history), clinical records (chart, notes, X-rays, prescriptions),
  // the schedule, the clinic's set-up (chairs, dentists, procedures and prices), and lab work
  patients: ['create', 'read', 'update'],
  clinical: ['read', 'write'],
  appointments: ['read', 'manage'],
  clinic: ['configure'],
  lab: ['read', 'manage'],
  // Gym edition: members (profile, health notes, photo), the door (check-ins), selling and managing memberships (pause,
  // cancel, change dates), coaching (measurements, training sessions, classes), and the gym's set-up (plans, coaches, hours)
  members: ['create', 'read', 'update'],
  checkin: ['create'],
  memberships: ['sell', 'manage'],
  training: ['read', 'write'],
  gym: ['configure'],
  // Real Estate edition: listings (add, edit, publish), leads (an agent sees their own unless they may read-all),
  // viewings and follow-ups, deals (offers, stages), commission (money: managers and accountants), and the agency's set-up
  listings: ['create', 'read', 'update', 'publish', 'archive'],
  leads: ['create', 'read', 'read-all', 'update', 'assign'],
  viewings: ['read', 'manage'],
  deals: ['read', 'manage'],
  commission: ['read', 'manage'],
  agency: ['configure'],
} as const;

export type Resource = keyof typeof statements;
export type Action<R extends Resource> = (typeof statements)[R][number];
export type Permissions = { [R in Resource]?: readonly Action<R>[] };

const all = statements as unknown as Permissions;
const without = (p: Permissions, drop: Resource[]) => Object.fromEntries(Object.entries(p).filter(([k]) => !drop.includes(k as Resource))) as Permissions;

export const ROLE_PERMISSIONS = {
  owner: all,
  admin: without(all, ['billing']),
  manager: {
    customers: ['create', 'read', 'update'], sales: ['create', 'read', 'refund'], stock: ['read', 'adjust'], products: ['manage'], purchases: ['create', 'read'], expenses: ['create', 'read'], reports: ['read'],
    jobs: ['create', 'read', 'update'], warranty: ['approve'], parts: ['use'], counter: ['manage'],
    patients: ['create', 'read', 'update'], appointments: ['read', 'manage'], lab: ['read', 'manage'],
    members: ['create', 'read', 'update'], checkin: ['create'], memberships: ['sell', 'manage'], training: ['read', 'write'],
    listings: ['create', 'read', 'update', 'publish', 'archive'], leads: ['create', 'read', 'read-all', 'update', 'assign'], viewings: ['read', 'manage'], deals: ['read', 'manage'], commission: ['read', 'manage'],
  },
  // the real-estate agent: their listings and leads, viewings, follow-ups and deals; their own commission is shown to them
  agent: {
    listings: ['create', 'read', 'update', 'publish'], leads: ['create', 'read', 'update'], viewings: ['read', 'manage'], deals: ['read', 'manage'], reports: ['read'],
  },
  // the dental clinic
  dentist: {
    patients: ['create', 'read', 'update'], clinical: ['read', 'write'], appointments: ['read', 'manage'], lab: ['read', 'manage'],
    customers: ['read'], sales: ['create', 'read'], stock: ['read', 'adjust'],
  },
  assistant: { patients: ['read', 'update'], clinical: ['read'], appointments: ['read', 'manage'], lab: ['read'], stock: ['read', 'adjust'] },
  receptionist: { patients: ['create', 'read', 'update'], appointments: ['read', 'manage'], customers: ['create', 'read', 'update'], sales: ['create', 'read'], lab: ['read'], stock: ['read'],
    members: ['create', 'read', 'update'], checkin: ['create'], memberships: ['sell'], training: ['read'],
    listings: ['read'], leads: ['create', 'read', 'read-all', 'update', 'assign'], viewings: ['read', 'manage'] },
  // the gym's coaches: their members, the door, measurements, sessions and classes; no money
  trainer: { members: ['read', 'update'], checkin: ['create'], training: ['read', 'write'], stock: ['read'] },
  cashier: { customers: ['create', 'read'], sales: ['create', 'read'], stock: ['read'], jobs: ['read'], members: ['read'], checkin: ['create'] },
  technician: { customers: ['read'], jobs: ['read', 'update-own'], parts: ['use'], stock: ['read'] },
  accountant: { sales: ['read'], reports: ['read', 'export'], customers: ['read'], stock: ['read'], purchases: ['read'], expenses: ['read'], patients: ['read'], lab: ['read'], members: ['read'], training: ['read'],
    listings: ['read'], deals: ['read'], commission: ['read', 'manage'] },
  viewer: { customers: ['read'], sales: ['read'], stock: ['read'], jobs: ['read'], reports: ['read'], members: ['read'], listings: ['read'] },
} satisfies Record<string, Permissions>;

export type RoleName = keyof typeof ROLE_PERMISSIONS;
export const ROLES = Object.keys(ROLE_PERMISSIONS) as RoleName[];
/** Roles ordered by power: someone may only give roles below their own (owners may give any). */
export const ROLE_RANK: Record<RoleName, number> = { owner: 6, admin: 5, manager: 4, agent: 3, dentist: 3, accountant: 3, assistant: 2, receptionist: 2, cashier: 2, technician: 2, trainer: 2, viewer: 1 };
/** Which roles make sense for which kind of business (the others are hidden when inviting). */
export const ROLES_FOR: Record<string, RoleName[]> = {
  dental: ['admin', 'manager', 'dentist', 'assistant', 'receptionist', 'accountant', 'viewer'],
  gym: ['admin', 'manager', 'receptionist', 'trainer', 'cashier', 'accountant', 'viewer'],
  realestate: ['admin', 'manager', 'agent', 'receptionist', 'accountant', 'viewer'],
  default: ['admin', 'manager', 'cashier', 'technician', 'accountant', 'viewer'],
};
export const PRIVILEGED: RoleName[] = ['owner', 'admin'];

export const ac = createAccessControl(statements);
export const roles = Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([name, p]) => [name, ac.newRole(p as any)])) as Record<RoleName, ReturnType<typeof ac.newRole>>;

/** What a shared counter device may do, whatever the unlocked person's role (the rest needs their own phone). */
export const COUNTER_ALLOWED: Permissions = {
  customers: ['create', 'read', 'update'], sales: ['create', 'read'], stock: ['read'], jobs: ['create', 'read', 'update', 'update-own'], parts: ['use'],
  // a clinic's shared device (reception, or chair-side): the unlocked person's role still decides the rest
  patients: ['create', 'read', 'update'], clinical: ['read', 'write'], appointments: ['read', 'manage'], lab: ['read', 'manage'],
  // the gym's front desk (or a coach's tablet)
  members: ['create', 'read', 'update'], checkin: ['create'], memberships: ['sell'], training: ['read', 'write'],
};

const has = (p: Permissions | undefined, resource: string, action: string) => !!(p as any)?.[resource]?.includes(action);

/** Does this role (comma-separated roles are allowed, as Better Auth stores them) have resource:action? */
export function roleCan(role: string, resource: Resource, action: string): boolean {
  return role.split(',').map((r) => r.trim()).some((r) => has((ROLE_PERMISSIONS as any)[r], resource, action));
}

export const counterCan = (role: string, resource: Resource, action: string) => roleCan(role, resource, action) && has(COUNTER_ALLOWED, resource, action);

export const canAssignRole = (actorRole: string, target: string) =>
  actorRole.split(',').includes('owner') || (ROLE_RANK[actorRole as RoleName] ?? 0) > (ROLE_RANK[target as RoleName] ?? 99);
