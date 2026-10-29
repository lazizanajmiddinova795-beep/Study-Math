import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isProtectedPath } from "@/lib/auth/routes";
import { safeRedirectPath } from "@/lib/auth/redirects";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Remember where the user was going (validated again after login).
    const next = safeRedirectPath(`${pathname}${search}`);
    if (next && pathname !== "/pending") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
