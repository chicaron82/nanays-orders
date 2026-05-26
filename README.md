# Nanay's Orders

Order management and kitchen operations app for a Filipino home food business (lumpia, pancit).

## What it does

- **Orders** — Create, track, and fulfill orders with per-batch quantities (sets / halves for lumpia). Real-time updates via Supabase subscriptions.
- **Stock** — Track inventory by batch. Auto-deducts on fulfillment (halves count as 0.5 sets).
- **Expenses** — Log per-purchase costs by category (wrappers, pork, vegetables, containers, bihon, other). Grouped by date with per-batch totals.
- **P&L Dashboard** — Monthly revenue vs. expenses, net position in green/red.
- **Calendar** — View orders by date.

## Stack

- React 19 (no TypeScript)
- Supabase (Postgres + realtime)
- Vite

## Local setup

```bash
npm install
```

Create a `.env.local`:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

```bash
npm run dev
```
