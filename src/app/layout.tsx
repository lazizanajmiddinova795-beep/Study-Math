import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { brand } from "@/lib/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
};

export const viewport: Viewport = { themeColor: "#fbfaf7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
