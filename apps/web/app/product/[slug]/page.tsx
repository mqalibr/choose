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
      title: "Mehsul tapilmadi",
      description: "Axtardiginiz mehsul movcud deyil.",
      path: `/product/${slug}`
    });
  }

  return buildMetadata({
    title: data.product.canonical_name,
    description: `${data.offers.length} magazada qiymet muqayisesi`,
    path: `/product/${slug}`
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();

  const jsonLd = buildProductJsonLd({
    name: data.product.canonical_name,
    description: `${data.offers.length} magazada qiymet muqayisesi`,
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

      {data.product.image_url ? (
        <img
          src={data.product.image_url}
          alt={data.product.canonical_name}
          className="product-hero-image"
          loading="eager"
          decoding="async"
        />
      ) : null}

      <h2 style={{ marginBottom: 8 }}>{data.product.canonical_name}</h2>
      <p className="muted">Son yenilenme: {data.lastUpdatedAt ?? "-"}</p>
      <p>
        En ucuz qiymet: <strong>{data.lowestPrice ?? "-"} AZN</strong>
      </p>

      <div className="grid">
        {data.offers.map((offer) => (
          <article key={offer.store_product_id} className="card">
            <strong>{offer.store_name}</strong>
            <p>Qiymet: {offer.current_price_azn} AZN</p>
            <p className="muted">Yenilenib: {offer.price_updated_at}</p>
            <a href={offer.product_url} target="_blank" rel="noreferrer">
              Magazaya kec
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
