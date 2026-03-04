-- MVP seed data (stores + root categories)

insert into public.stores (name, slug, base_url, scrape_priority, is_active)
values
  ('Store A Demo', 'store-a', 'https://store-a.example', 1, true),
  ('Store B Demo', 'store-b', 'https://store-b.example', 2, true),
  ('Kontakt Home', 'kontakt-home', 'https://kontakt.az', 10, true),
  ('Irshad', 'irshad', 'https://irshad.az', 20, true),
  ('Baku Electronics', 'baku-electronics', 'https://www.bakuelectronics.az', 30, true),
  ('Soliton', 'soliton', 'https://soliton.az', 40, true),
  ('Optimal', 'optimal', 'https://optimal.az', 50, true),
  ('World Telecom', 'world-telecom', 'https://www.worldtelecom.az', 60, true)
on conflict (slug) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  scrape_priority = excluded.scrape_priority,
  is_active = excluded.is_active;

insert into public.categories (name, slug, path, level, is_active)
values
  ('Telefonlar', 'telefonlar', 'telefonlar', 0, true),
  ('Noutbuklar', 'noutbuklar', 'noutbuklar', 0, true),
  ('Televizorlar', 'televizorlar', 'televizorlar', 0, true),
  ('Plansetler', 'plansetler', 'plansetler', 0, true),
  ('Qulaqliqlar', 'qulaqliqlar', 'qulaqliqlar', 0, true),
  ('Aksesuarlar', 'aksesuarlar', 'aksesuarlar', 0, true)
on conflict (slug) do update
set
  name = excluded.name,
  path = excluded.path,
  level = excluded.level,
  is_active = excluded.is_active;