import type { Order, LumpiaOrder, Stock, DeliveryType, LumpiaSauce, OrderStatus, PaymentStatus } from '../types';

// ─── PRICING ─────────────────────────────────────────────────────────────────
export const LUMPIA_PRICE = { uncooked: 30, cooked: 35 };
export const LUMPIA_HALF_PRICE = { uncooked: 18, cooked: 20 };
export const PANCIT_PRICE = { full: 25, half: 12.50, large: 50 };
export const PANCIT_SAUCE_PRICE: Record<string, number> = { sweet_and_sour: 2, sweet_chili: 2 };
export const PANCIT_EXTRA_MEAT_PRICE = 10;
export const RUSH_ORDER_FEE = 10;
export const EARLY_ORDER_FEE = 10;
export const DELIVERY_FEE: Record<DeliveryType, number> = { pickup: 0, city: 5, outside: 10 };

// Early-fulfillment cutoffs (local 24h hour). Pickup before 11am, or a delivery
// before noon — a delivery booked for 11am means cooking and leaving well before
// 11, so the cutoff is pushed to 12 to cover the prep + travel lead time.
// Saturdays get +1h on both cutoffs so the family can rest in.
export const EARLY_PICKUP_CUTOFF_HOUR = 11;
export const EARLY_DELIVERY_CUTOFF_HOUR = 12;
export const EARLY_PICKUP_CUTOFF_HOUR_SAT = 12;
export const EARLY_DELIVERY_CUTOFF_HOUR_SAT = 13;

/**
 * True when the order's fulfillment time falls in the early window — derived
 * live from pickup_time (the field that serves both pickup and delivery), so it
 * always tracks the current time and never drifts. No time set → not early.
 * Saturday cutoffs are 1h later than weekday cutoffs.
 */
export function isEarlyFulfillment(order: Order): boolean {
  if (!order.pickup_time) return false;
  const hour = parseInt(order.pickup_time.split(':')[0], 10);
  if (Number.isNaN(hour)) return false;
  const isSaturday = order.needed_date
    ? new Date(order.needed_date + 'T00:00:00').getDay() === 6
    : false;
  const pickupCutoff  = isSaturday ? EARLY_PICKUP_CUTOFF_HOUR_SAT  : EARLY_PICKUP_CUTOFF_HOUR;
  const deliveryCutoff = isSaturday ? EARLY_DELIVERY_CUTOFF_HOUR_SAT : EARLY_DELIVERY_CUTOFF_HOUR;
  const cutoff = order.delivery_type === 'pickup' ? pickupCutoff : deliveryCutoff;
  return hour < cutoff;
}

/** The early fee actually applies only when it's early AND Christine hasn't waived it. */
export function earlyFeeApplies(order: Order): boolean {
  return isEarlyFulfillment(order) && !order.early_fee_waived;
}

// Resolve cooked/uncooked for a lumpia batch — handles both old (style) and new (setsCooked/halvesCooked) formats
function lumpiaStyleFor(lumpia: LumpiaOrder, key: 'sets' | 'halves'): 'cooked' | 'uncooked' {
  const cooked = key === 'sets' ? lumpia.setsCooked : lumpia.halvesCooked;
  if (cooked != null) return cooked ? 'cooked' : 'uncooked';
  return lumpia.style === 'cooked' ? 'cooked' : 'uncooked';
}

/** Sum of any ad-hoc custom items (one-off dishes) on an order. */
export function customItemsTotal(order: Order): number {
  return (order.custom_items || []).reduce((s, c) => s + (Number(c.price) || 0), 0);
}

export function calcTotal(order: Order): number {
  let t = 0;
  if (order.lumpia?.enabled) {
    t += LUMPIA_PRICE[lumpiaStyleFor(order.lumpia, 'sets')] * (order.lumpia.sets || 0);
    t += LUMPIA_HALF_PRICE[lumpiaStyleFor(order.lumpia, 'halves')] * (order.lumpia.halves || 0);
    t += (order.lumpia.sauces || []).reduce((s, sauce) => s + (PANCIT_SAUCE_PRICE[sauce] || 0), 0);
  }
  if (order.pancit?.enabled) {
    t += PANCIT_PRICE.full * (order.pancit.full || 0);
    t += PANCIT_PRICE.half * (order.pancit.half || 0);
    t += PANCIT_PRICE.large * (order.pancit.large || 0);
    if (order.pancit.extraMeat) t += PANCIT_EXTRA_MEAT_PRICE;
  }
  t += customItemsTotal(order);
  t += order.rush_order ? RUSH_ORDER_FEE : 0;
  t += earlyFeeApplies(order) ? EARLY_ORDER_FEE : 0;
  t += order.delivery_type ? (DELIVERY_FEE[order.delivery_type] || 0) : 0;
  return t;
}

