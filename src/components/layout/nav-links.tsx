"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { Area } from "@/lib/auth/policy";
import { NAV } from "./nav-config";

export function NavLinks({ area }: { area: Area }) {
  const pathname = usePathname();
  return (
    <nav aria-label={`${area} navigation`} className="flex flex-col gap-1">
      {NAV[area].map(({ href, label, icon: Icon }) => {
        const root = `/${area}`;
        const active = href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-50 text-primary-700" : "text-ink-soft hover:bg-surface-muted hover:text-ink",
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
