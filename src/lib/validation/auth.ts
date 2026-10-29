import { z } from "zod";
import { ROLES } from "@/lib/auth/policy";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254, "Email is too long."));
const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");
const fullName = z.string().trim().min(1, "Name is required.").max(120, "Name is too long.");

export const loginSchema = z.object({
  email,
  // Do not enforce complexity on login; only bound the size.
  password: z.string().min(1, "Enter your password.").max(128),
});

export const registerSchema = z.object({ email, password, fullName });

export const adminCreateUserSchema = z.object({
  email,
  password,
  fullName,
  role: z.enum(ROLES),
});

export const userIdSchema = z.object({ userId: z.uuid() });

/** First message per field, for accessible inline errors. */
export function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
