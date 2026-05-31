import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderDetailsModal from './OrderDetailsModal';
import type { Order, Stock } from '../types';

const stock: Stock = {
  lumpia_sets: 99, wrapper_packs: 99, pancit_full: 99, pancit_half: 99, pancit_large: 99,
  pork_frozen: 99, pork_thawed: 99, noodle_packs: 99, carrots_status: 'plenty', celery_status: 'plenty',
};

const order = (over: Partial<Order> = {}): Order => ({
  id: 1,
  customer_name: 'Hermi',
  pancit: { enabled: true, full: 1, half: 0, large: 0, extraMeat: false },
  delivery_type: 'pickup',
  needed_date: '2026-06-03',
  pickup_time: '17:00',
  order_status: 'Pending',
  payment_status: 'Unpaid',
  total: 42.5,
  ...over,
});

function renderModal(o: Order, props: Partial<Parameters<typeof OrderDetailsModal>[0]> = {}) {
  const onPaymentChange = vi.fn();
  render(
    <OrderDetailsModal
      order={o} stock={stock} allOrders={[o]} isOpen
      onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
      onStatusChange={vi.fn()} onPaymentChange={onPaymentChange}
      {...props}
    />,
  );
  return { onPaymentChange };
}

describe('OrderDetailsModal — render gating', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <OrderDetailsModal
        order={order()} stock={stock} allOrders={[]} isOpen={false}
        onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
        onStatusChange={vi.fn()} onPaymentChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('OrderDetailsModal — payment subtitle', () => {
  it('Unpaid shows the balance due', () => {
    renderModal(order({ payment_status: 'Unpaid' }));
    expect(screen.getByText('Balance Due: $42.50')).toBeInTheDocument();
  });

  it('Deposit with a balance shows deposit + remaining', () => {
    renderModal(order({ payment_status: 'Deposit', total: 60, deposit_amount: 30 }));
    expect(screen.getByText('Deposit: $30.00 · Bal: $30.00')).toBeInTheDocument();
  });

  it('overpaid deposit reads as paid with a tip, not a negative balance', () => {
    renderModal(order({ payment_status: 'Deposit', total: 42.5, deposit_amount: 43 }));
    expect(screen.getByText('Paid: $43.00 · +$0.50 tip ✓')).toBeInTheDocument();
    expect(screen.queryByText(/-\$/)).not.toBeInTheDocument();
  });

  it('Prepaid shows fully paid', () => {
    renderModal(order({ payment_status: 'Prepaid' }));
    expect(screen.getByText('✓ Fully Paid')).toBeInTheDocument();
  });
});

describe('OrderDetailsModal — early-order badge', () => {
  it('flags a pickup before 11am', () => {
    renderModal(order({ delivery_type: 'pickup', pickup_time: '09:00' }));
    expect(screen.getByText('⏰ Early Order')).toBeInTheDocument();
    expect(screen.getByText(/Pickup before 11am/)).toBeInTheDocument();
  });

  it('flags a delivery before noon', () => {
    renderModal(order({ delivery_type: 'city', pickup_time: '11:30', address: '1 Main' }));
    expect(screen.getByText(/Delivery before noon/)).toBeInTheDocument();
  });

  it('no early badge for an afternoon pickup', () => {
    renderModal(order({ delivery_type: 'pickup', pickup_time: '17:00' }));
    expect(screen.queryByText('⏰ Early Order')).not.toBeInTheDocument();
  });
});

describe('OrderDetailsModal — payment controls', () => {
  it('switching to Deposit calls onPaymentChange', () => {
    const { onPaymentChange } = renderModal(order({ payment_status: 'Unpaid' }));
    fireEvent.click(screen.getByText('Deposit'));
    expect(onPaymentChange).toHaveBeenCalledWith(1, expect.objectContaining({ payment_status: 'Deposit' }));
  });

  it('tapping Paid records the surplus as a tip when chosen', () => {
    const { onPaymentChange } = renderModal(order({ payment_status: 'Prepaid', total: 42.5 }));
    const amount = screen.getByRole('spinbutton'); // the only number input in the Paid view
    fireEvent.change(amount, { target: { value: '50' } });
    expect(screen.getByText(/\+\$7\.50 over/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tip'));
    expect(onPaymentChange).toHaveBeenCalledWith(1, expect.objectContaining({ payment_status: 'Prepaid', tip_amount: 7.5 }));
  });

  it('choosing Change given records no tip', () => {
    const { onPaymentChange } = renderModal(order({ payment_status: 'Prepaid', total: 42.5 }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Change given'));
    expect(onPaymentChange).toHaveBeenCalledWith(1, expect.objectContaining({ payment_status: 'Prepaid', tip_amount: 0 }));
  });
});
