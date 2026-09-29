/* ===========================================================================
   [BRAND_NAME] storefront — client behaviour only.
   Everything that matters for SEO is already in the HTML from the server.
   This file adds: menu, slider, gallery, search suggestions, cart, checkout.
   =========================================================================== */
(function () {
  'use strict';

  var S = window.__STORE__ || {};
  var SYM = S.currency || 'Rs';
  var KEY = 'cart_v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function money(n) { return SYM + ' ' + Math.round(Number(n) || 0).toLocaleString('en-US'); }

  /* ------------------------------- storage -------------------------------- */
  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!c || !Array.isArray(c.items)) c = { items: [] };
      return c;
    } catch (e) { return { items: [] }; }
  }
  function write(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    paintCount();
  }
  function cartTotals(c) {
    var sub = c.items.reduce(function (s, i) { return s + Number(i.price) * Number(i.qty); }, 0);
    var disc = c.coupon ? Math.min(Number(c.coupon.discount) || 0, sub) : 0;
    var freeShip = (c.coupon && c.coupon.free_shipping)
      || (S.shipping && S.shipping.freeOver > 0 && sub >= S.shipping.freeOver);
    var ship = sub > 0 && !freeShip ? Number((S.shipping && S.shipping.flat) || 0) : 0;
    return { sub: sub, disc: disc, ship: ship, total: Math.max(0, sub - disc) + ship };
  }

  /* --------------------------------- toast -------------------------------- */
  var tt;
  function toast(msg) {
    var el = $('[data-toast]'); if (!el) return;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(tt); tt = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  /* ------------------------------ cart badge ------------------------------ */
  function paintCount() {
    var n = read().items.reduce(function (s, i) { return s + Number(i.qty); }, 0);
    $$('[data-cart-count]').forEach(function (b) {
      b.textContent = n; b.hidden = n === 0;
    });
  }

  /* ------------------------------- tracking ------------------------------- */
  function track(ev, data) {
    try { if (S.pixel && window.fbq) fbq('track', ev, data || {}); } catch (e) {}
    try {
      if (S.ga4 && window.gtag) {
        var map = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout' };
        if (map[ev]) gtag('event', map[ev], data || {});
      }
    } catch (e) {}
  }
  function beacon(type, extra) {
    try {
      var sid = sessionStorage.getItem('sid');
      if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('sid', sid); }
      var body = JSON.stringify(Object.assign({
        type: type, path: location.pathname, session_id: sid, referrer: document.referrer || ''
      }, extra || {}));
      if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
      else fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) {}
  }

  /* -------------------------------- drawer -------------------------------- */
  function drawer(open) {
    var side = $('[data-side]'), scrim = $('[data-scrim]'), btn = $('[data-drawer]');
    if (!side) return;
    side.classList.toggle('on', open);
    side.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (scrim) { scrim.hidden = false; scrim.classList.toggle('on', open); }
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-drawer]')) { drawer(true); }
    else if (e.target.closest('[data-drawer-close]') || e.target.closest('[data-scrim]')) { drawer(false); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') drawer(false); });

  /* ------------------------------ hidden admin ---------------------------- */
  (function () {
    var taps = 0, timer;
    $$('[data-logo]').forEach(function (l) {
      l.addEventListener('click', function (e) {
        taps++;
        clearTimeout(timer);
        timer = setTimeout(function () { taps = 0; }, 800);
        if (taps >= 3) { e.preventDefault(); taps = 0; location.href = S.adminPath || '/admin'; }
      });
    });
  })();

  /* -------------------------------- slider -------------------------------- */
  $$('[data-slider]').forEach(function (box) {
    var track = $('[data-track]', box);
    var slides = $$('.slide', track);
    var dots = $$('b', $('[data-dots]', box) || box);
    if (slides.length < 2) return;
    var i = 0, timer;
    function go(n) {
      i = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }
    function play() { stop(); timer = setInterval(function () { go(i + 1); }, 4500); }
    function stop() { clearInterval(timer); }
    var p = $('[data-prev]', box), nx = $('[data-next]', box);
    if (p) p.addEventListener('click', function () { go(i - 1); play(); });
    if (nx) nx.addEventListener('click', function () { go(i + 1); play(); });
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      x0 = null; play();
    });
    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', play);
    play();
  });

  /* ------------------------------- gallery -------------------------------- */
  (function () {
    var main = $('[data-galmain]'); if (!main) return;
    $$('[data-thumb]').forEach(function (b) {
      b.addEventListener('click', function () {
        var im = $('img', main); if (!im) return;
        im.removeAttribute('srcset');
        im.src = b.getAttribute('data-thumb');
        $$('[data-thumb]').forEach(function (o) { o.classList.remove('on'); o.setAttribute('aria-selected', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-selected', 'true');
      });
    });
  })();

  /* --------------------------- search suggestions ------------------------- */
  (function () {
    var input = $('[data-search]'), box = $('[data-suggest]');
    if (!input || !box) return;
    var TRENDING = ['serum', 'sunscreen', 'face wash', 'moisturizer', 'acne', 'whitening'];
    var t, last = '';

    function hide() { box.classList.remove('on'); box.innerHTML = ''; }

    function showTrending() {
      box.innerHTML = '<div class="sh">Trending searches</div>'
        + TRENDING.map(function (w) {
            return '<a href="/search?q=' + encodeURIComponent(w) + '">'
              + '<span style="opacity:.5">&#128269;</span><span>' + w + '</span></a>';
          }).join('');
      box.classList.add('on');
    }

    function render(d, q) {
      var out = '';
      if (d.products && d.products.length) {
        out += '<div class="sh">Products</div>' + d.products.map(function (p) {
          return '<a href="/product/' + encodeURIComponent(p.slug) + '">'
            + (p.image ? '<img src="' + p.image.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_80,c_limit/') + '" alt="" loading="lazy">' : '')
            + '<span style="flex:1">' + escapeHtml(p.name) + '</span>'
            + '<b style="color:var(--price);white-space:nowrap">' + money(p.price) + '</b></a>';
        }).join('');
      }
      out += '<a href="/search?q=' + encodeURIComponent(q) + '" style="font-weight:700;color:var(--brand)">'
           + 'See all results for &ldquo;' + escapeHtml(q) + '&rdquo;</a>';
      box.innerHTML = out;
      box.classList.add('on');
    }

    input.addEventListener('focus', function () { if (!input.value.trim()) showTrending(); });
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(t);
      if (!q) { showTrending(); return; }
      if (q.length < 2) { hide(); return; }
      t = setTimeout(function () {
        if (q === last) return; last = q;
        fetch('/api/suggest?q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (d) { render(d, q); })
          .catch(hide);
      }, 220);
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.searchbox')) hide();
    });
  })();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ---------------------------- add from a card --------------------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    if (b.hasAttribute('data-choose')) { location.href = '/product/' + b.getAttribute('data-slug'); return; }
    addItem({
      product_id: b.getAttribute('data-add'),
      variant_id: null,
      slug: b.getAttribute('data-slug'),
      name: b.getAttribute('data-name'),
      variant_label: '',
      price: Number(b.getAttribute('data-price')),
      image: b.getAttribute('data-img') || '',
      qty: 1,
    });
  });

  function addItem(item) {
    var c = read();
    var same = c.items.filter(function (i) {
      return i.product_id === item.product_id && (i.variant_id || null) === (item.variant_id || null);
    })[0];
    if (same) same.qty = Math.min(99, Number(same.qty) + Number(item.qty));
    else c.items.push(item);
    write(c);
    toast(item.name + ' added to cart');
    track('AddToCart', { content_ids: [item.product_id], content_name: item.name, value: item.price * item.qty, currency: 'PKR' });
    beacon('add_to_cart', { product_id: item.product_id, value: item.price * item.qty });
    paintCart();
  }

  /* ---------------------------- product page ------------------------------ */
  (function () {
    var pdp = $('[data-pdp]'); if (!pdp) return;
    var qty = 1;
    var variantId = null, price = 0, label = '';

    var first = $('.pack.on');
    if (first) {
      variantId = first.getAttribute('data-variant');
      price = Number(first.getAttribute('data-vprice'));
      label = first.getAttribute('data-vlabel');
    } else {
      var pe = $('[data-price-out]');
      price = pe ? Number(String(pe.textContent).replace(/[^\d]/g, '')) : 0;
    }

    function paint() {
      var q = $('[data-qty]'); if (q) q.textContent = qty;
      var pe = $('[data-price-out]'); if (pe) pe.textContent = money(price);
      var lt = $('[data-line-total]'); if (lt) lt.textContent = money(price * qty);
      var bt = $('[data-bar-total]'); if (bt) bt.textContent = money(price * qty);
    }

    $$('.pack').forEach(function (p) {
      p.addEventListener('click', function () {
        if (p.hasAttribute('disabled')) return;
        $$('.pack').forEach(function (o) { o.classList.remove('on'); o.setAttribute('aria-checked', 'false'); });
        p.classList.add('on'); p.setAttribute('aria-checked', 'true');
        variantId = p.getAttribute('data-variant');
        price = Number(p.getAttribute('data-vprice'));
        label = p.getAttribute('data-vlabel');
        var was = Number(p.getAttribute('data-vwas')) || 0;
        var w = $('[data-was-out]'), s = $('[data-save-out]');
        if (w) { if (was > price) { w.textContent = money(was); w.style.display = ''; } else w.style.display = 'none'; }
        if (s) {
          if (was > price) { s.textContent = 'Save ' + Math.round((was - price) / was * 100) + '%'; s.style.display = ''; }
          else s.style.display = 'none';
        }
        paint();
      });
    });

    var minus = $('[data-qminus]'), plus = $('[data-qplus]');
    if (minus) minus.addEventListener('click', function () { qty = Math.max(1, qty - 1); paint(); });
    if (plus) plus.addEventListener('click', function () { qty = Math.min(99, qty + 1); paint(); });

    function payload() {
      return {
        product_id: pdp.getAttribute('data-id'),
        variant_id: variantId || null,
        slug: pdp.getAttribute('data-slug'),
        name: pdp.getAttribute('data-pname'),
        variant_label: label || '',
        price: price,
        image: pdp.getAttribute('data-image') || '',
        qty: qty,
      };
    }

    $$('[data-addcart]').forEach(function (b) {
      b.addEventListener('click', function () { addItem(payload()); });
    });
    $$('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        addItem(payload());
        track('InitiateCheckout', { value: price * qty, currency: 'PKR' });
        location.href = '/checkout';
      });
    });

    paint();
    track('ViewContent', {
      content_ids: [pdp.getAttribute('data-id')],
      content_name: pdp.getAttribute('data-pname'),
      content_type: 'product', value: price, currency: 'PKR',
    });
    beacon('view_product', { product_id: pdp.getAttribute('data-id'), value: price });
  })();

  /* ------------------------------ cart page ------------------------------- */
  function lineHtml(i, idx) {
    var im = i.image
      ? '<img src="' + i.image.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_160,c_limit/') + '" alt="" width="74" height="74" loading="lazy">'
      : '<div class="ph"></div>';
    return '<div class="line">' + im + '<div class="li">'
      + '<b><a href="/product/' + encodeURIComponent(i.slug || '') + '">' + escapeHtml(i.name) + '</a></b>'
      + (i.variant_label ? '<small>' + escapeHtml(i.variant_label) + '</small><br>' : '')
      + '<small>' + money(i.price) + ' each</small>'
      + '<div style="display:flex;gap:10px;align-items:center;margin-top:6px">'
      + '<span class="qty" style="transform:scale(.86);transform-origin:left">'
      + '<button type="button" data-dec="' + idx + '" aria-label="Decrease">&minus;</button>'
      + '<span>' + i.qty + '</span>'
      + '<button type="button" data-inc="' + idx + '" aria-label="Increase">+</button></span>'
      + '<button type="button" class="rm" data-del="' + idx + '">Remove</button></div></div>'
      + '<div style="font-weight:800;white-space:nowrap">' + money(i.price * i.qty) + '</div></div>';
  }

  function paintTotals(c) {
    var t = cartTotals(c);
    var set = function (sel, v) { $$(sel).forEach(function (e) { e.textContent = v; }); };
    set('[data-t-sub]', money(t.sub));
    set('[data-t-ship]', t.ship > 0 ? money(t.ship) : 'Free');
    set('[data-t-total]', money(t.total + currentCod(c)));
    $$('[data-t-disc-row]').forEach(function (r) { r.hidden = t.disc <= 0; });
    set('[data-t-disc]', '−' + money(t.disc));
    var cod = currentCod(c);
    $$('[data-t-cod-row]').forEach(function (r) { r.hidden = cod <= 0; });
    set('[data-t-cod]', money(cod));
  }

  var chosenMethod = 'cod';
  function currentCod(c) {
    if (chosenMethod !== 'cod') return 0;
    if (!c.items.length) return 0;
    return Number((S.cod && S.cod.charges) || 0);
  }

  function paintCart() {
    var c = read();
    var box = $('[data-cart-lines]');
    if (box) {
      if (c.items.length) {
        box.innerHTML = '<div class="panel">' + c.items.map(lineHtml).join('') + '</div>';
        var sum = $('[data-cart-summary]'); if (sum) sum.hidden = false;
      } else {
        var sum2 = $('[data-cart-summary]'); if (sum2) sum2.hidden = true;
      }
    }
    var cl = $('[data-checkout-lines]');
    if (cl) {
      cl.innerHTML = c.items.map(function (i) {
        return '<div style="display:flex;gap:8px;font-size:13.5px;padding:5px 0">'
          + '<span style="flex:1">' + escapeHtml(i.name) + (i.variant_label ? ' <small class="note">(' + escapeHtml(i.variant_label) + ')</small>' : '')
          + ' &times; ' + i.qty + '</span>'
          + '<b style="white-space:nowrap">' + money(i.price * i.qty) + '</b></div>';
      }).join('') || '<p class="note">Your cart is empty.</p>';
    }
    var emptyBox = $('[data-checkout-empty]'), formEl = $('[data-checkout]');
    if (emptyBox && formEl) {
      emptyBox.hidden = c.items.length > 0;
      formEl.hidden = c.items.length === 0;
    }
    paintTotals(c);
    paintCount();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var inc = t.closest('[data-inc]'), dec = t.closest('[data-dec]'), del = t.closest('[data-del]');
    if (!inc && !dec && !del) return;
    var c = read();
    var idx = Number((inc || dec || del).getAttribute(inc ? 'data-inc' : dec ? 'data-dec' : 'data-del'));
    if (!c.items[idx]) return;
    if (inc) c.items[idx].qty = Math.min(99, c.items[idx].qty + 1);
    if (dec) c.items[idx].qty = Math.max(1, c.items[idx].qty - 1);
    if (del) c.items.splice(idx, 1);
    write(c); paintCart();
  });

  /* ------------------------------- checkout ------------------------------- */
  (function () {
    var form = $('[data-checkout]'); if (!form) return;

    $$('.pay').forEach(function (p) {
      p.addEventListener('click', function () {
        $$('.pay').forEach(function (o) { o.classList.remove('on'); o.setAttribute('aria-checked', 'false'); });
        p.classList.add('on'); p.setAttribute('aria-checked', 'true');
        chosenMethod = p.getAttribute('data-method');
        var note = $('[data-pay-note]');
        if (note) {
          note.textContent = chosenMethod === 'cod'
            ? 'You will pay the rider in cash when your parcel arrives.'
            : 'You will be taken to a secure payment page to complete the payment.';
        }
        paintTotals(read());
      });
    });
    var first = $('.pay.on'); if (first) chosenMethod = first.getAttribute('data-method');

    /* coupon */
    var applyBtn = $('[data-coupon-apply]');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var input = $('[data-coupon]'), msg = $('[data-coupon-msg]');
        var code = (input.value || '').trim();
        if (!code) return;
        var c = read(), t = cartTotals(c);
        applyBtn.disabled = true; applyBtn.textContent = '…';
        fetch('/api/coupon?code=' + encodeURIComponent(code) + '&subtotal=' + Math.round(t.sub))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.ok) {
              c.coupon = { code: d.code, discount: d.discount, free_shipping: d.free_shipping };
              write(c); paintTotals(c);
              msg.textContent = 'Code applied — you saved ' + money(d.discount) + (d.free_shipping ? ' and free shipping' : '');
              msg.style.color = 'var(--sale)';
            } else {
              c.coupon = null; write(c); paintTotals(c);
              msg.textContent = d.error === 'min_order'
                ? 'This code needs a minimum order of ' + money(d.min_order)
                : 'That code is not valid.';
              msg.style.color = '#b42318';
            }
          })
          .catch(function () { msg.textContent = 'Could not check that code.'; })
          .finally(function () { applyBtn.disabled = false; applyBtn.textContent = 'Apply'; });
      });
    }

    /* validation + submit */
    function bad(name, on) {
      var f = form.querySelector('[name="' + name + '"]');
      if (f && f.closest('.field')) f.closest('.field').classList.toggle('bad', !!on);
    }
    function val(name) {
      var f = form.querySelector('[name="' + name + '"]');
      return f ? f.value.trim() : '';
    }

    var placing = false;
    var idem = null;

    $('[data-place]').addEventListener('click', function () {
      if (placing) return;
      var c = read();
      if (!c.items.length) { toast('Your cart is empty'); return; }

      var ok = true;
      [['customer_name', function (v) { return v.length >= 2; }],
       ['phone', function (v) { return v.replace(/\D/g, '').length >= 10; }],
       ['address', function (v) { return v.length >= 8; }],
       ['city', function (v) { return v.length >= 2; }]].forEach(function (r) {
        var good = r[1](val(r[0]));
        bad(r[0], !good);
        if (!good) ok = false;
      });
      if (!ok) {
        var firstBad = form.querySelector('.field.bad .inp');
        if (firstBad) firstBad.focus();
        toast('Please check the highlighted fields');
        return;
      }

      placing = true;
      var btn = this;
      btn.disabled = true; btn.textContent = 'Placing your order…';
      var errEl = $('[data-order-err]'); if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      if (!idem) idem = 'ck_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

      track('InitiateCheckout', { value: cartTotals(c).total, currency: 'PKR' });

      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: val('customer_name'), phone: val('phone'),
          address: val('address'), city: val('city'), email: val('email'),
          notes: val('notes'),
          coupon_code: c.coupon ? c.coupon.code : '',
          payment_method: chosenMethod,
          idempotency_key: idem,
          items: c.items.map(function (i) {
            return { product_id: i.product_id, variant_id: i.variant_id || null, qty: i.qty };
          }),
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok && d.redirect) {
            try { localStorage.removeItem(KEY); } catch (e) {}
            location.href = d.redirect;
            return;
          }
          var M = {
            out_of_stock: 'Sorry, one of the items just went out of stock.',
            coupon_invalid: 'That discount code is no longer valid.',
            coupon_min_order: 'Your discount code needs a larger order.',
            cod_not_allowed: 'Cash on delivery is not available for one of these items.',
            cod_disabled: 'Cash on delivery is temporarily unavailable.',
            product_unavailable: 'One of the items is no longer available.',
            bad_phone: 'Please enter a valid mobile number.',
            too_many: 'Too many attempts. Please wait a minute and try again.',
          };
          throw new Error(M[d.error] || 'We could not place the order. Please try again.');
        })
        .catch(function (err) {
          placing = false;
          btn.disabled = false; btn.textContent = 'Place order';
          if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
          toast(err.message);
        });
    });
  })();

  /* --------------------------------- boot --------------------------------- */
  paintCart();
  beacon('page_view');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
