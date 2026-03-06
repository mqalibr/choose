import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@azcompare/shared";
import { getSupabaseServerClient } from "./supabase";
import type {
  CategoryBrandFacet,
  CategoryStoreFacet,
  ProductOffer,
  ProductPhoneSpecs,
  ProductRow,
  SearchProduct,
  SearchSort,
  StoreProductListItem,
  StoreRow
} from "./types";

interface QueryErrorLike {
  code?: string;
  message?: string;
}

const SEARCH_SORT: Record<SearchSort, { column: string; asc: boolean }> = {
  relevance: { column: "last_price_at", asc: false },
  price_asc: { column: "min_price_azn", asc: true },
  price_desc: { column: "min_price_azn", asc: false },
  updated_desc: { column: "last_price_at", asc: false }
};

const STORE_SORT: Record<SearchSort, { column: string; asc: boolean }> = {
  relevance: { column: "price_updated_at", asc: false },
  price_asc: { column: "min_price_azn", asc: true },
  price_desc: { column: "min_price_azn", asc: false },
  updated_desc: { column: "price_updated_at", asc: false }
};

function dedupeOffersByStore(offers: ProductOffer[]): ProductOffer[] {
  const byStore = new Map<number, ProductOffer>();

  for (const offer of offers) {
    const existing = byStore.get(offer.store_id);
    if (!existing) {
      byStore.set(offer.store_id, offer);
      continue;
    }

    const existingPrice = Number(existing.current_price_azn);
    const nextPrice = Number(offer.current_price_azn);
    if (nextPrice < existingPrice) {
      byStore.set(offer.store_id, offer);
      continue;
    }

    if (nextPrice === existingPrice) {
      const existingTs = new Date(existing.price_updated_at).getTime();
      const nextTs = new Date(offer.price_updated_at).getTime();
      if (nextTs > existingTs) {
        byStore.set(offer.store_id, offer);
      }
    }
  }

  return [...byStore.values()].sort((a, b) => Number(a.current_price_azn) - Number(b.current_price_azn));
}

function clampPageSize(limit?: number): number {
  if (!limit) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
}

function clampMinOffers(minOffers?: number): number {
  if (!minOffers) return 1;
  return Math.max(1, Math.min(minOffers, 10));
}

function normalizeBrandSlug(brand?: string): string | undefined {
  if (!brand?.trim()) return undefined;
  const normalized = brand
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || undefined;
}

function normalizeStoreSlug(store?: string): string | undefined {
  if (!store?.trim()) return undefined;
  return store.trim().toLowerCase();
}

function isMissingRelationError(error: QueryErrorLike | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache");
}

