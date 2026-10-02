/**
 * Permission catalogue. MUST mirror the `permissions` seed in
 * supabase/migrations/0009_permissions_bootstrap.sql — test/catalogue.test.ts
 * fails if they drift apart.
 */
export const MODULES = {
  students: ['view', 'create', 'edit', 'delete', 'export', 'print'],
  guardians: ['view', 'create', 'edit', 'delete'],
  admissions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print'],
  academics: ['view', 'create', 'edit', 'delete', 'manage'],
  timetable: ['view', 'create', 'edit', 'delete', 'export', 'print'],
  attendance: ['view', 'create', 'edit', 'export', 'print', 'qr'],
  staff_attendance: ['view', 'create', 'edit', 'export'],
  fees: ['view', 'create', 'edit', 'delete', 'export', 'print', 'approve'],
  payments: ['view', 'create', 'edit', 'export', 'print', 'approve'],
  finance: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'manage'],
  exams: ['view', 'create', 'edit', 'delete', 'publish', 'manage', 'print'],
  marks: ['view', 'create', 'edit', 'approve', 'export'],
  results: ['view', 'create', 'publish', 'print', 'export'],
  promotion: ['view', 'create', 'approve'],
  homework: ['view', 'create', 'edit', 'delete'],
  staff: ['view', 'create', 'edit', 'delete', 'export', 'print'],
  payroll: ['view', 'create', 'edit', 'approve', 'export', 'print'],
  leave: ['view', 'create', 'edit', 'approve'],
  library: ['view', 'create', 'edit', 'delete', 'export'],
  transport: ['view', 'create', 'edit', 'delete', 'export'],
  hostel: ['view', 'create', 'edit', 'delete', 'export'],
  documents: ['view', 'create', 'delete', 'sensitive'],
  communication: ['view', 'create', 'manage', 'export'],
  announcements: ['view', 'create', 'edit', 'delete', 'publish'],
  calendar: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'export', 'print'],
  audit: ['view', 'export'],
  settings: ['view', 'edit', 'manage'],
  users: ['view', 'create', 'edit', 'delete'],
  roles: ['view', 'manage'],
  campuses: ['view', 'create', 'edit', 'delete'],
  cms: ['view', 'create', 'edit', 'delete', 'publish'],
  ai: ['use'],
  billing: ['view', 'manage'],
  financial: ['access'],
  campus: ['all'],
  classes: ['all'],
} as const;

export type ModuleName = keyof typeof MODULES;
export type PermissionCode = {
  [M in ModuleName]: `${M}.${(typeof MODULES)[M][number]}`;
}[ModuleName];

export const ALL_PERMISSIONS: PermissionCode[] = (Object.keys(MODULES) as ModuleName[]).flatMap(
  (m) => MODULES[m].map((a) => `${m}.${a}` as PermissionCode),
);

/** Grid shown on the permission screen. Actions are the columns, modules the rows. */
export const ACTION_COLUMNS = ['view', 'create', 'edit', 'delete', 'export', 'approve', 'print', 'publish', 'manage'] as const;
/** Everything that isn't a plain CRUD verb is shown in an "other" column. */
export const SPECIAL_ACTIONS = ['qr', 'sensitive', 'use', 'access', 'all'] as const;
