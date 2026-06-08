// Domain types for Nanay's Orders.
// Fields are optional where the app builds objects up incrementally (an order
// form in progress) and the code guards access with `?.` / `|| 0`.

export type OrderStatus = 'Pending' | 'Ready' | 'Fulfilled' | 'Cancelled';
export type PaymentStatus = 'Unpaid' | 'Deposit' | 'Prepaid';
export type DeliveryType = 'pickup' | 'city' | 'outside';
export type LumpiaSauce = 'sweet_and_sour' | 'sweet_chili';
export type StockLevel = 'plenty' | 'low' | 'out';

export interface LumpiaOrder {
  enabled?: boolean;
  sets?: number;
  setsCooked?: boolean;
  halves?: number;
  halvesCooked?: boolean;
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

/** An ad-hoc dish (e.g. embutido) — free-text name + price, for one-off orders. */
export interface CustomItem {
  name: string;
  price: number;
}

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
  payment_status?: PaymentStatus;
  deposit_amount?: number | null;
  tip_amount?: number;  // overage kept as a tip when paid more than the total
  notes?: string;
  preferences?: string;
  rush_order?: boolean;
  early_fee_waived?: boolean;  // Christine's override: suppress the early-fulfillment fee
  order_status?: OrderStatus;
  total?: number;
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

export interface Expense {
  id?: string | number;
  date: string;
  amount: number | string;
  category?: string;
  note?: string;
  created_at?: string;
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
