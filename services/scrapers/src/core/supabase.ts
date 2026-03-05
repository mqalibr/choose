import { createClient } from "@supabase/supabase-js";

let cachedClient: any = null;

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env for scraper.");
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl.trim())) {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL format. Expected: https://<project-ref>.supabase.co");
  }

  const key = serviceRoleKey.trim();
  if (key.startsWith("sb_publishable_") || key.startsWith("sb_anon_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is wrong. Use service_role JWT key, not publishable/anon key.");
  }

  if (!key.startsWith("eyJ")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY format looks invalid. It should be a JWT starting with 'eyJ'.");
  }

  cachedClient = createClient(supabaseUrl.trim(), key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return cachedClient;
}
