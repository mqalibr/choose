# Arxitektura (MVP -> Scale)

## High-Level Diagram (Text)

```text
                    +----------------------+
                    |  Users / Google Bot  |
                    +----------+-----------+
                               |
                               v
                     +---------+----------+
                     |   Next.js (Web)    |
                     | App Router + API   |
                     +----+----------+----+
                          |          |
                  SSR/SEO |          | JSON API
                          v          v
                     +----+----------+----+
                     |   Supabase Postgres |
                     |  products/prices/...|
                     +----+----------+----+
                          ^
                          |
               upsert + history logs
                          |
                     +----+----------+----+
                     | Scraper Runner      |
                     | (Node + Playwright) |
                     +----+----------+----+
                          |
                  +-------+-------------------+
                  | per-store scraper modules |
                  | storeA, storeB, ...       |
                  +---------------------------+
```

## MVP Rollout (Lean)

1. 5-6 store, 150-200 məhsul, 2 saat interval scraping.
2. SEO landing səhifələri: `product`, `category`, `store`.
3. Click və trafik ölçümü (sonrakı mərhələdə Telegram + analytics).
4. Store onboarding checklist ilə mağaza sayı mərhələli artırılır.
5. 50+ store üçün scraper queue, worker partitioning və monitorinq əlavə edilir.

## Scraper Scaling Strategy

- `store module contract` sabit qalır, yeni store sadəcə yeni fayl + config ilə əlavə edilir.
- Rate limit hər store üzrə ayrıca.
- Runner concurrency parametri env ilə idarə olunur.
- Scheduler səviyyəsində stores shard edilə bilər:
  - Job A: `stores=0..9`
  - Job B: `stores=10..19`
- Future:
  - queue (BullMQ/Cloud Tasks)
  - distributed workers
  - alerting (Telegram/Slack)