async function getCategoryStoreFacetsFallback(input: {
  supabase: ReturnType<typeof getSupabaseServerClient>;
  categoryId: number;
  selectedStore?: string;
}) {
  const { supabase, categoryId, selectedStore } = input;
  const { data: productRows, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", categoryId)
    .eq("is_active", true);

  if (productError) throw productError;

  const productIds = (productRows ?? []).map((row) => row.id);
  if (productIds.length === 0) {
    return {
      stores: [] as CategoryStoreFacet[],
      scopedProductIds: selectedStore ? [] : null
    };
  }

  const { data: offers, error: offersError } = await supabase
    .from("v_product_offers")
    .select("product_id,store_slug,store_name")
    .in("product_id", productIds);

  if (offersError) throw offersError;

  const storeMap = new Map<string, { storeName: string; productIds: Set<number> }>();

  for (const row of offers ?? []) {
    const slug = row.store_slug as string;
    if (!storeMap.has(slug)) {
      storeMap.set(slug, {
        storeName: row.store_name as string,
        productIds: new Set<number>()
      });
    }
    storeMap.get(slug)?.productIds.add(row.product_id as number);
  }

  const stores = [...storeMap.entries()]
    .map(([storeSlug, value]) => ({
      category_id: categoryId,
      store_slug: storeSlug,
      store_name: value.storeName,
      product_count: value.productIds.size
    }))
    .sort((a, b) => {
      if (b.product_count !== a.product_count) return b.product_count - a.product_count;
      return a.store_name.localeCompare(b.store_name, "az");
    });

  return {
    stores,
    scopedProductIds: selectedStore ? [...(storeMap.get(selectedStore)?.productIds ?? [])] : null
  };
}

async function getCategoryStoreFacetsAndScope(input: {
  supabase: ReturnType<typeof getSupabaseServerClient>;
  categoryId: number;
  selectedStore?: string;
}) {
  const { supabase, categoryId, selectedStore } = input;

  const { data: storesFromView, error: storesError } = await supabase
    .from("v_category_store_facets")
    .select("category_id,store_slug,store_name,product_count")
    .eq("category_id", categoryId)
    .order("product_count", { ascending: false })
    .limit(30)
    .returns<CategoryStoreFacet[]>();

  if (storesError && !isMissingRelationError(storesError)) {
    throw storesError;
  }

  if (storesError && isMissingRelationError(storesError)) {
    return getCategoryStoreFacetsFallback({ supabase, categoryId, selectedStore });
  }

  if (!selectedStore) {
    return { stores: storesFromView ?? [], scopedProductIds: null as number[] | null };
  }

  const { data: scopedProducts, error: scopedProductsError } = await supabase
    .from("v_category_store_products")
    .select("product_id")
    .eq("category_id", categoryId)
    .eq("store_slug", selectedStore);

  if (scopedProductsError && !isMissingRelationError(scopedProductsError)) {
    throw scopedProductsError;
  }

  if (scopedProductsError && isMissingRelationError(scopedProductsError)) {
    return getCategoryStoreFacetsFallback({ supabase, categoryId, selectedStore });
  }

  return {
    stores: storesFromView ?? [],
    scopedProductIds: [...new Set((scopedProducts ?? []).map((row) => row.product_id as number))]
  };
}

export async function searchProducts(input: {
  q?: string;
  page?: number;
  limit?: number;
  sort?: SearchSort;
  minOffers?: number;
  brand?: string;
}) {
  const supabase = getSupabaseServerClient();
  const page = Math.max(1, input.page ?? 1);
  const limit = clampPageSize(input.limit);
  const minOffers = clampMinOffers(input.minOffers);
  const brandSlug = normalizeBrandSlug(input.brand);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const sort = input.sort ?? "relevance";
  const sortConfig = SEARCH_SORT[sort];

  let query = supabase
    .from("v_product_search")
    .select("*", { count: "exact" })
    .gte("offer_count", minOffers)
    .range(from, to)
    .order(sortConfig.column, { ascending: sortConfig.asc });

  if (input.q?.trim()) {
    query = query.ilike("search_text", `%${input.q.trim()}%`);
  }
  if (brandSlug) {
    query = query.eq("brand_slug", brandSlug);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    page,
    limit,
    total: count ?? 0,
    items: (data ?? []) as SearchProduct[]
  };
}

export async function getProductBySlug(slug: string) {
  const supabase = getSupabaseServerClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) return null;

  const { data: offers, error: offerError } = await supabase
    .from("v_product_offers")
    .select("*")
    .eq("product_id", product.id)
    .order("current_price_azn", { ascending: true })
    .returns<ProductOffer[]>();

  if (offerError) throw offerError;
  const dedupedOffers = dedupeOffersByStore(offers ?? []);

  const { data: phoneSpecs, error: phoneSpecsError } = await supabase
    .from("phone_specs")
    .select(
      "product_id,battery_mah,has_nfc,ram_gb,storage_gb,chipset_vendor,chipset_model,cpu_cores,gpu_model,os_name,os_version,sim_count,has_esim,has_wifi_6,bluetooth_version,main_camera_mp,ultrawide_camera_mp,telephoto_camera_mp,selfie_camera_mp,has_ois,has_wireless_charge,wired_charge_w,wireless_charge_w,has_5g,screen_size_in,refresh_rate_hz,panel_type,resolution_width,resolution_height,weight_g,ip_rating,release_year,last_parsed_at,raw_specs"
    )
    .eq("product_id", product.id)
    .maybeSingle()
    .returns<ProductPhoneSpecs | null>();

  if (phoneSpecsError) throw phoneSpecsError;

  return {
    product: product as ProductRow,
    offers: dedupedOffers,
    phoneSpecs: phoneSpecs ?? null,
    lowestPrice: dedupedOffers[0]?.current_price_azn ?? null,
    lastUpdatedAt: product.last_price_at
  };
}

