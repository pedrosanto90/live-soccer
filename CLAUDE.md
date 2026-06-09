# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Next.js 16 — breaking changes that bite

This project runs **Next.js 16.2.7** (App Router, React 19). Several conventions differ from older Next.js. Always read the relevant guide under `node_modules/next/dist/docs/` before writing framework code.

- **`middleware` is renamed to `proxy`.** The root file is `proxy.ts` (not `middleware.ts`) and exports `async function proxy(request)` on the Node.js runtime. Session refresh + route protection lives here via `lib/supabase/proxy.ts`.
- `cookies()` and `headers()` are async — `await` them (see `lib/supabase/server.ts`).
- For slow client navigations, Suspense alone is not enough: export `unstable_instant` from the route and read `docs/01-app/02-guides/instant-navigation.mdx`.

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test runner configured.

### Supabase (local stack)

```bash
supabase start                              # boot local Postgres/Auth/Realtime (API on :54321, db on :54322)
supabase migration new <name>               # create a new migration
supabase db reset                           # re-run all migrations against the local db
supabase gen types typescript --local       # regenerate DB types (see "Database types" caveat below)
```

## Architecture

A tournament-management app for organizing and following live soccer tournaments. UI copy is in **Portuguese (pt)** — match that when writing user-facing strings. Stack: Next.js App Router + Supabase (Postgres, Auth, Realtime) + shadcn/ui + Tailwind v4.

### Route groups (`app/`)

Three layout groups, each with its own auth posture:
- `(auth)` — `/login`, `/register`. Centered card shell.
- `(app)` — authenticated area (`/dashboard`, and future `/tournaments`, `/teams`, `/matches`, `/profile`). Layout fetches the user + `profiles` row and renders `Navbar`; redirects to `/login` if unauthenticated.
- `(public)` — unauthenticated public pages (live results, public tournament view). No admin navbar.

### Auth & Supabase clients

Three client factories, pick by context:
- `lib/supabase/client.ts` — `createClient()` browser client (Client Components).
- `lib/supabase/server.ts` — `createClient()` async server client (Server Components, Server Actions, Route Handlers). Reads cookies.
- `lib/supabase/proxy.ts` — `updateSession()` used only inside `proxy.ts` to refresh the session and gate `protectedRoutes` / `authRoutes`.

Uses the **new-style Supabase keys**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser/server) and `SUPABASE_SECRET_KEY` (server-only). Env template is `.env.example`.

Auth is **defense-in-depth**: the `proxy.ts` redirect, the `(app)` layout check, and per-page `getUser()` checks all guard independently — keep all three when adding protected pages.

Mutations are **Server Actions** in `lib/actions/` (`'use server'`). They validate input with Zod schemas from `lib/validations/`, return `ActionResult<T>` (`types/index.ts`) for recoverable errors, and `redirect()` on success. Client forms use `react-hook-form` + `@hookform/resolvers/zod`; the same Zod schema is shared between action and form (the form may `.extend()` client-only fields like `confirmPassword`).

### Database

Schema is defined as ordered SQL migrations in `supabase/migrations/` (numbered `20240101000001`–`...011`): extensions/enums → tables (profiles, tournaments, teams/players, phases/groups, matches, standings/suspensions) → indexes → **RLS policies** → triggers → realtime. RLS is enabled on every table. The `handle_new_user` trigger creates a `profiles` row from `auth.users` (it reads `name` from `raw_user_meta_data`, set during `signUp`). Realtime is enabled on `matches`, `match_events`, and `standings` for the live public panel.

**Database types caveat:** `types/database.ts` is **hand-written** to match the agreed schema (not generated). It exports the `Database` type plus per-table `Row` aliases (e.g. `Profile`) and domain enums (`MatchStatus`, `PlayerPosition`, etc.). If you regenerate via `supabase gen types`, reconcile it with the existing hand-written aliases rather than blindly overwriting.

### UI

shadcn/ui (`components/ui/`, style `radix-nova`, base color neutral) plus app-specific primitives (`page-header`, `empty-state`, `stat-card`, `status-badge`, `section`). Shared chrome in `components/shared/` (`navbar`, `user-menu`), feature components grouped by domain (`components/auth/`). Theming via `next-themes` (`ThemeProvider` in root layout, class strategy). Toasts via `sonner`. Tailwind v4 with CSS variables and custom tokens (`bg-surface-1`, `border-subtle`) defined in `app/globals.css`. Import aliases: `@/components`, `@/lib`, `@/hooks`, `@/lib/utils`.
