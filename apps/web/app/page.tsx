import Link from "next/link";
import { searchProducts } from "../lib/queries";
import { buildMetadata } from "../lib/seo";
import { getSupabaseServerClient } from "../lib/supabase";

export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Ana səhifə",
  description: "Elektronika məhsullarında ən ucuz qiymətləri müqayisə edin.",
  path: "/"
});

function formatUpdatedAt(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default async function HomePage() {
  const supabase = getSupabaseServerClient();

  const [{ data: categories }, latest] = await Promise.all([
    supabase
      .from("categories")
      .select("name,slug")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("name")
      .limit(8),
    searchProducts({ page: 1, limit: 24, sort: "updated_desc", minOffers: 1 })
  ]);

  return (
    <section className="home-page">
      <article className="home-hero card">
        <p className="home-eyebrow">Ağıllı qiymət müqayisəsi platforması</p>
        <h2 className="home-title">Aldığın məhsulu bazardakı real qiymətlərlə müqayisə et</h2>
        <p className="muted home-copy">
          Telefon, planşet, noutbuk və digər elektronikalar üçün mağazalararası ən son qiymətləri bir ekranda gör.
        </p>

        <div className="home-actions">
          <Link href="/search" className="home-primary-btn">
            Məhsul axtar
          </Link>
          <Link href="/search?sort=updated_desc" className="home-secondary-btn">
            Son yenilənənlər
          </Link>
        </div>

        {(categories ?? []).length > 0 ? (
          <div className="home-category-pills" aria-label="Populyar kateqoriyalar">
            {(categories ?? []).map((category) => (
              <Link key={category.slug} href={`/category/${category.slug}`} className="home-category-pill">
                {category.name}
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      <div className="home-section-head">
        <h3 className="home-section-title">Son yenilənən məhsullar</h3>
        <Link href="/search?sort=updated_desc" className="home-section-link">
          Hamısına bax
        </Link>
      </div>

      {latest.items.length ? (
        <div className="catalog-grid">
          {latest.items.map((item) => (
            <Link key={item.slug} href={`/product/${item.slug}`} className="card product-card-modern">
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
              <p className="muted">Mağaza sayı: {item.offer_count}</p>
              <p className="muted" style={{ marginBottom: 0 }}>
                Son yenilənmə: {formatUpdatedAt(item.last_price_at)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Hələ məhsul görünmür. Scrape bitdikdən sonra bu bölmədə ən son yenilənən məhsullar göstəriləcək.
          </p>
        </article>
      )}
    </section>
  );
}
