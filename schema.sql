-- ============================================================================
--  [BRAND_NAME] STORE — SUPABASE SCHEMA
--  Run this ONCE in Supabase → SQL Editor → New query → Run.
--  Safe to re-run: everything uses "if not exists" / "or replace".
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. LOOKUP TABLES (order status / payment status)
-- ---------------------------------------------------------------------------
create table if not exists public.order_status (
  code        text primary key,
  label       text not null,
  sort_order  int  not null default 0,
  is_final    boolean not null default false
);

insert into public.order_status (code, label, sort_order, is_final) values
  ('pending',    'Pending',    10, false),
  ('confirmed',  'Confirmed',  20, false),
  ('processing', 'Processing', 30, false),
  ('dispatched', 'Dispatched', 40, false),
  ('delivered',  'Delivered',  50, true),
  ('cancelled',  'Cancelled',  60, true),
  ('returned',   'Returned',   70, true)
on conflict (code) do nothing;

create table if not exists public.payment_status (
  code        text primary key,
  label       text not null,
  sort_order  int  not null default 0,
  is_final    boolean not null default false
);

insert into public.payment_status (code, label, sort_order, is_final) values
  ('unpaid',    'Unpaid',            10, false),
  ('pending',   'Pending / Awaiting',20, false),
  ('paid',      'Paid',              30, true),
  ('failed',    'Failed',            40, true),
  ('cancelled', 'Cancelled',         50, true),
  ('refunded',  'Refunded',          60, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2. CATEGORIES
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text,
  image_url       text,
  banner_url      text,
  icon            text,
  parent_id       uuid references public.categories(id) on delete set null,
  seo_title       text,
  seo_description text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists categories_slug_idx   on public.categories(slug);
create index if not exists categories_active_idx on public.categories(is_active, sort_order);

-- ---------------------------------------------------------------------------
-- 3. PRODUCTS
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  short_description text,
  description       text,
  category_id       uuid references public.categories(id) on delete set null,

  price             numeric(12,2) not null default 0,
  original_price    numeric(12,2),
  currency          text not null default 'PKR',
  sku               text,
  brand             text,

  track_stock       boolean not null default true,
  stock             int not null default 0,

  rating            numeric(3,2) not null default 0,
  review_count      int not null default 0,

  cod_enabled       boolean not null default true,
  cod_charges       numeric(12,2),           -- null = use global setting
  free_shipping     boolean not null default false,

  is_active         boolean not null default true,
  is_featured       boolean not null default false,
  is_trending       boolean not null default false,

  seo_title         text,
  seo_description   text,

  features          jsonb not null default '[]'::jsonb,  -- ["Paraben free", ...]
  benefits          jsonb not null default '[]'::jsonb,  -- [{"q":"...","a":"..."}]
  tags              text[] not null default '{}',

  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists products_slug_idx     on public.products(slug);
create index if not exists products_active_idx   on public.products(is_active, sort_order desc, created_at desc);
create index if not exists products_category_idx on public.products(category_id, is_active);
create index if not exists products_featured_idx on public.products(is_featured) where is_active;
create index if not exists products_trending_idx on public.products(is_trending) where is_active;
-- trigram indexes make the storefront's "ilike" search fast as the catalogue grows.
-- Extensions live in their own schema, never in public.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create index if not exists products_name_trgm  on public.products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm on public.products using gin (brand gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. PRODUCT IMAGES
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  alt         text,
  width       int,
  height      int,
  is_primary  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5. PRODUCT VARIANTS  (packs / sizes / shades)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  label          text not null,              -- "1 Pack", "Buy 2 Save 15%", "50ml"
  sku            text,
  qty            int not null default 1,     -- units contained
  price          numeric(12,2) not null,
  original_price numeric(12,2),
  badge          text,                       -- "Best value"
  track_stock    boolean not null default false,
  stock          int not null default 0,
  is_default     boolean not null default false,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists product_variants_product_idx on public.product_variants(product_id, sort_order);

-- ---------------------------------------------------------------------------
-- 6. CUSTOMERS
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null unique,
  name         text,
  email        text,
  city         text,
  address      text,
  orders_count int not null default 0,
  total_spent  numeric(14,2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists customers_phone_idx on public.customers(phone);

-- ---------------------------------------------------------------------------
-- 7. COUPONS
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  kind               text not null default 'percent'
                       check (kind in ('percent','fixed','free_shipping')),
  value              numeric(12,2) not null default 0,
  min_order          numeric(12,2) not null default 0,
  max_discount       numeric(12,2),
  starts_at          timestamptz,
  ends_at            timestamptz,
  usage_limit        int,
  used_count         int not null default 0,
  per_customer_limit int,
  category_id        uuid references public.categories(id) on delete set null,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists coupons_code_idx on public.coupons(upper(code));

-- ---------------------------------------------------------------------------
-- 8. ORDERS
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  customer_id      uuid references public.customers(id) on delete set null,

  customer_name    text not null,
  phone            text not null,
  email            text,
  address          text not null,
  city             text not null,
  province         text,
  postal_code      text,
  notes            text,

  subtotal         numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  shipping         numeric(12,2) not null default 0,
  cod_fee          numeric(12,2) not null default 0,
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  currency         text not null default 'PKR',
  coupon_code      text,

  payment_method   text not null default 'cod',
  status           text not null default 'pending'
                     references public.order_status(code),
  payment_state    text not null default 'unpaid'
                     references public.payment_status(code),

  idempotency_key  text unique,
  ip               text,
  user_agent       text,
  admin_note       text,
  tracking_note    text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_created_idx  on public.orders(created_at desc);
create index if not exists orders_status_idx   on public.orders(status, created_at desc);
create index if not exists orders_phone_idx    on public.orders(phone);
create index if not exists orders_number_idx   on public.orders(order_number);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  variant_id    uuid references public.product_variants(id) on delete set null,
  name_snapshot text not null,
  variant_label text,
  sku           text,
  image_url     text,
  unit_price    numeric(12,2) not null,
  qty           int not null default 1,
  line_total    numeric(12,2) not null,
  created_at    timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------------
-- 9. PAYMENTS  (current state per attempt)  +  TRANSACTIONS (raw event log)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  gateway       text not null,                -- cod | jazzcash | easypaisa | card
  amount        numeric(12,2) not null,
  currency      text not null default 'PKR',
  state         text not null default 'pending'
                  references public.payment_status(code),
  reference     text,                          -- our txn ref sent to gateway
  gateway_ref   text,                          -- gateway's own id
  error_code    text,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments(order_id);
create unique index if not exists payments_reference_idx on public.payments(reference)
  where reference is not null;

create table if not exists public.payment_transactions (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid references public.payments(id) on delete cascade,
  order_id        uuid references public.orders(id) on delete set null,
  gateway         text not null,
  event           text not null,              -- init | callback | webhook | inquiry
  txn_ref         text,
  amount          numeric(12,2),
  signature_valid boolean,
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists payment_tx_order_idx on public.payment_transactions(order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 10. SETTINGS  (single JSON row — everything the admin can change)
-- ---------------------------------------------------------------------------
create table if not exists public.store_settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 11. ADMIN USERS
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'admin' check (role in ('admin','staff','viewer')),
  created_at timestamptz not null default now()
);

-- is_admin() lives in a private schema so it is NOT reachable over the REST API,
-- while row level security policies can still call it.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.id = auth.uid());
$$;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. REVIEWS
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,
  rating      int not null check (rating between 1 and 5),
  title       text,
  body        text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews(product_id, is_approved);

-- ---------------------------------------------------------------------------
-- 13. ANALYTICS + KEEP-ALIVE (stops the free tier pausing the project)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  path       text,
  product_id uuid references public.products(id) on delete set null,
  order_id   uuid references public.orders(id) on delete set null,
  session_id text,
  referrer   text,
  value      numeric(12,2),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_created_idx on public.analytics_events(created_at desc);
create index if not exists analytics_type_idx    on public.analytics_events(type, created_at desc);

create table if not exists public.keep_alive (
  id        int primary key default 1 check (id = 1),
  last_ping timestamptz not null default now()
);
insert into public.keep_alive (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 14. updated_at TRIGGERS
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','orders','payments','store_settings']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 15. ATOMIC ORDER CREATION
--     Called by the Cloudflare Worker with the service-role key.
--     Prices, stock, COD fee and coupons are ALL re-computed here from the
--     database — never trusted from the browser.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   jsonb;
  v_item       jsonb;
  v_product    public.products;
  v_variant    public.product_variants;
  v_unit       numeric(12,2);
  v_qty        int;
  v_units      int;
  v_name       text;
  v_img        text;
  v_sku        text;
  v_vlabel     text;
  v_subtotal   numeric(12,2) := 0;
  v_shipping   numeric(12,2) := 0;
  v_cod        numeric(12,2) := 0;
  v_discount   numeric(12,2) := 0;
  v_total      numeric(12,2) := 0;
  v_free_ship  boolean := true;
  v_cod_ok     boolean := true;
  v_method     text := coalesce(p->>'payment_method','cod');
  v_idem       text := nullif(p->>'idempotency_key','');
  v_coupon     public.coupons;
  v_code       text := upper(trim(coalesce(p->>'coupon_code','')));
  v_order_id   uuid;
  v_number     text;
  v_customer   uuid;
  v_existing   public.orders;
  v_threshold  numeric(12,2);
begin
  -- Idempotency: same key returns the order that already exists.
  if v_idem is not null then
    select * into v_existing from public.orders where idempotency_key = v_idem;
    if found then
      return jsonb_build_object('ok', true, 'duplicate', true,
        'order_id', v_existing.id, 'order_number', v_existing.order_number,
        'total', v_existing.total, 'payment_method', v_existing.payment_method);
    end if;
  end if;

  select data into v_settings from public.store_settings where id = 1;
  v_settings := coalesce(v_settings, '{}'::jsonb);

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_cart');
  end if;

  -- ---- validate every line against the database -------------------------
  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_qty   := greatest(1, least(coalesce((v_item->>'qty')::int, 1), 99));
    v_units := 1;

    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'product_unavailable');
    end if;

    v_unit   := v_product.price;
    v_name   := v_product.name;
    v_sku    := v_product.sku;
    v_vlabel := null;

    if nullif(v_item->>'variant_id','') is not null then
      select * into v_variant from public.product_variants
        where id = (v_item->>'variant_id')::uuid
          and product_id = v_product.id and is_active;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'variant_unavailable');
      end if;
      v_unit   := v_variant.price;
      v_vlabel := v_variant.label;
      v_sku    := coalesce(v_variant.sku, v_product.sku);
      -- a pack contains this many single units
      v_units  := greatest(1, coalesce(v_variant.qty, 1));
      if v_variant.track_stock then
        if v_variant.stock < v_qty then
          return jsonb_build_object('ok', false, 'error', 'out_of_stock',
                                    'product', v_product.name);
        end if;
      elsif v_product.track_stock and v_product.stock < (v_qty * v_units) then
        return jsonb_build_object('ok', false, 'error', 'out_of_stock',
                                  'product', v_product.name);
      end if;
    elsif v_product.track_stock and v_product.stock < v_qty then
      return jsonb_build_object('ok', false, 'error', 'out_of_stock',
                                'product', v_product.name);
    end if;

    select url into v_img from public.product_images
      where product_id = v_product.id
      order by is_primary desc, sort_order asc limit 1;

    v_subtotal := v_subtotal + (v_unit * v_qty);
    if not v_product.free_shipping then v_free_ship := false; end if;
    if not v_product.cod_enabled    then v_cod_ok    := false; end if;

    -- stash the validated line for insertion after the order row exists
    p := jsonb_set(p, array['_lines'],
      coalesce(p->'_lines','[]'::jsonb) || jsonb_build_object(
        'product_id', v_product.id, 'variant_id',
        case when v_variant.id is not null then v_variant.id::text else null end,
        'name', v_name, 'variant_label', v_vlabel, 'sku', v_sku,
        'image_url', v_img, 'unit_price', v_unit, 'qty', v_qty,
        'units', v_units,
        'line_total', v_unit * v_qty,
        'track_stock', v_product.track_stock,
        'v_track', coalesce(v_variant.track_stock, false)
      ));
    v_variant := null;
  end loop;

  if v_method = 'cod' and not v_cod_ok then
    return jsonb_build_object('ok', false, 'error', 'cod_not_allowed');
  end if;
  if v_method = 'cod' and coalesce((v_settings->>'cod_enabled')::boolean, true) = false then
    return jsonb_build_object('ok', false, 'error', 'cod_disabled');
  end if;

  -- ---- shipping / COD fee ------------------------------------------------
  v_threshold := coalesce((v_settings->>'free_shipping_over')::numeric, 0);
  if v_free_ship or (v_threshold > 0 and v_subtotal >= v_threshold) then
    v_shipping := 0;
  else
    v_shipping := coalesce((v_settings->>'shipping_flat')::numeric, 0);
  end if;
  if v_method = 'cod' then
    v_cod := coalesce((v_settings->>'cod_charges')::numeric, 0);
  end if;

  -- ---- coupon ------------------------------------------------------------
  if v_code <> '' then
    select * into v_coupon from public.coupons
      where upper(code) = v_code and is_active
        and (starts_at is null or starts_at <= now())
        and (ends_at   is null or ends_at   >= now())
        and (usage_limit is null or used_count < usage_limit);
    if not found then
      return jsonb_build_object('ok', false, 'error', 'coupon_invalid');
    end if;
    if v_subtotal < v_coupon.min_order then
      return jsonb_build_object('ok', false, 'error', 'coupon_min_order',
                                'min_order', v_coupon.min_order);
    end if;
    if v_coupon.kind = 'percent' then
      v_discount := round(v_subtotal * v_coupon.value / 100.0, 2);
    elsif v_coupon.kind = 'fixed' then
      v_discount := least(v_coupon.value, v_subtotal);
    else
      v_shipping := 0;
    end if;
    if v_coupon.max_discount is not null then
      v_discount := least(v_discount, v_coupon.max_discount);
    end if;
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  v_total  := greatest(0, v_subtotal - v_discount) + v_shipping + v_cod;
  v_number := 'ORD-' || to_char(now(), 'YYMM') || '-' ||
              lpad(nextval('public.order_number_seq')::text, 4, '0');

  -- ---- customer ----------------------------------------------------------
  insert into public.customers (phone, name, email, city, address)
  values (p->>'phone', p->>'customer_name', nullif(p->>'email',''),
          p->>'city', p->>'address')
  on conflict (phone) do update
    set name    = coalesce(excluded.name, public.customers.name),
        email   = coalesce(excluded.email, public.customers.email),
        city    = coalesce(excluded.city, public.customers.city),
        address = coalesce(excluded.address, public.customers.address),
        updated_at = now()
  returning id into v_customer;

  -- ---- order -------------------------------------------------------------
  insert into public.orders (
    order_number, customer_id, customer_name, phone, email, address, city,
    province, postal_code, notes, subtotal, discount, shipping, cod_fee,
    total, coupon_code, payment_method, status, payment_state,
    idempotency_key, ip, user_agent
  ) values (
    v_number, v_customer, p->>'customer_name', p->>'phone',
    nullif(p->>'email',''), p->>'address', p->>'city',
    nullif(p->>'province',''), nullif(p->>'postal_code',''),
    nullif(p->>'notes',''), v_subtotal, v_discount, v_shipping, v_cod,
    v_total, nullif(v_code,''), v_method,
    'pending', case when v_method = 'cod' then 'unpaid' else 'pending' end,
    v_idem, nullif(p->>'ip',''), nullif(p->>'user_agent','')
  ) returning id into v_order_id;

  -- ---- items + stock -----------------------------------------------------
  for v_item in select * from jsonb_array_elements(p->'_lines') loop
    insert into public.order_items (
      order_id, product_id, variant_id, name_snapshot, variant_label, sku,
      image_url, unit_price, qty, line_total
    ) values (
      v_order_id, (v_item->>'product_id')::uuid,
      nullif(v_item->>'variant_id','')::uuid,
      v_item->>'name', v_item->>'variant_label', v_item->>'sku',
      v_item->>'image_url', (v_item->>'unit_price')::numeric,
      (v_item->>'qty')::int, (v_item->>'line_total')::numeric
    );

    if (v_item->>'v_track')::boolean then
      update public.product_variants set stock = stock - (v_item->>'qty')::int
        where id = (v_item->>'variant_id')::uuid;
    elsif (v_item->>'track_stock')::boolean then
      -- a pack removes (packs x units per pack) from the product's stock
      update public.products
         set stock = greatest(0, stock - ((v_item->>'qty')::int * coalesce((v_item->>'units')::int, 1)))
       where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  update public.customers
     set orders_count = orders_count + 1, total_spent = total_spent + v_total
   where id = v_customer;

  insert into public.payments (order_id, gateway, amount, state, reference)
  values (v_order_id, v_method, v_total,
          case when v_method = 'cod' then 'unpaid' else 'pending' end,
          v_number || '-' || substr(replace(v_order_id::text,'-',''), 1, 8));

  return jsonb_build_object('ok', true, 'order_id', v_order_id,
    'order_number', v_number, 'subtotal', v_subtotal, 'discount', v_discount,
    'shipping', v_shipping, 'cod_fee', v_cod, 'total', v_total,
    'payment_method', v_method);
end $$;

-- create_order must NEVER be callable from the browser.
revoke execute on function public.create_order(jsonb) from public;
revoke execute on function public.create_order(jsonb) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 16. PUBLIC ORDER LOOKUP (tracking) — order number + phone, nothing else
-- ---------------------------------------------------------------------------
create or replace function public.track_order(p_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o public.orders; items jsonb;
begin
  select * into o from public.orders
    where upper(order_number) = upper(trim(p_number))
      and right(regexp_replace(phone, '\D', '', 'g'), 6)
        = right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 6);
  if not found then return jsonb_build_object('ok', false); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name_snapshot, 'variant', variant_label,
           'qty', qty, 'unit_price', unit_price, 'line_total', line_total,
           'image_url', image_url) order by created_at), '[]'::jsonb)
    into items from public.order_items where order_id = o.id;

  return jsonb_build_object('ok', true, 'order_number', o.order_number,
    'status', o.status, 'payment_state', o.payment_state,
    'payment_method', o.payment_method, 'created_at', o.created_at,
    'city', o.city, 'customer_name', o.customer_name,
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping', o.shipping,
    'cod_fee', o.cod_fee, 'total', o.total,
    'tracking_note', o.tracking_note, 'items', items);
