// ============================================================================
//  SHARED HELPERS  —  escaping, money, Cloudinary, Supabase REST
// ============================================================================

/* ------------------------------ HTML safety ------------------------------ */
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ENT[c]);
}

/** Escape for use inside a <script type="application/ld+json"> block. */
export function jsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/** Strip tags, collapse whitespace, cut to n chars — for meta descriptions. */
export function plain(html, n = 160) {
  const t = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase().trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/* --------------------------------- money --------------------------------- */
export function money(n, cur = 'Rs') {
  const v = Math.round(Number(n) || 0);
  return cur + ' ' + v.toLocaleString('en-US');
}

export function discountPct(price, original) {
  const p = Number(price) || 0, o = Number(original) || 0;
  if (!o || o <= p) return 0;
  return Math.round(((o - p) / o) * 100);
}

/* ------------------------------- Cloudinary ------------------------------ */
/**
 * Adds automatic format (WebP / AVIF) + quality + width to a Cloudinary URL.
 * Any non-Cloudinary URL is returned untouched.
 */
export function img(url, width, extra = '') {
  if (!url) return '';
  if (!/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  const t = ['f_auto', 'q_auto'];
  if (width) t.push('w_' + width, 'c_limit');
  if (extra) t.push(extra);
  return url.replace('/image/upload/', '/image/upload/' + t.join(',') + '/');
}

/** Responsive srcset for a Cloudinary image. */
export function srcset(url, widths = [320, 480, 640, 900, 1200]) {
  if (!url || !/res\.cloudinary\.com/.test(url)) return '';
  return widths.map((w) => `${img(url, w)} ${w}w`).join(', ');
}

/**
 * <img> tag with lazy loading, explicit dimensions (no layout shift),
 * srcset and alt text — every image on the site goes through this.
 */
export function picture({ url, alt, width = 600, height, ratio = '1/1', cls = '', eager = false, sizes = '(max-width:700px) 50vw, 300px' }) {
  if (!url) {
    return `<div class="ph ${esc(cls)}" style="aspect-ratio:${esc(ratio)}" aria-hidden="true"></div>`;
  }
  const ss = srcset(url);
  return `<img src="${esc(img(url, width))}"${ss ? ` srcset="${esc(ss)}" sizes="${esc(sizes)}"` : ''}`
    + ` alt="${esc(alt || '')}" class="${esc(cls)}"`
    + ` width="${width}"${height ? ` height="${height}"` : ''}`
    + ` style="aspect-ratio:${esc(ratio)}"`
    + ` loading="${eager ? 'eager' : 'lazy'}" decoding="async"`
    + `${eager ? ' fetchpriority="high"' : ''}>`;
}

/* -------------------------------- Supabase ------------------------------- */
export class Db {
  constructor(env) {
    this.url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
    this.anon = env.SUPABASE_ANON_KEY || '';
    this.service = env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!this.url || !this.anon) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set as Worker variables');
    }
  }

  headers(admin = false) {
    const key = admin ? (this.service || this.anon) : this.anon;
    return {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /** GET on the REST API. `q` is a raw query string (already encoded). */
  async select(path, q = '', { admin = false, cache = 60 } = {}) {
    const url = `${this.url}/rest/v1/${path}${q ? '?' + q : ''}`;
    const res = await fetch(url, {
      headers: this.headers(admin),
      cf: cache ? { cacheTtl: cache, cacheEverything: true } : undefined,
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.json();
  }

  /**
   * Same as select() but also returns the total row count, so listings can
   * paginate without a second round trip.
   */
  async selectCount(path, q = '', { admin = false, cache = 60 } = {}) {
    const url = `${this.url}/rest/v1/${path}${q ? '?' + q : ''}`;
    const res = await fetch(url, {
      headers: { ...this.headers(admin), Prefer: 'count=exact' },
      cf: cache ? { cacheTtl: cache, cacheEverything: true } : undefined,
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    const cr = res.headers.get('content-range') || '';
    const total = Number(String(cr).split('/')[1]);
    return { rows, total: Number.isFinite(total) ? total : rows.length };
  }

  /** Call a Postgres function. Always uses the service-role key. */
  async rpc(fn, args = {}, { admin = true } = {}) {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(admin),
      body: JSON.stringify(args),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`RPC ${fn} ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  }

  async insert(table, rows, { admin = true } = {}) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this.headers(admin), Prefer: 'return=representation' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`Insert ${table} ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async update(table, q, patch, { admin = true } = {}) {
    const res = await fetch(`${this.url}/rest/v1/${table}?${q}`, {
      method: 'PATCH',
      headers: { ...this.headers(admin), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Update ${table} ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

/* --------------------------- product query pieces ------------------------ */
export const PRODUCT_COLS =
  'id,slug,name,short_description,description,price,original_price,currency,sku,brand,' +
  'stock,track_stock,rating,review_count,cod_enabled,cod_charges,free_shipping,' +
  'is_featured,is_trending,seo_title,seo_description,features,benefits,tags,created_at,' +
  'category:categories(id,slug,name),' +
  'images:product_images(url,alt,width,height,is_primary,sort_order),' +
  'variants:product_variants(id,label,sku,qty,price,original_price,badge,stock,track_stock,is_default,sort_order,is_active)';

export const CARD_COLS =
  'id,slug,name,short_description,price,original_price,stock,track_stock,rating,' +
  'review_count,is_featured,is_trending,' +
  'category:categories(slug,name),' +
  'images:product_images(url,alt,is_primary,sort_order)';

/** First image of a product row, sorted the same way everywhere. */
export function mainImage(p) {
  const list = (p.images || []).slice().sort(
    (a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order)
  );
  return list[0] || null;
}

export function sortedImages(p) {
  return (p.images || []).slice().sort(
    (a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order)
  );
}

export function activeVariants(p) {
  return (p.variants || [])
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order - b.sort_order));
}

export function inStock(p) {
  if (!p.track_stock) return true;
  if (Number(p.stock) > 0) return true;
  return activeVariants(p).some((v) => !v.track_stock || Number(v.stock) > 0);
}

/* ------------------------------- responses ------------------------------- */
export function html(body, { status = 200, cache = 'public, max-age=0, s-maxage=120, stale-while-revalidate=600', headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      ...headers,
    },
  });
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function redirect(to, status = 302) {
  return new Response(null, { status, headers: { Location: to } });
}

/* --------------------------------- crypto -------------------------------- */
export async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function sha256Hex(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare, for signature checks. */
export function safeEqual(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i++) out |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return out === 0;
}
