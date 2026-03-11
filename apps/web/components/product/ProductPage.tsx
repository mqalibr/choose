"use client";

import { useState } from "react";
import { PriceChart } from "./PriceChart";
import { SimilarProducts } from "./SimilarProducts";
import type { ProductPreview, ProductSpecsPreview } from "./types";

interface ProductPageProps {
  product: ProductPreview;
}

function findCheapestPrice(product: ProductPreview): number | null {
  if (!product.offers.length) return null;
  return Math.min(...product.offers.map((offer) => offer.price));
}

function toYesNo(value: boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value ? "Bəli" : "Xeyr";
}

function normalizeSpecLabelForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u0259/g, "e")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00e7/g, "c")
    .replace(/\u011f/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned.length ? cleaned : null;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") {
    return value ? "Bəli" : "Xeyr";
  }
  if (Array.isArray(value)) {
    const cleaned = value.map(toDisplayValue).filter((item): item is string => Boolean(item));
    return cleaned.length ? cleaned.join(", ") : null;
  }
  return null;
}

function chunkSpecRows(rows: Array<{ label: string; value: string }>): Array<Array<{ label: string; value: string }>> {
  const chunks: Array<Array<{ label: string; value: string }>> = [];
  for (let i = 0; i < rows.length; i += 2) {
    chunks.push(rows.slice(i, i + 2));
  }
  return chunks;
}

function buildSpecRows(specs: ProductSpecsPreview | null | undefined): Array<{ label: string; value: string }> {
  const safe = specs ?? {};
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "RAM", value: safe.ram_gb != null ? `${safe.ram_gb} GB` : null },
    { label: "Daxili yaddaş", value: safe.storage_gb != null ? `${safe.storage_gb} GB` : null },
    { label: "Ekran ölçüsü", value: safe.screen_size_in != null ? `${safe.screen_size_in}\"` : null },
    {
      label: "Ekran çözünürlüğü",
      value: safe.resolution_width && safe.resolution_height ? `${safe.resolution_width} x ${safe.resolution_height}` : null
    },
    { label: "Əsas kamera", value: safe.main_camera_mp != null ? `${safe.main_camera_mp} MP` : null },
    { label: "Ultra-wide kamera", value: safe.ultrawide_camera_mp != null ? `${safe.ultrawide_camera_mp} MP` : null },
    { label: "Telefoto kamera", value: safe.telephoto_camera_mp != null ? `${safe.telephoto_camera_mp} MP` : null },
    { label: "Ön kamera", value: safe.selfie_camera_mp != null ? `${safe.selfie_camera_mp} MP` : null },
    { label: "Batareya", value: safe.battery_mah != null ? `${safe.battery_mah} mAh` : null },
    { label: "Şarj gücü", value: safe.wired_charge_w != null ? `${safe.wired_charge_w} W` : null },
    { label: "Simsiz şarj gücü", value: safe.wireless_charge_w != null ? `${safe.wireless_charge_w} W` : null },
    { label: "NFC", value: toYesNo(safe.has_nfc) },
    { label: "5G", value: toYesNo(safe.has_5g) },
    { label: "eSIM", value: toYesNo(safe.has_esim) },
    { label: "Wi-Fi 6", value: toYesNo(safe.has_wifi_6) },
    { label: "Simsiz enerji toplama", value: toYesNo(safe.has_wireless_charge) },
    { label: "OIS", value: toYesNo(safe.has_ois) },
    { label: "Panel", value: safe.panel_type ?? null },
    { label: "Yenilənmə tezliyi", value: safe.refresh_rate_hz != null ? `${safe.refresh_rate_hz} Hz` : null },
    { label: "Əməliyyat sistemi", value: safe.os_name ?? null },
    { label: "ƏS versiyası", value: safe.os_version ?? null },
    { label: "Prosessor", value: safe.chipset_model ?? safe.chipset_vendor ?? null },
    { label: "CPU nüvəsi", value: safe.cpu_cores != null ? String(safe.cpu_cores) : null },
    { label: "GPU", value: safe.gpu_model ?? null },
    { label: "Bluetooth", value: safe.bluetooth_version ?? null },
    { label: "SIM sayı", value: safe.sim_count != null ? String(safe.sim_count) : null },
    { label: "Qorunma", value: safe.ip_rating ?? null },
    { label: "Çəki", value: safe.weight_g != null ? `${safe.weight_g} g` : null },
    { label: "Model ili", value: safe.release_year != null ? String(safe.release_year) : null }
  ];

  const mergedRows = rows.map((row) => ({ label: row.label, value: row.value ?? "-" }));
  const indexByKey = new Map<string, number>();

  for (let i = 0; i < mergedRows.length; i += 1) {
    indexByKey.set(normalizeSpecLabelForMatch(mergedRows[i].label), i);
  }

  const rawSpecs = safe.raw_specs ?? null;
  if (rawSpecs && typeof rawSpecs === "object") {
    for (const [rawLabel, rawValue] of Object.entries(rawSpecs)) {
      const label = rawLabel.replace(/\s+/g, " ").replace(/\s+i$/i, "").trim();
      const value = toDisplayValue(rawValue);
      if (!label || !value) continue;

      const key = normalizeSpecLabelForMatch(label);
      const existingIndex = indexByKey.get(key);
      if (existingIndex !== undefined) {
        if (mergedRows[existingIndex].value === "-") {
          mergedRows[existingIndex].value = value;
        }
        continue;
      }

      indexByKey.set(key, mergedRows.length);
      mergedRows.push({ label, value });
    }
  }

  return mergedRows;
}

