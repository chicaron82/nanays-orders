// Each store's first-stop category — the thing mom reliably reaches for first when
// she shops there (Superstore: veggies before meats; Lucky: wrappers before veg;
// Dollarama: containers). Selecting a store pre-picks this category so the common
// case costs zero extra taps. It's a DEFAULT, never a lock — one tap switches it
// (e.g. to Meats when the trip is for an order). Stores not listed here (Other) and
// an empty selection return undefined, which leaves the current category untouched.
//
// Keys MUST match STORES[].value and values MUST match CATEGORIES[].value in
// ExpenseLog.tsx. Editing mom's habits later is a one-line change here.
export const STORE_DEFAULTS: Record<string, string> = {
  Superstore: 'vegetables',
  Lucky: 'wrappers',
  Dollarama: 'containers',
};

/** The category to pre-select when a store is chosen, or undefined to leave it as-is. */
export function defaultCategoryForStore(store: string): string | undefined {
  return STORE_DEFAULTS[store];
}
