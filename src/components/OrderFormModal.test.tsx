import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
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

// ── Cooked and uncooked in one order (2026-10-04) ─────────────────────────────
// Aaron: "like one 50 pieces lumpia cooked, and another 50 pieces uncooked". Each size now has a cooked
// count and an uncooked count (Option A, his pick from the mock).
describe('OrderFormModal — lumpia cooked and uncooked counts', () => {
  const open = (o: Order) =>
    render(<OrderFormModal isOpen onClose={vi.fn()} onSave={vi.fn()} editOrder={o} allOrders={[o]} stock={stock} />);
  const count = (label: string) => screen.getByLabelText(label).textContent;

  it('⭐ an order saved before the change opens with its counts intact', async () => {
    open(editOrder); // sets: 1, setsCooked: true
    await screen.findByText('Sweet & Sour');
    expect(count('Cooked full batches')).toBe('1');
    expect(count('Uncooked full batches')).toBe('0');
    expect(count('Cooked half batches')).toBe('0');
  });

  it('⭐ a mixed order shows one cooked half and one uncooked half', async () => {
    open({ ...editOrder, lumpia: { enabled: true, sets: 0, halves: 2, halvesUncooked: 1, sauces: [] } });
    await screen.findByText('Sweet & Sour');
    expect(count('Cooked half batches')).toBe('1');
    expect(count('Uncooked half batches')).toBe('1');
  });

  it('the steppers move one count without touching the other', async () => {
    open(editOrder);
    await screen.findByText('Sweet & Sour');
    fireEvent.click(screen.getByRole('button', { name: 'More uncooked half batches' }));
    expect(count('Uncooked half batches')).toBe('1');
    expect(count('Cooked half batches')).toBe('0');
    expect(count('Cooked full batches')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Fewer cooked full batches' }));
    expect(count('Cooked full batches')).toBe('0');
    // Nothing goes below zero: the minus is disabled at 0.
    expect(screen.getByRole('button', { name: 'Fewer cooked full batches' })).toBeDisabled();
  });
});

// ── Delivery-slot load note ───────────────────────────────────────────────────
// Reproduces the Saturday that prompted this: three city deliveries all asking
// for 5pm on 2026-08-22. Reported to whoever is taking the order, never blocking.
const sat = (id: number, name: string, time: string, type: Order['delivery_type'] = 'city'): Order => ({
  id, customer_name: name, needed_date: '2026-08-22', pickup_time: time,
  delivery_type: type, payment_status: 'Unpaid', total: 40,
});

describe('OrderFormModal — delivery slot load', () => {
  const open = (editOrder: Order, allOrders: Order[]) =>
    render(
      <OrderFormModal
        isOpen onClose={vi.fn()} onSave={vi.fn()} editOrder={editOrder}
        allOrders={allOrders} stock={stock}
      />,
    );

  it('names the deliveries already booked near this time, and offers clear ones', async () => {
    const billie = sat(3, 'Billie', '17:00');
    open(billie, [sat(1, 'Keira', '17:00'), sat(2, 'Zoey', '17:00'), billie]);

    expect(await screen.findByText(/2 deliveries already near this time/)).toBeInTheDocument();
    expect(screen.getByText(/Keira 5:00 PM, Zoey 5:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/Clear: 4:00 PM or 6:00 PM/)).toBeInTheDocument();
  });

  it('never counts the order being edited against itself', async () => {
    const zoey = sat(2, 'Zoey', '17:00');
    open(zoey, [sat(1, 'Keira', '17:00'), zoey]);
    // One neighbour, not two — Zoey must not see herself.
    expect(await screen.findByText(/1 delivery already near this time/)).toBeInTheDocument();
  });

  it('stays silent when this order is a pickup — no driver is needed', async () => {
    const walkIn = sat(3, 'Billie', '17:00', 'pickup');
    open(walkIn, [sat(1, 'Keira', '17:00'), sat(2, 'Zoey', '17:00'), walkIn]);
    await screen.findByLabelText(/Pickup Time/i);
    expect(screen.queryByText(/already near this time/)).not.toBeInTheDocument();
  });

  it('stays silent when the slot is genuinely free', async () => {
    const solo = sat(1, 'Keira', '17:00');
    open(solo, [solo, sat(2, 'Zoey', '12:00')]);
    await screen.findByLabelText(/Delivery Time/i);
    expect(screen.queryByText(/already near this time/)).not.toBeInTheDocument();
  });
});

// ── The Menu block (2026-11-16, docs/ticket-orders-menu-items.md) ─────────────
describe('OrderFormModal — menu items', () => {
  const flan = { id: 'f', name: 'Leche Flan', price: 13, photo_path: null, active: true, on_request_page: true, sort: 0 };
  const kitchenOnly = { id: 'k', name: 'Embutido', price: 20, photo_path: null, active: true, on_request_page: false, sort: 1 };
  const retired = { id: 'r', name: 'Turon', price: 8, photo_path: null, active: false, on_request_page: false, sort: 2 };
  const plain: Order = { id: 9, customer_name: 'Tita Cora', delivery_type: 'pickup', needed_date: '2026-06-20', payment_status: 'Unpaid', custom_items: [] };
  const open = (o: Order, onSave = vi.fn()) =>
    render(<OrderFormModal isOpen onClose={vi.fn()} onSave={onSave} editOrder={o} allOrders={[o]} stock={stock} menuItems={[flan, kitchenOnly, retired]} />);

  it('offers every item on the menu, ticked for the customer page or not, and none taken off it', async () => {
    open(plain);
    expect(await screen.findByText('Leche Flan')).toBeInTheDocument();
    expect(screen.getByText('Embutido')).toBeInTheDocument();
    expect(screen.queryByText('Turon')).not.toBeInTheDocument();
  });

  it('saves the line with its qty and menu id, and the total counts it', async () => {
    const onSave = vi.fn();
    open(plain, onSave);
    const row = (await screen.findByText('Leche Flan')).closest('div.flex')!;
    fireEvent.click(within(row as HTMLElement).getAllByRole('button')[0]); // tick → 1
    fireEvent.click(within(row as HTMLElement).getByText('+'));            // → 2
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    const saved = onSave.mock.calls[0][0] as Order;
    expect(saved.custom_items).toEqual([{ name: 'Leche Flan', price: 13, qty: 2, menu_item_id: 'f' }]);
    expect(saved.total).toBe(26);
  });

  it('an order holding an item since taken off the menu still shows it, at the price it was placed at', async () => {
    open({ ...plain, custom_items: [{ name: 'Turon', price: 7, qty: 3, menu_item_id: 'r' }] });
    const row = (await screen.findByText('Turon')).closest('div.flex')!;
    expect(row).toHaveTextContent('$7.00');
    expect(within(row as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('a menu line never shows as a typed one-off', async () => {
    open({ ...plain, custom_items: [{ name: 'Leche Flan', price: 13, qty: 1, menu_item_id: 'f' }, { name: 'Kare-kare', price: 45 }] });
    await screen.findByText('Leche Flan');
    const names = screen.getAllByPlaceholderText('Dish name') as HTMLInputElement[];
    expect(names.map(n => n.value)).toEqual(['Kare-kare']);
  });
});

// ── Repeat last order brings menu items (2026-11-16) ──────────────────────────
describe('OrderFormModal — repeat last order with menu items', () => {
  const flanNow = { id: 'f', name: 'Leche Flan', price: 13, photo_path: null, active: true, on_request_page: true, sort: 0 };
  const turonOff = { id: 'r', name: 'Turon', price: 8, photo_path: null, active: false, on_request_page: false, sort: 1 };
  const last: Order = {
    id: 3, customer_name: 'Tita Cora', delivery_type: 'pickup', needed_date: '2026-05-01', payment_status: 'Unpaid',
    created_at: '2026-05-01T10:00:00',
    custom_items: [
      { name: 'Leche Flan', price: 12, qty: 2, menu_item_id: 'f' },  // placed at an older price
      { name: 'Turon', price: 8, qty: 1, menu_item_id: 'r' },        // since taken off the menu
      { name: 'Kare-kare', price: 45 },                              // a typed one-off
    ],
  };

  it('brings the menu items still on the menu, at today\'s price, and leaves the rest', async () => {
    const onSave = vi.fn();
    render(<OrderFormModal isOpen onClose={vi.fn()} onSave={onSave} allOrders={[last]} stock={stock} menuItems={[flanNow, turonOff]} initialDate="2026-12-01" />);
    fireEvent.change(await screen.findByLabelText(/customer name/i), { target: { value: 'Tita Cora' } });
    fireEvent.click(await screen.findByRole('button', { name: /repeat last order/i }));
    fireEvent.click(screen.getByRole('button', { name: /add order/i }));
    const saved = onSave.mock.calls[0][0] as Order;
    expect(saved.custom_items).toEqual([{ name: 'Leche Flan', price: 13, qty: 2, menu_item_id: 'f' }]);
  });
});
