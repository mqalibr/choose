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
  product_id: number;
}

interface ProductCategoryRow {
  id: number;
  category_id: number | null;
}

interface ExistingMappingRow {
  id: number;
  product_id: number;
  current_price_azn: number | null;
  previous_price_azn: number | null;
  in_stock: boolean;
  price_updated_at: string | null;
}

interface ExistingProductMetaRow {
  id?: number;
  category_id?: number | null;
  brand?: string | null;
  model?: string | null;
  image_url?: string | null;
  specs?: Record<string, unknown> | null;
}

interface ProductAliasRow {
  product_id: number;
  fingerprint: string;
  confidence: number | null;
}

interface AliasFingerprint {
  fingerprint: string;
  confidence: number;
  type: "exact" | "relaxed" | "model";
}

const RELAXED_DROP_TOKENS = new Set([
  "black",
  "white",
  "blue",
  "red",
  "green",
  "gray",
  "grey",
  "silver",
  "gold",
  "pink",
  "purple",
  "violet",
  "yellow",
  "orange",
  "midnight",
  "starlight",
  "titanium",
  "desert",
  "velvet",
  "ocean",
  "forest",
  "space",
  "graphite",
  "moonlight",
  "sunrise",
  "cyan",
  "teal",
  "color",
  "colour",
  "colourway",
  "colorr",
  "qara",
  "ag",
  "goy",
  "qirmizi",
  "yasil",
  "boz",
  "gumus",
  "qizili",
  "benovseyi",
  "bej"
]);

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

function buildRelaxedTitle(normalizedTitle: string): string {
  const text = normalizedTitle
    .toLowerCase()
    .replace(/\u0259/g, "e")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00e7/g, "c")
    .replace(/\u011f/g, "g")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = text.split(" ").filter(Boolean);
  const kept = tokens.filter((token) => !RELAXED_DROP_TOKENS.has(token));
  return kept.join(" ").trim();
}

function buildAliasFingerprints(item: NormalizedItem): AliasFingerprint[] {
  const categoryPart = item.categorySlug ?? "uncategorized";
  const brandPart = item.brand?.trim().toLowerCase() || "unknown";
  const exactTitle = item.normalizedTitle.trim().toLowerCase();
  const relaxedTitle = buildRelaxedTitle(item.normalizedTitle);
  const modelPart = item.model?.trim().toLowerCase() || "";

  const exact = `${categoryPart}|${brandPart}|${exactTitle}`.trim();
  const relaxed = `${categoryPart}|${brandPart}|${relaxedTitle || exactTitle}`.trim();
  const model = modelPart ? `${categoryPart}|${brandPart}|model|${modelPart}`.trim() : "";

  const rows: AliasFingerprint[] = [
    { fingerprint: exact, confidence: 1.0, type: "exact" }
  ];

  if (relaxed && relaxed !== exact) {
    rows.push({ fingerprint: relaxed, confidence: 0.9, type: "relaxed" });
  }

  if (model && model !== exact && model !== relaxed) {
    rows.push({ fingerprint: model, confidence: 0.97, type: "model" });
  }

  return rows;
}

async function syncProductMeta(productId: number, item: NormalizedItem, categoryId: number | null): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: existingProduct } = await supabase
    .from("products")
    .select("brand,model,image_url,specs,category_id")
    .eq("id", productId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    canonical_name: item.canonicalName,
    normalized_name: item.normalizedTitle,
    brand: item.brand ?? existingProduct?.brand ?? null,
    model: item.model ?? existingProduct?.model ?? null,
    image_url: item.imageUrl ?? existingProduct?.image_url ?? null,
    specs: hasRawSpecs(item) ? item.rawSpecs : existingProduct?.specs ?? {}
  };

  // Never clear category if scraper couldn't infer one for this row.
  if (categoryId !== null) {
    patch.category_id = categoryId;
  }

  await supabase.from("products").update(patch).eq("id", productId);
}

async function upsertProductAliases(storeId: number, productId: number, item: NormalizedItem): Promise<void> {
  const supabase = getSupabaseClient();
  const fingerprints = buildAliasFingerprints(item);
  const rows = fingerprints.map((entry) => ({
    store_id: storeId,
    product_id: productId,
    raw_title: item.canonicalName,
    normalized_title: item.normalizedTitle,
    fingerprint: entry.fingerprint,
    confidence: entry.confidence
  }));

  const { error } = await supabase.from("product_aliases").upsert(rows, { onConflict: "store_id,fingerprint" });
  if (error) {
    logger.warn({ error, storeId, productId }, "Failed to upsert product aliases");
  }
}

