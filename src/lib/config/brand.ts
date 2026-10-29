/**
 * Central, configurable identity. Change via env vars (see .env.example) or edit
 * the defaults here. Colors live as CSS variables in src/app/globals.css.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Math Learning Platform",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() ||
    "Understand mathematics, step by step.",
  /** Optional logo path under /public. When empty, a text monogram is shown. */
  logoSrc: process.env.NEXT_PUBLIC_BRAND_LOGO?.trim() || "",
} as const;

export function brandMonogram(): string {
  return brand.name.trim().charAt(0).toUpperCase() || "M";
}
