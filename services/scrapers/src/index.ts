import { getEnabledStores } from "./config/stores";
import { logger } from "./core/logger";
import { runScrapers } from "./scraperRunner";

async function main() {
  const stores = getEnabledStores();
  const maxConcurrency = Number(process.env.SCRAPER_MAX_CONCURRENCY ?? "2");
  const maxItemsPerStore = process.env.SCRAPER_MAX_ITEMS
    ? Number(process.env.SCRAPER_MAX_ITEMS)
    : undefined;

  if (!stores.length) {
    logger.warn(
      {
        only: process.env.SCRAPER_ONLY_STORES ?? null,
        shardIndex: process.env.SCRAPER_SHARD_INDEX ?? null,
        shardTotal: process.env.SCRAPER_SHARD_TOTAL ?? null
      },
      "No stores selected for this run"
    );
    return;
  }

  const startedAt = Date.now();
  const results = await runScrapers({ stores, maxConcurrency, maxItemsPerStore });
  const durationMs = Date.now() - startedAt;

  logger.info(
    {
      durationMs,
      stores: stores.length,
      results
    },
    "Scraper cycle finished"
  );
}

main().catch((error) => {
  logger.error({ error }, "Scraper cycle failed");
  process.exit(1);
});
