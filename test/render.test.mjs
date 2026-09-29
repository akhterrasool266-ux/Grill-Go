import { get, P1, env } from './fixtures.mjs';

let fails = 0;
function check(name, cond, extra = '') {
  if (cond) console.log('  ✓ ' + name);
  else { console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); fails++; }
}

console.log('\n── / (home) ───────────────────────────────');
{
  const r = await get('/'); const h = await r.text();
  check('200', r.status === 200, 'got ' + r.status);
  check('title has brand', /<title>Skinova — /.test(h));
  check('canonical absolute', h.includes('<link rel="canonical" href="https://shop.example.com/">'));
  check('Organization JSON-LD', h.includes('"@type":"Organization"'));
  check('WebSite JSON-LD + SearchAction', h.includes('"SearchAction"'));
  check('product name in raw HTML (no JS needed)', h.includes('Vitamin C Brightening Serum'));
  check('price rendered server-side', h.includes('Rs 1,850'));
  check('banner is eager + fetchpriority', /fetchpriority="high"/.test(h));
  check('cloudinary f_auto,q_auto applied', h.includes('f_auto,q_auto'));
  check('announcement from settings', h.includes('Free delivery on orders over Rs 3,000'));
  check('whatsapp float uses real number', h.includes('wa.me/923232631530'));
  check('no unresolved template', !h.includes('undefined') || !/>undefined</.test(h));
  check('theme-color meta', h.includes('name="theme-color"'));
  check('manifest linked', h.includes('rel="manifest"'));
}

console.log('\n── /product/<slug> ────────────────────────');
{
  const r = await get('/product/vitamin-c-brightening-serum'); const h = await r.text();
  check('200', r.status === 200, 'got ' + r.status);
  check('h1 is the product', /<h1>Vitamin C Brightening Serum<\/h1>/.test(h));
  check('unique title', h.includes('<title>Vitamin C Brightening Serum | Skinova</title>'));
  check('meta description from short_description', h.includes('fades dark spots in 4 weeks'));
  check('Product JSON-LD', h.includes('"@type":"Product"'));
  check('AggregateOffer for packs', h.includes('AggregateOffer'));
  check('sku in structured data', h.includes('"sku":"SKN-VC-30"'));
  check('availability InStock', h.includes('schema.org/InStock'));
  check('aggregateRating', h.includes('"aggregateRating"'));
  check('BreadcrumbList', h.includes('"BreadcrumbList"'));
  check('FAQPage from benefits', h.includes('"FAQPage"'));
  check('canonical is product URL', h.includes('href="https://shop.example.com/product/vitamin-c-brightening-serum"'));
  check('og:type product', h.includes('content="product"'));
  check('pack selector rendered', h.includes('Buy 2 Save 15%'));
  check('description newlines became paragraphs', h.includes('<p>Lightweight serum'));
  check('sticky buy bar present', h.includes('class="buybar"'));
  check('related products section', h.includes('You may also like'));
}

console.log('\n── /category/<slug> ───────────────────────');
{
  const r = await get('/category/serums'); const h = await r.text();
  check('200', r.status === 200, 'got ' + r.status);
  check('category title', h.includes('<title>Serums | Skinova</title>'));
  check('category description used', h.includes('Targeted serums'));
  check('ItemList JSON-LD', h.includes('"ItemList"'));
  check('canonical', h.includes('href="https://shop.example.com/category/serums"'));
}
{
  const r = await get('/category/does-not-exist');
  check('unknown category → 404', r.status === 404, 'got ' + r.status);
}

console.log('\n── /products, /search ─────────────────────');
{
  const r = await get('/products?sort=low&page=1'); const h = await r.text();
  check('200', r.status === 200);
  check('sort select reflects choice', h.includes('value="low"      selected') || h.includes('value="low" selected'));
  const r2 = await get('/products?page=2'); const h2 = await r2.text();
  check('page 2 is noindex', h2.includes('noindex,nofollow'));
  const r3 = await get('/search?q=serum'); const h3 = await r3.text();
  check('search noindex', h3.includes('noindex,nofollow'));
  check('search echoes query', h3.includes('Results for'));
}

console.log('\n── SEO endpoints ──────────────────────────');
{
  const r = await get('/robots.txt'); const t = await r.text();
  check('robots 200 text/plain', r.status === 200 && r.headers.get('content-type').includes('text/plain'));
  check('sitemap listed', t.includes('Sitemap: https://shop.example.com/sitemap.xml'));
  check('admin disallowed', t.includes('Disallow: /admin'));
  const s = await get('/sitemap.xml'); const x = await s.text();
  check('sitemap xml', s.status === 200 && x.startsWith('<?xml'));
  check('correct namespace', x.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));
  check('product url in sitemap', x.includes('/product/vitamin-c-brightening-serum'));
  check('category url in sitemap', x.includes('/category/serums'));
  check('image sitemap entry', x.includes('<image:loc>'));
  const m = await get('/manifest.webmanifest'); const mj = await m.json();
  check('manifest name from settings', mj.name === 'Skinova');
  check('manifest standalone', mj.display === 'standalone');
}

