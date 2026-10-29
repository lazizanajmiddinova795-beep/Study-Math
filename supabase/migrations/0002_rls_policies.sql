-- =============================================================================
-- 0002_rls_policies.sql
-- Authorization: helper functions, grants, immutability triggers, RLS policies.
--
-- Principles
--   * Default deny. Every table has RLS enabled; no policy => no access.
--   * Table privileges are revoked from anon/authenticated and re-granted
--     narrowly (defence in depth on top of RLS).
--   * Only ACTIVE accounts have a role. Pending/suspended users get NULL from
--     app_role(), so every role-based policy denies them.
--   * Privileged writes (role changes, scoring, analytics, audit, AI usage,
--     conversation creation, attempts) are server-only via the service role,
--     which bypasses RLS and is never exposed to browsers.
-- =============================================================================

-- ---------- Helper functions (SECURITY DEFINER, fixed search_path) ---------------
-- They read tables directly (bypassing RLS) so policies never recurse.

create function public.app_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.app_role() = 'admin', false) $$;

create function public.is_teacher() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.app_role() = 'teacher', false) $$;

create function public.is_student() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.app_role() = 'student', false) $$;

create function public.teacher_manages_group(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_teacher() and exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = auth.uid() and ta.group_id = gid)
$$;

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.app_role() is not null and exists (
    select 1 from public.group_members gm
    where gm.user_id = auth.uid() and gm.group_id = gid)
$$;

