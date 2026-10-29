import type { Metadata } from "next";
import { Wand2 } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";
import { Notice } from "@/components/ui/primitives";
import { describeAiStatus, getAiStatus } from "@/lib/ai";

export const metadata: Metadata = { title: "AI content preparation" };

export default function AiPrepPage() {
  const status = getAiStatus();
  return (
    <>
      <div className="mb-5">
        <Notice tone={status.configured ? "success" : "warning"}>
          AI status: {describeAiStatus(status)} AI-assisted features are not built yet.
        </Notice>
      </div>
      <ModulePage
        title="AI content preparation"
        description="AI-assisted drafting with mandatory teacher review."
        icon={Wand2}
        phase="Phases 5 and 8 (AI)"
        willInclude={["Exam parser for PDFs and images with uncertainty flags", "Practice question generation with validation", "Teacher approval before anything is published"]}
      />
    </>
  );
}
