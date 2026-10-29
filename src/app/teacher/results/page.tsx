import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Results & analytics" };

export default function TeacherResultsPage() {
  return (
    <ModulePage
      title="Results & analytics"
      description="Results for students in your groups."
      icon={BarChart3}
      phase="Phase 6 (analytics)"
      willInclude={["Per-student and per-group results", "Topic mastery with evidence counts", "Separation of confirmed results from AI hypotheses"]}
    />
  );
}
