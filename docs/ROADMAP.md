# Roadmap

Each phase is implemented and tested separately.

| Phase | Scope | Notes |
|---|---|---|
| **1 — Foundation (this)** | Auth, roles, schema, RLS, dashboard shells, Math Tools, AI interface | Done in this repo; see README for verification status |
| 2 — Organisation | Admin UI for groups, memberships, teacher assignments (server actions + audit); first-admin bootstrap script; shared rate limiter; CSP | Policies already exist |
| 3 — Content | Course/topic/lesson editor, safe Markdown+KaTeX rendering, publish flow, student learning view | |
| 4 — Exam engine | Exam builder, versioning UI, attempt start/save/submit, deterministic server-side scoring (unit-tested), answer reveal rules, enforce `external_tools_allowed` | Service-role server logic after membership checks |
| 5 — AI tutor | Gemini adapter behind `AiProvider`, progressive hints, attempt-first mode, `ai_usage` logging, per-user AI rate limits | Uses only authorised learning history |
| 6 — Analytics | Mastery calculation with evidence thresholds, error categories, targeted practice, teacher analytics | Keep AI hypotheses separate from confirmed results |
| 7 — Messaging | Conversation creation (server), Realtime subscriptions, reports, moderation, abuse limits | Membership already enforced by RLS |
| 8 — Exam parser & AI practice | Private Storage uploads with type/size validation, OCR/extraction, uncertainty flags, mandatory teacher approval; generated-question validation and review queue | Never auto-publish |
| 9 — Hardening | MFA, backups drill, monitoring, penetration test, accessibility audit, Playwright end-to-end tests | |
