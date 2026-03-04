import Link from "next/link";
import { buildMetadata } from "../lib/seo";
import { getSupabaseServerClient } from "../lib/supabase";

export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Ana Səhifə",
  description: "Elektronika məhsullarında ən ucuz qiymətləri müqayisə edin.",
  path: "/"
});

export default async function HomePage() {
  const supabase = getSupabaseServerClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("name,slug")
    .is("parent_id", null)
    .order("name")
    .limit(8);

  return (
    <section>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Axtarış</h2>
        <p className="muted">Məhsul adı ilə axtarın: iPhone 15, RTX 4070, MacBook Air M3...</p>
        <Link href="/search">Axtarış səhifəsinə keç</Link>
      </div>

      <h3>Populyar Kateqoriyalar</h3>
      <div className="grid">
        {(categories ?? []).map((category) => (
          <Link key={category.slug} href={`/category/${category.slug}`} className="card">
            <strong>{category.name}</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              Kateqoriyaya bax
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
