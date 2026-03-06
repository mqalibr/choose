import type { StoreScraper } from "../core/types";
import { bakuElectronicsScraper } from "../stores/bakuElectronics";
import { irshadScraper } from "../stores/irshad";
import { kontaktHomeScraper } from "../stores/kontaktHome";
import { solitonScraper } from "../stores/soliton";

const ALL_STORES: StoreScraper[] = [kontaktHomeScraper, irshadScraper, bakuElectronicsScraper, solitonScraper];

function applyExplicitFilter(stores: StoreScraper[]): StoreScraper[] {
  const only = process.env.SCRAPER_ONLY_STORES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!only?.length) return stores;
  return stores.filter((store) => only.includes(store.storeSlug));
}

function applyShardFilter(stores: StoreScraper[]): StoreScraper[] {
  const shardTotal = Number(process.env.SCRAPER_SHARD_TOTAL ?? "1");
  const shardIndex = Number(process.env.SCRAPER_SHARD_INDEX ?? "0");

  if (!Number.isFinite(shardTotal) || shardTotal <= 1) {
    return stores;
  }

  if (!Number.isFinite(shardIndex) || shardIndex < 0 || shardIndex >= shardTotal) {
    throw new Error(`Invalid shard config. SCRAPER_SHARD_INDEX=${shardIndex}, SCRAPER_SHARD_TOTAL=${shardTotal}`);
  }

  return stores.filter((_, idx) => idx % shardTotal === shardIndex);
}

export function getEnabledStores(): StoreScraper[] {
  const sorted = [...ALL_STORES].sort((a, b) => a.storeSlug.localeCompare(b.storeSlug));
  const byExplicitList = applyExplicitFilter(sorted);
  return applyShardFilter(byExplicitList);
}