export function orderSummary(order: Order): string {
  const parts: string[] = [];
  if (order.lumpia?.enabled) {
    const ls: string[] = [];
    if ((order.lumpia.sets || 0) > 0) {
      const cooked = order.lumpia.setsCooked != null ? order.lumpia.setsCooked : order.lumpia.style === 'cooked';
      ls.push(`${order.lumpia.sets}× full (${cooked ? 'Cooked' : 'Uncooked'})`);
    }
    if ((order.lumpia.halves || 0) > 0) {
      const cooked = order.lumpia.halvesCooked != null ? order.lumpia.halvesCooked : order.lumpia.style === 'cooked';
      ls.push(`${order.lumpia.halves}× half (${cooked ? 'Cooked' : 'Uncooked'})`);
    }
    parts.push(`Lumpia ${ls.join(' + ') || '—'}`);
    const sauces = order.lumpia.sauces || [];
    if (sauces.length) parts.push(`Sauce: ${sauces.map(s => s === 'sweet_and_sour' ? 'Sweet & Sour' : 'Sweet Chili').join(', ')}`);
  }
  if (order.pancit?.enabled) {
    const ps: string[] = [];
    if ((order.pancit.full || 0) > 0) ps.push(`${order.pancit.full} Regular`);
    if ((order.pancit.half || 0) > 0) ps.push(`${order.pancit.half} Small`);
    if ((order.pancit.large || 0) > 0) ps.push(`${order.pancit.large} Large`);
    if (order.pancit.extraMeat) ps.push('Extra meat/veggies');
    if (ps.length) parts.push(`Pancit: ${ps.join(' + ')}`);
  }
  for (const c of order.custom_items || []) {
    if (c.name?.trim()) parts.push(c.name.trim());
  }
  if (order.rush_order) parts.push('Rush order');
  if (earlyFeeApplies(order)) parts.push('Early order fee');
  return parts.join(' · ') || 'No items';
}

/** Cash received against an order. Prepaid = the full total; Deposit = the deposit; Unpaid = 0. */
export function amountReceived(order: Order): number {
  const total = order.total ?? calcTotal(order);
  if (order.payment_status === 'Prepaid') return total;
  if (order.payment_status === 'Deposit') return Number(order.deposit_amount) || 0;
  return 0;
}

/**
 * What's still owed on an order — total minus cash received, floored at 0.
 * Cancelled orders owe nothing. Mirrors the balance shown in orderSummary so
 * the dashboard and the confirmation message agree.
 */
export function amountOwing(order: Order): number {
  if (order.order_status === 'Cancelled') return 0;
  return Math.max(0, (order.total ?? calcTotal(order)) - amountReceived(order));
}

/**
 * Amount paid above the order total, kept as income. Prefers the explicit
 * tip_amount recorded when marking Paid for more than the total (the
 * tip-vs-change decision can't be derived). Falls back to a Deposit larger than
 * the total (the legacy workaround). 0 when not overpaid or cancelled.
 */
export function tipAmount(order: Order): number {
  if (order.order_status === 'Cancelled') return 0;
  if (order.tip_amount != null && order.tip_amount > 0) return order.tip_amount;
  return Math.max(0, amountReceived(order) - (order.total ?? calcTotal(order)));
}

// ─── URGENCY ─────────────────────────────────────────────────────────────────
export function getDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export interface UrgencyLabel { text: string; bg: string; color: string; tailwind: string; }

export function urgencyLabel(days: number | null): UrgencyLabel | null {
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, bg: "#DC3545", color: "white", tailwind: "bg-red-500 text-white" };
  if (days === 0) return { text: "Today!", bg: "#DC3545", color: "white", tailwind: "bg-red-500 text-white" };
  if (days === 1) return { text: "Tomorrow", bg: "#E8651A", color: "white", tailwind: "bg-orange-500 text-white" };
  if (days <= 3) return { text: `${days}d`, bg: "#FFC107", color: "#3A1A08", tailwind: "bg-yellow-400 text-amber-900" };
  if (days <= 7) return { text: `${days}d`, bg: "#D1E7DD", color: "#0A3622", tailwind: "bg-emerald-100 text-emerald-900" };
  return { text: `${days}d`, bg: "#F0F0F0", color: "#888", tailwind: "bg-gray-100 text-gray-500" };
}

