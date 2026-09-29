# [BRAND_NAME] — server-rendered ecommerce store

A complete Pakistani ecommerce storefront built for **Cloudflare Workers + Supabase
+ Cloudinary**. Every page is rendered **on the server**, so Google sees the full
product name, price, description and structured data in the first response —
without running any JavaScript.

Built to be resold: change **one file** (`src/config.js`) and it becomes a
different brand.

---

## What is in the box

| | |
|---|---|
| **Storefront** | Home, all products, category pages, per-product pages, search, cart, checkout, order confirmation, order tracking |
| **SEO** | Server-side rendering, unique title + meta description per page, canonical URLs, Open Graph, Twitter cards, `robots.txt`, dynamic `sitemap.xml`, Product / Organization / WebSite / BreadcrumbList / FAQ JSON-LD, semantic HTML, image alt text, WebP+AVIF, lazy loading |
| **Crawlable URLs** | `/`, `/products`, `/category/<name>`, `/product/<name>` — no login, no clicking needed |
| **Payments** | Cash on delivery + a modular gateway layer for JazzCash, Easypaisa and cards. Verified **server-side**, never from the browser |
| **Admin** | Login, products (images, packs, stock, SEO fields), categories, orders, customers, coupons, settings, analytics — all responsive |
| **Performance** | Cloudflare edge cache, Cloudinary `f_auto,q_auto`, responsive `srcset`, lazy loading, fixed image dimensions (no layout shift), one small JS file |
| **PWA** | Manifest, icons, theme colour, installable on Android, safe service worker (HTML is never cached) |
| **Security** | Row Level Security, service-role key only on the server, price re-validation in the database, HMAC-verified payment callbacks, rate limiting, input validation, XSS-safe rendering |

---

## Setup — do this once per store

### 1. Supabase (database)

1. Go to **supabase.com** → New project. Save the database password.
2. Open **SQL Editor → New query**, paste all of **`schema.sql`**, press **Run**.
3. Go to **Authentication → Users → Add user**. Use your own email and a strong
   password. Tick "Auto confirm user".
4. Back in the SQL Editor, run these two lines with your email:

   ```sql
   insert into public.admin_users (id, email, role)
   select id, email, 'admin' from auth.users where email = 'you@example.com'
   on conflict (id) do nothing;
   ```

5. (Optional, for a demo store) run **`seed.sql`** to get 5 sample products.
6. Go to **Project Settings → API** and copy three things:
   * Project URL
   * `anon` public key
   * `service_role` secret key ← **this one is secret, never put it in a file**

### 2. Cloudinary (images)

1. Sign up at **cloudinary.com** (free).
2. **Settings → Upload → Add upload preset** → Signing mode: **Unsigned** → Save.
3. Note your **Cloud name** and the **preset name**. You will paste them into the
   admin panel later.

### 3. Admin panel

Open `public/admin.html` and paste your Supabase URL and **anon** key into the two
lines near the top:

```js
const SUPABASE_URL      = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

The anon key is safe here — Row Level Security decides what it can do.

### 4. GitHub

Upload the whole folder to a new repository. Do **not** upload `node_modules`.

### 5. Cloudflare

1. **Workers & Pages → Create → Workers → Import a repository** → pick your repo.
2. Deploy. Cloudflare reads `wrangler.jsonc` automatically. There is no build step.
3. Open the worker → **Settings → Variables and Secrets** and add:

   | Name | Type | Value |
   |---|---|---|
   | `SUPABASE_URL` | Text | `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | Text | `eyJ...` (anon) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | `eyJ...` (service_role) |
   | `SITE_URL` | Text | your final domain, e.g. `https://brand.com` (optional) |

4. Click **Deploy** again so the variables take effect.

### 6. Finish in the admin panel

Open `https://<your-worker>.workers.dev/admin`, sign in, then in **Settings**:
brand name, logo, WhatsApp number, Cloudinary cloud name + preset, shipping,
COD fee, theme colours, GA4 and Meta Pixel IDs. Save.

### 7. Tell Google about the site

1. **search.google.com/search-console** → add your domain.
2. Copy the verification code into admin **Settings → Google Search Console
   verification code**, save, then press Verify.
3. Submit `https://yourdomain.com/sitemap.xml`.

### 8. Keep Supabase from pausing

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**

* `SUPABASE_URL`
* `SUPABASE_ANON_KEY`

