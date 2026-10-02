import type { IconName } from '@/components/ui/icon';
import type { MessageKey } from '@/lib/i18n/en';
import { can, hasRole, type Ctx } from '@/lib/auth/session';

export interface NavItem {
  href: string; label: MessageKey; icon: IconName;
  any?: string[];            // visible if user has ANY of these permissions
  all?: string[];            // …and ALL of these
  roles?: string[];          // visible only for these roles
  hideRoles?: string[];      // hidden for these roles
}
export interface NavGroup { label?: MessageKey; items: NavItem[] }

const staffOnly = ['parent', 'student', 'driver', 'security_gate'];

export const NAV: NavGroup[] = [
  { items: [
    { href: '/dashboard', label: 'nav.dashboard', icon: 'LayoutDashboard', hideRoles: staffOnly },
    { href: '/portal/teacher', label: 'nav.myClass', icon: 'BookOpen', roles: ['teacher', 'class_teacher'] },
    { href: '/portal/parent', label: 'nav.myChildren', icon: 'Heart', roles: ['parent'] },
    { href: '/portal/student', label: 'nav.home', icon: 'Home', roles: ['student'] },
    { href: '/transport/my-route', label: 'nav.transport', icon: 'Bus', roles: ['driver'] },
    { href: '/attendance/scan', label: 'nav.scan', icon: 'ScanLine', roles: ['security_gate'] },
  ] },
  { label: 'nav.group.people', items: [
    { href: '/students', label: 'nav.students', icon: 'Users', any: ['students.view'] },
    { href: '/admissions', label: 'nav.admissions', icon: 'UserPlus', any: ['admissions.view'] },
    { href: '/families', label: 'nav.families', icon: 'Heart', any: ['guardians.view'] },
    { href: '/staff', label: 'nav.staff', icon: 'BriefcaseBusiness', any: ['staff.view'] },
  ] },
  { label: 'nav.group.academics', items: [
    { href: '/attendance', label: 'nav.attendance', icon: 'ClipboardCheck', any: ['attendance.view', 'attendance.create'], hideRoles: ['security_gate'] },
    { href: '/staff-attendance', label: 'nav.staffAttendance', icon: 'Clock', any: ['staff_attendance.view'] },
    { href: '/timetable', label: 'nav.timetable', icon: 'CalendarDays', any: ['timetable.view'] },
    { href: '/homework', label: 'nav.homework', icon: 'BookOpen', any: ['homework.view'] },
    { href: '/exams', label: 'nav.exams', icon: 'GraduationCap', any: ['exams.view'] },
    { href: '/promotion', label: 'nav.promotion', icon: 'ArrowUpCircle', any: ['promotion.view'] },
    { href: '/academics', label: 'nav.academics', icon: 'Shapes', any: ['academics.view'], hideRoles: ['teacher', 'class_teacher'] },
  ] },
  { label: 'nav.group.money', items: [
    { href: '/fees', label: 'nav.fees', icon: 'Wallet', any: ['fees.view'] },
    { href: '/fees/collect', label: 'nav.collect', icon: 'Banknote', any: ['payments.create'] },
    { href: '/fees/defaulters', label: 'nav.defaulters', icon: 'AlertCircle', any: ['fees.view'] },
    { href: '/finance', label: 'nav.finance', icon: 'Landmark', all: ['finance.view', 'financial.access'] },
    { href: '/payroll', label: 'nav.payroll', icon: 'Receipt', all: ['payroll.view', 'financial.access'] },
  ] },
  { label: 'nav.group.operations', items: [
    { href: '/leave', label: 'nav.leave', icon: 'Plane', any: ['leave.view', 'leave.create'] },
    { href: '/library', label: 'nav.library', icon: 'Library', any: ['library.view'] },
    { href: '/transport', label: 'nav.transport', icon: 'Bus', any: ['transport.view'], hideRoles: ['driver'] },
    { href: '/hostel', label: 'nav.hostel', icon: 'BedDouble', any: ['hostel.view'] },
    { href: '/documents', label: 'nav.documents', icon: 'FolderOpen', any: ['documents.view'] },
    { href: '/communication', label: 'nav.communication', icon: 'MessageSquare', any: ['communication.view'] },
    { href: '/announcements', label: 'nav.announcements', icon: 'Megaphone', any: ['announcements.view'], hideRoles: ['driver'] },
    { href: '/calendar', label: 'nav.calendar', icon: 'CalendarDays', any: ['calendar.view'] },
  ] },
  { label: 'nav.group.insights', items: [
    { href: '/reports', label: 'nav.reports', icon: 'BarChart3', any: ['reports.view'] },
    { href: '/assistant', label: 'nav.assistant', icon: 'Sparkles', any: ['ai.use'] },
    { href: '/audit', label: 'nav.audit', icon: 'ScrollText', any: ['audit.view'] },
  ] },
  { label: 'nav.group.admin', items: [
    { href: '/website', label: 'nav.website', icon: 'Globe', any: ['cms.view'] },
    { href: '/settings', label: 'nav.settings', icon: 'Settings', any: ['settings.view', 'users.view', 'roles.view', 'campuses.view'] },
  ] },
];

export function visible(item: NavItem, ctx: Pick<Ctx, 'permissions' | 'roles'>): boolean {
  if (item.roles && !hasRole(ctx, ...item.roles)) return false;
  if (item.hideRoles && hasRole(ctx, ...item.hideRoles) && !can(ctx, 'settings.manage')) return false;
  if (item.any && !can(ctx, ...item.any)) return false;
  if (item.all && !item.all.every((p) => ctx.permissions.includes(p))) return false;
  return true;
}

export function navFor(ctx: Pick<Ctx, 'permissions' | 'roles'>): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, ctx)) })).filter((g) => g.items.length > 0);
}

/** The handful of destinations shown in the phone bottom bar. */
const BOTTOM_PRIORITY = ['/dashboard', '/portal/parent', '/portal/student', '/portal/teacher', '/attendance/scan', '/transport/my-route', '/students', '/attendance', '/fees/collect', '/fees', '/exams', '/staff'];
export function bottomNav(groups: NavGroup[]): NavItem[] {
  const all = groups.flatMap((g) => g.items);
  const picked: NavItem[] = [];
  for (const href of BOTTOM_PRIORITY) {
    const it = all.find((i) => i.href === href);
    if (it && !picked.includes(it)) picked.push(it);
    if (picked.length === 4) break;
  }
  return picked;
}
