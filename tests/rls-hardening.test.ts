/**
 * Tests for migration 0003: admin bootstrap, last-admin protection, audit trigger,
 * publish validation and policy fixes. Runs the real migrations on PGlite
 * (not on a live Supabase project).
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addAuthUser, asUser, createMigratedDb, rows } from "./helpers/db";

const U = {
  one: "f0000000-0000-0000-0000-000000000001",
  two: "f0000000-0000-0000-0000-000000000002",
  three: "f0000000-0000-0000-0000-000000000003",
};

describe("admin bootstrap and last-admin protection", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createMigratedDb();
    await addAuthUser(db, U.one, "first@example.test", '{"role":"admin"}');
    await addAuthUser(db, U.two, "second@example.test");
    await addAuthUser(db, U.three, "third@example.test");
  });
  afterAll(async () => {
    await db.close();
  });

  it("new users (even with role metadata) start as pending students and are audited", async () => {
    const [p] = await rows(db, `select role, status from public.profiles where id=$1`, [U.one]);
    expect(p).toEqual({ role: "student", status: "pending" });
    const created = await rows(db, `select 1 from public.audit_logs where action='profile.created' and target_id=$1`, [U.one]);
    expect(created).toHaveLength(1);
  });

  it("bootstrap cannot be called from an end-user session, even by the user being promoted", async () => {
    await asUser(db, U.one, async () => {
      await expect(db.query(`select public.bootstrap_first_admin('first@example.test')`)).rejects.toThrow();
    });
    await asUser(db, U.two, async () => {
      await expect(db.query(`select public.bootstrap_first_admin('second@example.test')`)).rejects.toThrow();
    });
    const admins = await rows(db, `select 1 from public.profiles where role='admin'`);
    expect(admins).toHaveLength(0);
  });

  it("bootstrap fails clearly for an unknown email", async () => {
    await expect(db.query(`select public.bootstrap_first_admin('nobody@example.test')`)).rejects.toThrow(/no user with that email/);
  });

  it("bootstrap promotes an existing user from a trusted session and writes an audit record", async () => {
    await db.query(`select public.bootstrap_first_admin('  FIRST@example.test ')`);
    const [p] = await rows(db, `select role, status from public.profiles where id=$1`, [U.one]);
    expect(p).toEqual({ role: "admin", status: "active" });
    const audit = await rows(db, `select 1 from public.audit_logs where action='admin.bootstrap' and target_id=$1`, [U.one]);
    expect(audit).toHaveLength(1);
    const change = await rows(db, `select metadata from public.audit_logs where action='profile.role_status_changed' and target_id=$1`, [U.one]);
    expect(change[0]?.metadata).toMatchObject({ old_role: "student", new_role: "admin", new_status: "active" });
  });

  it("bootstrap refuses to run again once an active admin exists", async () => {
    await expect(db.query(`select public.bootstrap_first_admin('second@example.test')`)).rejects.toThrow(/already exists/);
  });

  it("the last active administrator cannot be demoted, suspended or deleted", async () => {
    await expect(db.query(`update public.profiles set role='student' where id=$1`, [U.one])).rejects.toThrow(/last active administrator/);
    await expect(db.query(`update public.profiles set status='suspended' where id=$1`, [U.one])).rejects.toThrow(/last active administrator/);
    await expect(db.query(`delete from auth.users where id=$1`, [U.one])).rejects.toThrow(/last active administrator/);
    const [p] = await rows(db, `select role, status from public.profiles where id=$1`, [U.one]);
    expect(p).toEqual({ role: "admin", status: "active" });
  });

  it("with a second active admin, the first can be demoted (and it is audited)", async () => {
    await db.query(`update public.profiles set role='admin', status='active' where id=$1`, [U.two]);
    await db.query(`update public.profiles set role='teacher' where id=$1`, [U.one]);
    const [p] = await rows(db, `select role from public.profiles where id=$1`, [U.one]);
    expect(p?.role).toBe("teacher");
    const demotion = await rows(db, `select 1 from public.audit_logs where action='profile.role_status_changed' and metadata->>'new_role'='teacher'`);
    expect(demotion).toHaveLength(1);
  });

  it("an admin session can read the audit trail; a demoted/other user cannot; nobody can write it", async () => {
    await asUser(db, U.two, async () => {
      expect((await rows(db, `select id from public.audit_logs`)).length).toBeGreaterThan(0);
      await expect(db.query(`insert into public.audit_logs (action) values ('forged')`)).rejects.toThrow();
    });
    await asUser(db, U.three, async () => {
      expect(await rows(db, `select id from public.audit_logs`)).toHaveLength(0);
    });
  });
});

describe("publish validation and policy fixes", () => {
  let db: PGlite;
  const T = {
    admin: "e1000000-0000-0000-0000-000000000001",
    teacher: "e1000000-0000-0000-0000-000000000002",
    other: "e1000000-0000-0000-0000-000000000003",
  };
  const G = "e2000000-0000-0000-0000-00000000000a";
  const COURSE = "e3000000-0000-0000-0000-000000000001";
  const TOPIC = "e4000000-0000-0000-0000-000000000001";
  const LESSON = "e5000000-0000-0000-0000-000000000001";

  beforeAll(async () => {
    db = await createMigratedDb();
    for (const [id, n] of [[T.admin, "admin"], [T.teacher, "teacher"], [T.other, "other"]] as const) {
      await addAuthUser(db, id, `${n}@example.test`);
    }
    await db.exec(`
      update public.profiles set role='admin', status='active' where id='${T.admin}';
      update public.profiles set role='teacher', status='active' where id in ('${T.teacher}','${T.other}');
      insert into public.groups (id, name) values ('${G}','A');
      insert into public.teacher_assignments (teacher_id, group_id) values ('${T.teacher}','${G}');
      insert into public.subjects (slug, name) values ('math','Mathematics');
      insert into public.courses (id, subject_id, title, created_by)
        select '${COURSE}', id, 'Algebra', '${T.teacher}' from public.subjects limit 1;
      insert into public.topics (id, course_id, title) values ('${TOPIC}','${COURSE}','Linear');
      insert into public.lessons (id, topic_id, title, created_by) values ('${LESSON}','${TOPIC}','L1','${T.teacher}');
    `);
  });
  afterAll(async () => {
    await db.close();
  });

  it("an exam cannot be published without a group, questions, answer keys or while flagged for review", async () => {
    await asUser(db, T.teacher, async () => {
      const exam = (await db.query<{ id: string }>(
        `insert into public.mock_exams (title, group_id, created_by) values ('E','${G}','${T.teacher}') returning id`)).rows[0]!.id;
      const publish = () => db.query(`update public.mock_exams set status='published' where id='${exam}'`);

      await expect(publish()).rejects.toThrow(/at least one question/);

      const q = (await db.query<{ id: string }>(
        `insert into public.mock_questions (exam_id, position, kind, prompt, choices, needs_review)
         values ('${exam}',1,'multiple_choice','1+1?','["1","2"]',true) returning id`)).rows[0]!.id;
      await expect(publish()).rejects.toThrow(/answer key/);

      await db.query(`insert into public.mock_answer_keys (mock_question_id, correct_answer) values ('${q}','"2"')`);
      await expect(publish()).rejects.toThrow(/flagged for review/);

      await db.query(`update public.mock_questions set needs_review=false where id='${q}'`);
      await publish(); // now valid
      const [e] = await rows(db, `select status, published_at is not null as has_ts from public.mock_exams where id='${exam}'`);
      expect(e).toEqual({ status: "published", has_ts: true });
    });
  });

  it("an exam without a target group cannot be published", async () => {
    await asUser(db, T.teacher, async () => {
      const exam = (await db.query<{ id: string }>(
        `insert into public.mock_exams (title, created_by) values ('NoGroup','${T.teacher}') returning id`)).rows[0]!.id;
      await expect(db.query(`update public.mock_exams set status='published' where id='${exam}'`)).rejects.toThrow(/target a group/);
    });
  });

  it("an administrator can edit a lesson written by a teacher; an unrelated teacher cannot", async () => {
    await asUser(db, T.admin, async () => {
      const r = await db.query(`update public.lessons set title='Edited by admin' where id='${LESSON}'`);
      expect(r.affectedRows).toBe(1);
    });
    await asUser(db, T.other, async () => {
      const r = await db.query(`update public.lessons set title='Hijacked' where id='${LESSON}'`);
      expect(r.affectedRows).toBe(0);
    });
    const [l] = await rows(db, `select title from public.lessons where id='${LESSON}'`);
    expect(l?.title).toBe("Edited by admin");
  });

  it("a teacher cannot transfer a course to someone else by rewriting created_by", async () => {
    await asUser(db, T.teacher, async () => {
      await expect(db.query(`update public.courses set created_by='${T.other}' where id='${COURSE}'`)).rejects.toThrow();
      const ok = await db.query(`update public.courses set title='Algebra I' where id='${COURSE}'`);
      expect(ok.affectedRows).toBe(1);
    });
  });
});
