import { describe, it, expect } from 'vitest';
import type { Order, LumpiaOrder } from '../../src/types';
import {
  calcTotal, orderSubtotal, discountAmount, orderSummary,
  getDaysUntil, urgencyLabel,
  getReserved, getAvailable, checkShortage, getMakeMoreNeeds,
  getRevenue, isSettled,
  fuzzyMatch, getRepeatCustomers, isRepeat, lastOrderFor,
  formatDate, fmt, buildOrderMessage, buildReadyMessage,
  getIngredientWarnings,
  localYMD, getWeekDays, getMonthGrid,
  dayLoad, LOAD_THRESHOLDS,
  buildPrepList,
  // pricing / payment / fee / deposit / rush — consolidated from the former
  // src/lib/utils.test.ts twin (2026-06-21 line-check) so utils has one test home
  isEarlyFulfillment, earlyFeeApplies, amountOwing, amountReceived, tipAmount,
  customItemsTotal, nextAvailableDate, requiresDeposit, depositFor, isAutoRush,
  lumpiaPieceCount, EARLY_ORDER_FEE, RUSH_ORDER_FEE, DELIVERY_FEE,
} from '../../src/lib/utils';

// Build a local YYYY-MM-DD offset from today (deterministic regardless of run date)
const ymd = (offsetDays = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return localYMD(d);
};

// A minimal order with one pancit so calcTotal has a non-fee base to add onto.
// Module-scope helper for the pricing/payment/deposit groups consolidated below.
const base = (over: Partial<Order> = {}): Order => ({
  customer_name: 'Test',
  pancit: { enabled: true, full: 1, half: 0, large: 0, extraMeat: false },
  delivery_type: 'pickup',
  ...over,
});

// Fixed reference time for the deposit / rush helpers that accept a `now` param.
const NOW = new Date('2026-06-17T12:00:00');

// ─── PRICING ──────────────────────────────────────────────────────────────────

describe('calcTotal', () => {
  it('empty order → 0', () => {
    expect(calcTotal({})).toBe(0);
  });

  it('lumpia sets price by cooked/uncooked', () => {
    expect(calcTotal({ lumpia: { enabled: true, sets: 2, setsCooked: true, halves: 0, halvesCooked: true, sauces: [] } })).toBe(70); // 2 × 35
    expect(calcTotal({ lumpia: { enabled: true, sets: 2, setsCooked: false, halves: 0, halvesCooked: false, sauces: [] } })).toBe(60); // 2 × 30
  });

  it('lumpia halves price independently of sets', () => {
    expect(calcTotal({ lumpia: { enabled: true, sets: 1, setsCooked: false, halves: 3, halvesCooked: false, sauces: [] } })).toBe(84); // 30 + 3×18
  });

  it('adds sauce prices', () => {
    expect(calcTotal({ lumpia: { enabled: true, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: ['sweet_and_sour', 'sweet_chili'] } })).toBe(39); // 35 + 2 + 2
  });

  it('pancit full/half/large + extra meat', () => {
    expect(calcTotal({ pancit: { enabled: true, full: 2, half: 1, large: 1, extraMeat: true } })).toBe(123); // 50 + 13 + 50 + 10
  });

  it('rush fee and delivery fee', () => {
    expect(calcTotal({ rush_order: true, delivery_type: 'city' })).toBe(15); // 10 + 5
    expect(calcTotal({ delivery_type: 'outside' })).toBe(10);
    expect(calcTotal({ delivery_type: 'pickup' })).toBe(0);
  });

  it('falls back to legacy lumpia.style when setsCooked is absent', () => {
    expect(calcTotal({ lumpia: { enabled: true, sets: 1, halves: 0, style: 'cooked', sauces: [] } })).toBe(35);
    expect(calcTotal({ lumpia: { enabled: true, sets: 1, halves: 0, sauces: [] } })).toBe(30); // no style → uncooked
  });

  it('combines lumpia + pancit + rush', () => {
    expect(calcTotal({
      lumpia: { enabled: true, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: [] },
      pancit: { enabled: true, full: 1, half: 0, large: 0 },
      rush_order: true,
    })).toBe(70); // 35 + 25 + 10
  });
});

describe('orderSummary', () => {
  it('no items → "No items"', () => {
    expect(orderSummary({})).toBe('No items');
  });
  it('describes lumpia sets with cooked state', () => {
    expect(orderSummary({ lumpia: { enabled: true, sets: 2, setsCooked: true, halves: 0, halvesCooked: true, sauces: [] } }))
      .toContain('2× full (Cooked)');
  });
  it('describes pancit and rush', () => {
    const s = orderSummary({ pancit: { enabled: true, full: 1, half: 0, large: 0 }, rush_order: true });
    expect(s).toContain('1 Regular');
    expect(s).toContain('Rush order');
  });
  it('shows ×N for duplicate sauces', () => {
    const s = orderSummary({ lumpia: { enabled: true, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: ['sweet_and_sour', 'sweet_and_sour'] } });
    expect(s).toContain('Sweet & Sour ×2');
  });
});

// ─── URGENCY ────────────────────────────────────────────────────────────────────

describe('getDaysUntil', () => {
  it('null date → null', () => expect(getDaysUntil(null)).toBeNull());
  it('today → 0, future/past offsets', () => {
    expect(getDaysUntil(ymd(0))).toBe(0);
    expect(getDaysUntil(ymd(3))).toBe(3);
    expect(getDaysUntil(ymd(-2))).toBe(-2);
  });
});

