import { shortHash } from "@azcompare/shared";
import type { NormalizedItem } from "./types";
import { logger } from "./logger";
import { getSupabaseClient } from "./supabase";

interface UpsertStats {
  insertedPrices: number;
  changedPrices: number;
  deactivatedListings: number;
}

interface StaleStoreProductRow {
  id: number;
  current_price_azn: number | null;
}

interface ExistingMappingRow {
  id: number;
  product_id: number;
  current_price_azn: number | null;
  previous_price_azn: number | null;
  in_stock: boolean;
  price_updated_at: string | null;
}

function buildSlugCandidates(baseSlug: string, fingerprint: string): string[] {
  return [baseSlug, `${baseSlug}-${shortHash(fingerprint, 5)}`];
}

async function resolveProductId(item: NormalizedItem, categoryId: number | null): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id,category_id")
    .eq("fingerprint", item.fingerprint)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingProduct?.id) {
    await supabase
      .from("products")
      .update({
        canonical_name: item.canonicalName,
        normalized_name: item.normalizedTitle,
        brand: item.brand ?? null,
        model: item.model ?? null,
        image_url: item.imageUrl ?? null,
        category_id: existingProduct.category_id ?? categoryId
      })
      .eq("id", existingProduct.id);
    return existingProduct.id;
  }

  const candidates = buildSlugCandidates(item.productSlug, item.fingerprint);
  let lastError: unknown = null;

  for (const slugCandidate of candidates) {
    const { data: insertedProduct, error: insertError } = await supabase
      .from("products")
      .insert({
        slug: slugCandidate,
        fingerprint: item.fingerprint,
        canonical_name: item.canonicalName,
        normalized_name: item.normalizedTitle,
        brand: item.brand ?? null,
        model: item.model ?? null,
        image_url: item.imageUrl ?? null,
        category_id: categoryId
      })
      .select("id")
      .single();

    if (!insertError && insertedProduct?.id) {
      return insertedProduct.id;
    }

    lastError = insertError;

    // Another worker might insert same fingerprint first.
    if ((insertError as { code?: string } | null)?.code === "23505") {
      const { data: resolvedProduct } = await supabase
        .from("products")
        .select("id")
        .eq("fingerprint", item.fingerprint)
        .maybeSingle();

      if (resolvedProduct?.id) {
        return resolvedProduct.id;
      }

      continue;
    }
  }

  throw lastError ?? new Error(`Failed to resolve product for fingerprint=${item.fingerprint}`);
}

async function deactivateStaleListings(storeId: number, runStartedAt: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: staleRows, error: staleFetchError } = await supabase
    .from("store_products")
    .select("id,current_price_azn")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .lt("last_seen_at", runStartedAt);

  if (staleFetchError || !staleRows?.length) {
    return 0;
  }

  const staleIds = (staleRows as StaleStoreProductRow[]).map((row: StaleStoreProductRow) => row.id);

  const { error: staleUpdateError } = await supabase
    .from("store_products")
    .update({
      is_active: false,
      in_stock: false
    })
    .in("id", staleIds);

  if (staleUpdateError) {
    logger.error({ error: staleUpdateError, storeId }, "Failed to deactivate stale listings");
    return 0;
  }

  await supabase.from("price_logs").insert(
    (staleRows as StaleStoreProductRow[]).map((row: StaleStoreProductRow) => ({
      store_product_id: row.id,
      event_type: "listing_inactive",
      old_price_azn: row.current_price_azn ?? null,
      new_price_azn: null,
      payload: { reason: "missing_in_latest_scrape", runStartedAt }
    }))
  );

  return staleRows.length;
}

