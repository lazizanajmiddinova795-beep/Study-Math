import { beforeEach, describe, expect, it, vi } from "vitest";

const assertRole = vi.fn();
const adminClient = vi.fn();
const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
const createUser = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ assertRole: (...a: unknown[]) => assertRole(...a) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => adminClient() }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => true) }));

import { approveStudentAction, createUserAction, suspendUserAction } from "@/features/admin/actions";

const form = (data: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.append(k, v);
  return f;
};
const USER_ID = "11111111-1111-4111-8111-111111111111";
const valid = { email: "t@example.com", password: "a-long-password", fullName: "T", role: "teacher" };

beforeEach(() => {
  vi.clearAllMocks();
  adminClient.mockReturnValue({
    auth: { admin: { createUser, deleteUser: vi.fn() } },
    from: () => ({ update, insert: vi.fn() }),
  });
  updateEq.mockResolvedValue({ error: null });
  createUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
});

describe("privileged admin actions require an active administrator", () => {
  it("createUserAction refuses non-admins and never touches the service-role client", async () => {
    assertRole.mockResolvedValue(null); // student / teacher / pending / anonymous all resolve to null
    const r = await createUserAction({}, form(valid));
    expect(r.error).toMatch(/not allowed/i);
    expect(adminClient).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("approve and suspend refuse non-admins and write nothing", async () => {
    assertRole.mockResolvedValue(null);
    await approveStudentAction(form({ userId: USER_ID }));
    await suspendUserAction(form({ userId: USER_ID }));
    expect(adminClient).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("the authorization check is requested for the admin area", async () => {
    assertRole.mockResolvedValue(null);
    await createUserAction({}, form(valid));
    expect(assertRole).toHaveBeenCalledWith("admin");
  });
});

describe("when the caller is an admin", () => {
  beforeEach(() => assertRole.mockResolvedValue({ userId: "admin-1", role: "admin", status: "active" }));

  it("rejects invalid input and unknown roles before using the service role", async () => {
    expect((await createUserAction({}, form({ ...valid, role: "superuser" }))).error).toBeTruthy();
    expect((await createUserAction({}, form({ ...valid, password: "short" }))).error).toBeTruthy();
    expect(adminClient).not.toHaveBeenCalled();
  });

  it("creates the account and then promotes through the trusted client", async () => {
    const r = await createUserAction({}, form(valid));
    expect(r.message).toMatch(/created/i);
    expect(update).toHaveBeenCalledWith({ role: "teacher", status: "active" });
  });

  it("cannot approve or suspend themselves", async () => {
    await suspendUserAction(form({ userId: "admin-1" }));
    expect(update).not.toHaveBeenCalled();
  });

  it("ignores a malformed user id", async () => {
    await approveStudentAction(form({ userId: "not-a-uuid" }));
    expect(update).not.toHaveBeenCalled();
  });
});
