@AGENTS.md

# Numberfjord

An AI agent that answers questions about Norway using live data from Statistics Norway's
open API (SSB PxWebApi v2). Answers are interactive charts/tables with a visible agent
trace and a source link for every number.

This is a portfolio project. Code quality, clear commit history, tests and documented
decisions matter as much as features.

## Stack

- Next.js (App Router), TypeScript (strict), `src/` directory, `@/*` import alias
- pnpm (never npm or yarn)
- Tailwind CSS + shadcn/ui (Radix primitives, Vega style)
- Vercel AI SDK + Zod for tools and structured output
- Recharts for charts
- Postgres + pgvector (Neon or Supabase) with Drizzle ORM (from week 5)
- Upstash Redis for caching, Upstash Ratelimit for per-IP limits (from week 4)
- Vitest for tests, custom eval runner (week 6)
- Hosting: Vercel Hobby. Push to `main` deploys to production.

## Commands

- `pnpm dev` – local dev server
- `pnpm lint` – ESLint
- `pnpm typecheck` – generate Next.js types, then `tsc --noEmit`
- `pnpm test` – Vitest (once set up)

Run lint, type check and tests before considering a task done.

## Planned structure

- `src/lib/ssb/` – typed SSB client: `searchTables`, `getTableMetadata`, `queryTable`
- `src/lib/ssb/__fixtures__/` – saved real API responses used in tests
- `src/app/` – routes and UI
- `evals/` – eval questions and runner

## SSB API rules (hard constraints)

- Base: `https://data.ssb.no/api/pxwebapi/v2/`. No API key needed.
- Limits: 30 requests/minute, 800,000 cells per query. Run calls sequentially and keep
  queries small.
- Handle 429 (too many requests) and 403 (dataset too large) explicitly.
- Responses are JSON-stat2 (dimensions, categories, values).
- New statistics publish at 08:00. Metadata updates at 05:00 and 11:30 can briefly make
  tables unavailable – show a friendly error, don't crash.
- Data is CC BY 4.0: every chart/number shows table number, link to ssb.no, "CC BY 4.0",
  and a note when data was transformed (e.g. percentage change).
- Never imply affiliation with SSB: no SSB logo or visual identity, keep the
  "not affiliated with Statistics Norway" line.

## Agent rules

- Always search tables first, check metadata before querying, never invent numbers,
  always cite the table number.
- Multi-step tool calling with a max step limit.

## Conventions

- Conventional commits: `type(scope): description`, imperative, lowercase.
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
    `chore`, `revert`
  - Scopes: `ssb`, `agent`, `ui`, `charts`, `db`, `rag`, `evals`, `cache`
  - Breaking changes: `!` after type/scope (e.g. `feat(ssb)!: ...`)
  - Example: `feat(ssb): add queryTable with 429 retry`
- Work on feature branches, squash-merge PRs into `main`.
- Secrets only in `.env.local` and Vercel env vars. Never commit keys. Keep
  `.env.example` updated.
- Prefer small pure functions with unit tests (e.g. JSON-stat2 → chart data).

## Status

Currently in week 1 of 8 (see plan below).
Done: Next.js app scaffolded, shadcn initialized, repo pushed to GitHub, deployed to Vercel
(https://number-fjord.vercel.app/), README stub.
Next: CI (lint + typecheck), then SSB client + tests.

## 8-week plan (summary)

1. Foundations: setup, deploy, SSB client + fixtures + tests
2. First agent: tools, agent loop, system prompt, basic chat, 10 eval questions
3. Generative UI: chart/table schemas, Recharts components, agent trace, source lines
4. Hardening: caching, rate limiting, error states, disclaimers, privacy page
5. Retrieval: catalog in Postgres + pgvector, hybrid search, accuracy before/after
6. Evals: 30–50 questions, runner scoring table/number/refusal, /evals page
7. Improve & polish: fix top failure category, follow-ups, a11y, cheaper models
8. Launch: README with architecture and eval results, demo video, write-up