export function ProductPage({ product }: ProductPageProps) {
  const cheapest = findCheapestPrice(product);
  const specRows = buildSpecRows(product.specs);
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const hasMoreSpecs = specRows.length > 10;
  const displayedSpecRows = showAllSpecs ? specRows : specRows.slice(0, 10);
  const displayedSpecPairs = chunkSpecRows(displayedSpecRows);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 className="m-0 text-[clamp(1.6rem,2.4vw,2.2rem)] leading-tight font-bold text-slate-900">{product.name}</h2>
        {product.last_updated_at ? <p className="m-0 text-sm text-slate-600">Son yenilənmə: {product.last_updated_at}</p> : null}
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {product.images.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt={`${product.name} ${index + 1}`}
            loading="lazy"
            decoding="async"
            className="h-[220px] w-full rounded-xl border border-slate-200 bg-slate-100 object-cover shadow-[0_12px_24px_rgba(15,23,42,0.08)] md:h-[260px]"
          />
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        <h3 className="mb-3 mt-0 text-[1.06rem] font-semibold text-slate-900">Texniki xüsusiyyətlər</h3>

        <div className="md:hidden overflow-hidden rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200">
          {displayedSpecRows.map((row) => (
            <article key={`mobile-${row.label}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5">
              <p className="m-0 text-sm font-medium text-slate-600">{row.label}</p>
              <p className="m-0 text-right text-sm font-semibold text-slate-900">{row.value}</p>
            </article>
          ))}
        </div>

        <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              {displayedSpecPairs.map((pair, index) => (
                <tr key={`desktop-${index}`} className="border-b border-slate-200 last:border-b-0 align-top">
                  <th className="w-[24%] px-3 py-2.5 text-left font-medium text-slate-600">{pair[0].label}</th>
                  <td className="w-[26%] px-3 py-2.5 text-right font-semibold text-slate-900">{pair[0].value}</td>
                  <th className="w-[24%] border-l border-slate-200 px-3 py-2.5 text-left font-medium text-slate-600">
                    {pair[1]?.label ?? ""}
                  </th>
                  <td className="w-[26%] px-3 py-2.5 text-right font-semibold text-slate-900">{pair[1]?.value ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMoreSpecs ? (
          <button
            type="button"
            onClick={() => setShowAllSpecs((prev) => !prev)}
            className="mt-3 inline-flex items-center rounded-lg border border-[rgba(50,144,241,0.35)] bg-[rgba(50,144,241,0.08)] px-3 py-2 text-sm font-semibold text-[rgb(35,118,205)] hover:bg-[rgba(50,144,241,0.14)]"
          >
            {showAllSpecs ? "Daha az göstər" : `Daha çox göstər (${specRows.length - 10})`}
          </button>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        <h3 className="mb-3 mt-0 text-[1.06rem] font-semibold text-slate-900">Mağaza təklifləri</h3>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-[15px]">
            <thead>
              <tr>
                <th className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                  Mağaza
                </th>
                <th className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                  Qiymət
                </th>
                <th className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                  Stok
                </th>
                <th className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                  Əməliyyat
                </th>
              </tr>
            </thead>
            <tbody>
              {product.offers.map((offer) => {
                const isCheapest = cheapest !== null && offer.price === cheapest;
                const isInStock = offer.stock === "Stokda var";

                return (
                  <tr
                    key={`${offer.store_name}-${offer.link}`}
                    className={isCheapest ? "bg-[rgba(50,144,241,0.08)]" : "bg-white"}
                  >
                    <td className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-900">{offer.store_name}</td>
                    <td className="border-b border-slate-200 px-3 py-3">
                      <strong className="text-slate-900">{offer.price} AZN</strong>
                      {isCheapest ? (
                        <span className="ml-2 inline-flex items-center rounded-full border border-[rgba(50,144,241,0.4)] bg-[rgba(50,144,241,0.15)] px-2 py-0.5 text-xs font-semibold text-[rgb(30,98,165)]">
                          Ən ucuz
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`border-b border-slate-200 px-3 py-3 font-semibold ${isInStock ? "text-[rgb(35,118,205)]" : "text-slate-500"}`}
                    >
                      {offer.stock}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-3">
                      {isInStock ? (
                        <a
                          className="inline-flex min-h-10 min-w-[102px] items-center justify-center rounded-lg border border-transparent bg-[rgb(255,79,8)] px-4 text-sm font-semibold text-white transition hover:bg-[rgb(226,66,0)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,79,8,0.4)]"
                          href={offer.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Satın al
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex min-h-10 min-w-[102px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                        >
                          Xəbər ver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 md:hidden">
          {product.offers.map((offer) => {
            const isCheapest = cheapest !== null && offer.price === cheapest;
            const isInStock = offer.stock === "Stokda var";

            return (
              <article
                key={`${offer.store_name}-${offer.link}-mobile`}
                className={`rounded-xl border p-3 ${isCheapest ? "border-[rgba(50,144,241,0.45)] bg-[rgba(50,144,241,0.08)]" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-slate-900">{offer.store_name}</strong>
                  {isCheapest ? (
                    <span className="inline-flex items-center rounded-full border border-[rgba(50,144,241,0.4)] bg-[rgba(50,144,241,0.15)] px-2 py-0.5 text-xs font-semibold text-[rgb(30,98,165)]">
                      Ən ucuz
                    </span>
                  ) : null}
                </div>
                <p className="mb-1 mt-2 text-lg font-bold text-slate-900">{offer.price} AZN</p>
                <p className={`mb-3 mt-0 text-sm font-semibold ${isInStock ? "text-[rgb(35,118,205)]" : "text-slate-500"}`}>{offer.stock}</p>
                {isInStock ? (
                  <a
                    className="inline-flex min-h-10 min-w-[102px] items-center justify-center rounded-lg border border-transparent bg-[rgb(255,79,8)] px-4 text-sm font-semibold text-white transition hover:bg-[rgb(226,66,0)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,79,8,0.4)]"
                    href={offer.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Satın al
                  </a>
                ) : (
                  <button
                    type="button"
                    className="inline-flex min-h-10 min-w-[102px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                  >
                    Xəbər ver
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <PriceChart history={product.price_history} />
      <SimilarProducts products={product.similar_products} />
    </section>
  );
}
