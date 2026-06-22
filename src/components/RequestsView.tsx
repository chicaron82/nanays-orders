import { useState } from 'react';
import { CalendarDays, Clock, MapPin, Check, Trash2, Phone, ChefHat } from 'lucide-react';
import type { OrderRequest, Order } from '../types';
import { fmt, orderSummary, formatDate, noShowWatch } from '../lib/utils';

interface RequestsViewProps {
  requests: OrderRequest[];
  orders: Order[];
  blockedSet: ReadonlySet<string>;
  onApprove: (request: OrderRequest) => void;
  onDecline: (request: OrderRequest) => void;
}

export default function RequestsView({ requests, orders, blockedSet, onApprove, onDecline }: RequestsViewProps) {
  const [dismissed, setDismissed] = useState<Set<string | number>>(new Set());

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-stone-400">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-300 mb-4">
          <ChefHat size={32} />
        </div>
        <h3 className="font-playfair text-xl font-bold text-stone-700">No Pending Requests</h3>
        <p className="text-sm text-stone-400 mt-1 max-w-xs text-center">
          When customers submit requests through the public form, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-4 space-y-6">
      <div className="flex justify-between items-center pb-2 border-b border-stone-200">
        <div>
          <h2 className="font-playfair text-2xl font-black text-stone-800">Pending Requests 🌟</h2>
          <p className="text-xs text-stone-400 mt-0.5">Review, approve, or decline incoming customer requests</p>
        </div>
        <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {requests.map(req => {
          const isBlocked = blockedSet.has(req.needed_date);
          const ghost = noShowWatch(req.customer_name, req.contact, orders);
          const showGhost = ghost.matched && !dismissed.has(req.id!);

          return (
            <div key={req.id} className={`bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col md:flex-row ${showGhost ? 'border-amber-300' : isBlocked ? 'border-red-300' : 'border-stone-200'}`}>

              {/* Request Core Info */}
              <div className="p-5 flex-1 space-y-4">
                {showGhost && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5">
                    <span className="text-base leading-none">⚠️</span>
                    <div className="flex-1 text-xs">
                      <p className="font-bold text-amber-800">
                        Possible repeat no-show{ghost.count > 1 ? ` · ${ghost.count}×` : ''}
                      </p>
                      <p className="text-amber-700 mt-0.5">
                        {ghost.byPhone ? 'Same phone number' : 'Similar name'} to a no-show{ghost.lastDate ? ` on ${formatDate(ghost.lastDate)}` : ''} ({ghost.name}). Same person? If so, hold off — otherwise dismiss.
                      </p>
                    </div>
                    <button type="button" onClick={() => setDismissed(s => new Set(s).add(req.id!))} aria-label="Dismiss" className="text-amber-400 hover:text-amber-600 text-base leading-none cursor-pointer">×</button>
                  </div>
                )}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-playfair text-lg font-black text-stone-800">{req.customer_name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1">
                      <Phone size={13} />
                      <a href={`tel:${req.contact}`} className="hover:underline font-semibold text-orange-600">{req.contact}</a>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-orange-600 block">{fmt(req.total)}</span>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Estimated Quote</span>
                  </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-stone-600 bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className={isBlocked ? 'text-red-500 animate-pulse' : 'text-stone-400'} />
                    <span className={isBlocked ? 'text-red-600 font-bold' : ''}>
                      {req.needed_date} {isBlocked && '(🔒 Date Blocked!)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-stone-400" />
                    <span>{req.pickup_time}</span>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin size={16} className="text-stone-400 mt-0.5" />
                    <span>
                      {req.delivery_type === 'pickup'
                        ? '🏠 Pickup'
                        : `🚗 Delivery to: ${req.address}`}
                    </span>
                  </div>
                </div>

                {/* Items Description */}
                <div>
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">Requested Items</div>
                  <p className="text-sm text-stone-700 bg-orange-50/20 border border-orange-100/30 px-3 py-2 rounded-lg leading-relaxed font-semibold">
                    {orderSummary(req as any)}
                  </p>
                </div>

                {/* Customer Notes */}
                {req.notes && (
                  <div>
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">Dietary &amp; Delivery Notes</div>
                    <p className="text-sm text-stone-500 italic bg-stone-50 p-2.5 rounded-lg border border-stone-200/50">
                      &ldquo;{req.notes}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Sidebar */}
              <div className="bg-stone-50 md:w-48 px-5 py-6 flex md:flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-stone-200 shrink-0">
                <button
                  onClick={() => onApprove(req)}
                  className="flex-1 md:flex-initial bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
                >
                  <Check size={16} /> Approve
                </button>
                <button
                  onClick={() => onDecline(req)}
                  className="flex-1 md:flex-initial bg-white border border-stone-200 text-red-500 font-bold py-3 px-4 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center gap-2 active:scale-95 text-sm"
                >
                  <Trash2 size={16} /> Decline
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
