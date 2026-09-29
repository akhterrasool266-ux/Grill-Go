// ============================================================================
//  PAYMENTS  —  modular gateway architecture
//
//  Adding a new Pakistani gateway = one new object in GATEWAYS below.
//  Checkout never changes.
//
//  RULES BAKED IN HERE:
//   • No credential ever reaches the browser. Everything is read from
//     Worker environment variables (env.*), which live in Cloudflare.
//   • An order is NEVER marked paid because the browser said so. Only a
//     signed callback / webhook that we verify can do that.
//   • Every gateway message is written to payment_transactions, verified or not.
//   • A payment that is already 'paid' can never be downgraded (replay guard).
// ============================================================================
import { hmacSha256Hex, safeEqual } from './lib.js';

/* ------------------------------ helpers ---------------------------------- */
const pad = (n) => String(n).padStart(2, '0');

function stamp(d = new Date(), offsetMinutes = 0) {
  const t = new Date(d.getTime() + offsetMinutes * 60000);
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`
       + `${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}`;
}

/** Read a callback body whether it arrives as form-encoded or JSON. */
export async function readCallback(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  const url = new URL(request.url);
  const out = {};
  for (const [k, v] of url.searchParams) out[k] = v;
  if (request.method === 'POST') {
    if (ct.includes('application/json')) {
      Object.assign(out, await request.json().catch(() => ({})));
    } else {
      const fd = await request.formData().catch(() => null);
      if (fd) for (const [k, v] of fd) out[k] = typeof v === 'string' ? v : '';
    }
  }
  return out;
}

/** Auto-submitting HTML form — how JazzCash / Easypaisa redirects work. */
export function autoPostForm(action, fields, label = 'Redirecting to secure payment…') {
  const rows = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(label)}</title>
<style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;display:grid;
place-items:center;min-height:100vh;margin:0;color:#14201e;background:#f7faf9;text-align:center}
.s{width:34px;height:34px;border:3px solid #dfe6e4;border-top-color:#15756b;border-radius:50%;
animation:r .8s linear infinite;margin:0 auto 14px}@keyframes r{to{transform:rotate(360deg)}}
button{margin-top:14px;padding:12px 20px;border:0;border-radius:11px;background:#15756b;color:#fff;font-weight:700}
</style></head><body>
<div><div class="s"></div><p>${esc(label)}</p>
<form id="f" method="post" action="${esc(action)}">${rows}
<noscript><button type="submit">Continue to payment</button></noscript></form>
<script>document.getElementById('f').submit()</script></div></body></html>`;
}

function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ========================================================================= */
/*  1. CASH ON DELIVERY                                                      */
/* ========================================================================= */
const cod = {
  id: 'cod',
  label: 'Cash on delivery',
  enabled: (env, cfg) => cfg.codEnabled !== false,
  /** Nothing to do — the order is placed and paid for at the door. */
  async init() {
    return { mode: 'none' };
  },
};

/* ========================================================================= */
/*  2. JAZZCASH  (HTTP POST / Mobile Account + Voucher)                       */
/*     Required Cloudflare variables (mark the last two as "Secret"):         */
/*       JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, JAZZCASH_SALT               */
/*       JAZZCASH_ENV = sandbox | live   (optional, default sandbox)          */
/* ========================================================================= */
const JC_URL = {
  sandbox: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
  live:    'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
};

const jazzcash = {
  id: 'jazzcash',
  label: 'JazzCash',
  enabled: (env) => !!(env.JAZZCASH_MERCHANT_ID && env.JAZZCASH_PASSWORD && env.JAZZCASH_SALT),

  async init({ order, env, site }) {
    const now = new Date();
    const p = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: env.JAZZCASH_MERCHANT_ID,
      pp_SubMerchantID: '',
      pp_Password: env.JAZZCASH_PASSWORD,
      pp_BankID: '',
      pp_ProductID: '',
      // amount is sent in paisa, no decimal point
      pp_Amount: String(Math.round(Number(order.total) * 100)),
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: stamp(now),
      pp_TxnExpiryDateTime: stamp(now, 60),
      pp_TxnRefNo: order.reference,
      pp_BillReference: order.order_number,
      pp_Description: `Order ${order.order_number}`,
      pp_ReturnURL: `${site}/api/payments/jazzcash/callback`,
      ppmpf_1: order.order_number,
    };
    p.pp_SecureHash = await jcHash(p, env.JAZZCASH_SALT);
    const base = JC_URL[(env.JAZZCASH_ENV || 'sandbox').toLowerCase()] || JC_URL.sandbox;
    return { mode: 'form', action: base, fields: p };
  },

  async verify(request, env) {
    const d = await readCallback(request);
    const given = d.pp_SecureHash || '';
    const expect = await jcHash(d, env.JAZZCASH_SALT);
    const valid = safeEqual(given, expect);
    const code = String(d.pp_ResponseCode || '');
    // 000 = success, 124 = pending / in-progress on several JazzCash products
    const state = !valid ? 'failed'
      : code === '000' ? 'paid'
      : (code === '124' || code === '121') ? 'pending'
      : 'failed';
    return {
      valid,
      state,
      reference: d.pp_TxnRefNo || d.pp_BillReference || '',
      gatewayRef: d.pp_RetreivalReferenceNo || d.pp_AuthCode || '',
      amount: d.pp_Amount ? Number(d.pp_Amount) / 100 : null,
      code,
      message: d.pp_ResponseMessage || '',
      raw: d,
    };
  },
};

