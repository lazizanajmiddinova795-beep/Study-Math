import { landingPathFor, type Viewer } from "./policy";

const ORIGIN_PROBE = "http://redirect-probe.invalid";

/**
 * Returns a same-origin relative path ("/x?y=1") or null.
 * Rejects absolute URLs, protocol-relative ("//host"), backslash tricks
 * ("/\host"), javascript: URLs and non-strings. The URL parser normalises tabs,
 * newlines and backslashes, so we compare the resolved origin rather than
 * pattern-matching the raw string.
 */
export function safeRedirectPath(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > 300) return null;
  if (!input.startsWith("/")) return null;
  try {
    const url = new URL(input, ORIGIN_PROBE);
    if (url.origin !== ORIGIN_PROBE) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Where to send a viewer after signing in. A requested `next` path is honoured only
 * if it is safe AND inside the viewer's own area, so it can never cause a redirect
 * loop (e.g. back to /login) or a bounce to /unauthorized.
 */
export function resolvePostLoginPath(viewer: Viewer, next: unknown): string {
  const landing = landingPathFor(viewer);
  if (viewer.status !== "active") return landing;
  const safe = safeRedirectPath(next);
  if (!safe) return landing;
  const area = `/${viewer.role}`;
  const pathname = safe.split("?")[0] ?? "";
  return pathname === area || pathname.startsWith(`${area}/`) ? safe : landing;
}
