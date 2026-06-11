import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderChip from './OrderChip';
import type { Order } from '../../types';

const order = (over: Partial<Order> = {}): Order => ({
  id: 1,
  customer_name: 'Rosa',
  pancit: { enabled: true, full: 1, half: 0, large: 0, extraMeat: false },
  delivery_type: 'pickup',
  needed_date: '2026-05-31',
  order_status: 'Pending',
  payment_status: 'Unpaid',
  total: 25,
  ...over,
});

describe('OrderChip', () => {
  it('renders the customer name and item summary', () => {
    render(<OrderChip order={order()} />);
    expect(screen.getByText('Rosa')).toBeInTheDocument();
    expect(screen.getByText(/Pancit: 1 Regular/)).toBeInTheDocument();
  });

  it('shows the remaining balance for a deposit order', () => {
    render(<OrderChip order={order({ payment_status: 'Deposit', total: 60, deposit_amount: 30 })} />);
    expect(screen.getByText('owes $30.00')).toBeInTheDocument();
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument();
  });

  it('shows an UNPAID badge for an unpaid, unfulfilled order', () => {
    render(<OrderChip order={order({ payment_status: 'Unpaid' })} />);
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });

  it('shows no owed/unpaid badge when paid', () => {
    render(<OrderChip order={order({ payment_status: 'Prepaid' })} />);
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument();
    expect(screen.queryByText(/owes/)).not.toBeInTheDocument();
  });

  it('does not flag a legacy fulfilled order as unpaid', () => {
    render(<OrderChip order={order({ payment_status: 'Unpaid', order_status: 'Fulfilled' })} />);
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument();
  });

  it('a paid order reads as done — name struck through', () => {
    render(<OrderChip order={order({ payment_status: 'Prepaid' })} />);
    expect(screen.getByText('Rosa').className).toContain('line-through');
  });

  it('an unpaid order is not struck through', () => {
    render(<OrderChip order={order({ payment_status: 'Unpaid' })} />);
    expect(screen.getByText('Rosa').className).not.toContain('line-through');
  });

  it('renders a Cancelled pill instead of the delivery badge', () => {
    render(<OrderChip order={order({ order_status: 'Cancelled' })} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('P')).not.toBeInTheDocument();
  });

  it('marks pickup with P and delivery with D', () => {
    const { unmount } = render(<OrderChip order={order({ delivery_type: 'pickup' })} />);
    expect(screen.getByText('P')).toBeInTheDocument();
    unmount();
    render(<OrderChip order={order({ delivery_type: 'city' })} />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('surfaces a notes indicator when the order has notes or preferences', () => {
    render(<OrderChip order={order({ preferences: 'Buzz #405' })} />);
    expect(screen.getByLabelText('Has notes')).toBeInTheDocument();
  });

  it('fires onClick when tapped', () => {
    const onClick = vi.fn();
    render(<OrderChip order={order()} onClick={onClick} />);
    fireEvent.click(screen.getByText('Rosa'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
