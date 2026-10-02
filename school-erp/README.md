# School ERP

A multi-tenant, multi-campus school management system for private schools and academies, built for Pakistan
(PKR, CNIC/B-Form, Urdu/RTL, WhatsApp-first communication).

Next.js 15 (App Router, server components + server actions) · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, Storage, Row Level Security).

> **Read this first — what is and isn't finished.** See [Status](#status--honest-limits) at the bottom. Short version:
> the core (students, admissions, attendance, fees, exams, HR/payroll, library, transport, hostel, portals, reports, audit,
> settings, public website, platform admin, AI quick-questions) is built and tested locally.
> **Not yet verified against live third parties:** WhatsApp/SMS/email providers, JazzCash, the AI free-text mode.
> **Not automatic:** backups.

---

## 1. Architecture in one page

| Layer | Choice | Why |
|---|---|---|
| UI + server | Next.js server components; mutations are server actions | Everything a user sees is rendered on the server from the database. No numbers are hard-coded; no browser-side data store. |
| Database | Supabase Postgres | RLS is the real security boundary. |
| Auth | Supabase Auth (email + password) | Login/logout/reset go through server actions; there is **no Supabase client in the browser**. |
| Files | Supabase Storage (`documents` private, `public-assets` public) | Magic-byte sniffing + size caps on the server. |
| Money | Postgres functions (`SECURITY DEFINER`) | The browser can never write money tables. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). |

Key rules (enforced in SQL, covered by tests):

1. **Tenant isolation** – every table has `school_id`; campus-scoped tables also `campus_id`. A user of school A can never read school B. A user limited to campus 1 can never read campus 2.
2. **Permissions** – 18 role templates, fully editable (Settings → Roles). Permissions are `module.action` (≈157). Checked in SQL (RLS + RPC), and again in the UI so buttons you can't use are hidden.
3. **Fees are computed by the database** – invoice balances, FIFO allocation, advance credit, family payments, late fines, refunds, daily closing. The browser only sends *what* to do, never amounts it expects to be trusted.
4. **Audit log is append-only** – every insert/update/delete on audited tables, with before/after diffs, user, IP.
5. **Nothing is faked** – an unconfigured provider marks the message `failed: provider_not_configured`; it is never shown as "sent".

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DATABASE.md](docs/DATABASE.md) · [docs/payments.md](docs/payments.md)

---

## 2. Quick start (local)

Requirements: Node ≥ 20, a Supabase project (free tier is fine), `psql` optional.

```bash
cd school-erp
npm install
cp .env.example .env.local        # then fill in the three Supabase values (below)
```

### 2.1 Create the database

1. Create a Supabase project. Region closest to your users (Mumbai for Pakistan).
2. Open **SQL Editor** and run every file in `supabase/migrations/` **in order** (`0001` … `0099`). Or with the Supabase CLI: `supabase link --project-ref <ref> && supabase db push`.
   - `0013_storage.sql` creates the two storage buckets and their policies.
   - `0099_grants.sql` must run last (privileges).
3. Auth settings (**Authentication → Providers/URL**):
   - Email provider **on**; **“Allow new users to sign up” OFF** (accounts are created by administrators only).
   - Site URL = your app URL; add `https://YOUR-APP/auth/callback` to Redirect URLs (password reset).
4. Copy from **Project Settings → API** into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design — RLS protects the data)
   - `SUPABASE_SERVICE_ROLE_KEY` — **server only. Never prefix with `NEXT_PUBLIC_`, never commit it, never paste it in client code.**

### 2.2 First school and first login

```bash
# a real school (prints a one-time temporary password for the owner)
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  npm run create:school -- --name "Bright Future Academy" --slug bright-future \
  --owner-name "Mr Owner" --owner-email owner@example.com
```

The owner must change the password at first sign-in. Further users are created in **Settings → Users**.
(Operators can also create schools in the browser at `/platform`, see §6.)

### 2.3 Demo data (optional — demo/staging projects only)

```bash
# 1) run supabase/seed.sql in the SQL editor  → "Al-Noor Grammar School (DEMO)": 2 campuses, 40 students, attendance, fees, a published exam…
# 2) create demo logins with a password YOU choose (never stored in the repo):
DEMO_PASSWORD='choose-a-long-password' npm run seed:users
```
Accounts: `admin@`, `principal@`, `accountant@`, `hr@`, `gate@`, `teacher@`, `parent@` `demo.test`. Anyone who knows the emails and password can sign in — keep demo data off production projects.

### 2.4 Run

```bash
npm run dev          # http://localhost:3000
npm run build && npm start
```

---

## 3. Environment variables

