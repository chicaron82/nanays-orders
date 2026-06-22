import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderDetailsModal from './OrderDetailsModal';
import type { Order } from '../types';

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
      order={o} isOpen
      onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
      onPaymentChange={onPaymentChange}
      {...props}
    />,
  );
  return { onPaymentChange };
}

describe('OrderDetailsModal — render gating', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <OrderDetailsModal
        order={order()} isOpen={false}
        onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
        onPaymentChange={vi.fn()}
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

  it('Deposit with a balance shows remaining as hero and total + received in subtitle', () => {
    renderModal(order({ payment_status: 'Deposit', total: 60, deposit_amount: 30 }));
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('$30.00', { selector: '.font-playfair' })).toBeInTheDocument();
    expect(screen.getByText('$60.00 total · $30.00 received')).toBeInTheDocument();
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
    expect(screen.getByText(/Before 11am/)).toBeInTheDocument();
  });

  it('flags a delivery before 11am', () => {
    renderModal(order({ delivery_type: 'city', pickup_time: '09:00', address: '1 Main' }));
    expect(screen.getByText(/Before 11am/)).toBeInTheDocument();
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

describe('OrderDetailsModal — ready-message share', () => {
  it('shows the ready-message bell next to the share button', () => {
    renderModal(order());
    expect(screen.getByLabelText('Share ready message')).toBeInTheDocument();
    expect(screen.getByLabelText('Share order')).toBeInTheDocument();
  });

  it('hides the bell for a cancelled order', () => {
    renderModal(order({ order_status: 'Cancelled' }));
    expect(screen.queryByLabelText('Share ready message')).not.toBeInTheDocument();
  });
});

describe('OrderDetailsModal — discount line', () => {
  it('shows the discount and its label on the total card', () => {
    renderModal(order({ discount_type: 'flat', discount_value: 10, discount_label: 'Moved date 🙏' }));
    expect(screen.getByText(/−\$10\.00 · Moved date 🙏/)).toBeInTheDocument();
  });

  it('no discount → no line', () => {
    renderModal(order());
    expect(screen.queryByText(/🏷️/)).not.toBeInTheDocument();
  });

  it('a cancelled order hides the discount line', () => {
    renderModal(order({ order_status: 'Cancelled', discount_type: 'flat', discount_value: 10 }));
    expect(screen.queryByText(/−\$10\.00/)).not.toBeInTheDocument();
  });
});

describe('OrderDetailsModal — cancelled in the payment row', () => {
  it('there is no separate status section', () => {
    renderModal(order());
    expect(screen.queryByText('Update Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Fulfilled')).not.toBeInTheDocument();
  });

  it('tapping Cancelled cancels the order without touching payment', () => {
    const { onPaymentChange } = renderModal(order());
    fireEvent.click(screen.getByText('Cancelled'));
    expect(onPaymentChange).toHaveBeenCalledWith(1, { order_status: 'Cancelled', no_show: false, no_show_reason: undefined });
  });

  it('a cancelled order shows ✗ Cancelled, not a balance due', () => {
    renderModal(order({ order_status: 'Cancelled' }));
    expect(screen.getByText('✗ Cancelled')).toBeInTheDocument();
    expect(screen.queryByText(/Balance Due/)).not.toBeInTheDocument();
  });

  it('picking a payment state un-cancels the order', () => {
    const { onPaymentChange } = renderModal(order({ order_status: 'Cancelled' }));
    fireEvent.click(screen.getByText('Unpaid'));
    expect(onPaymentChange).toHaveBeenCalledWith(1, expect.objectContaining({ payment_status: 'Unpaid', order_status: 'Pending' }));
  });
});
