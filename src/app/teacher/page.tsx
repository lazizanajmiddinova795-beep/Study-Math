import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Card, CardTitle, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth/guards";
import { loadTeacherGroups } from "@/features/teacher/queries";

export const metadata: Metadata = { title: "Teacher overview" };

export default async function TeacherOverview() {
  const viewer = await requireViewer("teacher");
  const { groups, failed } = await loadTeacherGroups();
  const totalStudents = groups.reduce((n, g) => n + g.studentCount, 0);

  return (
    <>
      <PageHeader title={`Hello, ${viewer.fullName.split(" ")[0] || "teacher"}`} description="You only see groups and students assigned to you." />
      {failed ? <div className="mb-5"><Notice tone="error">Your groups could not be loaded. Please refresh.</Notice></div> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardTitle>Assigned groups</CardTitle>
          <p className="mt-2 text-3xl font-semibold text-ink">{groups.length}</p>
        </Card>
        <Card>
          <CardTitle>Students in your groups</CardTitle>
          <p className="mt-2 text-3xl font-semibold text-ink">{totalStudents}</p>
        </Card>
      </div>
      {groups.length === 0 && !failed ? (
        <div className="mt-6">
          <EmptyState icon={Users} title="No groups assigned yet">
            An administrator assigns groups to teachers. They will appear here afterwards.
          </EmptyState>
        </div>
      ) : null}
    </>
  );
}
