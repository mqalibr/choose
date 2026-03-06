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

function hasPhoneSpecValue(item: NormalizedItem): boolean {
  if (!item.phoneSpecs) return false;

  return Object.entries(item.phoneSpecs).some(([key, value]) => {
    if (key === "specsConfidence") return false;
    if (key === "rawSpecs") {
      return Boolean(value && Object.keys(value as Record<string, unknown>).length > 0);
    }
    return value !== null && value !== undefined;
  });
}

function hasRawSpecs(item: NormalizedItem): boolean {
  return Boolean(item.rawSpecs && Object.keys(item.rawSpecs).length > 0);
}

async function upsertPhoneSpecs(productId: number, item: NormalizedItem): Promise<void> {
  if (!item.phoneSpecs || !hasPhoneSpecValue(item)) return;

  const specs = item.phoneSpecs;
  const payload: Record<string, unknown> = {
    product_id: productId,
    last_parsed_at: item.scrapedAt
  };

  if (specs.batteryMah != null) payload.battery_mah = specs.batteryMah;
  if (specs.hasNfc !== null && specs.hasNfc !== undefined) payload.has_nfc = specs.hasNfc;
  if (specs.ramGb != null) payload.ram_gb = specs.ramGb;
  if (specs.storageGb != null) payload.storage_gb = specs.storageGb;
  if (specs.chipsetVendor) payload.chipset_vendor = specs.chipsetVendor;
  if (specs.chipsetModel) {
    payload.chipset_model = specs.chipsetModel;
    payload.chipset = specs.chipsetModel;
  }
  if (specs.cpuCores != null) payload.cpu_cores = specs.cpuCores;
  if (specs.gpuModel) payload.gpu_model = specs.gpuModel;
  if (specs.osName) payload.os_name = specs.osName;
  if (specs.osVersion) payload.os_version = specs.osVersion;
  if (specs.simCount != null) payload.sim_count = specs.simCount;
  if (specs.hasEsim !== null && specs.hasEsim !== undefined) payload.has_esim = specs.hasEsim;
  if (specs.hasWifi6 !== null && specs.hasWifi6 !== undefined) payload.has_wifi_6 = specs.hasWifi6;
  if (specs.bluetoothVersion) payload.bluetooth_version = specs.bluetoothVersion;
  if (specs.mainCameraMp != null) payload.main_camera_mp = specs.mainCameraMp;
  if (specs.ultrawideCameraMp != null) payload.ultrawide_camera_mp = specs.ultrawideCameraMp;
  if (specs.telephotoCameraMp != null) payload.telephoto_camera_mp = specs.telephotoCameraMp;
  if (specs.selfieCameraMp != null) payload.selfie_camera_mp = specs.selfieCameraMp;
  if (specs.hasOis !== null && specs.hasOis !== undefined) payload.has_ois = specs.hasOis;
  if (specs.hasWirelessCharge !== null && specs.hasWirelessCharge !== undefined) {
    payload.has_wireless_charge = specs.hasWirelessCharge;
  }
  if (specs.wiredChargeW != null) payload.wired_charge_w = specs.wiredChargeW;
  if (specs.wirelessChargeW != null) payload.wireless_charge_w = specs.wirelessChargeW;
  if (specs.has5g !== null && specs.has5g !== undefined) payload.has_5g = specs.has5g;
  if (specs.screenSizeIn != null) payload.screen_size_in = specs.screenSizeIn;
  if (specs.refreshRateHz != null) payload.refresh_rate_hz = specs.refreshRateHz;
  if (specs.panelType) payload.panel_type = specs.panelType;
  if (specs.resolutionWidth != null) payload.resolution_width = specs.resolutionWidth;
  if (specs.resolutionHeight != null) payload.resolution_height = specs.resolutionHeight;
  if (specs.weightG != null) payload.weight_g = specs.weightG;
  if (specs.ipRating) payload.ip_rating = specs.ipRating;
  if (specs.releaseYear != null) payload.release_year = specs.releaseYear;
  if (specs.specsConfidence != null) payload.specs_confidence = specs.specsConfidence;
  if (specs.rawSpecs && Object.keys(specs.rawSpecs).length > 0) payload.raw_specs = specs.rawSpecs;

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("phone_specs").upsert(payload, { onConflict: "product_id" });
  if (error) {
    logger.warn({ error, productId, payload }, "Failed to upsert phone_specs");
  }
}

function buildSlugCandidates(baseSlug: string, fingerprint: string): string[] {
  return [baseSlug, `${baseSlug}-${shortHash(fingerprint, 5)}`];
}

async function resolveProductId(item: NormalizedItem, categoryId: number | null): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id,category_id,brand,model,image_url,specs")
    .eq("fingerprint", item.fingerprint)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingProduct?.id) {
    const patch: Record<string, unknown> = {
      canonical_name: item.canonicalName,
      normalized_name: item.normalizedTitle,
      brand: item.brand ?? existingProduct.brand ?? null,
      model: item.model ?? existingProduct.model ?? null,
      image_url: item.imageUrl ?? existingProduct.image_url ?? null,
      specs: hasRawSpecs(item) ? item.rawSpecs : existingProduct.specs ?? {},
      // Keep product category in sync with the latest normalized item.
      // This also allows clearing previously wrong categories (set to null).
      category_id: categoryId
    };

    await supabase
      .from("products")
      .update(patch)
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
        specs: hasRawSpecs(item) ? item.rawSpecs : {},
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
      const { data: existingProduct } = await supabase
        .from("products")
        .select("brand,model,image_url,specs")
        .eq("id", productId)
        .maybeSingle();

      const patch: Record<string, unknown> = {
        canonical_name: item.canonicalName,
        normalized_name: item.normalizedTitle,
        brand: item.brand ?? existingProduct?.brand ?? null,
        model: item.model ?? existingProduct?.model ?? null,
        image_url: item.imageUrl ?? existingProduct?.image_url ?? null,
        specs: hasRawSpecs(item) ? item.rawSpecs : existingProduct?.specs ?? {},
        category_id: categoryId
      };

      await supabase.from("products").update(patch).eq("id", productId);
    } else {
      try {
        productId = await resolveProductId(item, categoryId);
      } catch (productError) {
        logger.error({ error: productError, item }, "Failed to resolve product");
        continue;
      }
    }

    if (item.categorySlug === "telefonlar") {
      await upsertPhoneSpecs(productId, item);
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
