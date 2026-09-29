// ============================================================================
//  SEO  —  <head> builder, structured data, sitemap, robots
//  Everything here is produced ON THE SERVER, so Google sees it in the
//  first HTML response without running any JavaScript.
// ============================================================================
import { esc, jsonLd, plain, img, money, discountPct, mainImage, inStock, activeVariants } from './lib.js';

/** Absolute URL for a path, using the real host the visitor asked for. */
export function abs(site, path = '/') {
  return site.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);
}

/**
 * Builds the complete <head>.
 *  title       — already page-specific, brand name is appended here
 *  description — 150-160 chars
 *  canonical   — path, e.g. /product/vitamin-c-serum
 *  schemas     — array of JSON-LD objects
 */
export function head({ cfg, site, title, description, canonical = '/', ogImage, ogType = 'website', noindex = false, schemas = [], extra = '' }) {
  const fullTitle = title
    ? `${title} | ${cfg.brandName}`
    : `${cfg.brandName} — ${cfg.tagline}`;
  const desc = plain(description || cfg.description, 158);
  const url = abs(site, canonical);
  const image = ogImage
    ? (ogImage.startsWith('http') ? img(ogImage, 1200) : abs(site, ogImage))
    : abs(site, cfg.ogImage);

  const ld = schemas.filter(Boolean)
    .map((s) => `<script type="application/ld+json">${jsonLd(s)}</script>`)
    .join('');

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">
<meta name="theme-color" content="${esc(cfg.theme.brand)}">
<meta name="format-detection" content="telephone=no">
<meta property="og:site_name" content="${esc(cfg.brandName)}">
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_PK">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
${cfg.gscVerification ? `<meta name="google-site-verification" content="${esc(cfg.gscVerification)}">` : ''}
<link rel="icon" href="${esc(cfg.favicon)}">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
<link rel="dns-prefetch" href="https://res.cloudinary.com">
${ld}${extra}`;
}

/* --------------------------- structured data ----------------------------- */

export function organizationSchema(cfg, site) {
  const sameAs = Object.values(cfg.social || {}).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': abs(site, '/#organization'),
    name: cfg.brandName,
    legalName: cfg.legalName || cfg.brandName,
    url: abs(site, '/'),
    logo: cfg.logo.startsWith('http') ? cfg.logo : abs(site, cfg.logo),
    description: plain(cfg.description, 300),
    ...(sameAs.length ? { sameAs } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: cfg.address || 'Pakistan',
      addressCountry: 'PK',
    },
    ...(cfg.phone ? {
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: cfg.phone,
        contactType: 'customer service',
        areaServed: 'PK',
        availableLanguage: ['en', 'ur'],
      },
    } : {}),
  };
}

export function websiteSchema(cfg, site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': abs(site, '/#website'),
    url: abs(site, '/'),
    name: cfg.brandName,
    publisher: { '@id': abs(site, '/#organization') },
    inLanguage: 'en-PK',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: abs(site, '/search?q={search_term_string}') },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbSchema(site, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      ...(t.href ? { item: abs(site, t.href) } : {}),
    })),
  };
}

export function productSchema(p, cfg, site) {
  const im = mainImage(p);
  const vars = activeVariants(p);
  const available = inStock(p)
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';
  const canonical = abs(site, '/product/' + p.slug);

  const offer = (price, sku, label) => ({
    '@type': 'Offer',
    ...(label ? { name: label } : {}),
    url: canonical,
    price: Number(price).toFixed(2),
    priceCurrency: p.currency || cfg.currency || 'PKR',
    availability: available,
    itemCondition: 'https://schema.org/NewCondition',
    ...(sku ? { sku } : {}),
    priceValidUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10),
    seller: { '@id': abs(site, '/#organization') },
    ...(cfg.codEnabled ? {
      acceptedPaymentMethod: {
        '@type': 'PaymentMethod',
        name: 'Cash on delivery',
      },
    } : {}),
  });

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': canonical + '#product',
    name: p.name,
    description: plain(p.short_description || p.description, 400),
    url: canonical,
    ...(im ? { image: [img(im.url, 1200), img(im.url, 600)] } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.sku ? { mpn: p.sku } : {}),
    brand: { '@type': 'Brand', name: p.brand || cfg.brandName },
    ...(p.category ? { category: p.category.name } : {}),
  };

  if (vars.length > 1) {
    const prices = vars.map((v) => Number(v.price));
    schema.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: p.currency || cfg.currency || 'PKR',
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: vars.length,
      availability: available,
      offers: vars.map((v) => offer(v.price, v.sku, v.label)),
    };
  } else {
    schema.offers = offer(vars[0] ? vars[0].price : p.price, p.sku, null);
  }

  if (Number(p.review_count) > 0 && Number(p.rating) > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.rating).toFixed(1),
      reviewCount: Number(p.review_count),
      bestRating: '5',
      worstRating: '1',
    };
  }
  return schema;
}

export function itemListSchema(site, products, listName) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(site, '/product/' + p.slug),
      name: p.name,
    })),
  };
}

export function faqSchema(items) {
  const list = (items || []).filter((x) => x && x.q && x.a);
  if (!list.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((x) => ({
      '@type': 'Question',
      name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: plain(x.a, 900) },
    })),
  };
}

/* ------------------------------- robots.txt ------------------------------ */
export function robotsTxt(cfg, site) {
  return `User-agent: *
Allow: /
Disallow: ${cfg.adminPath}
Disallow: ${cfg.adminPath}/
Disallow: /admin.html
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /order/
Disallow: /payment/
Disallow: /search
Disallow: /*?*sort=
Disallow: /*?*page=

Sitemap: ${abs(site, '/sitemap.xml')}
`;
}

/* ------------------------------- sitemap.xml ----------------------------- */
export function sitemapXml(site, { products = [], categories = [], pages = [] }) {
  const url = (loc, lastmod, priority, changefreq, image) =>
    `  <url>\n    <loc>${esc(abs(site, loc))}</loc>` +
    (lastmod ? `\n    <lastmod>${esc(String(lastmod).slice(0, 10))}</lastmod>` : '') +
    `\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>` +
    (image ? `\n    <image:image><image:loc>${esc(img(image, 1200))}</image:loc></image:image>` : '') +
    `\n  </url>`;

  const rows = [
    url('/', null, '1.0', 'daily'),
    url('/products', null, '0.9', 'daily'),
    ...categories.map((c) => url('/category/' + c.slug, c.updated_at, '0.8', 'weekly', c.image_url)),
    ...products.map((p) => {
      const im = mainImage(p);
      return url('/product/' + p.slug, p.updated_at || p.created_at, '0.8', 'weekly', im && im.url);
    }),
    ...pages.map((s) => url('/page/' + s, null, '0.4', 'monthly')),
    url('/track', null, '0.3', 'monthly'),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.join('\n')}
</urlset>`;
}

/* --------------------- price label used in meta + cards ------------------ */
export function priceLine(p, cfg) {
  const sym = cfg.currencySymbol || 'Rs';
  const pct = discountPct(p.price, p.original_price);
  return pct
    ? `${money(p.price, sym)} (${pct}% off ${money(p.original_price, sym)})`
    : money(p.price, sym);
}
