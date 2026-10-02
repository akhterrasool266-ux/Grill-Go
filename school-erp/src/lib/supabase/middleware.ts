import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = [
  /^\/$/, /^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/auth\//, /^\/site\//, /^\/offline/, /^\/offline-work/,
  /^\/api\/webhooks\//, /^\/api\/health$/, /^\/api\/cron\//, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/icons\//, /^\/favicon/,
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response; // misconfigured: pages render a setup notice

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() re-validates the token with Supabase Auth (getSession() would trust the cookie).
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((re) => re.test(path));

  if (!data.user && !isPublic && path.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });   // APIs answer 401, they never redirect to an HTML login page
  }
  if (!data.user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return response;
}