describe('urgencyLabel', () => {
  it('null → null', () => expect(urgencyLabel(null)).toBeNull());
  it('overdue / today / tomorrow', () => {
    expect(urgencyLabel(-1)!.text).toBe('1d overdue');
    expect(urgencyLabel(0)!.text).toBe('Today!');
    expect(urgencyLabel(1)!.text).toBe('Tomorrow');
  });
  it('buckets by distance', () => {
    expect(urgencyLabel(2)!.tailwind).toContain('yellow');
    expect(urgencyLabel(5)!.tailwind).toContain('emerald');
    expect(urgencyLabel(30)!.tailwind).toContain('gray');
  });
});

// ─── STOCK ───────────────────────────────────────────────────────────────────────

describe('getReserved', () => {
  it('upcoming non-cancelled orders reserve stock; halves count as 0.5', () => {
    const orders: Order[] = [
      { order_status: 'Pending', needed_date: ymd(2), lumpia: { enabled: true, sets: 2, halves: 2 }, pancit: { enabled: true, full: 1, half: 2, large: 1 } },
      { order_status: 'Pending', needed_date: ymd(-3), lumpia: { enabled: true, sets: 5, halves: 0 } }, // past — already made, ignored
      { order_status: 'Cancelled', needed_date: ymd(2), lumpia: { enabled: true, sets: 9, halves: 0 } }, // cancelled, ignored
    ];
    const r = getReserved(orders);
    expect(r.lumpiaSets).toBe(3); // 2 + 2×0.5 (only the upcoming order)
    expect(r.pancitFull).toBe(1);
    expect(r.pancitHalf).toBe(2);
    expect(r.pancitLarge).toBe(1);
    expect(r.noodlePacks).toBe(5); // 1 regular + 2 small + 1 large×2
  });
});

describe('getAvailable', () => {
  it('subtracts upcoming demand from stock on hand', () => {
    const stock = { lumpia_sets: 10, pancit_full: 5, pancit_half: 4, pancit_large: 2, noodle_packs: 8 };
    const orders: Order[] = [{ order_status: 'Pending', needed_date: ymd(2), lumpia: { enabled: true, sets: 3, halves: 0 }, pancit: { enabled: true, full: 1, half: 2, large: 0 } }];
    const a = getAvailable(stock, orders);
    expect(a.lumpiaSets).toBe(7);
    expect(a.pancitFull).toBe(4);
    expect(a.pancitHalf).toBe(2);
    expect(a.noodlePacks).toBe(5); // 8 on hand - (1 regular + 2 small) = 5
  });
});

