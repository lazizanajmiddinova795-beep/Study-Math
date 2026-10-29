"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation/auth";
import { getViewerResult } from "@/lib/auth/session";
import { resolvePostLoginPath } from "@/lib/auth/redirects";
import { describeSupabaseConfig, getSiteUrl, getSupabaseConfig } from "@/lib/env";
import type { FormState } from "./form-state";

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";
const UNAVAILABLE = "The sign-in service is temporarily unavailable. Please try again in a few minutes.";

function configError(): string {
  // Names of missing variables only; never values.
  return describeSupabaseConfig(getSupabaseConfig()) ?? UNAVAILABLE;
}

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = formData.get("email");
  const values = { email: typeof rawEmail === "string" ? rawEmail.trim() : "" };

  const parsed = loginSchema.safeParse({ email: rawEmail, password: formData.get("password") });
  if (!parsed.success) {
    // Field-level hints only for format problems; wrong credentials stay generic.
    return { fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  const ip = await clientKey();
  const byIp = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
  const byEmail = checkRateLimit(`login:email:${parsed.data.email}`, 8, 15 * 60_000);
  if (!byIp.allowed || !byEmail.allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", values };
  }

  let destinationFor: Awaited<ReturnType<typeof getViewerResult>>;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: configError(), values };

    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      // Distinguish an outage (5xx / no status) from bad credentials.
      const outage = error.status === undefined || error.status >= 500;
      return { error: outage ? UNAVAILABLE : GENERIC_LOGIN_ERROR, values };
    }
    destinationFor = await getViewerResult();
    if (destinationFor.kind !== "ok") {
      // Signed in to Auth, but we cannot establish an authorized profile: do not leave a half-session.
      await supabase.auth.signOut();
    }
  } catch {
    return { error: UNAVAILABLE, values };
  }

  if (destinationFor.kind !== "ok") {
    return {
      error:
        destinationFor.kind === "no_profile"
          ? "Your account is signed in but has no profile. The database migrations may not be applied yet; contact the administrator."
          : UNAVAILABLE,
      values,
    };
  }

  // redirect() throws by design, so it must stay outside try/catch.
  redirect(resolvePostLoginPath(destinationFor.viewer, formData.get("next")));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = formData.get("email");
  const rawName = formData.get("fullName");
  const values = {
    email: typeof rawEmail === "string" ? rawEmail.trim() : "",
    fullName: typeof rawName === "string" ? rawName.trim() : "",
  };

  // A browser-supplied "role" field is never read: the schema has no such key.
  const parsed = registerSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
    fullName: rawName,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };

  const ip = await clientKey();
  const limit = checkRateLimit(`register:ip:${ip}`, 5, 60 * 60_000);
  if (!limit.allowed) return { error: "Too many sign-ups from this network. Try again later.", values };

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: configError(), values };

    const siteUrl = getSiteUrl();
    // Only a display name is passed as metadata. The database trigger always creates
    // a PENDING STUDENT profile; any other metadata is ignored.
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        ...(siteUrl ? { emailRedirectTo: `${siteUrl}/auth/callback` } : {}),
      },
    });

    if (error) {
      if (error.code === "user_already_exists") {
        // Same response as success: avoids confirming which emails are registered.
        return { message: REGISTER_MESSAGE };
      }
      if (error.code === "weak_password") {
        return { fieldErrors: { password: "This password is too weak or too common. Choose another." }, values };
      }
      if (error.code === "over_email_send_rate_limit" || error.status === 429) {
        return { error: "Too many sign-up emails were requested. Please try again later.", values };
      }
      const outage = error.status === undefined || error.status >= 500;
      return {
        error: outage ? UNAVAILABLE : "We could not create the account. Please check your details and try again.",
        values,
      };
    }
  } catch {
    return { error: UNAVAILABLE, values };
  }
  return { message: REGISTER_MESSAGE };
}

const REGISTER_MESSAGE =
  "Account request received. If email confirmation is enabled, check your inbox and open the link. " +
  "You will be able to use the platform after an administrator approves your account.";

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) await supabase.auth.signOut();
  } catch {
    // Even if Auth is unreachable, send the user to the login page.
  }
  redirect("/login");
}
