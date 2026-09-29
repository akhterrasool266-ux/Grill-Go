// ============================================================================
//  CLOUDFLARE WORKER  —  server-side rendering + API for [BRAND_NAME] store
//
//  Every storefront page is rendered HERE, on the server, before it reaches
//  the browser. That is what makes the product name, price, description and
//  structured data visible to Google without running any JavaScript.
// ============================================================================
import { resolveConfig } from './config.js';
import {
  Db, html, json, redirect, esc, plain, PRODUCT_COLS, CARD_COLS,
  mainImage, slugify, money,
} from './lib.js';
import { page } from './layout.js';
import {
  head, robotsTxt, sitemapXml, organizationSchema, websiteSchema,
  breadcrumbSchema, productSchema, itemListSchema, faqSchema,
} from './seo.js';
import { homePage, listPage } from './pages/shop.js';
import { productPage } from './pages/product.js';
import {
  cartPage, checkoutPage, orderPage, trackPage, paymentStatePage,
  errorPage, staticPage, STATIC_PAGES,
} from './pages/flow.js';
import {
  GATEWAYS, availableMethods, settlePayment, autoPostForm,
} from './payments.js';

/* ------------------------------ rate limiting ---------------------------- */
const HITS = new Map();
function rateLimit(ip, bucket, max, windowMs) {
  const key = bucket + '|' + ip;
  const now = Date.now();
  const rec = HITS.get(key);
  if (!rec || now > rec.reset) { HITS.set(key, { n: 1, reset: now + windowMs }); return true; }
  rec.n += 1;
  if (HITS.size > 5000) HITS.clear();
  return rec.n <= max;
}

/* ------------------------------ shared loads ----------------------------- */
async function loadShell(db, env) {
  const [settingsRows, categories] = await Promise.all([
    db.select('store_settings', 'id=eq.1&select=data&limit=1', { cache: 30 }).catch(() => []),
    db.select('categories',
      'is_active=eq.true&select=id,slug,name,image_url,banner_url,seo_title,seo_description,description,updated_at&order=sort_order.asc,name.asc',
      { cache: 60 }).catch(() => []),
  ]);
  const settings = (settingsRows[0] && settingsRows[0].data) || {};
  return { cfg: resolveConfig(env, settings), categories, settings };
}

const SORTS = {
  new:      'created_at.desc',
  low:      'price.asc',
  high:     'price.desc',
  rating:   'rating.desc,review_count.desc',
  featured: 'is_featured.desc,created_at.desc',
  trending: 'is_trending.desc,created_at.desc',
};

async function loadList(db, { categoryId, q, sort, page: pg, perPage }) {
  const filters = ['is_active=eq.true'];
  if (categoryId) filters.push(`category_id=eq.${categoryId}`);
  if (q) {
    const t = encodeURIComponent(`*${q.replace(/[*(),]/g, ' ').trim()}*`);
    filters.push(`or=(name.ilike.${t},short_description.ilike.${t},brand.ilike.${t})`);
  }
  const from = (pg - 1) * perPage;
  const qs = filters.join('&')
    + `&select=${CARD_COLS}`
    + `&order=${SORTS[sort] || SORTS.new}`
    + `&offset=${from}&limit=${perPage}`;
  return db.selectCount('products', qs, { cache: 30 });
}