end $$;

-- Order numbers are sequential, so an open tracking endpoint could be brute
-- forced. Only the Worker (service-role key) may call this; it rate-limits it.
revoke execute on function public.track_order(text, text) from public;
revoke execute on function public.track_order(text, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 17. ROW LEVEL SECURITY
--     Public (anon)  : read the catalogue, log analytics. Nothing else.
--     Orders/payments: NO public access at all — only the Worker's
--                      service-role key (which bypasses RLS) may write them.
--     Admin          : must exist in admin_users.
-- ---------------------------------------------------------------------------
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.product_variants    enable row level security;
alter table public.customers           enable row level security;
alter table public.coupons             enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.store_settings      enable row level security;
alter table public.admin_users         enable row level security;
alter table public.reviews             enable row level security;
alter table public.analytics_events    enable row level security;
alter table public.order_status        enable row level security;
alter table public.payment_status      enable row level security;
alter table public.keep_alive          enable row level security;

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname
             from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- catalogue: world-readable, admin-writable
create policy cat_read  on public.categories       for select using (is_active or private.is_admin());
create policy cat_write on public.categories       for all    using (private.is_admin()) with check (private.is_admin());
create policy prod_read  on public.products        for select using (is_active or private.is_admin());
create policy prod_write on public.products        for all    using (private.is_admin()) with check (private.is_admin());
create policy pimg_read  on public.product_images  for select using (true);
create policy pimg_write on public.product_images  for all    using (private.is_admin()) with check (private.is_admin());
create policy pvar_read  on public.product_variants for select using (is_active or private.is_admin());
create policy pvar_write on public.product_variants for all   using (private.is_admin()) with check (private.is_admin());
create policy stat_read  on public.order_status    for select using (true);
create policy pstat_read on public.payment_status  for select using (true);

-- settings: readable (theme, whatsapp, pixel ids), admin-writable
create policy set_read  on public.store_settings   for select using (true);
create policy set_write on public.store_settings   for all    using (private.is_admin()) with check (private.is_admin());

-- reviews: only approved ones are public; anyone may submit (pending approval)
create policy rev_read   on public.reviews for select using (is_approved or private.is_admin());
create policy rev_create on public.reviews for insert with check (is_approved = false);
create policy rev_write  on public.reviews for all    using (private.is_admin()) with check (private.is_admin());

-- analytics: write-only funnel for the browser
create policy an_create on public.analytics_events for insert with check (true);
create policy an_admin  on public.analytics_events for all    using (private.is_admin()) with check (private.is_admin());

-- orders / customers / payments / coupons: ADMIN ONLY through the API.
create policy ord_admin   on public.orders              for all using (private.is_admin()) with check (private.is_admin());
create policy oitem_admin on public.order_items         for all using (private.is_admin()) with check (private.is_admin());
create policy cust_admin  on public.customers           for all using (private.is_admin()) with check (private.is_admin());
create policy pay_admin   on public.payments            for all using (private.is_admin()) with check (private.is_admin());
create policy ptx_admin   on public.payment_transactions for all using (private.is_admin()) with check (private.is_admin());
create policy cpn_admin   on public.coupons             for all using (private.is_admin()) with check (private.is_admin());
create policy adm_self    on public.admin_users         for select using (id = auth.uid() or private.is_admin());

-- keep_alive: the GitHub Action updates this every 3 days so the free-tier
-- project never gets paused for inactivity.
create policy ka_read   on public.keep_alive for select using (true);
create policy ka_update on public.keep_alive for update using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 18. MAKE YOURSELF AN ADMIN
--     1. Supabase → Authentication → Users → Add user (email + password)
--     2. Replace the email below with that email and run these two lines.
-- ---------------------------------------------------------------------------
-- insert into public.admin_users (id, email, role)
-- select id, email, 'admin' from auth.users where email = 'you@example.com'
-- on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 19. DEFAULT SETTINGS
-- ---------------------------------------------------------------------------
update public.store_settings set data = data || jsonb_build_object(
  'cod_enabled',        true,
  'cod_charges',        0,
  'shipping_flat',      200,
  'free_shipping_over', 3000,
  'currency',           'PKR',
  'whatsapp',           '',
  'phone',              '',
  'email',              '',
  'address',            '',
  'ga4_id',             '',
  'meta_pixel_id',      '',
  'announcement',       'Cash on delivery all over Pakistan',
  'theme',              'default'
) where id = 1;
