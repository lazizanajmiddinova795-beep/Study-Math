import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ConfigNotice } from "./config-notice";

export function AuthCard({
  title,
  subtitle,
  children,
  banner,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  banner?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8" aria-label="Home">
        <BrandMark size="lg" />
      </Link>
      <main id="main" className="animate-enter w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-pop sm:p-7">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-soft">{subtitle}</p>
        <div className="mb-4 space-y-3 empty:hidden">
          <ConfigNotice />
          {banner}
        </div>
        {children}
      </main>
    </div>
  );
}
