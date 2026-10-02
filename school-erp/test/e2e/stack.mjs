// LOCAL TEST HARNESS ONLY — never deploy.
// Gives the app a Supabase-shaped API on http://localhost:54321 using
//   · a real PostgREST process (real RLS, real RPCs) against the migrated test database, and
//   · a minimal fake GoTrue (/auth/v1) that signs HS256 JWTs for users in auth.users.
// Every fake user's password is the value of E2E_PASSWORD (default "demo-pass-12345").
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'node:child_process';

const PORT = Number(process.env.PORT ?? 54321);
const REST = Number(process.env.REST_PORT ?? 54322);
const SECRET = process.env.JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
const PASSWORD = process.env.E2E_PASSWORD ?? 'demo-pass-12345';
const DB = process.env.TEST_DB ?? 'erp_seed';
const PGHOST = process.env.PGHOST ?? '/tmp/pg';
const PGPORT = process.env.PGPORT ?? '54329';

const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (payload) => {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify(payload));
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
};
const verify = (token) => {
  const [h, p, s] = String(token).split('.');
  if (!s || crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const pl = JSON.parse(Buffer.from(p, 'base64url').toString());
  return pl.exp * 1000 > Date.now() ? pl : null;
};
const psql = (sql) => pg.execFileSync('psql', ['-h', PGHOST, '-p', PGPORT, '-U', 'postgres', '-d', DB, '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();

const userByEmail = (email) => { const r = psql(`select id from auth.users where lower(email)=lower('${String(email).replace(/'/g, "''")}')`); return r || null; };
const userById = (id) => { const r = psql(`select email from auth.users where id='${String(id).replace(/[^0-9a-f-]/gi, '')}'`); return r ? { id, email: r } : null; };
const session = (u) => {
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: 'authenticated', role: 'authenticated', sub: u.id, email: u.email, iat: now, exp: now + 3600 };
  return { access_token: sign(claims), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: sign({ ...claims, kind: 'refresh', exp: now + 86400 }),
    user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
};

const readBody = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/auth/v1/')) {
      const route = url.pathname.slice('/auth/v1'.length);
      if (route === '/token') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        if (url.searchParams.get('grant_type') === 'password') {
          const id = body.password === PASSWORD ? userByEmail(body.email) : null;
          if (!id) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' });
          return json(res, 200, session({ id, email: body.email }));
        }
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const pl = verify(body.refresh_token);
          const u = pl && userById(pl.sub);
          return u ? json(res, 200, session(u)) : json(res, 400, { error: 'invalid_grant', msg: 'Invalid Refresh Token' });
        }
      }
      if (route === '/user') {
        const pl = verify((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
        const u = pl && userById(pl.sub);
        return u ? json(res, 200, { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
                 : json(res, 401, { code: 401, msg: 'invalid JWT' });
      }
      if (route === '/admin/users' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        if (userByEmail(body.email)) return json(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
        const id = crypto.randomUUID();
        psql(`insert into auth.users(id,email) values ('${id}','${String(body.email).replace(/'/g, "''")}')`);
        return json(res, 200, { id, aud: 'authenticated', role: 'authenticated', email: body.email, user_metadata: body.user_metadata ?? {}, app_metadata: {}, created_at: new Date().toISOString() });
      }
      if (route.startsWith('/admin/users/') && req.method === 'DELETE') {
        psql(`delete from auth.users where id='${route.split('/').pop().replace(/[^0-9a-f-]/gi, '')}'`);
        return json(res, 200, {});
      }
      if (route.startsWith('/admin/users/') && req.method === 'PUT') { await readBody(req); return json(res, 200, { id: route.split('/').pop() }); }
      if (route === '/logout') { res.writeHead(204); return res.end(); }
      if (route === '/recover') return json(res, 200, {});
      return json(res, 404, { msg: 'not implemented in test stack' });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const body = await readBody(req);
      const headers = { ...req.headers, host: `localhost:${REST}` };
      // Supabase sends the anon key as a bearer when logged out; PostgREST would reject it. Treat as anonymous.
      const bearer = (headers.authorization ?? '').replace(/^Bearer /i, '');
      if (!verify(bearer)) delete headers.authorization;
      const proxied = http.request({ host: '127.0.0.1', port: REST, path: url.pathname.slice('/rest/v1'.length) + url.search, method: req.method, headers }, (pr) => {
        res.writeHead(pr.statusCode, pr.headers); pr.pipe(res);
      });
      proxied.on('error', (e) => json(res, 502, { message: String(e) }));
      return proxied.end(body);
    }
    json(res, 404, { msg: 'not found' });
  } catch (e) { json(res, 500, { msg: String(e) }); }
});

const cfg = `db-uri = "postgres://postgres@%2Ftmp%2Fpg:${PGPORT}/${DB}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${SECRET}"
server-port = ${REST}
server-host = "127.0.0.1"
db-pool = 5
db-extra-search-path = "public, extensions"
`;
import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/pgrst/pgrst.conf', cfg);
const rest = spawn('/tmp/pgrst/postgrest', ['/tmp/pgrst/pgrst.conf'], { stdio: 'inherit' });
rest.on('exit', (c) => { console.log('postgrest exited', c); process.exit(1); });
server.listen(PORT, () => console.log(`test stack on :${PORT} (REST :${REST}, db ${DB})`));
process.on('SIGTERM', () => { rest.kill(); process.exit(0); });
