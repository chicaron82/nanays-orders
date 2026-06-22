import { describe, it, expect } from 'vitest';
import {
  lumpiaRevenue,
  pancitRevenue,
  orderDate,
  orderMonth,
  itemBreakdownForMonth,
  recentMonths,
  monthlyItemSeries,
  weekdayDemand,
  halfBatchInsight,
  ordersWithinDays,
  linkOrderStats,
} from './insights';
import type { Order } from '../types';

const order = (over: Partial<Order> = {}): Order => ({ needed_date: '2026-05-10', ...over });

describe('lumpiaRevenue', () => {
  it('prices full sets + halves by cooked/uncooked, plus sauces', () => {
    const o = order({
      lumpia: { enabled: true, sets: 2, setsCooked: true, halves: 1, halvesCooked: false, sauces: ['sweet_chili'] },
    });
    // 2 × 35 (cooked full) + 1 × 18 (uncooked half) + 1 × 2 (sauce) = 90
    expect(lumpiaRevenue(o)).toBe(90);
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
    // 25 + 2×13 + 50 + 10 = 111
    expect(pancitRevenue(o)).toBe(111);
  });
  it('is 0 when pancit is not enabled', () => {
    expect(pancitRevenue(order({ pancit: { enabled: false, full: 3 } }))).toBe(0);
  });
});

