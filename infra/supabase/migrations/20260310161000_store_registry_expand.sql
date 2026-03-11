-- Expand store registry for 12-store rollout planning.

insert into public.stores (name, slug, base_url, scrape_priority, is_active)
values
  ('Kontakt Home', 'kontakt-home', 'https://kontakt.az', 10, true),
  ('Irshad', 'irshad', 'https://irshad.az', 20, true),
  ('Baku Electronics', 'baku-electronics', 'https://www.bakuelectronics.az', 30, true),
  ('Soliton', 'soliton', 'https://soliton.az', 40, true),
  ('Smart Electronics', 'smartelectronics', 'https://smartelectronics.az', 50, true),
  ('BirMarket', 'birmarket', 'https://birmarket.az', 60, true),
  ('MegaMart', 'megamart', 'https://megamart.az', 70, true),
  ('Barkod Electronics', 'barkod-electronics', 'https://www.barkodelectronics.az', 80, true),
  ('Elit Optimal', 'elit-optimal', 'https://elitoptimal.az', 90, true),
  ('W-T', 'w-t', 'https://www.w-t.az', 100, true),
  ('SmartOn', 'smarton', 'https://smarton.az', 110, true),
  ('Bakcell Shop', 'bakcell-shop', 'https://shop.bakcell.com', 120, true),
  ('ByTelecom', 'bytelecom', 'https://bytelecom.az', 130, true)
on conflict (slug) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  scrape_priority = excluded.scrape_priority,
  is_active = excluded.is_active;
