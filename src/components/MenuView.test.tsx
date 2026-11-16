import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MenuView from './MenuView';
import type { MenuItem } from '../types';

// The Menu tab (2026-11-16, docs/ticket-orders-menu-items.md). Aaron: "a check box if she wants it to appear on the
// customer request page" — so a new item starts kitchen-only, and taking one off asks first.

const flan: MenuItem = { id: 'f', name: 'Leche Flan', price: 13, photo_path: null, active: true, on_request_page: true, sort: 0 };
const turon: MenuItem = { id: 't', name: 'Turon', price: 8, photo_path: null, active: false, on_request_page: false, sort: 1 };

function show(menu: MenuItem[] = [flan, turon]) {
  const onAdd = vi.fn(async () => flan);
  const onUpdate = vi.fn(async () => true);
  render(<MenuView menu={menu} loaded onAdd={onAdd} onUpdate={onUpdate} />);
  return { onAdd, onUpdate };
}

describe('MenuView', () => {
  it('lists what is on the menu and says where each one shows', () => {
    show();
    expect(screen.getByText('Leche Flan')).toBeInTheDocument();
    expect(screen.getByText('Customer page')).toBeInTheDocument();
    // Turon is off the menu: folded away until asked for.
    expect(screen.queryByText('Turon')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Off the menu \(1\)/));
    expect(screen.getByText('Turon')).toBeInTheDocument();
  });

  it('a new item starts kitchen-only: the customer-page box is unticked', async () => {
    const { onAdd } = show();
    fireEvent.click(screen.getByRole('button', { name: /add an item/i }));
    expect(screen.getByRole('button', { name: /show on the customer page/i })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.change(screen.getByPlaceholderText('Dish name'), { target: { value: '  Embutido ' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ name: 'Embutido', price: 20, on_request_page: false }));
  });

  it('will not save an item without a name or a price', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /add an item/i }));
    fireEvent.change(screen.getByPlaceholderText('Dish name'), { target: { value: 'Embutido' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('taking an item off the menu asks first', async () => {
    const { onUpdate } = show();
    fireEvent.click(screen.getByText('Leche Flan'));
    fireEvent.click(screen.getByRole('button', { name: 'Take off the menu' }));
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /yes, take it off the menu/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('f', { active: false }));
  });

  it('an item off the menu can be put back', () => {
    const { onUpdate } = show();
    fireEvent.click(screen.getByText(/Off the menu/));
    fireEvent.click(screen.getByRole('button', { name: 'Put back on the menu' }));
    expect(onUpdate).toHaveBeenCalledWith('t', { active: true });
  });
});
