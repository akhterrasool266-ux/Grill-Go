-- ============================================================================
--  DEMO DATA  —  run AFTER schema.sql, only for a demo / showcase store.
--  Delete everything it creates with the last block at the bottom.
-- ============================================================================

insert into public.categories (slug, name, description, sort_order, is_active) values
  ('serums',      'Serums',      'Concentrated treatments for dark spots, acne marks and dull skin.', 1, true),
  ('cleansers',   'Cleansers',   'Gentle daily face washes that do not strip your skin barrier.',     2, true),
  ('sunscreen',   'Sunscreen',   'Lightweight, non-greasy SPF made for Pakistani weather.',           3, true),
  ('moisturizer', 'Moisturizers','Hydration for oily, dry and combination skin.',                     4, true)
on conflict (slug) do nothing;

with c as (select id, slug from public.categories)
insert into public.products
  (slug, name, short_description, description, category_id, price, original_price, sku, brand,
   stock, rating, review_count, is_active, is_featured, is_trending, features, benefits, sort_order)
select v.slug, v.name, v.short_desc, v.descr, c.id, v.price, v.was, v.sku, '[BRAND_NAME]',
       v.stock, v.rating, v.reviews, true, v.feat, v.trend, v.features::jsonb, v.benefits::jsonb, v.ord
from (values
  ('vitamin-c-brightening-serum', 'Vitamin C Brightening Serum',
   'A 15% vitamin C serum that visibly fades dark spots and evens skin tone in 4 weeks.',
   'A stable 15% ethyl ascorbic acid serum with ferulic acid and vitamin E. It targets post-acne marks, sun spots and dullness without the stinging most vitamin C serums cause.

Apply 3–4 drops every morning on clean skin, before moisturiser and sunscreen.',
   'serums', 1850, 2600, 'VC-30', 40, 4.6, 128, true, true,
   '["15% stable vitamin C","Fades dark spots in 4 weeks","Fragrance and paraben free","Dermatologist tested"]',
   '[{"q":"How long until I see results?","a":"Most people notice brighter skin in 2 weeks and visibly lighter dark spots by week 4."},{"q":"Can I use it with retinol?","a":"Yes, but use vitamin C in the morning and retinol at night."}]', 1),

  ('niacinamide-10-serum', 'Niacinamide 10% + Zinc Serum',
   'Controls oil, tightens pores and calms active acne without drying your skin.',
   'A lightweight 10% niacinamide serum with 1% zinc PCA. It regulates sebum, reduces the look of enlarged pores and calms redness.

Use morning and night after cleansing.',
   'serums', 1250, 1800, 'NIA-30', 60, 4.5, 96, true, true,
   '["10% niacinamide + 1% zinc","Visibly smaller pores","Oil control all day","Safe for sensitive skin"]',
   '[{"q":"Will it dry my skin?","a":"No. Niacinamide balances oil rather than stripping it, so it suits oily and dry skin."}]', 2),

  ('gentle-foaming-cleanser', 'Gentle Foaming Cleanser',
   'A soap-free daily face wash that removes oil and sunscreen without tightness.',
   'A pH-balanced foaming cleanser with glycerin and panthenol. It lifts sunscreen, sweat and pollution while keeping your skin barrier intact.

Use twice daily on wet skin.',
   'cleansers', 950, 1300, 'CLN-150', 80, 4.4, 61, true, false,
   '["pH 5.5, barrier safe","Removes sunscreen properly","No sulphates","Suitable for daily use"]',
   '[{"q":"Is it enough to remove makeup?","a":"For light makeup yes. For heavy makeup, use an oil cleanser first."}]', 3),

  ('invisible-sunscreen-spf50', 'Invisible Sunscreen SPF 50 PA++++',
   'A no-white-cast SPF 50 that finishes matte — comfortable even in Karachi humidity.',
   'Broad spectrum SPF 50 PA++++ in a weightless gel-cream. It leaves no white cast on brown skin and sits perfectly under makeup.

Apply two fingers'' worth 15 minutes before going out. Reapply every 3 hours outdoors.',
   'sunscreen', 1650, 2200, 'SPF-50', 55, 4.8, 210, true, true,
   '["SPF 50 PA++++","Zero white cast","Matte, non-greasy finish","Works under makeup"]',
   '[{"q":"Do I need sunscreen indoors?","a":"Yes, if you sit near windows. UVA passes through glass."},{"q":"Is it safe for acne-prone skin?","a":"Yes, it is non-comedogenic and oil free."}]', 4),

  ('barrier-repair-moisturizer', 'Barrier Repair Moisturizer',
   'Ceramide-rich cream that repairs dry, flaky and over-treated skin overnight.',
   'A rich but fast-absorbing cream with ceramides NP, AP and EOP plus cholesterol and hyaluronic acid. It rebuilds a damaged skin barrier caused by harsh actives or weather.

Use at night, or morning and night in winter.',
   'moisturizer', 1450, 1950, 'MST-50', 45, 4.7, 74, true, false,
   '["3 essential ceramides","Repairs a damaged barrier","Non-greasy finish","Fragrance free"]',
   '[{"q":"Is it too heavy for oily skin?","a":"It suits oily skin at night. In summer, use a thin layer."}]', 5)
) as v(slug, name, short_desc, descr, cat, price, was, sku, stock, rating, reviews, feat, trend, features, benefits, ord)
join c on c.slug = v.cat
on conflict (slug) do nothing;

-- one pack/variant set on the hero product
insert into public.product_variants (product_id, label, price, original_price, qty, badge, is_default, sort_order)
select p.id, v.label, v.price, v.was, v.qty, v.badge, v.dflt, v.ord
from public.products p
join (values
  ('1 Bottle',        1850, 2600, 1, '',           true,  0),
  ('Buy 2 Save 15%',  3145, 5200, 2, 'Best value', false, 1),
  ('Buy 3 Save 25%',  4162, 7800, 3, 'Biggest saving', false, 2)
) as v(label, price, was, qty, badge, dflt, ord) on true
where p.slug = 'vitamin-c-brightening-serum'
  and not exists (select 1 from public.product_variants x where x.product_id = p.id);

insert into public.coupons (code, kind, value, min_order, is_active)
values ('WELCOME10', 'percent', 10, 1500, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
--  Add your own product photos afterwards from the admin panel, or insert
--  them directly:
--
--  insert into public.product_images (product_id, url, alt, is_primary, sort_order)
--  select id, 'https://res.cloudinary.com/<cloud>/image/upload/v1/serum.jpg',
--         name, true, 0 from public.products where slug = 'vitamin-c-brightening-serum';
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
--  REMOVE ALL DEMO DATA (run this before going live with a real customer)
-- ---------------------------------------------------------------------------
-- delete from public.products where slug in (
--   'vitamin-c-brightening-serum','niacinamide-10-serum','gentle-foaming-cleanser',
--   'invisible-sunscreen-spf50','barrier-repair-moisturizer');
-- delete from public.categories where slug in ('serums','cleansers','sunscreen','moisturizer');
-- delete from public.coupons where code = 'WELCOME10';
