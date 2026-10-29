"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/fields";
import { Notice } from "@/components/ui/primitives";
import { registerAction, signInAction } from "./actions";
import type { FormState } from "./form-state";

const initial: FormState = {};

function Spinner({ label }: { label: string }) {
  return (
    <>
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {label}
    </>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate aria-busy={pending}>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field
        label="Email"
        id="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        required
      />
      <Field
        label="Password"
        id="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner label="Signing in…" /> : "Sign in"}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        New student?{" "}
        <Link href="/register" className="font-medium text-primary-600 underline-offset-2 hover:underline">
          Request an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  if (state.message) {
    return (
      <div className="space-y-4">
        <Notice tone="success">{state.message}</Notice>
        <Link href="/login" className="block text-center text-sm font-medium text-primary-600 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate aria-busy={pending}>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Field
        label="Full name"
        id="fullName"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
        required
      />
      <Field
        label="Email"
        id="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        required
      />
      <Field
        label="Password"
        id="password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        error={state.fieldErrors?.password}
        required
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner label="Submitting…" /> : "Request account"}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        Already approved?{" "}
        <Link href="/login" className="font-medium text-primary-600 underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
