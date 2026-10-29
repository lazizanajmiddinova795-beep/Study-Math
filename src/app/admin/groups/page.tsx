import type { Metadata } from "next";
import { Users } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Groups & members" };

export default function AdminGroupsPage() {
  return (
    <ModulePage
      title="Groups & members"
      description="Create groups and manage student membership."
      icon={Users}
      phase="Phase 2 (organisation)"
      willInclude={["Create, rename and archive groups", "Add and remove students (audited)", "Server-side actions only; RLS already restricts the tables"]}
    />
  );
}
