// Domain types for Nanay's Orders.
// Fields are optional where the app builds objects up incrementally (an order
// form in progress) and the code guards access with `?.` / `|| 0`.

export type OrderStatus = 'Pending' | 'Ready' | 'Fulfilled' | 'Cancelled';
export type PaymentStatus = 'Unpaid' | 'Deposit' | 'Prepaid';
export type DiscountType = 'percent' | 'flat';
export type DeliveryType = 'pickup' | 'city' | 'outside';
export type LumpiaSauce = 'sweet_and_sour' | 'sweet_chili';
export type StockLevel = 'plenty' | 'low' | 'out';

export interface LumpiaOrder {
  enabled?: boolean;
  /** Full batches (100 pcs) in TOTAL, cooked and uncooked together. Stock and work math read this. */
  sets?: number;
  /** Legacy per-size switch: true = all `sets` cooked. Superseded by `setsUncooked` when that is present. */
  setsCooked?: boolean;
  /** How many of `sets` are UNCOOKED (2026-10-04) — the rest are cooked. Lets one order mix both. */
  setsUncooked?: number;
  /** Half batches (50 pcs) in TOTAL. */
  halves?: number;
  halvesCooked?: boolean;
  /** How many of `halves` are UNCOOKED. */
  halvesUncooked?: number;
  sauces?: LumpiaSauce[];
  /** Legacy single-style field, superseded by setsCooked / halvesCooked. */
  style?: string;
}

export interface PancitOrder {
  enabled?: boolean;
  full?: number;
  half?: number;
  large?: number;
  extraMeat?: boolean;
}

/** A dish on an order beyond lumpia and pancit: a typed one-off (embutido for one customer), or a COPY of a menu
 *  item taken when it was added (lib/menu), so a later re-price never changes this order. `price` is per piece. */
export interface CustomItem {
  name: string;
  price: number;
  /** How many. Absent on every row saved before 2026-11-16, and those mean 1. */
  qty?: number;
  /** Set when the line came from the Menu screen; absent on a typed one-off. */
  menu_item_id?: string;
}

/** A dish sis manages on the Menu screen (migration 021). Lumpia and pancit are not here: they live in lib/utils. */
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  /** Path inside the `menu-photos` bucket, or null before she adds one. */
  photo_path: string | null;
  /** On the menu at all. Off = gone from both forms; orders that have it keep their copy. */
  active: boolean;
  /** Ticked = the customer request page offers it too. */
  on_request_page: boolean;
  sort: number;
  created_at?: string;
}

/** Where an order originated: 'request' = approved from the public form/link,
 *  'manual' = entered by the kitchen. Drives the Insights link-attribution metric. */
export type OrderSource = 'manual' | 'request';

export interface Order {
  id?: string | number;
  customer_name?: string;
  contact?: string;
  lumpia?: LumpiaOrder;
  pancit?: PancitOrder;
  custom_items?: CustomItem[];
  needed_date?: string;
  pickup_time?: string;
  delivery_type?: DeliveryType;
  address?: string;
  address_lat?: number | null;  // geocoded when the address is picked from autocomplete
  address_lng?: number | null;  // null → drive-time falls back to on-the-fly geocoding
  payment_status?: PaymentStatus;
  deposit_amount?: number | null;
  tip_amount?: number;  // overage kept as a tip when paid more than the total
  notes?: string;
  preferences?: string;
  rush_order?: boolean;
  early_fee_waived?: boolean;  // Christine's override: suppress the early-fulfillment fee
  // Goodwill discount — one mechanism, many reasons (storm delay, loyalty thank-you).
  // type+value are stored (not a precomputed amount) so editing items re-derives a
  // percent correctly; the free-text label is the human explanation.
  discount_type?: DiscountType;
  discount_value?: number | null;
  discount_label?: string;
  order_status?: OrderStatus;
  // Modern fulfillment axis (migration 018): when the order was picked up / delivered
  // (null/absent = not yet). Distinct from payment — an order crosses off only when BOTH
  // paid AND fulfilled. Legacy order_status='Fulfilled' rows stay done regardless.
  fulfilled_at?: string | null;
  total?: number;
  source?: OrderSource;  // 'request' = came via the public link; defaults to 'manual'
  created_by?: string | null;  // auth uid of the account that inserted the row (migration 019); drives the sister-order alert
  no_show?: boolean;     // customer ghosted — stored as a Cancelled order + this flag (drives the repeat-no-show watchlist)
  no_show_reason?: string; // Christine's note on why it was flagged
  created_at?: string;
}

/** The order form carries a transient flag for optionally saving the customer. */
export interface OrderForm extends Order {
  saveCustomer?: boolean;
}

export interface Stock {
  lumpia_sets?: number;
  wrapper_packs?: number;
  pancit_full?: number;
  pancit_half?: number;
  pancit_large?: number;
  pork_frozen?: number;
  pork_thawed?: number;
  noodle_packs?: number;
  carrots_status?: StockLevel;
  celery_status?: StockLevel;
}

/** A date the family is unavailable — orders on this day get a redirect warning. */
export interface BlockedDay {
  id: string;
  date: string;   // YYYY-MM-DD
  reason?: string | null;
  created_at?: string;
}

export type ExpensePricingType = 'flat' | 'unit' | 'weight';

export interface Expense {
  id?: string | number;
  date: string;
  amount: number | string;
  category?: string;
  store?: string;
  note?: string;
  created_at?: string;
  // UI-only pricing breakdown — resolved to `amount` before saving to DB.
  pricing_type?: ExpensePricingType;
  unit_price?: number;
  quantity?: number;
  weight?: number;
}

export interface OrderRequest {
  id?: string;
  created_at?: string;
  customer_name: string;
  contact: string;
  lumpia: LumpiaOrder;
  pancit: PancitOrder;
  custom_items?: CustomItem[];
  needed_date: string;
  pickup_time: string;
  delivery_type: DeliveryType;
  address?: string;
  notes?: string;
  rush_order: boolean;
  total: number;
  status: 'Pending' | 'Approved' | 'Declined';
}
