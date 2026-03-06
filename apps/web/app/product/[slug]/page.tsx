import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { ProductPage as ProductPageView } from "../../../components/product/ProductPage";
import { demoProduct } from "../../../components/product/demoProduct";
import type { ProductPreview } from "../../../components/product/types";
import { getProductBySlug } from "../../../lib/queries";
import { buildMetadata, buildProductJsonLd } from "../../../lib/seo";

export const revalidate = 180;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "demo-product") {
    return buildMetadata({
      title: demoProduct.name,
      description: `${demoProduct.offers.length} mağazada qiymət müqayisəsi (demo)`,
      path: `/product/${slug}`
    });
  }

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
  const isDemoRoute = slug === "demo-product";

  if (!data && !isDemoRoute) notFound();

  const previewProduct: ProductPreview = data
    ? {
        name: data.product.canonical_name,
        images: data.product.image_url ? [data.product.image_url, ...demoProduct.images.slice(0, 2)] : demoProduct.images,
        offers: data.offers.map((offer) => ({
          store_name: offer.store_name,
          price: Number(offer.current_price_azn),
          stock: offer.in_stock ? "Stokda var" : "Stokda yoxdur",
          link: offer.product_url
        })),
        price_history: demoProduct.price_history,
        similar_products: demoProduct.similar_products,
        last_updated_at: data.lastUpdatedAt,
        specs: data.phoneSpecs
      }
    : demoProduct;

  const jsonLd = buildProductJsonLd({
    name: previewProduct.name,
    description: `${previewProduct.offers.length} mağazada qiymət müqayisəsi`,
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"}/product/${slug}`,
    image: previewProduct.images[0] ?? null,
    lowPrice: previewProduct.offers.length ? Math.min(...previewProduct.offers.map((offer) => offer.price)) : null,
    offerCount: previewProduct.offers.length
  });

  return (
    <section>
      <Script id="product-jsonld" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
      <ProductPageView product={previewProduct} />
    </section>
  );
}
