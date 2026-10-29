import type { Metadata } from "next";
import { Network } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Teacher assignments" };

export default function AdminAssignmentsPage() {
  return (
    <ModulePage
      title="Teacher assignments"
      description="Decide which teachers manage which groups."
      icon={Network}
      phase="Phase 2 (organisation)"
      willInclude={["Assign and unassign teachers to groups", "Audit record for each change"]}
    />
  );
}
