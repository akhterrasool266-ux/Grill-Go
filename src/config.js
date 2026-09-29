// ============================================================================
//  CENTRAL CONFIGURATION  —  THE ONLY FILE YOU EDIT PER CUSTOMER
// ============================================================================
//  Change the values below and the whole website updates: header, footer,
//  page titles, meta descriptions, Open Graph images, structured data,
//  WhatsApp button, contact links, PWA manifest, sitemap and colours.
//
//  Anything marked  (admin)  can ALSO be changed later from the admin panel
//  without touching this file. The admin value always wins.
// ============================================================================

export const config = {

  // --- IDENTITY -------------------------------------------------------------
  brandName:   '[BRAND_NAME]',
  legalName:   '[BRAND_NAME]',
  tagline:     'Dermatologist-tested skincare, made for Pakistani skin',
  description:
    'Shop authentic, dermatologist-tested skincare from [BRAND_NAME]. ' +
    'Serums, cleansers, sunscreens and treatment kits delivered across ' +
    'Pakistan with cash on delivery.',

  // Logo + favicon. Put files in /public/ or paste a Cloudinary URL.
  logo:        '/icons/logo.png',
  logoDark:    '/icons/logo.png',
  favicon:     '/icons/favicon.png',
  ogImage:     '/icons/og.png',          // 1200x630 social share image

  // --- CONTACT --------------------------------------------------------------
  whatsapp:    '923000000000',           // (admin) digits only, with 92
  phone:       '+92 300 000 0000',       // (admin)
  email:       'hello@example.com',      // (admin)
  address:     'Karachi, Pakistan',      // (admin)

  social: {                              // (admin) leave '' to hide the icon
    facebook:  '',
    instagram: '',
    tiktok:    '',
    youtube:   '',
  },

  // --- COMMERCE -------------------------------------------------------------
  currency:       'PKR',
  currencySymbol: 'Rs',
  locale:         'en-PK',
  country:        'PK',

  // (admin) these are only the fallbacks used before settings are saved
  shippingFlat:     200,
  freeShippingOver: 3000,
  codEnabled:       true,
  codCharges:       0,

  // Which payment methods appear at checkout. A gateway also needs its
  // secrets set as Cloudflare environment variables before it will switch on.
  payments: {
    cod:       true,
    jazzcash:  false,
    easypaisa: false,
    card:      false,
  },

  // --- LOOK -----------------------------------------------------------------
  theme: {
    brand:     '#15756b',   // primary / buttons
    brandDark: '#0f5c54',
    accent:    '#e0f2ef',   // soft tint blocks
    price:     '#c2410c',   // price colour
    sale:      '#0a8754',   // discount badges
    ink:       '#14201e',
    muted:     '#6b7280',
    line:      '#e4eae9',
    bg:        '#f7faf9',
    card:      '#ffffff',
    radius:    '14px',
    font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  },

  // --- TRACKING -------------------------------------------------------------
  // (admin) IDs can also be set in the admin panel or as env vars.
  ga4Id:       '',    // G-XXXXXXXXXX
  metaPixelId: '',    // 15-16 digit Pixel ID
  gscVerification: '', // google-site-verification content value

  // --- BEHAVIOUR ------------------------------------------------------------
  adminPath:       '/admin',   // change this to hide the panel elsewhere
  productsPerPage: 24,
  showReviews:     true,
  announcement:    'Cash on delivery all over Pakistan',  // (admin)

  trustBar: [
    { icon: 'truck',  title: 'Delivery all over Pakistan', sub: '2–4 working days' },
    { icon: 'cash',   title: 'Cash on delivery',           sub: 'Pay when it arrives' },
    { icon: 'shield', title: '100% authentic',             sub: 'Sourced direct' },
    { icon: 'return', title: 'Easy returns',               sub: '3-day return window' },
  ],

  footerLinks: [
    { label: 'About us',       href: '/page/about' },
    { label: 'Contact',        href: '/page/contact' },
    { label: 'Shipping policy',href: '/page/shipping' },
    { label: 'Returns',        href: '/page/returns' },
    { label: 'Privacy policy', href: '/page/privacy' },
    { label: 'Track order',    href: '/track' },
  ],
};

// ---------------------------------------------------------------------------
//  Merge order:  config.js  <  store_settings row in Supabase  <  env vars
//  Everything downstream reads the result of this function, never `config`
//  directly, so an admin change takes effect without a redeploy.
// ---------------------------------------------------------------------------
export function resolveConfig(env = {}, settings = {}) {
  const s = settings || {};
  const pick = (a, b) => (a === undefined || a === null || a === '' ? b : a);

  return {
    ...config,
    brandName:   pick(s.brand_name,   pick(env.BRAND_NAME, config.brandName)),
    tagline:     pick(s.tagline,      config.tagline),
    description: pick(s.description,  config.description),
    logo:        pick(s.logo,         config.logo),
    favicon:     pick(s.favicon,      config.favicon),
    ogImage:     pick(s.og_image,     config.ogImage),

    whatsapp:    pick(s.whatsapp,     config.whatsapp),
    phone:       pick(s.phone,        config.phone),
    email:       pick(s.email,        config.email),
    address:     pick(s.address,      config.address),
    social: { ...config.social, ...(s.social || {}) },

    currency:         pick(s.currency,           config.currency),
    shippingFlat:     Number(pick(s.shipping_flat,      config.shippingFlat)),
    freeShippingOver: Number(pick(s.free_shipping_over, config.freeShippingOver)),
    codEnabled:       s.cod_enabled === undefined ? config.codEnabled : !!s.cod_enabled,
    codCharges:       Number(pick(s.cod_charges,        config.codCharges)),

    announcement: pick(s.announcement, config.announcement),
    theme: { ...config.theme, ...(s.theme_overrides || {}) },

    ga4Id:       pick(s.ga4_id,        pick(env.GA4_ID, config.ga4Id)),
    metaPixelId: pick(s.meta_pixel_id, pick(env.META_PIXEL_ID, config.metaPixelId)),
    gscVerification: pick(s.gsc_verification, config.gscVerification),

    payments: {
      cod:       s.cod_enabled === undefined ? config.payments.cod : !!s.cod_enabled,
      jazzcash:  !!(env.JAZZCASH_MERCHANT_ID  && env.JAZZCASH_PASSWORD  && env.JAZZCASH_SALT),
      easypaisa: !!(env.EASYPAISA_STORE_ID    && env.EASYPAISA_HASH_KEY),
      card:      !!(env.CARD_MERCHANT_ID      && env.CARD_SECRET),
    },

    banners:    s.banners    || [],   // [{image, alt, href}]
    heroTitle:  s.hero_title || '',
    heroSub:    s.hero_sub   || '',
    splash:     s.splash     || null, // {image, enabled}
  };
}
