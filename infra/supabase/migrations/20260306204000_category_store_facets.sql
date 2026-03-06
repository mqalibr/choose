-- Category-level store facets for UI filtering.

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
