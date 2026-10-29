import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { resolveAiStatus, getAiProvider, describeAiStatus } from "@/lib/ai";
import { AiNotConfiguredError, type AiProviderFactory } from "@/lib/ai/types";
import { adminCreateUserSchema, loginSchema, registerSchema } from "@/lib/validation/auth";
import { splitMathSegments } from "@/lib/math/segments";

describe("rate limiter", () => {
  beforeEach(resetRateLimits);

  it("blocks after the limit and reopens after the window", () => {
    expect(checkRateLimit("k", 2, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit("k", 2, 1000, 1).allowed).toBe(true);
    const blocked = checkRateLimit("k", 2, 1000, 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(checkRateLimit("k", 2, 1000, 1001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    checkRateLimit("a", 1, 1000, 0);
    expect(checkRateLimit("b", 1, 1000, 0).allowed).toBe(true);
  });
});

describe("AI provider layer", () => {
  const fake: AiProviderFactory = () => ({
    id: "fake",
    generateText: async () => ({ text: "x", model: "m" }),
  });

  it("reports not configured when nothing is set", () => {
    expect(resolveAiStatus({}, {})).toEqual({ configured: false, reason: "no_provider_selected" });
  });
  it("reports unsupported provider rather than pretending", () => {
    expect(resolveAiStatus({ AI_PROVIDER: "gemini", AI_API_KEY: "k" }, {})).toEqual({
      configured: false,
      reason: "unsupported_provider",
    });
  });
  it("reports missing key", () => {
    expect(resolveAiStatus({ AI_PROVIDER: "fake" }, { fake })).toEqual({ configured: false, reason: "missing_api_key" });
  });
  it("is configured only with adapter and key", () => {
    expect(resolveAiStatus({ AI_PROVIDER: "fake", AI_API_KEY: "k" }, { fake })).toEqual({ configured: true, provider: "fake" });
  });
  it("throws a typed error instead of fabricating a provider", () => {
    expect(() => getAiProvider({}, {})).toThrow(AiNotConfiguredError);
  });
  it("status text never contains the API key", () => {
    const text = describeAiStatus(resolveAiStatus({ AI_PROVIDER: "fake", AI_API_KEY: "super-secret" }, { fake }));
    expect(text).not.toContain("super-secret");
  });
});

describe("validation schemas", () => {
  it("normalises and validates login input", () => {
    expect(loginSchema.parse({ email: "  A@Example.com ", password: "x" }).email).toBe("a@example.com");
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("enforces password length on registration", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short", fullName: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "long-enough-pass", fullName: "A" }).success).toBe(true);
  });
  it("registration schema ignores a smuggled role field", () => {
    const parsed = registerSchema.parse({ email: "a@b.co", password: "long-enough-pass", fullName: "A", role: "admin" });
    expect("role" in parsed).toBe(false);
  });
  it("admin create only accepts known roles", () => {
    const base = { email: "a@b.co", password: "long-enough-pass", fullName: "A" };
    expect(adminCreateUserSchema.safeParse({ ...base, role: "teacher" }).success).toBe(true);
    expect(adminCreateUserSchema.safeParse({ ...base, role: "root" }).success).toBe(false);
  });
});

describe("splitMathSegments", () => {
  it("splits inline and display math", () => {
    expect(splitMathSegments("Solve $x^2=4$ now")).toEqual([
      { type: "text", value: "Solve ", display: false },
      { type: "math", value: "x^2=4", display: false },
      { type: "text", value: " now", display: false },
    ]);
    expect(splitMathSegments("$$a+b$$")).toEqual([{ type: "math", value: "a+b", display: true }]);
  });
  it("treats an unmatched dollar as text", () => {
    expect(splitMathSegments("costs $5")).toEqual([{ type: "text", value: "costs $5", display: false }]);
  });
});
