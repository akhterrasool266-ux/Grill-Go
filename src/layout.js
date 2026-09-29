// ============================================================================
//  LAYOUT  —  the HTML shell every server-rendered page is wrapped in
// ============================================================================
import { esc } from './lib.js';
import { styles } from './styles.js';
import { head } from './seo.js';

/* ------------------------------ inline icons ----------------------------- */
const I = {
  burger: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bag:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7"/></svg>',
  user:   '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.8-5.4 7.2-5.4s6.3 1.8 7.2 5.4"/></svg>',
  chev:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  left:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg>',
  right:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  check:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  truck:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 7h11v9H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/></svg>',
  cash:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  return: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  wa:     '<svg width="27" height="27" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2s-.7.9-.9 1.1c-.2.2-.4.3-.7.1-1.6-.8-2.7-1.9-3.4-3.4-.2-.3 0-.5.2-.7.2-.2.5-.6.7-.9.1-.2.1-.4 0-.6-.1-.2-.8-1.8-1-2.1-.2-.4-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-1.5 1.6-1.1 3.6.2 5.4 1.3 1.8 2.3 2.8 4.3 3.8 1.9.9 3.1.9 4.1.2.4-.3.9-.8 1-1.3.1-.4.1-.8 0-.9l-.4-.4ZM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/></svg>',
  box:    '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="m12 3 9 4.5v9L12 21 3 16.5v-9L12 3Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>',
  fb:     '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1Z"/></svg>',
  ig:     '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>',
  tt:     '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.4 3.6 3.6v2.6c-1.3.1-2.6-.3-3.7-1v5.9c0 3.4-2.5 5.9-5.8 5.9A5.7 5.7 0 0 1 4.4 14c0-3.3 2.9-5.9 6.3-5.5v2.7a3 3 0 0 0-1-.2 3 3 0 1 0 3 3V3H16Z"/></svg>',
  yt:     '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2c-.2-1-1-1.7-2-1.9C17.9 5 12 5 12 5s-5.9 0-7.6.3c-1 .2-1.8.9-2 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8c.2 1 1 1.7 2 1.9C6.1 19 12 19 12 19s5.9 0 7.6-.3c1-.2 1.8-.9 2-1.9.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/></svg>',
};
export const icon = (n) => I[n] || '';

/* ---------------------------- tracking snippets -------------------------- */
function tracking(cfg) {
  let out = '';
  if (cfg.ga4Id) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.ga4Id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','${esc(cfg.ga4Id)}');</script>`;
  }
  if (cfg.metaPixelId) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;
n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${esc(cfg.metaPixelId)}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" alt=""
src="https://www.facebook.com/tr?id=${esc(cfg.metaPixelId)}&ev=PageView&noscript=1"></noscript>`;
  }
  return out;
}

/* --------------------------------- header -------------------------------- */
function header(cfg, categories, opts = {}) {
  const links = [
    { label: 'Home', href: '/' },
    { label: 'All products', href: '/products' },
    ...categories.slice(0, 4).map((c) => ({ label: c.name, href: '/category/' + c.slug })),
    { label: 'Track order', href: '/track' },
  ];
  return `
${cfg.announcement ? `<div class="announce">${esc(cfg.announcement)}</div>` : ''}
<header>
  <div class="nav">
    <button class="burger" aria-label="Open menu" aria-expanded="false" data-drawer>${icon('burger')}</button>
    <a class="logo" href="/" data-logo aria-label="${esc(cfg.brandName)} home">
      ${cfg.logo ? `<img src="${esc(cfg.logo)}" alt="${esc(cfg.brandName)}" width="120" height="30">`
                 : esc(cfg.brandName)}
    </a>
    <nav class="navlinks" aria-label="Main">
      ${links.map((l) => `<a href="${esc(l.href)}"${opts.active === l.href ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`).join('')}
    </nav>
    <div class="navacts">
      <a class="iconbtn" href="/track" aria-label="Track order">${icon('user')}</a>
      <a class="iconbtn" href="/cart" aria-label="Cart" data-cart-link>
        ${icon('bag')}<span class="badge" data-cart-count hidden>0</span>
      </a>
    </div>
  </div>
  <div class="searchrow">
    <div class="searchbox">
      <form class="search" action="/search" method="get" role="search">
        <span aria-hidden="true">${icon('search')}</span>
        <input type="search" name="q" placeholder="Search products…" autocomplete="off"
               aria-label="Search products" value="${esc(opts.q || '')}" data-search>
      </form>
      <div class="suggest" data-suggest role="listbox" aria-label="Suggestions"></div>
    </div>
  </div>
</header>

