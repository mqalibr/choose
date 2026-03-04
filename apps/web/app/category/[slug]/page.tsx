import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  const data = await getCategoryBySlug({ slug, page, limit: 24, sort });
  if (!data) notFound();

  return (
    <section>
      <h2>{data.category.name}</h2>
      <p className="muted">Məhsul sayı: {data.total}</p>

      <div className="grid">
        {data.items.map((item) => (
          <Link key={item.slug} href={`/product/${item.slug}`} className="card">
            <strong>{item.canonical_name}</strong>
            <p className="muted">Ən ucuz: {item.min_price_azn ?? "-"} AZN</p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Mağaza sayı: {item.offer_count}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
