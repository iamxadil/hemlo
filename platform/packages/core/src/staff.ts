// Hemlo team permissions (admin.hemlohq.com). Shared by the API, which enforces them, and the dashboard, which shows them.
// The founder (user.role = 'admin') holds every permission and cannot be changed. Everyone else is a hemlo_staff row.

export const STAFF_PERMISSIONS = [
  'overview.view',     // numbers and charts
  'requests.view',     // early-access requests
  'requests.update',   // notes, contacted, declined
  'requests.approve',  // create private access links
  'people.contact',    // full phone numbers and emails (otherwise masked)
  'users.view',        // everyone with an account
  'businesses.view',   // every business
  'usage.view',        // how shops use Hemlo, and the platform against its plan limits
  'billing.manage',    // extend trials, activate paid plans, set dentist seats
  'activity.view',     // what the team did, and when
  'team.view',         // who is on the team
  'team.manage',       // invite, change, suspend, remove teammates
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/** Holding the key implies the values. */
export const PERMISSION_IMPLIES: Partial<Record<StaffPermission, StaffPermission[]>> = {
  'requests.update': ['requests.view'],
  'requests.approve': ['requests.view'],
  'team.manage': ['team.view'],
  'usage.view': ['businesses.view'],
  'billing.manage': ['usage.view'],
};

/** Ready-made roles. A person can be given a role and then have single permissions added or removed ("custom"). */
export const STAFF_ROLES = {
  admin: [...STAFF_PERMISSIONS],
  onboarding: ['overview.view', 'requests.view', 'requests.update', 'requests.approve', 'people.contact', 'businesses.view'],
  support: ['overview.view', 'requests.view', 'people.contact', 'users.view', 'businesses.view', 'usage.view'],
  analyst: ['overview.view', 'requests.view', 'users.view', 'businesses.view', 'usage.view'],
} satisfies Record<string, StaffPermission[]>;
export type StaffRole = keyof typeof STAFF_ROLES | 'custom' | 'founder';

export const isStaffPermission = (p: unknown): p is StaffPermission => STAFF_PERMISSIONS.includes(p as StaffPermission);

/** Known permissions only, implied ones added, in catalogue order. */
export function normalizePermissions(list: readonly unknown[]): StaffPermission[] {
  const set = new Set(list.filter(isStaffPermission));
  for (const p of [...set]) for (const q of PERMISSION_IMPLIES[p] ?? []) set.add(q);
  return STAFF_PERMISSIONS.filter((p) => set.has(p));
}

/** The role name that matches a permission set exactly, or "custom". */
export function roleFor(perms: readonly StaffPermission[]): StaffRole {
  const key = normalizePermissions(perms).join();
  for (const [role, list] of Object.entries(STAFF_ROLES)) if (normalizePermissions(list).join() === key) return role as StaffRole;
  return 'custom';
}

/** You can only give, change or take away what you hold yourself. */
export const withinPermissions = (mine: readonly StaffPermission[], theirs: readonly StaffPermission[]) => theirs.every((p) => mine.includes(p));

/** s•••@shop.iq — enough to recognise, not enough to contact. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}•••@${domain ?? ''}`;
}

/** 0770 ••• ••11 */
export function maskIraqiPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const m = e164.match(/^\+964(\d{3})\d{5}(\d{2})$/);
  return m ? `0${m[1]} ••• ••${m[2]}` : '••••';
}
