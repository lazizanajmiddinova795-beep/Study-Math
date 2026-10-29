-- =============================================================================
-- 0001_foundation_schema.sql
-- Foundation schema for the Math Learning Platform.
--
-- Conventions
--   * UUID primary keys (gen_random_uuid()).
--   * All timestamps are timestamptz, stored in UTC by PostgreSQL; clients
--     render them in the viewer's local timezone. See docs/DATABASE.md.
--   * Row Level Security + grants are defined in 0002_rls_policies.sql.
--     Tables created here are NOT safe to expose until 0002 has been applied.
--   * Answer keys live in separate tables so that a SELECT on a question can
--     never leak the answer, even through a mistaken policy or `select *`.
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
create type public.user_role      as enum ('admin', 'teacher', 'student');
create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.question_kind  as enum ('multiple_choice', 'open_response');
create type public.content_status as enum ('draft', 'needs_review', 'approved');
create type public.content_source as enum ('teacher', 'ai_generated', 'parsed_upload');
create type public.exam_status    as enum ('draft', 'published', 'archived');
create type public.reveal_policy  as enum ('never', 'after_submission');
create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');
create type public.conversation_kind as enum ('direct', 'group');
create type public.evidence_source as enum ('deterministic', 'ai_hypothesis');

-- ---------- Generic helpers ----------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Identity and organization -----------------------------------------
-- profiles.role / profiles.status are the ONLY source of truth for authorization.
-- They are never derived from user-editable auth metadata.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  role        public.user_role not null default 'student',
  status      public.account_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_role_status_idx on public.profiles (role, status);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  created_by  uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.teacher_assignments (
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (teacher_id, group_id)
);
create index teacher_assignments_group_idx on public.teacher_assignments (group_id);

-- ---------- Educational content -------------------------------------------------
create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references public.subjects (id) on delete restrict,
  title        text not null check (char_length(title) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 2000),
  is_published boolean not null default false,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index courses_subject_idx on public.courses (subject_id);
create index courses_created_by_idx on public.courses (created_by);

create table public.topics (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 160),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index topics_course_idx on public.topics (course_id, position);

create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.topics (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 160),
  -- Markdown + LaTeX source. Must be rendered with a safe renderer (no raw HTML).
  body         text not null default '',
  position     integer not null default 0,
  is_published boolean not null default false,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index lessons_topic_idx on public.lessons (topic_id, position);

-- Practice / bank questions. The answer is stored in question_answer_keys.
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics (id) on delete cascade,
  kind        public.question_kind not null,
  prompt      text not null check (char_length(prompt) between 1 and 8000),
  choices     jsonb check (choices is null or jsonb_typeof(choices) = 'array'),
  difficulty  smallint not null default 3 check (difficulty between 1 and 5),
  status      public.content_status not null default 'draft',
  source      public.content_source not null default 'teacher',
  created_by  uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (kind <> 'multiple_choice' or choices is not null)
);
create index questions_topic_idx on public.questions (topic_id, status);

create table public.question_answer_keys (
  question_id    uuid primary key references public.questions (id) on delete cascade,
  correct_answer jsonb not null,
  explanation    text not null default ''
);

-- ---------- Examinations ----------------------------------------------------------
-- A mock exam is versioned: (exam_key, version) is unique. Once published, the
-- exam row, its questions and answer keys are immutable (enforced by triggers in
-- 0002). To change a published exam, create a new version.
create table public.mock_exams (
  id                     uuid primary key default gen_random_uuid(),
  exam_key               uuid not null default gen_random_uuid(),
  version                integer not null default 1 check (version >= 1),
  title                  text not null check (char_length(title) between 1 and 160),
  description            text not null default '' check (char_length(description) <= 2000),
  course_id              uuid references public.courses (id) on delete set null,
  group_id               uuid references public.groups (id) on delete set null,
  status                 public.exam_status not null default 'draft',
  duration_minutes       integer check (duration_minutes is null or duration_minutes between 1 and 600),
  reveal_answers         public.reveal_policy not null default 'never',
  -- Declares teacher intent only. NOT enforced by the platform yet.
  external_tools_allowed boolean not null default false,
  created_by             uuid not null references public.profiles (id) on delete restrict,
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (exam_key, version)
);
create index mock_exams_group_idx on public.mock_exams (group_id, status);
create index mock_exams_created_by_idx on public.mock_exams (created_by);

