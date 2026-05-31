import { describe, it, expect } from 'vitest';
import {
  lumpiaRevenue,
  pancitRevenue,
  orderMonth,
  itemBreakdownForMonth,
  recentMonths,
  monthlyItemSeries,
} from './insights';
import type { Order } from '../types';

const order = (over: Partial<Order> = {}): Order => ({ needed_date: '2026-05-10', ...over });

describe('lumpiaRevenue', () => {
  it('prices full sets + halves by cooked/uncooked, plus sauces', () => {
    const o = order({
      lumpia: { enabled: true, sets: 2, setsCooked: true, halves: 1, halvesCooked: false, sauces: ['sweet_chili'] },
    });
    // 2 × 35 (cooked full) + 1 × 15 (uncooked half) + 1 × 2 (sauce) = 87
    expect(lumpiaRevenue(o)).toBe(87);
  });
  it('falls back to the legacy style field', () => {
    const o = order({ lumpia: { enabled: true, sets: 1, style: 'cooked' } });
    expect(lumpiaRevenue(o)).toBe(35);
  });
  it('is 0 when lumpia is not enabled', () => {
    expect(lumpiaRevenue(order({ lumpia: { enabled: false, sets: 5 } }))).toBe(0);
  });
});

describe('pancitRevenue', () => {
  it('prices full / half / large + extra meat', () => {
    const o = order({ pancit: { enabled: true, full: 1, half: 2, large: 1, extraMeat: true } });
    // 25 + 2×12.5 + 50 + 5 = 105
    expect(pancitRevenue(o)).toBe(105);
  });
  it('is 0 when pancit is not enabled', () => {
    expect(pancitRevenue(order({ pancit: { enabled: false, full: 3 } }))).toBe(0);
  });
});

describe('orderMonth', () => {
  it('groups by the fulfillment month', () => {
    expect(orderMonth(order({ needed_date: '2026-05-31' }))).toBe('2026-05');
  });
  it('falls back to created_at when no needed_date', () => {
    expect(orderMonth(order({ needed_date: undefined, created_at: '2026-04-02T10:00:00Z' }))).toBe('2026-04');
  });
});

describe('itemBreakdownForMonth', () => {
  const orders: Order[] = [
    order({ needed_date: '2026-05-03', lumpia: { enabled: true, sets: 2, setsCooked: true } }),       // 70
    order({ needed_date: '2026-05-20', pancit: { enabled: true, full: 1, half: 1 } }),                 // 37.5
    order({ needed_date: '2026-05-25', lumpia: { enabled: true, halves: 2, halvesCooked: true },
            pancit: { enabled: true, large: 1 } }),                                                    // 35 + 50
    order({ needed_date: '2026-04-15', lumpia: { enabled: true, sets: 5, setsCooked: true } }),        // other month
    order({ needed_date: '2026-05-09', order_status: 'Cancelled', pancit: { enabled: true, full: 9 } }), // excluded
  ];

  it('sums volume and revenue for the month, excluding cancelled and other months', () => {
    const b = itemBreakdownForMonth(orders, '2026-05');
    expect(b.orderCount).toBe(3);
    expect(b.lumpia.full).toBe(2);
    expect(b.lumpia.half).toBe(2);
    expect(b.pancit.full).toBe(1);
    expect(b.pancit.half).toBe(1);
    expect(b.pancit.large).toBe(1);
    expect(b.lumpia.revenue).toBeCloseTo(70 + 2 * 17.5);   // 105
    expect(b.pancit.revenue).toBeCloseTo(25 + 12.5 + 50);  // 87.5
    expect(b.itemRevenue).toBeCloseTo(192.5);
  });

  it('returns an empty breakdown for a month with no orders', () => {
    const b = itemBreakdownForMonth(orders, '2026-01');
    expect(b.orderCount).toBe(0);
    expect(b.itemRevenue).toBe(0);
  });
});

describe('recentMonths', () => {
  it('lists the last N months newest-first, handling year rollover', () => {
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});

describe('monthlyItemSeries', () => {
  it('produces one breakdown per recent month', () => {
    const orders = [order({ needed_date: '2026-05-10', pancit: { enabled: true, full: 1 } })];
    const series = monthlyItemSeries(orders, 2, new Date(2026, 4, 15));
    expect(series.map(s => s.month)).toEqual(['2026-05', '2026-04']);
    expect(series[0].itemRevenue).toBe(25);
    expect(series[1].itemRevenue).toBe(0);
  });
});
