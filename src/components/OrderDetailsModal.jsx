import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Edit2, AlertTriangle, Calendar, MapPin, Phone, MessageSquare } from 'lucide-react';
import { fmt, formatDate, checkShortage, urgencyLabel, getDaysUntil } from '../lib/utils';
import { ORDER_STATUS } from '../lib/utils';

export default function OrderDetailsModal({ order, stock, allOrders, isOpen, onClose, onEdit, onDelete, onStatusChange }) {
  if (!isOpen || !order) return null;

  const total = order.total ?? 0;
  const deposit = Number(order.deposit_amount) || 0;
  const balance = order.payment_status === "Prepaid" ? 0 : order.payment_status === "Deposit" ? total - deposit : total;
  
  const detailShortage = checkShortage(order, stock, allOrders.filter(x => x.id !== order.id && x.order_status === "Ready"));
  const days = getDaysUntil(order.needed_date);
  const urgency = urgencyLabel(days);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-white sm:rounded-2xl w-full h-[100dvh] sm:h-auto max-w-2xl sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
        >
          <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-amber-500 p-6 flex justify-between items-start z-20 shrink-0">
            <div className="text-white">
              <h2 className="font-playfair text-3xl font-black mb-1">{order.customer_name}</h2>
              {order.contact && <div className="flex items-center gap-1.5 text-white/80 text-sm"><Phone size={14}/> {order.contact}</div>}
              {order.preferences && <div className="flex items-center gap-1.5 text-white/90 text-sm mt-2 bg-white/20 px-3 py-1.5 rounded-lg w-max"><MessageSquare size={14}/> {order.preferences}</div>}
            </div>
            <div className="flex flex-col items-end gap-3">
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={18}/></button>
              {urgency && order.order_status === "Pending" && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${urgency.tailwind}`}>{urgency.text}</span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {detailShortage.length > 0 && order.order_status === "Pending" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800">
                <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm mb-1">Stock Shortage — Cannot Fulfill Yet</div>
                  <ul className="list-disc pl-4 text-xs space-y-1">
                    {detailShortage.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {order.lumpia?.enabled && (
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">🥟 Lumpia</div>
                  <div className="font-medium text-stone-800">{order.lumpia.sets} batch{order.lumpia.sets !== 1 ? 'es' : ''} <span className="text-stone-500 text-sm">({order.lumpia.style})</span></div>
                </div>
              )}
              {order.pancit?.enabled && (
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">🍜 Pancit</div>
                  <div className="font-medium text-stone-800">
                    {[order.pancit.full > 0 && `${order.pancit.full} Full`, order.pancit.half > 0 && `${order.pancit.half} Half`].filter(Boolean).join(" · ")}
                  </div>
                </div>
              )}
              
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar size={12}/> Needed By</div>
                <div className="font-medium text-stone-800">{formatDate(order.needed_date)}{order.delivery_type === 'pickup' && order.pickup_time ? ` @ ${order.pickup_time}` : ''}</div>
              </div>
              
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={12}/> Delivery</div>
                <div className="font-medium text-stone-800 capitalize">{order.delivery_type} {order.delivery_type !== 'pickup' && order.address ? ` — ${order.address}` : ''}</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl p-5 flex justify-between items-center text-white shadow-lg">
              <div>
                <div className="text-sm font-bold opacity-80 uppercase tracking-wider">Total</div>
                <div className="text-xs opacity-70 mt-1">
                  {order.payment_status === "Deposit" && `Deposit: ${fmt(deposit)} · Bal: ${fmt(balance)}`}
                  {order.payment_status === "Prepaid" && `✓ Fully Paid`}
                  {order.payment_status === "Unpaid" && `Balance Due: ${fmt(total)}`}
                </div>
              </div>
              <div className="font-playfair text-4xl font-black">{fmt(total)}</div>
            </div>

            {order.notes && (
              <div className="bg-amber-50 text-amber-900 p-4 rounded-xl text-sm border border-amber-200">
                <span className="font-bold">📝 Notes:</span> {order.notes}
              </div>
            )}

            <div className="border-t border-stone-200 pt-6">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-3">Update Status</label>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUS.map(s => {
                  const isActive = order.order_status === s;
                  const isReadyWarn = s === "Ready" && detailShortage.length > 0 && order.order_status === "Pending";
                  return (
                    <button key={s} onClick={() => onStatusChange(order.id, s)}
                      className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${
                        isActive ? 'bg-stone-800 text-white shadow-md' : 
                        isReadyWarn ? 'bg-white border-2 border-red-200 text-red-500 hover:bg-red-50' : 
                        'bg-white border-2 border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      {isReadyWarn ? "⚠️ Ready" : s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => onEdit(order)} className="flex-1 bg-stone-100 text-stone-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors">
                <Edit2 size={16}/> Edit
              </button>
              <button onClick={() => { onDelete(order.id); onClose(); }} className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-red-200 hover:bg-red-100 transition-colors">
                <Trash2 size={16}/> Delete
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
