# Deploying for a customer (their accounts, their data)

Model: **each school owns its own GitHub repo, Supabase project and hosting account**, created with the school's email.
You (the software house) are added as a collaborator to support them and to ship updates. The school's data lives only in the school's Supabase project.

You can do all of this from a phone browser. Nothing here needs a terminal.

## 0. Who owns what

| Thing | Owner | Your access |
|---|---|---|
| GitHub repo (code copy) | school's GitHub account | collaborator (write) |
| Supabase project (database, logins, files) | school's Supabase account | invited member, only while supporting |
| Hosting (Vercel or similar) | school's account | invited member, optional |
| Domain name | school | none needed |
| The `service_role` key | school's Supabase + hosting settings | **don't copy it anywhere else**; GitHub Actions secrets of *their* repo only |

Tell the customer in writing who can see their data and that they can remove your access any time.

## 1. One-time per customer (≈ 30–45 minutes)

**A. Supabase (school's account)**
1. Create the project. Region near the school (Mumbai for Pakistan). Set a strong database password and save it.
2. **Plan:** for a real school use a **paid** plan. Free projects pause after about a week without writes and have no managed backups. (Check Supabase's current pricing page.)
3. Authentication → Providers → Email **on**. “Allow new users to sign up” **off**. URL Configuration: Site URL = the school's app address, add `https://<app>/auth/callback` as a redirect URL (do this after step C).
4. Project Settings → API: note the **Project URL**, **anon key**, **service_role key**.
5. Project Settings → Database → Connection string → **Session pooler** URI (replace `[YOUR-PASSWORD]`).

**B. GitHub (school's account)**
1. Create the repo from your template (private). Add yourself as collaborator.
2. Add these **Actions secrets** (Settings → Secrets and variables → Actions):
   - `SUPABASE_DB_URL` = the pooler URI
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` = from step A4 (used only by the “Create school” workflow)
3. Actions tab → **Update database** → Run workflow → `status`, then `up`. This creates all tables. If someone already pasted the SQL by hand, choose `baseline` once instead.
4. Actions tab → **Create school** → Run workflow → fill name, web name, owner's name and email. Copy the temporary password from the log, **then delete that run**. Give it to the owner privately.

**C. Hosting (school's account, e.g. Vercel)**
1. Import the repo. Framework: Next.js. Root directory: the repo root.
2. Environment variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` (random 32+ chars), `DEFAULT_SCHOOL_SLUG` (the web name, so `/` shows the school website). Provider keys (WhatsApp/SMS/email/JazzCash/AI) only when the school has them — see README §3.
3. Deploy. Open `https://<app>/api/health` — it should say `"ok": true, "database": "ok"` and show the version.
4. **Vercel's free “Hobby” plan is for personal, non-commercial projects; a school is a business — check Vercel's current terms and use a paid plan if required.** Other hosts that run Next.js work too.
5. Message outbox scheduler: every few minutes call `POST https://<app>/api/cron/dispatch` with header `Authorization: Bearer <CRON_SECRET>` (cron-job.org is free and phone-friendly; Vercel Cron needs a paid plan for sub-daily). Until it is set, WhatsApp/SMS/email stay “queued” (nothing is lost, nothing is faked).

**D. Hand-over checklist** — sign in as the owner and change the password; Settings → school profile, logo, academic year, classes; create users; send a test message only after provider keys exist; take the first backup (§3).

## 2. Shipping updates to customers

Customers do not edit code. Everything school-specific is in their database (Settings) and their host's environment variables, so a release can safely overwrite the code.

1. Merge your change into the master repo; bump `version` in `package.json`; note it in `CHANGELOG.md`.
2. Add each customer's `owner/repo` to `school-erp/deploy/customers.txt` (once).
3. Add the repo secret `CUSTOMER_REPOS_TOKEN` in the master repo (a classic GitHub token with `repo` scope from the account that is a collaborator on every customer repo).
4. Actions tab → **School ERP release** → Run workflow.
   - Type one `owner/repo` in “only” to release to **one customer first** (canary). Check their `/api/health`, then run again with it empty for everyone.
   - The workflow runs typecheck and tests first and sends nothing if they fail.
5. In each customer repo the push triggers the host's redeploy, and — if the release has new files in `supabase/migrations` — the **Update database** workflow applies them. Look at the Actions tab of one customer to confirm it's green.

Rules that keep this safe:
- **Never edit a migration that has been released.** Add a new numbered file. The migrate script refuses to continue if an applied file changed.
- Each migration file runs in a transaction: it fully applies or leaves nothing.
- Make migrations backward compatible when you can (add columns, don't rename), because the code deploy and the migration are separate steps by a minute or two.
- If a release is bad: revert in the master repo and release again. Database changes are not rolled back automatically — write a new corrective migration.

> The release and migrate workflows were written and syntax-checked, and the file-copy logic was exercised against a local test repository, but they have **not** been run on GitHub itself. Do the first run on a throw-away customer.

## 3. Backups (still manual unless you set them up)

- Best: the paid Supabase plan's daily backups / point-in-time recovery, switched on in the school's Supabase dashboard.
- Extra: the optional **Backup (encrypted)** workflow (daily `pg_dump`, encrypted with `BACKUP_PASSPHRASE`, kept 14 days as a private artifact). Anyone with access to the repo's Actions can download the encrypted file — they still need the passphrase. Store the passphrase outside GitHub too. Untested on GitHub; run it once and **practise a restore**.
- Uploaded files (photos, documents) are in Supabase Storage and are *not* part of the database dump.

## 4. Handing the school its data

Because everything is in the school's own accounts, leaving is easy: transfer the repo, remove your collaborator access, and the school keeps the live system. Settings → Backup also exports core tables to CSV.

## 5. What it costs you to maintain this model

Every customer is another repo, database and hosting account to keep healthy. The release workflow removes the manual work for code, but not the support: expired cards, paused free-tier projects, a customer who changed an env var. Budget time for that, or consider a single multi-tenant installation (`/platform`) for customers who don't need their own accounts.
