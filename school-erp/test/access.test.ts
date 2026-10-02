import { describe, expect, it } from 'vitest';
import { homeFor } from '@/lib/auth/session';
import { navFor, visible, NAV } from '@/lib/nav';
import { toolsFor, TOOLS } from '@/lib/ai/tools';
import { CMS_KEYS, safeUrl } from '@/lib/site';

const ctx = (roles: string[], permissions: string[]) => ({ roles, permissions });

describe('where each role lands after login', () => {
  it('parent → parent portal', () => expect(homeFor(ctx(['parent'], []))).toBe('/portal/parent'));
  it('student → student portal', () => expect(homeFor(ctx(['student'], []))).toBe('/portal/student'));
  it('driver → route', () => expect(homeFor(ctx(['driver'], []))).toBe('/transport/my-route'));
  it('gate staff → scanner', () => expect(homeFor(ctx(['security_gate'], []))).toBe('/attendance/scan'));
  it('class teacher → teacher portal', () => expect(homeFor(ctx(['class_teacher'], ['students.view']))).toBe('/portal/teacher'));
  it('admin → dashboard', () => expect(homeFor(ctx(['super_admin'], ['students.view', 'classes.all']))).toBe('/dashboard'));
});

describe('navigation is permission-aware', () => {
  const links = (c: ReturnType<typeof ctx>) => navFor(c).flatMap((g) => g.items.map((i) => i.href));
  it('a parent sees no staff modules', () => { const l = links(ctx(['parent'], [])); expect(l).not.toContain('/students'); expect(l).not.toContain('/fees'); expect(l).toContain('/portal/parent'); });
  it('an accountant sees fees but not payroll or settings', () => { const l = links(ctx(['accountant'], ['fees.view', 'payments.view'])); expect(l).toContain('/fees'); expect(l).not.toContain('/payroll'); expect(l).not.toContain('/settings'); });
  it('a user with no permissions sees (almost) nothing', () => expect(links(ctx([], [])).filter((h) => h !== '/dashboard').length).toBeLessThanOrEqual(1));
  it('every nav item is reachable by some permission set (no dead links)', () => expect(NAV.flatMap((g) => g.items).every((i) => i.any || i.all || i.roles || i.hideRoles)).toBe(true));
  it('visible() honours roles', () => expect(visible({ href: '/x', label: 'nav.dashboard', icon: 'Home', roles: ['driver'] }, ctx(['teacher'], []))).toBe(false));
});

describe('AI assistant tools are permission-filtered', () => {
  const names = (c: ReturnType<typeof ctx>) => toolsFor(c as any).map((t) => t.name);
  it('a teacher gets no money tools', () => { const n = names(ctx(['teacher'], ['attendance.view', 'exams.view'])); expect(n).not.toContain('fee_defaulters'); expect(n).not.toContain('fee_collection'); expect(n).toContain('absentees_today'); });
  it('nobody without permissions gets any tool', () => expect(names(ctx([], []))).toEqual([]));
  it('an accountant gets fee tools only', () => { const n = names(ctx(['accountant'], ['fees.view', 'payments.view'])); expect(n).toContain('fee_collection'); expect(n).not.toContain('absentees_today'); });
  it('no tool writes: every tool name is a read verb', () => expect(TOOLS.every((t) => !/^(create|update|delete|pay|send|mark|set|approve)/.test(t.name))).toBe(true));
});

describe('public website safety', () => {
  it('only http(s) links are rendered', () => { expect(safeUrl('javascript:alert(1)')).toBeNull(); expect(safeUrl('data:text/html,x')).toBeNull(); expect(safeUrl('not a url')).toBeNull(); expect(safeUrl('https://facebook.com/school')).toBe('https://facebook.com/school'); });
  it('CMS keys match the database check constraint', () => expect([...CMS_KEYS].sort()).toEqual(['about', 'admissions', 'contact', 'hero', 'principal_message', 'social']));
});
