# Azerbaijan Electronics Price Comparison Platform

Lean MVP architecture for a scalable electronics-focused price comparison system.

## Monorepo Layout

- `apps/web`: Next.js App Router frontend + API routes
- `services/scrapers`: store-specific scraping service (Node.js + Playwright)
- `packages/shared`: shared normalization and slug utilities
- `infra/supabase`: PostgreSQL schema for Supabase
- `docs`: architecture and scaling notes

## Quick Start

```bash
npm install
npm run dev
```

Run scrapers:

```bash
npm run scrape
```

Scheduler:

- GitHub Actions cron workflow: `.github/workflows/scrape-cron.yml`
- Shard env-ləri ilə paralel store scraping dəstəklənir.
- Alerts cron workflow: `.github/workflows/alerts-cron.yml`

## Core Design Decisions

- Canonical product model with `store_products` mapping for multi-store comparisons
- Price history stored in append-only `prices`
- Current price denormalized in `store_products` for fast listing queries
- SEO-first slugs for products, categories, and stores
- Modular scraper contract per store for incremental onboarding
- Fingerprint-based canonical product matching + slug collision fallback
- Internal alert runner + Telegram notification queue
