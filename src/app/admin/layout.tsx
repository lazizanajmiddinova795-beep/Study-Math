import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireViewer } from "@/lib/auth/guards";

// Auth-dependent: must never be prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer("admin");
  return (
    <AppShell area="admin" viewer={viewer}>
      {children}
    </AppShell>
  );
}
