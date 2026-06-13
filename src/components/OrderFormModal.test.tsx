import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import OrderFormModal from './OrderFormModal';
import type { Order, Stock } from '../types';

// useOrderForm imports the supabase client (used on suggestion-select / submit,
// not on edit population). Mock it so the module doesn't throw on missing env.
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }), upsert: () => ({ then: () => {} }) }) },
}));

const stock: Stock = {
  lumpia_sets: 99, wrapper_packs: 99, pancit_full: 99, pancit_half: 99, pancit_large: 99,
  pork_frozen: 99, pork_thawed: 99, noodle_packs: 99, carrots_status: 'plenty', celery_status: 'plenty',
};

// An order mid-edit with multiple sauces — 2× Sweet & Sour, 1× Sweet Chili
// (the array carries quantity by repetition).
const editOrder: Order = {
  id: 1,
  customer_name: 'Tita Cora',
  lumpia: {
    enabled: true, sets: 1, setsCooked: true, halves: 0, halvesCooked: true,
    sauces: ['sweet_and_sour', 'sweet_and_sour', 'sweet_chili'],
  },
  delivery_type: 'pickup',
  needed_date: '2026-06-20',
  payment_status: 'Unpaid',
  total: 39,
};

describe('OrderFormModal — sauce stepper edit-mode pre-population', () => {
  it('shows each sauce qty from an edited order with existing sauces', async () => {
    render(
      <OrderFormModal
        isOpen onClose={vi.fn()} onSave={vi.fn()} editOrder={editOrder}
        allOrders={[editOrder]} stock={stock}
      />,
    );

    // Edit population runs in a setTimeout(0); the lumpia section (hence the
    // sauce row) only appears once form.lumpia.enabled is populated from editOrder.
    const sweetSour = (await screen.findByText('Sweet & Sour')).parentElement!;
    expect(within(sweetSour).getByText('2')).toBeInTheDocument();

    const sweetChili = screen.getByText('Sweet Chili').parentElement!;
    expect(within(sweetChili).getByText('1')).toBeInTheDocument();
  });

  it('a sauce never ordered shows no qty (no stepper count)', async () => {
    const oneSauce: Order = { ...editOrder, lumpia: { ...editOrder.lumpia!, sauces: ['sweet_chili'] } };
    render(
      <OrderFormModal
        isOpen onClose={vi.fn()} onSave={vi.fn()} editOrder={oneSauce}
        allOrders={[oneSauce]} stock={stock}
      />,
    );

    const sweetSour = (await screen.findByText('Sweet & Sour')).parentElement!;
    // qty 0 → no count span and no "−" control, only the "+" to add one.
    expect(within(sweetSour).queryByText('1')).not.toBeInTheDocument();
    expect(within(sweetSour).queryByText('−')).not.toBeInTheDocument();

    const sweetChili = screen.getByText('Sweet Chili').parentElement!;
    expect(within(sweetChili).getByText('1')).toBeInTheDocument();
  });
});
