import type { Order } from '../types';

/** Deliveries only — a pickup costs no driver, so it can never crowd a delivery slot. */
const DELIVERY_TYPES = ['city', 'outside'] as const;

/** Steps out from the requested time when hunting for a clear alternative. */
const STEP_MIN = 30;
/** Don't suggest a slot more than this far from what they asked for. */
const MAX_SHIFT_MIN = 180;
/** Real orders have run 09:30–19:30, so suggestions stay inside a plausible day. */
const DAY_START_MIN = 9 * 60;
const DAY_END_MIN = 20 * 60;

export interface DeliveryLoad {
  /** Deliveries already booked within the window of the requested time. */
  count: number;
  /** The clashing orders, nearest first — so the form can name them. */
  orders: Order[];
  /** Nearest clear time earlier than the request, `HH:MM`, or null if none inside the day. */
  earlier: string | null;
  /** Nearest clear time later than the request, `HH:MM`, or null. */
  later: string | null;
}

function toMinutes(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function toHHMM(mins: number): string {
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}

/** Deliveries on `date` whose time sits within `windowMinutes` of `atMinutes`. */
function clashingAt(
  orders: Order[],
  date: string,
  atMinutes: number,
  windowMinutes: number,
  excludeId?: string | number,
): Order[] {
  return orders
    .filter(o => {
      if (excludeId && o.id === excludeId) return false;
      if (o.needed_date !== date) return false;
      if (!DELIVERY_TYPES.includes(o.delivery_type as (typeof DELIVERY_TYPES)[number])) return false;
      const t = toMinutes(o.pickup_time);
      return t !== null && Math.abs(t - atMinutes) <= windowMinutes;
    })
    .sort((a, b) => {
      const ta = toMinutes(a.pickup_time) ?? 0, tb = toMinutes(b.pickup_time) ?? 0;
      return Math.abs(ta - atMinutes) - Math.abs(tb - atMinutes);
    });
}

/**
 * How crowded a delivery slot already is, plus the nearest clear times either side.
 *
 * ⭐ This reports a COUNT, never a verdict. It deliberately does not know how many drivers
 * are available — that number changes with who's free, whether Aaron's shift ran late, and
 * whether two drops happen to be on the same street. Mom knows all of that and the app never
 * will, so the app's job is to hand her the fact she's currently missing ("two already at 5")
 * while the customer is still on the phone. A capacity rule would have to guess, and guessing
 * wrong means refusing an order that was perfectly deliverable.
 *
 * Nothing here blocks a save. It informs.
 *
 * Notes on the shape:
 * - **Pickups never count.** Roughly half of all orders are pickups and they need no driver.
 * - **±30 min by default, not an exact match.** A 16:45 and a 17:00 drop compete for the same
 *   driver just as surely as two at 17:00; exact-match would call that pair free.
 * - **`excludeId` keeps an edit from flagging itself** — same guard `findDuplicateOrder` needs.
 *   Typed `string | number` because `Order.id` is; a narrower type silently rejects real ids.
 */
export function deliveryLoadAt(
  orders: Order[],
  date: string | null | undefined,
  time: string | null | undefined,
  opts: { windowMinutes?: number; excludeId?: string | number } = {},
): DeliveryLoad {
  const empty: DeliveryLoad = { count: 0, orders: [], earlier: null, later: null };
  const at = toMinutes(time);
  if (!date || at === null) return empty;

  const windowMinutes = opts.windowMinutes ?? STEP_MIN;
  const clashes = clashingAt(orders, date, at, windowMinutes, opts.excludeId);
  if (clashes.length === 0) return empty;

  // Walk outward in half-hour steps for the first slot with nothing booked near it.
  const findClear = (dir: -1 | 1): string | null => {
    for (let shift = STEP_MIN; shift <= MAX_SHIFT_MIN; shift += STEP_MIN) {
      const candidate = at + dir * shift;
      if (candidate < DAY_START_MIN || candidate > DAY_END_MIN) return null;
      if (clashingAt(orders, date, candidate, windowMinutes, opts.excludeId).length === 0) {
        return toHHMM(candidate);
      }
    }
    return null;
  };

  return { count: clashes.length, orders: clashes, earlier: findClear(-1), later: findClear(1) };
}

/** `"17:00"` → `"5:00 PM"`. Plain-language, for a line someone reads aloud on the phone. */
export function formatTimeLabel(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h24 = Math.floor(mins / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
