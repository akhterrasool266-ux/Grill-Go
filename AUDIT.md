# Specification audit — what matched, what did not, what changed

Compared the build specification against the three live sites, then rebuilt
Skinova to close the gaps.

**Legend:** ✅ met · ⚠️ partly met · ❌ missing · — not applicable

| | Requirement | SPARQ (old) | BNH (old) | Skinova (old) | Skinova (new) |
|---|---|:--:|:--:|:--:|:--:|
| **1** | `[BRAND_NAME]` placeholder, central config file | ❌ | ❌ | ❌ | ✅ |
| **1** | Configurable logo, favicon, tagline, contact, WhatsApp, social, address | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **2** | Mobile-first responsive, 320 → 1440px+ | ✅ | ✅ | ✅ | ✅ |
| **2** | No horizontal scroll, adaptive grids, touch targets | ✅ | ⚠️ | ✅ | ✅ |
| **2** | Responsive admin dashboard | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **3** | SSR/SSG-capable framework on Cloudflare | ❌ | ❌ | ❌ | ✅ |
| **3** | Supabase for database + auth | ✅ | ❌ (Firebase) | ❌ (Firebase) | ✅ |
| **3** | Cloudinary for images | ✅ | ✅ | ✅ | ✅ |
| **3** | No service keys or payment secrets in frontend | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **3** | Environment variables for credentials | ❌ | ❌ | ❌ | ✅ |
| **3** | Server-side endpoints for sensitive operations | ❌ | ❌ | ❌ | ✅ |
| **4** | Server-side rendering of product content | ❌ | ❌ | ❌ | ✅ |
| **4** | Unique `<title>` + meta description per page | ❌ | ❌ | ❌ | ✅ |
| **4** | Canonical URLs | ⚠️ | ❌ | ❌ | ✅ |
| **4** | Open Graph + Twitter cards | ❌ | ❌ | ❌ | ✅ |
| **4** | robots.txt | ❌ | ❌ | ❌ | ✅ |
| **4** | Dynamic XML sitemap | ❌ | ❌ | ❌ | ✅ |
| **4** | Product JSON-LD (name, price, currency, availability, SKU) | ❌ | ❌ | ❌ | ✅ |
| **4** | Organization / WebSite JSON-LD | ❌ | ❌ | ❌ | ✅ |
| **4** | BreadcrumbList JSON-LD | ❌ | ❌ | ❌ | ✅ |
| **4** | Semantic HTML5, H1/H2/H3 hierarchy | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **4** | SEO URLs `/product/product-name` | ❌ | ❌ | ❌ | ✅ |
| **4** | Image ALT text | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **4** | WebP / AVIF | ❌ | ❌ | ❌ | ✅ |
| **4** | Lazy loading below the fold | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **4** | Duplicate-content prevention | ❌ | ❌ | ❌ | ✅ |
| **4** | 404 + redirect handling | ❌ | ❌ | ❌ | ✅ |
| **4** | Search Console compatible | ❌ | ❌ | ❌ | ✅ |
| **5** | Homepage, listing, category, product detail pages | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **5** | Search + filtering + sorting | ⚠️ | ❌ | ❌ | ✅ |
| **5** | Product gallery, variants | ⚠️ | ⚠️ | ✅ | ✅ |
| **5** | Cart, checkout, order confirmation | ✅ | ✅ | ✅ | ✅ |
| **5** | Order tracking / status | ❌ | ❌ | ❌ | ✅ |
| **5** | WhatsApp button, responsive nav + footer | ✅ | ✅ | ✅ | ✅ |
| **5** | Every product has its own crawlable URL | ❌ | ❌ | ❌ | ✅ |
| **6** | Card / JazzCash / Easypaisa / COD, modular | ❌ COD only | ❌ COD only | ❌ COD only | ✅ |
| **6** | Payment verified server-side, never from frontend | — | — | — | ✅ |
| **6** | Transaction IDs stored, duplicate orders prevented | ❌ | ❌ | ❌ | ✅ |
| **6** | Success / failed / cancelled / pending handled | ❌ | ❌ | ❌ | ✅ |
| **6** | Webhook / callback signature verification | — | — | — | ✅ |
| **6** | COD configurable from admin | ✅ | ✅ | ✅ | ✅ |
| **7** | Products, categories, images, variants tables | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **7** | Customers, orders, order items | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **7** | Payments, payment transactions | ❌ | ❌ | ❌ | ✅ |
| **7** | Coupons / discounts | ❌ | ❌ | ❌ | ✅ |
| **7** | Settings, admin users, order status, payment status | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **7** | Relationships, indexes, RLS | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **8** | Admin login | ✅ | ✅ | ✅ | ✅ |
| **8** | Product add/edit/delete, images, categories, price, stock | ✅ | ✅ | ✅ | ✅ |
| **8** | Orders, customers, payment status | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **8** | Coupon management | ❌ | ❌ | ❌ | ✅ |
| **8** | SEO title/description fields per product | ❌ | ❌ | ❌ | ✅ |
| **8** | Analytics, order statistics | ✅ | ✅ | ✅ | ✅ |
| **9** | CDN, image optimisation, lazy loading, minimal JS | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **9** | Browser caching, SSR/SSG, optimised third-party scripts | ❌ | ❌ | ❌ | ✅ |
| **9** | LCP / INP / CLS targets | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **10** | Cloudflare Pages/Workers, CDN, HTTPS, custom domain ready | ✅ | ✅ | ✅ | ✅ |
| **10** | Works on the free subdomain before buying a domain | ✅ | ✅ | ✅ | ✅ |
| **11** | Secure auth, server-side authorization, RLS | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **11** | Input validation, rate limiting, XSS protection | ❌ | ❌ | ❌ | ✅ |
| **11** | SQL injection protection | ✅ | ✅ | ✅ | ✅ |
| **11** | No secret keys in frontend, admin route protection | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **12** | Meta Pixel: ViewContent, AddToCart, InitiateCheckout, Purchase | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **12** | Tracking IDs configurable | ✅ | ✅ | ✅ | ✅ |
| **13** | Google Analytics 4 | ❌ | ❌ | ❌ | ✅ |
| **13** | Google Search Console | ❌ | ❌ | ❌ | ✅ |
| **14** | Web app manifest, icons, theme colour, installable | ❌ | ❌ | ❌ | ✅ |
| **14** | Service worker that does not harm SEO | — | — | — | ✅ |
| **15** | `/`, `/products`, `/category/x`, `/product/x` crawlable | ❌ | ❌ | ❌ | ✅ |
| **16** | 404, 500, payment failed/pending/cancelled, order success, out of stock | ❌ | ❌ | ❌ | ✅ |
| **17** | One central configuration system | ❌ | ❌ | ❌ | ✅ |
| **18** | Build config, env var list, schema SQL, sitemap, robots, README | ❌ | ❌ | ❌ | ✅ |

