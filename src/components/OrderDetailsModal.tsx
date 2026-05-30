import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Trash2, Edit2, AlertTriangle, Calendar, MapPin, Phone, MessageSquare, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Order, Stock, OrderStatus, PaymentStatus } from '../types';
import { fmt, formatDate, checkShortage, urgencyLabel, getDaysUntil, buildOrderMessage, ORDER_STATUS, PAYMENT_STATUS } from '../lib/utils';

interface Props {
  order: Order | null;
  stock: Stock;
  allOrders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onDelete: (id: string | number) => void;
  onStatusChange: (id: string | number, status: OrderStatus) => void;
  onPaymentChange: (id: string | number, patch: Partial<Order>) => void;
}

export default function OrderDetailsModal({ order, stock, allOrders, isOpen, onClose, onEdit, onDelete, onStatusChange, onPaymentChange }: Props) {
  const [depositInput, setDepositInput] = useState(
    () => (order?.deposit_amount != null ? String(order.deposit_amount) : '')
  );
  const [pendingDelete, setPendingDelete] = useState(false);

  if (!isOpen || !order) return null;

  const total = order.total ?? 0;
  const deposit = Number(order.deposit_amount) || 0;
  const balance = order.payment_status === 'Prepaid' ? 0 : order.payment_status === 'Deposit' ? total - deposit : total;

  const detailShortage = checkShortage(order, stock, allOrders.filter(x => x.id !== order.id && x.order_status === 'Ready'));
  const days = getDaysUntil(order.needed_date);
  const urgency = urgencyLabel(days);

  const handlePaymentStatus = (p: PaymentStatus) => {
    onPaymentChange(order.id!, {
      payment_status: p,
      deposit_amount: p === 'Deposit' ? (order.deposit_amount ?? null) : null,
    });
  };

  const handleShare = async () => {
    const text = buildOrderMessage(order);
    try {
      await navigator.share({ text });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Order copied 📋');
      } catch {
        toast.error('Could not share or copy');
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4" onClick={onClose}>
        <m.div
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
              <div className="flex items-center gap-2">
                <button onClick={handleShare} aria-label="Share order" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"><Share2 size={16}/></button>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={18}/></button>
              </div>
              {urgency && order.order_status === 'Pending' && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${urgency.tailwind}`}>{urgency.text}</span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {detailShortage.length > 0 && order.order_status === 'Pending' && (
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
                  <div className="font-medium text-stone-800">
                    {(() => {
                      const setsCooked = order.lumpia!.setsCooked != null ? order.lumpia!.setsCooked : order.lumpia!.style === 'cooked';
                      const halvesCooked = order.lumpia!.halvesCooked != null ? order.lumpia!.halvesCooked : order.lumpia!.style === 'cooked';
                      return [
                        (order.lumpia!.sets || 0) > 0 && `${order.lumpia!.sets} full batch${order.lumpia!.sets !== 1 ? 'es' : ''} (${setsCooked ? 'cooked' : 'uncooked'})`,
                        (order.lumpia!.halves || 0) > 0 && `${order.lumpia!.halves} half batch${order.lumpia!.halves !== 1 ? 'es' : ''} (${halvesCooked ? 'cooked' : 'uncooked'})`,
                      ].filter(Boolean).join(' · ') || '—';
                    })()}
                  </div>
                  {(order.lumpia.sauces || []).length > 0 && (
                    <div className="text-xs text-stone-500 mt-1">
                      {order.lumpia.sauces!.map(s => s === 'sweet_and_sour' ? 'Sweet & Sour' : 'Sweet Chili').join(', ')}
                    </div>
                  )}
                </div>
              )}
              {order.pancit?.enabled && (
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">🍜 Pancit</div>
                  <div className="font-medium text-stone-800">
                    {[
                      (order.pancit.full ?? 0) > 0 && `${order.pancit.full} Regular`,
                      (order.pancit.half ?? 0) > 0 && `${order.pancit.half} Small`,
                      (order.pancit.large || 0) > 0 && `${order.pancit.large} Large`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {order.pancit.extraMeat && (
                    <div className="text-xs text-stone-500 mt-1">🥩 Extra meat &amp; veggies</div>
                  )}
                </div>
              )}
              {order.rush_order && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">⚡ Rush Order</div>
                  <div className="font-medium text-orange-800">Priority handling</div>
                </div>
              )}

              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar size={12}/> Needed By</div>
                <div className="font-medium text-stone-800">{formatDate(order.needed_date)}{order.pickup_time ? ` @ ${order.pickup_time}` : ''}</div>
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
                  {order.payment_status === 'Deposit' && `Deposit: ${fmt(deposit)} · Bal: ${fmt(balance)}`}
                  {order.payment_status === 'Prepaid' && `✓ Fully Paid`}
                  {order.payment_status === 'Unpaid' && `Balance Due: ${fmt(total)}`}
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
                  const isReadyWarn = s === 'Ready' && detailShortage.length > 0 && order.order_status === 'Pending';
                  return (
                    <button key={s} onClick={() => onStatusChange(order.id!, s)}
                      className={`px-4 py-2 rounded-full font-bold text-xs transition-colors ${
                        isActive ? 'bg-stone-800 text-white shadow-md' :
                        isReadyWarn ? 'bg-white border-2 border-red-200 text-red-500 hover:bg-red-50' :
                        'bg-white border-2 border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      {isReadyWarn ? '⚠️ Ready' : s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-stone-200 pt-6">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-3">Payment</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_STATUS.map(p => (
                  <button key={p} onClick={() => handlePaymentStatus(p)}
                    className={`px-4 py-2 rounded-full font-bold text-xs transition-colors ${
                      order.payment_status === p ? 'bg-stone-800 text-white shadow-md' :
                      'bg-white border-2 border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    {p === 'Prepaid' ? 'Paid ✓' : p}
                  </button>
                ))}
              </div>
              {order.payment_status === 'Deposit' && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-500">Deposit received:</span>
                  <input type="number" id="order-deposit" name="deposit_amount" autoComplete="off" min={0} step="0.01" value={depositInput}
                    onChange={e => setDepositInput(e.target.value)}
                    onBlur={() => onPaymentChange(order.id!, {
                      payment_status: 'Deposit',
                      deposit_amount: depositInput === '' ? null : Number(depositInput),
                    })}
                    placeholder="0.00"
                    className="w-28 border-2 border-stone-200 rounded-lg px-3 py-1.5 text-sm focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => onEdit(order)} className="flex-1 bg-stone-100 text-stone-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors">
                <Edit2 size={16}/> Edit
              </button>
              {pendingDelete ? (
                <div className="flex-1 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-red-700">Delete order?</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setPendingDelete(false)} className="text-xs text-stone-500 hover:text-stone-700 font-semibold transition-colors cursor-pointer">Cancel</button>
                    <button type="button" onClick={() => { onDelete(order.id!); onClose(); }} className="text-xs text-red-600 hover:text-red-800 font-bold transition-colors cursor-pointer">Delete</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setPendingDelete(true)} className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-red-200 hover:bg-red-100 transition-colors">
                  <Trash2 size={16}/> Delete
                </button>
              )}
            </div>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
