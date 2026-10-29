import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ClipboardList, TrendingUp, CalendarCheck } from "lucide-react";
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/guards";
import { loadStudentDashboard } from "@/features/student/queries";

export const metadata: Metadata = { title: "Dashboard" };

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default async function StudentDashboard() {
  const viewer = await requireViewer("student");
  const data = await loadStudentDashboard(viewer.userId);
  const firstName = viewer.fullName.split(" ")[0] || "there";
  const isNew = data.groupCount === 0;

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="Pick up where you left off, or see what to study next." />

      {data.loadFailed ? (
        <div className="mb-5"><Notice tone="error">Some dashboard data could not be loaded. Please refresh the page.</Notice></div>
      ) : null}
      {isNew && !data.loadFailed ? (
        <div className="mb-5">
          <Notice tone="info">
            You are not in a group yet. Your teacher or administrator will add you; learning
            material and exams appear here once that happens.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Continue learning</CardTitle>
          <div className="mt-3">
            {data.lessons.length === 0 ? (
              <EmptyState icon={BookOpen} title="No lessons available yet">
                Published lessons from your teachers will show up here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.lessons.map((l) => (
                  <li key={l.id} className="py-2.5 text-sm font-medium text-ink">{l.title}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Study today</CardTitle>
          <div className="mt-3">
            <EmptyState icon={CalendarCheck} title="Recommendations start after your first practice">
              Suggestions are based on your real results. Until you have some, there is nothing to recommend.
            </EmptyState>
          </div>
        </Card>

        <Card>
          <CardTitle>Recent mock exams</CardTitle>
          <div className="mt-3">
            {data.attempts.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No exam attempts yet">
                Attempts you complete will be listed here with their scores.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium text-ink">{a.examTitle}</span>
                      <span className="text-xs text-ink-faint">{dateFmt.format(new Date(a.startedAt))} (UTC)</span>
                    </span>
                    {a.status === "graded" && a.score !== null && a.maxScore !== null ? (
                      <Badge tone="success">{a.score} / {a.maxScore}</Badge>
                    ) : (
                      <Badge>{a.status === "in_progress" ? "In progress" : "Awaiting score"}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Topic mastery</CardTitle>
          <div className="mt-3">
            {data.mastery.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No mastery data yet">
                Mastery is shown only when there is enough evidence from your answers.
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {data.mastery.map((m) => (
                  <li key={m.topicId} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-ink">{m.topicTitle}</span>
                      <span className="text-ink-faint">{m.correctCount}/{m.evidenceCount} correct</span>
                    </div>
                    {m.masteryScore === null ? (
                      <p className="text-xs text-ink-faint">Not enough evidence to estimate mastery yet.</p>
                    ) : (
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`Mastery ${Math.round(m.masteryScore * 100)}%`}>
                        <div className="h-full rounded-full bg-success-600" style={{ width: `${Math.round(m.masteryScore * 100)}%` }} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href="/student/tools" variant="secondary">Open math tools</LinkButton>
        <Link href="/student/workspace" className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-600 hover:bg-primary-50">
          Preview the math workspace
        </Link>
      </div>
    </>
  );
}
