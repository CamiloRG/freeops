# FreeOps

Admin, business, and finance & compliance hub for Colombian freelancers.
Full technical spec: [`app_spec.md`](./app_spec.md) *(see note below)*.

> **Spec file note:** the canonical spec used to build this app currently
> lives outside this repo, at
> `../app_spec_architect/apps/freeops/output/app_spec.md`. Copy or symlink it
> into this repo root as `app_spec.md` when convenient — not required for the
> app to run.

## Status

Building in phases — see the phase list below. Currently: **Phase 1 complete**
(monorepo scaffold, design system, route structure, landing page).

0. ~~Local tooling + GitHub/Supabase/Vercel accounts~~
1. ~~Monorepo scaffold~~ ✅
2. Postgres schema (Drizzle) + migrations
3. Auth (Supabase: email/password + Google + Microsoft login)
4. Personal module — profile, banking, tax info, branding, resume
5. Business module — projects, contracts, kanban
6. CRM pipeline + closed-won → auto-project automation
7. Finance — cuentas de cobro, invoices, payments, rules-engine, PILA
8. Scheduling — MCP calendar server + booking pages
9. Notifications (Resend/Twilio) + background jobs
10. Tax-document vault
11. Landing / marketing page polish
12. Stripe subscription billing
13. Security hardening, test suite, CI/CD, production deploy

## Project structure

```
freeops/
├── apps/
│   └── web/              # Next.js 16 app (App Router, TS, Tailwind v4, shadcn/Radix)
├── packages/              # added as later phases need them (db, rules-engine, ui, contracts)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

`apps/mcp-calendar-server` (the standalone calendar/scheduling MCP service) and
the `packages/*` shared libraries are intentionally not scaffolded yet — each
gets created in the phase that actually populates it (Phase 2 for `db`,
Phase 7 for `rules-engine`, Phase 8 for `mcp-calendar-server`), rather than
sitting empty in the meantime.

## Design

"Calm Minimal" direction — primary purple `#6C5CE7`, dark plum ink `#1F1B2E`,
warm off-white surface `#E8E6E1`. Headings: **Lora** (serif). Body: **Sora**
(sans). Tokens live in `apps/web/src/app/globals.css` (Tailwind v4 CSS-first
`@theme`), with light/dark variants.

## Local development

Requires Node 22+ and pnpm (see root `package.json` → `engines`/`packageManager`).

```bash
pnpm install
pnpm dev            # runs all apps via turbo
pnpm dev:web         # just the web app, http://localhost:3000
pnpm build
pnpm lint
pnpm typecheck
```

## Routes (Phase 1)

| Route | Group | Notes |
|---|---|---|
| `/` | `(marketing)` | Landing page |
| `/sign-in`, `/sign-up` | `(auth)` | Visual only — Supabase Auth wiring is Phase 3 |
| `/personal`, `/business`, `/finance` | `(app)` | Authenticated shell (sidebar/mobile tab bar); placeholder content until each phase lands. No auth guard yet. |
| `/book/[slug]` | `(public)` | Public booking page placeholder — real availability/booking is Phase 8 |
| `/api/health` | — | Health check for deploy smoke tests |
