import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/guards";
import { isAdminOperationsConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateUserForm } from "@/features/admin/create-user-form";
import { approveStudentAction, suspendUserAction } from "@/features/admin/actions";

export const metadata: Metadata = { title: "Users & approvals" };

interface ProfileRow { id: string; email: string; full_name: string; role: string; status: string }

export default async function AdminUsersPage() {
  const viewer = await requireViewer("admin");
  const supabase = await createSupabaseServerClient();
  // Runs as the admin; RLS (is_admin) permits this read.
  const { data, error } = supabase
    ? await supabase.from("profiles").select("id, email, full_name, role, status").order("created_at", { ascending: false }).limit(200)
    : { data: null, error: new Error("not configured") };
  const profiles = (data ?? []) as ProfileRow[];
  const pending = profiles.filter((p) => p.status === "pending");
  const others = profiles.filter((p) => p.status !== "pending");

  return (
    <>
      <PageHeader title="Users & approvals" description="Approve self-registered students and create accounts." />
      {!isAdminOperationsConfigured() ? (
        <div className="mb-5"><Notice tone="warning">Account actions are disabled: SUPABASE_SERVICE_ROLE_KEY is not set on the server.</Notice></div>
      ) : null}
      {error ? <div className="mb-5"><Notice tone="error">Users could not be loaded.</Notice></div> : null}

      <Card className="mb-6">
        <CardTitle>Pending approvals</CardTitle>
        <div className="mt-3">
          {pending.length === 0 ? (
            <EmptyState icon={Users} title="No pending requests" />
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span><span className="block font-medium text-ink">{p.full_name || "(no name)"}</span><span className="text-ink-faint">{p.email}</span></span>
                  <form action={approveStudentAction}>
                    <input type="hidden" name="userId" value={p.id} />
                    <Button type="submit">Approve as student</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="mb-6">
        <CardTitle>Create an account</CardTitle>
        <div className="mt-4"><CreateUserForm /></div>
      </Card>

      <Card>
        <CardTitle>All other accounts</CardTitle>
        <ul className="mt-3 divide-y divide-line">
          {others.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span><span className="block font-medium text-ink">{p.full_name || "(no name)"}</span><span className="text-ink-faint">{p.email}</span></span>
              <span className="flex items-center gap-2">
                <Badge tone="info">{p.role}</Badge>
                <Badge tone={p.status === "active" ? "success" : "warning"}>{p.status}</Badge>
                {p.id !== viewer.userId && p.status === "active" ? (
                  <form action={suspendUserAction}>
                    <input type="hidden" name="userId" value={p.id} />
                    <Button type="submit" variant="secondary">Suspend</Button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
