import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "../../../components/Pagination";
import { getStoreBySlug } from "../../../lib/queries";
import { buildMetadata } from "../../../lib/seo";
import type { SearchSort } from "../../../lib/types";

export const revalidate = 180;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: SearchSort }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreBySlug({ slug, page: 1, limit: 1 });
  if (!data) {
    return buildMetadata({
      title: "Magaza tapilmadi",
      description: "Axtardiginiz magaza movcud deyil.",
      path: `/store/${slug}`
    });
  }

  return buildMetadata({
    title: `${data.store.name} mehsullari`,
    description: `${data.store.name} ucun en son qiymetler`,
    path: `/store/${slug}`
  });
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const page = Number(search.page ?? "1");
  const sort = (search.sort ?? "price_asc") as SearchSort;
  const data = await getStoreBySlug({ slug, page, limit: 24, sort });
  if (!data) notFound();

  return (
    <section>
      <h2>{data.store.name}</h2>
      <p className="muted">Son scrape: {data.store.last_scraped_at ?? "-"}</p>
      <p className="muted">Aktiv mehsul sayi: {data.total}</p>

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
            <p className="muted">Qiymet: {item.min_price_azn ?? "-"} AZN</p>
          </Link>
        ))}
      </div>

      <Pagination
        basePath={`/store/${slug}`}
        page={data.page}
        total={data.total}
        limit={data.limit}
        query={{ sort }}
      />
    </section>
  );
}