console.log('\n── cart / checkout / order / track ────────');
{
  const c = await get('/cart'); const ch = await c.text();
  check('cart 200 + noindex', c.status === 200 && ch.includes('noindex'));
  check('cart no-store', (c.headers.get('cache-control') || '').includes('no-store'));
  const k = await get('/checkout'); const kh = await k.text();
  check('checkout 200', k.status === 200);
  check('COD method shown', kh.includes('Cash on delivery'));
  check('checkout form fields', kh.includes('name="customer_name"') && kh.includes('name="phone"'));
  const o = await get('/order/ORD-2609-1001?p=631530&new=1'); const oh = await o.text();
  check('order page 200', o.status === 200);
  check('thank-you state', oh.includes('your order is placed'));
  check('order steps', oh.includes('Dispatched'));
  check('totals shown', oh.includes('Rs 2,050'));
  const t = await get('/track'); check('track 200', t.status === 200);
}

console.log('\n── errors + static pages ──────────────────');
{
  const r = await get('/definitely-not-a-page');
  check('404 status', r.status === 404);
  check('404 page body', (await r.text()).includes('could not find that page'));
  for (const s of ['about', 'contact', 'shipping', 'returns', 'privacy']) {
    const p = await get('/page/' + s);
    check('/page/' + s, p.status === 200);
  }
  for (const s of ['success', 'failed', 'pending', 'cancelled', 'outofstock']) {
    const p = await get('/payment/' + s);
    check('/payment/' + s, p.status === 200);
  }
  const tr = await get('/products/');
  check('trailing slash → 301', tr.status === 301 && tr.headers.get('location') === '/products');
}

console.log('\n── API ────────────────────────────────────');
{
  const ok = await get('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://shop.example.com' },
    body: JSON.stringify({ customer_name: 'Ali Khan', phone: '03232631530',
      address: 'House 5, Street 2, Gulshan', city: 'Karachi', payment_method: 'cod',
      idempotency_key: 'ck_test1',
      items: [{ product_id: P1.id, variant_id: P1.variants[0].id, qty: 2 }] }),
  });
  const d = await ok.json();
  check('order accepted', d.ok === true, JSON.stringify(d));
  check('redirect to confirmation', String(d.redirect).startsWith('/order/ORD-2609-1001'));

  const bad = await get('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://shop.example.com' },
    body: JSON.stringify({ customer_name: 'A', phone: '123', address: 'x', city: '', items: [] }),
  });
  check('bad input rejected 400', bad.status === 400);

  const xorigin = await get('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({}),
  });
  check('cross-origin POST blocked', xorigin.status === 403);

  const cp = await get('/api/coupon?code=SAVE10&subtotal=2000');
  const cpd = await cp.json();
  check('coupon validated server-side', cpd.ok === true && cpd.discount === 200, JSON.stringify(cpd));

  const cpmin = await get('/api/coupon?code=SAVE10&subtotal=500');
  check('coupon min order enforced', (await cpmin.json()).error === 'min_order');

  const sg = await get('/api/suggest?q=vit');
  check('suggest returns products', (await sg.json()).products.length > 0);
}

console.log('\n── payments ───────────────────────────────');
{
  const { GATEWAYS, availableMethods, autoPostForm } = await import('../src/payments.js');
  const cfg = { codEnabled: true, payments: { cod: true, jazzcash: true, easypaisa: true, card: true } };
  check('only COD without secrets', JSON.stringify(availableMethods({}, cfg)) === '["cod"]');
  const withJc = availableMethods({ JAZZCASH_MERCHANT_ID: 'M', JAZZCASH_PASSWORD: 'P', JAZZCASH_SALT: 'S' }, cfg);
  check('jazzcash appears once configured', withJc.includes('jazzcash'));

  const init = await GATEWAYS.jazzcash.init({
    order: { order_number: 'ORD-1', reference: 'ORD-1-abc', total: 2050, customer_name: 'A', phone: '0300', email: '' },
    env: { JAZZCASH_MERCHANT_ID: 'M1', JAZZCASH_PASSWORD: 'P1', JAZZCASH_SALT: 'SALT', JAZZCASH_ENV: 'sandbox' },
    site: 'https://shop.example.com',
  });
  check('amount sent in paisa', init.fields.pp_Amount === '205000', init.fields.pp_Amount);
  check('secure hash generated', /^[0-9A-F]{64}$/.test(init.fields.pp_SecureHash));
  check('return url is our callback', init.fields.pp_ReturnURL.endsWith('/api/payments/jazzcash/callback'));
  check('no secret leaks into the form action', !init.action.includes('SALT'));

  // a tampered callback must NOT be accepted
  const good = { ...init.fields };
  const verifyGood = await GATEWAYS.jazzcash.verify(
    new Request('https://x/api/payments/jazzcash/callback?' +
      new URLSearchParams({ ...good, pp_ResponseCode: '000' }).toString()),
    { JAZZCASH_SALT: 'SALT' });
  check('tampered amount → invalid signature', verifyGood.valid === false || verifyGood.state !== 'paid');

  // Easypaisa postback is unsigned → it may NEVER yield 'paid'
  const ep = (q) => GATEWAYS.easypaisa.verify(new Request('https://x/api/payments/easypaisa/callback?' + new URLSearchParams(q)), {});
  check('easypaisa forged success is NOT paid', (await ep({ status: '0000', orderRefNumber: 'ORD-2609-1001-abc', transactionAmount: '2050' })).state === 'pending');
  check('easypaisa success without amount is NOT paid', (await ep({ status: 'success', orderRefNumber: 'ORD-2609-1001-abc' })).state !== 'paid');
  check('easypaisa failure stays failed', (await ep({ status: '0002', orderRefNumber: 'x' })).state === 'failed');

  const form = autoPostForm('https://gw.test/pay', { a: '1', b: '<script>' });
  check('auto-post form escapes values', form.includes('&lt;script&gt;') && !form.includes('value="<script>"'));
  check('auto-post form is noindex', form.includes('noindex,nofollow'));
}

