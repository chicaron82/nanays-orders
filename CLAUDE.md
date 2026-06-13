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

**Before committing:** `npm run lint` and `npm test` green, and `npm run build` succeeds.

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
                   OrderDetailsModal, StockManager, ExpenseLog, CalendarView, LoginScreen
  hooks/           data + state, each owns its Supabase I/O — useOrders, useStock,
                   useExpenses, useAuth, useOrderForm, useBackGuard
  lib/
    supabase.ts    the Supabase client
    utils.ts       ALL pure business logic (pricing, stock math, calendar, urgency)
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

- **`docs/` is a done idea-inbox, not a backlog.** Aaron drops crew ideas/fixes there from the
  lot; everything in it is already implemented and may have evolved past its note. **The code is
  the source of truth.** See `docs/INDEX.md`. Never treat a `docs/` file as open work.
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
  was the old (wrong) formula still present in `getIngredientWarnings`.
- Revenue counts `Fulfilled` orders plus `Ready` orders that are `Prepaid`/`Deposit`.
- `needed_date` is stored as a local `YYYY-MM-DD` string — use `localYMD()`, not `toISOString()`
  (which would shift evening dates a day forward).

## Supabase

- Base schema / RLS: `supabase-setup.sql`, `supabase-rls-setup.sql`. Incremental changes live in
  `migrations/` (e.g. `001_stock_ingredients.sql`, `002_add_rush_order.sql`).
- Env: `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
