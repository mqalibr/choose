-- Phone-specific typed specs + brand facets for scalable filtering.

create table if not exists public.phone_specs (
  product_id bigint primary key references public.products(id) on delete cascade,
  battery_mah integer check (battery_mah is null or battery_mah > 0),
  has_nfc boolean,
  ram_gb smallint check (ram_gb is null or ram_gb > 0),
  storage_gb integer check (storage_gb is null or storage_gb > 0),
  chipset text,
  os_name text,
  sim_count smallint check (sim_count is null or sim_count between 1 and 4),
  main_camera_mp numeric(5,1) check (main_camera_mp is null or main_camera_mp > 0),
  has_wireless_charge boolean,
  screen_size_in numeric(4,2) check (screen_size_in is null or screen_size_in > 0),
  raw_specs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_phone_specs_updated_at on public.phone_specs;
create trigger trg_phone_specs_updated_at
before update on public.phone_specs
for each row execute function public.set_updated_at();

create index if not exists products_brand_lower_idx
  on public.products ((lower(brand)))
  where brand is not null and btrim(brand) <> '';

create index if not exists phone_specs_ram_idx on public.phone_specs (ram_gb);
create index if not exists phone_specs_storage_idx on public.phone_specs (storage_gb);
create index if not exists phone_specs_battery_idx on public.phone_specs (battery_mah);
create index if not exists phone_specs_nfc_idx on public.phone_specs (has_nfc);
create index if not exists phone_specs_wireless_charge_idx on public.phone_specs (has_wireless_charge);
create index if not exists phone_specs_screen_size_idx on public.phone_specs (screen_size_in);
create index if not exists phone_specs_os_idx on public.phone_specs (os_name);
create index if not exists phone_specs_chipset_idx on public.phone_specs using gin (chipset gin_trgm_ops);

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