// ─── STOCK ───────────────────────────────────────────────────────────────────
export interface BatchCounts { lumpiaSets: number; pancitFull: number; pancitHalf: number; pancitLarge: number; }

export function getReserved(orders: Order[]): BatchCounts {
  const reserved: BatchCounts = { lumpiaSets: 0, pancitFull: 0, pancitHalf: 0, pancitLarge: 0 };
  orders.filter(o => o.order_status === "Ready").forEach(o => {
    if (o.lumpia?.enabled) reserved.lumpiaSets += (o.lumpia.sets || 0) + (o.lumpia.halves || 0) * 0.5;
    if (o.pancit?.enabled) {
      reserved.pancitFull += o.pancit.full || 0;
      reserved.pancitHalf += o.pancit.half || 0;
      reserved.pancitLarge += o.pancit.large || 0;
    }
  });
  return reserved;
}

export function getAvailable(stock: Stock | null | undefined, orders: Order[]): BatchCounts {
  const reserved = getReserved(orders);
  return {
    lumpiaSets: (stock?.lumpia_sets || 0) - reserved.lumpiaSets,
    pancitFull: (stock?.pancit_full || 0) - reserved.pancitFull,
    pancitHalf: (stock?.pancit_half || 0) - reserved.pancitHalf,
    pancitLarge: (stock?.pancit_large || 0) - reserved.pancitLarge,
  };
}

export function checkShortage(order: Order, stock: Stock | null | undefined, orders: Order[], excludeId: string | number | null = null): string[] {
  const filtered = excludeId ? orders.filter(o => o.id !== excludeId) : orders;
  const avail = getAvailable(stock, filtered);
  const warnings: string[] = [];
  if (order.lumpia?.enabled) {
    const needed = (order.lumpia.sets || 0) + (order.lumpia.halves || 0) * 0.5;
    if (needed > avail.lumpiaSets) warnings.push(`Lumpia: need ${needed} batch${needed !== 1 ? "es" : ""}, only ${Math.max(0, avail.lumpiaSets)} available`);
  }
  if (order.pancit?.enabled) {
    const nf = order.pancit.full || 0, nh = order.pancit.half || 0, nl = order.pancit.large || 0;
    if (nf > avail.pancitFull) warnings.push(`Pancit regular trays: need ${nf}, only ${Math.max(0, avail.pancitFull)} available`);
    if (nh > avail.pancitHalf) warnings.push(`Pancit small trays: need ${nh}, only ${Math.max(0, avail.pancitHalf)} available`);
    if (nl > avail.pancitLarge) warnings.push(`Pancit large trays: need ${nl}, only ${Math.max(0, avail.pancitLarge)} available`);
  }
  return warnings;
}

// ─── MAKE MORE CALCULATOR ────────────────────────────────────────────────────
export interface MakeMoreNeed { need: number; avail: number; total: number; }
export interface MakeMoreNeeds { lumpia: MakeMoreNeed; pancitFull: MakeMoreNeed; pancitHalf: MakeMoreNeed; pancitLarge: MakeMoreNeed; }

export function getMakeMoreNeeds(orders: Order[], stock: Stock | null | undefined): MakeMoreNeeds {
  const pending = orders.filter(o => o.order_status === "Pending");
  const avail = getAvailable(stock, orders);
  let needLumpia = 0, needFull = 0, needHalf = 0, needLarge = 0;
  pending.forEach(o => {
    if (o.lumpia?.enabled) needLumpia += (o.lumpia.sets || 0) + (o.lumpia.halves || 0) * 0.5;
    if (o.pancit?.enabled) {
      needFull += o.pancit.full || 0;
      needHalf += o.pancit.half || 0;
      needLarge += o.pancit.large || 0;
    }
  });
  return {
    lumpia: { need: Math.max(0, needLumpia - avail.lumpiaSets), avail: avail.lumpiaSets, total: needLumpia },
    pancitFull: { need: Math.max(0, needFull - avail.pancitFull), avail: avail.pancitFull, total: needFull },
    pancitHalf: { need: Math.max(0, needHalf - avail.pancitHalf), avail: avail.pancitHalf, total: needHalf },
    pancitLarge: { need: Math.max(0, needLarge - avail.pancitLarge), avail: avail.pancitLarge, total: needLarge },
  };
}