<div class="scrim" data-scrim hidden></div>
<aside class="side" data-side aria-label="Menu" aria-hidden="true">
  <div class="sidehead">
    <strong>${esc(cfg.brandName)}</strong>
    <button class="iconbtn" aria-label="Close menu" data-drawer-close>${icon('close')}</button>
  </div>
  <nav>
    <a href="/">Home ${icon('chev')}</a>
    <a href="/products">All products ${icon('chev')}</a>
    <div class="grp">Categories</div>
    ${categories.map((c) => `<a href="/category/${esc(c.slug)}">${esc(c.name)} ${icon('chev')}</a>`).join('')}
    <div class="grp">Help</div>
    <a href="/track">Track my order ${icon('chev')}</a>
    ${cfg.footerLinks.filter((l) => l.href !== '/track')
      .map((l) => `<a href="${esc(l.href)}">${esc(l.label)} ${icon('chev')}</a>`).join('')}
  </nav>
  <div class="sidefoot">
    ${cfg.phone ? `<div>${esc(cfg.phone)}</div>` : ''}
    ${cfg.email ? `<div>${esc(cfg.email)}</div>` : ''}
    ${cfg.address ? `<div>${esc(cfg.address)}</div>` : ''}
  </div>
</aside>`;
}

/* --------------------------------- footer -------------------------------- */
function footer(cfg, categories) {
  const soc = [['facebook', 'fb'], ['instagram', 'ig'], ['tiktok', 'tt'], ['youtube', 'yt']]
    .filter(([k]) => cfg.social && cfg.social[k]);
  const half = Math.ceil(cfg.footerLinks.length / 2);
  return `
<footer>
  <div class="wrap">
    <div class="fgrid">
      <div class="fcol fbrand">
        <a class="logo" href="/" style="margin-bottom:10px">
          ${cfg.logo ? `<img src="${esc(cfg.logo)}" alt="${esc(cfg.brandName)}" width="120" height="30">` : esc(cfg.brandName)}
        </a>
        <p>${esc(cfg.tagline)}</p>
        ${soc.length ? `<div class="social">${soc.map(([k, i]) =>
          `<a href="${esc(cfg.social[k])}" rel="noopener nofollow" target="_blank" aria-label="${k}">${icon(i)}</a>`).join('')}</div>` : ''}
      </div>
      <div class="fcol">
        <h4>Shop</h4>
        <a href="/products">All products</a>
        ${categories.slice(0, 5).map((c) => `<a href="/category/${esc(c.slug)}">${esc(c.name)}</a>`).join('')}
      </div>
      <div class="fcol">
        <h4>Company</h4>
        ${cfg.footerLinks.slice(0, half).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}
      </div>
      <div class="fcol">
        <h4>Help</h4>
        ${cfg.footerLinks.slice(half).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}
        ${cfg.whatsapp ? `<a href="https://wa.me/${esc(cfg.whatsapp)}" rel="noopener">WhatsApp us</a>` : ''}
      </div>
    </div>
    <div class="fbot">
      <span>&copy; ${new Date().getFullYear()} ${esc(cfg.brandName)}. All rights reserved.</span>
      <span>Prices in ${esc(cfg.currency)} &middot; Cash on delivery available</span>
    </div>
  </div>
</footer>`;
}

/* ---------------------------------- page --------------------------------- */
/**
 * Wraps page HTML in the full document.
 * `seo` is passed straight to head() in seo.js.
 */
export function page({ cfg, site, seo, categories = [], body, active, q = '', bodyEnd = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
${head({ cfg, site, ...seo })}
<style>${styles(cfg.theme)}</style>
${tracking(cfg)}
</head>
<body>
<a href="#main" class="sr">Skip to content</a>
${header(cfg, categories, { active, q })}
<main id="main">
${body}
</main>
${footer(cfg, categories)}
${cfg.whatsapp ? `<a class="wa" href="https://wa.me/${esc(cfg.whatsapp)}?text=${encodeURIComponent('Hi ' + cfg.brandName + ', I have a question')}"
  rel="noopener" aria-label="Chat on WhatsApp">${icon('wa')}</a>` : ''}
<div class="toast" data-toast role="status" aria-live="polite"></div>
<script>window.__STORE__=${JSON.stringify({
    brand: cfg.brandName,
    currency: cfg.currencySymbol || 'Rs',
    cod: { enabled: cfg.codEnabled, charges: cfg.codCharges },
    shipping: { flat: cfg.shippingFlat, freeOver: cfg.freeShippingOver },
    adminPath: cfg.adminPath,
    pixel: !!cfg.metaPixelId,
    ga4: !!cfg.ga4Id,
  }).replace(/</g, '\\u003c')}</script>
<script src="/app.js" defer></script>
${cfg.chat ? '<script src="/chat.js" defer></script>' : ''}
${bodyEnd}
</body>
</html>`;
}
