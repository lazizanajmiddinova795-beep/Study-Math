import { redirect } from "next/navigation";
import { ArrowRight, Calculator, ClipboardCheck, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LinkButton } from "@/components/ui/button";
import { ConfigNotice } from "@/features/auth/config-notice";
import { brand } from "@/lib/config/brand";
import { getViewer } from "@/lib/auth/session";
import { landingPathFor } from "@/lib/auth/policy";

const pillars = [
  { icon: Sparkles, title: "Guided understanding", text: "Hints and explanations that build reasoning, not just answers." },
  { icon: ClipboardCheck, title: "Honest assessment", text: "Deterministic scoring and mistake analysis grounded in real results." },
  { icon: Calculator, title: "Real tools", text: "Open Desmos and other math utilities right from your workspace." },
  { icon: ShieldCheck, title: "Private by design", text: "Role- and group-based access enforced in the database." },
];

// Auth-dependent: must never be prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  if (viewer) redirect(landingPathFor(viewer));

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <BrandMark />
        <nav className="flex items-center gap-2" aria-label="Account">
          <LinkButton href="/login" variant="ghost">Sign in</LinkButton>
          <LinkButton href="/register">Create account</LinkButton>
        </nav>
      </header>

      <main id="main" className="animate-enter flex flex-1 flex-col justify-center py-16">
        <div className="mb-8 max-w-2xl empty:hidden">
          <ConfigNotice />
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{brand.tagline}</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">
          A focused place for mathematics students and teachers to learn, practise and review together.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/register">
            Request a student account <ArrowRight aria-hidden className="h-4 w-4" />
          </LinkButton>
          <LinkButton href="/login" variant="secondary">Sign in</LinkButton>
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <Icon aria-hidden className="mb-3 h-5 w-5 text-primary-600" />
              <h2 className="font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
