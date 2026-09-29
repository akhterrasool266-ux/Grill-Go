// ============================================================================
//  PRODUCT DETAIL PAGE   —   /product/<slug>
//  Fully server-rendered: name, price, description, stock and structured data
//  are all in the first HTML response.
// ============================================================================
import {
  esc, money, discountPct, picture, img, sortedImages, activeVariants, inStock,
} from '../lib.js';
import { icon } from '../layout.js';
import { grid, trustBar, crumbs } from './shop.js';

function deliveryEta() {
  const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);
  const e = new Date(Date.now() + 1000 * 60 * 60 * 24 * 4);
  const f = (x) => x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${f(d)} – ${f(e)}`;
}

export function productPage({ cfg, p, related, trail }) {
  const sym = cfg.currencySymbol || 'Rs';
  const images = sortedImages(p);
  const vars = activeVariants(p);
  const ok = inStock(p);

  const base = vars.length
    ? (vars.find((v) => v.is_default) || vars[0])
    : { id: '', label: '', qty: 1, price: Number(p.price), original_price: Number(p.original_price) || 0, badge: '' };

  const pct = discountPct(base.price, base.original_price);
  const features = Array.isArray(p.features) ? p.features : [];
  const benefits = Array.isArray(p.benefits) ? p.benefits : [];
  const stars = Math.round(Number(p.rating) || 0);

  const codNote = p.cod_enabled
    ? 'Cash on delivery available'
    : 'Advance payment only for this item';

  return `<div class="wrap">
