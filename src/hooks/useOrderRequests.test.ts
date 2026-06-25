import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { OrderRequest } from '../types';

// The public form runs as the anon role: it may INSERT an order request but must
// NOT read order_requests back (other customers' names/contacts/addresses). So the
// submit must be a PLAIN insert — chaining .select() adds a RETURNING that, under
// RLS, needs a SELECT policy anon doesn't have, and every submission 401s. These
// spies let us assert the insert is plain and .select() is never chained onto it.
const insertSpy = vi.fn();
const selectAfterInsert = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) }, // public page: no session, no fetch/subscribe
    from: vi.fn(() => ({
      insert: (rows: unknown) => {
        insertSpy(rows);
        // Awaitable so `await insert(...)` resolves; .select() is the RETURNING the bug added.
        return {
          select: () => { selectAfterInsert(); return Promise.resolve({ data: [{ id: 'db-id' }], error: null }); },
          then: (onF: (v: { error: null }) => unknown, onR?: (e: unknown) => unknown) =>
            Promise.resolve({ error: null }).then(onF, onR),
        };
      },
    })),
    removeChannel: vi.fn(),
  },
}));

import { useOrderRequests } from './useOrderRequests';

const reqData = {
  customer_name: 'Maria',
  contact: '5551234',
  lumpia: {},
  pancit: {},
  custom_items: [],
  needed_date: '2026-07-01',
  pickup_time: '12:00',
  delivery_type: 'pickup',
  address: '',
  notes: '',
  rush_order: false,
  total: 50,
} as unknown as Omit<OrderRequest, 'status' | 'id' | 'created_at'>;

beforeEach(() => {
  insertSpy.mockClear();
  selectAfterInsert.mockClear();
});

describe('submitRequest — public anon insert', () => {
  it('does a PLAIN insert with no .select() (anon can write but not read back)', async () => {
    const { result } = renderHook(() => useOrderRequests());
    let returned: OrderRequest | undefined;
    await act(async () => { returned = await result.current.submitRequest(reqData); });

    expect(insertSpy).toHaveBeenCalledWith([{ ...reqData, status: 'Pending' }]);
    expect(selectAfterInsert).not.toHaveBeenCalled(); // regression guard: re-adding .select() fails here
    // confirmation screen needs the submitted data, not a DB-echoed row
    expect(returned).toMatchObject({ customer_name: 'Maria', status: 'Pending', total: 50 });
  });
});
