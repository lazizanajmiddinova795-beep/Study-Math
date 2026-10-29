"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { adminCreateUserSchema, userIdSchema } from "@/lib/validation/auth";
import type { FormState } from "@/features/auth/form-state";

const FORBIDDEN = "You are not allowed to perform this action.";
const NOT_CONFIGURED =
  "Administrator operations are not configured (SUPABASE_SERVICE_ROLE_KEY is missing on the server).";

/**
 * Every admin action: (1) re-verifies the caller is an ACTIVE admin from the database,
 * (2) validates input with Zod, (3) uses the service-role client server-side only,
 * (4) writes an audit record.
 */
export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await assertRole("admin");
  if (!actor) return { error: FORBIDDEN };

  const parsed = adminCreateUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { error: NOT_CONFIGURED };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (createError || !created.user) return { error: "Could not create the user." };

  // The trigger created a pending student; promote through trusted code only.
  const { error: promoteError } = await admin
    .from("profiles")
    .update({ role: parsed.data.role, status: "active" })
    .eq("id", created.user.id);

  if (promoteError) {
    // Compensate so we never leave an account with an unintended role state.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Could not assign the role. No account was created." };
  }

  const audited = await writeAuditLog(admin, {
    actorId: actor.userId,
    action: "user.create",
    targetType: "profile",
    targetId: created.user.id,
    metadata: { role: parsed.data.role },
  });

  revalidatePath("/admin");
  return {
    message:
      `Account created for ${parsed.data.email} as ${parsed.data.role}.` +
      (audited ? "" : " Warning: the audit record could not be written."),
  };
}

async function setStatus(formData: FormData, status: "active" | "suspended", action: string) {
  const actor = await assertRole("admin");
  if (!actor) return;
  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return;
  if (parsed.data.userId === actor.userId) return; // never lock yourself out / self-modify

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { error } = await admin.from("profiles").update({ status }).eq("id", parsed.data.userId);
  if (error) return;

  await writeAuditLog(admin, {
    actorId: actor.userId,
    action,
    targetType: "profile",
    targetId: parsed.data.userId,
  });
  revalidatePath("/admin");
}

export async function approveStudentAction(formData: FormData): Promise<void> {
  await setStatus(formData, "active", "user.approve");
}

export async function suspendUserAction(formData: FormData): Promise<void> {
  await setStatus(formData, "suspended", "user.suspend");
}
