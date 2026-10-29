import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <ModulePage
      title="Progress"
      description="Your topic-level results over time."
      icon={TrendingUp}
      phase="Phase 6 (analytics)"
      willInclude={["Topic mastery based on real answers", "Recurring mistake categories", "Targeted practice recommendations"]}
    />
  );
}
