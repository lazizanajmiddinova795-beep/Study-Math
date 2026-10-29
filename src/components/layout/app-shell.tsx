import type { ReactNode } from "react";
import { Menu, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import type { Area, Viewer } from "@/lib/auth/policy";
import { NavLinks } from "./nav-links";
import { AREA_LABEL } from "./nav-config";

function UserBlock({ viewer, area }: { viewer: Viewer; area: Area }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="truncate text-sm font-medium text-ink">{viewer.fullName || viewer.email}</p>
      <p className="mb-3 text-xs text-ink-faint">{AREA_LABEL[area]}</p>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut aria-hidden className="h-4 w-4" /> Sign out
        </Button>
      </form>
    </div>
  );
}

export function AppShell({ area, viewer, children }: { area: Area; viewer: Viewer; children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-line bg-surface p-5 lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-8">
          <BrandMark />
          <NavLinks area={area} />
        </div>
        <UserBlock viewer={viewer} area={area} />
      </aside>

      {/* Mobile / tablet: dependency-free disclosure menu */}
      <header className="border-b border-line bg-surface px-4 py-3 lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <BrandMark />
            <span className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium">
              <Menu aria-hidden className="h-4 w-4" /> Menu
            </span>
          </summary>
          <div className="mt-4 space-y-4 pb-2">
            <NavLinks area={area} />
            <UserBlock viewer={viewer} area={area} />
          </div>
        </details>
      </header>

      <main id="main" className="animate-enter mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
