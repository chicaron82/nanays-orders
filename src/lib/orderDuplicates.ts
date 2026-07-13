import type { Order } from '../types';

/** Loose customer-name key: trimmed, lowercased, inner whitespace collapsed. */
function nameKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * An existing order that looks like a duplicate of `candidate` — same customer
 * (case/whitespace-insensitive) AND the same needed_date. Used to warn before a
 * MANUAL add creates a second row for an order that already exists: e.g. a
 * request-link order that was approved, then re-typed by hand (the recurring
 * duplicate this guards against). Excludes the candidate itself by id, so editing
 * an order never flags itself. Repeat customers on *different* days are fine — only
 * a same-name + same-day collision trips it. Returns the first match, or null.
 */
export function findDuplicateOrder(
  orders: Order[],
  candidate: Pick<Order, 'id' | 'customer_name' | 'needed_date'>,
): Order | null {
  const key = nameKey(candidate.customer_name);
  const date = candidate.needed_date;
  if (!key || !date) return null;
  return (
    orders.find(
      o => o.id !== candidate.id && o.needed_date === date && nameKey(o.customer_name) === key,
    ) ?? null
  );
}
