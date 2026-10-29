/**
 * Database-level security tests. They run the REAL migrations against an
 * in-process PostgreSQL (PGlite) with a minimal stand-in for Supabase's `auth`
 * schema and roles, then act as different users via `set role authenticated`
 * and a simulated JWT subject.
 *
 * Caveat: this validates the SQL policies on PGlite, not a live Supabase project.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ID = {
  admin: "a0000000-0000-0000-0000-000000000001",
  teacherA: "a0000000-0000-0000-0000-000000000002",
  teacherB: "a0000000-0000-0000-0000-000000000003",
  s1: "a0000000-0000-0000-0000-000000000011", // group A
  s2: "a0000000-0000-0000-0000-000000000012", // group A
  s3: "a0000000-0000-0000-0000-000000000013", // group B
  pending: "a0000000-0000-0000-0000-000000000014",
};
const G = { a: "b0000000-0000-0000-0000-00000000000a", b: "b0000000-0000-0000-0000-00000000000b" };

let db: PGlite;

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`);
  }
}
const rows = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(), email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);

  const dir = path.resolve(__dirname, "../supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }

  const users: [string, string][] = [
    [ID.admin, "admin"], [ID.teacherA, "ta"], [ID.teacherB, "tb"],
    [ID.s1, "s1"], [ID.s2, "s2"], [ID.s3, "s3"], [ID.pending, "pending"],
  ];
  for (const [id, name] of users) {
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
      values ('${id}', '${name}@example.test', '{"full_name":"${name}"}')`);
  }
  // Trusted promotion (no JWT subject => trusted server context).
  await db.exec(`
    update public.profiles set role='admin', status='active' where id='${ID.admin}';
    update public.profiles set role='teacher', status='active' where id in ('${ID.teacherA}','${ID.teacherB}');
    update public.profiles set status='active' where id in ('${ID.s1}','${ID.s2}','${ID.s3}');
    insert into public.groups (id, name) values ('${G.a}','A'), ('${G.b}','B');
    insert into public.group_members (group_id, user_id) values
      ('${G.a}','${ID.s1}'), ('${G.a}','${ID.s2}'), ('${G.b}','${ID.s3}');
    insert into public.teacher_assignments (teacher_id, group_id) values
      ('${ID.teacherA}','${G.a}'), ('${ID.teacherB}','${G.b}');
    insert into public.subjects (slug, name) values ('math','Mathematics');
  `);
});

afterAll(async () => {
  await db.close();
});

describe("registration and roles", () => {
  it("creates a PENDING STUDENT even when metadata asks for admin", async () => {
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
      values ('a0000000-0000-0000-0000-0000000000ff','evil@example.test','{"role":"admin","status":"active","full_name":"Evil"}')`);
    const [p] = await rows(`select role, status from public.profiles where id='a0000000-0000-0000-0000-0000000000ff'`);
    expect(p).toEqual({ role: "student", status: "pending" });
  });

  it("lets a user read their own profile while pending, but nothing else", async () => {
    await as(ID.pending, async () => {
      expect(await rows(`select id from public.profiles`)).toHaveLength(1);
      expect(await rows(`select id from public.subjects`)).toHaveLength(0);
      expect(await rows(`select id from public.groups`)).toHaveLength(0);
    });
  });

  it("prevents a student from escalating their own role or status", async () => {
    await as(ID.s1, async () => {
      await expect(db.query(`update public.profiles set role='admin' where id='${ID.s1}'`)).rejects.toThrow();
      await expect(db.query(`update public.profiles set status='active' where id='${ID.pending}'`)).rejects.toThrow();
    });
    await as(ID.pending, async () => {
      await expect(db.query(`update public.profiles set status='active' where id='${ID.pending}'`)).rejects.toThrow();
    });
    const [p] = await rows(`select role from public.profiles where id='${ID.s1}'`);
    expect(p?.role).toBe("student");
  });

  it("prevents a teacher from promoting themselves to admin", async () => {
    await as(ID.teacherA, async () => {
      await expect(db.query(`update public.profiles set role='admin' where id='${ID.teacherA}'`)).rejects.toThrow();
    });
  });

  it("allows a user to change their own display name only", async () => {
    await as(ID.s1, async () => {
      await db.query(`update public.profiles set full_name='New Name' where id='${ID.s1}'`);
    });
    const [p] = await rows(`select full_name from public.profiles where id='${ID.s1}'`);
    expect(p?.full_name).toBe("New Name");
  });
});

describe("group isolation", () => {
  it("students cannot see other students' profiles", async () => {
    await as(ID.s1, async () => {
      expect(await rows(`select id from public.profiles`)).toHaveLength(1);
    });
  });

  it("teachers see only students of their assigned groups", async () => {
    await as(ID.teacherA, async () => {
      const ids = (await rows(`select id from public.profiles`)).map((r) => r.id);
      expect(ids).toContain(ID.s1);
      expect(ids).toContain(ID.s2);
      expect(ids).not.toContain(ID.s3);
      expect(ids).not.toContain(ID.teacherB);
      const groups = (await rows(`select id from public.groups`)).map((r) => r.id);
      expect(groups).toEqual([G.a]);
    });
  });

  it("students see only their own group and membership rows", async () => {
    await as(ID.s3, async () => {
      expect((await rows(`select id from public.groups`)).map((r) => r.id)).toEqual([G.b]);
      expect(await rows(`select user_id from public.group_members`)).toHaveLength(1);
    });
  });

  it("non-admins cannot modify groups, memberships or assignments", async () => {
    for (const uid of [ID.teacherA, ID.s1]) {
      await as(uid, async () => {
        await expect(db.query(`insert into public.groups (name) values ('X')`)).rejects.toThrow();
        await expect(db.query(`insert into public.group_members (group_id,user_id) values ('${G.b}','${ID.s1}')`)).rejects.toThrow();
        await expect(db.query(`insert into public.teacher_assignments (teacher_id,group_id) values ('${ID.teacherA}','${G.b}')`)).rejects.toThrow();
      });
    }
  });
});

describe("examinations", () => {
  let examId = "";
  let q1 = "";

  it("a teacher can draft an exam for their own group but not another group", async () => {
    await as(ID.teacherA, async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.mock_exams (title, group_id, created_by, reveal_answers)
         values ('Algebra 1','${G.a}','${ID.teacherA}','after_submission') returning id`);
      examId = r.rows[0]!.id;
      const q = await db.query<{ id: string }>(
        `insert into public.mock_questions (exam_id, position, kind, prompt, choices)
         values ('${examId}',1,'multiple_choice','2+2?','["3","4"]') returning id`);
      q1 = q.rows[0]!.id;
      await db.query(`insert into public.mock_answer_keys (mock_question_id, correct_answer) values ('${q1}','"4"')`);
      await expect(
        db.query(`insert into public.mock_exams (title, group_id, created_by) values ('Bad','${G.b}','${ID.teacherA}')`),
      ).rejects.toThrow();
    });
  });

  it("students cannot create exams, questions or answer keys", async () => {
    await as(ID.s1, async () => {
      await expect(db.query(`insert into public.mock_exams (title, group_id, created_by) values ('Mine','${G.a}','${ID.s1}')`)).rejects.toThrow();
      await expect(db.query(`insert into public.mock_questions (exam_id, position, kind, prompt, choices) values ('${examId}',2,'multiple_choice','x','[]')`)).rejects.toThrow();
      await expect(db.query(`insert into public.mock_answer_keys (mock_question_id, correct_answer) values ('${q1}','"3"')`)).rejects.toThrow();
    });
  });

  it("students cannot see draft exams", async () => {
    await as(ID.s1, async () => {
      expect(await rows(`select id from public.mock_exams`)).toHaveLength(0);
    });
  });

  it("publishing makes the exam, its questions and keys immutable", async () => {
    await as(ID.teacherA, async () => {
      await db.query(`update public.mock_exams set status='published' where id='${examId}'`);
      await expect(db.query(`update public.mock_exams set title='Changed' where id='${examId}'`)).rejects.toThrow(/immutable/);
      await expect(db.query(`update public.mock_exams set status='draft' where id='${examId}'`)).rejects.toThrow();
      await expect(db.query(`insert into public.mock_questions (exam_id, position, kind, prompt, choices) values ('${examId}',2,'multiple_choice','x','[]')`)).rejects.toThrow(/immutable/);
      await expect(db.query(`update public.mock_answer_keys set correct_answer='"3"' where mock_question_id='${q1}'`)).rejects.toThrow(/immutable/);
      await expect(db.query(`delete from public.mock_exams where id='${examId}'`)).rejects.toThrow();
    });
  });

  it("students in the group see the published exam but not questions without an attempt", async () => {
    await as(ID.s1, async () => {
      expect(await rows(`select id from public.mock_exams`)).toHaveLength(1);
      expect(await rows(`select id from public.mock_questions`)).toHaveLength(0);
      expect(await rows(`select * from public.mock_answer_keys`)).toHaveLength(0);
    });
    await as(ID.s3, async () => {
      expect(await rows(`select id from public.mock_exams`)).toHaveLength(0);
    });
  });

  it("answer keys stay hidden during an attempt and are revealed only after submission", async () => {
    // Attempts are created by trusted server code.
    await db.exec(`insert into public.attempts (exam_id, student_id) values ('${examId}','${ID.s1}')`);
    await as(ID.s1, async () => {
      expect(await rows(`select id from public.mock_questions`)).toHaveLength(1);
      expect(await rows(`select * from public.mock_answer_keys`)).toHaveLength(0);
    });
    await db.exec(`update public.attempts set status='submitted', submitted_at=now() where student_id='${ID.s1}'`);
    await as(ID.s1, async () => {
      expect(await rows(`select * from public.mock_answer_keys`)).toHaveLength(1);
    });
    // Another student in the group with no attempt still sees nothing.
    await as(ID.s2, async () => {
      expect(await rows(`select * from public.mock_answer_keys`)).toHaveLength(0);
    });
  });

  it("students cannot forge or alter attempts and scores", async () => {
    await as(ID.s1, async () => {
      await expect(db.query(`insert into public.attempts (exam_id, student_id, status, score, max_score) values ('${examId}','${ID.s1}','graded',10,10)`)).rejects.toThrow();
      await expect(db.query(`update public.attempts set score=10, max_score=10 where student_id='${ID.s1}'`)).rejects.toThrow();
    });
  });

  it("attempts are visible to the owner and assigned teacher only", async () => {
    await as(ID.s1, async () => expect(await rows(`select id from public.attempts`)).toHaveLength(1));
    await as(ID.s2, async () => expect(await rows(`select id from public.attempts`)).toHaveLength(0));
    await as(ID.teacherA, async () => expect(await rows(`select id from public.attempts`)).toHaveLength(1));
    await as(ID.teacherB, async () => expect(await rows(`select id from public.attempts`)).toHaveLength(0));
  });

  it("a new version copies questions and keys and keeps the old version intact", async () => {
    let newId = "";
    await as(ID.teacherA, async () => {
      const r = await db.query<{ v: string }>(`select public.create_exam_version('${examId}') as v`);
      newId = r.rows[0]!.v;
      await db.query(`update public.mock_exams set title='Algebra 1 v2' where id='${newId}'`);
    });
    const [v] = await rows(`select version, status, exam_key = (select exam_key from public.mock_exams where id='${examId}') as same_key from public.mock_exams where id='${newId}'`);
    expect(v).toMatchObject({ version: 2, status: "draft", same_key: true });
    expect(await rows(`select 1 from public.mock_questions where exam_id='${newId}'`)).toHaveLength(1);
    expect(await rows(`select 1 from public.mock_answer_keys k join public.mock_questions q on q.id=k.mock_question_id where q.exam_id='${newId}'`)).toHaveLength(1);
    const [old] = await rows(`select title from public.mock_exams where id='${examId}'`);
    expect(old?.title).toBe("Algebra 1");
  });

  it("another teacher cannot version or edit this teacher's exam", async () => {
    await as(ID.teacherB, async () => {
      await expect(db.query(`select public.create_exam_version('${examId}')`)).rejects.toThrow();
    });
  });
});

describe("communication", () => {
  let convo = "";
  beforeAll(async () => {
    const r = await db.query<{ id: string }>(`insert into public.conversations (kind) values ('direct') returning id`);
    convo = r.rows[0]!.id;
    await db.exec(`
      insert into public.conversation_members (conversation_id, user_id) values ('${convo}','${ID.s1}'), ('${convo}','${ID.teacherA}');
      insert into public.messages (conversation_id, sender_id, body) values ('${convo}','${ID.s1}','hello');`);
  });

  it("members can read and send; non-members cannot", async () => {
    await as(ID.teacherA, async () => {
      expect(await rows(`select id from public.messages`)).toHaveLength(1);
      await db.query(`insert into public.messages (conversation_id, sender_id, body) values ('${convo}','${ID.teacherA}','hi')`);
    });
    await as(ID.s2, async () => {
      expect(await rows(`select id from public.messages`)).toHaveLength(0);
      expect(await rows(`select id from public.conversations`)).toHaveLength(0);
      await expect(db.query(`insert into public.messages (conversation_id, sender_id, body) values ('${convo}','${ID.s2}','intrude')`)).rejects.toThrow();
    });
  });

  it("members cannot impersonate another sender; admins have no blanket access", async () => {
    await as(ID.s1, async () => {
      await expect(db.query(`insert into public.messages (conversation_id, sender_id, body) values ('${convo}','${ID.teacherA}','fake')`)).rejects.toThrow();
    });
    await as(ID.admin, async () => {
      expect(await rows(`select id from public.messages`)).toHaveLength(0);
    });
  });

  it("clients cannot create conversations or add themselves as members", async () => {
    await as(ID.s2, async () => {
      await expect(db.query(`insert into public.conversations (kind) values ('direct')`)).rejects.toThrow();
      await expect(db.query(`insert into public.conversation_members (conversation_id, user_id) values ('${convo}','${ID.s2}')`)).rejects.toThrow();
    });
  });
});

describe("operations tables and analytics", () => {
  it("audit logs are admin-readable only and never client-writable", async () => {
    await db.exec(`insert into public.audit_logs (actor_id, action) values ('${ID.admin}','test')`);
    await as(ID.admin, async () => expect(await rows(`select id from public.audit_logs where action='test'`)).toHaveLength(1));
    await as(ID.teacherA, async () => {
      expect(await rows(`select id from public.audit_logs`)).toHaveLength(0);
      await expect(db.query(`insert into public.audit_logs (action) values ('forged')`)).rejects.toThrow();
    });
    await as(ID.admin, async () => {
      await expect(db.query(`insert into public.audit_logs (action) values ('forged')`)).rejects.toThrow();
    });
  });

  it("students cannot write mastery or error records, and cannot read another student's", async () => {
    const [t] = await rows(`select 1`);
    expect(t).toBeDefined();
    await db.exec(`
      insert into public.courses (id, subject_id, title, created_by)
        select 'c0000000-0000-0000-0000-000000000001', id, 'Algebra', '${ID.teacherA}' from public.subjects limit 1;
      insert into public.topics (id, course_id, title) values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Linear');
      insert into public.skill_mastery (student_id, topic_id, evidence_count, correct_count) values
        ('${ID.s1}','d0000000-0000-0000-0000-000000000001',3,2),
        ('${ID.s2}','d0000000-0000-0000-0000-000000000001',1,1);`);
    await as(ID.s1, async () => {
      expect(await rows(`select student_id from public.skill_mastery`)).toEqual([{ student_id: ID.s1 }]);
      await expect(db.query(`update public.skill_mastery set correct_count=3 where student_id='${ID.s1}'`)).rejects.toThrow();
      await expect(db.query(`insert into public.error_records (student_id, category, source) values ('${ID.s1}','x','deterministic')`)).rejects.toThrow();
    });
    await as(ID.teacherB, async () => expect(await rows(`select 1 from public.skill_mastery`)).toHaveLength(0));
    await as(ID.teacherA, async () => expect(await rows(`select 1 from public.skill_mastery`)).toHaveLength(2));
  });

  it("students see only published content and never question answer keys", async () => {
    await as(ID.s1, async () => expect(await rows(`select 1 from public.courses`)).toHaveLength(0));
    await db.exec(`update public.courses set is_published=true;
      insert into public.questions (id, topic_id, kind, prompt, status, created_by)
        values ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','open_response','Solve x+1=2','approved','${ID.teacherA}');
      insert into public.question_answer_keys (question_id, correct_answer) values ('e0000000-0000-0000-0000-000000000001','"1"');`);
    await as(ID.s1, async () => {
      expect(await rows(`select 1 from public.courses`)).toHaveLength(1);
      expect(await rows(`select 1 from public.questions`)).toHaveLength(1);
      expect(await rows(`select 1 from public.question_answer_keys`)).toHaveLength(0);
    });
  });

  it("anonymous role has no table access at all", async () => {
    await db.exec(`set role anon`);
    try {
      await expect(db.query(`select * from public.profiles`)).rejects.toThrow();
      await expect(db.query(`select * from public.subjects`)).rejects.toThrow();
    } finally {
      await db.exec(`reset role`);
    }
  });
});
