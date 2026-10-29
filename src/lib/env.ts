import { z } from "zod";

/**
 * Supabase configuration, validated without ever echoing values.
 *
 * Accepted public key names (first non-empty wins):
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (current Supabase naming, "sb_publishable_...")
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY         (legacy JWT "anon" key; still supported)
 */
export type SupabaseConfig =
  | { status: "ok"; url: string; key: string }
  | { status: "missing"; missing: string[] }
  | { status: "invalid"; problems: string[] };

type EnvLike = Record<string, string | undefined>;

const PLACEHOLDER_HINTS = ["your-project-ref", "your-anon-key", "your-publishable-key", "your-service-role-key", "changeme"];

function looksLikePlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_HINTS.some((h) => v.includes(h));
}

/** True if a JWT-shaped key carries the privileged service_role claim. */
function isServiceRoleJwt(key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

const urlSchema = z.url().refine((u) => {
  try {
    const { protocol, hostname } = new URL(u);
    // https everywhere; plain http only for a local Supabase stack.
    return protocol === "https:" || (protocol === "http:" && ["localhost", "127.0.0.1"].includes(hostname));
  } catch {
    return false;
  }
});

export function resolveSupabaseConfig(env: EnvLike): SupabaseConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  if (missing.length > 0) return { status: "missing", missing };

  const problems: string[] = [];
  if (looksLikePlaceholder(url)) problems.push("NEXT_PUBLIC_SUPABASE_URL still contains the placeholder from .env.example.");
  else if (!urlSchema.safeParse(url).success) problems.push("NEXT_PUBLIC_SUPABASE_URL is not a valid https URL.");

  if (looksLikePlaceholder(key)) problems.push("The public Supabase key still contains the placeholder from .env.example.");
  else if (key.startsWith("sb_secret_") || isServiceRoleJwt(key)) {
    problems.push("A SECRET (service-role) key was placed in a public variable. Remove it and use the publishable/anon key.");
  } else if (key.length < 20) problems.push("The public Supabase key looks too short.");

  return problems.length > 0 ? { status: "invalid", problems } : { status: "ok", url, key };
}

/** NOTE: process.env.NEXT_PUBLIC_* must be referenced literally so Next can inline them. */
export function getSupabaseConfig(): SupabaseConfig {
  return resolveSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** Returns validated settings, or null when not configured or invalid. */
export function getPublicEnv(): { url: string; key: string } | null {
  const config = getSupabaseConfig();
  return config.status === "ok" ? { url: config.url, key: config.key } : null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().status === "ok";
}

/** Safe, user-presentable explanation. Lists variable NAMES only, never values. */
export function describeSupabaseConfig(config: SupabaseConfig): string | null {
  if (config.status === "ok") return null;
  if (config.status === "missing") return `Supabase is not configured. Missing: ${config.missing.join(", ")}. See the README.`;
  return `Supabase configuration is invalid. ${config.problems.join(" ")}`;
}

/** Server-only. Returns the service-role key or null. Never log this value. */
export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key.length < 20 || looksLikePlaceholder(key)) return null;
  return key;
}

export function isAdminOperationsConfigured(): boolean {
  return isSupabaseConfigured() && getServiceRoleKey() !== null;
}

const siteUrlSchema = z.url();

/** Public site URL used for email confirmation links. Optional. */
export function getSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw || looksLikePlaceholder(raw)) return null;
  const parsed = siteUrlSchema.safeParse(raw);
  return parsed.success ? new URL(parsed.data).origin : null;
}
