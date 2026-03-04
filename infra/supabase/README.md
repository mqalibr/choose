# Supabase Setup

## 1) Migration tətbiqi

```bash
supabase db reset --linked
```

və ya mövcud remote DB üçün:

```bash
supabase db push --linked
```

`infra/supabase/migrations/20260304130000_init.sql` faylı əsas schema migration-dur.
Alerts/Telegram əlavələri üçün ikinci migration:
`infra/supabase/migrations/20260304143000_alerts_telegram.sql`

## 2) Seed data

```bash
psql "$SUPABASE_DB_URL" -f infra/supabase/seed.sql
```

və ya Supabase SQL Editor üzərindən `seed.sql` icra et.

## 3) Nə verir

- 8 başlanğıc mağaza (2 demo + 6 real slug)
- root elektronika kateqoriyaları
- scraper üçün store slug-ları hazır vəziyyətə gəlir
