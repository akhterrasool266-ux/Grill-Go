// ============================================================================
//  CART • CHECKOUT • ORDER CONFIRMATION • TRACKING • PAYMENT STATES • ERRORS
// ============================================================================
import { esc, money } from '../lib.js';
import { icon } from '../layout.js';
import { crumbs, trustBar } from './shop.js';

/* ================================== CART ================================= */
export function cartPage({ cfg }) {
  return `<div class="wrap">
${crumbs([{ name: 'Home', href: '/' }, { name: 'Cart' }])}
<h1>Your cart</h1>
<div class="cartgrid" style="margin-top:14px">
  <div>
    <div data-cart-lines>
      <div class="empty">${icon('box')}<h3>Your cart is empty</h3>
        <p class="note">Add something you like and it will show up here.</p>
        <p><a class="btn btn-primary" style="max-width:240px;margin:0 auto" href="/products">Start shopping</a></p></div>
    </div>
  </div>
  <div class="panel sum" data-cart-summary hidden>
    <h3 style="margin-bottom:10px">Order summary</h3>
    <div class="totals">
      <div><span>Subtotal</span><span data-t-sub>—</span></div>
      <div data-t-disc-row hidden><span>Discount</span><span data-t-disc>—</span></div>
      <div><span>Shipping</span><span data-t-ship>—</span></div>
      <div class="gt"><span>Total</span><span data-t-total>—</span></div>
    </div>
    <a class="btn btn-primary" style="margin-top:14px" href="/checkout">Proceed to checkout</a>
    <p class="note" style="margin:10px 0 0;text-align:center">
      ${cfg.codEnabled ? 'Cash on delivery available' : 'Secure online payment'}
    </p>
  </div>
</div>
${trustBar(cfg)}
</div>`;
}

/* ================================ CHECKOUT =============================== */
export function checkoutPage({ cfg, methods }) {
  const sym = cfg.currencySymbol || 'Rs';
  const labels = {
    cod:       { b: 'Cash on delivery', s: cfg.codCharges > 0 ? `Pay the rider · +${money(cfg.codCharges, sym)} service fee` : 'Pay the rider when it arrives' },
    jazzcash:  { b: 'JazzCash',         s: 'Pay from your JazzCash mobile account' },
    easypaisa: { b: 'Easypaisa',        s: 'Pay from your Easypaisa mobile account' },
    card:      { b: 'Credit / debit card', s: 'Visa, Mastercard — secure hosted checkout' },
  };

  return `<div class="wrap">
${crumbs([{ name: 'Home', href: '/' }, { name: 'Cart', href: '/cart' }, { name: 'Checkout' }])}
<h1>Checkout</h1>

<div data-checkout-empty hidden>
  <div class="empty">${icon('box')}<h3>Your cart is empty</h3>
    <p><a class="btn btn-primary" style="max-width:240px;margin:0 auto" href="/products">Browse products</a></p></div>
</div>

<form class="checkgrid" style="margin-top:14px" data-checkout novalidate>
  <div>
    <div class="panel" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px">Delivery details</h3>
      <div class="field">
        <label for="f_name">Full name <span class="req">*</span></label>
        <input class="inp" id="f_name" name="customer_name" autocomplete="name" required>
        <div class="err">Please enter your name</div>
      </div>
      <div class="field">
        <label for="f_phone">Mobile number <span class="req">*</span></label>
        <input class="inp" id="f_phone" name="phone" inputmode="tel" autocomplete="tel"
               placeholder="03XX XXXXXXX" required>
        <div class="err">Enter a valid Pakistani mobile number</div>
      </div>
      <div class="field">
        <label for="f_addr">Complete address <span class="req">*</span></label>
        <textarea class="inp" id="f_addr" name="address" autocomplete="street-address"
                  placeholder="House / flat, street, area" required></textarea>
        <div class="err">Please enter your full address</div>
      </div>
      <div class="field">
        <label for="f_city">City <span class="req">*</span></label>
        <input class="inp" id="f_city" name="city" autocomplete="address-level2" required>
        <div class="err">Please enter your city</div>
      </div>
      <div class="field">
        <label for="f_email">Email <span class="note">(optional)</span></label>
        <input class="inp" id="f_email" name="email" type="email" autocomplete="email">
      </div>
      <div class="field" style="margin-bottom:0">
        <label for="f_notes">Order notes <span class="note">(optional)</span></label>
        <textarea class="inp" id="f_notes" name="notes" style="min-height:60px"
                  placeholder="Landmark, delivery timing…"></textarea>
      </div>
    </div>

    <div class="panel">
      <h3 style="margin-bottom:12px">Payment method</h3>
      <div class="pays" role="radiogroup" aria-label="Payment method">
        ${methods.map((m, i) => `<button type="button" role="radio" aria-checked="${i === 0}"
          class="pay ${i === 0 ? 'on' : ''}" data-method="${esc(m)}">
          <span class="dot" aria-hidden="true"></span>
          <span><b>${esc(labels[m] ? labels[m].b : m)}</b><small>${esc(labels[m] ? labels[m].s : '')}</small></span>
        </button>`).join('')}
      </div>
      <p class="note" data-pay-note></p>
    </div>
  </div>

  <div class="panel sum">
    <h3 style="margin-bottom:10px">Your order</h3>
    <div data-checkout-lines style="margin-bottom:12px"></div>
    <div class="coupon">
      <input class="inp" name="coupon_code" placeholder="Discount code" autocomplete="off" data-coupon>
      <button type="button" data-coupon-apply>Apply</button>
    </div>
    <p class="note" data-coupon-msg style="margin-top:-6px"></p>
    <div class="totals">
      <div><span>Subtotal</span><span data-t-sub>—</span></div>
      <div data-t-disc-row hidden><span>Discount</span><span data-t-disc>—</span></div>
      <div><span>Shipping</span><span data-t-ship>—</span></div>
      <div data-t-cod-row hidden><span>COD fee</span><span data-t-cod>—</span></div>
      <div class="gt"><span>Total</span><span data-t-total>—</span></div>
    </div>
    <button class="btn btn-primary" style="margin-top:14px" data-place>Place order</button>
    <p class="note" style="margin:10px 0 0;text-align:center">
      By placing this order you agree to our
      <a href="/page/privacy" style="text-decoration:underline">privacy policy</a>.
    </p>
    <p class="err" data-order-err style="text-align:center"></p>
  </div>
</form>
</div>`;
}

