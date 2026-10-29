"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/fields";
import { Notice } from "@/components/ui/primitives";
import { createUserAction } from "./actions";
import type { FormState } from "@/features/auth/form-state";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUserAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {state.error ? <div className="sm:col-span-2"><Notice tone="error">{state.error}</Notice></div> : null}
      {state.message ? <div className="sm:col-span-2"><Notice tone="success">{state.message}</Notice></div> : null}
      <Field label="Full name" id="fullName" required />
      <Field label="Email" id="email" type="email" required />
      <Field label="Temporary password" id="password" type="password" autoComplete="new-password" hint="At least 10 characters. Share it securely." required />
      <SelectField label="Role" id="role" defaultValue="student">
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
        <option value="admin">Administrator</option>
      </SelectField>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
      </div>
    </form>
  );
}
