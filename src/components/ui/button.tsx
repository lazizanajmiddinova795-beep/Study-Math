import Link from "next/link";
import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-ink-soft hover:bg-surface-muted",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return clsx(base, variants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
