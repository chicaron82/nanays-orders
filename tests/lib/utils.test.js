import { describe, it, expect } from 'vitest';
import {
  calcTotal, orderSummary,
  getDaysUntil, urgencyLabel,
  getReserved, getAvailable, checkShortage, getMakeMoreNeeds,
  getRevenue,
  fuzzyMatch, getRepeatCustomers, isRepeat,
  formatDate, fmt,
  getIngredientWarnings,
  localYMD, getWeekDays, getMonthGrid,
  dayLoad, LOAD_THRESHOLDS,
} from '../../src/lib/utils';

// Build a local YYYY-MM-DD offset from today (deterministic regardless of run date)
const ymd = (offsetDays = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return localYMD(d);
};

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
    expect(calcTotal({ lumpia: { enabled: true, sets: 1, setsCooked: false, halves: 3, halvesCooked: false, sauces: [] } })).toBe(75); // 30 + 3×15
  });

  it('adds sauce prices', () => {
    expect(calcTotal({ lumpia: { enabled: true, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: ['sweet_and_sour', 'sweet_chili'] } })).toBe(39); // 35 + 2 + 2
  });

  it('pancit full/half/large + extra meat', () => {
    expect(calcTotal({ pancit: { enabled: true, full: 2, half: 1, large: 1, extraMeat: true } })).toBe(117.5); // 50 + 12.5 + 50 + 5
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
    expect(urgencyLabel(-1).text).toBe('1d overdue');
    expect(urgencyLabel(0).text).toBe('Today!');
    expect(urgencyLabel(1).text).toBe('Tomorrow');
  });
  it('buckets by distance', () => {
    expect(urgencyLabel(2).tailwind).toContain('yellow');
    expect(urgencyLabel(5).tailwind).toContain('emerald');
    expect(urgencyLabel(30).tailwind).toContain('gray');
  });
});

// ─── STOCK ───────────────────────────────────────────────────────────────────────

describe('getReserved', () => {
  it('only Ready orders reserve stock; halves count as 0.5', () => {
    const orders = [
      { order_status: 'Ready', lumpia: { enabled: true, sets: 2, halves: 2 }, pancit: { enabled: true, full: 1, half: 2, large: 1 } },
      { order_status: 'Pending', lumpia: { enabled: true, sets: 5, halves: 0 } }, // ignored
    ];
    const r = getReserved(orders);
    expect(r.lumpiaSets).toBe(3); // 2 + 2×0.5
    expect(r.pancitFull).toBe(1);
    expect(r.pancitHalf).toBe(2);
    expect(r.pancitLarge).toBe(1);
  });
});

describe('getAvailable', () => {
  it('subtracts Ready reservations from stock', () => {
    const stock = { lumpia_sets: 10, pancit_full: 5, pancit_half: 4, pancit_large: 2 };
    const orders = [{ order_status: 'Ready', lumpia: { enabled: true, sets: 3, halves: 0 }, pancit: { enabled: true, full: 1, half: 0, large: 0 } }];
    const a = getAvailable(stock, orders);
    expect(a.lumpiaSets).toBe(7);
    expect(a.pancitFull).toBe(4);
    expect(a.pancitHalf).toBe(4);
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
  it('excludeId frees the edited order’s own reservation', () => {
    const orders = [{ id: 'x', order_status: 'Ready', lumpia: { enabled: true, sets: 3, halves: 0 } }];
    // Without exclude, all 3 are reserved → editing the same order to 3 would falsely warn
    expect(checkShortage({ lumpia: { enabled: true, sets: 3, halves: 0 } }, stock, orders, 'x')).toEqual([]);
  });
});

describe('getMakeMoreNeeds', () => {
  it('computes shortfall for pending orders vs availability', () => {
    const stock = { lumpia_sets: 2, pancit_full: 0, pancit_half: 0, pancit_large: 0 };
    const orders = [{ order_status: 'Pending', lumpia: { enabled: true, sets: 5, halves: 0 } }];
    const needs = getMakeMoreNeeds(orders, stock);
    expect(needs.lumpia).toEqual({ need: 3, avail: 2, total: 5 });
  });
});

// ─── REVENUE ─────────────────────────────────────────────────────────────────────

describe('getRevenue', () => {
  it('counts Fulfilled and Ready(Prepaid/Deposit); excludes Pending and Ready-Unpaid', () => {
    const nowIso = new Date().toISOString();
    const orders = [
      { order_status: 'Fulfilled', payment_status: 'Prepaid', total: 100, created_at: nowIso },
      { order_status: 'Ready', payment_status: 'Deposit', total: 50, created_at: nowIso },
      { order_status: 'Pending', payment_status: 'Prepaid', total: 999, created_at: nowIso },     // excluded
      { order_status: 'Ready', payment_status: 'Unpaid', total: 999, created_at: nowIso },         // excluded
      { order_status: 'Fulfilled', payment_status: 'Prepaid', total: 25, created_at: '2000-01-01T00:00:00Z' }, // old
    ];
    const rev = getRevenue(orders);
    expect(rev.total).toBe(175); // 100 + 50 + 25
    expect(rev.month).toBe(150); // 100 + 50 (the 2000 order isn't this month)
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
    const orders = [
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
