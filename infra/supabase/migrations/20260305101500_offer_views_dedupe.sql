-- Ensure offer/search/store views never return duplicate store offers
-- and never expose products with zero offers.

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
  count(*) as offer_count
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
  p.category_id
from public.v_product_search v
join public.products p on p.id = v.id;

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
