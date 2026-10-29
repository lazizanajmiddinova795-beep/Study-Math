"use client";

import { Button } from "@/components/ui/button";

export default function GlobalRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The error object is intentionally not rendered: it may contain internal details.
  return (
    <div role="alert" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
      <p className="mb-5 mt-2 text-ink-soft">An unexpected error occurred. You can try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