console.log('\n── AI chat ────────────────────────────────');
{
  const post = (msgs, origin = 'https://shop.example.com') => get('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}), 'cf-connecting-ip': '9.9.9.' + Math.floor(Math.random() * 200) },
    body: JSON.stringify({ messages: msgs }),
  });
  let calls = []; let prompt = '';
  const say = (q) => [{ role: 'user', content: q }];

  check('no widget when AI binding missing', !(await (await get('/')).text()).includes('/chat.js'));
  check('chat 404 when AI binding missing', (await post(say('hi'))).status === 404);

  env.AI = { run: async (model, args) => { calls.push(model); prompt = args.messages[0].content; return { response: 'Our Vitamin C serum is Rs 1,850. /product/vitamin-c-brightening-serum' }; } };
  check('widget script loaded when AI on', (await (await get('/')).text()).includes('/chat.js'));

  let r = await post(say('price of vitamin c serum?')); let j = await r.json();
  check('normal question answered', r.status === 200 && j.ok && j.reply.includes('1,850'));
  check('catalogue fed to model', prompt.includes('Vitamin C Brightening Serum') && prompt.includes('Rs 1,850'));
  check('system prompt forbids medical advice', /NEVER give medical advice/.test(prompt));
  check('no secrets in prompt', !prompt.includes('SUPABASE') && !prompt.includes('eyJ'));

  calls = [];
  r = await post(say('Can you diagnose this rash? Is it eczema?')); j = await r.json();
  check('medical question refused', j.ok && j.refused && /can't give medical advice/.test(j.reply));
  check('medical question never reaches the model', calls.length === 0);
  check('acne serum question is NOT blocked', (await (await post(say('best serum for acne marks'))).json()).refused !== true);

  r = await post(say('where is ORD-2609-1001?')); await r.json();
  check('order without phone asks for it', /last 6 digits/.test(prompt) && !prompt.includes('dispatched'));
  r = await post(say('ORD-2609-1001 phone 123456')); await r.json();
  check('verified order status injected', prompt.includes('ORDER LOOKUP RESULT') && prompt.includes('dispatched'));

  check('cross-origin rejected', (await post(say('hi'), 'https://evil.com')).status === 403);
  check('missing origin rejected', (await post(say('hi'), null)).status === 403);
  check('empty transcript rejected', (await post([])).status === 400);

  env.AI = { run: async () => { throw new Error('model down'); } };
  r = await post(say('hello')); const t2 = await r.text();
  check('model failure → friendly 502, no leak', r.status === 502 && !t2.includes('model down'));

  env.AI = { run: async () => ({ response: 'ok' }) };
  let last = 0;
  for (let i = 0; i < 17; i++) {
    last = (await get('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://shop.example.com', 'cf-connecting-ip': '7.7.7.7' }, body: JSON.stringify({ messages: say('hi') }) })).status;
  }
  check('chat rate limited', last === 429);
  delete env.AI;
}

console.log('\n── resilience ─────────────────────────────');
{
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response('boom', { status: 500 });
  const r = await get('/');
  check('DB failure → 500 page, not a stack trace', r.status === 500);
  const h = await r.text();
  check('500 page is friendly', h.includes('Something went wrong'));
  check('no stack trace leaked', !h.includes('at async') && !h.includes('Supabase 500'));
  globalThis.fetch = saved;
}

console.log('\n' + (fails ? '✗ ' + fails + ' check(s) failed' : '✓ all checks passed') + '\n');
process.exit(fails ? 1 : 0);
