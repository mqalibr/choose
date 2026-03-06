-- Supabase schema for Azerbaijan electronics price comparison MVP
-- PostgreSQL 15+ (Supabase default)

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.stores (
  id bigserial primary key,
  name text not null,
  slug text not null unique,
  base_url text not null,
  logo_url text,
  is_active boolean not null default true,
  scrape_priority smallint not null default 100,
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_slug_format_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.categories (
  id bigserial primary key,
  parent_id bigint references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  path text not null,
  level smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_format_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.products (
  id bigserial primary key,
  category_id bigint references public.categories(id) on delete set null,
  canonical_name text not null,
  normalized_name text not null,
  brand text,
  model text,
  slug text not null unique,
  fingerprint text,
  ean text,
  image_url text,
  specs jsonb not null default '{}'::jsonb,
  last_price_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.phone_specs (
  product_id bigint primary key references public.products(id) on delete cascade,
  battery_mah integer check (battery_mah is null or battery_mah > 0),
  has_nfc boolean,
  ram_gb smallint check (ram_gb is null or ram_gb > 0),
  storage_gb integer check (storage_gb is null or storage_gb > 0),
  chipset_vendor text,
  chipset_model text,
  cpu_cores smallint check (cpu_cores is null or cpu_cores between 1 and 24),
  gpu_model text,
  chipset text,
  os_name text,
  os_version text,
  sim_count smallint check (sim_count is null or sim_count between 1 and 4),
  has_esim boolean,
  has_5g boolean,
  has_wifi_6 boolean,
  bluetooth_version text,
  main_camera_mp numeric(5,1) check (main_camera_mp is null or main_camera_mp > 0),
  ultrawide_camera_mp numeric(5,1) check (ultrawide_camera_mp is null or ultrawide_camera_mp > 0),
  telephoto_camera_mp numeric(5,1) check (telephoto_camera_mp is null or telephoto_camera_mp > 0),
  selfie_camera_mp numeric(5,1) check (selfie_camera_mp is null or selfie_camera_mp > 0),
  has_ois boolean,
  has_wireless_charge boolean,
  wired_charge_w numeric(6,2) check (wired_charge_w is null or wired_charge_w > 0),
  wireless_charge_w numeric(6,2) check (wireless_charge_w is null or wireless_charge_w > 0),
  screen_size_in numeric(4,2) check (screen_size_in is null or screen_size_in > 0),
  refresh_rate_hz smallint check (refresh_rate_hz is null or refresh_rate_hz between 30 and 240),
  panel_type text,
  resolution_width integer check (resolution_width is null or resolution_width > 0),
  resolution_height integer check (resolution_height is null or resolution_height > 0),
  weight_g numeric(6,2) check (weight_g is null or weight_g > 0),
  ip_rating text,
  release_year smallint check (release_year is null or release_year between 2000 and 2100),
  raw_specs jsonb not null default '{}'::jsonb,
  specs_confidence numeric(4,3) not null default 0.500 check (specs_confidence >= 0 and specs_confidence <= 1),
  last_parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_fingerprint_uidx
  on public.products (fingerprint)
  where fingerprint is not null;

create unique index if not exists products_ean_uidx
  on public.products (ean)
  where ean is not null;

create table if not exists public.store_products (
  id bigserial primary key,
  store_id bigint not null references public.stores(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  listing_key text not null,
  store_sku text,
  product_url text not null,
  raw_title text,
  normalized_title text not null,
  in_stock boolean not null default true,
  current_price_azn numeric(12,2),
  previous_price_azn numeric(12,2),
  price_updated_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, listing_key)
);

create table if not exists public.prices (
  id bigserial primary key,
  store_product_id bigint not null references public.store_products(id) on delete cascade,
  price_azn numeric(12,2) not null check (price_azn > 0),
  original_price_azn numeric(12,2),
  currency char(3) not null default 'AZN',
  in_stock boolean not null default true,
  captured_at timestamptz not null default now(),
  source_run_id uuid,
  created_at timestamptz not null default now(),
  unique (store_product_id, captured_at)
);

create table if not exists public.price_logs (
  id bigserial primary key,
  store_product_id bigint not null references public.store_products(id) on delete cascade,
  event_type text not null,
  old_price_azn numeric(12,2),
  new_price_azn numeric(12,2),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint price_logs_event_type_chk check (
    event_type in (
      'new_listing',
      'price_changed',
      'availability_changed',
      'listing_inactive',
      'scrape_error'
    )
  )
);

-- Future alerts/users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  telegram_chat_id text unique,
  locale text not null default 'az',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_alerts (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  target_price_azn numeric(12,2) not null check (target_price_azn > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, target_price_azn)
);

create table if not exists public.price_alert_notifications (
  id bigserial primary key,
  alert_id bigint not null references public.price_alerts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  store_product_id bigint not null references public.store_products(id) on delete cascade,
  channel text not null,
  recipient text not null,
  message text not null,
  message_hash text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint price_alert_notifications_channel_chk check (channel in ('telegram', 'email')),
  constraint price_alert_notifications_status_chk check (status in ('pending', 'sent', 'failed')),
  unique (alert_id, store_product_id, channel, recipient, message_hash)
);

-- Optional normalization memory to reduce duplicates across stores
create table if not exists public.product_aliases (
  id bigserial primary key,
  store_id bigint not null references public.stores(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  raw_title text not null,
  normalized_title text not null,
  fingerprint text not null,
  confidence numeric(4,3) not null default 1.000,
  created_at timestamptz not null default now(),
  unique(store_id, fingerprint)
);

-- Updated_at triggers
drop trigger if exists trg_stores_updated_at on public.stores;
create trigger trg_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_phone_specs_updated_at on public.phone_specs;
create trigger trg_phone_specs_updated_at
before update on public.phone_specs
for each row execute function public.set_updated_at();

drop trigger if exists trg_store_products_updated_at on public.store_products;
create trigger trg_store_products_updated_at
before update on public.store_products
for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Keep products.last_price_at fresh whenever new price row arrives
create or replace function public.sync_product_last_price_at()
returns trigger
language plpgsql
as $$
begin
  update public.products p
  set last_price_at = greatest(coalesce(p.last_price_at, to_timestamp(0)), new.captured_at)
  from public.store_products sp
  where sp.id = new.store_product_id
    and p.id = sp.product_id;

  return new;
end;
$$;

drop trigger if exists trg_prices_sync_product_last_price on public.prices;
create trigger trg_prices_sync_product_last_price
after insert on public.prices
for each row execute function public.sync_product_last_price_at();

-- Query performance indexes
create index if not exists stores_active_idx on public.stores (is_active);
create index if not exists stores_last_scraped_idx on public.stores (last_scraped_at desc);

create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists categories_path_idx on public.categories (path);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_last_price_idx on public.products (last_price_at desc);
create index if not exists products_brand_lower_idx
  on public.products ((lower(brand)))
  where brand is not null and btrim(brand) <> '';
create index if not exists products_normalized_trgm_idx
  on public.products using gin (normalized_name gin_trgm_ops);

create index if not exists phone_specs_ram_idx on public.phone_specs (ram_gb);
create index if not exists phone_specs_storage_idx on public.phone_specs (storage_gb);
create index if not exists phone_specs_battery_idx on public.phone_specs (battery_mah);
create index if not exists phone_specs_nfc_idx on public.phone_specs (has_nfc);
create index if not exists phone_specs_wireless_charge_idx on public.phone_specs (has_wireless_charge);
create index if not exists phone_specs_screen_size_idx on public.phone_specs (screen_size_in);
create index if not exists phone_specs_os_idx on public.phone_specs (os_name);
create index if not exists phone_specs_chipset_idx
  on public.phone_specs using gin (chipset gin_trgm_ops);
create index if not exists phone_specs_chipset_vendor_idx on public.phone_specs (chipset_vendor);
create index if not exists phone_specs_cpu_cores_idx on public.phone_specs (cpu_cores);
create index if not exists phone_specs_gpu_model_idx on public.phone_specs (gpu_model);
create index if not exists phone_specs_os_version_idx on public.phone_specs (os_version);
create index if not exists phone_specs_has_5g_idx on public.phone_specs (has_5g);
create index if not exists phone_specs_has_esim_idx on public.phone_specs (has_esim);
create index if not exists phone_specs_sim_count_idx on public.phone_specs (sim_count);
create index if not exists phone_specs_refresh_rate_idx on public.phone_specs (refresh_rate_hz);
create index if not exists phone_specs_panel_type_idx on public.phone_specs (panel_type);
create index if not exists phone_specs_release_year_idx on public.phone_specs (release_year);
create index if not exists phone_specs_main_camera_idx on public.phone_specs (main_camera_mp);
create index if not exists phone_specs_selfie_camera_idx on public.phone_specs (selfie_camera_mp);
create index if not exists phone_specs_weight_idx on public.phone_specs (weight_g);
create index if not exists phone_specs_os_name_lower_idx on public.phone_specs (lower(os_name));
create index if not exists phone_specs_chipset_model_trgm_idx
  on public.phone_specs using gin (chipset_model gin_trgm_ops);
create index if not exists phone_specs_raw_specs_gin_idx
  on public.phone_specs using gin (raw_specs jsonb_path_ops);

create index if not exists store_products_product_price_idx
  on public.store_products (product_id, in_stock, current_price_azn);
create index if not exists store_products_store_price_idx
  on public.store_products (store_id, in_stock, current_price_azn);
create index if not exists store_products_last_seen_idx
  on public.store_products (last_seen_at desc);
create index if not exists store_products_normalized_trgm_idx
  on public.store_products using gin (normalized_title gin_trgm_ops);

create index if not exists prices_store_product_time_idx
  on public.prices (store_product_id, captured_at desc);
create index if not exists prices_captured_at_idx
  on public.prices (captured_at desc);

create index if not exists price_logs_store_product_time_idx
  on public.price_logs (store_product_id, created_at desc);

create index if not exists price_alerts_product_active_idx
  on public.price_alerts (product_id, is_active);
create index if not exists users_email_uidx
  on public.users (email)
  where email is not null;
create index if not exists users_telegram_chat_idx
  on public.users (telegram_chat_id)
  where telegram_chat_id is not null;
create index if not exists price_alert_notifications_status_idx
  on public.price_alert_notifications (status, created_at);
create index if not exists price_alert_notifications_user_idx
  on public.price_alert_notifications (user_id, created_at desc);

create index if not exists product_aliases_product_idx
  on public.product_aliases (product_id);

-- API-focused views
create or replace view public.v_product_offers as
with ranked as (
  select
    sp.*,
    row_number() over (
      partition by sp.store_id, sp.product_id
      order by sp.last_seen_at desc nulls last, sp.price_updated_at desc nulls last, sp.id desc
    ) as rn
  from public.store_products sp
  where sp.is_active = true
    and sp.current_price_azn is not null
)
select
  r.id as store_product_id,
  s.id as store_id,
  s.name as store_name,
  s.slug as store_slug,
  p.id as product_id,
  r.current_price_azn,
  r.previous_price_azn,
  r.product_url,
  r.in_stock,
  r.price_updated_at
from ranked r
join public.stores s on s.id = r.store_id and s.is_active = true
join public.products p on p.id = r.product_id and p.is_active = true
where r.rn = 1;

create or replace view public.v_product_search as
select
  p.id,
  p.slug,
  p.canonical_name,
  p.image_url,
  p.brand,
  p.last_price_at,
  p.normalized_name as search_text,
  min(o.current_price_azn) filter (
    where o.current_price_azn is not null
      and o.in_stock = true
  ) as min_price_azn,
  count(*) as offer_count,
  nullif(trim(both '-' from regexp_replace(lower(coalesce(p.brand, '')), '[^a-z0-9]+', '-', 'g')), '') as brand_slug
from public.products p
join public.v_product_offers o on o.product_id = p.id
where p.is_active = true
group by p.id, p.slug, p.canonical_name, p.image_url, p.brand, p.last_price_at, p.normalized_name;

create or replace view public.v_category_products as
select
  v.id,
  v.slug,
  v.canonical_name,
  v.image_url,
  v.brand,
  v.last_price_at,
  v.search_text,
  v.min_price_azn,
  v.offer_count,
  p.category_id,
  v.brand_slug
from public.v_product_search v
join public.products p on p.id = v.id;

create or replace view public.v_category_brand_facets as
select
  v.category_id,
  v.brand,
  v.brand_slug,
  count(*)::bigint as product_count
from public.v_category_products v
where v.brand_slug is not null
group by v.category_id, v.brand, v.brand_slug;

create or replace view public.v_category_store_products as
select distinct
  p.category_id,
  o.product_id,
  o.store_slug,
  o.store_name
from public.v_product_offers o
join public.products p on p.id = o.product_id
where p.is_active = true
  and p.category_id is not null;

create or replace view public.v_category_store_facets as
select
  v.category_id,
  v.store_slug,
  v.store_name,
  count(distinct v.product_id)::bigint as product_count
from public.v_category_store_products v
group by v.category_id, v.store_slug, v.store_name;

create or replace view public.v_store_products as
select
  o.store_slug,
  o.store_name,
  p.slug,
  p.canonical_name,
  p.image_url,
  o.current_price_azn as min_price_azn,
  o.price_updated_at
from public.v_product_offers o
join public.products p on p.id = o.product_id
where p.is_active = true;

create or replace view public.v_active_price_alert_candidates as
select
  pa.id as alert_id,
  pa.user_id,
  pa.product_id,
  pa.target_price_azn,
  p.canonical_name,
  p.slug as product_slug,
  bo.store_product_id,
  bo.store_id,
  bo.store_name,
  bo.current_price_azn,
  bo.product_url,
  u.telegram_chat_id
from public.price_alerts pa
join public.users u on u.id = pa.user_id and u.is_active = true
join public.products p on p.id = pa.product_id and p.is_active = true
join lateral (
  select
    sp.id as store_product_id,
    sp.store_id,
    s.name as store_name,
    sp.current_price_azn,
    sp.product_url
  from public.store_products sp
  join public.stores s on s.id = sp.store_id and s.is_active = true
  where sp.product_id = pa.product_id
    and sp.is_active = true
    and sp.in_stock = true
    and sp.current_price_azn is not null
  order by sp.current_price_azn asc, sp.price_updated_at desc nulls last
  limit 1
) bo on true
where pa.is_active = true
  and bo.current_price_azn <= pa.target_price_azn;

-- RLS for user-owned tables
alter table public.users enable row level security;
alter table public.price_alerts enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select to authenticated using (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update to authenticated using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert to authenticated with check (auth.uid() = id);

drop policy if exists alerts_select_own on public.price_alerts;
create policy alerts_select_own on public.price_alerts
for select to authenticated using (auth.uid() = user_id);

drop policy if exists alerts_cud_own on public.price_alerts;
create policy alerts_cud_own on public.price_alerts
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
