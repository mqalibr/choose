import type { PhoneSpecsData } from "../core/types";

interface ParsePhoneSpecsInput {
  titleRaw: string;
  normalizedTitle: string;
  rawSpecs?: Record<string, unknown> | null;
}

interface RawSpecRow {
  label: string;
  key: string;
  value: string;
}

function toAsciiForMatch(value: string): string {
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

function sanitizeLabel(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+i$/i, "")
    .replace(/[：:]+$/, "")
    .trim();
}

function sanitizeValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function coerceSpecValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const normalized = sanitizeValue(value);
    return normalized.length ? normalized : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") {
    return value ? "Var" : "Yox";
  }
  if (Array.isArray(value)) {
    const parts = value.map(coerceSpecValue).filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const asObject = value as Record<string, unknown>;
    const directKeys = ["value", "label", "title", "text", "name", "description"];
    for (const key of directKeys) {
      const found = coerceSpecValue(asObject[key]);
      if (found) return found;
    }
    return null;
  }
  return null;
}

function normalizeRawSpecs(rawSpecs: Record<string, unknown> | null | undefined): RawSpecRow[] {
  if (!rawSpecs) return [];
  const rows: RawSpecRow[] = [];

  for (const [key, rawValue] of Object.entries(rawSpecs)) {
    const label = sanitizeLabel(key);
    const value = coerceSpecValue(rawValue);
    if (!label || !value) continue;
    rows.push({
      label,
      key: toAsciiForMatch(label),
      value
    });
  }

  return rows;
}

function findRawValue(rows: RawSpecRow[], aliases: string[]): string | null {
  if (!rows.length) return null;
  const keys = aliases.map((alias) => toAsciiForMatch(alias));

  for (const key of keys) {
    for (const row of rows) {
      if (!key) continue;
      if (row.key === key || row.key.startsWith(`${key} `) || row.key.includes(` ${key} `) || row.key.includes(key)) {
        return row.value;
      }
    }
  }

  return null;
}

function parseBooleanLike(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  const text = toAsciiForMatch(raw);
  if (!text) return null;

  const truthy = ["var", "beli", "yes", "true", "supported", "destekleyir", "movcuddur"];
  const falsy = ["yox", "xeyr", "no", "false", "unsupported", "desteklemir", "movcud deyil"];

  if (truthy.some((item) => text === item || text.includes(item))) return true;
  if (falsy.some((item) => text === item || text.includes(item))) return false;
  return null;
}

function parseNumberInRange(raw: string | null | undefined, min: number, max: number): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,5}(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Number(value.toFixed(2));
}