/* ============================ ORDER CONFIRMED ============================ */
const STEPS = ['pending', 'confirmed', 'processing', 'dispatched', 'delivered'];
const STEP_LABEL = { pending: 'Placed', confirmed: 'Confirmed', processing: 'Packed', dispatched: 'Dispatched', delivered: 'Delivered' };

function statusPill(o) {
  if (o.status === 'cancelled') return '<span class="pill bad">Cancelled</span>';
  if (o.status === 'returned') return '<span class="pill bad">Returned</span>';
  if (o.status === 'delivered') return '<span class="pill ok">Delivered</span>';
  return `<span class="pill warn">${esc(STEP_LABEL[o.status] || o.status)}</span>`;
}

function payPill(o) {
  const m = { paid: ['ok', 'Paid'], pending: ['warn', 'Payment pending'], unpaid: ['warn', o.payment_method === 'cod' ? 'Pay on delivery' : 'Unpaid'], failed: ['bad', 'Payment failed'], cancelled: ['bad', 'Payment cancelled'], refunded: ['ok', 'Refunded'] };
  const [k, t] = m[o.payment_state] || ['warn', o.payment_state];
  return `<span class="pill ${k}">${esc(t)}</span>`;
}

function orderTable(o, sym) {
  return `<div class="panel" style="margin-top:14px">
    ${(o.items || []).map((it) => `<div class="line">
      ${it.image_url ? `<img src="${esc(it.image_url)}" alt="" width="74" height="74" loading="lazy">` : '<div class="ph"></div>'}
      <div class="li"><b>${esc(it.name)}</b>
        <small>${it.variant ? esc(it.variant) + ' · ' : ''}Qty ${Number(it.qty)}</small></div>
      <div style="font-weight:700;white-space:nowrap">${money(it.line_total, sym)}</div>
    </div>`).join('')}
    <div class="totals" style="margin-top:12px">
      <div><span>Subtotal</span><span>${money(o.subtotal, sym)}</span></div>
      ${Number(o.discount) > 0 ? `<div><span>Discount</span><span>−${money(o.discount, sym)}</span></div>` : ''}
      <div><span>Shipping</span><span>${Number(o.shipping) > 0 ? money(o.shipping, sym) : 'Free'}</span></div>
      ${Number(o.cod_fee) > 0 ? `<div><span>COD fee</span><span>${money(o.cod_fee, sym)}</span></div>` : ''}
      <div class="gt"><span>Total</span><span>${money(o.total, sym)}</span></div>
    </div>
  </div>`;
}

