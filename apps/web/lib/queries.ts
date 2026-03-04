import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@azcompare/shared";
import { getSupabaseServerClient } from "./supabase";
import type {
  ProductOffer,
  ProductRow,
  SearchProduct,
  SearchSort,
  StoreProductListItem,
  StoreRow
} from "./types";

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

function clampPageSize(limit?: number): number {
  if (!limit) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
}

export async function searchProducts(input: {
  q?: string;
  page?: number;
  limit?: number;
  sort?: SearchSort;
}) {
  const supabase = getSupabaseServerClient();
  const page = Math.max(1, input.page ?? 1);
  const limit = clampPageSize(input.limit);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const sort = input.sort ?? "relevance";
  const sortConfig = SEARCH_SORT[sort];

  let query = supabase
    .from("v_product_search")
    .select("*", { count: "exact" })
    .range(from, to)
    .order(sortConfig.column, { ascending: sortConfig.asc });

  if (input.q?.trim()) {
    query = query.ilike("search_text", `%${input.q.trim()}%`);
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

  return {
    product: product as ProductRow,
    offers: offers ?? [],
    lowestPrice: offers?.[0]?.current_price_azn ?? null,
    lastUpdatedAt: product.last_price_at
  };
}

export async function getCategoryBySlug(input: {
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
  const sortConfig = SEARCH_SORT[sort];

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,name,slug,path")
    .eq("slug", input.slug)
    .maybeSingle();

  if (categoryError) throw categoryError;
  if (!category) return null;

  const { data: items, error: itemsError, count } = await supabase
    .from("v_category_products")
    .select("*", { count: "exact" })
    .eq("category_id", category.id)
    .range(from, to)
    .order(sortConfig.column, { ascending: sortConfig.asc })
    .returns<SearchProduct[]>();

  if (itemsError) throw itemsError;

  return {
    category,
    page,
    limit,
    total: count ?? 0,
    items: items ?? []
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
