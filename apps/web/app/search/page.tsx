import Link from "next/link";
import { Pagination } from "../../components/Pagination";
import { searchProducts } from "../../lib/queries";
import { buildMetadata } from "../../lib/seo";
import type { SearchSort } from "../../lib/types";

export const revalidate = 120;

export const metadata = buildMetadata({
  title: "Axtaris",
  description: "Elektronika mehsullarini magazalar uzre qiymete gore muqayise edin.",
  path: "/search"
});

interface Props {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: SearchSort;
  }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Number(params.page ?? "1");
  const sort = (params.sort ?? "relevance") as SearchSort;
  const data = await searchProducts({ q, page, limit: 24, sort });

  return (
    <section>
      <h2>Axtaris Neticeleri</h2>
      <p className="muted">
        Sorgu: <strong>{q || "hamisi"}</strong> | Tapildi: {data.total}
      </p>

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
        basePath="/search"
        page={data.page}
        total={data.total}
        limit={data.limit}
        query={{ q: q || undefined, sort }}
      />
    </section>
  );
}
