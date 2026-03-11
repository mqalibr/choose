import Link from "next/link";
import { Pagination } from "../../components/Pagination";
import { searchProducts } from "../../lib/queries";
import { buildMetadata } from "../../lib/seo";
import type { SearchSort } from "../../lib/types";

export const revalidate = 120;

export const metadata = buildMetadata({
  title: "Axtarış",
  description: "Elektronika məhsullarını mağazalar üzrə qiymətə görə müqayisə edin.",
  path: "/search"
});

interface Props {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: SearchSort;
    min_offers?: string;
    brand?: string;
  }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Number(params.page ?? "1");
  const sort = (params.sort ?? "relevance") as SearchSort;
  const minOffersRaw = Number(params.min_offers ?? "1");
  const minOffers = Number.isFinite(minOffersRaw) && minOffersRaw >= 2 ? 2 : 1;
  const brand = params.brand?.trim() || undefined;
  const data = await searchProducts({ q, page, limit: 24, sort, minOffers, brand });

  return (
    <section>
      <h2>Axtarış nəticələri</h2>
      <p className="muted">
        Sorğu: <strong>{q || "hamısı"}</strong> | Tapıldı: {data.total}
      </p>

      <div className="filter-row">
        <span className="muted">Müqayisə filtri:</span>
        <Link
          href={`/search?q=${encodeURIComponent(q)}&sort=${sort}&min_offers=1${brand ? `&brand=${brand}` : ""}`}
          className={minOffers === 1 ? "filter-chip is-active" : "filter-chip"}
        >
          Hamısı
        </Link>
        <Link
          href={`/search?q=${encodeURIComponent(q)}&sort=${sort}&min_offers=2${brand ? `&brand=${brand}` : ""}`}
          className={minOffers === 2 ? "filter-chip is-active" : "filter-chip"}
        >
          Yalnız 2+ mağaza
        </Link>
      </div>

      <div className="catalog-grid">
        {data.items.map((item) => (
          <Link key={item.slug} href={`/product/${item.slug}`} className="card">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.canonical_name}
                className="card-image"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="card-image card-image-empty">Şəkil yoxdur</div>
            )}
            <strong>{item.canonical_name}</strong>
            <p className="muted">Ən ucuz: {item.min_price_azn ?? "-"} AZN</p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Mağaza sayı: {item.offer_count}
            </p>
          </Link>
        ))}
      </div>

      <Pagination
        basePath="/search"
        page={data.page}
        total={data.total}
        limit={data.limit}
        query={{ q: q || undefined, sort, min_offers: String(minOffers), brand }}
      />
    </section>
  );
}
