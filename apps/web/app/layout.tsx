import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Sora } from "next/font/google";
import { CatalogDropdown } from "../components/header/CatalogDropdown";
import { getSupabaseServerClient } from "../lib/supabase";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading"
});

const CATALOG_ELECTRONICS_SLUGS = ["noutbuklar", "plansetler", "qulaqliqlar", "telefonlar", "televizorlar"] as const;

const CATALOG_ELECTRONICS_FALLBACK: Array<{ slug: string; name: string }> = [
  { slug: "noutbuklar", name: "Noutbuklar" },
  { slug: "plansetler", name: "Planşetlər" },
  { slug: "qulaqliqlar", name: "Qulaqlıqlar" },
  { slug: "telefonlar", name: "Telefonlar" },
  { slug: "televizorlar", name: "Televizorlar" }
];

export const metadata: Metadata = {
  title: "QiymətRadar - Azərbaycan Elektronika Qiymət Müqayisəsi",
  description: "Telefon, noutbuk, TV və digər elektronika üçün mağazalararası qiymət müqayisəsi.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com")
};

export const revalidate = 300;

async function getCatalogElectronicsCategories() {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("categories")
      .select("name,slug")
      .in("slug", [...CATALOG_ELECTRONICS_SLUGS])
      .eq("is_active", true);

    if (data && data.length) {
      const map = new Map(data.map((item) => [item.slug, item]));
      const ordered = CATALOG_ELECTRONICS_SLUGS
        .map((slug) => map.get(slug))
        .filter((item): item is { slug: string; name: string } => Boolean(item));
      if (ordered.length) return ordered;
    }
  } catch {
    // fallback below
  }

  return CATALOG_ELECTRONICS_FALLBACK;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const catalogElectronics = await getCatalogElectronicsCategories();

  return (
    <html lang="az">
      <body className={`${manrope.variable} ${sora.variable}`}>
        <div className="site-shell">
          <header className="site-header">
            <div className="top-nav">
              <div className="top-nav-left">
                <Link href="/" className="brand-link">
                  <span className="brand-title">qiymətradar</span>
                </Link>

                <CatalogDropdown categories={catalogElectronics} />
              </div>

              <form action="/search" method="get" className="header-search" role="search">
                <input
                  type="search"
                  name="q"
                  placeholder="Əşya və ya məhsul axtarışı"
                  className="header-search-input"
                  aria-label="Məhsul axtarışı"
                />
                <button type="submit" className="header-search-btn">
                  Axtar
                </button>
              </form>

              <div className="top-nav-actions">
                <Link href="/search?sort=updated_desc" className="top-icon-btn" aria-label="Sevimlilər">
                  {"♡"}
                </Link>
                <Link href="/search" className="top-login-btn">
                  Giriş
                </Link>
              </div>
            </div>
          </header>

          <main className="page-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
