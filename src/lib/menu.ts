// The menu sis manages herself (migration 021), pure. Aaron, 2026-11-16: *"what if we turned it into a general add menu
// item instead this way she can add and edit items on her own without going through us"*. Ticket:
// docs/ticket-orders-menu-items.md.
//
// • An order holds a COPY of a menu item ({ name, price, qty, menu_item_id }) in its custom_items, taken when it was
//   added. Re-pricing the menu never reaches back into an order, so past totals and revenue stay as they were.
// • Typed one-offs (no menu_item_id) share the same list and are never touched here.
// • The customer's browser prices a request. priceRequest re-prices its menu lines from the menu before approval and
//   moves the total by the difference only, so nothing else the customer was quoted (fees, lumpia, pancit) shifts.
import type { CustomItem, MenuItem, OrderRequest } from '../types';

/** How many of this line: rows saved before qty existed mean 1. */
export function lineQty(c: Pick<CustomItem, 'qty'>): number {
  const q = Number(c.qty);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
}

/** The line's money: price × qty. */
export function lineTotal(c: Pick<CustomItem, 'price' | 'qty'>): number {
  return (Number(c.price) || 0) * lineQty(c);
}

/** The copy an order keeps of a menu item. */
export function menuLine(item: Pick<MenuItem, 'id' | 'name' | 'price'>, qty: number): CustomItem {
  return { name: item.name, price: Number(item.price), qty, menu_item_id: item.id };
}

/** How many of a menu item a list already holds (0 when none). */
export function menuQty(lines: readonly CustomItem[] | undefined, itemId: string): number {
  const line = (lines || []).find(c => c.menu_item_id === itemId);
  return line ? lineQty(line) : 0;
}

/**
 * Set how many of a menu item a list holds: 0 removes its line, a new item is appended, and an existing line keeps its
 * copied name and price (an order being edited after a re-price stays at the price it was placed at).
 */
export function setMenuQty(lines: readonly CustomItem[] | undefined, item: Pick<MenuItem, 'id' | 'name' | 'price'>, qty: number): CustomItem[] {
  const list = [...(lines || [])];
  const i = list.findIndex(c => c.menu_item_id === item.id);
  if (qty <= 0) return i < 0 ? list : list.filter((_, idx) => idx !== i);
  if (i < 0) return [...list, menuLine(item, qty)];
  list[i] = { ...list[i], qty };
  return list;
}

/** Menu items the kitchen form offers, in her order. */
export function kitchenMenu(menu: readonly MenuItem[]): MenuItem[] {
  return menu.filter(m => m.active).sort(byMenuOrder);
}

/** Menu items the customer page offers: on the menu AND ticked for the customer page. */
export function requestPageMenu(menu: readonly MenuItem[]): MenuItem[] {
  return menu.filter(m => m.active && m.on_request_page).sort(byMenuOrder);
}

function byMenuOrder(a: MenuItem, b: MenuItem): number {
  return a.sort - b.sort || a.name.localeCompare(b.name);
}

export interface PriceChange {
  name: string;
  /** Per piece, as the request had it. */
  was: number;
  /** Per piece, as the menu has it now. */
  now: number;
}

/**
 * A request with its menu lines re-priced from the menu, and the changes it made (empty when it already agreed).
 * A line whose item is gone from the table keeps its price: there is nothing to check it against, and she sees the
 * request before approving. Typed one-offs are left alone.
 */
export function priceRequest<R extends Pick<OrderRequest, 'custom_items' | 'total'>>(req: R, menu: readonly MenuItem[]): { request: R; changes: PriceChange[] } {
  const byId = new Map(menu.map(m => [m.id, m]));
  const changes: PriceChange[] = [];
  let delta = 0;
  const lines = (req.custom_items || []).map(c => {
    const item = c.menu_item_id ? byId.get(c.menu_item_id) : undefined;
    if (!item) return c;
    const now = Number(item.price);
    const was = Number(c.price) || 0;
    if (now === was) return c;
    changes.push({ name: c.name, was, now });
    delta += (now - was) * lineQty(c);
    return { ...c, price: now };
  });
  if (!changes.length) return { request: req, changes };
  return { request: { ...req, custom_items: lines, total: Math.round((req.total + delta) * 100) / 100 }, changes };
}
