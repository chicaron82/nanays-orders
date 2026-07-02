# Nanay's Orders — Claude Code Instructions

Order management + kitchen operations for a Filipino home-food business (lumpia, pancit):
real-time orders, stock with auto-deduct, expense logging, a monthly P&L, and a calendar.

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # production build (vite build)
npm run lint        # eslint
npm test            # vitest run (one-shot)
npm run test:watch  # vitest watch mode
```

**Before committing:** `npm run lint`, `npm test`, `npx tsc --noEmit`, and `npm run build` all green.
(The explicit `tsc --noEmit` matters here: `vite build` transpiles without type-checking and vitest
does the same, so nothing else in the gate list catches type errors. This repo's flat tsconfig makes
bare `--noEmit` reliable — unlike the solution-file repos (RP, FG, piggybank, SSWP) where the type
gate must be `tsc -b` / the build.)

## Stack

- React 19 with TypeScript
- Supabase (Postgres + realtime subscriptions + auth)
- Vite 8 + Tailwind CSS v4
- framer-motion (animation), sonner (toasts), lucide-react (icons)
- Vitest + Testing Library (jsdom)

## Architecture — the mental map

```
src/
  App.tsx          top-level shell + view switching
  components/      one file per screen/modal — Dashboard, OrderFormModal,
                   OrderDetailsModal, StockManager, ExpenseLog, CalendarView,
                   InsightsView, PublicRequestPage (the public order-link form), LoginScreen
  hooks/           data + state, each owns its Supabase I/O — useOrders, useStock,
                   useExpenses, useAuth, useOrderForm, useOrderRequests, useBackGuard
  lib/
    supabase.ts    the Supabase client
    utils.ts       the pure core — pricing, stock math, calendar, urgency
    insights.ts    per-item revenue + public-link order analytics (pure; tested)
```

**Where logic lives:** `lib/utils.ts` is the pure core — pricing (`calcTotal`), stock
reservation/availability (`getReserved` / `getAvailable` / `checkShortage` / `getMakeMoreNeeds`),
revenue, fulfillability warnings (`getIngredientWarnings`), and calendar math. It is fully
unit-tested in `tests/lib/utils.test.ts`. Keep hooks and components thin around it.

**Realtime pattern:** each data hook subscribes to a Supabase channel inside a `useEffect` and
refetches on change. The fetch function is declared **inside** the effect (it's used nowhere else)
— this satisfies the react-hooks rules and avoids stale-closure / use-before-declaration issues.
Follow this shape for new data hooks.

## Conventions

- **`docs/` is a local idea-inbox (gitignored), not a backlog.** Aaron drops ideas/fixes there;
  the **top level shows only open work + reference**, and a shipped drop is stamped and archived
  to its month folder (`May/`, `June/`, …). The month archives are already-implemented history —
  **the code is the source of truth** and a drop may have evolved past its note. Don't treat an
  *archived* drop as open work; do treat a top-level `status: open` drop as open. See
  `docs/README.md` (the entry point) and `docs/CONVENTIONS.md`.
- **New or changed behavior in `lib/utils.ts` gets a test** in `tests/lib/utils.test.ts`, same
  commit. This covers new functions AND new branches/paths in existing functions. The money and
  stock math must not silently break.
- **Line count is judgment, not law.** A long-but-cohesive component (e.g. a big form) is fine —
  split god objects, not cohesive files. Don't refactor to hit a number.
- **eslint:** Drop unused params/vars — don't `_`-prefix them. For callbacks where a later param is needed (e.g. `Array.from((_, i) => ...)`) the bare `_` is fine because `args: 'after-used'` only flags params after the last used one.

## Domain model (gotchas)

- A lumpia **"half" counts as 0.5 of a set** in stock math.
- Only **`"Ready"`** orders reserve stock (`getReserved`); **`"Pending"`** orders drive the
  make-more calculator (`getMakeMoreNeeds`).
- Pancit noodle packs needed = `full × 1 + half × 1 + large × 2`. Each small/half tray uses one
  full bihon pack (the other half is consumed at home, not saved). **Not** `ceil(half / 2)` — that
  was the old (wrong) formula; don't reintroduce it. The live code (`getIngredientWarnings`,
  `utils.ts`) already uses the correct `full + half + large × 2`.
- Revenue counts `Fulfilled` orders plus `Ready` orders that are `Prepaid`/`Deposit`.
- `needed_date` is stored as a local `YYYY-MM-DD` string — use `localYMD()`, not `toISOString()`
  (which would shift evening dates a day forward).

## Supabase

- Base schema / RLS: `supabase-setup.sql`, `supabase-rls-setup.sql`. Incremental changes live in
  `migrations/` (e.g. `001_stock_ingredients.sql`, `002_add_rush_order.sql`).
- Env: `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Anon / public writes — RLS rules (learned in the wild, 2026-06-25)

The public order form runs as the **anon** role. It may INSERT an `order_requests` row but must
NOT read the table back — orders hold other customers' names, contacts, and addresses, so there is
deliberately **no anon SELECT policy**.

- **Never `.select()` on a public/anon write.** `.insert().select()` adds a `RETURNING`, which
  under RLS needs a SELECT policy anon doesn't have → every submission 401s with `42501 new row
  violates row-level security policy`. The insert itself is fine; asking for the row *back* is what's
  denied. If you need the row's shape, echo what you submitted (the form already has it); the DB
  `id` / `created_at` aren't needed by the confirmation. Pinned by `useOrderRequests.test.ts`.
- **Test public flows as the anon role, not as admin.** Every privileged context hides this bug:
  `tsc`/build don't know about RLS, mocked unit tests bypass the DB, and the `authenticated`
  dashboard role has a full-access policy — so testing the form *while logged in* passes while real
  customers fail. Before shipping a public-facing change, **submit it from a logged-out / incognito
  window.** That 30-second check is the cheapest catch.
- **When a migration removes/narrows an RLS policy, grep the code for what relied on it.** This was a
  correct privacy change (drop anon SELECT) silently breaking a code assumption (`.insert().select()`
  reading the row back). Schema policies and code are two sources of truth that drift — sweep the
  consumers when you change a policy.
