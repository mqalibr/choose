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
      kontaktHome.ts
      _template.ts
      storeA.ts
      storeB.ts
    scraperRunner.ts
    index.ts
```

## Active Store Registry

- Current active store in `src/config/stores.ts`: `kontakt-home`
- Demo files `storeA.ts` and `storeB.ts` are kept only as references.

## Scheduler Options

1. Vercel Cron:
   - trigger an internal API endpoint
   - useful for short runs
2. GitHub Actions:
   - reliable and cheap for medium workloads
   - easy sharding via matrix jobs
3. Railway or Render worker:
   - better for 20-50 stores and long-running jobs

## Environment

- `SCRAPER_ONLY_STORES=kontakt-home` : explicit store whitelist
- `SCRAPER_SHARD_TOTAL=3` : total shard count
- `SCRAPER_SHARD_INDEX=0` : current shard index (0-based)
- `SCRAPER_MAX_CONCURRENCY=2` : parallel stores per worker
- `SCRAPER_MAX_ITEMS=200` : optional cap for smoke tests
- `KONTAKT_MAX_PAGES_PER_CATEGORY=2` : page depth per category
- `KONTAKT_CATEGORY_URLS=` : optional comma-separated custom category URLs
- `KONTAKT_CHALLENGE_RETRIES=2` : retries when Cloudflare challenge appears

## Kontakt Scraper Notes

- Uses `.prodItem.product-item` cards
- Reads product metadata from `data-gtm`
- Uses `a.action.next` for pagination
- Retries failed page loads and throws on Cloudflare challenge pages

## New Store Onboarding Checklist

1. Copy `src/stores/_template.ts` and set store slug.
2. Add real selectors and pagination logic.
3. Register scraper in `src/config/stores.ts`.
4. Add store row into Supabase `stores`.
5. Run smoke test with `SCRAPER_ONLY_STORES=<new-slug>`.
6. Verify writes in `prices` and `price_logs`.