See `.env.example` (every variable is commented). Summary:

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything | public |
| `SUPABASE_SERVICE_ROLE_KEY` | user creation, public admission form, cron dispatch, webhooks, platform admin | **secret** |
| `NEXT_PUBLIC_APP_URL` | links in emails/messages, payment return URLs | |
| `CRON_SECRET` | `/api/cron/dispatch` | ≥ 24 random chars |
| `WHATSAPP_*`, `SMS_*`/`TWILIO_*`, `RESEND_API_KEY` | messaging | blank = channel disabled |
| `JAZZCASH_*` | online fee payment | blank = disabled; **unverified**, see docs/payments.md |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | AI free-text questions | optional; quick questions work without |
| `DEFAULT_SCHOOL_SLUG` | single-school installs: `/` shows that school's website | optional |

I never invent credentials: every provider reads its secrets from the environment, and the admin page *Settings → Notifications* only shows **whether** credentials exist, never their values.

---

## 4. Deploy (Vercel or Netlify)

1. Push the repo, import it, set **Root Directory = `school-erp`**.
2. Add the environment variables above (Production + Preview).
3. Deploy. Region: choose one near your Supabase region.
4. **Scheduler for the message outbox.** Queued WhatsApp/SMS/email are sent by `POST /api/cron/dispatch` with header `Authorization: Bearer $CRON_SECRET`. Call it every 1–5 minutes from any scheduler: Vercel Cron (Pro plan for sub-daily), cron-job.org, a GitHub Actions schedule, or Supabase `pg_cron` + `pg_net`. *Without a scheduler, messages stay `queued`; nothing is lost and nothing is faked.*
5. Webhooks (optional): WhatsApp delivery status → `/api/webhooks/whatsapp`; JazzCash return/IPN → `/api/webhooks/jazzcash`.
6. Custom domain for the public website: add the domain in your host; `/site/<slug>` is the school page (set `DEFAULT_SCHOOL_SLUG` to serve it at `/`).

**Rate limiting caveat:** the built-in limiter (login, admission form, AI assistant) is per server instance (in-memory). On serverless it slows casual abuse but is not a hard guarantee. For production put a shared limiter in front (Vercel Firewall, Cloudflare, Upstash) — at least for `/login` and `/site/*/apply`.

---

**Deploying for many customers, each on their own accounts:** see [docs/DEPLOY-CUSTOMER.md](docs/DEPLOY-CUSTOMER.md) (phone-friendly checklist, `scripts/migrate.mjs`, release and backup workflows in `deploy/`).

## 5. Features → where to find them

| Area | Route(s) | Notes |
|---|---|---|
| Dashboard | `/dashboard` | numbers from `dashboard_stats`/`dashboard_series` (RPC, permission-aware); per-user widget choices |
| Students, families | `/students`, `/families`, `/students/[id]` (12 tabs), `/students/import` | sibling detection by guardian phone; CSV import with preview |
| Admissions | `/admissions` | enquiry → application → review → admit → student |
| Attendance | `/attendance`, `/attendance/scan`, `/staff-attendance` | teachers need a reason to change past days; QR scanning; offline queue (transient only) |
| Timetable | `/timetable` | clash detection (teacher/room/section) enforced by the database |
| Fees | `/fees`, `/fees/collect`, `/fees/defaulters`, `/fees/closing` | vouchers, family billing, receipts, refunds, daily closing |
| Finance | `/finance`, `/finance/journal` | cash book, expenses, double-entry journal (must balance) |
| Exams | `/exams`, `/results`, `/promotion` | marks entry, grading, result cards, publish lock, promotion |
| HR | `/staff`, `/leave`, `/payroll` | salary structures, loans, payroll runs → approve → pay, payslips |
| Library / Transport / Hostel | `/library`, `/transport`, `/hostel` | drivers see only their own route |
| Homework, announcements, calendar | `/homework`, `/announcements`, `/calendar` | |
| Portals | `/portal/parent`, `/portal/student`, `/portal/teacher` | parent sees only their children (RLS) |
| Communication | `/communication`, `/settings/notifications` | templates (English/Urdu), outbox, provider status |
| Reports | `/reports` (~16 reports, CSV + print) | |
| Audit | `/audit` | append-only, CSV export |
| Settings | `/settings/*` | school, numbering, fees/attendance/payroll/library rules, users, roles & permission matrix, security, billing, backup |
| Public website | `/site/<slug>`, `/site/<slug>/apply`, editor at `/website` | online admission form → Admissions |
| Platform admin | `/platform` | schools, plans, subscriptions, feature switches, usage, tickets |
| AI assistant | `/assistant` | see §7 |
| Offline (attendance, marks) | `/offline-work`, “Keep available offline” buttons | see §5.1 |
| PWA | installable; `manifest.webmanifest`, `sw.js`, `/offline` | the service worker never caches signed-in pages |

