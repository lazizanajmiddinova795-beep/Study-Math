import { Notice } from "@/components/ui/primitives";
import { describeSupabaseConfig, getSupabaseConfig } from "@/lib/env";

/** Renders only when Supabase is missing or invalid. Names variables, never values. */
export function ConfigNotice() {
  const message = describeSupabaseConfig(getSupabaseConfig());
  if (!message) return null;
  return <Notice tone="warning">{message}</Notice>;
}
