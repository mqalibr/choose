import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "../../../components/Pagination";
import { getCategoryBySlug } from "../../../lib/queries";
import { buildMetadata } from "../../../lib/seo";
import type { SearchSort } from "../../../lib/types";

export const revalidate = 180;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: SearchSort; min_offers?: string; brand?: string; store?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryBySlug({ slug, page: 1, limit: 1 });
  if (!data) {
    return buildMetadata({
      title: "Kateqoriya tapılmadı",
      description: "Axtardığınız kateqoriya mövcud deyil.",
      path: `/category/${slug}`
    });
  }

  return buildMetadata({
    title: `${data.category.name} qiymət müqayisəsi`,
    description: `${data.category.name} üzrə mağazalararası ən ucuz qiymətlər`,
    path: `/category/${slug}`
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const page = Number(search.page ?? "1");
  const sort = (search.sort ?? "price_asc") as SearchSort;
  const minOffersRaw = Number(search.min_offers ?? "1");
  const minOffers = Number.isFinite(minOffersRaw) && minOffersRaw >= 2 ? 2 : 1;
  const brand = search.brand?.trim() || undefined;
  const store = search.store?.trim() || undefined;
  const data = await getCategoryBySlug({ slug, page, limit: 24, sort, minOffers, brand, store });
  if (!data) notFound();

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("min_offers", String(minOffers));

    if (data.selectedBrand) params.set("brand", data.selectedBrand);
    if (data.selectedStore) params.set("store", data.selectedStore);

    Object.entries(patch).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    return `/category/${slug}?${params.toString()}`;
  };

  return (
    <section>
      <h2>{data.category.name}</h2>
      <p className="muted">Məhsul sayı: {data.total}</p>

      <div className="filter-row">
        <span className="muted">Müqayisə filtri:</span>
        <Link
          href={buildHref({ min_offers: "1" })}
          className={minOffers === 1 ? "filter-chip is-active" : "filter-chip"}
        >
          Hamısı
        </Link>
        <Link
          href={buildHref({ min_offers: "2" })}
          className={minOffers === 2 ? "filter-chip is-active" : "filter-chip"}
        >
          Yalnız 2+ mağaza
        </Link>
      </div>

      {data.brands.length > 0 ? (
        <div className="filter-row">
          <span className="muted">Brend:</span>
          <Link
            href={buildHref({ brand: undefined })}
            className={!data.selectedBrand ? "filter-chip is-active" : "filter-chip"}
          >
            Hamısı
          </Link>
          {data.brands.map((brandItem) => (
            <Link
              key={brandItem.brand_slug}
              href={buildHref({ brand: brandItem.brand_slug })}
              className={data.selectedBrand === brandItem.brand_slug ? "filter-chip is-active" : "filter-chip"}
            >
              {brandItem.brand} ({brandItem.product_count})
            </Link>
          ))}
        </div>
      ) : null}

      {data.stores.length > 0 ? (
        <div className="filter-row">
          <span className="muted">Mağaza:</span>
          <Link
            href={buildHref({ store: undefined })}
            className={!data.selectedStore ? "filter-chip is-active" : "filter-chip"}
          >
            Hamısı
          </Link>
          {data.stores.map((storeItem) => (
            <Link
              key={storeItem.store_slug}
              href={buildHref({ store: storeItem.store_slug })}
              className={data.selectedStore === storeItem.store_slug ? "filter-chip is-active" : "filter-chip"}
            >
              {storeItem.store_name} ({storeItem.product_count})
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid">
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
        basePath={`/category/${slug}`}
        page={data.page}
        total={data.total}
        limit={data.limit}
        query={{
          sort,
          min_offers: String(minOffers),
          brand: data.selectedBrand ?? undefined,
          store: data.selectedStore ?? undefined
        }}
      />
    </section>
  );
}