export async function upsertNormalizedItems(
  items: NormalizedItem[],
  options: { runStartedAt: string }
): Promise<UpsertStats> {
  const supabase = getSupabaseClient();
  if (!items.length) {
    return { insertedPrices: 0, changedPrices: 0, deactivatedListings: 0 };
  }

  const storeSlug = items[0].storeSlug;
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", storeSlug)
    .maybeSingle();

  if (storeError) {
    throw new Error(`Store lookup failed for slug=${storeSlug}: ${storeError.message}`);
  }

  if (!store) {
    throw new Error(`Store not found for slug=${storeSlug}`);
  }

  const categorySlugList = [...new Set(items.map((item) => item.categorySlug).filter(Boolean))] as string[];
  const categoryBySlug = new Map<string, number>();
  if (categorySlugList.length) {
    const { data: categories, error: categoryError } = await supabase
      .from("categories")
      .select("id,slug")
      .in("slug", categorySlugList);

    if (categoryError) {
      logger.warn({ error: categoryError }, "Category preload failed");
    } else {
      for (const row of categories ?? []) {
        categoryBySlug.set(row.slug, row.id);
      }
    }
  }

  let insertedPrices = 0;
  let changedPrices = 0;
  let deactivatedListings = 0;

  for (const item of items) {
    const categoryId = item.categorySlug ? (categoryBySlug.get(item.categorySlug) ?? null) : null;
    const { data: existingMapping } = await supabase
      .from("store_products")
      .select("id,product_id,current_price_azn,previous_price_azn,in_stock,price_updated_at")
      .eq("store_id", store.id)
      .eq("listing_key", item.listingKey)
      .maybeSingle();

    let productId: number;
    if ((existingMapping as ExistingMappingRow | null)?.product_id) {
      productId = (existingMapping as ExistingMappingRow).product_id;

      const patch: Record<string, unknown> = {
        canonical_name: item.canonicalName,
        normalized_name: item.normalizedTitle,
        brand: item.brand ?? null,
        model: item.model ?? null,
        image_url: item.imageUrl ?? null
      };
      if (categoryId !== null) {
        patch.category_id = categoryId;
      }

      await supabase.from("products").update(patch).eq("id", productId);
    } else {
      try {
        productId = await resolveProductId(item, categoryId);
      } catch (productError) {
        logger.error({ error: productError, item }, "Failed to resolve product");
        continue;
      }
    }

    const isNew = !existingMapping;
    const mapping = existingMapping as ExistingMappingRow | null;
    const priceChanged = !isNew && Number(mapping?.current_price_azn) !== Number(item.priceAzn);
    const prevPrice = priceChanged ? mapping?.current_price_azn ?? null : mapping?.previous_price_azn ?? null;
    const updatedAt = isNew || priceChanged ? item.scrapedAt : mapping?.price_updated_at ?? null;

    const { data: storeProduct, error: mappingError } = await supabase
      .from("store_products")
      .upsert(
        {
          store_id: store.id,
          product_id: productId,
          listing_key: item.listingKey,
          product_url: item.productUrl,
          normalized_title: item.normalizedTitle,
          current_price_azn: item.priceAzn,
          previous_price_azn: prevPrice,
          in_stock: item.inStock,
          price_updated_at: updatedAt,
          last_seen_at: item.scrapedAt,
          is_active: true
        },
        { onConflict: "store_id,listing_key" }
      )
      .select("id")
      .single();

    if (mappingError || !storeProduct) {
      logger.error({ error: mappingError, item }, "Failed to upsert store_product");
      continue;
    }

    const { error: priceError } = await supabase.from("prices").upsert(
      {
        store_product_id: storeProduct.id,
        price_azn: item.priceAzn,
        currency: "AZN",
        in_stock: item.inStock,
        captured_at: item.scrapedAt
      },
      { onConflict: "store_product_id,captured_at", ignoreDuplicates: true }
    );

    if (priceError) {
      logger.error({ error: priceError, item }, "Failed to insert price");
    } else {
      insertedPrices += 1;
    }

    if (isNew || priceChanged) {
      changedPrices += 1;
      await supabase.from("price_logs").insert({
        store_product_id: storeProduct.id,
        event_type: isNew ? "new_listing" : "price_changed",
        old_price_azn: isNew ? null : mapping?.current_price_azn ?? null,
        new_price_azn: item.priceAzn,
        payload: { inStock: item.inStock, scrapedAt: item.scrapedAt }
      });
    }
  }

  deactivatedListings = await deactivateStaleListings(store.id, options.runStartedAt);

  await supabase
    .from("stores")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", store.id);

  return { insertedPrices, changedPrices, deactivatedListings };
}