/* ================================= ROUTER ================================ */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const site = (env.SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, '');
    const path = url.pathname.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
    const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';

    // www / trailing-slash canonicalisation — no duplicate content for Google
    if (url.pathname !== path && path) return redirect(path + url.search, 301);

    let shell;
    try {
      const db = new Db(env);

      /* ---------------------------- API routes --------------------------- */
      if (path.startsWith('/api/')) return await api({ request, env, db, url, path, site, ip });

      shell = await loadShell(db, env);
      const { cfg, categories } = shell;

      /* ------------------------------ robots ----------------------------- */
      if (path === '/robots.txt') {
        return new Response(robotsTxt(cfg, site), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        });
      }

      /* ----------------------------- sitemap ----------------------------- */
      if (path === '/sitemap.xml') {
        const products = await db.select('products',
          'is_active=eq.true&select=slug,updated_at,created_at,images:product_images(url,is_primary,sort_order)'
          + '&order=updated_at.desc&limit=5000', { cache: 300 });
        return new Response(sitemapXml(site, {
          products, categories, pages: Object.keys(STATIC_PAGES),
        }), {
          headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
        });
      }

      /* ---------------------------- manifest ----------------------------- */
      if (path === '/manifest.webmanifest') {
        return json({
          name: cfg.brandName, short_name: cfg.brandName.slice(0, 12),
          description: plain(cfg.description, 160),
          start_url: '/?src=pwa', scope: '/', display: 'standalone',
          orientation: 'portrait', background_color: cfg.theme.bg,
          theme_color: cfg.theme.brand, lang: 'en-PK', dir: 'ltr',
          categories: ['shopping'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'All products', url: '/products' },
            { name: 'Track order', url: '/track' },
          ],
        }, 200, { 'Cache-Control': 'public, max-age=3600' });
      }

      /* ------------------------------ admin ------------------------------ */
      if (path === cfg.adminPath || path === cfg.adminPath + '/index.html') {
        const res = await env.ASSETS.fetch(new Request(new URL('/admin.html', url), request));
        return new Response(res.body, {
          status: res.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }

      /* ------------------------------- home ------------------------------ */
      if (path === '' || path === '/') {
        const cols = `is_active=eq.true&select=${CARD_COLS}`;
        const [trend, feat, latest] = await Promise.all([
          db.select('products', `${cols}&is_trending=eq.true&order=sort_order.asc,created_at.desc&limit=10`, { cache: 30 }),
          db.select('products', `${cols}&is_featured=eq.true&order=sort_order.asc,created_at.desc&limit=10`, { cache: 30 }),
          db.select('products', `${cols}&order=created_at.desc&limit=10`, { cache: 30 }),
        ]);
        const banners = (cfg.banners && cfg.banners.length)
          ? cfg.banners
          : categories.filter((c) => c.banner_url).map((c) => ({ image: c.banner_url, alt: c.name, href: '/category/' + c.slug }));

        return html(page({
          cfg, site, categories, active: '/',
          seo: {
            title: '', canonical: '/',
            description: cfg.description,
            schemas: [organizationSchema(cfg, site), websiteSchema(cfg, site),
              itemListSchema(site, [...trend, ...feat].slice(0, 12), 'Featured products')],
          },
          body: homePage({ cfg, categories, banners, trending: trend, featured: feat, latest }),
        }));
      }

      /* --------------------------- all products -------------------------- */
      if (path === '/products') {
        const sort = SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'new';
        const pg = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const { rows, total } = await loadList(db, { sort, page: pg, perPage: cfg.productsPerPage });
        const pages = Math.max(1, Math.ceil(total / cfg.productsPerPage));
        const trail = [{ name: 'Home', href: '/' }, { name: 'All products' }];

        return html(page({
          cfg, site, categories, active: '/products',
          seo: {
            title: `All products${pg > 1 ? ` — page ${pg}` : ''}`,
            description: `Browse all ${total} products from ${cfg.brandName}. ${plain(cfg.tagline, 90)} Cash on delivery across Pakistan.`,
            canonical: '/products' + (pg > 1 ? `?page=${pg}` : ''),
            noindex: pg > 1,
            schemas: [breadcrumbSchema(site, trail), itemListSchema(site, rows, 'All products')],
          },
          body: listPage({
            cfg, title: 'All products', intro: '', products: rows, total, page: pg, pages,
            baseHref: '/products', sort, trail, categories, activeCat: '', q: '',
          }),
        }));
      }

      /* ----------------------------- category ---------------------------- */
      if (path.startsWith('/category/')) {
        const slug = decodeURIComponent(path.slice('/category/'.length));
        const cat = categories.find((c) => c.slug === slug);
        if (!cat) return notFound(cfg, site, categories);

        const sort = SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'new';
        const pg = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const { rows, total } = await loadList(db, { categoryId: cat.id, sort, page: pg, perPage: cfg.productsPerPage });
        const pages = Math.max(1, Math.ceil(total / cfg.productsPerPage));
        const trail = [{ name: 'Home', href: '/' }, { name: 'Products', href: '/products' }, { name: cat.name }];

        return html(page({
          cfg, site, categories, active: '/category/' + slug,
          seo: {
            title: cat.seo_title || `${cat.name}${pg > 1 ? ` — page ${pg}` : ''}`,
            description: cat.seo_description || cat.description
              || `Shop ${cat.name} from ${cfg.brandName}. ${total} product${total === 1 ? '' : 's'}, cash on delivery all over Pakistan.`,
            canonical: `/category/${slug}` + (pg > 1 ? `?page=${pg}` : ''),
            ogImage: cat.banner_url || cat.image_url || undefined,
            noindex: pg > 1,
            schemas: [breadcrumbSchema(site, trail), itemListSchema(site, rows, cat.name)],
          },
          body: listPage({
            cfg, title: cat.name, intro: cat.description || '', products: rows, total,
            page: pg, pages, baseHref: `/category/${slug}`, sort, trail, categories,
            activeCat: slug, q: '',
          }),
        }));
      }

      /* ------------------------------ search ----------------------------- */
      if (path === '/search') {
        const q = (url.searchParams.get('q') || '').slice(0, 80).trim();
        const sort = SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'new';
        const pg = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
        const { rows, total } = q
          ? await loadList(db, { q, sort, page: pg, perPage: cfg.productsPerPage })
          : { rows: [], total: 0 };
        const pages = Math.max(1, Math.ceil(total / cfg.productsPerPage));
        const trail = [{ name: 'Home', href: '/' }, { name: 'Search' }];

        return html(page({
          cfg, site, categories, q,
          seo: {
            title: q ? `Search: ${q}` : 'Search', canonical: '/search',
            description: `Search results for “${q}” at ${cfg.brandName}.`,
            noindex: true,
            schemas: [breadcrumbSchema(site, trail)],
          },
          body: listPage({
            cfg, title: q ? `Results for “${q}”` : 'Search products',
            intro: q ? '' : 'Type in the search bar above to find a product.',
            products: rows, total, page: pg, pages, baseHref: '/search', sort, trail,
            categories, activeCat: '', q,
          }),
        }), { cache: 'no-store' });
      }

      /* ---------------------------- product ------------------------------ */
      if (path.startsWith('/product/')) {
        const slug = decodeURIComponent(path.slice('/product/'.length));
        const rows = await db.select('products',
          `slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=${PRODUCT_COLS}&limit=1`,
          { cache: 30 });
        const p = rows[0];
        if (!p) return notFound(cfg, site, categories);

        const related = p.category
          ? await db.select('products',
              `is_active=eq.true&category_id=eq.${p.category.id}&id=neq.${p.id}`
              + `&select=${CARD_COLS}&order=is_featured.desc,created_at.desc&limit=5`, { cache: 60 })
          : [];

        const trail = [
          { name: 'Home', href: '/' },
          { name: 'Products', href: '/products' },
          ...(p.category ? [{ name: p.category.name, href: '/category/' + p.category.slug }] : []),
          { name: p.name },
        ];
        const im = mainImage(p);

        return html(page({
          cfg, site, categories,
          active: p.category ? '/category/' + p.category.slug : '/products',
          seo: {
            title: p.seo_title || p.name,
            description: p.seo_description || p.short_description
              || `Buy ${p.name}${p.brand ? ' by ' + p.brand : ''} at ${money(p.price, cfg.currencySymbol)}. ${plain(p.description, 80)}`,
            canonical: '/product/' + p.slug,
            ogType: 'product',
            ogImage: im ? im.url : undefined,
            schemas: [
              productSchema(p, cfg, site),
              breadcrumbSchema(site, trail),
              faqSchema(Array.isArray(p.benefits) ? p.benefits : []),
            ],
            extra: `<meta property="product:price:amount" content="${Number(p.price).toFixed(2)}">
<meta property="product:price:currency" content="${esc(p.currency || cfg.currency)}">`,
          },
          body: productPage({ cfg, p, related, trail }),
        }));
      }

      /* ------------------------------- cart ------------------------------ */
      if (path === '/cart') {
        return html(page({
          cfg, site, categories,
          seo: { title: 'Your cart', canonical: '/cart', noindex: true },
          body: cartPage({ cfg }),
        }), { cache: 'no-store' });
      }

      /* ----------------------------- checkout ---------------------------- */
      if (path === '/checkout') {
        const methods = availableMethods(env, cfg);
        return html(page({
          cfg, site, categories,
          seo: { title: 'Checkout', canonical: '/checkout', noindex: true },
          body: checkoutPage({ cfg, methods: methods.length ? methods : ['cod'] }),
        }), { cache: 'no-store' });
      }

      /* -------------------------- order / tracking ----------------------- */
      if (path.startsWith('/order/')) {
        // Order numbers run in sequence, so lookups are rate-limited to stop
        // anyone walking through them with guessed phone digits.
        if (!rateLimit(ip, 'tr', 12, 60000)) {
          return html(page({
            cfg, site, categories,
            seo: { title: 'Please wait', canonical: '/track', noindex: true },
            body: trackPage({ cfg, error: 'Too many attempts. Please wait a minute and try again.' }),
          }), { status: 429, cache: 'no-store' });
        }
        const no = decodeURIComponent(path.slice('/order/'.length));
        const ph = url.searchParams.get('p') || '';
        const o = await db.rpc('track_order', { p_number: no, p_phone: ph });
        if (!o || !o.ok) {
          return html(page({
            cfg, site, categories,
            seo: { title: 'Order not found', canonical: '/track', noindex: true },
            body: trackPage({ cfg, error: 'We could not find that order. Please check the order number and mobile number.', prefill: { no } }),
          }), { status: 404, cache: 'no-store' });
        }
        return html(page({
          cfg, site, categories,
          seo: { title: `Order ${o.order_number}`, canonical: '/order/' + o.order_number, noindex: true },
          body: orderPage({ cfg, o, justPlaced: url.searchParams.get('new') === '1' }),
        }), { cache: 'no-store' });
      }

      if (path === '/track') {
        const no = url.searchParams.get('no') || '';
        const ph = url.searchParams.get('p') || '';
        if (no && ph) {
          if (!rateLimit(ip, 'tr', 12, 60000)) {
            return html(page({
              cfg, site, categories,
              seo: { title: 'Please wait', canonical: '/track', noindex: true },
              body: trackPage({ cfg, error: 'Too many attempts. Please wait a minute and try again.', prefill: { no } }),
            }), { status: 429, cache: 'no-store' });
          }
          const o = await db.rpc('track_order', { p_number: no, p_phone: ph });
          if (o && o.ok) {
            return html(page({
              cfg, site, categories,
              seo: { title: `Order ${o.order_number}`, canonical: '/track', noindex: true },
              body: orderPage({ cfg, o, justPlaced: false }),
            }), { cache: 'no-store' });
          }
          return html(page({
            cfg, site, categories,
            seo: { title: 'Track order', canonical: '/track', noindex: true },
            body: trackPage({ cfg, error: 'No order matched those details.', prefill: { no, p: ph } }),
          }), { status: 404, cache: 'no-store' });
        }
        return html(page({
          cfg, site, categories,
          seo: { title: 'Track your order', canonical: '/track', noindex: true,
                 description: `Track your ${cfg.brandName} order with your order number and mobile number.` },
          body: trackPage({ cfg }),
        }), { cache: 'no-store' });
      }

      /* -------------------------- payment states ------------------------- */
      if (path.startsWith('/payment/')) {
        const kind = path.slice('/payment/'.length);
        const titles = { success: 'Payment received', failed: 'Payment failed', pending: 'Payment pending', cancelled: 'Payment cancelled', outofstock: 'Out of stock' };
        if (!titles[kind]) return notFound(cfg, site, categories);
        return html(page({
          cfg, site, categories,
          seo: { title: titles[kind], canonical: path, noindex: true },
          body: paymentStatePage({ cfg, kind, orderNumber: url.searchParams.get('no') || '' }),
        }), { cache: 'no-store' });
      }

      /* --------------------------- static pages -------------------------- */
      if (path.startsWith('/page/')) {
        const slug = path.slice('/page/'.length);
        if (!STATIC_PAGES[slug]) return notFound(cfg, site, categories);
        const trail = [{ name: 'Home', href: '/' }, { name: STATIC_PAGES[slug].title }];
        return html(page({
          cfg, site, categories,
          seo: {
            title: STATIC_PAGES[slug].title, canonical: path,
            description: `${STATIC_PAGES[slug].title} — ${cfg.brandName}.`,
            schemas: [breadcrumbSchema(site, trail)],
          },
          body: staticPage({ cfg, slug }),
        }));
      }

      /* ---------------------- anything else: assets ---------------------- */
      if (env.ASSETS) {
        const res = await env.ASSETS.fetch(request);
        if (res.status !== 404) return res;
      }
      return notFound(cfg, site, categories);

    } catch (err) {
      // 500 — never leak a stack trace to the visitor
      console.error('worker error', err && err.stack ? err.stack : String(err));
      const cfg = (shell && shell.cfg) || resolveConfig(env, {});
      const cats = (shell && shell.categories) || [];
      return html(page({
        cfg, site, categories: cats,
        seo: { title: 'Something went wrong', canonical: path || '/', noindex: true },
        body: errorPage({
          cfg, code: 500, title: 'Something went wrong on our side',
          text: 'We hit an unexpected error. Please refresh in a moment — if it keeps happening, message us and we will sort it out.',
        }),
      }), { status: 500, cache: 'no-store' });
    }
  },
};

