import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Learning materials" };

export default function TeacherMaterialsPage() {
  return (
    <ModulePage
      title="Learning materials"
      description="Create courses, topics and lessons."
      icon={FileText}
      phase="Phase 3 (content)"
      willInclude={["Course, topic and lesson editor", "Math notation preview", "Publish / unpublish control"]}
    />
  );
}