function parseIntInRange(raw: string | null | undefined, min: number, max: number): number | null {
  const parsed = parseNumberInRange(raw, min, max);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function parseRamStorageFromText(text: string): { ramGb: number | null; storageGb: number | null } {
  const pair = text.match(/\b(\d{1,2})\s*(?:gb)?\s*\/\s*(\d{2,4})\s*gb\b/i);
  if (pair) {
    return { ramGb: Number(pair[1]), storageGb: Number(pair[2]) };
  }

  const gbTokens = [...text.matchAll(/\b(\d{1,4})\s*gb\b/gi)].map((m) => Number(m[1]));
  const ramCandidate = gbTokens.find((n) => n > 0 && n <= 24) ?? null;
  const storageCandidate = gbTokens.find((n) => n >= 32) ?? null;

  if (!ramCandidate && !storageCandidate) {
    return { ramGb: null, storageGb: null };
  }

  return {
    ramGb: ramCandidate,
    storageGb: storageCandidate
  };
}

function parseScreenInches(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\b(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:\"|inch|in|duym)\b/i);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return value >= 4 && value <= 8.5 ? Number(value.toFixed(2)) : null;
}

function parseBatteryMah(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\b(\d{3,5})\s*mah\b/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  return value >= 1000 && value <= 10000 ? value : null;
}

function parseCameraValues(raw: string | null | undefined): number[] {
  if (!raw) return [];

  const values = [...raw.matchAll(/(\d{1,3}(?:[.,]\d)?)\s*mp/gi)]
    .map((m) => Number(m[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 300);

  if (values.length) {
    return values;
  }

  const plainValues = [...raw.matchAll(/\b(\d{1,3})(?:\s*\+\s*(\d{1,3}))+/g)]
    .flatMap((m) => [m[1], ...m.slice(2)])
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 300);

  return plainValues;
}

function parseSimCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (/\bdual\s*sim\b/i.test(raw)) return 2;
  if (/\bsingle\s*sim\b/i.test(raw)) return 1;
  return parseIntInRange(raw, 1, 4);
}

function parseOsName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = toAsciiForMatch(raw);
  if (text.includes("ios") || text.includes("iphone")) return "iOS";
  if (text.includes("android")) return "Android";
  if (text.includes("harmony")) return "HarmonyOS";
  return null;
}

function parseChipset(raw: string | null | undefined): { chipsetVendor: string | null; chipsetModel: string | null } {
  if (!raw) return { chipsetVendor: null, chipsetModel: null };

  const table: Array<{ vendor: string; re: RegExp }> = [
    { vendor: "Qualcomm", re: /\bsnapdragon\s*([a-z0-9+\- ]+)?\b/i },
    { vendor: "MediaTek", re: /\bdimensity\s*([a-z0-9+\- ]+)?\b/i },
    { vendor: "Samsung", re: /\bexynos\s*([a-z0-9+\- ]+)?\b/i },
    { vendor: "Huawei", re: /\bkirin\s*([a-z0-9+\- ]+)?\b/i },
    { vendor: "Apple", re: /\b(?:apple\s*)?(a\d{1,2}\s*bionic)\b/i },
    { vendor: "Google", re: /\btensor\s*([a-z0-9+\- ]+)?\b/i },
    { vendor: "Unisoc", re: /\bunisoc\s*([a-z0-9+\- ]+)?\b/i }
  ];

  for (const row of table) {
    const m = raw.match(row.re);
    if (m) {
      const tail = (m[2] ?? m[1] ?? "").trim();
      return {
        chipsetVendor: row.vendor,
        chipsetModel: tail ? `${row.vendor} ${tail}`.trim() : row.vendor
      };
    }
  }

  const plain = sanitizeValue(raw);
  if (!plain) {
    return { chipsetVendor: null, chipsetModel: null };
  }

  if (/apple/i.test(plain)) {
    return { chipsetVendor: "Apple", chipsetModel: plain };
  }

  return { chipsetVendor: null, chipsetModel: plain };
}

function parseResolution(raw: string | null | undefined): { width: number | null; height: number | null } {
  if (!raw) return { width: null, height: null };
  const m = raw.match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/);
  if (!m) return { width: null, height: null };
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return { width: null, height: null };
  if (width < 300 || width > 5000 || height < 300 || height > 5000) return { width: null, height: null };
  return { width, height };
}

function parseReleaseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\b(20\d{2})\b/);
  if (!m) return null;
  const value = Number(m[1]);
  return value >= 2000 && value <= 2100 ? value : null;
}

function parseBluetoothVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\b([1-9](?:[.,]\d)?)\b/);
  if (!m) return null;
  return m[1].replace(",", ".");
}

function parseStructuredBoolean(rows: RawSpecRow[], aliases: string[]): boolean | null {
  const value = findRawValue(rows, aliases);
  return parseBooleanLike(value);
}

function pickRawValue(rows: RawSpecRow[], aliases: string[]): string | null {
  return findRawValue(rows, aliases);
}

function buildRawSpecsPayload(rows: RawSpecRow[]): Record<string, unknown> {
  return Object.fromEntries(rows.map((row) => [row.label, row.value]));
}

