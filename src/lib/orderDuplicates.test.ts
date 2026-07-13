import { describe, it, expect } from 'vitest';
import { findDuplicateOrder } from './orderDuplicates';
import type { Order } from '../types';

const orders: Order[] = [
  { id: 'a', customer_name: 'Fefe Huang', needed_date: '2026-07-17', source: 'request' },
  { id: 'b', customer_name: 'Rod', needed_date: '2026-07-10', source: 'manual' },
];

describe('findDuplicateOrder', () => {
  it('flags an order with the same customer + same needed_date', () => {
    // The reported case: request-link order (id 'a') approved, then re-typed by hand.
    expect(findDuplicateOrder(orders, { customer_name: 'Fefe Huang', needed_date: '2026-07-17' })?.id).toBe('a');
  });

  it('matches case- and whitespace-insensitively', () => {
    expect(findDuplicateOrder(orders, { customer_name: '  fefe   HUANG ', needed_date: '2026-07-17' })?.id).toBe('a');
  });

  it('does NOT flag the same customer on a different date (repeat customers are fine)', () => {
    expect(findDuplicateOrder(orders, { customer_name: 'Fefe Huang', needed_date: '2026-07-24' })).toBeNull();
  });

  it('does NOT flag a different customer on the same date', () => {
    expect(findDuplicateOrder(orders, { customer_name: 'Someone Else', needed_date: '2026-07-17' })).toBeNull();
  });

  it('excludes the candidate itself by id — editing an order never self-flags', () => {
    expect(findDuplicateOrder(orders, { id: 'a', customer_name: 'Fefe Huang', needed_date: '2026-07-17' })).toBeNull();
  });

  it('returns null when the name or date is missing', () => {
    expect(findDuplicateOrder(orders, { customer_name: '', needed_date: '2026-07-17' })).toBeNull();
    expect(findDuplicateOrder(orders, { customer_name: 'Fefe Huang' })).toBeNull();
  });
});
