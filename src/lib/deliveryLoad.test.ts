import { describe, it, expect } from 'vitest';
import { deliveryLoadAt, formatTimeLabel } from './deliveryLoad';
import type { Order } from '../types';

/** Minimal order — only the fields the load check reads. */
function o(p: Partial<Order> & { id: string }): Order {
  return {
    customer_name: p.customer_name ?? 'Someone',
    needed_date: p.needed_date ?? '2026-08-22',
    pickup_time: p.pickup_time ?? '17:00',
    delivery_type: p.delivery_type ?? 'city',
    ...p,
  } as Order;
}

describe('deliveryLoadAt', () => {
  it('counts deliveries already booked at the same time', () => {
    // The real Saturday that prompted this: three city deliveries all asking for 5pm.
    const orders = [
      o({ id: '1', customer_name: 'Keira' }),
      o({ id: '2', customer_name: 'Zoey' }),
    ];
    const load = deliveryLoadAt(orders, '2026-08-22', '17:00');
    expect(load.count).toBe(2);
    expect(load.orders.map(x => x.customer_name)).toEqual(['Keira', 'Zoey']);
  });

  it('never counts a pickup — it needs no driver', () => {
    const orders = [
      o({ id: '1', delivery_type: 'pickup' }),
      o({ id: '2', delivery_type: 'pickup' }),
    ];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00').count).toBe(0);
  });

  it('counts outside-city deliveries alongside city ones', () => {
    const orders = [o({ id: '1', delivery_type: 'city' }), o({ id: '2', delivery_type: 'outside' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00').count).toBe(2);
  });

  it('catches a near miss — 16:45 and 17:00 compete for the same driver', () => {
    const orders = [o({ id: '1', pickup_time: '16:45' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00').count).toBe(1);
  });

  it('leaves genuinely separate times alone', () => {
    const orders = [o({ id: '1', pickup_time: '15:00' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00').count).toBe(0);
  });

  it('respects a custom window', () => {
    const orders = [o({ id: '1', pickup_time: '16:45' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00', { windowMinutes: 5 }).count).toBe(0);
  });

  it('ignores other days entirely', () => {
    const orders = [o({ id: '1', needed_date: '2026-08-23' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00').count).toBe(0);
  });

  it('does not flag the order being edited against itself', () => {
    const orders = [o({ id: 'me' }), o({ id: 'other' })];
    const load = deliveryLoadAt(orders, '2026-08-22', '17:00', { excludeId: 'me' });
    expect(load.count).toBe(1);
    expect(load.orders[0].id).toBe('other');
  });

  it('is quiet when the time or date is blank', () => {
    const orders = [o({ id: '1' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '').count).toBe(0);
    expect(deliveryLoadAt(orders, '', '17:00').count).toBe(0);
    expect(deliveryLoadAt(orders, '2026-08-22', null).count).toBe(0);
  });

  it('ignores orders whose own time is blank or malformed', () => {
    const orders = [o({ id: '1', pickup_time: '' }), o({ id: '2', pickup_time: '25:99' })];
    expect(deliveryLoadAt(orders, '2026-08-22', '17:00').count).toBe(0);
  });

  it('suggests the nearest clear slot on each side', () => {
    const orders = [o({ id: '1', pickup_time: '17:00' }), o({ id: '2', pickup_time: '17:00' })];
    const load = deliveryLoadAt(orders, '2026-08-22', '17:00');
    // 16:30 still sits within 30 min of the 17:00 pair, so the first clear step is 16:00.
    expect(load.earlier).toBe('16:00');
    expect(load.later).toBe('18:00');
  });

  it('steps past a busy neighbour to find a clear one', () => {
    const orders = [
      o({ id: '1', pickup_time: '17:00' }),
      o({ id: '2', pickup_time: '18:00' }),   // 18:00 is taken too
    ];
    const load = deliveryLoadAt(orders, '2026-08-22', '17:00');
    expect(load.later).toBe('19:00');
  });

  it('will not suggest a time outside the working day', () => {
    // Booked at 09:30 with the whole morning blocked — there is no earlier slot to offer.
    const orders = [
      o({ id: '1', pickup_time: '09:30' }),
      o({ id: '2', pickup_time: '09:00' }),
    ];
    const load = deliveryLoadAt(orders, '2026-08-22', '09:30');
    expect(load.earlier).toBeNull();
  });

  it('returns no suggestions when nothing clashes', () => {
    const load = deliveryLoadAt([], '2026-08-22', '17:00');
    expect(load).toEqual({ count: 0, orders: [], earlier: null, later: null });
  });
});

describe('formatTimeLabel', () => {
  it('reads the way someone would say it out loud', () => {
    expect(formatTimeLabel('17:00')).toBe('5:00 PM');
    expect(formatTimeLabel('09:30')).toBe('9:30 AM');
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
    expect(formatTimeLabel('00:15')).toBe('12:15 AM');
  });

  it('hands back anything it cannot parse', () => {
    expect(formatTimeLabel('later')).toBe('later');
  });
});