export function orderPage({ cfg, o, justPlaced }) {
  const sym = cfg.currencySymbol || 'Rs';
  const idx = STEPS.indexOf(o.status);
  const dead = o.status === 'cancelled' || o.status === 'returned';

  return `<div class="wrap" style="max-width:820px">
  ${justPlaced ? `<div class="state ok">
    <div class="ic">${icon('check')}</div>
    <h1>Thank you — your order is placed</h1>
    <p class="note">Order number <b style="color:var(--ink)">${esc(o.order_number)}</b><br>
    We will contact you on your mobile number to confirm.</p>
  </div>` : `<h1 style="margin-top:16px">Order ${esc(o.order_number)}</h1>`}

  <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
    <div><small class="note">Placed on</small><br><b>${new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${statusPill(o)}${payPill(o)}</div>
  </div>

  ${dead ? '' : `<div class="steps" aria-label="Order progress">
    ${STEPS.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''}">${esc(STEP_LABEL[s])}</div>`).join('')}
  </div>`}

  ${o.tracking_note ? `<div class="eta" style="margin-top:6px">${icon('truck')}<span>${esc(o.tracking_note)}</span></div>` : ''}

  ${orderTable(o, sym)}

  <div class="panel" style="margin-top:14px">
    <h3 style="margin-bottom:8px">Delivery to</h3>
    <p class="note" style="margin:0">${esc(o.customer_name)} · ${esc(o.city)}</p>
  </div>

  <div class="btnrow" style="margin-top:16px">
    <a class="btn" href="/products">Continue shopping</a>
    ${cfg.whatsapp ? `<a class="btn btn-wa" rel="noopener"
      href="https://wa.me/${esc(cfg.whatsapp)}?text=${encodeURIComponent('Hi, about my order ' + o.order_number)}">Ask about this order</a>` : ''}
  </div>
</div>
${justPlaced ? `<script>try{localStorage.removeItem('cart_v1');
if(window.fbq)fbq('track','Purchase',{value:${Number(o.total) || 0},currency:'${esc(cfg.currency)}'});
if(window.gtag)gtag('event','purchase',{transaction_id:'${esc(o.order_number)}',value:${Number(o.total) || 0},currency:'${esc(cfg.currency)}'});
}catch(e){}</script>` : ''}`;
}

/* ================================ TRACKING =============================== */
export function trackPage({ cfg, error, prefill = {} }) {
  return `<div class="wrap" style="max-width:560px">
${crumbs([{ name: 'Home', href: '/' }, { name: 'Track order' }])}
<h1>Track your order</h1>
<p class="note">Enter your order number and the mobile number you ordered with.</p>
<form class="panel" method="get" action="/track" style="margin-top:12px">
  <div class="field">
    <label for="t_no">Order number</label>
    <input class="inp" id="t_no" name="no" placeholder="ORD-2609-1001" required
           value="${esc(prefill.no || '')}">
  </div>
  <div class="field">
    <label for="t_ph">Mobile number</label>
    <input class="inp" id="t_ph" name="p" inputmode="tel" placeholder="03XX XXXXXXX" required
           value="${esc(prefill.p || '')}">
  </div>
  ${error ? `<p class="err" style="display:block">${esc(error)}</p>` : ''}
  <button class="btn btn-primary">Find my order</button>
</form>
${cfg.whatsapp ? `<p class="note" style="text-align:center;margin-top:14px">
  Need help? <a href="https://wa.me/${esc(cfg.whatsapp)}" style="text-decoration:underline">Message us on WhatsApp</a></p>` : ''}
</div>`;
}

/* ============================= PAYMENT STATES ============================ */
export function paymentStatePage({ cfg, kind, orderNumber, message }) {
  const M = {
    success:   ['ok',   'check',  'Payment received',        'Your payment went through and your order is confirmed.'],
    failed:    ['bad',  'close',  'Payment failed',          'Your payment could not be completed. No money has been taken. You can try again or choose cash on delivery.'],
    pending:   ['warn', 'truck',  'Payment pending',         'Your bank or wallet has not confirmed the payment yet. We will update your order as soon as it clears — this can take a few minutes.'],
    cancelled: ['warn', 'close',  'Payment cancelled',       'You cancelled the payment, so the order has not been confirmed.'],
    outofstock:['bad',  'box',    'Out of stock',            'Sorry — this item sold out before your order was completed. Nothing has been charged.'],
  };
  const [tone, ic, title, text] = M[kind] || M.failed;
  return `<div class="wrap" style="max-width:600px">
  <div class="state ${tone}">
    <div class="ic">${icon(ic)}</div>
    <h1>${esc(title)}</h1>
    <p class="note">${esc(message || text)}</p>
    ${orderNumber ? `<p class="note">Order <b style="color:var(--ink)">${esc(orderNumber)}</b></p>` : ''}
  </div>
  <div class="btnrow">
    ${orderNumber ? `<a class="btn" href="/track">Track my order</a>` : `<a class="btn" href="/cart">Back to cart</a>`}
    <a class="btn btn-primary" href="/products">Continue shopping</a>
  </div>
  ${cfg.whatsapp ? `<p class="note" style="text-align:center;margin-top:16px">
    Something not right? <a href="https://wa.me/${esc(cfg.whatsapp)}" style="text-decoration:underline">Message us on WhatsApp</a></p>` : ''}
</div>`;
}

