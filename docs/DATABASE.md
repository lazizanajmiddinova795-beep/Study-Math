# Database

PostgreSQL via Supabase. Migrations are plain SQL in `supabase/migrations/`, applied in filename order.

## Applying migrations

**Option A — SQL Editor (simplest):** open the Supabase dashboard → SQL Editor → run, in order, `0001_foundation_schema.sql`, `0002_rls_policies.sql`, `0003_admin_bootstrap_and_hardening.sql`. Run each once; they are not idempotent (re-running fails with "already exists" instead of damaging data).

**Option B — Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`. Confirm the linked project is the intended one first (`supabase projects list`).

> Tables from `0001` are not safe to expose until `0002` (RLS + grants) is applied. Apply all three before pointing real users at the project.

**Safety:** none of the migrations drops a table, truncates, or deletes rows. `0003` drops and recreates exactly two policies (`lessons_write`, `courses_update`) and replaces one trigger function. Do not run migrations against a database holding data you care about without a backup.

## First administrator (bootstrap)

In the SQL Editor, after the user exists in Supabase Auth:

```sql
select public.bootstrap_first_admin('you@example.com');
```

The function refuses to run from any end-user session, refuses once an active admin exists, requires an existing user, serialises concurrent calls with an advisory lock, and records an `admin.bootstrap` audit row. `EXECUTE` is revoked from `public`, `anon`, `authenticated` and `service_role`, so it cannot be reached through the API.

An active administrator cannot be demoted, suspended or deleted if they are the last one (trigger `profiles_guard_last_admin`). Every profile creation and role/status change is logged by trigger `profiles_audit` (`actor_id` is `NULL` for changes made outside an end-user session, e.g. SQL editor or service role; the application additionally writes rows naming the acting admin).

## Review findings fixed in 0003

| Finding | Fix |
|---|---|
| Admins could not edit lessons authored by teachers (`created_by = auth.uid()` in `WITH CHECK`) | `lessons_write` allows admins |
| Teachers could rewrite `courses.created_by` | `courses_update` pins it unless admin |
| An exam could be published empty, without answer keys, without a group, or while flagged for review | Publish validation in `guard_mock_exam_update` |
| Role changes were only audited by app code | DB-level audit trigger |
| Sole administrator could be locked out | Last-admin trigger |

> Design note: a teacher assigned to a group can read *draft* exams (including keys) of co-teachers in that group. This is intentional for co-teaching; restrict `staff_can_view_exam` if you want drafts private.

> Implementation note: RLS helper functions are `STABLE` and cannot see rows written by the *same statement*. Policies that gate `INSERT … RETURNING` therefore also test the row's own columns, and multi-step copies are split into separate statements.

## Timezone strategy

All timestamps are `timestamptz`. PostgreSQL stores them as UTC instants. Server code treats them as UTC; the UI formats them explicitly (currently UTC-labelled; per-user timezone display is future work). Never store local times as plain `timestamp`.

## Entities

| Area | Tables |
|---|---|
| Identity & organisation | `profiles` (1:1 with `auth.users`), `groups`, `group_members`, `teacher_assignments` |
| Content | `subjects` → `courses` → `topics` → `lessons`; `questions` + `question_answer_keys` |
| Examinations | `mock_exams` (versioned) → `mock_questions` + `mock_answer_keys`; `attempts` → `attempt_answers` |
| Analytics | `skill_mastery`, `error_records`, `practice_sessions` |
| Communication | `conversations`, `conversation_members`, `messages` |
| Operations | `audit_logs`, `ai_usage`, `notifications` |

Added beyond the brief's list (for security): `question_answer_keys`, `mock_answer_keys`.

## Integrity rules

- Roles: `admin | teacher | student`; status: `pending | active | suspended`.
- `mock_exams (exam_key, version)` unique. `create_exam_version(exam_id)` copies a published exam to a new draft version.
- Triggers: exams must be created as drafts; published exams cannot change except `published → archived`; their questions and answer keys cannot change; only drafts can be deleted.
- `attempts.exam_id` is `ON DELETE RESTRICT`: history cannot be orphaned.
- `skill_mastery.mastery_score` is nullable: `NULL` means *not enough evidence*.
- `error_records.source` distinguishes `deterministic` findings from `ai_hypothesis`.
- `mock_exams.external_tools_allowed` records teacher intent only; **it is not enforced**.

## Not yet in the schema (future)

Upload metadata and Storage bucket policies, moderation/report tables, exam time windows, per-group exam assignment history, Realtime publication setup.