${crumbs(trail)}
<div class="pdp">

  <div class="gal">
    <div class="galmain" data-galmain>
      ${images.length
        ? picture({ url: images[0].url, alt: images[0].alt || p.name, width: 900,
                    ratio: '1/1', eager: true, sizes: '(max-width:768px) 100vw, 520px' })
        : picture({ url: '', alt: p.name, ratio: '1/1' })}
    </div>
    ${images.length > 1 ? `<div class="thumbs" role="tablist" aria-label="Product images">
      ${images.map((im, i) => `<button role="tab" aria-selected="${i === 0}"
        class="${i === 0 ? 'on' : ''}" data-thumb="${esc(img(im.url, 900))}"
        data-full="${esc(im.url)}" aria-label="Image ${i + 1}">
        <img src="${esc(img(im.url, 120))}" alt="${esc(im.alt || p.name)}" width="64" height="64" loading="lazy">
      </button>`).join('')}
    </div>` : ''}
  </div>

  <div class="pinfo" data-pdp
       data-id="${esc(p.id)}" data-slug="${esc(p.slug)}" data-pname="${esc(p.name)}"
       data-image="${esc(images[0] ? images[0].url : '')}"
       data-cod="${p.cod_enabled ? 1 : 0}">
    ${p.brand ? `<div class="pbrand">${esc(p.brand)}</div>` : ''}
    <h1>${esc(p.name)}</h1>

    ${Number(p.review_count) > 0 ? `<div class="rate">
      <span class="stars" aria-hidden="true">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>
      <span>${Number(p.rating).toFixed(1)} · ${Number(p.review_count)} reviews</span>
    </div>` : ''}

    <div class="pprice">
      <span class="price" data-price-out>${money(base.price, sym)}</span>
      ${base.original_price > base.price
        ? `<s class="was" data-was-out>${money(base.original_price, sym)}</s>
           <span class="psave" data-save-out>Save ${pct}%</span>` : ''}
    </div>
    <div class="note">${p.sku ? 'SKU ' + esc(p.sku) + ' · ' : ''}${
      ok ? '<span style="color:var(--sale);font-weight:700">In stock</span>' : '<span style="color:#b42318;font-weight:700">Out of stock</span>'
    } · ${esc(codNote)}</div>

    ${p.short_description ? `<p class="pshort">${esc(p.short_description)}</p>` : ''}

    ${features.length ? `<ul class="feat">${features.slice(0, 8).map((f) =>
      `<li>${icon('check')}<span>${esc(typeof f === 'string' ? f : f.text || '')}</span></li>`).join('')}</ul>` : ''}

    ${vars.length > 1 ? `<div>
      <div style="font-size:12.5px;font-weight:800;margin-bottom:7px">CHOOSE YOUR PACK</div>
      <div class="packs" role="radiogroup" aria-label="Pack size">
        ${vars.map((v, i) => {
          const vp = discountPct(v.price, v.original_price);
          const sel = v.id === base.id;
          const vout = v.track_stock && Number(v.stock) <= 0;
          return `<button type="button" role="radio" aria-checked="${sel}"
            class="pack ${sel ? 'on' : ''}" data-variant="${esc(v.id)}"
            data-vprice="${v.price}" data-vwas="${v.original_price || 0}"
            data-vlabel="${esc(v.label)}" ${vout ? 'disabled' : ''}>
            <span class="dot" aria-hidden="true"></span>
            <span><b>${esc(v.label)}${v.badge ? `<span class="tag">${esc(v.badge)}</span>` : ''}</b>
              <small>${vout ? 'Out of stock' : (v.qty > 1 ? v.qty + ' units · ' + money(Math.round(v.price / v.qty), sym) + ' each' : 'Single unit')}</small></span>
            <span class="pp"><b>${money(v.price, sym)}</b>${
              v.original_price > v.price ? `<br><s>${money(v.original_price, sym)}</s>` : ''}${
              vp ? ` <span style="color:var(--sale);font-size:11px;font-weight:800">-${vp}%</span>` : ''}</span>
          </button>`;
        }).join('')}
      </div>
    </div>` : ''}

    <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
      <div class="qty">
        <button type="button" data-qminus aria-label="Decrease quantity">−</button>
        <span data-qty aria-live="polite">1</span>
        <button type="button" data-qplus aria-label="Increase quantity">+</button>
      </div>
      <div class="note" style="flex:1">Total <b data-line-total style="color:var(--price);font-size:15px">${money(base.price, sym)}</b></div>
    </div>

    <div class="eta">${icon('truck')}<span>Estimated delivery <b>${esc(deliveryEta())}</b> · ${esc(cfg.address || 'Pakistan')}</span></div>

    <div class="btnrow">
      <button class="btn btn-primary" data-buy ${ok ? '' : 'disabled'}>${ok ? 'Buy now' : 'Out of stock'}</button>
      <button class="btn btn-dark" data-addcart ${ok ? '' : 'disabled'}>Add to cart</button>
    </div>
    ${cfg.whatsapp ? `<a class="btn btn-wa" style="margin-top:10px"
      href="https://wa.me/${esc(cfg.whatsapp)}?text=${encodeURIComponent('Hi, I want to order: ' + p.name)}"
      rel="noopener">Order on WhatsApp</a>` : ''}

    <div class="acc">
      ${p.description ? `<details open><summary>Product details</summary>
        <div class="body rich">${safeRich(p.description)}</div></details>` : ''}
      ${benefits.length ? benefits.map((b) => `<details><summary>${esc(b.q || b.title || '')}</summary>
        <div class="body">${safeRich(b.a || b.body || '')}</div></details>`).join('') : ''}
      <details><summary>Shipping &amp; delivery</summary><div class="body">
        Orders are dispatched within 24 hours on working days and usually arrive in
        2–4 days across Pakistan. Shipping is
        ${cfg.freeShippingOver > 0 ? `free on orders above ${money(cfg.freeShippingOver, sym)}, otherwise ${money(cfg.shippingFlat, sym)}` : money(cfg.shippingFlat, sym)}.
        ${cfg.codEnabled ? 'Cash on delivery is available nationwide.' : ''}
      </div></details>
      <details><summary>Returns</summary><div class="body">
        If a product arrives damaged or is not what you ordered, contact us within
        3 days of delivery and we will replace it or refund you.
      </div></details>
    </div>
  </div>
</div>

${related.length ? `<section class="sect">
  <div class="secthead"><h2>You may also like</h2></div>
  ${grid(related, cfg, { eagerFirst: 0 })}
</section>` : ''}

${trustBar(cfg)}
</div>

<div class="buybar">
  <div class="tot"><small>Total</small><b data-bar-total>${money(base.price, sym)}</b></div>
  <button class="btn btn-primary" data-buy ${ok ? '' : 'disabled'}>${ok ? 'Buy now' : 'Out of stock'}</button>
</div>`;
}

/**
 * Product descriptions come from the admin panel. Only a small, safe subset of
 * HTML is allowed through; everything else is escaped. No scripts, ever.
 */
export function safeRich(s) {
  const ALLOWED = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote'];
  // 1. escape EVERYTHING first — nothing can slip through
  let out = esc(String(s || ''));
  // 2. put back only bare whitelisted tags; all attributes are discarded
  out = out.replace(/&lt;(\/?)([a-zA-Z0-9]+)[\s\S]*?&gt;/g, (m, slash, tag) =>
    (ALLOWED.includes(tag.toLowerCase()) ? `<${slash}${tag.toLowerCase()}>` : ''));
  // 3. plain text typed in the admin panel keeps its line breaks
  if (!/<(p|br|ul|ol|li|h2|h3|h4|blockquote)>/.test(out)) {
    out = '<p>' + out.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  }
  return out;
}
