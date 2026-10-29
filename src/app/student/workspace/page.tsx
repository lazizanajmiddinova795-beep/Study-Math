import type { Metadata } from "next";
import { Lightbulb, ListChecks, PenLine } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Math workspace" };

/**
 * Layout foundation for the distraction-free workspace. It deliberately shows
 * NO question content: real questions arrive with the examination engine.
 */
export default function WorkspacePage() {
  return (
    <>
      <PageHeader
        title="Math workspace"
        description="A focused space for one question at a time."
        actions={<Badge tone="warning">Foundation only</Badge>}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Question" className="space-y-5">
          <Card className="min-h-56">
            <EmptyState icon={PenLine} title="No active question">
              Questions from a mock exam or practice session will appear here with rendered math notation.
            </EmptyState>
          </Card>
          <Card>
            <label htmlFor="answer" className="mb-2 block text-sm font-medium text-ink">Your answer</label>
            <textarea
              id="answer"
              disabled
              rows={3}
              placeholder="Answer input becomes available when a question is active."
              className="w-full rounded-lg border border-line-strong bg-surface-muted px-3 py-2.5 text-sm"
            />
          </Card>
          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">Question navigation</h2>
            <p className="flex items-center gap-2 text-sm text-ink-faint">
              <ListChecks aria-hidden className="h-4 w-4" /> Appears once an exam attempt is open.
            </p>
          </Card>
        </section>
        <aside aria-label="Hints and explanations">
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb aria-hidden className="h-4 w-4 text-primary-600" /> Hints &amp; explanations
            </h2>
            <p className="text-sm text-ink-soft">Progressive hints will be offered here in a later phase.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
