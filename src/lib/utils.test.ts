import { describe, it, expect } from 'vitest';
import {
  isEarlyFulfillment,
  earlyFeeApplies,
  amountOwing,
  calcTotal,
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

describe('orderSummary — early fee line', () => {
  it('lists the early fee when it applies', () => {
    expect(orderSummary(base({ pickup_time: '09:00' }))).toContain('Early order fee');
  });
  it('omits the line when waived', () => {
    expect(orderSummary(base({ pickup_time: '09:00', early_fee_waived: true }))).not.toContain('Early order fee');
  });
});
