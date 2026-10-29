-- =============================================================================
-- 0003_admin_bootstrap_and_hardening.sql
-- Safe admin bootstrap, last-admin protection, database-level audit of role
-- changes, and fixes found while reviewing 0001/0002.
-- Non-destructive: no table is dropped or truncated; no rows are deleted.
-- Apply AFTER 0001 and 0002.
-- =============================================================================

-- ---------- Never lose the last active administrator --------------------------------
create function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  removing boolean;
begin
  if old.role = 'admin' and old.status = 'active' then
    if tg_op = 'DELETE' then
      removing := true;
    else
      removing := new.role <> 'admin' or new.status <> 'active';
    end if;
    if removing and not exists (
      select 1 from public.profiles p
      where p.id <> old.id and p.role = 'admin' and p.status = 'active'
    ) then
      raise exception 'cannot demote, suspend or delete the last active administrator'
        using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

-- ---------- Tamper-resistant audit of identity changes -----------------------------------
-- Application code also writes audit rows (with the acting admin). This trigger is the
-- backstop: it records every profile creation and every role/status change, even
-- ones made directly in SQL. actor_id is NULL when no end-user session is involved.
create function public.audit_profile_changes() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'profile.created', 'profile', new.id::text,
            jsonb_build_object('role', new.role, 'status', new.status));
  elsif old.role is distinct from new.role or old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'profile.role_status_changed', 'profile', new.id::text,
            jsonb_build_object('old_role', old.role, 'new_role', new.role,
                               'old_status', old.status, 'new_status', new.status));
  end if;
  return new;
end;
$$;
create trigger profiles_audit
  after insert or update on public.profiles
  for each row execute function public.audit_profile_changes();

-- ---------- First-administrator bootstrap --------------------------------------------------
-- Run ONLY from the Supabase SQL Editor (a trusted session with no end-user JWT):
--     select public.bootstrap_first_admin('you@example.com');
-- Safeguards: refuses to run from any user session, refuses if an active admin already
-- exists (so it cannot be abused later), serialises concurrent calls, requires the
-- user to already exist in Supabase Auth, and writes an audit record. No default
-- password and no public endpoint are involved.
create function public.bootstrap_first_admin(target_email text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  matches integer;
  pid uuid;
begin
  perform pg_advisory_xact_lock(hashtext('bootstrap_first_admin'));

  if auth.uid() is not null then
    raise exception 'bootstrap must be run from a trusted SQL session' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where role = 'admin' and status = 'active') then
    raise exception 'an active administrator already exists; use the admin console' using errcode = '42501';
  end if;

  select count(*), min(id::text)::uuid into matches, pid
  from public.profiles where lower(email) = lower(btrim(target_email));
  if matches = 0 then
    raise exception 'no user with that email; create the user in Supabase Authentication first'
      using errcode = 'P0002';
  elsif matches > 1 then
    raise exception 'email matches more than one profile' using errcode = '23505';
  end if;

  update public.profiles set role = 'admin', status = 'active' where id = pid;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (null, 'admin.bootstrap', 'profile', pid::text, jsonb_build_object('method', 'bootstrap_first_admin'));

  return pid;
end;
$$;
revoke all on function public.bootstrap_first_admin(text) from public, anon, authenticated, service_role;
revoke all on function public.guard_last_admin() from public, anon, authenticated;
revoke all on function public.audit_profile_changes() from public, anon, authenticated;

-- ---------- Publishing validation (replaces the 0002 trigger function) -----------------------
-- A draft may only be published when it is complete: targets a group, has questions,
-- every question has an answer key, and nothing is still flagged for human review.
create or replace function public.guard_mock_exam_update() returns trigger
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
    if new.group_id is null then
      raise exception 'an exam must target a group before it is published' using errcode = '23514';
    end if;
    if not exists (select 1 from public.mock_questions q where q.exam_id = new.id) then
      raise exception 'an exam needs at least one question before it is published' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.mock_questions q
      where q.exam_id = new.id
        and (q.needs_review
             or not exists (select 1 from public.mock_answer_keys k where k.mock_question_id = q.id))
    ) then
      raise exception 'every question needs an answer key and no question may be flagged for review'
        using errcode = '23514';
    end if;
    new.published_at = now();
  elsif new.status = 'archived' then
    raise exception 'only published exams can be archived' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------- Policy fixes -------------------------------------------------------------------------
-- Defect: lessons_write required created_by = auth.uid(), so an administrator could not
-- edit a lesson authored by a teacher. Admins may; teachers may only author as themselves.
drop policy lessons_write on public.lessons;
create policy lessons_write on public.lessons for all to authenticated
  using (public.can_edit_course(public.course_of_topic(topic_id)))
  with check (
    public.can_edit_course(public.course_of_topic(topic_id))
    and (public.is_admin() or created_by = auth.uid())
  );

-- Defect: courses_update let a teacher rewrite created_by (transferring or hiding a course).
drop policy courses_update on public.courses;
create policy courses_update on public.courses for update to authenticated
  using (public.can_edit_course(id))
  with check (public.can_edit_course(id) and (public.is_admin() or created_by = auth.uid()));
