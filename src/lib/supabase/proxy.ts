import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on each request and returns whether a
 * verified user exists. This is only a COARSE gate (authenticated or not).
 * Role/status authorization is enforced server-side in layouts and actions via
 * src/lib/auth/guards.ts, and in the database via RLS.
 *
 * If Supabase is unreachable, the user is treated as unauthenticated (fail closed).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  if (!env) return { response, isAuthenticated: false };

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    // getUser() validates the token with the Auth server (unlike getSession()).
    const { data } = await supabase.auth.getUser();
    return { response, isAuthenticated: data.user !== null };
  } catch {
    return { response, isAuthenticated: false };
  }
}
