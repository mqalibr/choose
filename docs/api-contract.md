# API Contract (MVP)

## `GET /api/search?q=&page=&limit=&sort=`

- Query:
  - `q`: string
  - `page`: number (default 1)
  - `limit`: number (default 24)
  - `sort`: `relevance | price_asc | price_desc | updated_desc`
- Response:
  - `items[]`, `total`, `page`, `limit`

## `GET /api/product/[slug]`

- Response:
  - `product`
  - `offers[]` (sorted by lowest price)
  - `lowestPrice`
  - `lastUpdatedAt`

## `GET /api/category/[slug]?page=&limit=&sort=`

- Response:
  - `category`
  - `items[]` (products under category)
  - pagination fields

## `GET /api/store/[slug]?page=&limit=&sort=`

- Response:
  - `store`
  - `items[]`
  - pagination fields

## `POST /api/internal/alerts/run`

- Header:
  - `x-internal-key: <INTERNAL_API_KEY>`
- Body:
  - `limit?: number` (1-500)
  - `dryRun?: boolean`
- Response:
  - `scanned`, `queued`, `skipped`, `sent`, `failed`, `errors[]`
