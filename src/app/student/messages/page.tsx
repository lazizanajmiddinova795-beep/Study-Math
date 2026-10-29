import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Messages" };

export default function StudentMessagesPage() {
  return (
    <ModulePage
      title="Messages"
      description="Conversations you are a member of."
      icon={MessageSquare}
      phase="Phase 7 (messaging)"
      willInclude={["Teacher and group conversations", "Membership-verified reading and sending", "Reporting and moderation controls"]}
    />
  );
}
