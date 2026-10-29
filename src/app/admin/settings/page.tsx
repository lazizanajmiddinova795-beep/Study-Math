import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth/guards";
import { describeSupabaseConfig, getSupabaseConfig, isAdminOperationsConfigured, isSupabaseConfigured } from "@/lib/env";
import { describeAiStatus, getAiStatus } from "@/lib/ai";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Platform configuration" };

/** Read-only status. Reports presence/absence only; never prints secret values. */
export default async function AdminSettingsPage() {
  await requireViewer("admin");
  const ai = getAiStatus();
  const rows: { label: string; ok: boolean; detail: string }[] = [
    { label: "Supabase settings", ok: isSupabaseConfigured(), detail: describeSupabaseConfig(getSupabaseConfig()) ?? "Present and well-formed (this page is open, so the database answered your sign-in)" },
    { label: "Admin operations (service role)", ok: isAdminOperationsConfigured(), detail: isAdminOperationsConfigured() ? "Configured" : "SUPABASE_SERVICE_ROLE_KEY not set" },
    { label: "AI provider", ok: ai.configured, detail: describeAiStatus(ai) },
  ];
  return (
    <>
      <PageHeader title="Platform configuration" description={`Branding is currently "${brand.name}". Change it with environment variables.`} />
      <Card>
        <ul className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-medium text-ink">{r.label}</span>
              <span className="flex items-center gap-2 text-ink-soft">{r.detail}<Badge tone={r.ok ? "success" : "warning"}>{r.ok ? "OK" : "Action needed"}</Badge></span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