Bilingual UI (English / اردو with RTL), dark mode, phone-first layout, global search (`/search`, header box).

### 5.1 Working offline (attendance and marks only)

**Scope on purpose:** only attendance sheets and marks sheets work offline. Fees, payroll, admissions and everything else need internet — money must never be recorded on two devices that cannot see each other.

How it works:
1. While online, a teacher taps **📥 Keep available offline** on a class's attendance page or a marks sheet. The first time, they choose a 4–8 digit PIN. A read-only copy of that class list (names, codes, current marks) is stored in the phone's IndexedDB for 14 days (refreshed each time the page is opened online).
2. With no internet, `/offline-work` still opens (the service worker caches this one data-free page), asks for the PIN, and lets the teacher fill in attendance (today up to 3 days back) or marks.
3. Their work waits in an on-phone **outbox**. When the phone is online again it is sent automatically (and from “Offline work → Send now”). A pill in the top bar shows *Offline / N waiting / N need attention*.
4. The server applies each item **once** (every queued item has an id; sending it twice changes nothing) and **never overwrites silently**:
   - Attendance: only fills what is missing. If someone already marked a different status, theirs is kept and the teacher is told.
   - Marks: each mark carries the value the phone saw (“base”). It is applied only if the server still has that value; otherwise the server's value is kept and shown as a conflict (“yours: 64, kept: 50”).
   - If the exam was locked/published while offline, or the back-fill window (3 days) has passed, the item is refused with a clear reason and kept on the phone to review or delete.
5. Every synced item is audit-logged (`offline_sync`).

Limits you should know:
- **It is a temporary copy, not the school's record.** Sign-out wipes it (after a warning if items are unsent); ten wrong PINs wipe it; it expires after 14 days.
- **The PIN is a gate, not encryption.** Offline, the system can't verify who holds the phone, so it asks for a PIN; data in the browser's storage is not encrypted. Tell teachers to keep their phone's screen lock on.
- Corrections to attendance that is already saved, and any new student/class changes, need internet.
- Tested: database functions (SQL tests), the outbox/sync/PIN logic (unit tests), and a real browser run against a production build with the network switched off (keep offline → work offline → reconnect → conflict shown → replay is a no-op → sign-out wipes). **Not tested** on real Android/iOS devices, on iOS Safari's storage eviction rules, or after a long (days) offline period with a changed login.
- An installed PWA / reopened browser tab is recommended on Android. Browsers may evict storage on a nearly full phone.

---

## 6. Multi-tenancy, plans and the platform admin

`/platform` is for the **software operator** (you), not school staff. A platform operator is a row in `platform_admins`:

```sql
-- after the person has signed up / been created in Supabase Auth:
insert into platform_admins (user_id) values ('<auth user uuid>');
```

From `/platform` you can create schools, define plans (limits: students, staff, campuses, storage, WhatsApp, SMS, AI requests; feature switches), assign subscriptions, override limits per school, force features on/off, **suspend** a school (its users immediately see nothing — RLS fails closed), and see usage and tickets.
Limits are enforced by database triggers (students/staff/campuses) and the message dispatcher/AI call. A school with no subscription row is unmetered (self-hosted mode). **There is no payment collection for subscriptions** — you record "paid until" by hand.

---

## 7. Integrations (interfaces are complete; connections are yours to configure)

| Integration | Code | Status |
|---|---|---|
| WhatsApp Business Cloud API | `src/lib/notify/providers/whatsapp-cloud.ts`, `/api/webhooks/whatsapp` | **Not tested against Meta.** Needs approved templates for business-initiated messages. |
| SMS (Twilio or generic HTTP gateway) | `providers/sms.ts` | Not tested against a live gateway. Adapt the generic one to your Pakistani vendor. |
| Email (Resend) | `providers/email.ts` | Not tested live. |
| JazzCash | `src/lib/payments/jazzcash.ts`, `/api/pay/jazzcash/start`, `/api/webhooks/jazzcash` | Signature check is unit-tested; **not sandbox-verified**. Checklist in docs/payments.md. |
| Easypaisa | `src/lib/payments/easypaisa.ts` | **Deliberately disabled** — its callback can't be authenticated without a transaction-inquiry call. See docs/payments.md. |
| Biometric / GPS | `attendance_device_events`, `vehicle_positions` tables + staff/route attendance RPCs | **Interface only** — storage and RPCs exist, there is no device driver or tracking map. |
| Web push | `push_subscriptions` table | Subscriptions can be stored; **no sender is implemented** (needs VAPID + `web-push`). |
| AI assistant | `src/lib/ai/*` | Quick questions run with no AI. Free text needs `ANTHROPIC_API_KEY`. |

