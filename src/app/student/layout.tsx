import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireViewer } from "@/lib/auth/guards";

// Auth-dependent: must never be prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer("student");
  return (
    <AppShell area="student" viewer={viewer}>
      {children}
    </AppShell>
  );
}
