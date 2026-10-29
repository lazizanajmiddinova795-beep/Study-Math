import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS. Server-only (the "server-only" import makes
 * the build fail if this module is ever imported from client code).
 * Only call it AFTER the caller's authorization has been verified server-side.
 */
export function createSupabaseAdminClient() {
  const env = getPublicEnv();
  const key = getServiceRoleKey();
  if (!env || !key) return null;
  return createClient(env.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
