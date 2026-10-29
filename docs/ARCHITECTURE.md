# Architecture

## Shape

A **modular monolith**: one Next.js app, one Supabase project. No microservices.

```
src/
  app/                 Routes and layouts only (thin). /student /teacher /admin /login /register /pending
  components/          Reusable UI (ui/, layout/, math/)
  features/            Domain modules: auth, admin, student, teacher, math-tools (actions, queries, forms)
  lib/
    auth/              policy.ts (pure decisions), session.ts (viewer), guards.ts (server guards)
    supabase/          server client (user, RLS), admin client (service role, server-only), session refresh
    ai/                Provider-independent interface + registry (no vendor SDK in app code)
    validation/        Zod schemas for untrusted input
    config/ env.ts     Branding and validated environment access
  proxy.ts             Session refresh + coarse "signed in?" redirect (Next 16 "proxy", formerly middleware)
supabase/migrations/   Version-controlled SQL: schema, helpers, RLS
tests/                 Unit tests + PGlite database policy tests
```

## Data flow

1. Browser → Next.js route. `proxy.ts` refreshes the Supabase session cookie and redirects anonymous users away from protected prefixes (coarse gate only).
2. Each protected layout calls `requireViewer(area)`. It verifies identity with the Auth server (`getUser`) and loads **role and status from `public.profiles`**. `resolveAreaAccess` (pure, unit-tested) decides allow / `/login` / `/pending` / `/unauthorized`.
3. Reads use the **user-scoped** Supabase client, so Postgres RLS filters every result.
4. Privileged writes (create user, approve, suspend) are Server Actions that re-check the caller with `assertRole`, validate with Zod, then use the **service-role client** (`server-only`) and write an audit record.

## Key decisions

| Decision | Reason |
|---|---|
| Role/status in `profiles`, not JWT metadata | Metadata is user-editable; DB is the single source of truth |
| New users are always *pending students* (DB trigger) | Self-registration can never yield privileges |
| Answer keys in separate tables | `select *` on questions can never leak answers |
| Exams versioned and immutable after publish (triggers) | Historical attempts stay interpretable |
| Attempts/scoring/analytics writes are server-only | Scores must come from tested server logic, not clients |
| AI behind `AiProvider` interface, no adapter shipped | No fabricated AI output; vendor swap later |
| Next.js 16 `proxy.ts` | Replaces deprecated `middleware.ts` |
| No component library installed | Small shared primitives with design tokens; avoids dependencies |

## Module boundaries

UI components never import Supabase. Features own their queries/actions. Authorization logic lives in `lib/auth` and in SQL policies; pages call guards and never inspect roles ad hoc. AI code is reachable only through `lib/ai`.
