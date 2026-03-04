# Data Normalization Strategy

## 1) Canonical Product Model

- Hər mağaza listing-i əvvəlcə `store_products` cədvəlinə düşür.
- Platformanın əsas məhsulu `products` cədvəlində saxlanılır.
- Mapping: `store_products.product_id -> products.id`.

## 2) Matching Pipeline

1. Scraper `raw_title`, `listing_key`, `price_raw` gətirir.
2. `normalizeProductTitle` ilə token-lər təmizlənir.
3. Brand detection (dictionary + regex).
4. Fingerprint yaradılır:
   - `brand|model|normalized_title`
5. Eyni fingerprint varsa, mövcud `products` row istifadə olunur.
6. Yeni fingerprintdirsə yeni canonical məhsul yaradılır.

## 3) Duplicate Avoidance

- `products.fingerprint` unique index
- `store_products (store_id, listing_key)` unique
- `product_aliases (store_id, fingerprint)` unique
- Human QA üçün low-confidence matchlər ayrıca loglana bilər.

## 4) Continuous Improvement

- İlk mərhələdə qayda əsaslı matching (rule-based)
- 5000+ listingdən sonra:
  - fuzzy similarity (`pg_trgm`)
  - brand/model parser
  - manual override UI (admin panel)

## 5) SEO-Safe Slug Strategy

- `products.slug`, `categories.slug`, `stores.slug` unikaldır.
- Slug canonical məhsul səviyyəsində verilir.
- Store listing URL dəyişsə belə canonical slug stabil qalır.
