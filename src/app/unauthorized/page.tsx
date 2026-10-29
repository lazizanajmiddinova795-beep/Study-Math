import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { AuthCard } from "@/features/auth/auth-card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/policy";

export const metadata: Metadata = { title: "Not authorized" };

// Auth-dependent: must never be prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  const viewer = await getViewer();
  return (
    <AuthCard title="Not authorized" subtitle="You are signed in, but this area is not available to your role.">
      <EmptyState icon={ShieldAlert} title="Access denied" />
      <LinkButton href={viewer ? landingPathFor(viewer) : "/login"} className="mt-5 w-full">
        {viewer ? "Go to my dashboard" : "Sign in"}
      </LinkButton>
    </AuthCard>
  );
}
