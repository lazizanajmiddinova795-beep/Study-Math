import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireViewer } from "@/lib/auth/guards";

// Auth-dependent: must never be prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer("teacher");
  return (
    <AppShell area="teacher" viewer={viewer}>
      {children}
    </AppShell>
  );
}