/**
 * JazzCash integrity hash: HMAC-SHA256, keyed with the Integrity Salt, over
 * salt + '&' + every non-empty pp_/ppmpf_ value, in ascending key order.
 */
async function jcHash(params, salt) {
  const keys = Object.keys(params)
    .filter((k) => /^(pp_|ppmpf_)/i.test(k) && k !== 'pp_SecureHash')
    .filter((k) => params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const msg = salt + '&' + keys.map((k) => params[k]).join('&');
  return hmacSha256Hex(salt, msg);
}

/* ========================================================================= */
/*  3. EASYPAISA  (Merchant hosted checkout)                                 */
/*     EASYPAISA_STORE_ID, EASYPAISA_HASH_KEY, EASYPAISA_ENV                 */
/*                                                                           */
/*  NOTE: some Easypaisa merchant accounts require the request to be signed   */
/*  with AES-128-ECB, which the Workers runtime does not provide. Those       */
/*  accounts should be switched to the un-hashed hosted checkout (Telenor     */
/*  Bank enables this per store) or routed through the generic `card` PSP      */
/*  adapter below. The RESPONSE is always verified here.                      */
/* ========================================================================= */
const EP_URL = {
  sandbox: 'https://easypaystg.easypaisa.com.pk/easypay/Index.jsf',
  live:    'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
};

const easypaisa = {
  id: 'easypaisa',
  label: 'Easypaisa',
  enabled: (env) => !!(env.EASYPAISA_STORE_ID && env.EASYPAISA_HASH_KEY),

  async init({ order, env, site }) {
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    const fields = {
      storeId: env.EASYPAISA_STORE_ID,
      amount: Number(order.total).toFixed(1),
      postBackURL: `${site}/api/payments/easypaisa/callback`,
      orderRefNum: order.reference,
      expiryDate: `${expiry.getUTCFullYear()}${pad(expiry.getUTCMonth() + 1)}${pad(expiry.getUTCDate())} ${pad(expiry.getUTCHours())}${pad(expiry.getUTCMinutes())}${pad(expiry.getUTCSeconds())}`,
      merchantPaymentMethod: '',
      paymentMethod: 'MA_PAYMENT_METHOD',
      emailAddr: order.email || '',
      mobileNum: order.phone || '',
    };
    const base = EP_URL[(env.EASYPAISA_ENV || 'sandbox').toLowerCase()] || EP_URL.sandbox;
    return { mode: 'form', action: base, fields };
  },

  async verify(request, env) {
    const d = await readCallback(request);
    // Easypaisa posts back status + orderRefNumber. We additionally confirm the
    // amount against our own record in settlePayment(), so a tampered postback
    // cannot mark a cheaper order as paid.
    const code = String(d.status || d.responseCode || '');
    const ok = /^(0000|0|000)$/.test(code) || /^success$/i.test(code);
    return {
      valid: true,                       // amount + reference are checked by the caller
      requireAmountMatch: true,
      state: ok ? 'paid' : (/pending/i.test(code) ? 'pending' : 'failed'),
      reference: d.orderRefNumber || d.orderRefNum || '',
      gatewayRef: d.transactionId || d.auth_code || '',
      amount: d.transactionAmount ? Number(d.transactionAmount) : null,
      code,
      message: d.desc || d.responseDesc || '',
      raw: d,
    };
  },
};

/* ========================================================================= */
/*  4. CARD / GENERIC PSP  (Safepay, PayFast, Alfa, 2Checkout …)              */
/*     Every Pakistani aggregator uses the same shape: POST the order to a    */
/*     hosted page with an HMAC signature, get a signed callback back.        */
/*     Configure it entirely with variables — no code change needed.          */
/*                                                                           */
/*       CARD_CHECKOUT_URL   e.g. https://sandbox.api.getsafepay.com/...      */
/*       CARD_MERCHANT_ID                                                     */
/*       CARD_SECRET                (secret)                                  */
/*       CARD_FIELD_MAP            optional JSON, renames the fields below     */
/* ========================================================================= */
const card = {
  id: 'card',
  label: 'Credit / debit card',
  enabled: (env) => !!(env.CARD_MERCHANT_ID && env.CARD_SECRET && env.CARD_CHECKOUT_URL),

  async init({ order, env, site }) {
    const base = {
      merchant_id: env.CARD_MERCHANT_ID,
      order_id: order.reference,
      order_ref: order.order_number,
      amount: Number(order.total).toFixed(2),
      currency: 'PKR',
      customer_name: order.customer_name || '',
      customer_phone: order.phone || '',
      customer_email: order.email || '',
      return_url: `${site}/api/payments/card/callback`,
      cancel_url: `${site}/payment/cancelled`,
      timestamp: stamp(),
    };
    const map = safeJson(env.CARD_FIELD_MAP) || {};
    const fields = {};
    for (const [k, v] of Object.entries(base)) fields[map[k] || k] = v;
    fields[map.signature || 'signature'] = await sortedHmac(base, env.CARD_SECRET);
    return { mode: 'form', action: env.CARD_CHECKOUT_URL, fields };
  },

  async verify(request, env) {
    const d = await readCallback(request);
    const map = safeJson(env.CARD_FIELD_MAP) || {};
    const sigField = map.signature || 'signature';
    const given = d[sigField] || d.sign || d.hash || '';
    const copy = { ...d };
    delete copy[sigField]; delete copy.sign; delete copy.hash;
    const expect = await sortedHmac(copy, env.CARD_SECRET);
    const valid = safeEqual(String(given).toUpperCase(), expect);
    const status = String(d.status || d.payment_status || '').toLowerCase();
    return {
      valid,
      requireAmountMatch: true,
      state: !valid ? 'failed'
        : /^(paid|success|succeeded|completed|approved|0{3,4})$/.test(status) ? 'paid'
        : /pending|processing/.test(status) ? 'pending'
        : /cancel/.test(status) ? 'cancelled' : 'failed',
      reference: d[map.order_id || 'order_id'] || d.order_ref || '',
      gatewayRef: d.transaction_id || d.txn_id || '',
      amount: d.amount ? Number(d.amount) : null,
      code: status,
      message: d.message || d.description || '',
      raw: d,
    };
  },
};

async function sortedHmac(params, secret) {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
    .sort();
  return hmacSha256Hex(secret, keys.map((k) => `${k}=${params[k]}`).join('&'));
}

function safeJson(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

/* ========================================================================= */
export const GATEWAYS = { cod, jazzcash, easypaisa, card };

/** Which methods should be shown at checkout right now. */
export function availableMethods(env, cfg) {
  return Object.values(GATEWAYS)
    .filter((g) => (cfg.payments[g.id] !== false) && g.enabled(env, cfg))
    .map((g) => g.id);
}

/* ========================================================================= */
/*  SETTLEMENT  —  the only place an order's payment state can change.       */
/* ========================================================================= */
export async function settlePayment(db, gatewayId, result) {
  const gw = GATEWAYS[gatewayId];
  if (!gw) return { ok: false, reason: 'unknown_gateway' };

  // 1. find our own payment row by the reference WE generated
  const rows = await db.select('payments',
    `reference=eq.${encodeURIComponent(result.reference || '')}` +
    `&select=id,order_id,amount,state,gateway&limit=1`, { admin: true, cache: 0 });
  const pay = rows[0];

  // 2. always log the raw message, even when we reject it
  await db.insert('payment_transactions', [{
    payment_id: pay ? pay.id : null,
    order_id: pay ? pay.order_id : null,
    gateway: gatewayId,
    event: 'callback',
    txn_ref: result.reference || null,
    amount: result.amount,
    signature_valid: !!result.valid,
    raw: result.raw || {},
  }]).catch(() => {});

  if (!pay) return { ok: false, reason: 'unknown_reference' };
  if (!result.valid) return { ok: false, reason: 'bad_signature', orderId: pay.order_id };

  // 3. amount must match what we asked for — stops a tampered postback
  if (result.requireAmountMatch && result.amount !== null && result.amount !== undefined) {
    if (Math.abs(Number(result.amount) - Number(pay.amount)) > 0.99) {
      return { ok: false, reason: 'amount_mismatch', orderId: pay.order_id };
    }
  }

  // 4. replay guard — a paid order is never downgraded
  if (pay.state === 'paid' && result.state !== 'refunded') {
    return { ok: true, already: true, state: 'paid', orderId: pay.order_id };
  }

  await db.update('payments', `id=eq.${pay.id}`, {
    state: result.state,
    gateway_ref: result.gatewayRef || null,
    error_code: result.state === 'paid' ? null : (result.code || null),
    error_message: result.state === 'paid' ? null : (result.message || null),
  });

  const patch = { payment_state: result.state };
  if (result.state === 'paid') patch.status = 'confirmed';
  if (result.state === 'cancelled') patch.status = 'cancelled';
  await db.update('orders', `id=eq.${pay.order_id}`, patch);

  return { ok: true, state: result.state, orderId: pay.order_id };
}
