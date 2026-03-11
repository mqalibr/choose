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
  searchParams: Promise<{
    page?: string;
    sort?: SearchSort;
    min_offers?: string;
    brand?: string;
    store?: string;
    min_price?: string;
    max_price?: string;
    view?: string;
  }>;
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

const SORT_OPTIONS: Array<{ value: SearchSort; label: string }> = [
  { value: "updated_desc", label: "Yenilər əvvəlcə" },
  { value: "price_asc", label: "Ucuzdan bahaya" },
  { value: "price_desc", label: "Bahadan ucuza" },
  { value: "relevance", label: "Uyğunluq" }
];

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const page = Number(search.page ?? "1");
  const sort = (search.sort ?? "updated_desc") as SearchSort;
  const minOffersRaw = Number(search.min_offers ?? "1");
  const minOffers = Number.isFinite(minOffersRaw) && minOffersRaw >= 2 ? 2 : 1;
  const brand = search.brand?.trim() || undefined;
  const store = search.store?.trim() || undefined;
  const view = search.view === "list" ? "list" : "grid";

  const minPriceRaw = search.min_price ? Number(search.min_price) : Number.NaN;
  const maxPriceRaw = search.max_price ? Number(search.max_price) : Number.NaN;
  const minPrice = Number.isFinite(minPriceRaw) && minPriceRaw >= 0 ? minPriceRaw : undefined;
  const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw >= 0 ? maxPriceRaw : undefined;

  const data = await getCategoryBySlug({
    slug,
    page,
    limit: 24,
    sort,
    minOffers,
    brand,
    store,
    minPrice,
    maxPrice
  });

  if (!data) notFound();

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("min_offers", String(minOffers));

    if (data.selectedBrand) params.set("brand", data.selectedBrand);
    if (data.selectedStore) params.set("store", data.selectedStore);
    if (minPrice !== undefined) params.set("min_price", String(minPrice));
    if (maxPrice !== undefined) params.set("max_price", String(maxPrice));
    params.set("view", view);

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
    <section className="category-page">
      <h2>{data.category.name}</h2>
      <p className="muted">Məhsul sayı: {data.total}</p>

      <div className="category-layout">
        <aside className="card category-sidebar">
          <div className="sidebar-group">
            <h3 className="sidebar-title">Müqayisə filtri</h3>
            <div className="sidebar-options">
              <Link
                href={buildHref({ min_offers: "1" })}
                className={minOffers === 1 ? "sidebar-option is-active" : "sidebar-option"}
              >
                Hamısı
              </Link>
              <Link
                href={buildHref({ min_offers: "2" })}
                className={minOffers === 2 ? "sidebar-option is-active" : "sidebar-option"}
              >
                Yalnız 2+ mağaza
              </Link>
            </div>
          </div>

          <div className="sidebar-group">
            <h3 className="sidebar-title">Qiymət aralığı</h3>
            <form action={`/category/${slug}`} method="get" className="sidebar-price-form">
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="min_offers" value={String(minOffers)} />
              {data.selectedBrand ? <input type="hidden" name="brand" value={data.selectedBrand} /> : null}
              {data.selectedStore ? <input type="hidden" name="store" value={data.selectedStore} /> : null}

              <div className="sidebar-price-inputs">
                <input
                  type="number"
                  name="min_price"
                  min={0}
                  defaultValue={minPrice ?? ""}
                  placeholder="Min"
                  className="sidebar-price-input"
                />
                <input
                  type="number"
                  name="max_price"
                  min={0}
                  defaultValue={maxPrice ?? ""}
                  placeholder="Maks"
                  className="sidebar-price-input"
                />
              </div>

              <div className="sidebar-price-actions">
                <button type="submit" className="sidebar-apply-btn">
                  Tətbiq et
                </button>
                {minPrice !== undefined || maxPrice !== undefined ? (
                  <Link href={buildHref({ min_price: undefined, max_price: undefined })} className="sidebar-reset-link">
                    Sıfırla
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          {data.brands.length > 0 ? (
            <div className="sidebar-group">
              <h3 className="sidebar-title">Brend</h3>
              <div className="sidebar-options">
                <Link
                  href={buildHref({ brand: undefined })}
                  className={!data.selectedBrand ? "sidebar-option is-active" : "sidebar-option"}
                >
                  Hamısı
                </Link>
                {data.brands.map((brandItem) => (
                  <Link
                    key={brandItem.brand_slug}
                    href={buildHref({ brand: brandItem.brand_slug })}
                    className={data.selectedBrand === brandItem.brand_slug ? "sidebar-option is-active" : "sidebar-option"}
                  >
                    {brandItem.brand} ({brandItem.product_count})
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {data.stores.length > 0 ? (
            <div className="sidebar-group">
              <h3 className="sidebar-title">Mağaza</h3>
              <div className="sidebar-options">
                <Link
                  href={buildHref({ store: undefined })}
                  className={!data.selectedStore ? "sidebar-option is-active" : "sidebar-option"}
                >
                  Hamısı
                </Link>
                {data.stores.map((storeItem) => (
                  <Link
                    key={storeItem.store_slug}
                    href={buildHref({ store: storeItem.store_slug })}
                    className={data.selectedStore === storeItem.store_slug ? "sidebar-option is-active" : "sidebar-option"}
                  >
                    {storeItem.store_name} ({storeItem.product_count})
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="category-content">
          <div className="card category-toolbar">
            <div className="category-toolbar-row">
              <form action={`/category/${slug}`} method="get" className="category-sort-form">
                <label htmlFor="sort" className="muted">
                  Sıralama:
                </label>
                <select id="sort" name="sort" className="category-sort-select" defaultValue={sort}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="min_offers" value={String(minOffers)} />
                {data.selectedBrand ? <input type="hidden" name="brand" value={data.selectedBrand} /> : null}
                {data.selectedStore ? <input type="hidden" name="store" value={data.selectedStore} /> : null}
                {minPrice !== undefined ? <input type="hidden" name="min_price" value={String(minPrice)} /> : null}
                {maxPrice !== undefined ? <input type="hidden" name="max_price" value={String(maxPrice)} /> : null}

                <button type="submit" className="sidebar-apply-btn">
                  Tətbiq et
                </button>
              </form>

              <div className="view-toggle" aria-label="Görünüş seçimi">
                <Link href={buildHref({ view: "grid" })} className={view === "grid" ? "view-btn is-active" : "view-btn"}>
                  Grid
                </Link>
                <Link href={buildHref({ view: "list" })} className={view === "list" ? "view-btn is-active" : "view-btn"}>
                  List
                </Link>
              </div>
            </div>
          </div>

          {data.items.length ? (
            view === "list" ? (
              <div className="category-list">
                {data.items.map((item) => (
                  <article key={item.slug} className="card category-list-item">
                    <Link href={`/product/${item.slug}`} className="category-list-image-wrap">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.canonical_name}
                          className="category-list-image"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="category-list-image category-list-image-empty">Şəkil yoxdur</div>
                      )}
                    </Link>

                    <div className="category-list-main">
                      <Link href={`/product/${item.slug}`} className="category-list-title">
                        {item.canonical_name}
                      </Link>
                      <p className="muted category-list-subtitle">Ən ucuz: {item.min_price_azn ?? "-"} AZN</p>

                      <div className="category-list-offers">
                        {(item.top_offers ?? []).map((offer) => (
                          <div key={`${item.slug}-${offer.store_slug}`} className="category-list-offer">
                            <p className="category-list-store">{offer.store_name}</p>
                            <p className="category-list-price">{offer.price_azn} AZN</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="category-list-side">
                      <p className="muted">Mağaza sayı: {item.offer_count}</p>
                      <Link href={`/product/${item.slug}`} className="category-list-action">
                        {item.offer_count > (item.top_offers?.length ?? 0) ? "Bütün mağazalarda" : "Məhsula bax"}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
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
            )
          ) : (
            <article className="card">
              <p className="muted" style={{ margin: 0 }}>
                Seçilmiş filterlərə uyğun məhsul tapılmadı.
              </p>
            </article>
          )}

          <Pagination
            basePath={`/category/${slug}`}
            page={data.page}
            total={data.total}
            limit={data.limit}
            query={{
              sort,
              min_offers: String(minOffers),
              brand: data.selectedBrand ?? undefined,
              store: data.selectedStore ?? undefined,
              min_price: minPrice !== undefined ? String(minPrice) : undefined,
              max_price: maxPrice !== undefined ? String(maxPrice) : undefined,
              view
            }}
          />
        </div>
      </div>
    </section>
  );
}