// ─── REVENUE ─────────────────────────────────────────────────────────────────
export function getRevenue(orders: Order[]): { total: number; month: number } {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Cash in hand = revenue. Prepaid and Deposit orders are counted regardless
  // of fulfilment status — the money exists the moment it's received.
  const counted = orders.filter(o =>
    o.order_status === "Fulfilled" ||
    o.payment_status === "Prepaid" ||
    o.payment_status === "Deposit"
  );
  // Bucket by needed_date — an order needed in June is June revenue regardless
  // of when it was placed. Fall back to created_at only if needed_date is absent.
  const thisMonth = counted.filter(o => {
    const dateStr = o.needed_date || (o.created_at ? o.created_at.slice(0, 10) : null);
    if (!dateStr) return false;
    return new Date(dateStr + 'T00:00:00') >= monthStart;
  });
  // Revenue = order value + any tip (cash received above the total), so the
  // P&L reflects actual money taken in, not just the order sticker price.
  const cash = (o: Order) => Number(o.total ?? calcTotal(o)) + tipAmount(o);
  return {
    total: counted.reduce((s, o) => s + cash(o), 0),
    month: thisMonth.reduce((s, o) => s + cash(o), 0),
  };
}

// ─── REPEAT CUSTOMERS ────────────────────────────────────────────────────────
export function fuzzyMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.startsWith(nb.slice(0, 4)) || nb.startsWith(na.slice(0, 4))) return true;
  return false;
}

