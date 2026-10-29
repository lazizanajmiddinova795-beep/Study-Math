import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";
import { Notice } from "@/components/ui/primitives";
import { describeAiStatus, getAiStatus } from "@/lib/ai";

export const metadata: Metadata = { title: "AI tutor" };

export default function TutorPage() {
  const status = getAiStatus();
  return (
    <>
      <div className="mb-5">
        <Notice tone={status.configured ? "success" : "warning"}>
          AI status: {describeAiStatus(status)} The tutor itself is not built yet.
        </Notice>
      </div>
      <ModulePage
        title="AI tutor"
        description="Guided hints and explanations."
        icon={Sparkles}
        phase="Phase 5 (AI tutor)"
        willInclude={["Progressive hints before full solutions", "Explanations at different levels of detail", "Personalisation from your authorised learning history"]}
      />
    </>
  );
}
