import { describe, it, expect } from 'vitest';
import {
  isEarlyFulfillment,
  earlyFeeApplies,
  amountOwing,
  amountReceived,
  tipAmount,
  getRevenue,
  calcTotal,
  customItemsTotal,
  orderSummary,
  nextAvailableDate,
  requiresDeposit,
  depositFor,
  isAutoRush,
  lumpiaPieceCount,
  EARLY_ORDER_FEE,
  RUSH_ORDER_FEE,
  DELIVERY_FEE,
} from './utils';
import type { Order, LumpiaOrder } from '../types';

// A minimal order with one pancit so calcTotal has a non-fee base to add onto.
const base = (over: Partial<Order> = {}): Order => ({
  customer_name: 'Test',
  pancit: { enabled: true, full: 1, half: 0, large: 0, extraMeat: false },
  delivery_type: 'pickup',
  ...over,
});

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

// Fixed reference time for deposit / rush helpers that accept a `now` param.
const NOW = new Date('2026-06-17T12:00:00');

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
    const ymd = tomorrow.toISOString().slice(0, 10);
    // NOW is noon; the needed_date's midnight is 12h away
    expect(isAutoRush({ needed_date: ymd }, NOW)).toBe(true);
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
