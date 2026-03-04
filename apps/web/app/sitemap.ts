import type { MetadataRoute } from "next";
import { getSupabaseServerClient } from "../lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseServerClient();
  const [products, categories, stores] = await Promise.all([
    supabase.from("products").select("slug,updated_at").eq("is_active", true).limit(5000),
    supabase.from("categories").select("slug,updated_at").eq("is_active", true).limit(500),
    supabase.from("stores").select("slug,updated_at").eq("is_active", true).limit(200)
  ]);

  const core: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.8 }
  ];

  const productUrls =
    products.data?.map((item) => ({
      url: `${SITE_URL}/product/${item.slug}`,
      lastModified: item.updated_at ?? undefined,
      changeFrequency: "hourly" as const,
      priority: 0.9
    })) ?? [];

  const categoryUrls =
    categories.data?.map((item) => ({
      url: `${SITE_URL}/category/${item.slug}`,
      lastModified: item.updated_at ?? undefined,
      changeFrequency: "daily" as const,
      priority: 0.8
    })) ?? [];

  const storeUrls =
    stores.data?.map((item) => ({
      url: `${SITE_URL}/store/${item.slug}`,
      lastModified: item.updated_at ?? undefined,
      changeFrequency: "daily" as const,
      priority: 0.7
    })) ?? [];

  return [...core, ...productUrls, ...categoryUrls, ...storeUrls];
}
