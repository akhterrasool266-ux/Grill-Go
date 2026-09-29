// ============================================================================
//  HOME  •  PRODUCT LISTING  •  CATEGORY  •  SEARCH   (all server-rendered)
// ============================================================================
import {
  esc, money, discountPct, picture, mainImage, inStock, plain, activeVariants,
} from '../lib.js';
import { icon } from '../layout.js';

/* ------------------------------ product card ----------------------------- */
export function productCard(p, cfg, { eager = false } = {}) {
  const im = mainImage(p);
  const sym = cfg.currencySymbol || 'Rs';
  const vars = activeVariants(p);
  // the "from" price and its OWN original price — never mix two different packs
  const cheapest = vars.length
    ? vars.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a))
    : null;
  const price = cheapest ? Number(cheapest.price) : Number(p.price);
  const was = cheapest
    ? Number(cheapest.original_price) || 0
    : Number(p.original_price) || 0;
  const pct = discountPct(price, was);
  const ok = inStock(p);
  const stars = '★★★★★'.slice(0, Math.round(Number(p.rating) || 0))
              + '☆☆☆☆☆'.slice(0, 5 - Math.round(Number(p.rating) || 0));

  return `<article class="card">
  <a class="cardimg" href="/product/${esc(p.slug)}" aria-label="${esc(p.name)}">
    ${picture({ url: im && im.url, alt: (im && im.alt) || p.name, width: 480, ratio: '1/1', eager })}
    ${pct ? `<span class="off">-${pct}%</span>` : ''}
    ${ok ? '' : '<span class="oos">Out of stock</span>'}
  </a>
  <div class="cardbody">
    <a class="cardname" href="/product/${esc(p.slug)}">${esc(p.name)}</a>
    ${Number(p.review_count) > 0
      ? `<div class="rate"><span class="stars" aria-hidden="true">${stars}</span>
         <span>${Number(p.rating).toFixed(1)} (${Number(p.review_count)})</span></div>`
      : ''}
    <div class="pricerow">
      <span class="price">${money(price, sym)}</span>
      ${pct ? `<s class="was">${money(was, sym)}</s>` : ''}
    </div>
    ${ok
      ? `<button class="cardbtn" data-add="${esc(p.id)}" data-slug="${esc(p.slug)}"
           data-name="${esc(p.name)}" data-price="${price}"
           data-img="${esc(im ? im.url : '')}"
           ${vars.length > 1 ? 'data-choose="1"' : ''}>
           ${vars.length > 1 ? 'Choose option' : 'Add to cart'}</button>`
      : '<button class="cardbtn" disabled>Out of stock</button>'}
  </div>
</article>`;
}

export function grid(products, cfg, { eagerFirst = 4 } = {}) {
  if (!products.length) {
    return `<div class="empty">${icon('box')}<h3>Nothing here yet</h3>
      <p class="note">New products are added regularly — please check back soon.</p>
      <p><a class="btn btn-primary" style="max-width:240px;margin:0 auto" href="/products">Browse all products</a></p></div>`;
  }
  return `<div class="grid">${products.map((p, i) =>
    productCard(p, cfg, { eager: i < eagerFirst })).join('')}</div>`;
}

/* -------------------------------- trust bar ------------------------------ */
export function trustBar(cfg) {
  return `<div class="trust">${cfg.trustBar.map((t) =>
    `<div>${icon(t.icon)}<div class="ti"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div></div>`
  ).join('')}</div>`;
}

/* ------------------------------ category strip --------------------------- */
function categoryRow(categories) {
  if (!categories.length) return '';
  return `<div class="catrow">${categories.map((c) => `
    <a class="cat" href="/category/${esc(c.slug)}">
      ${picture({ url: c.image_url, alt: c.name, width: 160, ratio: '1/1', sizes: '90px' })}
      <span>${esc(c.name)}</span>
    </a>`).join('')}</div>`;
}

/* -------------------------------- crumbs --------------------------------- */
export function crumbs(trail) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${trail.map((t, i) =>
    (i ? '<span aria-hidden="true">/</span>' : '') +
    (t.href ? `<a href="${esc(t.href)}">${esc(t.name)}</a>` : `<span>${esc(t.name)}</span>`)
  ).join('')}</nav>`;
}

/* --------------------------------- slider -------------------------------- */
function slider(banners) {
  const list = (banners || []).filter((b) => b && b.image);
  if (!list.length) return '';
  return `<section class="hero"><div class="wrap">
    <div class="slider" data-slider>
      <div class="track" data-track>
        ${list.map((b, i) => `<div class="slide">${
          b.href ? `<a href="${esc(b.href)}">` : ''}${
          picture({ url: b.image, alt: b.alt || '', width: 1400, ratio: '16/9', eager: i === 0,
                    sizes: '100vw' })}${b.href ? '</a>' : ''}</div>`).join('')}
      </div>
      ${list.length > 1 ? `
      <button class="snav l" data-prev aria-label="Previous slide">${icon('left')}</button>
      <button class="snav r" data-next aria-label="Next slide">${icon('right')}</button>
      <div class="dots" data-dots>${list.map((_, i) =>
        `<b class="${i ? '' : 'on'}"></b>`).join('')}</div>` : ''}
    </div>
  </div></section>`;
}

/* ================================== HOME ================================= */
export function homePage({ cfg, categories, banners, trending, featured, latest }) {
  const section = (title, href, items) => items.length ? `
    <section class="sect"><div class="wrap">
      <div class="secthead"><h2>${esc(title)}</h2>${href ? `<a href="${esc(href)}">View all ${icon('chev')}</a>` : ''}</div>
      ${grid(items, cfg, { eagerFirst: 0 })}
    </div></section>` : '';

  return `
