export const ROLES = ["admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["pending", "active", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Application areas, each mapped to exactly one role. */
export type Area = "admin" | "teacher" | "student";

export interface Viewer {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
}

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string };

export function homePathFor(role: Role): string {
  return `/${role}`;
}

/**
 * Pure authorization decision for entering an application area.
 *   - not signed in            -> /login
 *   - pending or suspended     -> /pending (no area is accessible)
 *   - active, wrong role       -> /unauthorized
 *   - active, matching role    -> allow
 * Roles come from the database profile only, never from request data.
 */
export function resolveAreaAccess(viewer: Viewer | null, area: Area): AccessDecision {
  if (!viewer) return { kind: "redirect", to: "/login" };
  if (viewer.status !== "active") return { kind: "redirect", to: "/pending" };
  if (viewer.role !== area) return { kind: "redirect", to: "/unauthorized" };
  return { kind: "allow" };
}

/** Where a signed-in viewer should land after login. */
export function landingPathFor(viewer: Viewer): string {
  return viewer.status === "active" ? homePathFor(viewer.role) : "/pending";
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
