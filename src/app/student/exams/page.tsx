import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Mock exams" };

export default function StudentExamsPage() {
  return (
    <ModulePage
      title="Mock exams"
      description="Exams published to your group."
      icon={ClipboardList}
      phase="Phase 4 (examination engine)"
      willInclude={["Start and submit timed attempts", "Server-side deterministic scoring", "Review answers when the exam rules allow"]}
    />
  );
}
