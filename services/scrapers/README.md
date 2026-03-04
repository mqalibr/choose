# Scraper Service

## Structure

```text
services/scrapers
  src/
    config/stores.ts
    core/
      browser.ts
      logger.ts
      rateLimiter.ts
      retry.ts
      supabase.ts
      types.ts
      upsert.ts
    normalize/
      brandDictionary.ts
      index.ts
    stores/
      storeA.ts
      storeB.ts
    scraperRunner.ts
    index.ts
```

## Scheduler Options

1. Vercel Cron:
   - `/api/internal/run-scrapers?shard=1` endpoint trigger
   - best when scraping is short-lived
2. GitHub Actions:
   - reliable and cheap for medium workloads
   - use matrix strategy for shards
3. Railway/Render Worker:
   - long-running workers
   - better when store count grows 20-50+

## Environment

- `SCRAPER_ONLY_STORES=store-a,store-b` : explicit whitelist
- `SCRAPER_SHARD_TOTAL=3` : total shard count
- `SCRAPER_SHARD_INDEX=0` : current shard index (0-based)
- `SCRAPER_MAX_CONCURRENCY=2` : parallel store jobs per worker
- `SCRAPER_MAX_ITEMS=200` : optional cap for smoke tests

## Scaling to 50 Stores

- shard stores by env: `SCRAPER_ONLY_STORES=store-a,store-b`
- run multiple scheduler jobs in parallel
- increase worker count instead of one huge cron run
- keep scraper modules isolated and idempotent

## New Store Onboarding Checklist

1. `src/stores/_template.ts` faylını kopyala və store slug-u təyin et.
2. Real selector-ları və pagination məntiqini əlavə et.
3. `src/config/stores.ts` daxilində scraper-i registry-yə daxil et.
4. Supabase `stores` cədvəlinə mağaza sətiri əlavə et.
5. `SCRAPER_ONLY_STORES=<new-slug>` ilə smoke run et.
6. Price və price_logs yazıldığını yoxla, sonra schedulerə daxil et.
