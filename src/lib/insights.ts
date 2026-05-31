import type { Order } from '../types';
import { LUMPIA_PRICE, LUMPIA_HALF_PRICE, PANCIT_PRICE, PANCIT_SAUCE_PRICE, PANCIT_EXTRA_MEAT_PRICE } from './utils';

// ─── PER-ITEM REVENUE ────────────────────────────────────────────────────────
// Splits an order's value into what each product line earned. Fees, delivery,
// and tips are deliberately excluded — those live in the Dashboard's gross/net.
// This answers "how much is the lumpia / the pancit making."

function lumpiaStyle(l: NonNullable<Order['lumpia']>, key: 'sets' | 'halves'): 'cooked' | 'uncooked' {
  const cooked = key === 'sets' ? l.setsCooked : l.halvesCooked;
  if (cooked != null) return cooked ? 'cooked' : 'uncooked';
  return l.style === 'cooked' ? 'cooked' : 'uncooked';
}

export function lumpiaRevenue(order: Order): number {
  const l = order.lumpia;
  if (!l?.enabled) return 0;
  let t = 0;
  t += LUMPIA_PRICE[lumpiaStyle(l, 'sets')] * (l.sets || 0);
  t += LUMPIA_HALF_PRICE[lumpiaStyle(l, 'halves')] * (l.halves || 0);
  t += (l.sauces || []).reduce((s, sauce) => s + (PANCIT_SAUCE_PRICE[sauce] || 0), 0);
  return t;
}

export function pancitRevenue(order: Order): number {
  const p = order.pancit;
  if (!p?.enabled) return 0;
  let t = 0;
  t += PANCIT_PRICE.full * (p.full || 0);
  t += PANCIT_PRICE.half * (p.half || 0);
  t += PANCIT_PRICE.large * (p.large || 0);
  if (p.extraMeat) t += PANCIT_EXTRA_MEAT_PRICE;
  return t;
}

// ─── MONTHLY BREAKDOWN ───────────────────────────────────────────────────────

/** The month an order belongs to ('YYYY-MM'), by fulfillment date (when the food is for). */
export function orderMonth(order: Order): string {
  const d = order.needed_date || order.created_at?.slice(0, 10) || '';
  return d.slice(0, 7);
}

export interface ItemBreakdown {
  month: string; // 'YYYY-MM'
  lumpia: { full: number; half: number; revenue: number };
  pancit: { full: number; half: number; large: number; revenue: number };
  itemRevenue: number; // lumpia + pancit
  orderCount: number;
}

function emptyBreakdown(month: string): ItemBreakdown {
  return {
    month,
    lumpia: { full: 0, half: 0, revenue: 0 },
    pancit: { full: 0, half: 0, large: 0, revenue: 0 },
    itemRevenue: 0,
    orderCount: 0,
  };
}

/** Sum item volume + revenue for one month (Cancelled orders excluded). */
export function itemBreakdownForMonth(orders: Order[], month: string): ItemBreakdown {
  const b = emptyBreakdown(month);
  for (const o of orders) {
    if (o.order_status === 'Cancelled' || orderMonth(o) !== month) continue;
    b.orderCount += 1;
    if (o.lumpia?.enabled) {
      b.lumpia.full += o.lumpia.sets || 0;
      b.lumpia.half += o.lumpia.halves || 0;
      b.lumpia.revenue += lumpiaRevenue(o);
    }
    if (o.pancit?.enabled) {
      b.pancit.full += o.pancit.full || 0;
      b.pancit.half += o.pancit.half || 0;
      b.pancit.large += o.pancit.large || 0;
      b.pancit.revenue += pancitRevenue(o);
    }
  }
  b.itemRevenue = b.lumpia.revenue + b.pancit.revenue;
  return b;
}

/** The last `count` month keys, newest first, ending at `from`. */
export function recentMonths(count: number, from: Date = new Date()): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/** Per-month breakdowns for the last `count` months, newest first. */
export function monthlyItemSeries(orders: Order[], count: number, from: Date = new Date()): ItemBreakdown[] {
  return recentMonths(count, from).map(m => itemBreakdownForMonth(orders, m));
}
