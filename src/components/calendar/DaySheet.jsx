import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import { formatDate, dayLoad } from '../../lib/utils';
import OrderChip from './OrderChip';

export default function DaySheet({ ymd, orders, onClose, onOrderClick, onNewOrderForDate }) {
  if (!ymd) return null;

  const visible = orders
    .filter(o => o.order_status !== 'Cancelled')
    .sort((a, b) => (a.pickup_time || '').localeCompare(b.pickup_time || ''));
  const { units } = dayLoad(visible);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          onClick={e => e.stopPropagation()}
          className="bg-stone-50 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-amber-500 p-4 flex justify-between items-center z-10">
            <div className="text-white">
              <div className="font-playfair text-xl font-black">{formatDate(ymd)}</div>
              <div className="text-xs text-white/80">
                {visible.length} order{visible.length !== 1 ? 's' : ''}
                {units > 0 ? ` · ${units} work units` : ''}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-2">
            {visible.length === 0 && (
              <div className="text-center text-stone-400 text-sm py-6">No orders this day</div>
            )}
            {visible.map(o => (
              <OrderChip key={o.id} order={o} variant="full" onClick={() => onOrderClick(o)} />
            ))}
            <button
              onClick={() => onNewOrderForDate(ymd)}
              className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 font-bold text-sm hover:border-orange-400 hover:text-orange-500 transition-colors"
            >
              <Plus size={16} /> New order this day
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
