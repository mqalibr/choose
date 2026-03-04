import Link from "next/link";
import { buildMetadata } from "../../lib/seo";
import { searchProducts } from "../../lib/queries";
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
      <h2>Axtarış Nəticələri</h2>
      <p className="muted">
        Sorğu: <strong>{q || "hamısı"}</strong> | Tapıldı: {data.total}
      </p>

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

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        {page > 1 && (
          <Link href={`/search?q=${encodeURIComponent(q)}&page=${page - 1}&sort=${sort}`}>
            Geri
          </Link>
        )}
        {data.page * data.limit < data.total && (
          <Link href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}&sort=${sort}`}>
            İrəli
          </Link>
        )}
      </div>
    </section>
  );
}