`.github/workflows/keep-alive.yml` then writes to the database every 3 days, so the
free project is never paused for inactivity.

---

## Turning on online payments

A payment method only appears at checkout once its variables exist in Cloudflare.
Until then customers see cash on delivery only — nothing breaks.

**JazzCash** — add as **Secrets**:
`JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_SALT`,
and `JAZZCASH_ENV` = `sandbox` or `live`.
Give JazzCash this return URL: `https://yourdomain.com/api/payments/jazzcash/callback`

**Easypaisa** — `EASYPAISA_STORE_ID`, `EASYPAISA_HASH_KEY`, `EASYPAISA_ENV`.
Post-back URL: `https://yourdomain.com/api/payments/easypaisa/callback`

**Card / any aggregator** (Safepay, PayFast, Alfa, 2Checkout…) —
`CARD_CHECKOUT_URL`, `CARD_MERCHANT_ID`, `CARD_SECRET`, and optionally
`CARD_FIELD_MAP` (JSON) if the provider uses different field names.
Return URL: `https://yourdomain.com/api/payments/card/callback`

> **Test in sandbox first.** Every gateway publishes its own integration
> document, and field names change between versions. `src/payments.js` implements
> the standard shape for each one and verifies the signature, but you must confirm
> the exact parameter list against the document your merchant account is issued
> with before going live.

**What is guaranteed regardless of gateway:**
an order is only marked *paid* by a callback whose signature we verify with the
secret key, and whose amount matches our own record. A browser can never mark an
order paid. Every gateway message is stored in `payment_transactions`, and an
order that is already paid can never be downgraded by a replayed message.

---

## Changing the brand

Everything a customer sees comes from two places:

1. **`src/config.js`** — defaults committed to the repository
   (`brandName`, logo, colours, trust bar, footer links, currency…).
2. **Admin → Settings** — overrides saved in the database, no redeploy needed.

The database wins. So for a new customer: edit `config.js` once, deploy, then hand
them the admin panel.

---

## Project layout

```
wrangler.jsonc          Cloudflare config (name, entry point, static assets)
schema.sql              All tables, indexes, RLS policies, order function
seed.sql                Demo products (optional)
src/
  index.js              Router + every server-rendered route + the API
  config.js             ← THE FILE YOU EDIT PER CUSTOMER
  lib.js                Supabase client, escaping, money, Cloudinary helpers
  seo.js                <head>, JSON-LD, sitemap, robots
  styles.js             The whole stylesheet (mobile-first)
  layout.js             Header, drawer, footer, tracking snippets
  payments.js           COD / JazzCash / Easypaisa / card + settlement
  pages/shop.js         Home, listings, category, search, product card
  pages/product.js      Product detail page
  pages/flow.js         Cart, checkout, order, tracking, errors, policy pages
public/
  admin.html            The admin panel
  app.js                Cart, gallery, slider, search suggestions, checkout
  sw.js                 Service worker (assets only — never HTML)
  icons/                PWA icons, logo, social share image
test/render.test.mjs    Renders every route against a fake database
```

Run the tests with `node test/render.test.mjs`.

---

## Notes and limits

* **`/admin` is protected by login**, not by hiding it. Tapping the logo three
  times also opens it. To move it somewhere else, change `adminPath` in
  `src/config.js` — `robots.txt` follows automatically.
* **Order tracking is deliberately not public in the database.** Order numbers
  run in sequence, so an open `track_order` endpoint could be brute-forced with
  guessed phone digits. Only the Worker may call it, using the service-role key,
  and the Worker rate-limits it to 12 lookups per minute per visitor.
* **`is_admin()` lives in a `private` schema**, so it is never reachable over the
  REST API while row level security can still use it. Extensions live in an
  `extensions` schema. Supabase's security advisor reports zero warnings.
* **The cart lives in the visitor's browser.** Prices in it are only for display;
  the database recalculates every figure when the order is placed.
* **Supabase free tier** allows 2 active projects. Each store needs its own.
* **Rate limiting** in the Worker is per-region and best-effort. For a busy store,
  add a Cloudflare Rate Limiting rule on `/api/*` as well.
* **Easypaisa**: some merchant accounts require an AES-128-ECB request hash, which
  the Workers runtime cannot produce. Those accounts should use the un-hashed
  hosted checkout or go through an aggregator using the `card` adapter. Responses
  are verified either way.