create function public.teacher_manages_student(sid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_teacher() and exists (
    select 1
    from public.group_members gm
    join public.teacher_assignments ta on ta.group_id = gm.group_id
    where gm.user_id = sid and ta.teacher_id = auth.uid())
$$;

-- Own records (active students) + admins + the student's assigned teachers.
create function public.can_access_student(sid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select (sid = auth.uid() and public.is_student())
      or public.is_admin()
      or public.teacher_manages_student(sid)
$$;

create function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.app_role() is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = cid and cm.user_id = auth.uid())
$$;

create function public.shares_conversation_with(uid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.app_role() is not null and exists (
    select 1
    from public.conversation_members mine
    join public.conversation_members theirs on theirs.conversation_id = mine.conversation_id
    where mine.user_id = auth.uid() and theirs.user_id = uid)
$$;

-- Content visibility
create function public.can_view_course(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.app_role() is not null and exists (
    select 1 from public.courses c
    where c.id = cid
      and (c.is_published or c.created_by = auth.uid() or public.is_admin()))
$$;

create function public.can_edit_course(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (public.is_teacher() and exists (
    select 1 from public.courses c where c.id = cid and c.created_by = auth.uid()))
$$;

create function public.course_of_topic(tid uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select t.course_id from public.topics t where t.id = tid $$;

-- Exam access
create function public.owns_exam(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (public.is_teacher() and exists (
    select 1 from public.mock_exams e where e.id = eid and e.created_by = auth.uid()))
$$;

create function public.staff_can_view_exam(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.owns_exam(eid) or (public.is_teacher() and exists (
    select 1 from public.mock_exams e
    where e.id = eid and e.group_id is not null and public.teacher_manages_group(e.group_id)))
$$;

create function public.student_can_view_exam(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_student() and exists (
    select 1 from public.mock_exams e
    where e.id = eid and e.status in ('published', 'archived')
      and e.group_id is not null and public.is_group_member(e.group_id))
$$;

create function public.student_has_attempt(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_student() and exists (
    select 1 from public.attempts a where a.exam_id = eid and a.student_id = auth.uid())
$$;

create function public.exam_of_mock_question(qid uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select q.exam_id from public.mock_questions q where q.id = qid $$;

-- A student may read an answer key only after SUBMITTING and only if the exam
-- reveal policy allows it.
create function public.student_can_see_key(qid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_student() and exists (
    select 1
    from public.mock_questions q
    join public.mock_exams e on e.id = q.exam_id
    join public.attempts a on a.exam_id = e.id
    where q.id = qid
      and a.student_id = auth.uid()
      and a.status in ('submitted', 'graded')
      and e.reveal_answers = 'after_submission')
$$;

create function public.can_access_attempt(aid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.attempts a
    where a.id = aid and public.can_access_student(a.student_id))
$$;

-- ---------- Protect privileged profile columns -------------------------------------
-- Defence in depth: column grants already stop clients from updating role/status.
-- This trigger additionally blocks any non-admin end-user session (a request that
-- carries a user identity). Trusted server code (service role / SQL editor) has
-- no auth.uid() and is allowed.
create function public.guard_profile_privileged_columns() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.id is distinct from old.id
       or new.email is distinct from old.email then
      raise exception 'insufficient privilege to change protected profile fields'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------- Exam immutability / versioning ------------------------------------------
create function public.guard_mock_exam_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    if old.status = 'archived' then
      raise exception 'archived exams are immutable' using errcode = '23514';
    end if;
    if new.status not in ('published', 'archived') then
      raise exception 'a published exam cannot return to draft' using errcode = '23514';
    end if;
    if (to_jsonb(new) - array['status', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'published exams are immutable; create a new version' using errcode = '23514';
    end if;
  elsif new.status = 'published' then
    new.published_at = now();
  elsif new.status = 'archived' then
    raise exception 'only published exams can be archived' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger mock_exams_guard_update
  before update on public.mock_exams
  for each row execute function public.guard_mock_exam_update();

create function public.guard_mock_exam_delete() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'only draft exams can be deleted' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger mock_exams_guard_delete
  before delete on public.mock_exams
  for each row execute function public.guard_mock_exam_delete();

create function public.guard_mock_exam_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status <> 'draft' then
    raise exception 'exams must be created as drafts' using errcode = '23514';
  end if;
  new.published_at = null;
  return new;
end;
$$;
create trigger mock_exams_guard_insert
  before insert on public.mock_exams
  for each row execute function public.guard_mock_exam_insert();

-- Questions and answer keys may only change while their exam is a draft.
-- (If the parent is already gone, a cascading delete is in progress: allow.)
create function public.guard_mock_question_draft() returns trigger
language plpgsql set search_path = ''
as $$
declare
  s public.exam_status;
  eid uuid;
begin
  if tg_op = 'DELETE' then eid := old.exam_id; else eid := new.exam_id; end if;
  select e.status into s from public.mock_exams e where e.id = eid;
  if s is not null and s <> 'draft' then
    raise exception 'questions of a published exam are immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger mock_questions_guard_draft
  before insert or update or delete on public.mock_questions
  for each row execute function public.guard_mock_question_draft();

create function public.guard_mock_key_draft() returns trigger
language plpgsql set search_path = ''
as $$
declare
  s public.exam_status;
  qid uuid;
begin
  if tg_op = 'DELETE' then qid := old.mock_question_id; else qid := new.mock_question_id; end if;
  select e.status into s
  from public.mock_questions q
  join public.mock_exams e on e.id = q.exam_id
  where q.id = qid;
  if s is not null and s <> 'draft' then
    raise exception 'answer keys of a published exam are immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger mock_answer_keys_guard_draft
  before insert or update or delete on public.mock_answer_keys
  for each row execute function public.guard_mock_key_draft();

-- Creates version N+1 of an exam as a draft, copying questions and keys.
-- SECURITY INVOKER: RLS applies, so only an exam owner can do this.
create function public.create_exam_version(source_exam uuid) returns uuid
language plpgsql set search_path = ''
as $$
declare
  src public.mock_exams;
  new_id uuid;
begin
  select * into src from public.mock_exams where id = source_exam;
  if not found or not public.owns_exam(source_exam) then
    raise exception 'exam not found' using errcode = '42501';
  end if;
  if src.status = 'draft' then
    raise exception 'draft exams can be edited directly' using errcode = '23514';
  end if;

  insert into public.mock_exams (
    exam_key, version, title, description, course_id, group_id, status,
    duration_minutes, reveal_answers, external_tools_allowed, created_by)
  values (
    src.exam_key,
    (select max(version) + 1 from public.mock_exams where exam_key = src.exam_key),
    src.title, src.description, src.course_id, src.group_id, 'draft',
    src.duration_minutes, src.reveal_answers, src.external_tools_allowed, auth.uid())
  returning id into new_id;

  insert into public.mock_questions (exam_id, position, kind, prompt, choices, points, needs_review)
  select new_id, q.position, q.kind, q.prompt, q.choices, q.points, q.needs_review
  from public.mock_questions q where q.exam_id = source_exam;

  -- Separate statement: RLS helper functions cannot see rows created by the
  -- same statement (e.g. via a data-modifying CTE).
  insert into public.mock_answer_keys (mock_question_id, correct_answer, explanation)
  select nq.id, k.correct_answer, k.explanation
  from public.mock_questions nq
  join public.mock_questions oq on oq.exam_id = source_exam and oq.position = nq.position
  join public.mock_answer_keys k on k.mock_question_id = oq.id
  where nq.exam_id = new_id;

  return new_id;
end;
$$;

-- ---------- Privileges ----------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

grant usage on schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- Trigger-only functions must not be callable directly.
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.guard_profile_privileged_columns() from authenticated;

grant select on
  public.profiles, public.groups, public.group_members, public.teacher_assignments,
  public.subjects, public.courses, public.topics, public.lessons, public.questions,
  public.question_answer_keys, public.mock_exams, public.mock_questions,
  public.mock_answer_keys, public.attempts, public.attempt_answers,
  public.skill_mastery, public.error_records, public.practice_sessions,
  public.conversations, public.conversation_members, public.messages,
  public.audit_logs, public.ai_usage, public.notifications
to authenticated;

-- Users may edit only their own display name.
grant update (full_name) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert on public.messages to authenticated;

-- Teacher/admin managed content (row-level rules below).
grant insert, update, delete on
  public.courses, public.topics, public.lessons, public.questions,
  public.question_answer_keys, public.mock_exams, public.mock_questions,
  public.mock_answer_keys
to authenticated;

-- Admin managed organisation data.
grant insert, update, delete on
  public.subjects, public.groups, public.group_members, public.teacher_assignments
to authenticated;

-- ---------- Enable RLS on every table ----------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.groups               enable row level security;
alter table public.group_members        enable row level security;
alter table public.teacher_assignments  enable row level security;
alter table public.subjects             enable row level security;
alter table public.courses              enable row level security;
alter table public.topics               enable row level security;
alter table public.lessons              enable row level security;
alter table public.questions            enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.mock_exams           enable row level security;
alter table public.mock_questions       enable row level security;
alter table public.mock_answer_keys     enable row level security;
alter table public.attempts             enable row level security;
alter table public.attempt_answers      enable row level security;
alter table public.skill_mastery        enable row level security;
alter table public.error_records        enable row level security;
alter table public.practice_sessions    enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.ai_usage             enable row level security;
alter table public.notifications        enable row level security;

-- ---------- Policies: identity and organization --------------------------------------------
-- A user can always read their own profile (even while pending, so the UI can say so).
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.teacher_manages_student(id)
    or public.shares_conversation_with(id)
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy groups_select on public.groups for select to authenticated
  using (public.is_admin() or public.teacher_manages_group(id) or public.is_group_member(id));
create policy groups_admin_write on public.groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy group_members_select on public.group_members for select to authenticated
  using (
    public.is_admin()
    or public.teacher_manages_group(group_id)
    or (user_id = auth.uid() and public.app_role() is not null)
  );
create policy group_members_admin_write on public.group_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy teacher_assignments_select on public.teacher_assignments for select to authenticated
  using (public.is_admin() or (teacher_id = auth.uid() and public.is_teacher()));
create policy teacher_assignments_admin_write on public.teacher_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Policies: educational content ------------------------------------------------------
create policy subjects_select on public.subjects for select to authenticated
  using (public.app_role() is not null);
create policy subjects_admin_write on public.subjects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- NOTE: helper functions are STABLE and cannot see a row inserted by the same
-- statement, so INSERT ... RETURNING would fail. The creator is therefore checked
-- directly on the row's own columns as well.
create policy courses_select on public.courses for select to authenticated
  using ((created_by = auth.uid() and public.app_role() is not null) or public.can_view_course(id));
create policy courses_insert on public.courses for insert to authenticated
  with check ((public.is_teacher() or public.is_admin()) and created_by = auth.uid());
create policy courses_update on public.courses for update to authenticated
  using (public.can_edit_course(id)) with check (public.can_edit_course(id));
create policy courses_delete on public.courses for delete to authenticated
  using (public.can_edit_course(id));

create policy topics_select on public.topics for select to authenticated
  using (public.can_view_course(course_id));
create policy topics_write on public.topics for all to authenticated
  using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));

create policy lessons_select on public.lessons for select to authenticated
  using (
    public.can_view_course(public.course_of_topic(topic_id))
    and (is_published or public.can_edit_course(public.course_of_topic(topic_id)))
  );
create policy lessons_write on public.lessons for all to authenticated
  using (public.can_edit_course(public.course_of_topic(topic_id)))
  with check (
    public.can_edit_course(public.course_of_topic(topic_id)) and created_by = auth.uid()
  );

create policy questions_select on public.questions for select to authenticated
  using (
    public.can_view_course(public.course_of_topic(topic_id))
    and (
      status = 'approved'
      or public.can_edit_course(public.course_of_topic(topic_id))
      or created_by = auth.uid()
    )
  );
create policy questions_write on public.questions for all to authenticated
  using ((created_by = auth.uid() and public.is_teacher()) or public.is_admin())
  with check ((created_by = auth.uid() and public.is_teacher()) or public.is_admin());

-- Bank answer keys: staff who own the question only. Students never read them.
create policy question_keys_all on public.question_answer_keys for all to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id
         and ((q.created_by = auth.uid() and public.is_teacher()) or public.is_admin())))
  with check (exists (select 1 from public.questions q where q.id = question_id
         and ((q.created_by = auth.uid() and public.is_teacher()) or public.is_admin())));

-- ---------- Policies: examinations -------------------------------------------------------------------
create policy mock_exams_select on public.mock_exams for select to authenticated
  using (
    (created_by = auth.uid() and (public.is_teacher() or public.is_admin()))
    or public.is_admin()
    or (group_id is not null and public.teacher_manages_group(group_id))
    or public.student_can_view_exam(id)
  );
create policy mock_exams_insert on public.mock_exams for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_admin() or public.is_teacher())
    and (group_id is null or public.is_admin() or public.teacher_manages_group(group_id))
  );
create policy mock_exams_update on public.mock_exams for update to authenticated
  using (public.owns_exam(id))
  with check (
    public.owns_exam(id)
    and (group_id is null or public.is_admin() or public.teacher_manages_group(group_id))
  );
create policy mock_exams_delete on public.mock_exams for delete to authenticated
  using (public.owns_exam(id));

-- Students only see questions once THEY hold an attempt for that exam.
create policy mock_questions_select on public.mock_questions for select to authenticated
  using (
    public.staff_can_view_exam(exam_id)
    or (public.student_can_view_exam(exam_id) and public.student_has_attempt(exam_id))
  );
create policy mock_questions_write on public.mock_questions for all to authenticated
  using (public.owns_exam(exam_id)) with check (public.owns_exam(exam_id));

create policy mock_keys_select on public.mock_answer_keys for select to authenticated
  using (
    public.staff_can_view_exam(public.exam_of_mock_question(mock_question_id))
    or public.student_can_see_key(mock_question_id)
  );
create policy mock_keys_write on public.mock_answer_keys for all to authenticated
  using (public.owns_exam(public.exam_of_mock_question(mock_question_id)))
  with check (public.owns_exam(public.exam_of_mock_question(mock_question_id)));

-- Attempts and answers: read-only for clients. Creating attempts, saving
-- answers and scoring are performed by trusted server code (service role)
-- after it verifies group membership and exam rules.
create policy attempts_select on public.attempts for select to authenticated
  using (public.can_access_student(student_id));
create policy attempt_answers_select on public.attempt_answers for select to authenticated
  using (public.can_access_attempt(attempt_id));

-- ---------- Policies: analytics (read-only for clients) --------------------------------------------------
create policy skill_mastery_select on public.skill_mastery for select to authenticated
  using (public.can_access_student(student_id));
create policy error_records_select on public.error_records for select to authenticated
  using (public.can_access_student(student_id));
create policy practice_sessions_select on public.practice_sessions for select to authenticated
  using (public.can_access_student(student_id));

-- ---------- Policies: communication ------------------------------------------------------------------------
-- Membership is verified for every read and write. Admins have NO blanket access
-- to private conversations (moderation tooling is future work).
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
create policy conversation_members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id) and deleted_at is null);
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

-- ---------- Policies: operations ------------------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.is_admin());
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (public.is_admin() or (user_id = auth.uid() and public.app_role() is not null));
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