create table public.mock_questions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.mock_exams (id) on delete cascade,
  position    integer not null check (position >= 1),
  kind        public.question_kind not null,
  prompt      text not null check (char_length(prompt) between 1 and 8000),
  choices     jsonb check (choices is null or jsonb_typeof(choices) = 'array'),
  points      numeric(6, 2) not null default 1 check (points > 0),
  -- Set when a parsed/AI-extracted question still needs human review.
  needs_review boolean not null default false,
  unique (exam_id, position),
  check (kind <> 'multiple_choice' or choices is not null)
);

create table public.mock_answer_keys (
  mock_question_id uuid primary key references public.mock_questions (id) on delete cascade,
  correct_answer   jsonb not null,
  explanation      text not null default ''
);

create table public.attempts (
  id           uuid primary key default gen_random_uuid(),
  -- RESTRICT: historical attempts must always remain interpretable.
  exam_id      uuid not null references public.mock_exams (id) on delete restrict,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  attempt_no   integer not null default 1 check (attempt_no >= 1),
  status       public.attempt_status not null default 'in_progress',
  score        numeric(7, 2) check (score is null or score >= 0),
  max_score    numeric(7, 2) check (max_score is null or max_score >= 0),
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  unique (exam_id, student_id, attempt_no),
  check (score is null or max_score is null or score <= max_score)
);
create index attempts_student_idx on public.attempts (student_id, started_at desc);

create table public.attempt_answers (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.attempts (id) on delete cascade,
  mock_question_id uuid not null references public.mock_questions (id) on delete restrict,
  answer           jsonb,
  is_correct       boolean,
  points_awarded   numeric(6, 2) check (points_awarded is null or points_awarded >= 0),
  created_at       timestamptz not null default now(),
  unique (attempt_id, mock_question_id)
);

-- ---------- Learning analytics -------------------------------------------------------
-- Written only by trusted server code. mastery_score stays NULL until there is
-- enough evidence; the platform must never claim mastery without evidence.
create table public.skill_mastery (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  topic_id       uuid not null references public.topics (id) on delete cascade,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  correct_count  integer not null default 0 check (correct_count >= 0),
  mastery_score  numeric(4, 3) check (mastery_score is null or mastery_score between 0 and 1),
  updated_at     timestamptz not null default now(),
  unique (student_id, topic_id),
  check (correct_count <= evidence_count)
);

create table public.error_records (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.profiles (id) on delete cascade,
  topic_id          uuid references public.topics (id) on delete set null,
  attempt_answer_id uuid references public.attempt_answers (id) on delete set null,
  category          text not null check (char_length(category) between 1 and 80),
  note              text not null default '' check (char_length(note) <= 2000),
  -- Separates confirmed findings from AI hypotheses.
  source            public.evidence_source not null,
  confirmed         boolean not null default false,
  created_at        timestamptz not null default now()
);
create index error_records_student_idx on public.error_records (student_id, created_at desc);

create table public.practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  topic_id     uuid references public.topics (id) on delete set null,
  difficulty   smallint check (difficulty is null or difficulty between 1 and 5),
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index practice_sessions_student_idx on public.practice_sessions (student_id, started_at desc);

-- ---------- Communication -----------------------------------------------------------
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  kind       public.conversation_kind not null,
  group_id   uuid references public.groups (id) on delete cascade,
  title      text check (title is null or char_length(title) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'group' or group_id is not null)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------- Operations and AI --------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) between 1 and 80),
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  feature       text not null,
  provider      text not null,
  model         text,
  input_tokens  integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  succeeded     boolean not null,
  created_at    timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null check (char_length(title) <= 160),
  body       text not null default '' check (char_length(body) <= 1000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- updated_at triggers ------------------------------------------------------
create trigger profiles_updated_at     before update on public.profiles     for each row execute function public.set_updated_at();
create trigger groups_updated_at       before update on public.groups       for each row execute function public.set_updated_at();
create trigger courses_updated_at      before update on public.courses      for each row execute function public.set_updated_at();
create trigger topics_updated_at       before update on public.topics       for each row execute function public.set_updated_at();
create trigger lessons_updated_at      before update on public.lessons      for each row execute function public.set_updated_at();
create trigger questions_updated_at    before update on public.questions    for each row execute function public.set_updated_at();
create trigger mock_exams_updated_at   before update on public.mock_exams   for each row execute function public.set_updated_at();
create trigger skill_mastery_updated_at before update on public.skill_mastery for each row execute function public.set_updated_at();

-- ---------- New user -> pending student profile -----------------------------------------
-- Every new auth user becomes a PENDING STUDENT. Role/status in raw_user_meta_data
-- are deliberately ignored: that metadata is user-editable.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    'student',
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