/* ================================= ERRORS ================================ */
export function errorPage({ cfg, code, title, text }) {
  return `<div class="wrap" style="max-width:600px">
  <div class="state ${code === 404 ? 'warn' : 'bad'}">
    <div class="ic" style="font-size:22px;font-weight:800">${code}</div>
    <h1>${esc(title)}</h1>
    <p class="note">${esc(text)}</p>
  </div>
  <div class="btnrow">
    <a class="btn" href="/">Go to homepage</a>
    <a class="btn btn-primary" href="/products">Browse products</a>
  </div>
</div>`;
}

/* ============================== STATIC PAGES ============================= */
export const STATIC_PAGES = {
  about: {
    title: 'About us',
    body: (cfg) => `<p>${esc(cfg.brandName)} — ${esc(cfg.tagline)}.</p>
      <p>${esc(cfg.description)}</p>
      <h2>Why customers choose us</h2>
      <ul><li>Only genuine, sealed products</li><li>Cash on delivery all over Pakistan</li>
      <li>Real people on WhatsApp if you need help</li><li>Easy 3-day returns on damaged items</li></ul>`,
  },
  contact: {
    title: 'Contact us',
    body: (cfg) => `<p>We reply to every message, usually within a few hours.</p>
      <ul>
      ${cfg.whatsapp ? `<li>WhatsApp: <a href="https://wa.me/${esc(cfg.whatsapp)}" style="text-decoration:underline">${esc(cfg.phone || cfg.whatsapp)}</a></li>` : ''}
      ${cfg.phone ? `<li>Phone: ${esc(cfg.phone)}</li>` : ''}
      ${cfg.email ? `<li>Email: <a href="mailto:${esc(cfg.email)}" style="text-decoration:underline">${esc(cfg.email)}</a></li>` : ''}
      ${cfg.address ? `<li>Address: ${esc(cfg.address)}</li>` : ''}
      </ul>
      <h2>Order questions</h2>
      <p>Have your order number ready and you can also
      <a href="/track" style="text-decoration:underline">track your order here</a>.</p>`,
  },
  shipping: {
    title: 'Shipping policy',
    body: (cfg) => `<p>We ship all over Pakistan through trusted courier partners.</p>
      <h2>Dispatch time</h2><p>Orders are dispatched within 24 hours on working days.</p>
      <h2>Delivery time</h2><p>2–4 working days for most cities, up to 6 days for remote areas.</p>
      <h2>Charges</h2><p>${cfg.freeShippingOver > 0
        ? `Flat ${money(cfg.shippingFlat, cfg.currencySymbol)} — free on orders over ${money(cfg.freeShippingOver, cfg.currencySymbol)}.`
        : `Flat ${money(cfg.shippingFlat, cfg.currencySymbol)} per order.`}
      ${cfg.codEnabled ? ` Cash on delivery is available${cfg.codCharges > 0 ? ` with a ${money(cfg.codCharges, cfg.currencySymbol)} service fee` : ' at no extra cost'}.` : ''}</p>`,
  },
  returns: {
    title: 'Returns & refunds',
    body: () => `<h2>3-day return window</h2>
      <p>If your parcel arrives damaged, leaking, expired or is not the product you
      ordered, contact us within 3 days of delivery with photos and we will replace
      it or refund you in full.</p>
      <h2>What we cannot accept</h2>
      <p>For hygiene reasons, opened or used skincare products cannot be returned
      unless the item is faulty.</p>
      <h2>How to start a return</h2>
      <p>Message us with your order number and a photo of the product and we will
      arrange pickup.</p>`,
  },
  privacy: {
    title: 'Privacy policy',
    body: (cfg) => `<p>We only collect what we need to deliver your order: your name,
      mobile number, address and (optionally) email.</p>
      <h2>How we use it</h2>
      <p>To process and deliver your order, to contact you about that order, and to
      handle returns. We never sell your data.</p>
      <h2>Who else sees it</h2>
      <p>Our courier partner receives your name, address and phone number so they can
      deliver. Payment providers receive only what they need to process a payment — we
      never store card details on our servers.</p>
      <h2>Analytics</h2>
      <p>We use standard website analytics${cfg.metaPixelId ? ' and the Meta pixel' : ''} to
      understand which products people are interested in.</p>
      <h2>Your choices</h2>
      <p>Email${cfg.email ? ' ' + esc(cfg.email) : ' us'} at any time to ask what we hold
      about you or to have it deleted.</p>`,
  },
};

export function staticPage({ cfg, slug }) {
  const p = STATIC_PAGES[slug];
  return `<div class="wrap" style="max-width:760px">
${crumbs([{ name: 'Home', href: '/' }, { name: p.title }])}
<h1>${esc(p.title)}</h1>
<div class="prose">${p.body(cfg)}</div>
</div>`;
}
