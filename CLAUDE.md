# Project context for Claude

Read this first. It carries the decisions and the hard-won lessons from the
build so you don't re-litigate them or repeat mistakes that were already made
and fixed once.

## What this is

A server-rendered e-commerce storefront for Pakistan, built to be **resold**.
One codebase, one config file per customer. The live demo brand is **Skinova**
(skincare). The owner is Akhter, who runs A A Traders and the software house
**Softnex**, and sells these stores as a one-time-fee package.

**He works almost entirely from an Android phone.** This is the single most
important constraint. It rules out anything needing a terminal, a local build
step, or heavy copy-paste. Keep deliverables to files he can upload to GitHub,
or make the change in the repo directly.

He writes in Roman Urdu mixed with English technical terms. Reply the same way.

## Stack

| Layer | Choice |
|---|---|
| Hosting + SSR | Cloudflare Worker (`src/index.js`), no build step |
| Database / auth | Supabase (Postgres + RLS) |
| Images | Cloudinary (`f_auto,q_auto` + srcset) |
| Admin | Single static page, `public/admin.html`, Supabase Auth |
| Deploy | GitHub → Cloudflare Workers Builds |

**Why a Worker and not Next.js:** the spec asked for "Next.js or another
framework that properly supports SSR on Cloudflare". A plain Worker gives the
same server-rendered HTML with no `npm build`, which keeps the whole project
maintainable from a phone. Don't migrate to a framework without a reason that
beats that.

## Live Supabase project (Skinova demo)

* Organization: **Softnex** (account `abdullah.zahid258001@gmail.com` — a second
  account, because Supabase's free plan caps **2 active projects per account**,
  not per organization)
* Project ref: `nezatsxwiavpgiatnuzt`
* URL: `https://nezatsxwiavpgiatnuzt.supabase.co`
* Region: `ap-south-1` (Mumbai — closest to Pakistan; Sparq is in Sydney by
  mistake and is noticeably slower)

The `anon` key is committed in `public/admin.html` on purpose: it is public by
design and RLS is what protects the data. **The `service_role` key must never
appear in any file** — it lives only as a Cloudflare Worker secret.

## Architecture rules that must not be broken

1. **Everything a customer or Google sees is rendered on the server.** Product
   name, price, description, JSON-LD — all in the first HTML response. If you
   find yourself fetching products in the browser to render a page, stop.
2. **Money is never trusted from the browser.** `public.create_order(jsonb)`
   recomputes every price, the COD fee, shipping and the coupon from the
   database. The browser only sends product ids and quantities.
3. **An order is only marked paid by a verified callback.** Signature checked
   with the gateway secret, amount matched against our own record, every message
   logged to `payment_transactions`, and a paid order can never be downgraded.
4. **No secret in frontend code.** Gateway credentials and the service-role key
   are Worker environment variables only.
5. **`src/config.js` is the only file that changes per customer.** Anything a
   shop owner might want to change belongs in Supabase `store_settings`
   (admin-editable) with a `config.js` fallback. DB value wins.

## Bugs already found and fixed — do not reintroduce

* **Pack stock.** Selling a "Buy 2" pack must remove **2** units from product
  stock, not 1. `create_order` multiplies quantity by `product_variants.qty`.
* **Order tracking was brute-forceable.** Order numbers are sequential
  (`ORD-YYMM-1001`), so `track_order` used to be callable by anyone with the
  public anon key plus 6 guessed phone digits. Execute is now revoked from
  `anon`/`authenticated`; only the Worker calls it, with the service-role key,
  rate-limited to 12 lookups/minute/IP.
* **`is_admin()` was reachable over REST.** It now lives in a `private` schema
  that PostgREST does not expose, while RLS policies still call it.
* **`[hidden]` attribute was being overridden** by `display:flex/grid` rules.
  There is a global `[hidden]{display:none!important}`. Keep it.
* **Descendant selectors leaking into nested markup** (`.trust div` hit both the
  card and the inner text block). Use child selectors for card containers.
* **"From" price vs discount.** A card's struck-through price must come from the
  *same* variant as the displayed price, never `max()` across all variants —
  that produced a fake "-64% off".
* **`object-fit: fill` distorts images.** Use `cover` to crop or `contain` to
  letterbox. This caused a visible bug on the BNH site.
* **Android Chrome font auto-boost** breaks headings. `-webkit-text-size-adjust:100%`
  plus explicit `clamp()` sizes are already set; don't remove them.

## Supabase free tier: the project gets paused

Only **writes** count as activity — reads do not. `.github/workflows/keep-alive.yml`
PATCHes the `keep_alive` table every 3 days, and commits a log file in the same
run so GitHub doesn't disable the workflow after 60 idle days. Both halves matter.

## Testing

`node test/render.test.mjs` renders every route against a fake Supabase and
asserts the things that actually matter: product name and price present in raw
HTML, unique title and canonical per page, Product/Breadcrumb/FAQ JSON-LD,
`noindex` on paginated and private pages, sitemap contents, cross-origin order
posts rejected, coupons validated server-side, a tampered JazzCash callback
failing its signature check, and a DB outage producing a friendly 500 rather
than a stack trace. **Run it before delivering anything.**

A CSS rewrite once silently broke three behaviours that only this suite caught.
Don't skip it because a change "looks cosmetic".

## Still open

1. **Payment gateways.** COD is live. JazzCash and card are code-complete and switch
   on when their Cloudflare secrets exist, but are not sandbox-verified (see
   `docs/payments-test.md`). **Easypaisa is switched off in code** because its callback
   is not signature-verified and could be forged; it needs the transaction-inquiry
   check before `enabled` is turned back on.
2. **Product photos.** Cloudinary cloud name + unsigned preset go in admin → Settings
   (`docs/images-setup.md`). Uploads are shrunk in the browser first.
3. **AI chat assistant is built** (`src/chat.js`, `public/chat.js`, `POST /api/chat`)
   on Cloudflare Workers AI via the `AI` binding in `wrangler.jsonc`. Widget shows
   only when the binding exists; admin can hide it with `chat_enabled:false` in
   `store_settings`. Medical questions are refused server-side before the model is
   called. Not yet tried against the real model or checked visually on a phone.
4. **BNH and SPARQ** are still the old single-file, client-rendered sites on
   Firebase/Supabase. They get this same treatment once Skinova is approved.
5. **Templates 3–5** for the reseller set (flash-deal, minimalist single-brand,
   wholesale catalogue) are not started.

## Working style he expects

* Say what's actually true, including when something can't be done or when an
  earlier answer was wrong. He'd rather hear it than discover it later.
* Check work by running it, not by assuming. Screenshot pages at phone, tablet
  and desktop widths before calling a layout done.
* When delivering a file, tell him to **rename it back to the original name**
  after downloading — his phone saves `index (2).html` and that has broken a
  deploy before.
