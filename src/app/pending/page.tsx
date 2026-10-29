import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hourglass, Ban } from "lucide-react";
import { AuthCard } from "@/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { signOutAction } from "@/features/auth/actions";
import { getViewer } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/policy";

export const metadata: Metadata = { title: "Account pending" };

// Auth-dependent: must never be prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.status === "active") redirect(homePathFor(viewer.role));

  const suspended = viewer.status === "suspended";
  return (
    <AuthCard title={suspended ? "Account suspended" : "Waiting for approval"} subtitle={viewer.email}>
      <EmptyState icon={suspended ? Ban : Hourglass} title={suspended ? "Access is disabled" : "Your account is pending"}>
        {suspended
          ? "Contact your administrator if you believe this is a mistake."
          : "An administrator needs to approve your account and assign you to a group. You will see your dashboard here once that is done."}
      </EmptyState>
      <form action={signOutAction} className="mt-5">
        <Button type="submit" variant="secondary" className="w-full">Sign out</Button>
      </form>
    </AuthCard>
  );
}
