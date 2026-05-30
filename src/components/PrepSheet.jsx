import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer } from 'lucide-react';
import { buildPrepList, orderSummary, formatDate } from '../lib/utils';

const DELIVERY_LABEL = { pickup: 'Pickup', city: 'Delivery — city', outside: 'Delivery — outside' };

export default function PrepSheet({ ymd, orders, onClose }) {
  if (!ymd) return null;

  const { orders: rows, totals } = buildPrepList(orders, ymd);
  const { lumpia, pancit, sauces, rushCount } = totals;

  const lumpiaLines = [
    lumpia.setsCooked     && `${lumpia.setsCooked} cooked set${lumpia.setsCooked !== 1 ? 's' : ''}`,
    lumpia.setsUncooked   && `${lumpia.setsUncooked} uncooked set${lumpia.setsUncooked !== 1 ? 's' : ''}`,
    lumpia.halvesCooked   && `${lumpia.halvesCooked} cooked half`,
    lumpia.halvesUncooked && `${lumpia.halvesUncooked} uncooked half`,
  ].filter(Boolean);

  const pancitLines = [
    pancit.full  && `${pancit.full} regular`,
    pancit.half  && `${pancit.half} small`,
    pancit.large && `${pancit.large} large`,
  ].filter(Boolean);

  const sauceLines = [
    sauces.sweet_and_sour && `${sauces.sweet_and_sour}× sweet & sour`,
    sauces.sweet_chili    && `${sauces.sweet_chili}× sweet chili`,
  ].filter(Boolean);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60] flex items-start sm:items-center justify-center overflow-y-auto py-6 px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-auto"
        >
          {/* Toolbar — not printed */}
          <div className="no-print sticky top-0 bg-gradient-to-r from-orange-600 to-amber-500 p-4 flex justify-between items-center rounded-t-2xl">
            <div className="text-white font-playfair text-lg font-black">Prep Sheet</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Printer size={16} /> Print
              </button>
              <button
                onClick={onClose}
                aria-label="Close prep sheet"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable area */}
          <div className="print-area p-6 text-stone-900">
            <header className="border-b-2 border-stone-800 pb-3 mb-5">
              <h1 className="font-playfair text-2xl font-black">Nanay's Orders — Prep Sheet</h1>
              <p className="text-stone-600 text-sm">
                {formatDate(ymd)} · {totals.orderCount} order{totals.orderCount !== 1 ? 's' : ''}
                {rushCount > 0 ? ` · ${rushCount} rush` : ''}
              </p>
            </header>

            {totals.orderCount === 0 ? (
              <p className="text-stone-400">No orders for this day.</p>
            ) : (
              <>
                <section className="mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">To Make</h2>
                  <ul className="text-[15px] space-y-1.5">
                    {lumpiaLines.length > 0 && (
                      <li><span className="font-bold">Lumpia:</span> {lumpiaLines.join(', ')}</li>
                    )}
                    {pancitLines.length > 0 && (
                      <li>
                        <span className="font-bold">Pancit:</span> {pancitLines.join(', ')}
                        {pancit.extraMeat > 0 ? ` · extra meat ×${pancit.extraMeat}` : ''}
                      </li>
                    )}
                    {sauceLines.length > 0 && (
                      <li><span className="font-bold">Sauces:</span> {sauceLines.join(', ')}</li>
                    )}
                    {lumpiaLines.length === 0 && pancitLines.length === 0 && (
                      <li className="text-stone-400">— nothing to cook (check order items)</li>
                    )}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Orders</h2>
                  <div className="divide-y divide-stone-200">
                    {rows.map(o => (
                      <div key={o.id} className="py-2.5">
                        <div className="flex justify-between items-baseline gap-3">
                          <span className="font-bold">
                            <span className="tabular-nums">{o.pickup_time || '—'}</span> · {o.customer_name || 'Walk-in'}
                          </span>
                          <span className="text-sm text-stone-600 shrink-0">
                            {DELIVERY_LABEL[o.delivery_type] || 'Pickup'}{o.rush_order ? ' · RUSH' : ''}
                          </span>
                        </div>
                        <div className="text-sm text-stone-700">{orderSummary(o)}</div>
                        {o.delivery_type && o.delivery_type !== 'pickup' && o.address && (
                          <div className="text-xs text-stone-500 mt-0.5">📍 {o.address}</div>
                        )}
                        {o.contact && <div className="text-xs text-stone-500">📞 {o.contact}</div>}
                        {o.notes && <div className="text-xs text-stone-500 italic mt-0.5">📝 {o.notes}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
