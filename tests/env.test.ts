import { describe, expect, it } from "vitest";
import { describeSupabaseConfig, resolveSupabaseConfig } from "@/lib/env";

const URL_OK = "https://abcdefghijklmnop.supabase.co";
const KEY_OK = "sb_publishable_abcdefghijklmnopqrstuvwxyz123456";

function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature-signature-signature`;
}

describe("resolveSupabaseConfig", () => {
  it("reports missing variables by name", () => {
    const c = resolveSupabaseConfig({});
    expect(c.status).toBe("missing");
    if (c.status === "missing") expect(c.missing.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: URL_OK }).status).toBe("missing");
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "   ", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY_OK }).status).toBe("missing");
  });

  it("accepts the publishable key name and the legacy anon key name", () => {
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).status).toBe("ok");
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "anon" }) }).status).toBe("ok");
  });

  it("rejects the untouched .env.example placeholders as invalid, not as connected", () => {
    const c = resolveSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project-ref.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key",
    });
    expect(c.status).toBe("invalid");
  });

  it("rejects malformed and insecure URLs, allows http only for localhost", () => {
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "not a url", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).status).toBe("invalid");
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "http://example.com", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).status).toBe("invalid");
    expect(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK }).status).toBe("ok");
  });

  it("refuses a secret / service-role key placed in a public variable", () => {
    for (const key of ["sb_secret_abcdefghijklmnopqrstuvwxyz123456", jwt({ role: "service_role" })]) {
      const c = resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_ANON_KEY: key });
      expect(c.status).toBe("invalid");
    }
  });

  it("never echoes configured values in its messages", () => {
    const secret = jwt({ role: "service_role" });
    const msg = describeSupabaseConfig(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_ANON_KEY: secret }));
    expect(msg).toBeTruthy();
    expect(msg).not.toContain(secret);
    expect(msg).not.toContain(URL_OK);
    expect(describeSupabaseConfig(resolveSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK }))).toBeNull();
  });
});