export function getRepeatCustomers(orders: Order[]): Record<string, number> {
  const counts: Record<string, number> = {};
  orders.forEach(o => {
    const key = (o.customer_name || "").toLowerCase().trim().slice(0, 6);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export function isRepeat(name: string, orders: Order[], currentId: string | number | null = null): boolean {
  const others = currentId ? orders.filter(o => o.id !== currentId) : orders;
  return others.filter(o => fuzzyMatch(o.customer_name, name)).length >= 1;
}

/** Most recent prior order for a customer (by created_at desc), for "repeat last order". */
export function lastOrderFor(name: string, orders: Order[], excludeId: string | number | null = null): Order | undefined {
  if (!name?.trim()) return undefined;
  return orders
    .filter(o => o.id !== excludeId && fuzzyMatch(o.customer_name, name))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
}

export function formatDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function fmt(n: number): string { return "$" + Number(n).toFixed(2); }

/** Customer-facing order confirmation text for sharing (Web Share / clipboard). */
export function buildOrderMessage(order: Order): string {
  const total = order.total ?? calcTotal(order);
  const deposit = Number(order.deposit_amount) || 0;
  const lines = [`${order.customer_name || 'Order'} — Order Confirmation`, orderSummary(order)];
  const when = `📅 ${formatDate(order.needed_date)}${order.pickup_time ? ` @ ${order.pickup_time}` : ''}`;
  lines.push(when);
  const owing = amountOwing(order);
  const tip = tipAmount(order);
  if (order.payment_status === 'Prepaid') {
    lines.push(`💵 Total ${fmt(total)} · Fully paid ✓`);
  } else if (order.payment_status === 'Deposit' && owing > 0) {
    lines.push(`💵 Total ${fmt(total)} · Deposit ${fmt(deposit)} · Balance ${fmt(owing)}`);
  } else if (order.payment_status === 'Deposit') {
    lines.push(tip > 0
      ? `💵 Total ${fmt(total)} · Paid ${fmt(deposit)} · Fully paid ✓`
      : `💵 Total ${fmt(total)} · Fully paid ✓`);
  } else {
    lines.push(`💵 Total ${fmt(total)}`);
  }
  return lines.join('\n');
}

export const ORDER_STATUS: OrderStatus[] = ["Pending", "Ready", "Fulfilled", "Cancelled"];
export const PAYMENT_STATUS: PaymentStatus[] = ["Unpaid", "Deposit", "Prepaid"];

// ─── FULFILLABILITY WARNINGS ─────────────────────────────────────────────────
export function getIngredientWarnings(form: Order, stock: Stock | null | undefined): string[] {
  if (!stock) return [];
  const warnings: string[] = [];
  const hasLumpia = !!form.lumpia?.enabled;
  const hasPancit = !!form.pancit?.enabled;
  if (!hasLumpia && !hasPancit) return [];

  const porkFrozen = stock.pork_frozen || 0;
  const porkThawed = stock.pork_thawed || 0;
  const days = form.needed_date ? getDaysUntil(form.needed_date) : null;
  const dateLabel = form.needed_date ? formatDate(form.needed_date) : '';

  // Only hour-precise when pickup_time is set — otherwise warnings are day-granularity
  const pickupDt = (form.needed_date && form.pickup_time)
    ? new Date(`${form.needed_date}T${form.pickup_time}:00`)
    : null;
  const hoursUntil = pickupDt ? (pickupDt.getTime() - Date.now()) / 3600000 : null;
  const timeLabel = form.pickup_time ? ` at ${form.pickup_time}` : '';

  // ── Shared consumables (carrots + celery) ─────────────────────────────────
  const carrotsCtx = hasLumpia && hasPancit ? 'lumpia filling and pancit'
    : hasLumpia ? 'lumpia filling' : 'pancit';
  const celeryCtx = hasLumpia && hasPancit ? 'lumpia filling and pancit'
    : hasLumpia ? 'lumpia filling' : 'pancit';

  if (stock.carrots_status === 'out') {
    warnings.push(`⚠️ Out of carrots — needed for ${carrotsCtx}. May need a store run.`);
  } else if (stock.carrots_status === 'low') {
    warnings.push('⚠️ Running low on carrots — worth grabbing more soon.');
  }

  if (stock.celery_status === 'out') {
    warnings.push(`⚠️ Out of Chinese celery — needed for ${celeryCtx}.`);
  } else if (stock.celery_status === 'low') {
    warnings.push('⚠️ Running low on Chinese celery.');
  }

  // ── Lumpia timeline warnings ───────────────────────────────────────────────
  if (hasLumpia && form.needed_date) {
    const lumpiaNeeded = (form.lumpia?.sets || 0) + (form.lumpia?.halves || 0) * 0.5;
    const lumpiaReady = stock.lumpia_sets || 0;

    if (lumpiaNeeded > lumpiaReady) {
      if (porkThawed === 0 && porkFrozen > 0) {
        // Only frozen pork — defrost takes ~1 day before filling can start
        if (days !== null && days <= 2) {
          warnings.push(`⚠️ Pork is frozen — needs a day to defrost before filling can be made. Tight timeline for ${dateLabel}.`);
        }
      } else if (porkThawed > 0) {
        // Pork is thawed but filling + rolling still needed (~2hrs total)
        const isTight = hoursUntil !== null ? hoursUntil <= 4 : days !== null && days <= 0;
        if (isTight) {
          warnings.push(`⚠️ Filling still needs to be made (~1hr) + rolling (~1hr). Tight for ${dateLabel}${timeLabel}.`);
        }
      }
    }
  }

  // ── Pancit warnings ────────────────────────────────────────────────────────
  if (hasPancit) {
    const packsNeeded = (form.pancit?.full || 0) + Math.ceil((form.pancit?.half || 0) / 2) + (form.pancit?.large || 0) * 2;
    const packsOnHand = stock.noodle_packs || 0;

    if (packsNeeded > packsOnHand) {
      warnings.push(`⚠️ Not enough noodle packs. Need ${packsNeeded}, have ${packsOnHand}.`);
    }

    // 30-minute check — only meaningful when a specific pickup time is set
    if (form.needed_date && hoursUntil !== null && hoursUntil > 0 && hoursUntil <= 0.5) {
      warnings.push(`⚠️ Pancit takes ~30 mins to make. Very tight for ${dateLabel}${timeLabel}.`);
    }
  }

  return warnings;
}

// ─── CALENDAR ────────────────────────────────────────────────────────────────
// YYYY-MM-DD from a Date's *local* parts. needed_date is stored as a local YMD
// string, so toISOString() would shift evening dates a day forward.
export function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The nearest non-blocked date strictly after `from`. Scans forward one day at
// a time; returns within a year in any realistic scenario.
export function nextAvailableDate(from: string, blockedDates: ReadonlySet<string>): string {
  const d = new Date(from + 'T00:00:00');
  for (let i = 0; i < 366; i++) {
    d.setDate(d.getDate() + 1);
    const ymd = localYMD(d);
    if (!blockedDates.has(ymd)) return ymd;
  }
  return localYMD(d);
}

// 7 YMD strings for the week containing anchorDate, Sunday start.
export function getWeekDays(anchorDate: Date): string[] {
  const start = new Date(anchorDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return localYMD(d);
  });
}

// Weeks × 7 YMD strings covering the month containing anchorDate, padded with
// adjacent-month days so every row is a full week (Sunday start).
export function getMonthGrid(anchorDate: Date): string[][] {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const last = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const weekCount = Math.ceil((first.getDay() + last.getDate()) / 7);
  const weeks: string[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + w * 7 + i);
      week.push(localYMD(day));
    }
    weeks.push(week);
  }
  return weeks;
}

