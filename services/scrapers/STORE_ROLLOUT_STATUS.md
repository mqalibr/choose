# Store Rollout Status (Phones/Tablets/TV)

This file tracks real parser readiness for the 12 target stores.

## Implemented Now

| Store slug | Phones | Tablets | TVs | Specs extraction |
| --- | --- | --- | --- | --- |
| `kontakt-home` | Yes | Yes | Yes | Detail specs parsed, phone typed specs enabled |
| `irshad` | Yes | Yes | Yes | Detail specs parsed, phone typed specs enabled |
| `soliton` | Yes | Yes | Yes | Detail specs parsed, phone typed specs enabled |
| `baku-electronics` | Yes | Yes | Yes | Detail specs from NEXT_DATA, phone typed specs enabled |

## Not Implemented Yet

| Store slug | Base URL | Status |
| --- | --- | --- |
| `smartelectronics` | https://smartelectronics.az/ | parser missing |
| `birmarket` | https://birmarket.az/ | parser missing |
| `megamart` | https://megamart.az/ | parser missing |
| `barkod-electronics` | https://www.barkodelectronics.az/ | parser missing |
| `elit-optimal` | https://elitoptimal.az/ | parser missing |
| `w-t` | https://www.w-t.az/ | parser missing |
| `smarton` | https://smarton.az/ | parser missing |
| `bakcell-shop` | https://shop.bakcell.com/ | parser missing |
| `bytelecom` | https://bytelecom.az/ | parser missing |

## Practical Throughput Notes

- Existing orchestration supports sharding and concurrency:
  - `SCRAPER_SHARD_TOTAL`, `SCRAPER_SHARD_INDEX`
  - `SCRAPER_MAX_CONCURRENCY`
- For stable runs, start with:
  - `SCRAPER_MAX_CONCURRENCY=2`
  - `SCRAPER_MAX_ITEMS=80` per store and per category
- Use `scripts/run-market-scrape.ps1` for category-focused runs.
