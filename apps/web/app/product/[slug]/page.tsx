import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getProductBySlug } from "../../../lib/queries";
import { buildMetadata, buildProductJsonLd } from "../../../lib/seo";

export const revalidate = 180;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) {
    return buildMetadata({
      title: "Məhsul tapılmadı",
      description: "Axtardığınız məhsul mövcud deyil.",
      path: `/product/${slug}`
    });
  }

  return buildMetadata({
    title: data.product.canonical_name,
    description: `${data.offers.length} mağazada qiymət müqayisəsi`,
    path: `/product/${slug}`
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();

  const jsonLd = buildProductJsonLd({
    name: data.product.canonical_name,
    description: `${data.offers.length} mağazada qiymət müqayisəsi`,
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"}/product/${slug}`,
    image: data.product.image_url,
    lowPrice: data.lowestPrice,
    offerCount: data.offers.length
  });

  return (
    <section>
      <Script id="product-jsonld" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>

      <h2 style={{ marginBottom: 8 }}>{data.product.canonical_name}</h2>
      <p className="muted">Son yenilənmə: {data.lastUpdatedAt ?? "-"}</p>
      <p>
        Ən ucuz qiymət: <strong>{data.lowestPrice ?? "-"} AZN</strong>
      </p>

      <div className="grid">
        {data.offers.map((offer) => (
          <article key={offer.store_product_id} className="card">
            <strong>{offer.store_name}</strong>
            <p>Qiymət: {offer.current_price_azn} AZN</p>
            <p className="muted">Yenilənib: {offer.price_updated_at}</p>
            <a href={offer.product_url} target="_blank" rel="noreferrer">
              Mağazaya keç
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
