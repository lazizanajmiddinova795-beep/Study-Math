import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Mock exams" };

export default function TeacherExamsPage() {
  return (
    <ModulePage
      title="Mock exams"
      description="Author, version and publish exams."
      icon={ClipboardList}
      phase="Phase 4 (examination engine)"
      willInclude={["Exam builder with multiple-choice and open-response questions", "Versioned, immutable published exams", "Per-exam external tool policy (declared first, enforced later)"]}
    />
  );
}