**AI assistant details.** The assistant is read-only. Each tool runs with the *signed-in user's own Supabase client*, so RLS and permissions apply exactly as on the pages, and tools are only offered if the user holds a matching permission (a teacher cannot ask about fees). In free-text mode the question and the tool results (e.g. names of defaulters) **are sent to the AI provider** — turn it off (leave the key empty) if your school's policy forbids that. Usage is counted against the plan's `ai_requests`. The free-text path has been type-checked and its tool layer tested, but **has not been run against the live API** in development.

---

## 8. Backup and recovery — please read

**Backups are NOT automatic in this application.** Settings → Backup provides an on-demand CSV export of core tables (audit-logged) — useful for archiving, **not** a disaster-recovery backup.

For real protection use Supabase's own tools:
- Paid plans: enable daily backups / Point-in-Time Recovery in the Supabase dashboard.
- Free tier: **no managed backups.** Schedule `pg_dump` yourself (e.g. a GitHub Actions cron):
  ```bash
  pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom -f school-$(date +%F).dump
  ```
  and store the file somewhere other than Supabase. Practise a restore at least once.
- Storage files (documents, photos) are separate from the database dump.
- Free-tier projects **pause after ~7 days of no writes**; a school in production should be on a paid plan.

---

## 9. Security notes

- Row Level Security on every table (a test fails if one is missing). Money tables are read-only to clients.
- `SECURITY DEFINER` functions check permissions themselves; helper functions live in a `private` schema that PostgREST doesn't expose.
- CSP + security headers (middleware / `next.config.ts`); server actions have Next's built-in origin check; the one state-changing API route a browser calls (`/api/pay/jazzcash/start`) rejects cross-origin posts; webhooks and cron are authenticated by signature / `CRON_SECRET`.
- Uploads: size cap, magic-byte sniffing (not the browser's content type), safe file names, private bucket + signed access for documents.
- CSV export neutralises spreadsheet formula injection.
- Public admission form: honeypot, IP rate limit, server-side validation; only calls one function that inserts one application row.
- The public website reads with the service-role key but only published rows of one active school and an explicit column list (`src/lib/site.ts`).
- **Policy flags, not enforcement:** `session_timeout_minutes` and `require_2fa_for_admins` are stored settings; **2FA is not implemented** and session length is governed by Supabase Auth's own settings. Don't tell customers 2FA exists.
- Temporary passwords for new users are shown once on screen (in the redirect URL) and must be changed at first sign-in. Share them privately.

---

## 10. Testing

```bash
npm run typecheck
npm test            # vitest: validation, CSV/import, uploads, templates, JazzCash signature, nav/permissions, AI tool gating, catalogue ↔ SQL parity
npm run test:db     # needs a local Postgres 16: rebuilds a scratch DB, applies all migrations, runs SQL tests
```
`test:db` (scripts/db-reset.sh) uses `PGHOST/PGPORT/PGUSER`; it stubs Supabase's `auth` schema so no Supabase is needed. SQL tests cover: RLS coverage, tenant and campus isolation, privilege escalation, audit immutability, plan limits, fees (generation, discounts, siblings, late fines, FIFO allocation, advance credit, family payments, refunds, daily closing, defaulters), online-payment idempotency and amount checks, attendance rules, timetable clashes, marks locking/publishing, grading, promotion, payroll, leave, library, suspension, usage metering, bulk messaging.

End-to-end flows were driven through a real browser against a local PostgREST (see `test/e2e/`); that harness is **local only — never deploy it**.

---

## 11. Status & honest limits

**Built and tested locally**: everything in §5.

**Known gaps**
- Timetable editing is click-to-edit, **not drag-and-drop**.
- PDFs are produced with the browser's *Print → Save as PDF* (print-optimised pages), not server-generated PDFs.
- Import is **CSV only** (no .xlsx).
- No two-way parent–teacher chat (announcements, homework and messages are one-way).
- No hostel attendance; hostel has rooms/allocations/fees only.
- GPS tracking and biometric devices: storage and APIs only (see §7).
- Web push: no sender. 2FA: not implemented. Session timeout: setting only.
- **Backups are not automatic** (§8).
- Storage uploads (photos/documents) were not exercised end-to-end locally (the local harness has no Storage service); the code path is type-checked and the upload-validation logic is unit-tested.
- WhatsApp/SMS/email/JazzCash/AI-live were never run against the real services (no credentials were available). Treat them as "implemented, unverified" until you run the sandbox checklist.
- Subscriptions are recorded by hand; no billing/payment collection for SaaS plans.
- Rate limiting is per instance (§4).
- Offline works for attendance and marks only (§5.1); not tested on real phones.
- Not load-tested.

Licence: all rights reserved by the repository owner unless stated otherwise.
