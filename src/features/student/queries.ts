import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LessonSummary { id: string; title: string }
export interface AttemptSummary {
  id: string;
  status: "in_progress" | "submitted" | "graded";
  score: number | null;
  maxScore: number | null;
  startedAt: string;
  examTitle: string;
}
export interface MasterySummary {
  topicId: string;
  topicTitle: string;
  evidenceCount: number;
  correctCount: number;
  masteryScore: number | null;
}

export interface StudentDashboardData {
  groupCount: number;
  lessons: LessonSummary[];
  attempts: AttemptSummary[];
  mastery: MasterySummary[];
  /** True when any query failed, so the UI shows an error instead of a false empty state. */
  loadFailed: boolean;
}

/** All queries run as the signed-in student, so RLS limits every result. */
export async function loadStudentDashboard(userId: string): Promise<StudentDashboardData> {
  const supabase = await createSupabaseServerClient();
  const empty: StudentDashboardData = { groupCount: 0, lessons: [], attempts: [], mastery: [], loadFailed: true };
  if (!supabase) return empty;

  const [groups, lessons, attempts, mastery] = await Promise.all([
    supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("lessons").select("id, title").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
    supabase
      .from("attempts")
      .select("id, status, score, max_score, started_at, mock_exams(title)")
      .eq("student_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("skill_mastery")
      .select("topic_id, evidence_count, correct_count, mastery_score, topics(title)")
      .eq("student_id", userId)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const loadFailed = [groups, lessons, attempts, mastery].some((r) => r.error);

  type AttemptRow = {
    id: string; status: AttemptSummary["status"]; score: number | null; max_score: number | null;
    started_at: string; mock_exams: { title: string } | { title: string }[] | null;
  };
  type MasteryRow = {
    topic_id: string; evidence_count: number; correct_count: number; mastery_score: number | null;
    topics: { title: string } | { title: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return {
    groupCount: groups.count ?? 0,
    lessons: (lessons.data ?? []) as LessonSummary[],
    attempts: ((attempts.data ?? []) as unknown as AttemptRow[]).map((a) => ({
      id: a.id,
      status: a.status,
      score: a.score,
      maxScore: a.max_score,
      startedAt: a.started_at,
      examTitle: one(a.mock_exams)?.title ?? "Mock exam",
    })),
    mastery: ((mastery.data ?? []) as unknown as MasteryRow[]).map((m) => ({
      topicId: m.topic_id,
      topicTitle: one(m.topics)?.title ?? "Topic",
      evidenceCount: m.evidence_count,
      correctCount: m.correct_count,
      masteryScore: m.mastery_score,
    })),
    loadFailed,
  };
}