describe('orderDate', () => {
  it('uses needed_date when present', () => {
    expect(orderDate(order({ needed_date: '2026-05-31' }))).toBe('2026-05-31');
  });
  it('falls back to the created_at day', () => {
    expect(orderDate(order({ needed_date: undefined, created_at: '2026-04-02T10:00:00Z' }))).toBe('2026-04-02');
  });
  it('is empty when neither is present', () => {
    expect(orderDate(order({ needed_date: undefined, created_at: undefined }))).toBe('');
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

describe('ordersWithinDays', () => {
  const from = new Date(2026, 4, 31); // 2026-05-31
  const orders: Order[] = [
    order({ needed_date: '2026-05-31' }),  // today — in
    order({ needed_date: '2026-05-01' }),  // 31 days back — in (90d window)
    order({ needed_date: '2026-03-03' }),  // ~89 days back — in
    order({ needed_date: '2026-01-15' }),  // way out — excluded
    order({ needed_date: undefined, created_at: '2026-05-20T09:00:00Z' }), // fallback — in
  ];

  it('keeps orders inside the trailing window and drops older ones', () => {
    const within = ordersWithinDays(orders, 90, from);
    expect(within).toHaveLength(4);
    expect(within.some(o => o.needed_date === '2026-01-15')).toBe(false);
  });

  it('includes the boundary day (inclusive cutoff)', () => {
    // 90-day window ending 2026-05-31 → cutoff 2026-03-03
    const within = ordersWithinDays([order({ needed_date: '2026-03-03' })], 90, from);
    expect(within).toHaveLength(1);
  });

  it('honors the created_at fallback for the window', () => {
    const within = ordersWithinDays(orders, 90, from);
    expect(within.some(o => o.created_at === '2026-05-20T09:00:00Z')).toBe(true);
  });

  it('drops orders with no date at all', () => {
    const within = ordersWithinDays([order({ needed_date: undefined, created_at: undefined })], 90, from);
    expect(within).toHaveLength(0);
  });
});

describe('itemBreakdownForMonth', () => {
  const orders: Order[] = [
    order({ needed_date: '2026-05-03', lumpia: { enabled: true, sets: 2, setsCooked: true } }),       // 70
    order({ needed_date: '2026-05-20', pancit: { enabled: true, full: 1, half: 1 } }),                 // 38
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
    expect(b.lumpia.revenue).toBeCloseTo(70 + 2 * 20);      // 110
    expect(b.pancit.revenue).toBeCloseTo(25 + 13 + 50);  // 88
    expect(b.itemRevenue).toBeCloseTo(198);
  });

  it('returns an empty breakdown for a month with no orders', () => {
    const b = itemBreakdownForMonth(orders, '2026-01');
    expect(b.orderCount).toBe(0);
    expect(b.itemRevenue).toBe(0);
  });

  it('counts custom one-off items in their own bucket and the item total', () => {
    const withCustom: Order[] = [
      order({ needed_date: '2026-05-08', custom_items: [{ name: 'Embutido', price: 40 }, { name: 'Leche flan', price: 25 }] }),
      order({ needed_date: '2026-05-12', pancit: { enabled: true, full: 1 }, custom_items: [{ name: 'Embutido', price: 40 }] }),
    ];
    const b = itemBreakdownForMonth(withCustom, '2026-05');
    expect(b.custom.count).toBe(3);
    expect(b.custom.revenue).toBe(105);
    expect(b.itemRevenue).toBeCloseTo(25 + 105); // one pancit reg + custom
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

describe('weekdayDemand', () => {
  // 2026-05-29 = Friday (day 5), 2026-05-30 = Saturday (day 6)
  const orders: Order[] = [
    order({ needed_date: '2026-05-29', lumpia: { enabled: true, sets: 1 } }),          // Fri, lumpia
    order({ needed_date: '2026-05-29', pancit: { enabled: true, full: 1 } }),           // Fri, pancit
    order({ needed_date: '2026-05-30', lumpia: { enabled: true, sets: 1 },
            pancit: { enabled: true, full: 1 } }),                                      // Sat, both
    order({ needed_date: '2026-05-29', order_status: 'Cancelled',
            lumpia: { enabled: true, sets: 1 } }),                                      // Fri, excluded
    order({ needed_date: undefined, created_at: undefined }),                           // no date, skipped
  ];

  it('returns 7 slots (one per day, Sun=0…Sat=6)', () => {
    const d = weekdayDemand(orders);
    expect(d).toHaveLength(7);
    expect(d.map(s => s.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('counts orders on the correct day, excluding cancelled', () => {
    const d = weekdayDemand(orders);
    expect(d[5].totalOrders).toBe(2);   // Fri: 2 valid
    expect(d[6].totalOrders).toBe(1);   // Sat: 1
    expect(d[0].totalOrders).toBe(0);   // Sun: 0
  });

  it('breaks down lumpia vs pancit per day', () => {
    const d = weekdayDemand(orders);
    expect(d[5].lumpiaOrders).toBe(1);
    expect(d[5].pancitOrders).toBe(1);
    expect(d[6].lumpiaOrders).toBe(1);
    expect(d[6].pancitOrders).toBe(1);
  });

  it('falls back to created_at when needed_date is absent', () => {
    const o = order({ needed_date: undefined, created_at: '2026-05-29T10:00:00Z', lumpia: { enabled: true } });
    const d = weekdayDemand([o]);
    expect(d[5].totalOrders).toBe(1); // Fri
  });
});

describe('halfBatchInsight', () => {
  it('returns zeros and no recommendation for an empty order list', () => {
    const r = halfBatchInsight([]);
    expect(r.totalLumpiaOrders).toBe(0);
    expect(r.halvesRatio).toBe(0);
    expect(r.recommend).toBe(false);
  });

  it('ignores cancelled and non-lumpia orders', () => {
    const orders: Order[] = [
      order({ order_status: 'Cancelled', lumpia: { enabled: true, halves: 2 } }),
      order({ pancit: { enabled: true, full: 1 } }),
    ];
    expect(halfBatchInsight(orders).totalLumpiaOrders).toBe(0);
  });

  it('computes ratio and totals correctly', () => {
    const orders: Order[] = [
      order({ lumpia: { enabled: true, halves: 2 } }),  // has halves
      order({ lumpia: { enabled: true, sets: 1 } }),    // no halves
      order({ lumpia: { enabled: true, halves: 4 } }),  // has halves
      order({ lumpia: { enabled: true, sets: 2 } }),    // no halves
    ];
    const r = halfBatchInsight(orders);
    expect(r.totalLumpiaOrders).toBe(4);
    expect(r.halvesOrderCount).toBe(2);
    expect(r.halvesRatio).toBeCloseTo(0.5);
    expect(r.totalHalvesSold).toBe(6);
    expect(r.avgHalvesPerOrder).toBeCloseTo(3);
  });

  it('recommends when ratio >= 20% and totalLumpiaOrders >= 5', () => {
    const orders: Order[] = Array.from({ length: 5 }, (_, i) =>
      order({ lumpia: { enabled: true, halves: i < 2 ? 1 : undefined } })
    ); // 2/5 = 40%
    expect(halfBatchInsight(orders).recommend).toBe(true);
  });

  it('does not recommend below the 5-order threshold even at high ratio', () => {
    const orders: Order[] = [
      order({ lumpia: { enabled: true, halves: 1 } }),
      order({ lumpia: { enabled: true, halves: 1 } }),
    ]; // 100% ratio, but only 2 orders
    expect(halfBatchInsight(orders).recommend).toBe(false);
  });

  it('does not recommend when ratio is below 20%', () => {
    const orders: Order[] = Array.from({ length: 10 }, (_, i) =>
      order({ lumpia: { enabled: true, halves: i === 0 ? 1 : undefined } })
    ); // 1/10 = 10%
    expect(halfBatchInsight(orders).recommend).toBe(false);
  });
});

describe('linkOrderStats', () => {
  it('counts a month\'s link orders vs total, with the share %', () => {
    const orders = [
      order({ needed_date: '2026-05-03', source: 'request' }),
      order({ needed_date: '2026-05-09', source: 'request' }),
      order({ needed_date: '2026-05-20', source: 'manual' }),
      order({ needed_date: '2026-05-28' }),                      // no source → not from link
      order({ needed_date: '2026-04-30', source: 'request' }),   // other month
    ];
    const s = linkOrderStats(orders, '2026-05');
    expect(s.fromLink).toBe(2);
    expect(s.total).toBe(4);
    expect(s.pct).toBe(50);
    expect(s.allTimeFromLink).toBe(3); // includes the April link order
  });

  it('excludes cancelled orders from both counts', () => {
    const orders = [
      order({ needed_date: '2026-05-03', source: 'request' }),
      order({ needed_date: '2026-05-04', source: 'request', order_status: 'Cancelled' }),
      order({ needed_date: '2026-05-05', source: 'manual' }),
    ];
    const s = linkOrderStats(orders, '2026-05');
    expect(s.fromLink).toBe(1);
    expect(s.total).toBe(2);
    expect(s.allTimeFromLink).toBe(1);
  });

  it('is 0% when the month has no orders', () => {
    expect(linkOrderStats([], '2026-05')).toEqual({ fromLink: 0, total: 0, pct: 0, allTimeFromLink: 0 });
  });
});
