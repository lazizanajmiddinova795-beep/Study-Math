import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { MATH_TOOLS } from "@/features/math-tools/tools";

export const metadata: Metadata = { title: "Math tools" };

export default function MathToolsPage() {
  return (
    <>
      <PageHeader title="Math tools" description="Utilities that help you explore and check your thinking." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {MATH_TOOLS.map((tool) => (
          <li key={tool.id}>
            <Card className="h-full">
              <h2 className="font-semibold text-ink">{tool.name}</h2>
              <p className="mb-4 mt-1 text-sm text-ink-soft">{tool.description}</p>
              <a
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Open in a new tab <ExternalLink aria-hidden className="h-4 w-4" />
                <span className="sr-only">({tool.name})</span>
              </a>
            </Card>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Notice tone="info">
          These tools open on their own websites. This platform does not see or record what you do in them.
        </Notice>
      </div>
    </>
  );
}
