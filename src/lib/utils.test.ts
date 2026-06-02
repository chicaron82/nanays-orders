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
  EARLY_ORDER_FEE,
  RUSH_ORDER_FEE,
  DELIVERY_FEE,
} from './utils';
import type { Order } from '../types';

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

  describe('delivery — cutoff noon (covers prep + travel lead time)', () => {
    it('flags a delivery that is fine for a pickup (11:00–11:59)', () => {
      expect(isEarlyFulfillment(base({ delivery_type: 'city', pickup_time: '11:00' }))).toBe(true);
      expect(isEarlyFulfillment(base({ delivery_type: 'outside', pickup_time: '11:30' }))).toBe(true);
    });
    it('does not flag at or after noon', () => {
      expect(isEarlyFulfillment(base({ delivery_type: 'city', pickup_time: '12:00' }))).toBe(false);
      expect(isEarlyFulfillment(base({ delivery_type: 'outside', pickup_time: '13:00' }))).toBe(false);
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

  it('adds the fee for an 11:30 delivery but not an 11:30 pickup', () => {
    const delivery = calcTotal(base({ delivery_type: 'city', pickup_time: '11:30' }));
    const pickup   = calcTotal(base({ delivery_type: 'pickup', pickup_time: '11:30' }));
    expect(delivery).toBe(PANCIT_FULL + DELIVERY_FEE.city + EARLY_ORDER_FEE);
    expect(pickup).toBe(PANCIT_FULL);
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

describe('orderSummary — early fee line', () => {
  it('lists the early fee when it applies', () => {
    expect(orderSummary(base({ pickup_time: '09:00' }))).toContain('Early order fee');
  });
  it('omits the line when waived', () => {
    expect(orderSummary(base({ pickup_time: '09:00', early_fee_waived: true }))).not.toContain('Early order fee');
  });
});
