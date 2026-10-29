import type { Metadata } from "next";
import { Notice } from "@/components/ui/primitives";
import { AuthCard } from "@/features/auth/auth-card";
import { LoginForm } from "@/features/auth/forms";
import { safeRedirectPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERROR_TEXT: Record<string, string> = {
  callback: "That confirmation link is invalid or has expired. Try signing in, or register again.",
  profile: "You are signed in, but your profile could not be loaded. Contact the administrator.",
  unavailable: "The sign-in service is temporarily unavailable. Please try again shortly.",
  config: "The platform is not connected to its database yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next;
  const errorRaw = Array.isArray(params.error) ? params.error[0] : params.error;
  const next = safeRedirectPath(nextRaw) ?? undefined;
  const errorText = errorRaw ? ERROR_TEXT[errorRaw] : undefined; // allow-list: never echo raw input

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue."
      banner={errorText ? <Notice tone="error">{errorText}</Notice> : null}
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
