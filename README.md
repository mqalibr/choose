# Azerbaijan Electronics Price Comparison Platform

Lean MVP architecture for a scalable electronics-focused price comparison system.

## Monorepo Layout

- `apps/web`: Next.js App Router frontend + API routes
- `services/scrapers`: store-specific scraping service (Node.js + Playwright)
- `packages/shared`: shared normalization and slug utilities
- `infra/supabase`: PostgreSQL schema for Supabase
- `docs`: architecture, deployment, and scaling notes

## Quick Start

```bash
npm install
npm run dev
```

Run scrapers:

```bash
npm run scrape
```

Run scraper without DB writes (selector smoke test):

```bash
SCRAPER_DRY_RUN=true SCRAPER_ONLY_STORES=kontakt-home,irshad npm run scrape
```

PowerShell equivalent:

```powershell
$env:SCRAPER_DRY_RUN='true'
$env:SCRAPER_ONLY_STORES='kontakt-home,irshad'
npm run scrape
```

## Scheduler

- Scraper cron workflow: `.github/workflows/scrape-cron.yml`
- Alerts cron workflow: `.github/workflows/alerts-cron.yml`
- Store sharding supported with `SCRAPER_SHARD_TOTAL` and `SCRAPER_SHARD_INDEX`

## Active Real Scraper

- `kontakt-home` (`https://kontakt.az`)
- `irshad` (`https://irshad.az`)
- Category pagination enabled with configurable depth:
  - `KONTAKT_MAX_PAGES_PER_CATEGORY`
  - `KONTAKT_CATEGORY_URLS`
  - `IRSHAD_MAX_PAGES_PER_CATEGORY`
  - `IRSHAD_CATEGORY_URLS`

## Core Design Decisions

- Canonical product model with `store_products` mapping for multi-store comparisons
- Price history stored in append-only `prices`
- Current price denormalized in `store_products` for fast listing queries
- SEO-first slugs for products, categories, and stores
- Modular scraper contract per store for incremental onboarding
- Fingerprint-based canonical product matching plus slug collision fallback
- Internal alert runner with Telegram notification queue
