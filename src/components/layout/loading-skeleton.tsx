export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
      </div>
    </div>
  );
}
