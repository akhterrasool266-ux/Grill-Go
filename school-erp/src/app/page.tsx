import { redirect } from 'next/navigation';
import { configured, getIdentity, homeFor } from '@/lib/auth/session';

export default async function Root() {
  if (!configured()) redirect('/login');
  const id = await getIdentity();
  if (id?.profile) redirect(homeFor({ roles: id.roles, permissions: id.permissions }));
  if (id?.platform_admin) redirect('/platform');
  const slug = process.env.DEFAULT_SCHOOL_SLUG;
  redirect(slug ? `/site/${slug}` : '/login');
}
