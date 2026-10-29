import clsx from "clsx";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const control =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint";

export function Field({
  label,
  id,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string; error?: string }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(control, error ? "border-danger-600" : "border-line-strong", className)}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} name={id} className={clsx(control, "border-line-strong")} {...props}>
        {children}
      </select>
    </div>
  );
}
