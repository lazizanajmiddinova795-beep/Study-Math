import { describe, expect, it } from "vitest";
import { resolvePostLoginPath, safeRedirectPath } from "@/lib/auth/redirects";
import { isProtectedPath } from "@/lib/auth/routes";
import type { Viewer } from "@/lib/auth/policy";

const viewer = (role: Viewer["role"], status: Viewer["status"] = "active"): Viewer => ({
  userId: "00000000-0000-0000-0000-000000000001",
  email: "a@example.com",
  fullName: "A",
  role,
  status,
});

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths and preserves the query string", () => {
    expect(safeRedirectPath("/student")).toBe("/student");
    expect(safeRedirectPath("/student/exams?x=1")).toBe("/student/exams?x=1");
  });

  it("rejects every common open-redirect shape", () => {
    const attacks = [
      "https://evil.example",
      "http://evil.example/student",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "student",
      "",
      "   /student",
      "data:text/html,x",
    ];
    for (const a of attacks) expect(safeRedirectPath(a), a).toBeNull();
  });

  it("rejects non-strings and absurdly long input", () => {
    for (const v of [null, undefined, 42, {}, ["/student"]]) expect(safeRedirectPath(v)).toBeNull();
    expect(safeRedirectPath(`/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("resolvePostLoginPath", () => {
  it("honours a safe next path only inside the viewer's own area", () => {
    expect(resolvePostLoginPath(viewer("student"), "/student/tools")).toBe("/student/tools");
    expect(resolvePostLoginPath(viewer("teacher"), "/teacher/groups")).toBe("/teacher/groups");
  });

  it("never sends a user into another role's area", () => {
    expect(resolvePostLoginPath(viewer("student"), "/admin")).toBe("/student");
    expect(resolvePostLoginPath(viewer("student"), "/teacher/groups")).toBe("/student");
    expect(resolvePostLoginPath(viewer("teacher"), "/admin/audit")).toBe("/teacher");
  });

  it("cannot loop back to public/auth pages", () => {
    for (const next of ["/login", "/register", "/", "/pending", "/unauthorized", "/auth/callback"]) {
      expect(resolvePostLoginPath(viewer("student"), next), next).toBe("/student");
    }
  });

  it("ignores prefix tricks like /studentx", () => {
    expect(resolvePostLoginPath(viewer("student"), "/studentx")).toBe("/student");
    expect(resolvePostLoginPath(viewer("student"), "/student/../admin")).toBe("/student");
  });

  it("sends pending and suspended users to /pending whatever `next` says", () => {
    expect(resolvePostLoginPath(viewer("student", "pending"), "/student")).toBe("/pending");
    expect(resolvePostLoginPath(viewer("admin", "suspended"), "/admin")).toBe("/pending");
  });

  it("rejects hostile next values", () => {
    expect(resolvePostLoginPath(viewer("student"), "https://evil.example")).toBe("/student");
    expect(resolvePostLoginPath(viewer("student"), "//evil.example/student")).toBe("/student");
  });
});

describe("isProtectedPath", () => {
  it("protects the three areas and /pending, including nested paths", () => {
    for (const p of ["/student", "/student/exams", "/teacher", "/teacher/x/y", "/admin", "/admin/audit", "/pending"]) {
      expect(isProtectedPath(p), p).toBe(true);
    }
  });
  it("leaves public pages open and does not match look-alike prefixes", () => {
    for (const p of ["/", "/login", "/register", "/unauthorized", "/auth/callback", "/students", "/administrator"]) {
      expect(isProtectedPath(p), p).toBe(false);
    }
  });
});