export async function getCategoryBySlug(input: {
  slug: string;
  page?: number;
  limit?: number;
  sort?: SearchSort;
  minOffers?: number;
  brand?: string;
  store?: string;
}) {
  const supabase = getSupabaseServerClient();
  const page = Math.max(1, input.page ?? 1);
  const limit = clampPageSize(input.limit);
  const minOffers = clampMinOffers(input.minOffers);
  const brandSlug = normalizeBrandSlug(input.brand);
  const storeSlug = normalizeStoreSlug(input.store);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const sort = input.sort ?? "price_asc";
  const sortConfig = SEARCH_SORT[sort];

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,name,slug,path")
    .eq("slug", input.slug)
    .maybeSingle();

  if (categoryError) throw categoryError;
  if (!category) return null;

  const { data: brands, error: brandsError } = await supabase
    .from("v_category_brand_facets")
    .select("category_id,brand,brand_slug,product_count")
    .eq("category_id", category.id)
    .order("product_count", { ascending: false })
    .limit(30)
    .returns<CategoryBrandFacet[]>();

  if (brandsError) throw brandsError;

  const { stores, scopedProductIds } = await getCategoryStoreFacetsAndScope({
    supabase,
    categoryId: category.id,
    selectedStore: storeSlug
  });

  let itemsQuery = supabase
    .from("v_category_products")
    .select("*", { count: "exact" })
    .eq("category_id", category.id)
    .gte("offer_count", minOffers)
    .range(from, to)
    .order(sortConfig.column, { ascending: sortConfig.asc });

  if (brandSlug) {
    itemsQuery = itemsQuery.eq("brand_slug", brandSlug);
  }

  if (storeSlug && scopedProductIds) {
    if (scopedProductIds.length === 0) {
      return {
        category,
        page,
        limit,
        total: 0,
        items: [],
        brands: brands ?? [],
        stores: stores ?? [],
        selectedBrand: brandSlug ?? null,
        selectedStore: storeSlug
      };
    }
    itemsQuery = itemsQuery.in("id", scopedProductIds);
  }

  const { data: items, error: itemsError, count } = await itemsQuery.returns<SearchProduct[]>();

  if (itemsError) throw itemsError;

  return {
    category,
    page,
    limit,
    total: count ?? 0,
    items: items ?? [],
    brands: brands ?? [],
    stores: stores ?? [],
    selectedBrand: brandSlug ?? null,
    selectedStore: storeSlug ?? null
  };
}

export async function getStoreBySlug(input: {
  slug: string;
  page?: number;
  limit?: number;
  sort?: SearchSort;
}) {
  const supabase = getSupabaseServerClient();
  const page = Math.max(1, input.page ?? 1);
  const limit = clampPageSize(input.limit);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const sort = input.sort ?? "price_asc";
  const sortConfig = STORE_SORT[sort];

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", input.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (storeError) throw storeError;
  if (!store) return null;

  const { data: items, error: itemError, count } = await supabase
    .from("v_store_products")
    .select("*", { count: "exact" })
    .eq("store_slug", input.slug)
    .range(from, to)
    .order(sortConfig.column, { ascending: sortConfig.asc })
    .returns<StoreProductListItem[]>();

  if (itemError) throw itemError;

  return {
    store: store as StoreRow,
    page,
    limit,
    total: count ?? 0,
    items: items ?? []
  };
}
