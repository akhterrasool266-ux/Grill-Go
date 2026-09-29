import worker from '../src/index.js';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const IMG = 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg';

const CATEGORIES = [
  { id: 'c1', slug: 'serums', name: 'Serums', image_url: IMG, banner_url: IMG, description: 'Targeted serums', updated_at: '2026-09-01' },
  { id: 'c2', slug: 'sunscreen', name: 'Sunscreen', image_url: IMG, banner_url: null, description: null, updated_at: '2026-09-02' },
];

const P1 = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'vitamin-c-brightening-serum', name: 'Vitamin C Brightening Serum',
  short_description: 'A 15% vitamin C serum that fades dark spots in 4 weeks.',
  description: 'Lightweight serum with 15% ethyl ascorbic acid.\n\nUse every morning.',
  price: 1850, original_price: 2600, currency: 'PKR', sku: 'SKN-VC-30',
  brand: 'Skinova', stock: 25, track_stock: true, rating: 4.6, review_count: 128,
  cod_enabled: true, cod_charges: null, free_shipping: false,
  is_featured: true, is_trending: true, seo_title: null, seo_description: null,
  features: ['Paraben free', 'Dermatologist tested', 'Safe for sensitive skin'],
  benefits: [{ q: 'How long until I see results?', a: 'Most people see brighter skin in 3–4 weeks.' }],
  tags: ['serum'], created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-20T00:00:00Z',
  category: { id: 'c1', slug: 'serums', name: 'Serums' },
  images: [{ url: IMG, alt: 'Vitamin C serum bottle', is_primary: true, sort_order: 0 },
           { url: IMG, alt: 'Texture shot', is_primary: false, sort_order: 1 }],
  variants: [
    { id: '22222222-2222-4222-8222-222222222222', label: '1 Bottle', qty: 1, price: 1850, original_price: 2600, badge: '', stock: 20, track_stock: true, is_default: true, is_active: true, sort_order: 0, sku: 'SKN-VC-30' },
    { id: '33333333-3333-4333-8333-333333333333', label: 'Buy 2 Save 15%', qty: 2, price: 3145, original_price: 5200, badge: 'Best value', stock: 10, track_stock: true, is_default: false, is_active: true, sort_order: 1, sku: 'SKN-VC-60' },
  ],
};

const SETTINGS = [{ data: {
  brand_name: 'Skinova', whatsapp: '923232631530', phone: '+92 323 2631530',
  email: 'care@skinova.pk', address: 'Karachi, Pakistan',
  cod_enabled: true, cod_charges: 0, shipping_flat: 200, free_shipping_over: 3000,
  announcement: 'Free delivery on orders over Rs 3,000',
  banners: [{ image: IMG, alt: 'Winter sale', href: '/category/serums' }],
  hero_title: 'Skincare that actually works',
  hero_sub: 'Dermatologist-tested formulas, delivered anywhere in Pakistan.',
} }];

const ORDER = { ok: true, order_number: 'ORD-2609-1001', status: 'dispatched',
  payment_state: 'unpaid', payment_method: 'cod', created_at: '2026-09-25T10:00:00Z',
  city: 'Karachi', customer_name: 'Test Customer', subtotal: 1850, discount: 0,
  shipping: 200, cod_fee: 0, total: 2050, tracking_note: 'Picked up by courier',
  items: [{ name: 'Vitamin C Brightening Serum', variant: '1 Bottle', qty: 1, unit_price: 1850, line_total: 1850, image_url: IMG }] };

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  // mirrors Cloudflare's assets binding with not_found_handling:"none"
  ASSETS: { fetch: async (req) => {
    const p = new URL(req.url).pathname;
    const known = ['/admin.html', '/app.js', '/sw.js', '/icons/logo.png'];
    return known.includes(p)
      ? new Response('asset:' + p, { status: 200 })
      : new Response('not found', { status: 404 });
  } },
};

globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  const p = u.pathname.replace('/rest/v1/', '');
  const body = () => { try { return JSON.parse(init.body || '{}'); } catch { return {}; } };

  if (p === 'store_settings') return jsonRes(SETTINGS);
  if (p === 'categories') return jsonRes(CATEGORIES);
  if (p === 'products') {
    const q = u.searchParams;
    if (q.get('slug')) return jsonRes(q.get('slug').includes('vitamin') ? [P1] : []);
    return jsonRes([P1], '0-0/1');
  }
  if (p === 'rpc/track_order') return jsonRes(ORDER);
  if (p === 'rpc/create_order') return jsonRes({ ok: true, order_id: 'o1', order_number: 'ORD-2609-1001', total: 2050, payment_method: body().p.payment_method });
  if (p === 'coupons') return jsonRes([{ code: 'SAVE10', kind: 'percent', value: 10, min_order: 1000, max_discount: 500, starts_at: null, ends_at: null, usage_limit: null, used_count: 0 }]);
  if (p === 'payments') return jsonRes([{ id: 'p1', order_id: 'o1', amount: 2050, state: 'pending', gateway: 'jazzcash', reference: 'ORD-2609-1001-abcdef12' }]);
  if (p === 'orders') return jsonRes([{ id: 'o1' }]);
  if (p === 'analytics_events' || p === 'payment_transactions') return jsonRes([{}]);
  return jsonRes([]);
};
function jsonRes(data, range = '0-0/1') {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'content-range': range },
  });
}

export const get = (path, init) => worker.fetch(new Request('https://shop.example.com' + path, init), env, {});
export { env, P1, CATEGORIES, SETTINGS, ORDER };

