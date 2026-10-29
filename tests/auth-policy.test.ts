import { describe, expect, it } from "vitest";
import { landingPathFor, resolveAreaAccess, isRole, type Viewer } from "@/lib/auth/policy";

const make = (role: Viewer["role"], status: Viewer["status"]): Viewer => ({
  userId: "00000000-0000-0000-0000-000000000001",
  email: "a@example.com",
  fullName: "A",
  role,
  status,
});

describe("resolveAreaAccess", () => {
  it("sends anonymous visitors to login for every area", () => {
    for (const area of ["admin", "teacher", "student"] as const) {
      expect(resolveAreaAccess(null, area)).toEqual({ kind: "redirect", to: "/login" });
    }
  });

  it("keeps pending students out of every area", () => {
    for (const area of ["admin", "teacher", "student"] as const) {
      expect(resolveAreaAccess(make("student", "pending"), area)).toEqual({ kind: "redirect", to: "/pending" });
    }
  });

  it("keeps suspended users out, even admins", () => {
    expect(resolveAreaAccess(make("admin", "suspended"), "admin")).toEqual({ kind: "redirect", to: "/pending" });
  });

  it("allows only the matching role", () => {
    expect(resolveAreaAccess(make("student", "active"), "student")).toEqual({ kind: "allow" });
    expect(resolveAreaAccess(make("student", "active"), "teacher")).toEqual({ kind: "redirect", to: "/unauthorized" });
    expect(resolveAreaAccess(make("student", "active"), "admin")).toEqual({ kind: "redirect", to: "/unauthorized" });
    expect(resolveAreaAccess(make("teacher", "active"), "admin")).toEqual({ kind: "redirect", to: "/unauthorized" });
    expect(resolveAreaAccess(make("teacher", "active"), "student")).toEqual({ kind: "redirect", to: "/unauthorized" });
    expect(resolveAreaAccess(make("admin", "active"), "admin")).toEqual({ kind: "allow" });
  });
});

describe("landingPathFor / isRole", () => {
  it("routes by role and status", () => {
    expect(landingPathFor(make("teacher", "active"))).toBe("/teacher");
    expect(landingPathFor(make("student", "pending"))).toBe("/pending");
  });
  it("rejects unknown role strings", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
