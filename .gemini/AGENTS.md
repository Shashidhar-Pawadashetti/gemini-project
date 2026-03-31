# AGENTS.md — Universal AI Agent Instructions
## Project: Pulse — Hybrid Social Media Platform
## Compatible with: Gemini CLI, Claude Code, Cursor, GitHub Copilot Workspace, OpenCode

---

> This file is the universal equivalent of GEMINI.md. It is auto-detected by
> any AI coding agent that supports the AGENTS.md open standard. If both
> GEMINI.md and AGENTS.md exist, GEMINI.md takes precedence for Gemini CLI,
> AGENTS.md for all other tools.

---

## PROJECT IDENTITY

- **App:** Pulse — a hybrid social media platform (Instagram feed × Twitter interactions)
- **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL)
- **Phase:** Active development — feature-by-feature implementation
- **Source of truth:** `spec.md` (requirements) + `schema.md` (database)

---

## ESSENTIAL COMMANDS

```bash
pnpm dev              # Start dev server → localhost:3000
pnpm test             # Run all unit tests (Vitest)
pnpm test:watch       # Tests in watch mode
pnpm e2e              # Playwright end-to-end tests
pnpm lint             # ESLint check (must pass before any commit)
pnpm build            # Production build (must pass before any PR)
supabase start        # Start local Supabase stack
supabase db reset     # Reset and re-run all migrations locally
supabase gen types typescript --local > src/types/supabase.ts
```

---

## WHAT TO READ BEFORE STARTING ANY TASK

1. `spec.md` — find the feature you're implementing and read its acceptance criteria
2. `schema.md` — check which tables are involved and their RLS policies
3. `plan.md` — if it exists, this is the approved implementation plan to follow
4. The relevant sub-directory `GEMINI.md` — for database or API tasks

---

## HARD RULES (non-negotiable)

| Rule | Rationale |
|------|-----------|
| TypeScript strict mode — no `any` | Type safety is a first-class requirement |
| No `SELECT *` — always name columns | Prevents over-fetching and RLS bypass risks |
| Cursor pagination only — no OFFSET | OFFSET causes duplicate posts in live feeds |
| Tests before implementation (TDD) | AI-generated code must be machine-verified |
| Feature branches — never commit to main | Protects production stability |
| Never store tokens in localStorage | Security requirement from spec.md §4 |
| Never modify `src/components/ui/` | shadcn/ui base components are read-only |
| Never touch `auth.users` directly | Only interact with `profiles` table |

---

## BEHAVIOUR PROTOCOL SUMMARY

**Before writing code:** Investigate → explain what you found → propose a plan.
**After plan approval:** Implement one atomic step at a time → test → commit → repeat.
**When uncertain:** Stop and ask. Never invent a solution to an ambiguous requirement.
**When something breaks:** Use the stack trace as context → fix the specific failure → re-run tests.

---

## FILE PLACEMENT QUICK REFERENCE

| What you're building | Where it goes |
|---|---|
| Page or layout | `src/app/(main)/[route]/page.tsx` |
| API endpoint | `src/app/api/[resource]/route.ts` |
| Reusable UI component | `src/components/[feature]/ComponentName.tsx` |
| Custom React hook | `src/lib/hooks/useHookName.ts` |
| Zustand store | `src/lib/stores/storeName.ts` |
| TypeScript types | `src/types/typeName.ts` |
| Utility function | `src/lib/utils/utilName.ts` |
| Supabase query helper | `src/lib/supabase/queries/[table].ts` |

---

*AGENTS.md v1.0 — universal context standard*
*Full behavioral constitution: GEMINI.md*