function notFound(cfg, site, categories) {
  return html(page({
    cfg, site, categories,
    seo: { title: 'Page not found', canonical: '/', noindex: true },
    body: errorPage({
      cfg, code: 404, title: 'We could not find that page',
      text: 'The link may be old or mistyped. Try the homepage or browse all products.',
    }),
  }), { status: 404, cache: 'public, max-age=60' });
}

/* ================================== API ================================== */
async function api({ request, env, db, url, path, site, ip }) {
  const sameOrigin = () => {
    const o = request.headers.get('origin');
    if (!o) return true;                 // gateway server-to-server callbacks
    try { return new URL(o).host === url.host; } catch { return false; }
  };

  /* ---------------------------- suggestions ----------------------------- */
  if (path === '/api/suggest' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 40);
    if (q.length < 2) return json({ products: [], terms: [] });
    if (!rateLimit(ip, 'sg', 60, 60000)) return json({ products: [], terms: [] }, 429);
    const t = encodeURIComponent(`*${q.replace(/[*(),]/g, ' ').trim()}*`);
    const rows = await db.select('products',
      `is_active=eq.true&or=(name.ilike.${t},brand.ilike.${t})`
      + '&select=slug,name,price,images:product_images(url,is_primary,sort_order)'
      + '&order=is_featured.desc,created_at.desc&limit=6', { cache: 30 });
    return json({
      products: rows.map((p) => ({
        slug: p.slug, name: p.name, price: Number(p.price),
        image: (mainImage(p) || {}).url || '',
      })),
    }, 200, { 'Cache-Control': 'public, max-age=60' });
  }

  /* ------------------------------ coupon -------------------------------- */
  if (path === '/api/coupon' && request.method === 'GET') {
    if (!rateLimit(ip, 'cp', 20, 60000)) return json({ ok: false, error: 'too_many' }, 429);
    const code = (url.searchParams.get('code') || '').trim().toUpperCase().slice(0, 40);
    const subtotal = Math.max(0, Number(url.searchParams.get('subtotal') || 0));
    if (!code) return json({ ok: false, error: 'missing_code' }, 400);
    const rows = await db.select('coupons',
      `code=eq.${encodeURIComponent(code)}&is_active=eq.true`
      + '&select=code,kind,value,min_order,max_discount,starts_at,ends_at,usage_limit,used_count&limit=1',
      { admin: true, cache: 0 });
    const c = rows[0];
    const now = Date.now();
    if (!c
      || (c.starts_at && new Date(c.starts_at).getTime() > now)
      || (c.ends_at && new Date(c.ends_at).getTime() < now)
      || (c.usage_limit !== null && c.used_count >= c.usage_limit)) {
      return json({ ok: false, error: 'invalid' });
    }
    if (subtotal < Number(c.min_order)) {
      return json({ ok: false, error: 'min_order', min_order: Number(c.min_order) });
    }
    let discount = 0, freeShipping = false;
    if (c.kind === 'percent') discount = Math.round(subtotal * Number(c.value) / 100);
    else if (c.kind === 'fixed') discount = Math.min(Number(c.value), subtotal);
    else freeShipping = true;
    if (c.max_discount) discount = Math.min(discount, Number(c.max_discount));
    return json({ ok: true, code: c.code, discount, free_shipping: freeShipping });
  }

  /* ------------------------------- orders -------------------------------- */
  if (path === '/api/orders' && request.method === 'POST') {
    if (!sameOrigin()) return json({ ok: false, error: 'bad_origin' }, 403);
    if (!rateLimit(ip, 'or', 8, 60000)) return json({ ok: false, error: 'too_many' }, 429);

    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: 'bad_body' }, 400);

    const v = validateOrder(body);
    if (!v.ok) return json(v, 400);

    const settingsRows = await db.select('store_settings', 'id=eq.1&select=data&limit=1', { cache: 0 }).catch(() => []);
    const cfg = resolveConfig(env, (settingsRows[0] && settingsRows[0].data) || {});
    const methods = availableMethods(env, cfg);
    const method = methods.includes(v.data.payment_method) ? v.data.payment_method : 'cod';

    // The database recomputes every price, the COD fee, shipping and the
    // coupon. Nothing the browser sent about money is trusted.
    const res = await db.rpc('create_order', {
      p: {
        ...v.data,
        payment_method: method,
        ip,
        user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
      },
    });

    if (!res || !res.ok) {
      return json({ ok: false, error: (res && res.error) || 'order_failed', detail: res }, 400);
    }

    const last6 = String(v.data.phone).replace(/\D/g, '').slice(-6);
    const confirmUrl = `/order/${encodeURIComponent(res.order_number)}?p=${last6}&new=1`;

    if (method === 'cod' || res.duplicate) {
      return json({ ok: true, order_number: res.order_number, total: res.total, redirect: confirmUrl });
    }

    // online payment: hand the browser a one-time URL that posts to the gateway
    return json({
      ok: true, order_number: res.order_number, total: res.total,
      redirect: `/api/payments/${method}/start?no=${encodeURIComponent(res.order_number)}&p=${last6}`,
    });
  }

  /* ----------------------------- analytics ------------------------------- */
  if (path === '/api/analytics' && request.method === 'POST') {
    if (!sameOrigin()) return json({ ok: false }, 403);
    if (!rateLimit(ip, 'an', 120, 60000)) return json({ ok: true });
    const b = await request.json().catch(() => null);
    if (!b || !b.type) return json({ ok: false }, 400);
    await db.insert('analytics_events', [{
      type: String(b.type).slice(0, 40),
      path: String(b.path || '').slice(0, 200),
      product_id: b.product_id || null,
      session_id: String(b.session_id || '').slice(0, 60),
      referrer: String(b.referrer || '').slice(0, 200),
      value: b.value === undefined ? null : Number(b.value) || 0,
      meta: b.meta && typeof b.meta === 'object' ? b.meta : {},
    }], { admin: false }).catch(() => {});
    return json({ ok: true });
  }

  /* --------------------------- payment: start ---------------------------- */
  let m = path.match(/^\/api\/payments\/([a-z]+)\/start$/);
  if (m && request.method === 'GET') {
    const gw = GATEWAYS[m[1]];
    if (!gw) return json({ ok: false, error: 'unknown_gateway' }, 404);
    const no = url.searchParams.get('no') || '';
    const p6 = url.searchParams.get('p') || '';

    const ord = await db.rpc('track_order', { p_number: no, p_phone: p6 });
    if (!ord || !ord.ok) return redirect('/payment/failed', 302);
    if (ord.payment_state === 'paid') return redirect(`/order/${encodeURIComponent(no)}?p=${p6}`, 302);

    const pays = await db.select('payments',
      `order_id=eq.${await orderIdFor(db, no)}&select=reference,amount&order=created_at.desc&limit=1`,
      { admin: true, cache: 0 });
    const ref = pays[0] ? pays[0].reference : no;

    const init = await gw.init({
      order: {
        order_number: no, reference: ref, total: ord.total,
        customer_name: ord.customer_name, phone: p6, email: '',
      },
      env, site, db,
    });
    if (init.mode === 'form') {
      return html(autoPostForm(init.action, init.fields), { cache: 'no-store' });
    }
    if (init.mode === 'redirect') return redirect(init.url, 302);
    return redirect(`/order/${encodeURIComponent(no)}?p=${p6}`, 302);
  }

  /* -------------------------- payment: callback -------------------------- */
  m = path.match(/^\/api\/payments\/([a-z]+)\/(callback|webhook)$/);
  if (m) {
    const gw = GATEWAYS[m[1]];
    if (!gw || !gw.verify) return json({ ok: false }, 404);
    const result = await gw.verify(request, env);
    const out = await settlePayment(db, m[1], result);

    // Webhooks want a plain 200; browser callbacks want a page.
    if (m[2] === 'webhook') return json({ ok: out.ok, state: out.state || null });

    const no = String(result.raw?.pp_BillReference || result.raw?.order_ref
      || result.reference || '').split('-').slice(0, 3).join('-');
    const dest = { paid: 'success', pending: 'pending', cancelled: 'cancelled' }[out.state] || 'failed';
    return redirect(`/payment/${dest}${no ? '?no=' + encodeURIComponent(no) : ''}`, 302);
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

async function orderIdFor(db, orderNumber) {
  const rows = await db.select('orders',
    `order_number=eq.${encodeURIComponent(orderNumber)}&select=id&limit=1`,
    { admin: true, cache: 0 });
  return rows[0] ? rows[0].id : '00000000-0000-0000-0000-000000000000';
}

/* --------------------------- input validation ---------------------------- */
function validateOrder(b) {
  const s = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);
  const name = s(b.customer_name, 80);
  const phoneRaw = s(b.phone, 25);
  const phone = phoneRaw.replace(/[^\d+]/g, '');
  const address = s(b.address, 400);
  const city = s(b.city, 60);
  const email = s(b.email, 120);

  if (name.length < 2) return { ok: false, error: 'bad_name' };
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return { ok: false, error: 'bad_phone' };
  if (address.length < 8) return { ok: false, error: 'bad_address' };
  if (city.length < 2) return { ok: false, error: 'bad_city' };
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { ok: false, error: 'bad_email' };

  const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  if (!items.length) return { ok: false, error: 'empty_cart' };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clean = [];
  for (const it of items) {
    if (!it || !UUID.test(String(it.product_id || ''))) return { ok: false, error: 'bad_item' };
    if (it.variant_id && !UUID.test(String(it.variant_id))) return { ok: false, error: 'bad_item' };
    clean.push({
      product_id: String(it.product_id),
      variant_id: it.variant_id ? String(it.variant_id) : null,
      qty: Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1)),
    });
  }

  return {
    ok: true,
    data: {
      customer_name: name, phone, address, city, email,
      province: s(b.province, 60), postal_code: s(b.postal_code, 20),
      notes: s(b.notes, 400),
      coupon_code: s(b.coupon_code, 40),
      payment_method: s(b.payment_method, 20).toLowerCase() || 'cod',
      idempotency_key: s(b.idempotency_key, 64),
      items: clean,
    },
  };
}
