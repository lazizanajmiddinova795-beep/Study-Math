/** Path prefixes that require a signed-in user. Pure, shared by proxy.ts and tests. */
export const PROTECTED_PREFIXES = ["/student", "/teacher", "/admin", "/pending"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
