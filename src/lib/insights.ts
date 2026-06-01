import type { Order } from '../types';
import { LUMPIA_PRICE, LUMPIA_HALF_PRICE, PANCIT_PRICE, PANCIT_SAUCE_PRICE, PANCIT_EXTRA_MEAT_PRICE, customItemsTotal } from './utils';

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

/** The date an order belongs to ('YYYY-MM-DD'), by fulfillment date (when the food is for). */
export function orderDate(order: Order): string {
  return order.needed_date || order.created_at?.slice(0, 10) || '';
}

/** The month an order belongs to ('YYYY-MM'), by fulfillment date. */
export function orderMonth(order: Order): string {
  return orderDate(order).slice(0, 7);
}

/** Orders whose fulfillment date falls within the trailing `days` window ending at `from`. */
export function ordersWithinDays(orders: Order[], days: number, from: Date = new Date()): Order[] {
  const cutoff = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days + 1);
  const cutoffYmd = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const toYmd = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  return orders.filter(o => {
    const d = orderDate(o);
    return d >= cutoffYmd && d <= toYmd;
  });
}

export interface ItemBreakdown {
  month: string; // 'YYYY-MM'
  lumpia: { full: number; half: number; revenue: number };
  pancit: { full: number; half: number; large: number; revenue: number };
  custom: { count: number; revenue: number }; // ad-hoc one-off dishes
  itemRevenue: number; // lumpia + pancit + custom
  orderCount: number;
}

function emptyBreakdown(month: string): ItemBreakdown {
  return {
    month,
    lumpia: { full: 0, half: 0, revenue: 0 },
    pancit: { full: 0, half: 0, large: 0, revenue: 0 },
    custom: { count: 0, revenue: 0 },
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
    if (o.custom_items?.length) {
      b.custom.count += o.custom_items.length;
      b.custom.revenue += customItemsTotal(o);
    }
  }
  b.itemRevenue = b.lumpia.revenue + b.pancit.revenue + b.custom.revenue;
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

// ─── WEEKDAY DEMAND ──────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface WeekdayDemand {
  day: number;           // 0 = Sunday … 6 = Saturday
  label: string;
  lumpiaOrders: number;
  pancitOrders: number;
  totalOrders: number;
}

/** Order counts by day of week (Sun=0…Sat=6), non-cancelled, keyed by needed_date. */
export function weekdayDemand(orders: Order[]): WeekdayDemand[] {
  const slots: WeekdayDemand[] = DAY_LABELS.map((label, day) => ({
    day, label, lumpiaOrders: 0, pancitOrders: 0, totalOrders: 0,
  }));
  for (const o of orders) {
    if (o.order_status === 'Cancelled') continue;
    const d = orderDate(o);
    if (!d) continue;
    const day = new Date(d + 'T12:00:00').getDay();
    slots[day].totalOrders += 1;
    if (o.lumpia?.enabled) slots[day].lumpiaOrders += 1;
    if (o.pancit?.enabled) slots[day].pancitOrders += 1;
  }
  return slots;
}

// ─── HALF-BATCH RECOMMENDATION ───────────────────────────────────────────────

// Recommendation thresholds — judgment calls, not derived. Tune here.
export const MIN_LUMPIA_ORDERS = 5;   // need enough orders for the ratio to mean anything
export const MIN_HALVES_RATIO = 0.2;  // halves show up in ≥20% of lumpia orders

export interface HalfBatchInsight {
  totalLumpiaOrders: number;  // non-cancelled lumpia orders
  halvesOrderCount: number;   // of those, how many include ≥1 half
  halvesRatio: number;        // halvesOrderCount / totalLumpiaOrders (0–1)
  totalHalvesSold: number;
  avgHalvesPerOrder: number;  // when halvesOrderCount > 0
  recommend: boolean;         // true when totalLumpiaOrders ≥ MIN_LUMPIA_ORDERS AND halvesRatio ≥ MIN_HALVES_RATIO
}

/**
 * Analyses historical lumpia half vs. full ratio to surface whether
 * half-sets are consistent enough demand to plan for them.
 */
export function halfBatchInsight(orders: Order[]): HalfBatchInsight {
  let totalLumpiaOrders = 0;
  let halvesOrderCount = 0;
  let totalHalvesSold = 0;
  for (const o of orders) {
    if (o.order_status === 'Cancelled' || !o.lumpia?.enabled) continue;
    totalLumpiaOrders += 1;
    const halves = o.lumpia.halves || 0;
    if (halves > 0) {
      halvesOrderCount += 1;
      totalHalvesSold += halves;
    }
  }
  const halvesRatio = totalLumpiaOrders > 0 ? halvesOrderCount / totalLumpiaOrders : 0;
  const avgHalvesPerOrder = halvesOrderCount > 0 ? totalHalvesSold / halvesOrderCount : 0;
  return {
    totalLumpiaOrders,
    halvesOrderCount,
    halvesRatio,
    totalHalvesSold,
    avgHalvesPerOrder,
    recommend: totalLumpiaOrders >= MIN_LUMPIA_ORDERS && halvesRatio >= MIN_HALVES_RATIO,
  };
}
