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
  searchParams: Promise<{ page?: string; sort?: SearchSort }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryBySlug({ slug, page: 1, limit: 1 });
  if (!data) {
    return buildMetadata({
      title: "Kateqoriya tapilmadi",
      description: "Axtardiginiz kateqoriya movcud deyil.",
      path: `/category/${slug}`
    });
  }

  return buildMetadata({
    title: `${data.category.name} qiymet muqayisesi`,
    description: `${data.category.name} uzre magazalararasi en ucuz qiymetler`,
    path: `/category/${slug}`
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const page = Number(search.page ?? "1");
  const sort = (search.sort ?? "price_asc") as SearchSort;
  const data = await getCategoryBySlug({ slug, page, limit: 24, sort });
  if (!data) notFound();

  return (
    <section>
      <h2>{data.category.name}</h2>
      <p className="muted">Mehsul sayi: {data.total}</p>

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
              <div className="card-image card-image-empty">Sekil yoxdur</div>
            )}
            <strong>{item.canonical_name}</strong>
            <p className="muted">En ucuz: {item.min_price_azn ?? "-"} AZN</p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Magaza sayi: {item.offer_count}
            </p>
          </Link>
        ))}
      </div>

      <Pagination
        basePath={`/category/${slug}`}
        page={data.page}
        total={data.total}
        limit={data.limit}
        query={{ sort }}
      />
    </section>
  );
}