async function resolveProductIdByAlias(item: NormalizedItem, categoryId: number | null): Promise<number | null> {
  const supabase = getSupabaseClient();
  const fingerprints = buildAliasFingerprints(item);
  const exactFingerprints = new Set(
    fingerprints.filter((row) => row.type === "exact").map((row) => row.fingerprint)
  );
  const relaxedFingerprints = new Set(
    fingerprints.filter((row) => row.type === "relaxed").map((row) => row.fingerprint)
  );
  const modelFingerprints = new Set(
    fingerprints.filter((row) => row.type === "model").map((row) => row.fingerprint)
  );
  const fingerprintList = [...new Set(fingerprints.map((row) => row.fingerprint))];

  const { data: aliasRows, error: aliasError } = await supabase
    .from("product_aliases")
    .select("product_id,fingerprint,confidence")
    .in("fingerprint", fingerprintList)
    .limit(100);

  const aliasData = (aliasRows ?? []) as ProductAliasRow[];
  if (aliasError || aliasData.length === 0) {
    return null;
  }

  const productIds = [...new Set(aliasData.map((row: ProductAliasRow) => row.product_id))];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id,category_id,brand,is_active")
    .in("id", productIds);

  if (productError || !products?.length) {
    return null;
  }

  const brand = item.brand?.trim().toLowerCase() ?? "";
  const productsById = new Map<number, { id: number; category_id: number | null; brand: string | null; is_active: boolean }>();
  for (const product of products as Array<{ id: number; category_id: number | null; brand: string | null; is_active: boolean }>) {
    productsById.set(product.id, product);
  }

  let best: { productId: number; score: number } | null = null;
  for (const alias of aliasData) {
    const product = productsById.get(alias.product_id);
    if (!product || product.is_active === false) continue;

    let score = 0;
    if (categoryId !== null) {
      if (product.category_id === categoryId) score += 100;
      else if (product.category_id === null) score -= 20;
      else score -= 40;
    }

    const productBrand = product.brand?.trim().toLowerCase() ?? "";
    if (brand && brand === productBrand) score += 40;

    if (modelFingerprints.has(alias.fingerprint)) score += 35;
    else if (exactFingerprints.has(alias.fingerprint)) score += 25;
    else if (relaxedFingerprints.has(alias.fingerprint)) score += 15;

    const confidence = Number(alias.confidence ?? 0);
    score += Number.isFinite(confidence) ? Math.round(confidence * 10) : 0;

    if (!best || score > best.score) {
      best = { productId: product.id, score };
    }
  }

  if (!best) return null;
  return best.productId;
}

async function upsertPhoneSpecs(productId: number, item: NormalizedItem): Promise<void> {
  if (!item.phoneSpecs || !hasPhoneSpecValue(item)) return;

  const specs = item.phoneSpecs;
  const supabase = getSupabaseClient();
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
    await syncProductMeta(existingProduct.id, item, categoryId);
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

async function deactivateStaleListings(
  storeId: number,
  runStartedAt: string,
  scopeCategoryIds: number[]
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: staleRows, error: staleFetchError } = await supabase
    .from("store_products")
    .select("id,current_price_azn,product_id")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .lt("last_seen_at", runStartedAt);

  if (staleFetchError || !staleRows?.length) {
    return 0;
  }

  const rows = staleRows as StaleStoreProductRow[];
  let scopedRows = rows;

  if (scopeCategoryIds.length > 0) {
    const productIds = [...new Set(rows.map((row) => row.product_id))];
    if (!productIds.length) {
      return 0;
    }

    const { data: productRows, error: productFetchError } = await supabase
      .from("products")
      .select("id,category_id")
      .in("id", productIds);

    if (productFetchError || !productRows?.length) {
      logger.warn(
        { error: productFetchError, storeId, scopeCategoryIds },
        "Failed to scope stale listing deactivation by category"
      );
      return 0;
    }

    const categoryByProductId = new Map<number, number | null>();
    for (const row of productRows as ProductCategoryRow[]) {
      categoryByProductId.set(row.id, row.category_id ?? null);
    }

    scopedRows = rows.filter((row) => {
      const categoryId = categoryByProductId.get(row.product_id) ?? null;
      if (categoryId === null) return false;
      return scopeCategoryIds.includes(categoryId);
    });
  }

  if (!scopedRows.length) {
    return 0;
  }

  const staleIds = scopedRows.map((row: StaleStoreProductRow) => row.id);

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
    scopedRows.map((row: StaleStoreProductRow) => ({
      store_product_id: row.id,
      event_type: "listing_inactive",
      old_price_azn: row.current_price_azn ?? null,
      new_price_azn: null,
      payload: { reason: "missing_in_latest_scrape", runStartedAt }
    }))
  );

  return scopedRows.length;
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
  const categoryIdsInRun = new Set<number>();

  for (const item of items) {
    const categoryId = item.categorySlug ? (categoryBySlug.get(item.categorySlug) ?? null) : null;
    if (categoryId != null) {
      categoryIdsInRun.add(categoryId);
    }
    const { data: existingMapping } = await supabase
      .from("store_products")
      .select("id,product_id,current_price_azn,previous_price_azn,in_stock,price_updated_at")
      .eq("store_id", store.id)
      .eq("listing_key", item.listingKey)
      .maybeSingle();

    const mapping = existingMapping as ExistingMappingRow | null;
    let productId: number;
    try {
      const aliasResolvedId = await resolveProductIdByAlias(item, categoryId);
      if (aliasResolvedId) {
        productId = aliasResolvedId;
        await syncProductMeta(productId, item, categoryId);
      } else if (mapping?.product_id) {
        const fingerprintResolvedId = await resolveProductId(item, categoryId);
        productId = fingerprintResolvedId || mapping.product_id;
      } else {
        productId = await resolveProductId(item, categoryId);
      }
    } catch (productError) {
      logger.error({ error: productError, item }, "Failed to resolve product");
      continue;
    }

    await upsertProductAliases(store.id, productId, item);

    if (item.categorySlug === "telefonlar") {
      await upsertPhoneSpecs(productId, item);
    }

    const isNew = !mapping;
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

  deactivatedListings = await deactivateStaleListings(store.id, options.runStartedAt, [...categoryIdsInRun]);

  await supabase
    .from("stores")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", store.id);

  return { insertedPrices, changedPrices, deactivatedListings };
}

