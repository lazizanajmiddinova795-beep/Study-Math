import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Learning" };

export default function LearningPage() {
  return (
    <ModulePage
      title="Learning"
      description="Courses, topics and lessons from your teachers."
      icon={BookOpen}
      phase="Phase 3 (content)"
      willInclude={["Browse published courses and topics", "Read lessons with rendered math notation", "Track which lessons you have completed"]}
    />
  );
}
