import type { Metadata } from "next";

const SITE_NAME = "QiymətRadar";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

export function buildMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_URL}${input.path}`;
  return {
    title: `${input.title} | ${SITE_NAME}`,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description
    }
  };
}

export function buildProductJsonLd(input: {
  name: string;
  description: string;
  url: string;
  image?: string | null;
  lowPrice?: number | null;
  currency?: string;
  offerCount?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: input.image ?? undefined,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: input.lowPrice ?? undefined,
      priceCurrency: input.currency ?? "AZN",
      offerCount: input.offerCount ?? 0
    },
    url: input.url
  };
}
