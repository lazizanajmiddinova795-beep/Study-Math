import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth/guards";
import { loadTeacherGroups } from "@/features/teacher/queries";

export const metadata: Metadata = { title: "Groups & students" };

export default async function TeacherGroupsPage() {
  await requireViewer("teacher");
  const { groups, failed } = await loadTeacherGroups();
  return (
    <>
      <PageHeader title="Groups & students" description="Groups assigned to you by an administrator." />
      {failed ? <Notice tone="error">Groups could not be loaded. Please refresh.</Notice> : null}
      {!failed && groups.length === 0 ? (
        <EmptyState icon={Users} title="No groups assigned yet" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Card>
                <h2 className="font-semibold text-ink">{g.name}</h2>
                <p className="text-sm text-ink-soft">{g.studentCount} {g.studentCount === 1 ? "member" : "members"}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
