# Math Learning Platform

An AI-ready mathematics learning platform (temporary name; configurable). **Current scope:** authentication, roles, database schema with Row Level Security, role-specific dashboard shells and a Math Tools page. AI tutoring, the exam engine, the exam parser and messaging are **not built yet** — see [docs/ROADMAP.md](docs/ROADMAP.md).

Stack: Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · Supabase (Auth, Postgres, RLS) · Zod · KaTeX · Vitest.

## What works without any external service

- The app starts and every page renders with **no environment configured**.
- Without valid Supabase settings, the pages show a warning that names the missing/invalid variables (never their values) and sign-in is disabled. Nothing pretends to be connected.
- Without AI settings, AI pages show "not configured".

> **Status:** the code and database scripts are tested locally (see `npm test`). A real Supabase project has **not** been connected or tested by the developers of this repo. Follow the checklist in [Verify it works](#verify-it-works) after you connect yours.

## Prerequisites

- Node.js 20.9+ and npm
- A free [Supabase](https://supabase.com) account

## Setup, step by step

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Sign in at supabase.com → **New project**. Choose a name, a strong database password (store it in a password manager; you will not need it in this app) and a region near you.
2. Wait until the project finishes provisioning.

### 3. Create `.env.local` safely

`.env.local` holds your settings and is **git-ignored**. Never commit it, paste it into chat, or share screenshots of it.

```bash
cp .env.example .env.local            # Windows PowerShell: Copy-Item .env.example .env.local
```

Open `.env.local` in an editor and fill in (Supabase dashboard → **Project Settings → API**):

| Variable | Where to find it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | *Publishable* key (`sb_publishable_…`) or legacy *anon* key | No (RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local work | No |
| `SUPABASE_SERVICE_ROLE_KEY` | *Secret* / *service_role* key | **YES — server only** |

The app refuses a secret/service-role key placed in a public variable. After changing `.env.local`, restart `npm run dev`.

### 4. Apply the database migrations (in order)

The migrations create tables and security rules. They never drop or delete data, but **apply them only to the project you intend to use**.

1. Supabase dashboard → **SQL Editor** → *New query*.
2. Paste the full contents of each file, in this order, and click **Run** (run each once):
   1. `supabase/migrations/0001_foundation_schema.sql`
   2. `supabase/migrations/0002_rls_policies.sql`
   3. `supabase/migrations/0003_admin_bootstrap_and_hardening.sql`
3. Check **Table Editor**: every table should show RLS *enabled*.

(CLI alternative: `supabase link --project-ref <ref>` then `supabase db push`. See [docs/DATABASE.md](docs/DATABASE.md).)

### 5. Configure Authentication URLs

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (use your real URL in production).
- **Redirect URLs:** add `http://localhost:3000/auth/callback` (and your production equivalent).

Supabase → **Authentication → Providers → Email**: keep **Confirm email** enabled for any real deployment. For quick local experiments you may turn it off, but then anyone can create a *pending* account instantly (still no access until approved).

### 6. Create the first administrator (one time, trusted procedure)

There is intentionally **no** public admin sign-up and **no** default password.

1. Register normally at `http://localhost:3000/register` with your own email and a strong password (confirm the email if enabled). *Alternatively:* Supabase → **Authentication → Users → Add user**.
2. In the Supabase **SQL Editor** (a trusted session), run, replacing the email:
   ```sql
   select public.bootstrap_first_admin('you@example.com');
   ```
   This works **only** from the SQL editor, **only** while no active admin exists, only for an existing user, and it writes an audit record. It cannot be called from the app or by any user.
3. Sign in at `/login`. You land on `/admin`, where you can approve pending students and create teacher/student accounts.

### 7. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Verify it works

1. **Registration:** `/register` → submit. You see the "request received" message. In Supabase → Authentication → Users the user exists; in the SQL editor `select email, role, status from public.profiles;` shows `student` / `pending`.
2. **Pending restriction:** sign in as that student → you land on `/pending`. Opening `/student` redirects back to `/pending`.
3. **Approval:** sign in as admin → `/admin` → *Approve as student*. The student now reaches `/student`.
4. **Role restrictions:** as the student open `/admin` and `/teacher` → *Not authorized*. Signed out, `/student` → redirected to `/login` (and back to the page after sign-in).
5. **Wrong password:** shows "Incorrect email or password." for both existing and non-existing accounts.
6. **Audit trail:** `/admin/audit` lists the approval; `select * from public.audit_logs order by created_at desc;` shows `profile.created`, `admin.bootstrap`, and role/status changes.
7. **Automated checks:** `npm test`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests + database policy tests (PGlite; no Docker or Supabase needed) |

## Troubleshooting

| Symptom | Cause |
|---|---|
| Yellow "Supabase is not configured / invalid" notice | `.env.local` missing, still has placeholders, or server not restarted |
| "signed in but has no profile … migrations" | Migrations 0001–0003 not applied to this project |
| Sign-in works but you land on `/pending` | Account not yet approved (or not yet promoted to admin) |
| Confirmation link says invalid/expired | Redirect URL not allow-listed, or link already used / expired |
| Admin page says service role not set | `SUPABASE_SERVICE_ROLE_KEY` missing in `.env.local` |

## Branding

`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_TAGLINE`, optionally `NEXT_PUBLIC_BRAND_LOGO` (path under `/public`). Colors are CSS tokens in `src/app/globals.css`.

## Deployment preparation

Not deployed by this repo. Any Node host supporting Next.js works. Set the same variables in the host's secret manager, enable HTTPS, update Supabase Site/Redirect URLs, and read [docs/SECURITY.md](docs/SECURITY.md) first.

## Documentation

[ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE](docs/DATABASE.md) · [SECURITY](docs/SECURITY.md) · [ROADMAP](docs/ROADMAP.md)
