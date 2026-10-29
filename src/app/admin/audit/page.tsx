import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit records" };

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function AuditPage() {
  await requireViewer("admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase.from("audit_logs").select("id, action, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(100)
    : { data: null, error: new Error("not configured") };
  const rows = (data ?? []) as { id: string; action: string; target_type: string | null; target_id: string | null; created_at: string }[];

  return (
    <>
      <PageHeader title="Audit records" description="Sensitive administrative operations. Times are UTC." />
      {error ? <Notice tone="error">Audit records could not be loaded.</Notice> : null}
      {!error && rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit records yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span className="font-medium text-ink">{r.action}</span>
                <span className="text-ink-faint">{r.target_type ?? ""} {r.target_id ?? ""} · {fmt.format(new Date(r.created_at))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
