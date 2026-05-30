import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, ChefHat, Check, User, CalendarDays, MapPin, PenLine, Clock, RotateCcw } from 'lucide-react';
import type { Order, Stock } from '../types';
import { getIngredientWarnings, fmt, LUMPIA_PRICE, LUMPIA_HALF_PRICE, PANCIT_PRICE, PANCIT_SAUCE_PRICE, PANCIT_EXTRA_MEAT_PRICE, RUSH_ORDER_FEE } from '../lib/utils';
import { useOrderForm } from '../hooks/useOrderForm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => void;
  editOrder?: Order | null;
  allOrders?: Order[];
  stock?: Stock | null;
  initialDate?: string | null;
}

const ROW_BTN = 'w-7 h-7 rounded border-2 border-stone-200 text-orange-600 font-bold hover:bg-orange-50 flex items-center justify-center text-sm transition-colors';

export default function OrderFormModal({ isOpen, onClose, onSave, editOrder = null, allOrders = [], stock = null, initialDate = null }: Props) {
  const {
    form, showSuggestions, setShowSuggestions,
    nameSuggestions, setField, formatPhone,
    handleSelectSuggestion, handleSubmit, hasItems, total,
    repeatAvailable, applyRepeatLast,
  } = useOrderForm({ isOpen, editOrder, allOrders, stock: stock ?? undefined, initialDate, onSave });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white sm:rounded-2xl w-full h-[100dvh] sm:h-auto max-w-2xl sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
        >
          <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-amber-500 p-5 flex justify-between items-center z-20 shrink-0">
            <h2 className="font-playfair text-white text-2xl font-black">{editOrder ? 'Edit Order ✏️' : 'New Order 🍜'}</h2>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={18}/></button>
          </div>

          <div className="p-6 space-y-6">
            {/* Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              <div>
                <label htmlFor="order-customer-name" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><User size={14}/> Customer Name *</label>
                <input id="order-customer-name" name="customer_name" autoComplete="off" value={form.customer_name ?? ''} onChange={e => { setField('customer_name', e.target.value); setShowSuggestions(true); }}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors" placeholder="Tita Cora" />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-30 top-full mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
                    {nameSuggestions.map(n => (
                      <button key={n} type="button" className="w-full text-left px-4 py-3 hover:bg-orange-50 cursor-pointer text-stone-800" onClick={() => handleSelectSuggestion(n)}>{n}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="order-contact" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><PenLine size={14}/> Contact</label>
                <input id="order-contact" name="contact" type="tel" autoComplete="tel" spellCheck={false} value={form.contact ?? ''} onChange={e => setField('contact', formatPhone(e.target.value))} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors" placeholder="204-555-0100" />
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider"><ChefHat size={14}/> Menu Items</label>
                {repeatAvailable && (
                  <button type="button" onClick={applyRepeatLast} className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition-colors">
                    <RotateCcw size={13}/> Repeat last order
                  </button>
                )}
              </div>

              {/* Lumpia */}
              <div className={`border-2 rounded-xl overflow-hidden transition-colors ${form.lumpia?.enabled ? 'border-orange-400 shadow-sm' : 'border-stone-200'}`}>
                <button
                  type="button"
                  className="w-full p-4 bg-orange-50/50 flex items-center cursor-pointer gap-4 text-left"
                  onClick={() => {
                    if (!form.lumpia?.enabled) {
                      setField('lumpia', { enabled: true, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: [] });
                    } else {
                      setField('lumpia.enabled', false);
                    }
                  }}
                >
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${form.lumpia?.enabled ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
                    {form.lumpia?.enabled && <Check size={14} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800">🥟 Lumpia</div>
                    <div className="text-xs text-stone-500">Full batch 100 pcs · Half batch 50 pcs</div>
                  </div>
                </button>

                {form.lumpia?.enabled && (
                  <div className="px-4 py-3 bg-white border-t border-stone-100 space-y-3">
                    {/* Full batch row */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setField('lumpia.sets', (form.lumpia?.sets ?? 0) > 0 ? 0 : 1)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${(form.lumpia?.sets ?? 0) > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300 hover:border-orange-300'}`}
                      >
                        {(form.lumpia?.sets ?? 0) > 0 && <Check size={11} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-stone-700">Full batch</span>
                        <span className="text-xs text-stone-400 ml-1.5">100 pcs · {fmt(LUMPIA_PRICE[form.lumpia?.setsCooked ? 'cooked' : 'uncooked'])}</span>
                      </div>
                      <div className={`flex items-center gap-2 transition-opacity ${(form.lumpia?.sets ?? 0) === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                        <button type="button" onClick={() => setField('lumpia.sets', Math.max(1, (form.lumpia?.sets ?? 1) - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{form.lumpia?.sets ?? 0}</span>
                        <button type="button" onClick={() => setField('lumpia.sets', (form.lumpia?.sets ?? 0) + 1)} className={ROW_BTN}>+</button>
                        <button
                          type="button"
                          onClick={() => setField('lumpia.setsCooked', !form.lumpia?.setsCooked)}
                          className={`ml-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${form.lumpia?.setsCooked ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-400 hover:border-stone-300'}`}
                        >
                          cooked
                        </button>
                      </div>
                    </div>

                    {/* Half batch row */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setField('lumpia.halves', (form.lumpia?.halves ?? 0) > 0 ? 0 : 1)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${(form.lumpia?.halves ?? 0) > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300 hover:border-orange-300'}`}
                      >
                        {(form.lumpia?.halves ?? 0) > 0 && <Check size={11} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-stone-700">Half batch</span>
                        <span className="text-xs text-stone-400 ml-1.5">50 pcs · {fmt(LUMPIA_HALF_PRICE[form.lumpia?.halvesCooked ? 'cooked' : 'uncooked'])}</span>
                      </div>
                      <div className={`flex items-center gap-2 transition-opacity ${(form.lumpia?.halves ?? 0) === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                        <button type="button" onClick={() => setField('lumpia.halves', Math.max(1, (form.lumpia?.halves ?? 1) - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{form.lumpia?.halves ?? 0}</span>
                        <button type="button" onClick={() => setField('lumpia.halves', (form.lumpia?.halves ?? 0) + 1)} className={ROW_BTN}>+</button>
                        <button
                          type="button"
                          onClick={() => setField('lumpia.halvesCooked', !form.lumpia?.halvesCooked)}
                          className={`ml-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${form.lumpia?.halvesCooked ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-400 hover:border-stone-300'}`}
                        >
                          cooked
                        </button>
                      </div>
                    </div>

                    {/* Sauces */}
                    <div className="pt-1 border-t border-stone-100">
                      <p className="text-xs text-stone-400 mb-2">Sauces (optional · {fmt(PANCIT_SAUCE_PRICE['sweet_and_sour'])} each)</p>
                      <div className="flex gap-2">
                        {[
                          { key: 'sweet_and_sour', label: 'Sweet & Sour' },
                          { key: 'sweet_chili',    label: 'Sweet Chili' },
                        ].map(sauce => {
                          const current = form.lumpia?.sauces || [];
                          const selected = current.includes(sauce.key as 'sweet_and_sour' | 'sweet_chili');
                          return (
                            <button
                              key={sauce.key}
                              type="button"
                              onClick={() => {
                                setField('lumpia.sauces', selected ? current.filter(s => s !== sauce.key) : [...current, sauce.key]);
                              }}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-200 text-stone-500 hover:border-orange-300'}`}
                            >
                              {sauce.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pancit */}
              <div className={`border-2 rounded-xl overflow-hidden transition-colors ${form.pancit?.enabled ? 'border-orange-400 shadow-sm' : 'border-stone-200'}`}>
                <button
                  type="button"
                  className="w-full p-4 bg-orange-50/50 flex items-center cursor-pointer gap-4 text-left"
                  onClick={() => {
                    if (!form.pancit?.enabled) {
                      setField('pancit', { enabled: true, full: 1, half: 0, large: 0, extraMeat: false });
                    } else {
                      setField('pancit.enabled', false);
                    }
                  }}
                >
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${form.pancit?.enabled ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
                    {form.pancit?.enabled && <Check size={14} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800">🍜 Pancit Tray</div>
                    <div className="text-xs text-stone-500">Regular {fmt(PANCIT_PRICE.full)} · Small {fmt(PANCIT_PRICE.half)} · Large {fmt(PANCIT_PRICE.large)}</div>
                  </div>
                </button>

                {form.pancit?.enabled && (
                  <div className="px-4 py-3 bg-white border-t border-stone-100 space-y-3">
                    {/* Regular */}
                    <div className="flex items-center gap-2.5">
                      <button type="button" onClick={() => setField('pancit.full', (form.pancit?.full ?? 0) > 0 ? 0 : 1)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${(form.pancit?.full ?? 0) > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300 hover:border-orange-300'}`}>
                        {(form.pancit?.full ?? 0) > 0 && <Check size={11} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-stone-700">Regular</span>
                        <span className="text-xs text-stone-400 ml-1.5">{fmt(PANCIT_PRICE.full)}</span>
                      </div>
                      <div className={`flex items-center gap-2 transition-opacity ${(form.pancit?.full ?? 0) === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                        <button type="button" onClick={() => setField('pancit.full', Math.max(1, (form.pancit?.full ?? 1) - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{form.pancit?.full ?? 0}</span>
                        <button type="button" onClick={() => setField('pancit.full', (form.pancit?.full ?? 0) + 1)} className={ROW_BTN}>+</button>
                      </div>
                    </div>

                    {/* Small */}
                    <div className="flex items-center gap-2.5">
                      <button type="button" onClick={() => setField('pancit.half', (form.pancit?.half ?? 0) > 0 ? 0 : 1)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${(form.pancit?.half ?? 0) > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300 hover:border-orange-300'}`}>
                        {(form.pancit?.half ?? 0) > 0 && <Check size={11} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-stone-700">Small</span>
                        <span className="text-xs text-stone-400 ml-1.5">{fmt(PANCIT_PRICE.half)}</span>
                      </div>
                      <div className={`flex items-center gap-2 transition-opacity ${(form.pancit?.half ?? 0) === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                        <button type="button" onClick={() => setField('pancit.half', Math.max(1, (form.pancit?.half ?? 1) - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{form.pancit?.half ?? 0}</span>
                        <button type="button" onClick={() => setField('pancit.half', (form.pancit?.half ?? 0) + 1)} className={ROW_BTN}>+</button>
                      </div>
                    </div>

                    {/* Large */}
                    <div className="flex items-center gap-2.5">
                      <button type="button" onClick={() => setField('pancit.large', (form.pancit?.large || 0) > 0 ? 0 : 1)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${(form.pancit?.large || 0) > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300 hover:border-orange-300'}`}>
                        {(form.pancit?.large || 0) > 0 && <Check size={11} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-stone-700">Large</span>
                        <span className="text-xs text-stone-400 ml-1.5">{fmt(PANCIT_PRICE.large)}</span>
                      </div>
                      <div className={`flex items-center gap-2 transition-opacity ${(form.pancit?.large || 0) === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                        <button type="button" onClick={() => setField('pancit.large', Math.max(1, (form.pancit?.large || 0) - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{form.pancit?.large || 0}</span>
                        <button type="button" onClick={() => setField('pancit.large', (form.pancit?.large || 0) + 1)} className={ROW_BTN}>+</button>
                      </div>
                    </div>

                    {/* Extra meat */}
                    <div className="pt-1 border-t border-stone-100">
                      <button
                        type="button"
                        onClick={() => setField('pancit.extraMeat', !form.pancit?.extraMeat)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${form.pancit?.extraMeat ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-200 text-stone-500 hover:border-orange-300'}`}
                      >
                        🥩 Extra meat &amp; veggies · +{fmt(PANCIT_EXTRA_MEAT_PRICE)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Running subtotal */}
            {(form.lumpia?.enabled || form.pancit?.enabled) && (
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <span className="text-sm font-semibold text-stone-600">
                  {form.delivery_type !== 'pickup' ? 'Total (incl. delivery)' : 'Total'}
                </span>
                <span className="text-xl font-black text-orange-600">{fmt(total)}</span>
              </div>
            )}

            {/* Fulfillability warnings */}
            {(() => {
              const warnings = getIngredientWarnings(form, stock ?? undefined);
              if (!warnings.length) return null;
              return (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-1.5">
                  {warnings.map((w, i) => (
                    <div key={i} className="text-sm text-amber-900">{w}</div>
                  ))}
                </div>
              );
            })()}

            {/* Rush order */}
            <label htmlFor="rush-order" className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-colors ${form.rush_order ? 'border-orange-400 bg-orange-50/50' : 'border-stone-200'}`}>
              <input type="checkbox" id="rush-order" className="sr-only" checked={form.rush_order ?? false} onChange={e => setField('rush_order', e.target.checked)} />
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${form.rush_order ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
                {form.rush_order && <Check size={14} className="text-white" />}
              </div>
              <div className="flex-1">
                <div className="font-bold text-stone-800 text-sm">⚡ Rush Order</div>
                <div className="text-xs text-stone-500">Priority handling · +{fmt(RUSH_ORDER_FEE)}</div>
              </div>
            </label>

            {/* Logistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="order-date" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><CalendarDays size={14}/> Date Needed *</label>
                <input id="order-date" name="needed_date" type="date" value={form.needed_date ?? ''} onChange={e => setField('needed_date', e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors" />
              </div>
              <div>
                <label htmlFor="order-time" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><Clock size={14}/> {form.delivery_type === 'pickup' ? 'Pickup Time' : 'Delivery Time'}</label>
                <input id="order-time" name="pickup_time" type="time" value={form.pickup_time ?? ''} onChange={e => setField('pickup_time', e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors" />
              </div>
              <div>
                <label htmlFor="order-delivery-type" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><MapPin size={14}/> Delivery Type</label>
                <select id="order-delivery-type" name="delivery_type" value={form.delivery_type ?? 'pickup'} onChange={e => setField('delivery_type', e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none bg-white">
                  <option value="pickup">🏠 Pickup (free)</option>
                  <option value="city">🚗 City Delivery (+$5)</option>
                  <option value="outside">🛣️ Outside City (+$10)</option>
                </select>
              </div>
            </div>

            {form.delivery_type !== 'pickup' && (
              <div>
                <label htmlFor="order-address" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><MapPin size={14}/> Delivery Address *</label>
                <input id="order-address" name="address" autoComplete="off" value={form.address ?? ''} onChange={e => setField('address', e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors" placeholder="123 Main St, Winnipeg" />
              </div>
            )}

            {/* Preferences & Notes */}
            <div className="space-y-4">
              <div>
                <label htmlFor="order-preferences" className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 block">Customer Preferences / Notes</label>
                <input id="order-preferences" name="preferences" autoComplete="off" value={form.preferences ?? ''} onChange={e => setField('preferences', e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none" placeholder="Sweet chili sauce, buzz code #405, message on arrival…" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-stone-50 p-3 rounded-xl border border-stone-200">
                <input type="checkbox" checked={form.saveCustomer ?? false} onChange={e => setField('saveCustomer', e.target.checked)} className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500" />
                <span className="text-sm font-medium text-stone-700">Save customer for next time</span>
              </label>
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={!form.customer_name?.trim() || !form.needed_date || !hasItems}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2">
              <Save size={20} /> {editOrder ? 'Save Changes' : 'Add Order'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
