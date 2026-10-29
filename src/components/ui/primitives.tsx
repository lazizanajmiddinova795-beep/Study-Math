import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";
import { Info, TriangleAlert, CheckCircle2, type LucideIcon } from "lucide-react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-card border border-line bg-surface p-5 shadow-card", className)}
      {...props}
    />
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx("text-base font-semibold text-ink", className)}>{children}</h2>;
}

type Tone = "neutral" | "info" | "success" | "warning";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  info: "bg-primary-50 text-primary-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", toneClass[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface-muted/50 px-6 py-8 text-center">
      {Icon ? <Icon aria-hidden className="mb-3 h-7 w-7 text-ink-faint" /> : null}
      <p className="font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 max-w-md text-sm text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const noticeStyle = {
  info: { box: "border-primary-100 bg-primary-50 text-primary-700", Icon: Info },
  warning: { box: "border-warning-50 bg-warning-50 text-warning-700", Icon: TriangleAlert },
  error: { box: "border-danger-50 bg-danger-50 text-danger-700", Icon: TriangleAlert },
  success: { box: "border-success-50 bg-success-50 text-success-700", Icon: CheckCircle2 },
} as const;

export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof noticeStyle;
  children: ReactNode;
}) {
  const { box, Icon } = noticeStyle[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex gap-3 rounded-lg border px-4 py-3 text-sm", box)}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-ink-soft">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
