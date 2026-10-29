import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/** Per-request Supabase client acting as the signed-in user (RLS applies). */
export async function createSupabaseServerClient() {
  const env = getPublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookie writes are handled by proxy.ts.
        }
      },
    },
  });
}