// Heuristic capacity model — tunable, later liftable into a StockManager setting.
export const LOAD_THRESHOLDS = { medium: 3, heavy: 5 };

// Work units for a day's orders: lumpia batch ×1, pancit full ×1, half ×0.5.
export function dayLoad(ordersForDay: Order[]): { units: number; level: 'light' | 'medium' | 'heavy' } {
  let units = 0;
  ordersForDay.forEach(o => {
    if (o.order_status === "Cancelled") return;
    if (o.lumpia?.enabled) units += (o.lumpia.sets || 0) + (o.lumpia.halves || 0) * 0.5;
    if (o.pancit?.enabled) {
      units += o.pancit.full || 0;
      units += (o.pancit.half || 0) * 0.5;
      units += (o.pancit.large || 0) * 2;
    }
  });
  let level: 'light' | 'medium' | 'heavy' = "light";
  if (units >= LOAD_THRESHOLDS.heavy) level = "heavy";
  else if (units >= LOAD_THRESHOLDS.medium) level = "medium";
  return { units, level };
}

// ─── PREP SHEET ──────────────────────────────────────────────────────────────
export interface PrepTotals {
  orderCount: number;
  lumpia: { setsCooked: number; setsUncooked: number; halvesCooked: number; halvesUncooked: number };
  pancit: { full: number; half: number; large: number; extraMeat: number };
  sauces: Record<LumpiaSauce, number>;
  rushCount: number;
}

// A day's cooking plan: the orders for that date (sorted by pickup time) plus an
// aggregate "to make" roll-up — lumpia split by cooked/uncooked, pancit trays,
// sauces, and rush count. Pure; rendered by the PrepSheet component.
export function buildPrepList(orders: Order[], ymd: string): { ymd: string; orders: Order[]; totals: PrepTotals } {
  const rows = (orders || [])
    .filter(o => o.needed_date === ymd && o.order_status !== "Cancelled")
    .sort((a, b) => (a.pickup_time || "").localeCompare(b.pickup_time || ""));

  const totals: PrepTotals = {
    orderCount: rows.length,
    lumpia: { setsCooked: 0, setsUncooked: 0, halvesCooked: 0, halvesUncooked: 0 },
    pancit: { full: 0, half: 0, large: 0, extraMeat: 0 },
    sauces: { sweet_and_sour: 0, sweet_chili: 0 },
    rushCount: 0,
  };

  for (const o of rows) {
    if (o.lumpia?.enabled) {
      const setsCooked = o.lumpia.setsCooked != null ? o.lumpia.setsCooked : o.lumpia.style === "cooked";
      const halvesCooked = o.lumpia.halvesCooked != null ? o.lumpia.halvesCooked : o.lumpia.style === "cooked";
      const sets = o.lumpia.sets || 0;
      const halves = o.lumpia.halves || 0;
      if (setsCooked) totals.lumpia.setsCooked += sets; else totals.lumpia.setsUncooked += sets;
      if (halvesCooked) totals.lumpia.halvesCooked += halves; else totals.lumpia.halvesUncooked += halves;
      for (const s of (o.lumpia.sauces || [])) {
        if (totals.sauces[s] != null) totals.sauces[s] += 1;
      }
    }
    if (o.pancit?.enabled) {
      totals.pancit.full += o.pancit.full || 0;
      totals.pancit.half += o.pancit.half || 0;
      totals.pancit.large += o.pancit.large || 0;
      if (o.pancit.extraMeat) totals.pancit.extraMeat += 1;
    }
    if (o.rush_order) totals.rushCount += 1;
  }

  return { ymd, orders: rows, totals };
}
