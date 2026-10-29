import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Writes an audit record using a trusted (service-role) client.
 * Audit failures are surfaced to the caller; sensitive operations should treat a
 * failed audit write as a failed operation where feasible.
 */
export async function writeAuditLog(
  admin: SupabaseClient,
  entry: {
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<boolean> {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
  });
  return !error;
}
