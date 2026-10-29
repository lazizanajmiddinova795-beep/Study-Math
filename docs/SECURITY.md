# Security

This platform is **not** claimed to be unhackable or production-ready. This document lists what is implemented, what is not, and how to verify.

## Roles and authorization model

- Roles `admin`, `teacher`, `student`; account status `pending`, `active`, `suspended`. Stored in `public.profiles` only.
- `app_role()` returns a role **only for active accounts**; pending/suspended users match no role-based policy.
- Self-registered users become *pending students* via a DB trigger that ignores any role in metadata.
- Role/status changes: column grants allow clients to update only `profiles.full_name`; a trigger additionally rejects protected-column changes from non-admin user sessions; real changes happen in server actions with the service role after an admin check, and are audited.
- Teachers reach students only through `teacher_assignments` ↔ `group_members`.

## Row Level Security

RLS is enabled on every table; privileges are revoked from `anon`/`authenticated` and re-granted narrowly. Highlights:

- Students: own profile, own group/membership rows, published content, approved questions, own attempts/analytics. Never answer keys for the question bank. Exam answer keys only after submitting **and** when `reveal_answers = 'after_submission'`. Exam questions only once they hold an attempt.
- Teachers: assigned groups and their students; their own content and exams.
- Messages: readable/sendable only by conversation members; sender must equal the caller. Admins have no blanket access to private chats.
- Attempts, answers, mastery, errors, audit, AI usage: **no client writes**; server (service role) only.

Helper functions are `SECURITY DEFINER` with a fixed empty `search_path` to avoid recursion and search-path hijacking.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY` are server-only. `src/lib/supabase/admin.ts` imports `server-only`, so importing it from client code fails the build.
- `.env*` is git-ignored except `.env.example` (placeholders only).
- Admin configuration page reports presence/absence only, never values.

## Other controls implemented

Zod validation on all actions; generic login errors (no account enumeration); identical registration response for existing emails; best-effort in-memory rate limiting (login, register); baseline security headers; KaTeX with `trust:false` and escaped text; external links use `rel="noopener noreferrer"`; audit records for user create/approve/suspend; error pages do not render error details.

## Authentication, session and redirect controls

- **Session:** `@supabase/ssr` cookies; `proxy.ts` refreshes them and validates with `auth.getUser()` (Auth-server verified, never `getSession()`). If Supabase is unreachable the proxy treats the user as signed-out (fail closed).
- **Authorization is server-side:** every protected layout calls `requireViewer(area)`; every admin Server Action calls `assertRole("admin")` itself (actions are public endpoints; layout checks do not cover them). Pending/suspended users are denied everywhere except `/pending`.
- **Roles never come from the browser:** the registration schema has no role field; the only metadata sent is the display name; the DB trigger forces `student`/`pending`.
- **Redirects:** the `next` parameter is accepted only as a same-origin relative path (`safeRedirectPath`), only inside the signed-in user's own area (`resolvePostLoginPath`), so open redirects, cross-role bounces and loops to `/login`/`/pending` are not possible. The `?error=` banner on `/login` uses an allow-list, never echoing input.
- **Email confirmation:** `/auth/callback` exchanges a one-time PKCE `code` for a session, then routes by actual role/status.
- **Errors:** wrong credentials always return the same message; outages and Auth 5xx map to a generic "temporarily unavailable"; raw error text is never shown.
- **Configuration safety:** the app validates Supabase settings, rejects untouched `.env.example` placeholders, and refuses a service-role/secret key found in a public variable. Messages name variables, never values.
- **Admin bootstrap:** SQL-only function, see [DATABASE.md](DATABASE.md#first-administrator-bootstrap). Last-admin protection and DB-level audit triggers back up the application checks.

## Known limitations (be honest with yourself before launch)

1. **Rate limiting is in-memory** (per instance, resets on restart). Use a shared store and Supabase Auth rate limits in production. AI rate limiting is not built because AI calls are not built.
2. **No Content-Security-Policy yet.** Add a nonce-based CSP before production.
3. Policies and auth logic are tested on PGlite with a stand-in `auth` schema and mocked Supabase clients, **not on a live Supabase project**. A real login, email-confirmation link, session refresh and RLS-through-PostgREST have **not been verified**. Run the checklist in the README and below against your project.
4. Group/assignment management UI, moderation, reporting, file-upload validation and Storage policies are not built. Uploads must not ship without type/size validation and private buckets with explicit policies.
5. The first administrator is bootstrapped from the SQL editor (by design).
6. No MFA, password-breach checks or session management UI.
7. Pending students can self-register; enable email confirmation and CAPTCHA in Supabase Auth for public deployments.
8. `external_tools_allowed` is stored, not enforced.
9. A student's email cannot be changed from the app; changing it in Supabase Auth does not update `profiles.email` yet.

## Production configuration checklist

- [ ] Email confirmation enabled; strong password policy; CAPTCHA on sign-up
- [ ] Site URL and redirect URLs restricted in Supabase Auth
- [ ] Service-role key only in the host's secret store; rotate if ever exposed
- [ ] Both migrations applied; RLS shows *enabled* on every public table (Table Editor)
- [ ] Database backups enabled (Supabase PITR on paid plans, or scheduled `pg_dump`); **test a restore**
- [ ] HTTPS only; CSP added; dependencies audited (`npm audit`)
- [ ] Logs reviewed for accidental PII/secret output

## Verification checklist

1. As a *pending* user: `/student` redirects to `/pending`; REST calls to `courses`, `groups` return no rows.
2. As a student: `PATCH profiles?id=eq.<me>` with `{"role":"admin"}` is rejected.
3. As student A: cannot read student B's profile, attempts, mastery.
4. As teacher of group A: cannot read group B students or exams.
5. As a student: inserting into `mock_exams`, `mock_questions`, `mock_answer_keys` fails; `mock_answer_keys` is empty before submission.
6. Published exam: updating title or questions fails.
7. Non-member cannot read/insert `messages`.
8. The service-role key never appears in browser network traffic or bundles (`grep` the `.next/static` output).
9. `npm test` passes.
