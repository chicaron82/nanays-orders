import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Save, ChefHat, Check, User, CalendarDays, MapPin, PenLine, Clock, RotateCcw, Plus } from 'lucide-react';
import type { Order, Stock, BlockedDay } from '../types';
import { getIngredientWarnings, fmt, LUMPIA_PRICE, LUMPIA_HALF_PRICE, PANCIT_PRICE, PANCIT_SAUCE_PRICE, PANCIT_EXTRA_MEAT_PRICE, RUSH_ORDER_FEE, EARLY_ORDER_FEE, isEarlyFulfillment, noShowWatch, formatDate } from '../lib/utils';
import { useOrderForm } from '../hooks/useOrderForm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => void;
  editOrder?: Order | null;
  allOrders?: Order[];
  stock?: Stock | null;
  initialDate?: string | null;
  blockedSet?: ReadonlySet<string>;
  blockedDays?: BlockedDay[];
}

const ROW_BTN = 'w-7 h-7 rounded border-2 border-stone-200 text-orange-600 font-bold hover:bg-orange-50 flex items-center justify-center text-sm transition-colors';

export default function OrderFormModal({ isOpen, onClose, onSave, editOrder = null, allOrders = [], stock = null, initialDate = null, blockedSet, blockedDays = [] }: Props) {
  const {
    form, showSuggestions, setShowSuggestions,
    nameSuggestions, setField, formatPhone,
    handleSelectSuggestion, handleSubmit, hasItems, total, subtotal, discount, legacy,
    repeatAvailable, applyRepeatLast, repeatOrderCount,
    addCustomItem, updateCustomItem, removeCustomItem,
    isDateBlocked,
  } = useOrderForm({ isOpen, editOrder, allOrders, initialDate, onSave, blockedSet });

  const [dateTbd, setDateTbd] = useState(editOrder ? !editOrder.needed_date : false);
  // Re-sync the TBD toggle whenever the modal (re)opens or swaps to a different
  // order. Done during render — React's sanctioned alternative to a
  // setState-in-effect (which triggers cascading renders) — by tracking the
  // prior open/order identity and resetting only on a real transition.
  const [noShowDismissed, setNoShowDismissed] = useState(false);
  const [synced, setSynced] = useState<{ open: boolean; order: Order | null }>({ open: isOpen, order: editOrder });
  if (synced.open !== isOpen || synced.order !== editOrder) {
    setSynced({ open: isOpen, order: editOrder });
    if (isOpen) { setDateTbd(editOrder ? !editOrder.needed_date : false); setNoShowDismissed(false); }
  }

  // Heads-up if the name/phone being entered matches a past no-show.
  const ghost = noShowWatch(form.customer_name, form.contact, allOrders);
  const showGhost = ghost.matched && !noShowDismissed && (!editOrder || !editOrder.no_show);

  const toggleTbd = () => {
    const next = !dateTbd;
    setDateTbd(next);
    if (next) setField('needed_date', '');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4">
        <m.div
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

            {showGhost && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-3">
                <span className="text-base leading-none">⚠️</span>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-amber-800">
                    Possible repeat no-show{ghost.count > 1 ? ` · ${ghost.count}×` : ''}
                  </p>
                  <p className="text-amber-700 mt-0.5">
                    {ghost.byPhone ? 'Same phone number' : 'Similar name'} to a no-show{ghost.lastDate ? ` on ${formatDate(ghost.lastDate)}` : ''} ({ghost.name}). Same person? If so, stop and check — otherwise dismiss.
                  </p>
                </div>
                <button type="button" onClick={() => setNoShowDismissed(true)} aria-label="Dismiss" className="text-amber-400 hover:text-amber-600 text-base leading-none cursor-pointer">×</button>
              </div>
            )}

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
                      <p className="text-xs text-stone-400 mb-2">Sauces (optional · {fmt(PANCIT_SAUCE_PRICE['sweet_and_sour'])} each · <span className="text-orange-400 font-semibold">homemade</span>)</p>
                      <div className="flex gap-4">
                        {[
                          { key: 'sweet_and_sour' as const, label: 'Sweet & Sour' },
                          { key: 'sweet_chili'    as const, label: 'Sweet Chili' },
                        ].map(sauce => {
                          const current = form.lumpia?.sauces || [];
                          const qty = current.filter(s => s === sauce.key).length;
                          return (
                            <div key={sauce.key} className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${qty > 0 ? 'text-orange-600' : 'text-stone-400'}`}>{sauce.label}</span>
                              <div className="flex items-center gap-1">
                                {qty > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const idx = current.indexOf(sauce.key);
                                      setField('lumpia.sauces', current.filter((_, i) => i !== idx));
                                    }}
                                    className="w-6 h-6 rounded-full border border-stone-200 text-stone-500 hover:border-orange-300 text-sm flex items-center justify-center transition-colors cursor-pointer"
                                  >−</button>
                                )}
                                {qty > 0 && <span className="text-xs font-bold text-orange-600 w-4 text-center">{qty}</span>}
                                <button
                                  type="button"
                                  onClick={() => setField('lumpia.sauces', [...current, sauce.key])}
                                  className={`w-6 h-6 rounded-full border text-sm flex items-center justify-center transition-colors cursor-pointer ${qty > 0 ? 'border-orange-400 text-orange-500 hover:bg-orange-50' : 'border-stone-200 text-stone-500 hover:border-orange-300'}`}
                                >+</button>
                              </div>
                            </div>
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

            {/* Custom / one-off items */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                <ChefHat size={14}/> Custom Items <span className="font-normal normal-case text-stone-400">— one-offs, e.g. embutido</span>
              </label>
              <div className="space-y-2">
                {(form.custom_items || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text" value={c.name}
                      onChange={e => updateCustomItem(i, { name: e.target.value })}
                      placeholder="Dish name"
                      className="flex-1 border-2 border-stone-200 rounded-lg px-3 py-2 text-sm focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors"
                    />
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-400 pointer-events-none">$</span>
                      <input
                        type="number" min={0} step="0.01" value={c.price || ''}
                        onChange={e => updateCustomItem(i, { price: Number(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full border-2 border-stone-200 rounded-lg pl-6 pr-2 py-2 text-sm focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors"
                      />
                    </div>
                    <button type="button" onClick={() => removeCustomItem(i)} aria-label="Remove custom item"
                      className="shrink-0 text-stone-400 hover:text-red-500 transition-colors p-1">
                      <X size={16}/>
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addCustomItem}
                className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors">
                <Plus size={16}/> Add custom item
              </button>
            </div>

            {/* Discount — goodwill gesture: storm delay, loyalty thank-you */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                🏷️ Discount <span className="font-normal normal-case text-stone-400">— optional</span>
              </label>
              {repeatOrderCount >= 2 && (
                <div className="text-xs font-semibold text-amber-600 mb-2">
                  ⭐ {form.customer_name?.trim()} has ordered {repeatOrderCount} times — maybe a thank-you?
                </div>
              )}
              {/* One-time legacy-pricing grace (2026-07 raise): a returning customer
                  gets the old prices on THIS order; the amount re-derives from the
                  items (never stored), and the confirmation shows the new price. */}
              <button type="button" onClick={() => setField('legacy_pricing', !form.legacy_pricing)}
                className={`mb-2 w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  form.legacy_pricing
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                <span>🧡 Legacy pricing — old prices, one-time grace</span>
                <span>{form.legacy_pricing ? (legacy > 0 ? `−${fmt(legacy)}` : 'on') : 'off'}</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border-2 border-stone-200 overflow-hidden shrink-0">
                  {(['flat', 'percent'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setField('discount_type', t)}
                      className={`px-3 py-2 text-sm font-bold transition-colors ${
                        (form.discount_type ?? 'flat') === t ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
                      }`}
                    >
                      {t === 'flat' ? '$' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min={0} step={form.discount_type === 'percent' ? 1 : 0.01}
                  value={form.discount_value ?? ''}
                  onChange={e => setField('discount_value', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="0"
                  className="w-20 shrink-0 border-2 border-stone-200 rounded-lg px-3 py-2 text-sm focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors"
                />
                <input
                  type="text" value={form.discount_label ?? ''}
                  onChange={e => setField('discount_label', e.target.value)}
                  placeholder="Why? e.g. moved date"
                  className="flex-1 min-w-0 border-2 border-stone-200 rounded-lg px-3 py-2 text-sm focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {['Moved date 🙏', 'Thank you for coming back ⭐'].map(preset => (
                  <button key={preset} type="button" onClick={() => setField('discount_label', preset)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border-2 transition-colors ${
                      form.discount_label === preset ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Running subtotal */}
            {(form.lumpia?.enabled || form.pancit?.enabled || (form.custom_items?.some(c => c.name?.trim() && c.price > 0))) && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 space-y-1">
                {(discount > 0 || legacy > 0) && (
                  <div className="flex items-center justify-between text-sm text-stone-500">
                    <span>Subtotal</span>
                    <span className="font-semibold">{fmt(subtotal)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex items-center justify-between text-sm text-amber-700">
                    <span>🏷️ {form.discount_label?.trim() || 'Discount'}</span>
                    <span className="font-semibold">−{fmt(discount)}</span>
                  </div>
                )}
                {legacy > 0 && (
                  <div className="flex items-center justify-between text-sm text-orange-700">
                    <span>🧡 Legacy pricing (one-time)</span>
                    <span className="font-semibold">−{fmt(legacy)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-600">
                    {form.delivery_type !== 'pickup' ? 'Total (incl. delivery)' : 'Total'}
                  </span>
                  <span className="text-xl font-black text-orange-600">{fmt(total)}</span>
                </div>
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
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="order-date" className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider"><CalendarDays size={14}/> Date Needed</label>
                  <button type="button" onClick={toggleTbd} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${dateTbd ? 'bg-amber-100 border-amber-300 text-amber-700' : 'border-stone-200 text-stone-400 hover:text-stone-600'}`}>
                    TBD
                  </button>
                </div>
                {dateTbd ? (
                  <div className="w-full border-2 border-dashed border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-400 italic">
                    Date pending — will confirm when available
                  </div>
                ) : (
                  <input id="order-date" name="needed_date" type="date" value={form.needed_date ?? ''} onChange={e => setField('needed_date', e.target.value)} className={`w-full border-2 rounded-xl px-4 py-2.5 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors ${isDateBlocked ? 'border-red-400 focus-visible:border-red-500' : 'border-stone-200 focus-visible:border-orange-500'}`} />
                )}
                {isDateBlocked && (
                  <p className="text-xs text-red-500 mt-1 font-semibold">
                    🔒 Blocked: {blockedDays.find(d => d.date === form.needed_date)?.reason || 'Family Day / Off'}
                  </p>
                )}
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

            {/* Early-fulfillment fee — derived from the time + delivery type */}
            {isEarlyFulfillment(form) && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${form.early_fee_waived ? 'border-stone-200 bg-stone-50' : 'border-amber-300 bg-amber-50/60'}`}>
                <div className="flex-1">
                  <div className="font-bold text-stone-800 text-sm">
                    ⏰ Early {form.delivery_type === 'pickup' ? 'pickup' : 'delivery'} — before {form.delivery_type === 'pickup' ? '11am' : 'noon'}
                  </div>
                  <div className="text-xs text-stone-500">
                    {form.early_fee_waived
                      ? 'Fee waived — no early charge added.'
                      : `An early order fee of ${fmt(EARLY_ORDER_FEE)} will be added.`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setField('early_fee_waived', !form.early_fee_waived)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-colors shrink-0 ${form.early_fee_waived ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-stone-300 text-stone-600 hover:bg-stone-100'}`}
                >
                  {form.early_fee_waived ? 'Apply fee' : 'Waive fee'}
                </button>
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
            <button onClick={handleSubmit} disabled={!form.customer_name?.trim() || !hasItems || isDateBlocked}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2">
              <Save size={20} /> {editOrder ? 'Save Changes' : 'Add Order'}
            </button>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
