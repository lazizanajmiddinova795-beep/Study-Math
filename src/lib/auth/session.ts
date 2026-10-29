import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRole, ACCOUNT_STATUSES, type AccountStatus, type Viewer } from "./policy";

export type ViewerResult =
  | { kind: "ok"; viewer: Viewer }
  | { kind: "anonymous" }
  | { kind: "no_profile" } // authenticated, but no readable profile row (e.g. migrations not applied)
  | { kind: "unavailable" }; // Supabase unreachable or not configured

/**
 * Resolves the current viewer. Identity is verified with the Auth server
 * (getUser), and role/status are read from public.profiles (the source of truth),
 * never from JWT/user metadata.
 */
export const getViewerResult = cache(async (): Promise<ViewerResult> => {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { kind: "unavailable" };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return { kind: "anonymous" };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, status")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || !isRole(profile.role)) return { kind: "no_profile" };

    const status = (ACCOUNT_STATUSES as readonly string[]).includes(profile.status)
      ? (profile.status as AccountStatus)
      : "suspended"; // unknown status fails closed

    return {
      kind: "ok",
      viewer: {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        status,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
});

export async function getViewer(): Promise<Viewer | null> {
  const result = await getViewerResult();
  return result.kind === "ok" ? result.viewer : null;
}
