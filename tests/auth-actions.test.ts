import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mocks for framework/infrastructure modules (no real Supabase, no network) ----
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn();
const getViewerResult = vi.fn();
const createServerClient = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => createServerClient() }));
vi.mock("@/lib/auth/session", () => ({ getViewerResult: () => getViewerResult() }));

import { registerAction, signInAction } from "@/features/auth/actions";
import { resetRateLimits } from "@/lib/rate-limit";

const form = (data: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.append(k, v);
  return f;
};
const viewer = (role: string, status: string) => ({
  kind: "ok" as const,
  viewer: { userId: "u1", email: "a@example.com", fullName: "A", role, status },
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  createServerClient.mockResolvedValue({ auth: { signInWithPassword, signUp, signOut } });
  signOut.mockResolvedValue({});
});

describe("signInAction", () => {
  it("returns field errors for malformed input without calling Supabase", async () => {
    const r = await signInAction({}, form({ email: "nope", password: "" }));
    expect(r.fieldErrors?.email).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("gives the same generic message for wrong credentials (no account enumeration)", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 400, code: "invalid_credentials" } });
    const a = await signInAction({}, form({ email: "exists@example.com", password: "wrong-password" }));
    const b = await signInAction({}, form({ email: "ghost@example.com", password: "wrong-password" }));
    expect(a.error).toBe("Incorrect email or password.");
    expect(b.error).toBe(a.error);
  });

  it("redirects an active student to their own area", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getViewerResult.mockResolvedValue(viewer("student", "active"));
    await expect(signInAction({}, form({ email: "a@example.com", password: "password-ok" }))).rejects.toThrow("REDIRECT:/student");
  });

  it("sends a pending student to /pending, even if `next` asks for /student", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getViewerResult.mockResolvedValue(viewer("student", "pending"));
    await expect(
      signInAction({}, form({ email: "a@example.com", password: "password-ok", next: "/student/tools" })),
    ).rejects.toThrow("REDIRECT:/pending");
  });

  it("does not follow a hostile or cross-role `next`", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getViewerResult.mockResolvedValue(viewer("student", "active"));
    for (const next of ["https://evil.example", "//evil.example", "/admin"]) {
      await expect(
        signInAction({}, form({ email: "a@example.com", password: "password-ok", next })),
      ).rejects.toThrow("REDIRECT:/student");
      resetRateLimits();
    }
  });

  it("reports an outage (exception) without leaking details", async () => {
    signInWithPassword.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:443"));
    const r = await signInAction({}, form({ email: "a@example.com", password: "password-ok" }));
    expect(r.error).toMatch(/temporarily unavailable/i);
    expect(r.error).not.toContain("ECONNREFUSED");
  });

  it("treats a 5xx from Auth as an outage, not as bad credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 503 } });
    const r = await signInAction({}, form({ email: "a@example.com", password: "password-ok" }));
    expect(r.error).toMatch(/temporarily unavailable/i);
  });

  it("signs out and explains when the profile row is missing (migrations not applied)", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getViewerResult.mockResolvedValue({ kind: "no_profile" });
    const r = await signInAction({}, form({ email: "a@example.com", password: "password-ok" }));
    expect(signOut).toHaveBeenCalled();
    expect(r.error).toMatch(/migrations/i);
  });

  it("explains configuration problems when Supabase is not configured", async () => {
    createServerClient.mockResolvedValue(null);
    const r = await signInAction({}, form({ email: "a@example.com", password: "password-ok" }));
    expect(r.error).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rate-limits repeated attempts for the same email", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 400 } });
    let last = "";
    for (let i = 0; i < 10; i++) {
      last = (await signInAction({}, form({ email: "victim@example.com", password: "guess-guess" }))).error ?? "";
    }
    expect(last).toMatch(/too many attempts/i);
  });
});

describe("registerAction", () => {
  const valid = { email: "new@example.com", password: "a-long-password", fullName: "New Student" };

  it("validates every field and never calls Supabase on invalid input", async () => {
    const r = await registerAction({}, form({ email: "bad", password: "short", fullName: "" }));
    expect(Object.keys(r.fieldErrors ?? {}).sort()).toEqual(["email", "fullName", "password"]);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("ignores a browser-supplied role: only the display name is sent as metadata", async () => {
    signUp.mockResolvedValue({ error: null });
    const r = await registerAction({}, form({ ...valid, role: "admin", status: "active" }));
    expect(r.message).toBeTruthy();
    const args = signUp.mock.calls[0]?.[0] as { options: { data: Record<string, unknown> } };
    expect(args.options.data).toEqual({ full_name: "New Student" });
  });

  it("shows the same success message for an already-registered email", async () => {
    signUp.mockResolvedValue({ error: { code: "user_already_exists", status: 422 } });
    const dup = await registerAction({}, form(valid));
    signUp.mockResolvedValue({ error: null });
    const fresh = await registerAction({}, form({ ...valid, email: "other@example.com" }));
    expect(dup.message).toBe(fresh.message);
    expect(dup.error).toBeUndefined();
  });

  it("maps weak passwords to a field error and outages to a safe message", async () => {
    signUp.mockResolvedValue({ error: { code: "weak_password", status: 422 } });
    expect((await registerAction({}, form(valid))).fieldErrors?.password).toBeTruthy();
    signUp.mockRejectedValue(new Error("fetch failed: getaddrinfo ENOTFOUND db.internal"));
    const r = await registerAction({}, form(valid));
    expect(r.error).toMatch(/temporarily unavailable/i);
    expect(r.error).not.toContain("ENOTFOUND");
  });

  it("never echoes the password back in form state", async () => {
    const r = await registerAction({}, form({ ...valid, email: "bad" }));
    expect(JSON.stringify(r)).not.toContain(valid.password);
  });
});
