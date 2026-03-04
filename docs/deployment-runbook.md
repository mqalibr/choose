# Deployment Runbook

## Web (Vercel)

1. `apps/web` projectini Vercel-ə bağla.
2. Aşağıdakı env-ləri əlavə et:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
3. Build command: `npm run build`
4. Output: Next.js default

## Scraper Scheduler (GitHub Actions)

1. Repo Secrets əlavə et:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. `.github/workflows/scrape-cron.yml` hər 2 saatdan bir işləyir.
3. Parallel shards:
   - workflow matrix: `shard_index`
   - env: `SCRAPER_SHARD_TOTAL`

## Alerts Scheduler (GitHub Actions)

1. Vercel internal endpoint URL secret kimi daxil et:
   - `INTERNAL_ALERTS_ENDPOINT` (meselen `https://your-domain.com/api/internal/alerts/run`)
2. Shared secret daxil et:
   - `INTERNAL_API_KEY`
3. Vercel env-lərinə daxil et:
   - `INTERNAL_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `ALERT_BATCH_SIZE`

## Operations Checklist

1. Hər yeni store üçün əvvəlcə `SCRAPER_ONLY_STORES=<slug>` smoke run et.
2. `price_logs` və `stores.last_scraped_at` monitor et.
3. 15+ store olduqda shard sayını 2-dən 4-ə qaldır.