---

## Why the old sites could not simply be patched

All three were a single `index.html` that fetched products from the database
**after** the page loaded. That one decision blocked eleven separate requirements:

* Google's first fetch of the page contained no product name, price or
  description — only an empty shell.
* There was no `/product/<name>` URL to crawl, so there was nothing to index,
  nothing to link to from an ad, and nothing to put in a sitemap.
* Per-page titles, meta descriptions, canonicals and Open Graph tags cannot be
  set from JavaScript in a way crawlers and social scrapers reliably use.
* Product JSON-LD written by JavaScript is not dependable for rich results.
* There was no server, so payment verification, secret keys and price
  re-validation had nowhere safe to live.

Adding meta tags to the old files would not have fixed any of that. The page had
to be rendered on the server.

## What was built instead of Next.js

The specification asks for "Next.js **or another framework that properly supports
server-side rendering** on Cloudflare". This uses a **Cloudflare Worker** that
renders each page on the server and serves static files from the edge.

Same result, three practical advantages:

* **No build step.** Files go to GitHub, Cloudflare deploys them. Nothing has to
  be compiled on a laptop — the whole store can be maintained from a phone.
* **Faster.** No framework runtime, no hydration, one small JS file.
* **Native on Cloudflare** rather than an adapter layer.

## Verified, not assumed

`test/render.test.mjs` renders every route against a fake database and asserts
the things that matter: the product name and price appear in the raw HTML, the
title and canonical are unique per page, Product / Breadcrumb / FAQ JSON-LD are
present and correct, paginated and private pages are `noindex`, the sitemap
contains product and category URLs, cross-origin order posts are rejected, a
coupon is validated server-side, a tampered JazzCash callback fails its signature
check, and a database outage produces a friendly 500 page rather than a stack
trace. All checks pass.

## Still to do (needs information only you have)

1. **Merchant credentials** for JazzCash / Easypaisa / card. The code and the
   verification are done; the gateways switch on when the keys are added in
   Cloudflare.
2. **Real product photos and copy** for the demo store.
3. **BNH and SPARQ** — same treatment, once Skinova is approved.
