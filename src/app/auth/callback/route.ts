import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerResult } from "@/lib/auth/session";
import { resolvePostLoginPath, safeRedirectPath } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

/**
 * Email-confirmation landing route (PKCE): exchanges the one-time `code` for a
 * session cookie, then routes the user by their ACTUAL role/status.
 * The optional `next` is validated and area-restricted; open redirects are impossible.
 */
export async function GET(request: NextRequest) {
  const toLogin = (reason: string) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", reason);
    return NextResponse.redirect(url);
  };

  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 512) return toLogin("callback");

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return toLogin("config");

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return toLogin("callback");

    const result = await getViewerResult();
    if (result.kind !== "ok") return toLogin("profile");

    const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(resolvePostLoginPath(result.viewer, next), request.url));
  } catch {
    return toLogin("unavailable");
  }
}
