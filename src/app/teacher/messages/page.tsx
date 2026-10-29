import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ModulePage } from "@/components/layout/module-page";

export const metadata: Metadata = { title: "Messages" };

export default function TeacherMessagesPage() {
  return (
    <ModulePage
      title="Messages"
      description="Conversations with your students and groups."
      icon={MessageSquare}
      phase="Phase 7 (messaging)"
      willInclude={["Private and group chats", "Membership-verified access", "Moderation and reporting"]}
    />
  );
}