${slider(banners)}
<div class="wrap">
  ${categories.length ? `<section class="sect" style="margin-top:20px">
    <div class="secthead"><h2>Shop by category</h2><a href="/products">All ${icon('chev')}</a></div>
    ${categoryRow(categories)}
  </section>` : ''}
  ${trustBar(cfg)}
</div>
${section('Trending now', '/products?sort=trending', trending)}
${section('Bestsellers', '/products?sort=featured', featured)}
${section('New arrivals', '/products?sort=new', latest)}
<section class="sect"><div class="wrap herotext">
  <h1>${esc(cfg.heroTitle || cfg.brandName)}</h1>
  <p>${esc(cfg.heroSub || cfg.description)}</p>
  <p><a class="btn btn-primary" style="max-width:260px;margin:0 auto" href="/products">Shop all products</a></p>
</div></section>`;
}

/* ============================ LISTING / SEARCH =========================== */
export function listPage({ cfg, title, intro, products, total, page, pages, baseHref, sort, trail, categories, activeCat, q }) {
  const qs = (over) => {
    const o = { sort, page, ...over };
    const parts = [];
    if (o.q) parts.push('q=' + encodeURIComponent(o.q));
    if (o.sort && o.sort !== 'new') parts.push('sort=' + encodeURIComponent(o.sort));
    if (o.page && o.page > 1) parts.push('page=' + o.page);
    return baseHref + (parts.length ? '?' + parts.join('&') : '');
  };

  const pager = () => {
    if (pages <= 1) return '';
    const out = [];
    const add = (n) => out.push(n === page
      ? `<span class="on" aria-current="page">${n}</span>`
      : `<a href="${esc(qs({ page: n, q }))}">${n}</a>`);
    if (page > 1) out.push(`<a href="${esc(qs({ page: page - 1, q }))}" rel="prev" aria-label="Previous page">${icon('left')}</a>`);
    const from = Math.max(1, page - 2), to = Math.min(pages, page + 2);
    if (from > 1) { add(1); if (from > 2) out.push('<span style="border:0;background:none">…</span>'); }
    for (let i = from; i <= to; i++) add(i);
    if (to < pages) { if (to < pages - 1) out.push('<span style="border:0;background:none">…</span>'); add(pages); }
    if (page < pages) out.push(`<a href="${esc(qs({ page: page + 1, q }))}" rel="next" aria-label="Next page">${icon('right')}</a>`);
    return `<nav class="pager" aria-label="Pagination">${out.join('')}</nav>`;
  };

  return `<div class="wrap">
  ${crumbs(trail)}
  <h1>${esc(title)}</h1>
  ${intro ? `<p class="note" style="max-width:70ch">${esc(intro)}</p>` : ''}
  ${categories.length ? `<div class="cattabs">
    <a href="/products"${!activeCat ? ' class="on"' : ''}>All</a>
    ${categories.map((c) => `<a href="/category/${esc(c.slug)}"${activeCat === c.slug ? ' class="on"' : ''}>${esc(c.name)}</a>`).join('')}
  </div>` : ''}
  <div class="filters">
    <form method="get" action="${esc(baseHref)}" data-sortform>
      ${q ? `<input type="hidden" name="q" value="${esc(q)}">` : ''}
      <label class="sr" for="sort">Sort products</label>
      <select id="sort" name="sort" onchange="this.form.submit()">
        <option value="new"      ${sort === 'new' ? 'selected' : ''}>Newest first</option>
        <option value="low"      ${sort === 'low' ? 'selected' : ''}>Price: low to high</option>
        <option value="high"     ${sort === 'high' ? 'selected' : ''}>Price: high to low</option>
        <option value="rating"   ${sort === 'rating' ? 'selected' : ''}>Top rated</option>
        <option value="featured" ${sort === 'featured' ? 'selected' : ''}>Bestsellers</option>
        <option value="trending" ${sort === 'trending' ? 'selected' : ''}>Trending</option>
      </select>
      <noscript><button class="btn" style="width:auto;min-height:38px">Apply</button></noscript>
    </form>
    <span class="count">${total} product${total === 1 ? '' : 's'}</span>
  </div>
  ${grid(products, cfg)}
  ${pager()}
  ${trustBar(cfg)}
</div>`;
}
