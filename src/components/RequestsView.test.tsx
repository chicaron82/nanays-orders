import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RequestsView from './RequestsView';
import type { Order, OrderRequest } from '../types';

// ── Slot-load note on the request card ───────────────────────────────────────
// This lives here rather than only in OrderFormModal because approving a request
// does NOT open the form — App.handleApproveRequest writes the order straight
// through. Without this, the entire public-request path would land collisions
// silently, which is precisely the case the feature exists for.

const req = (p: Partial<OrderRequest> = {}): OrderRequest => ({
  id: 'r1',
  customer_name: 'Billie',
  contact: '204-555-0148',
  needed_date: '2026-08-22',
  pickup_time: '17:00',
  delivery_type: 'city',
  address: '1493 Erin Street',
  total: 40,
  ...p,
} as OrderRequest);

const order = (id: number, name: string, time: string, type: Order['delivery_type'] = 'city'): Order => ({
  id, customer_name: name, needed_date: '2026-08-22', pickup_time: time,
  delivery_type: type, payment_status: 'Unpaid', total: 40,
});

function show(request: OrderRequest, orders: Order[]) {
  return render(
    <RequestsView
      requests={[request]}
      orders={orders}
      blockedSet={new Set<string>()}
      onApprove={vi.fn()}
      onDecline={vi.fn()}
    />,
  );
}

describe('RequestsView — delivery slot load', () => {
  it('warns before approving when the slot is already taken', () => {
    show(req(), [order(1, 'Keira', '17:00'), order(2, 'Zoey', '17:00')]);

    expect(screen.getByText(/2 deliveries are already booked near 5:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/Keira 5:00 PM, Zoey 5:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM or 6:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/Worth a message before approving/)).toBeInTheDocument();
  });

  it('uses the singular for one existing delivery', () => {
    show(req(), [order(1, 'Keira', '17:00')]);
    expect(screen.getByText(/1 delivery is already booked near 5:00 PM/)).toBeInTheDocument();
  });

  it('counts a near miss — 16:45 competes with 17:00', () => {
    show(req(), [order(1, 'Keira', '16:45')]);
    expect(screen.getByText(/1 delivery is already booked/)).toBeInTheDocument();
  });

  it('stays silent when the request is a pickup', () => {
    show(req({ delivery_type: 'pickup' }), [order(1, 'Keira', '17:00'), order(2, 'Zoey', '17:00')]);
    expect(screen.queryByText(/already booked near/)).not.toBeInTheDocument();
  });

  it('never counts existing pickups against a delivery', () => {
    show(req(), [order(1, 'Keira', '17:00', 'pickup'), order(2, 'Zoey', '17:00', 'pickup')]);
    expect(screen.queryByText(/already booked near/)).not.toBeInTheDocument();
  });

  it('stays silent when the slot is genuinely free', () => {
    show(req(), [order(1, 'Keira', '12:00')]);
    expect(screen.queryByText(/already booked near/)).not.toBeInTheDocument();
  });

  it('ignores collisions on a different day', () => {
    show(req(), [{ ...order(1, 'Keira', '17:00'), needed_date: '2026-08-23' }]);
    expect(screen.queryByText(/already booked near/)).not.toBeInTheDocument();
  });
});