describe('checkShortage', () => {
  const stock = { lumpia_sets: 3, pancit_full: 1, pancit_half: 0, pancit_large: 0 };
  it('warns when an order exceeds availability', () => {
    const warnings = checkShortage({ lumpia: { enabled: true, sets: 5, halves: 0 } }, stock, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Lumpia');
    expect(warnings[0]).toContain('need 5');
  });
  it('no warning when within availability', () => {
    expect(checkShortage({ lumpia: { enabled: true, sets: 2, halves: 0 } }, stock, [])).toEqual([]);
  });
  it('other upcoming orders eat into availability', () => {
    // stock 3, another upcoming order reserves 2 → only 1 free → a new 2-set order warns.
    const orders: Order[] = [{ id: 'a', order_status: 'Pending', needed_date: ymd(2), lumpia: { enabled: true, sets: 2, halves: 0 } }];
    const warnings = checkShortage({ lumpia: { enabled: true, sets: 2, halves: 0 } }, stock, orders);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Lumpia');
  });
  it('past and cancelled orders do not reduce availability', () => {
    const orders: Order[] = [
      { id: 'p', order_status: 'Pending', needed_date: ymd(-2), lumpia: { enabled: true, sets: 3, halves: 0 } }, // past — already cooked
      { id: 'c', order_status: 'Cancelled', needed_date: ymd(2), lumpia: { enabled: true, sets: 3, halves: 0 } },
    ];
    // Neither reserves → full stock of 3 free → a 3-set order fits.
    expect(checkShortage({ lumpia: { enabled: true, sets: 3, halves: 0 } }, stock, orders)).toEqual([]);
  });
  it('excludeId frees the edited order’s own reservation', () => {
    const orders: Order[] = [{ id: 'x', order_status: 'Pending', needed_date: ymd(2), lumpia: { enabled: true, sets: 3, halves: 0 } }];
    // Without exclude, the upcoming order reserves all 3 → editing it back to 3 would falsely warn.
    expect(checkShortage({ lumpia: { enabled: true, sets: 3, halves: 0 } }, stock, orders, 'x')).toEqual([]);
  });
});

describe('getMakeMoreNeeds', () => {
  it('computes shortfall for pending orders vs availability', () => {
    const stock = { lumpia_sets: 2, pancit_full: 0, pancit_half: 0, pancit_large: 0 };
    const orders: Order[] = [{ order_status: 'Pending', lumpia: { enabled: true, sets: 5, halves: 0 } }];
    const needs = getMakeMoreNeeds(orders, stock);
    expect(needs.lumpia).toEqual({ need: 3, avail: 2, total: 5 });
  });

  it('past orders no longer drive demand; undated orders count as upcoming', () => {
    const stock = { lumpia_sets: 0, pancit_full: 0, pancit_half: 0, pancit_large: 0 };
    const orders: Order[] = [
      { order_status: 'Pending', needed_date: ymd(-3), lumpia: { enabled: true, sets: 4, halves: 0 } }, // picked up days ago
      { order_status: 'Pending', needed_date: ymd(0),  lumpia: { enabled: true, sets: 2, halves: 0 } }, // today
      { order_status: 'Pending', needed_date: ymd(2),  lumpia: { enabled: true, sets: 1, halves: 0 } }, // upcoming
      { order_status: 'Pending',                       lumpia: { enabled: true, sets: 1, halves: 0 } }, // no date → assume upcoming
      { order_status: 'Cancelled', needed_date: ymd(2), lumpia: { enabled: true, sets: 9, halves: 0 } },
    ];
    const needs = getMakeMoreNeeds(orders, stock);
    expect(needs.lumpia.total).toBe(4); // 2 + 1 + 1; past 4 and cancelled 9 excluded
  });
});

// ─── DISCOUNT ────────────────────────────────────────────────────────────────────

describe('discountAmount / calcTotal with discount', () => {
  const base: Order = { pancit: { enabled: true, full: 2, half: 0, large: 0 }, delivery_type: 'pickup' };

  it('flat discount comes straight off the subtotal', () => {
    const o: Order = { ...base, discount_type: 'flat', discount_value: 10 };
    const sub = orderSubtotal(o);
    expect(discountAmount(o, sub)).toBe(10);
    expect(calcTotal(o)).toBe(sub - 10);
  });

  it('percent discount derives from the subtotal, rounded to cents', () => {
    const o: Order = { ...base, discount_type: 'percent', discount_value: 15 };
    const sub = orderSubtotal(o);
    expect(discountAmount(o, sub)).toBe(Math.round(sub * 15) / 100);
    expect(calcTotal(o)).toBe(sub - Math.round(sub * 15) / 100);
  });

  it('a discount larger than the subtotal clamps — the total floors at $0, never negative', () => {
    const o: Order = { ...base, discount_type: 'flat', discount_value: 99999 };
    expect(calcTotal(o)).toBe(0);
  });

  it('no value, zero, or negative → no discount', () => {
    expect(discountAmount(base, 100)).toBe(0);
    expect(discountAmount({ ...base, discount_type: 'flat', discount_value: 0 }, 100)).toBe(0);
    expect(discountAmount({ ...base, discount_type: 'percent', discount_value: -5 }, 100)).toBe(0);
  });

  it('discount stacks after fees — rush/early/delivery are part of the subtotal it applies to', () => {
    const o: Order = { ...base, rush_order: true, discount_type: 'percent', discount_value: 10 };
    const sub = orderSubtotal(o); // includes the rush fee
    expect(calcTotal(o)).toBe(sub - Math.round(sub * 10) / 100);
  });
});

// ─── SETTLED ─────────────────────────────────────────────────────────────────────

describe('isSettled', () => {
  it('Paid is settled', () => {
    expect(isSettled({ payment_status: 'Prepaid', total: 50 })).toBe(true);
  });
  it('a deposit covering the full total is settled', () => {
    expect(isSettled({ payment_status: 'Deposit', total: 50, deposit_amount: 50 })).toBe(true);
  });
  it('a partial deposit is not settled', () => {
    expect(isSettled({ payment_status: 'Deposit', total: 50, deposit_amount: 20 })).toBe(false);
  });
  it('Unpaid is not settled', () => {
    expect(isSettled({ payment_status: 'Unpaid', total: 50 })).toBe(false);
  });
  it('a cancelled order is never settled, even if it was paid', () => {
    expect(isSettled({ order_status: 'Cancelled', payment_status: 'Prepaid', total: 50 })).toBe(false);
  });
});

// ─── REVENUE ─────────────────────────────────────────────────────────────────────

describe('getRevenue', () => {
  it('counts any Prepaid/Deposit order regardless of status; excludes Unpaid', () => {
    const nowIso = new Date().toISOString();
    const orders: Order[] = [
      { order_status: 'Fulfilled', payment_status: 'Prepaid', total: 100, created_at: nowIso },
      { order_status: 'Ready',     payment_status: 'Deposit', total: 50,  created_at: nowIso },
      { order_status: 'Pending',   payment_status: 'Prepaid', total: 999, created_at: nowIso }, // now counted — cash in hand
      { order_status: 'Ready',     payment_status: 'Unpaid',  total: 25,  created_at: nowIso }, // excluded — no cash yet
      { order_status: 'Fulfilled', payment_status: 'Unpaid',  total: 500, created_at: nowIso }, // excluded — delivered ≠ paid
      { order_status: 'Fulfilled', payment_status: 'Prepaid', total: 25,  created_at: '2000-01-01T00:00:00Z' }, // old
    ];
    const rev = getRevenue(orders);
    expect(rev.total).toBe(1174); // 100 + 50 + 999 + 25 (both Unpaid orders excluded)
    expect(rev.month).toBe(1149); // same minus the 2000 order
  });
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────────

describe('fuzzyMatch', () => {
  it('case/punctuation-insensitive exact match', () => {
    expect(fuzzyMatch('Maria Santos', 'maria santos')).toBe(true);
    expect(fuzzyMatch('  Maria-Santos ', 'mariasantos')).toBe(true);
  });
  it('matches on shared 4-char prefix', () => {
    expect(fuzzyMatch('Maria Santos', 'Maria')).toBe(true);
  });
  it('non-match and null-safety', () => {
    expect(fuzzyMatch('Bob', 'Alice')).toBe(false);
    expect(fuzzyMatch(null, 'x')).toBe(false);
  });
});

describe('getRepeatCustomers / isRepeat', () => {
  it('counts by 6-char name key', () => {
    const counts = getRepeatCustomers([{ customer_name: 'Maria' }, { customer_name: 'maria' }, { customer_name: 'Bob' }]);
    expect(counts['maria']).toBe(2);
    expect(counts['bob']).toBe(1);
  });
  it('isRepeat finds a prior fuzzy-matching order', () => {
    const orders = [{ id: 1, customer_name: 'Maria Santos' }];
    expect(isRepeat('Maria', orders)).toBe(true);
    expect(isRepeat('Maria', orders, 1)).toBe(false); // excluding the only match
  });
});

describe('lastOrderFor', () => {
  const orders = [
    { id: 1, customer_name: 'Maria Santos', created_at: '2026-01-01T10:00:00', pancit: { enabled: true, full: 1 } },
    { id: 2, customer_name: 'Maria Santos', created_at: '2026-05-01T10:00:00', lumpia: { enabled: true, sets: 2 } },
    { id: 3, customer_name: 'Bob', created_at: '2026-05-10T10:00:00' },
  ];
  it('returns the most recent matching order by created_at', () => {
    expect(lastOrderFor('Maria', orders)?.id).toBe(2);
  });
  it('excludes a given id', () => {
    expect(lastOrderFor('Maria Santos', orders, 2)?.id).toBe(1);
  });
  it('returns undefined for unknown or blank name', () => {
    expect(lastOrderFor('Nobody', orders)).toBeUndefined();
    expect(lastOrderFor('', orders)).toBeUndefined();
  });
});

describe('buildOrderMessage', () => {
  const base = {
    customer_name: 'Tita Cora',
    needed_date: '2026-06-02',
    pickup_time: '14:00',
    total: 80,
    lumpia: { enabled: true, sets: 2, setsCooked: true },
  };
  it('includes name, items, date/time and a total line', () => {
    const msg = buildOrderMessage({ ...base, payment_status: 'Unpaid' });
    expect(msg).toContain('Tita Cora');
    expect(msg).toContain('2× full');
    expect(msg).toContain('14:00');
    expect(msg).toContain('$80.00');
  });
  it('shows deposit + balance for Deposit orders', () => {
    const msg = buildOrderMessage({ ...base, payment_status: 'Deposit', deposit_amount: 30 });
    expect(msg).toContain('Deposit $30.00');
    expect(msg).toContain('Balance $50.00');
  });
  it('shows fully paid for Prepaid orders', () => {
    expect(buildOrderMessage({ ...base, payment_status: 'Prepaid' })).toContain('Fully paid');
  });
  it('includes the discount line with its label — the goodwill moment', () => {
    const msg = buildOrderMessage({ ...base, payment_status: 'Unpaid', discount_type: 'flat', discount_value: 10, discount_label: 'Moved date 🙏' });
    expect(msg).toContain('🏷️ Moved date 🙏 −$10.00');
  });
  it('falls back to "Discount" when there is no label, and omits the line entirely when there is no discount', () => {
    expect(buildOrderMessage({ ...base, payment_status: 'Unpaid', discount_type: 'flat', discount_value: 5 })).toContain('🏷️ Discount −$5.00');
    expect(buildOrderMessage({ ...base, payment_status: 'Unpaid' })).not.toContain('🏷️');
  });
});

describe('buildReadyMessage', () => {
  const base = { customer_name: 'Sadie', total: 85, payment_status: 'Unpaid' as const };

  it('pickup: ready text with the time and the balance chase', () => {
    const msg = buildReadyMessage({ ...base, delivery_type: 'pickup', pickup_time: '10:30' });
    expect(msg).toBe('Hi Sadie! 🥟 Your order is ready for pickup — see you at 10:30! Balance: $85.00. Thank you! 🧡');
  });

  it('delivery: heading-your-way with the address', () => {
    const msg = buildReadyMessage({ ...base, delivery_type: 'city', address: '1 Main St' });
    expect(msg).toContain('ready and heading your way to 1 Main St! 🚗');
    expect(msg).toContain('Balance: $85.00');
  });

  it('fully paid: all-paid sign-off, no balance line', () => {
    const msg = buildReadyMessage({ ...base, payment_status: 'Prepaid', delivery_type: 'pickup' });
    expect(msg).toContain('All paid ✓ — see you soon! 🧡');
    expect(msg).not.toContain('Balance');
  });

  it('a deposit-covered order also reads as all paid', () => {
    const msg = buildReadyMessage({ ...base, payment_status: 'Deposit', deposit_amount: 85, delivery_type: 'pickup' });
    expect(msg).toContain('All paid ✓');
  });
});

// ─── FORMATTERS ────────────────────────────────────────────────────────────────

describe('formatDate / fmt', () => {
  it('formatDate handles null and a real date', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('2026-05-30')).toContain('2026');
  });
  it('fmt renders 2-decimal currency', () => {
    expect(fmt(5)).toBe('$5.00');
    expect(fmt(12.5)).toBe('$12.50');
  });
});

// ─── FULFILLABILITY WARNINGS ─────────────────────────────────────────────────────

describe('getIngredientWarnings', () => {
  it('no stock or no items → no warnings', () => {
    expect(getIngredientWarnings({ lumpia: { enabled: true } }, null)).toEqual([]);
    expect(getIngredientWarnings({}, { carrots_status: 'out' })).toEqual([]);
  });
  it('flags out-of-stock shared consumables', () => {
    const w = getIngredientWarnings(
      { lumpia: { enabled: true, sets: 1, halves: 0 } },
      { carrots_status: 'out', celery_status: 'plenty', lumpia_sets: 10 },
    );
    expect(w.some(x => x.includes('carrots'))).toBe(true);
    expect(w.some(x => x.includes('celery'))).toBe(false);
  });
  it('flags a noodle-pack shortage for pancit', () => {
    const w = getIngredientWarnings(
      { pancit: { enabled: true, full: 5, half: 0, large: 0 } },
      { noodle_packs: 1, carrots_status: 'plenty', celery_status: 'plenty' },
    );
    expect(w.some(x => x.includes('noodle packs'))).toBe(true);
  });
  it('each small/half tray uses one full noodle pack', () => {
    // 2 half trays → 2 packs needed; 1 on hand → shortage
    const w = getIngredientWarnings(
      { pancit: { enabled: true, full: 0, half: 2, large: 0 } },
      { noodle_packs: 1, carrots_status: 'plenty', celery_status: 'plenty' },
    );
    expect(w.some(x => x.includes('noodle packs'))).toBe(true);
  });
});

// ─── CALENDAR ──────────────────────────────────────────────────────────────────

describe('localYMD', () => {
  it('formats local Y-M-D with zero padding', () => {
    expect(localYMD(new Date(2026, 4, 30))).toBe('2026-05-30');
    expect(localYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getWeekDays', () => {
  it('returns 7 days, Sunday-first, including the anchor', () => {
    const anchor = new Date(2026, 4, 30);
    const week = getWeekDays(anchor);
    expect(week).toHaveLength(7);
    expect(new Date(week[0] + 'T00:00:00').getDay()).toBe(0); // Sunday
    expect(week).toContain(localYMD(anchor));
  });
});

describe('getMonthGrid', () => {
  it('full Sunday-start weeks covering the month', () => {
    const grid = getMonthGrid(new Date(2026, 4, 15));
    expect(grid.every(week => week.length === 7)).toBe(true);
    expect(new Date(grid[0][0] + 'T00:00:00').getDay()).toBe(0);
    const flat = grid.flat();
    expect(flat).toContain('2026-05-01');
    expect(flat).toContain('2026-05-31');
  });
});

describe('dayLoad', () => {
  it('empty day → light', () => {
    expect(dayLoad([])).toEqual({ units: 0, level: 'light' });
  });
  it('skips cancelled and weights items', () => {
    const orders: Order[] = [
      { order_status: 'Pending', lumpia: { enabled: true, sets: 1, halves: 2 } }, // 1 + 1 = 2
      { order_status: 'Cancelled', pancit: { enabled: true, full: 9 } },          // ignored
    ];
    expect(dayLoad(orders).units).toBe(2);
  });
  it('crosses medium and heavy thresholds', () => {
    expect(dayLoad([{ order_status: 'Pending', pancit: { enabled: true, full: LOAD_THRESHOLDS.medium } }]).level).toBe('medium');
    expect(dayLoad([{ order_status: 'Pending', pancit: { enabled: true, full: LOAD_THRESHOLDS.heavy } }]).level).toBe('heavy');
  });
});

// ─── PREP SHEET ──────────────────────────────────────────────────────────────

describe('buildPrepList', () => {
  const day = '2026-05-30';
  const mk = (over?: Partial<Order>): Order => ({ needed_date: day, order_status: 'Pending', ...over });

  it('filters to the day, drops cancelled, sorts by pickup_time', () => {
    const orders = [
      mk({ id: 1, pickup_time: '14:00' }),
      mk({ id: 2, pickup_time: '09:00' }),
      mk({ id: 3, needed_date: '2026-05-31', pickup_time: '08:00' }),    // other day
      mk({ id: 4, order_status: 'Cancelled', pickup_time: '01:00' }),    // cancelled
    ];
    const { orders: rows, totals } = buildPrepList(orders, day);
    expect(rows.map(o => o.id)).toEqual([2, 1]);
    expect(totals.orderCount).toBe(2);
  });

  it('aggregates lumpia cooked/uncooked sets and halves', () => {
    const orders = [
      mk({ lumpia: { enabled: true, sets: 2, setsCooked: true, halves: 1, halvesCooked: false } }),
      mk({ lumpia: { enabled: true, sets: 1, setsCooked: false, halves: 2, halvesCooked: true } }),
    ];
    expect(buildPrepList(orders, day).totals.lumpia)
      .toEqual({ setsCooked: 2, setsUncooked: 1, halvesCooked: 2, halvesUncooked: 1 });
  });

  it('respects legacy lumpia.style for cooked resolution', () => {
    const orders = [mk({ lumpia: { enabled: true, sets: 3, halves: 0, style: 'cooked' } })];
    const { lumpia } = buildPrepList(orders, day).totals;
    expect(lumpia.setsCooked).toBe(3);
    expect(lumpia.setsUncooked).toBe(0);
  });

  it('aggregates pancit trays, extra-meat count, sauces, and rush', () => {
    const orders = [
      mk({ pancit: { enabled: true, full: 2, half: 1, large: 0, extraMeat: true }, lumpia: { enabled: true, sets: 1, setsCooked: true, halves: 0, sauces: ['sweet_chili'] }, rush_order: true }),
      mk({ pancit: { enabled: true, full: 1, half: 0, large: 2, extraMeat: false } }),
    ];
    const { totals } = buildPrepList(orders, day);
    expect(totals.pancit).toEqual({ full: 3, half: 1, large: 2, extraMeat: 1 });
    expect(totals.sauces.sweet_chili).toBe(1);
    expect(totals.rushCount).toBe(1);
  });

  it('empty day → zeroed totals', () => {
    const { orders: rows, totals } = buildPrepList([], day);
    expect(rows).toEqual([]);
    expect(totals.orderCount).toBe(0);
    expect(totals.lumpia.setsCooked).toBe(0);
  });
});

// ─── EARLY FEE / PAYMENT / DEPOSIT / RUSH ────────────────────────────────────────
// Consolidated 2026-06-21 from the former src/lib/utils.test.ts twin so utils.ts
// has a single test home. Uses the module-scope base()/NOW helpers above.

describe('isEarlyFulfillment', () => {
  it('is false with no pickup time set', () => {
    expect(isEarlyFulfillment(base({ pickup_time: '' }))).toBe(false);
    expect(isEarlyFulfillment(base({ pickup_time: undefined }))).toBe(false);
  });

  it('is false on a malformed time string', () => {
    expect(isEarlyFulfillment(base({ pickup_time: 'noon' }))).toBe(false);
  });

  describe('pickup — cutoff 11am', () => {
    it('flags before 11am', () => {
      expect(isEarlyFulfillment(base({ delivery_type: 'pickup', pickup_time: '10:30' }))).toBe(true);
      expect(isEarlyFulfillment(base({ delivery_type: 'pickup', pickup_time: '10:59' }))).toBe(true);
    });
    it('does not flag at or after 11am', () => {
      expect(isEarlyFulfillment(base({ delivery_type: 'pickup', pickup_time: '11:00' }))).toBe(false);
      expect(isEarlyFulfillment(base({ delivery_type: 'pickup', pickup_time: '11:30' }))).toBe(false);
    });
  });

  describe('delivery — same flat 11am cutoff as pickup', () => {
    it('does not flag a delivery at 11:00 or later', () => {
      expect(isEarlyFulfillment(base({ delivery_type: 'city',    pickup_time: '11:00' }))).toBe(false);
      expect(isEarlyFulfillment(base({ delivery_type: 'outside', pickup_time: '11:30' }))).toBe(false);
      expect(isEarlyFulfillment(base({ delivery_type: 'city',    pickup_time: '12:00' }))).toBe(false);
    });
    it('flags a delivery before 11am', () => {
      expect(isEarlyFulfillment(base({ delivery_type: 'city',    pickup_time: '10:30' }))).toBe(true);
      expect(isEarlyFulfillment(base({ delivery_type: 'outside', pickup_time: '09:00' }))).toBe(true);
    });
  });
});

describe('earlyFeeApplies', () => {
  it('applies when early and not waived', () => {
    expect(earlyFeeApplies(base({ pickup_time: '09:00' }))).toBe(true);
  });
  it('does not apply when waived', () => {
    expect(earlyFeeApplies(base({ pickup_time: '09:00', early_fee_waived: true }))).toBe(false);
  });
  it('does not apply when not early', () => {
    expect(earlyFeeApplies(base({ pickup_time: '14:00' }))).toBe(false);
  });
});

describe('calcTotal — early fee', () => {
  const PANCIT_FULL = 25;

  it('adds the early fee for an early pickup', () => {
    expect(calcTotal(base({ delivery_type: 'pickup', pickup_time: '09:00' })))
      .toBe(PANCIT_FULL + EARLY_ORDER_FEE);
  });

  it('omits the fee when the early order is waived', () => {
    expect(calcTotal(base({ delivery_type: 'pickup', pickup_time: '09:00', early_fee_waived: true })))
      .toBe(PANCIT_FULL);
  });

  it('does not add the early fee at 11:30 for any delivery type', () => {
    expect(calcTotal(base({ delivery_type: 'city',   pickup_time: '11:30' }))).toBe(PANCIT_FULL + DELIVERY_FEE.city);
    expect(calcTotal(base({ delivery_type: 'pickup', pickup_time: '11:30' }))).toBe(PANCIT_FULL);
  });

  it('stacks with the rush fee', () => {
    expect(calcTotal(base({ delivery_type: 'pickup', pickup_time: '08:00', rush_order: true })))
      .toBe(PANCIT_FULL + RUSH_ORDER_FEE + EARLY_ORDER_FEE);
  });
});

describe('amountOwing', () => {
  it('Unpaid owes the full total', () => {
    expect(amountOwing(base({ payment_status: 'Unpaid', total: 60 }))).toBe(60);
  });
  it('Deposit owes the balance after the deposit', () => {
    expect(amountOwing(base({ payment_status: 'Deposit', total: 60, deposit_amount: 30 }))).toBe(30);
  });
  it('Prepaid owes nothing', () => {
    expect(amountOwing(base({ payment_status: 'Prepaid', total: 60 }))).toBe(0);
  });
  it('Cancelled owes nothing even if unpaid', () => {
    expect(amountOwing(base({ payment_status: 'Unpaid', total: 60, order_status: 'Cancelled' }))).toBe(0);
  });
  it('never goes negative when the deposit exceeds the total', () => {
    expect(amountOwing(base({ payment_status: 'Deposit', total: 60, deposit_amount: 80 }))).toBe(0);
  });
  it('falls back to calcTotal when total is not stored', () => {
    // pancit full = 25, pickup, no fees
    expect(amountOwing(base({ payment_status: 'Unpaid', total: undefined }))).toBe(25);
  });
});

describe('amountReceived', () => {
  it('Prepaid received the full total', () => {
    expect(amountReceived(base({ payment_status: 'Prepaid', total: 42.5 }))).toBe(42.5);
  });
  it('Deposit received the deposit amount', () => {
    expect(amountReceived(base({ payment_status: 'Deposit', total: 42.5, deposit_amount: 43 }))).toBe(43);
  });
  it('Unpaid received nothing', () => {
    expect(amountReceived(base({ payment_status: 'Unpaid', total: 42.5 }))).toBe(0);
  });
});

describe('tipAmount', () => {
  it('is the surplus when the deposit exceeds the total', () => {
    expect(tipAmount(base({ payment_status: 'Deposit', total: 42.5, deposit_amount: 43 }))).toBeCloseTo(0.5);
  });
  it('is 0 when paid exactly', () => {
    expect(tipAmount(base({ payment_status: 'Deposit', total: 42.5, deposit_amount: 42.5 }))).toBe(0);
  });
  it('is 0 on a partial deposit (that is owing, not a tip)', () => {
    expect(tipAmount(base({ payment_status: 'Deposit', total: 60, deposit_amount: 30 }))).toBe(0);
    expect(amountOwing(base({ payment_status: 'Deposit', total: 60, deposit_amount: 30 }))).toBe(30);
  });
  it('is 0 for Prepaid and Cancelled', () => {
    expect(tipAmount(base({ payment_status: 'Prepaid', total: 42.5 }))).toBe(0);
    expect(tipAmount(base({ payment_status: 'Deposit', total: 42.5, deposit_amount: 43, order_status: 'Cancelled' }))).toBe(0);
  });
  it('an overpaid deposit owes nothing', () => {
    expect(amountOwing(base({ payment_status: 'Deposit', total: 42.5, deposit_amount: 43 }))).toBe(0);
  });

  it('prefers an explicit tip_amount (the Paid + tip path)', () => {
    // Paid in full; amountReceived = total, so the derived surplus is 0 —
    // the explicit tip must win (this is the $50-given-as-tip case).
    expect(tipAmount(base({ payment_status: 'Prepaid', total: 42.5, tip_amount: 7.5 }))).toBe(7.5);
  });
  it('explicit tip_amount of 0 means change was given, not a tip', () => {
    expect(tipAmount(base({ payment_status: 'Prepaid', total: 42.5, tip_amount: 0 }))).toBe(0);
  });
});

describe('getRevenue — monthly bucketing by needed_date', () => {
  const nowYear = new Date().getFullYear();
  const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const lastMonth = String(new Date().getMonth() === 0 ? 12 : new Date().getMonth()).padStart(2, '0');
  const lastMonthYear = new Date().getMonth() === 0 ? nowYear - 1 : nowYear;

  it('counts an order placed last month but needed this month in revenue.month', () => {
    const order = base({
      order_status: 'Pending',
      payment_status: 'Prepaid',
      total: 42.5,
      needed_date: `${nowYear}-${thisMonth}-15`,
      created_at: `${lastMonthYear}-${lastMonth}-20T10:00:00Z`,
    });
    const rev = getRevenue([order]);
    expect(rev.month).toBeCloseTo(42.5);
    expect(rev.total).toBeCloseTo(42.5);
  });

  it('excludes an order with needed_date in a previous month from revenue.month', () => {
    const order = base({
      order_status: 'Fulfilled',
      payment_status: 'Prepaid',
      total: 42.5,
      needed_date: `${lastMonthYear}-${lastMonth}-15`,
    });
    const rev = getRevenue([order]);
    expect(rev.month).toBe(0);
    expect(rev.total).toBeCloseTo(42.5);
  });
});

describe('getRevenue — cash-in-hand counting', () => {
  it('counts a Prepaid Pending order — money received before fulfilment', () => {
    const order = base({ order_status: 'Pending', payment_status: 'Prepaid', total: 42.5 });
    expect(getRevenue([order]).total).toBeCloseTo(42.5);
  });
  it('counts a Deposit Pending order — partial cash received', () => {
    const order = base({ order_status: 'Pending', payment_status: 'Deposit', deposit_amount: 20, total: 42.5 });
    expect(getRevenue([order]).total).toBeCloseTo(42.5);
  });
  it('counts a Prepaid Ready order', () => {
    const order = base({ order_status: 'Ready', payment_status: 'Prepaid', total: 42.5 });
    expect(getRevenue([order]).total).toBeCloseTo(42.5);
  });
  it('does NOT count an Unpaid Pending order', () => {
    const order = base({ order_status: 'Pending', payment_status: 'Unpaid', total: 42.5 });
    expect(getRevenue([order]).total).toBe(0);
  });
  it('does NOT double-count a Fulfilled Prepaid order', () => {
    const order = base({ order_status: 'Fulfilled', payment_status: 'Prepaid', total: 42.5 });
    expect(getRevenue([order]).total).toBeCloseTo(42.5);
  });
});

describe('getRevenue — tips count as cash', () => {
  it('includes the tip on a counted (fulfilled) order', () => {
    const tipped = base({ order_status: 'Fulfilled', payment_status: 'Deposit', total: 42.5, deposit_amount: 43 });
    expect(getRevenue([tipped]).total).toBeCloseTo(43);
  });
  it('counts only the total when paid exactly', () => {
    const exact = base({ order_status: 'Fulfilled', payment_status: 'Prepaid', total: 42.5 });
    expect(getRevenue([exact]).total).toBeCloseTo(42.5);
  });
  it('includes an explicit tip on a Paid order ($50 kept as tip)', () => {
    const tipped = base({ order_status: 'Fulfilled', payment_status: 'Prepaid', total: 42.5, tip_amount: 7.5 });
    expect(getRevenue([tipped]).total).toBeCloseTo(50);
  });
  it('change given (tip 0) counts only the total', () => {
    const change = base({ order_status: 'Fulfilled', payment_status: 'Prepaid', total: 42.5, tip_amount: 0 });
    expect(getRevenue([change]).total).toBeCloseTo(42.5);
  });
});

describe('custom items', () => {
  it('customItemsTotal sums the prices', () => {
    expect(customItemsTotal(base({ custom_items: [{ name: 'Embutido', price: 40 }, { name: 'Leche flan', price: 25 }] }))).toBe(65);
    expect(customItemsTotal(base({ custom_items: [] }))).toBe(0);
    expect(customItemsTotal(base({}))).toBe(0);
  });
  it('calcTotal adds custom items on top of the menu items', () => {
    // base = pancit full ($25)
    expect(calcTotal(base({ custom_items: [{ name: 'Embutido', price: 40 }] }))).toBe(65);
  });
  it('orderSummary lists the custom dish names', () => {
    const s = orderSummary(base({ custom_items: [{ name: 'Embutido', price: 40 }] }));
    expect(s).toContain('Embutido');
  });
});

describe('lumpiaPieceCount', () => {
  const lump = (over: Partial<LumpiaOrder> = {}): LumpiaOrder => ({ sets: 0, halves: 0, ...over });
  it('counts sets as 100 pieces each', () => {
    expect(lumpiaPieceCount(lump({ sets: 2 }))).toBe(200);
    expect(lumpiaPieceCount(lump({ sets: 3 }))).toBe(300);
  });
  it('counts halves as 50 pieces each', () => {
    expect(lumpiaPieceCount(lump({ halves: 2 }))).toBe(100);
  });
  it('combines sets and halves', () => {
    // 2 sets (200) + 1 half (50) = 250
    expect(lumpiaPieceCount(lump({ sets: 2, halves: 1 }))).toBe(250);
  });
  it('zero is zero', () => {
    expect(lumpiaPieceCount(lump())).toBe(0);
  });
});

describe('requiresDeposit', () => {
  it('is false for a small lumpia order (≤200 pieces)', () => {
    // 2 sets = 200 pieces, exactly at the threshold — no deposit
    expect(requiresDeposit(base({ lumpia: { enabled: true, sets: 2, halves: 0 } }), NOW)).toBe(false);
  });
  it('is true when lumpia exceeds 200 pieces', () => {
    // 2 sets + 1 half = 250 pieces
    expect(requiresDeposit(base({ lumpia: { enabled: true, sets: 2, halves: 1 } }), NOW)).toBe(true);
    // 3 sets = 300 pieces
    expect(requiresDeposit(base({ lumpia: { enabled: true, sets: 3, halves: 0 } }), NOW)).toBe(true);
  });
  it('lumpia flag only applies when lumpia is enabled', () => {
    expect(requiresDeposit(base({ lumpia: { enabled: false, sets: 5, halves: 5 } }), NOW)).toBe(false);
  });
  it('is true when needed_date is more than 21 days out', () => {
    // NOW = 2026-06-17; 22 days later = 2026-07-09
    expect(requiresDeposit(base({ needed_date: '2026-07-09' }), NOW)).toBe(true);
  });
  it('is false when needed_date is exactly 21 days out', () => {
    // NOW = 2026-06-17; 21 days = 2026-07-08
    expect(requiresDeposit(base({ needed_date: '2026-07-08' }), NOW)).toBe(false);
  });
  it('is false when needed_date is less than 21 days out', () => {
    expect(requiresDeposit(base({ needed_date: '2026-06-25' }), NOW)).toBe(false);
  });
  it('uses created_at instead of now when provided', () => {
    const order = base({ needed_date: '2026-07-15', created_at: '2026-06-17T12:00:00' });
    expect(requiresDeposit(order, new Date('2099-01-01'))).toBe(true);
  });
  it('is false when no lumpia and no needed_date', () => {
    expect(requiresDeposit(base(), NOW)).toBe(false);
  });
});

describe('depositFor', () => {
  it('is 50% of the order total', () => {
    // pancit full = $25, deposit = $12.50
    expect(depositFor(base())).toBeCloseTo(12.5);
  });
  it('rounds to the nearest cent', () => {
    // pancit full ($25) + rush ($10) = $35, half = $17.50
    expect(depositFor(base({ rush_order: true }))).toBeCloseTo(17.5);
  });
});

describe('isAutoRush', () => {
  it('is true when needed_date is less than 24h from now', () => {
    const tomorrow = new Date(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateYmd = tomorrow.toISOString().slice(0, 10);
    // NOW is noon; the needed_date's midnight is 12h away
    expect(isAutoRush({ needed_date: dateYmd }, NOW)).toBe(true);
  });
  it('is false when needed_date is 2 days away', () => {
    // 2 days out > 24h
    expect(isAutoRush({ needed_date: '2026-06-19' }, NOW)).toBe(false);
  });
  it('is false when no needed_date', () => {
    expect(isAutoRush({}, NOW)).toBe(false);
  });
  it('uses created_at when provided', () => {
    const order = { needed_date: '2026-06-18', created_at: '2026-06-17T01:00:00' };
    // midnight of 06-18 is 23h from 01:00 on 06-17 → < 24h → rush
    expect(isAutoRush(order, new Date('2099-01-01'))).toBe(true);
  });
  it('is false when created_at leaves >24h to needed_date', () => {
    const order = { needed_date: '2026-06-19', created_at: '2026-06-17T01:00:00' };
    expect(isAutoRush(order, new Date('2099-01-01'))).toBe(false);
  });
});

describe('nextAvailableDate', () => {
  it('returns the day after when nothing is blocked', () => {
    expect(nextAvailableDate('2026-06-10', new Set())).toBe('2026-06-11');
  });
  it('skips a single blocked day', () => {
    expect(nextAvailableDate('2026-06-10', new Set(['2026-06-11']))).toBe('2026-06-12');
  });
  it('skips a range of blocked days', () => {
    const blocked = new Set(['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01']);
    expect(nextAvailableDate('2026-06-21', blocked)).toBe('2026-07-02');
  });
  it('does not return the from date itself even if unblocked', () => {
    expect(nextAvailableDate('2026-06-10', new Set())).not.toBe('2026-06-10');
  });
});

describe('orderSummary — early fee line', () => {
  it('lists the early fee when it applies', () => {
    expect(orderSummary(base({ pickup_time: '09:00' }))).toContain('Early order fee');
  });
  it('omits the line when waived', () => {
    expect(orderSummary(base({ pickup_time: '09:00', early_fee_waived: true }))).not.toContain('Early order fee');
  });
});
