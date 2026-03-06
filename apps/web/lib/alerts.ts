import { shortHash } from "@azcompare/shared";
import { getSupabaseServerClient } from "./supabase";
import { sendTelegramMessage } from "./telegram";

interface TriggeredAlertCandidate {
  alert_id: number;
  user_id: string;
  product_id: number;
  target_price_azn: number;
  canonical_name: string;
  product_slug: string;
  store_product_id: number;
  store_id: number;
  store_name: string;
  current_price_azn: number;
  product_url: string;
  telegram_chat_id: string | null;
}

interface NotificationRow {
  id: number;
  recipient: string;
  message: string;
  attempt_count: number;
}

export interface AlertsRunResult {
  scanned: number;
  queued: number;
  skipped: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  errors: string[];
}

function buildProductPageUrl(productSlug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  return `${base}/product/${productSlug}`;
}

function buildAlertMessage(candidate: TriggeredAlertCandidate): string {
  const price = Number(candidate.current_price_azn).toFixed(2);
  const target = Number(candidate.target_price_azn).toFixed(2);

  return [
    "QiymətRadar: qiymət hədəfi düşdü",
    `${candidate.canonical_name}`,
    `Yeni qiymət: ${price} AZN (hədəf: ${target} AZN)`,
    `Mağaza: ${candidate.store_name}`,
    `Məhsul səhifəsi: ${buildProductPageUrl(candidate.product_slug)}`,
    `Mağaza linki: ${candidate.product_url}`
  ].join("\n");
}

async function fetchTriggeredCandidates(limit: number): Promise<TriggeredAlertCandidate[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("v_active_price_alert_candidates")
    .select("*")
    .limit(limit)
    .returns<TriggeredAlertCandidate[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function queueNotifications(candidates: TriggeredAlertCandidate[]): Promise<{
  queuedIds: number[];
  skipped: number;
}> {
  const supabase = getSupabaseServerClient();
  let skipped = 0;
  const queuedIds: number[] = [];

  for (const candidate of candidates) {
    if (!candidate.telegram_chat_id) {
      skipped += 1;
      continue;
    }

    const message = buildAlertMessage(candidate);
    const messageHash = shortHash(
      [
        candidate.alert_id,
        candidate.store_product_id,
        candidate.current_price_azn,
        "telegram",
        candidate.telegram_chat_id
      ].join("|"),
      10
    );

    const { data, error } = await supabase
      .from("price_alert_notifications")
      .upsert(
        {
          alert_id: candidate.alert_id,
          user_id: candidate.user_id,
          store_product_id: candidate.store_product_id,
          channel: "telegram",
          recipient: candidate.telegram_chat_id,
          message,
          message_hash: messageHash,
          status: "pending",
          payload: {
            productId: candidate.product_id,
            productSlug: candidate.product_slug,
            currentPriceAzn: candidate.current_price_azn,
            targetPriceAzn: candidate.target_price_azn
          }
        },
        {
          onConflict: "alert_id,store_product_id,channel,recipient,message_hash",
          ignoreDuplicates: true
        }
      )
      .select("id")
      .maybeSingle<{ id: number }>();

    if (error) {
      throw error;
    }

    if (data?.id) {
      queuedIds.push(data.id);
    } else {
      skipped += 1;
    }
  }

  return { queuedIds, skipped };
}

async function fetchPendingTelegramNotifications(limit: number): Promise<NotificationRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("price_alert_notifications")
    .select("id,recipient,message,attempt_count")
    .eq("status", "pending")
    .eq("channel", "telegram")
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<NotificationRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function markNotificationSent(row: NotificationRow): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("price_alert_notifications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      attempt_count: row.attempt_count + 1,
      error_message: null
    })
    .eq("id", row.id);

  if (error) {
    throw error;
  }
}

async function markNotificationFailed(row: NotificationRow, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("price_alert_notifications")
    .update({
      status: "failed",
      last_attempt_at: new Date().toISOString(),
      attempt_count: row.attempt_count + 1,
      error_message: reason.slice(0, 1000)
    })
    .eq("id", row.id);

  if (error) {
    throw error;
  }
}

export async function runAlertsEngine(input: {
  limit?: number;
  dryRun?: boolean;
}): Promise<AlertsRunResult> {
  const limit = Math.max(1, Math.min(input.limit ?? Number(process.env.ALERT_BATCH_SIZE ?? "100"), 500));
  const dryRun = Boolean(input.dryRun);
  const errors: string[] = [];

  if (dryRun) {
    const candidates = await fetchTriggeredCandidates(limit);
    const skipped = candidates.filter((candidate) => !candidate.telegram_chat_id).length;
    return {
      scanned: candidates.length,
      queued: candidates.length - skipped,
      skipped,
      sent: 0,
      failed: 0,
      dryRun: true,
      errors
    };
  }

  const candidates = await fetchTriggeredCandidates(limit);
  const { queuedIds, skipped } = await queueNotifications(candidates);

  const pendingRows = await fetchPendingTelegramNotifications(limit);
  let sent = 0;
  let failed = 0;

  for (const row of pendingRows) {
    try {
      await sendTelegramMessage({
        chatId: row.recipient,
        text: row.message
      });
      await markNotificationSent(row);
      sent += 1;
    } catch (error) {
      await markNotificationFailed(row, (error as Error).message);
      failed += 1;
      errors.push((error as Error).message);
    }
  }

  return {
    scanned: candidates.length,
    queued: queuedIds.length,
    skipped,
    sent,
    failed,
    dryRun: false,
    errors
  };
}
