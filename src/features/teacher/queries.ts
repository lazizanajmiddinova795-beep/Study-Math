import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TeacherGroup {
  id: string;
  name: string;
  studentCount: number;
}

/** Runs as the teacher: RLS returns only groups they are assigned to. */
export async function loadTeacherGroups(): Promise<{ groups: TeacherGroup[]; failed: boolean }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { groups: [], failed: true };

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, group_members(count)")
    .is("archived_at", null)
    .order("name");
  if (error) return { groups: [], failed: true };

  type Row = { id: string; name: string; group_members: { count: number }[] | null };
  return {
    failed: false,
    groups: ((data ?? []) as unknown as Row[]).map((g) => ({
      id: g.id,
      name: g.name,
      studentCount: g.group_members?.[0]?.count ?? 0,
    })),
  };
}
