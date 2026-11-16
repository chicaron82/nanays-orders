import { describe, it, expect } from 'vitest';
import { lineQty, lineTotal, menuLine, menuQty, setMenuQty, kitchenMenu, requestPageMenu, priceRequest } from '../../src/lib/menu';
import type { CustomItem, MenuItem } from '../../src/types';

const flan: MenuItem = { id: 'f', name: 'Leche Flan', price: 13, photo_path: null, active: true, on_request_page: true, sort: 0 };
const embutido: MenuItem = { id: 'e', name: 'Embutido', price: 20, photo_path: null, active: true, on_request_page: false, sort: 1 };
const retired: MenuItem = { id: 'r', name: 'Turon', price: 8, photo_path: null, active: false, on_request_page: true, sort: 2 };
const oneOff: CustomItem = { name: 'Kare-kare', price: 45 };

describe('lineQty / lineTotal', () => {
  it('a row saved before qty existed is one', () => {
    expect(lineQty({})).toBe(1);
    expect(lineTotal({ price: 40 })).toBe(40);
  });
  it('multiplies price by qty', () => {
    expect(lineTotal({ price: 13, qty: 3 })).toBe(39);
  });
  it('a nonsense qty reads as one, never zero or negative', () => {
    expect(lineQty({ qty: 0 })).toBe(1);
    expect(lineQty({ qty: -2 })).toBe(1);
  });
});

describe('setMenuQty', () => {
  it('adds a copy of the item, with its id', () => {
    expect(setMenuQty([], flan, 2)).toEqual([{ name: 'Leche Flan', price: 13, qty: 2, menu_item_id: 'f' }]);
  });
  it('changes the count of a line already there, keeping its copied price', () => {
    const placed = [menuLine({ ...flan, price: 12 }, 1)];
    expect(setMenuQty(placed, flan, 3)).toEqual([{ name: 'Leche Flan', price: 12, qty: 3, menu_item_id: 'f' }]);
  });
  it('0 removes the line and leaves one-offs alone', () => {
    expect(setMenuQty([oneOff, menuLine(flan, 2)], flan, 0)).toEqual([oneOff]);
  });
  it('0 on an item not there changes nothing', () => {
    expect(setMenuQty([oneOff], flan, 0)).toEqual([oneOff]);
  });
  it('menuQty reads it back', () => {
    const lines = setMenuQty([oneOff], flan, 4);
    expect(menuQty(lines, 'f')).toBe(4);
    expect(menuQty(lines, 'e')).toBe(0);
  });
});

describe('which form offers what', () => {
  it('the kitchen form offers every item on the menu, ticked or not', () => {
    expect(kitchenMenu([embutido, retired, flan]).map(m => m.id)).toEqual(['f', 'e']);
  });
  it('the customer page offers only the ticked ones still on the menu', () => {
    expect(requestPageMenu([embutido, retired, flan]).map(m => m.id)).toEqual(['f']);
  });
});

describe('priceRequest', () => {
  it('a request that agrees with the menu comes back unchanged', () => {
    const req = { custom_items: [menuLine(flan, 2)], total: 26 };
    const out = priceRequest(req, [flan]);
    expect(out.changes).toEqual([]);
    expect(out.request).toBe(req);
  });
  it('re-prices a line from the menu and moves the total by the difference only', () => {
    // 2 flans at a tampered $1 on a $50 request (the other $48 is pancit, fees, whatever the customer was quoted)
    const req = { custom_items: [{ ...menuLine(flan, 2), price: 1 }], total: 50 };
    const out = priceRequest(req, [flan]);
    expect(out.changes).toEqual([{ name: 'Leche Flan', was: 1, now: 13 }]);
    expect(out.request.custom_items![0].price).toBe(13);
    expect(out.request.total).toBe(74);
  });
  it('a price raised since the request is reported too', () => {
    const out = priceRequest({ custom_items: [menuLine(flan, 1)], total: 13 }, [{ ...flan, price: 15 }]);
    expect(out.changes).toEqual([{ name: 'Leche Flan', was: 13, now: 15 }]);
    expect(out.request.total).toBe(15);
  });
  it('leaves one-offs and lines whose item is gone alone', () => {
    const gone = { name: 'Puto', price: 10, qty: 1, menu_item_id: 'gone' };
    const req = { custom_items: [oneOff, gone], total: 55 };
    expect(priceRequest(req, [flan]).changes).toEqual([]);
  });
});