export function parsePhoneSpecs(input: ParsePhoneSpecsInput): PhoneSpecsData | null {
  const titleText = `${input.titleRaw} ${input.normalizedTitle}`.trim();
  const titleLower = titleText.toLowerCase();
  const rawRows = normalizeRawSpecs(input.rawSpecs);

  const storageRaw = pickRawValue(rawRows, ["Daxili yaddaş", "Daxili yaddas", "Daxili yadda", "Yaddas", "ROM"]);
  const ramRaw = pickRawValue(rawRows, ["Operativ yaddaş", "Operativ yaddas", "Operativ yadda", "RAM"]);
  const mainCameraRaw = pickRawValue(rawRows, ["Əsas kamera", "Esas kamera", "Arxa kamera", "Main camera"]);
  const selfieCameraRaw = pickRawValue(rawRows, ["Ön kamera", "On kamera", "Selfie kamera", "Front camera"]);
  const batteryRaw = pickRawValue(rawRows, [
    "Akkumulyatorun tutumu",
    "Akkumulyator tutumu",
    "Batareya tutumu",
    "Battery capacity"
  ]);
  const simCountRaw = pickRawValue(rawRows, ["SIM-kart sayı", "SIM kart sayi", "SIM sayı", "SIM sayi"]);
  const simTypeRaw = pickRawValue(rawRows, ["SIM-kart növü", "SIM kart novu", "SIM kart novu", "SIM type"]);
  const chipsetRaw =
    pickRawValue(rawRows, ["Prosessorun növü", "Prosessorun novu", "Prosessorun adı", "Prosessorun adi", "Prosessor"]) ??
    pickRawValue(rawRows, ["Chipset"]);
  const osNameRaw = pickRawValue(rawRows, ["Əməliyyat sistemi", "Emeliyyat sistemi", "OS"]);
  const osVersionRaw = pickRawValue(rawRows, ["Əməliyyat sistemin versiyası", "Emeliyyat sistemin versiyasi", "OS versiya"]);
  const screenRaw = pickRawValue(rawRows, ["Ekran", "Ekran ölçüsü", "Ekran olcusu", "Screen"]);
  const displayTypeRaw = pickRawValue(rawRows, ["Displey növü", "Displey novu", "Panel", "Display type"]);
  const wirelessChargeRaw = pickRawValue(rawRows, ["Simsiz enerji", "Simsiz sarj", "Wireless charge"]);
  const chargePowerRaw = pickRawValue(rawRows, ["Enerji yığma gücü", "Enerji yigma gucu", "Şarj gücü", "Sarj gucu", "Charge power"]);
  const nfcRaw = pickRawValue(rawRows, ["NFC"]);
  const networkRaw = pickRawValue(rawRows, ["Şəbəkə standartı", "Sebeke standarti", "Network"]);
  const refreshRateRaw = pickRawValue(rawRows, ["Yenilənmə tezliyi", "Yenilenme tezliyi", "Refresh rate", "Hz"]);
  const resolutionRaw = pickRawValue(rawRows, ["Görüntü imkanı", "Goruntu imkani", "Ekran icazəsi", "Ekran icazesi", "Resolution"]);
  const bluetoothRaw = pickRawValue(rawRows, ["Bluetooth versiyası", "Bluetooth versiyasi", "Bluetooth"]);
  const cpuCoresRaw = pickRawValue(rawRows, ["Nüvə sayı", "Nuve sayi", "Core count"]);
  const ipRaw = pickRawValue(rawRows, ["Qorunma dərəcəsi", "Qorunma derecesi", "IP"]);
  const releaseYearRaw = pickRawValue(rawRows, ["İstehsal ili", "Istehsal ili", "Buraxılış ili", "Buraxilis ili"]);
  const weightRaw = pickRawValue(rawRows, ["Çəki", "Ceki", "Weight"]);
  const oisRaw = pickRawValue(rawRows, ["Optik sabitləşmə", "Optik sabitlesme", "OIS"]);
  const wifiRaw = pickRawValue(rawRows, ["Wi-Fi", "WiFi"]);
  const gpuRaw = pickRawValue(rawRows, ["GPU", "Qrafik prosessor"]);

  const { ramGb: titleRam, storageGb: titleStorage } = parseRamStorageFromText(titleLower);
  const titleScreen = parseScreenInches(titleLower);
  const titleBattery = parseBatteryMah(titleLower);
  const titleMainCam = parseCameraValues(titleLower)[0] ?? null;
  const titleSim = parseSimCount(titleLower);
  const titleOs = parseOsName(titleLower);
  const titleChipset = parseChipset(titleLower);
  const titleYear = parseReleaseYear(titleLower);

  const storageGb = parseIntInRange(storageRaw, 8, 4096) ?? titleStorage;
  const ramGb = parseIntInRange(ramRaw, 1, 32) ?? titleRam;
  const mainCameraValues = parseCameraValues(mainCameraRaw);
  const selfieCameraValues = parseCameraValues(selfieCameraRaw);
  const mainCameraMp = mainCameraValues[0] ?? titleMainCam;
  const ultrawideCameraMp = mainCameraValues[1] ?? null;
  const telephotoCameraMp = mainCameraValues[2] ?? null;
  const selfieCameraMp = selfieCameraValues[0] ?? null;
  const batteryMah = parseBatteryMah(batteryRaw) ?? titleBattery;
  const simCount = parseSimCount(simCountRaw) ?? titleSim;
  const hasEsim =
    /\besim\b/i.test(simTypeRaw ?? "") || /\besim\b/i.test(titleLower)
      ? true
      : parseStructuredBoolean(rawRows, ["eSIM"]);
  const chipset = parseChipset(chipsetRaw);
  const osName = parseOsName(osNameRaw) ?? titleOs;
  const osVersion = osVersionRaw ?? null;
  const screenSizeIn = parseScreenInches(screenRaw) ?? titleScreen;
  const panelType = displayTypeRaw ?? null;
  const hasWirelessCharge =
    parseBooleanLike(wirelessChargeRaw) ??
    (/\bwireless\b|\bqi\b/i.test(titleLower) ? true : null);
  const wiredChargeW = parseNumberInRange(chargePowerRaw, 5, 240);
  const wirelessChargeW = parseNumberInRange(
    pickRawValue(rawRows, ["Simsiz enerji gücü", "Wireless charge power"]),
    2,
    100
  );
  const hasNfc = parseBooleanLike(nfcRaw) ?? (/\bnfc\b/i.test(titleLower) ? true : null);
  const has5g =
    parseBooleanLike(networkRaw) ??
    (/\b5g\b/i.test(`${networkRaw ?? ""} ${titleLower}`) ? true : null);
  const refreshRateHz = parseIntInRange(refreshRateRaw, 30, 240);
  const { width: resolutionWidth, height: resolutionHeight } = parseResolution(resolutionRaw);
  const bluetoothVersion = parseBluetoothVersion(bluetoothRaw);
  const cpuCores = parseIntInRange(cpuCoresRaw, 1, 24);
  const hasWifi6 = /\bwi[\s-]?fi\s*6\b/i.test(`${wifiRaw ?? ""} ${titleLower}`) ? true : null;
  const hasOis = parseBooleanLike(oisRaw);
  const weightG = parseNumberInRange(weightRaw, 40, 600);
  const ipRating = ipRaw ? ipRaw.match(/\bip\s*\d{2}\w*\b/i)?.[0]?.toUpperCase() ?? ipRaw : null;
  const releaseYear = parseReleaseYear(releaseYearRaw) ?? titleYear;
  const rawSpecsPayload = buildRawSpecsPayload(rawRows);

  const parsed: PhoneSpecsData = {
    ramGb,
    storageGb,
    batteryMah,
    mainCameraMp,
    ultrawideCameraMp,
    telephotoCameraMp,
    selfieCameraMp,
    simCount,
    hasEsim,
    hasNfc,
    has5g,
    hasWifi6,
    hasWirelessCharge,
    hasOis,
    osName,
    osVersion,
    chipsetVendor: chipset.chipsetVendor ?? titleChipset.chipsetVendor,
    chipsetModel: chipset.chipsetModel ?? titleChipset.chipsetModel,
    cpuCores,
    gpuModel: gpuRaw ?? null,
    screenSizeIn,
    panelType,
    refreshRateHz,
    resolutionWidth,
    resolutionHeight,
    bluetoothVersion,
    wiredChargeW,
    wirelessChargeW,
    weightG,
    ipRating,
    releaseYear,
    specsConfidence: 0.65,
    rawSpecs: rawSpecsPayload
  };

  const typedCount = Object.entries(parsed).filter(([key, value]) => {
    if (key === "specsConfidence") return false;
    if (key === "rawSpecs") return false;
    return value !== null && value !== undefined;
  }).length;

  if (rawRows.length > 0) {
    parsed.specsConfidence = Number(Math.min(0.99, 0.82 + typedCount * 0.01).toFixed(3));
  } else {
    parsed.specsConfidence = Number(Math.min(0.75, 0.52 + typedCount * 0.015).toFixed(3));
  }

  const hasAny = Object.entries(parsed).some(([key, value]) => {
    if (key === "specsConfidence") return false;
    if (key === "rawSpecs") {
      return Boolean(value && Object.keys(value as Record<string, unknown>).length > 0);
    }
    return value !== null && value !== undefined;
  });

  return hasAny ? parsed : null;
}
