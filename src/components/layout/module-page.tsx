import type { LucideIcon } from "lucide-react";
import { Hourglass } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

/**
 * Honest placeholder for modules that are not built yet. It states plainly that
 * the feature is not available and shows NO fabricated data.
 */
export function ModulePage({
  title,
  description,
  icon = Hourglass,
  phase,
  willInclude,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  phase: string;
  willInclude: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} actions={<Badge tone="warning">Not available yet · {phase}</Badge>} />
      <EmptyState icon={icon} title="This module has not been built yet">
        It is planned for {phase}. No data is shown here because none exists.
      </EmptyState>
      <Card className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">Planned capabilities</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {willInclude.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
