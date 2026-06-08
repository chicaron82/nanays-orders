import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChefHat, CalendarDays, User, Check, AlertCircle } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useOrderRequests } from '../hooks/useOrderRequests';
import type { OrderRequest, BlockedDay } from '../types';
import {
  calcTotal,
  fmt,
  LUMPIA_PRICE,
  LUMPIA_HALF_PRICE,
  PANCIT_PRICE,
  PANCIT_SAUCE_PRICE,
  PANCIT_EXTRA_MEAT_PRICE,
  EARLY_ORDER_FEE,
  DELIVERY_FEE,
  isEarlyFulfillment,
  formatDate,
} from '../lib/utils';

const ROW_BTN = 'w-8 h-8 rounded border border-stone-300 text-orange-600 font-bold hover:bg-orange-50 flex items-center justify-center text-sm transition-colors active:scale-95';

export default function PublicRequestPage() {
  const { submitRequest } = useOrderRequests();
  const totalRef = useRef<HTMLDivElement>(null);
  const [showFloatingTotal, setShowFloatingTotal] = useState(false);

  // Blocked days loading
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);

  useEffect(() => {
    async function loadBlockedDays() {
      try {
        const { data, error } = await supabase
          .from('blocked_days')
          .select('*')
          .order('date', { ascending: true });
        if (!error && data) {
          setBlockedDays(data as BlockedDay[]);
        }
      } catch (e) {
        console.error('Failed to load blocked days:', e);
      }
    }
    loadBlockedDays();
  }, []);

  const blockedSet = useMemo<ReadonlySet<string>>(
    () => new Set(blockedDays.map(d => d.date)),
    [blockedDays]
  );

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [contact, setContact] = useState('');
  const [neededDate, setNeededDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'city' | 'outside'>('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [rushOrder, setRushOrder] = useState(false);

  // Lumpia Choice
  const [lumpiaEnabled, setLumpiaEnabled] = useState(false);
  const [lumpiaSets, setLumpiaSets] = useState(1);
  const [lumpiaSetsCooked, setLumpiaSetsCooked] = useState(true);
  const [lumpiaHalves, setLumpiaHalves] = useState(0);
  const [lumpiaHalvesCooked, setLumpiaHalvesCooked] = useState(true);
  const [lumpiaSauces, setLumpiaSauces] = useState<('sweet_and_sour' | 'sweet_chili')[]>([]);

  // Pancit Choice
  const [pancitEnabled, setPancitEnabled] = useState(false);
  const [pancitFull, setPancitFull] = useState(1);
  const [pancitHalf, setPancitHalf] = useState(0);
  const [pancitLarge, setPancitLarge] = useState(0);
  const [pancitExtraMeat, setPancitExtraMeat] = useState(false);

  // Status
  const [submittedRequest, setSubmittedRequest] = useState<OrderRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  // Build temporary order object for pricing library reuse
  const orderObject = useMemo(() => {
    const o: any = {
      needed_date: neededDate,
      pickup_time: pickupTime,
      delivery_type: deliveryType,
      rush_order: rushOrder,
    };
    if (lumpiaEnabled) {
      o.lumpia = {
        enabled: true,
        sets: lumpiaSets,
        setsCooked: lumpiaSetsCooked,
        halves: lumpiaHalves,
        halvesCooked: lumpiaHalvesCooked,
        sauces: lumpiaSauces,
      };
    }
    if (pancitEnabled) {
      o.pancit = {
        enabled: true,
        full: pancitFull,
        half: pancitHalf,
        large: pancitLarge,
        extraMeat: pancitExtraMeat,
      };
    }
    return o;
  }, [
    neededDate, pickupTime, deliveryType, rushOrder,
    lumpiaEnabled, lumpiaSets, lumpiaSetsCooked, lumpiaHalves, lumpiaHalvesCooked, lumpiaSauces,
    pancitEnabled, pancitFull, pancitHalf, pancitLarge, pancitExtraMeat
  ]);

  const total = calcTotal(orderObject);
  const earlyWarning = isEarlyFulfillment(orderObject);
  const isDateBlocked = !!(neededDate && blockedSet.has(neededDate));
  const dateBlockReason = blockedDays.find(d => d.date === neededDate)?.reason;

  const hasItems =
    (lumpiaEnabled && (lumpiaSets + lumpiaHalves > 0)) ||
    (pancitEnabled && (pancitFull + pancitHalf + pancitLarge > 0));

  const isValid =
    customerName.trim().length > 0 &&
    contact.trim().length >= 10 &&
    neededDate.length > 0 &&
    pickupTime.length > 0 &&
    hasItems &&
    !isDateBlocked &&
    (deliveryType === 'pickup' || address.trim().length > 0);

  useEffect(() => {
    if (!hasItems) {
      setShowFloatingTotal(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!totalRef.current) return;
      const observer = new IntersectionObserver(([entry]) => {
        setShowFloatingTotal(!entry.isIntersecting);
      }, { threshold: 0.1 });
      observer.observe(totalRef.current);
      return () => observer.disconnect();
    }, 100);
    return () => clearTimeout(timer);
  }, [hasItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      const req: Omit<OrderRequest, 'status' | 'id' | 'created_at'> = {
        customer_name: customerName.trim(),
        contact: contact.trim(),
        lumpia: lumpiaEnabled ? {
          enabled: true,
          sets: lumpiaSets,
          setsCooked: lumpiaSetsCooked,
          halves: lumpiaHalves,
          halvesCooked: lumpiaHalvesCooked,
          sauces: lumpiaSauces,
        } : { enabled: false, sets: 0 },
        pancit: pancitEnabled ? {
          enabled: true,
          full: pancitFull,
          half: pancitHalf,
          large: pancitLarge,
          extraMeat: pancitExtraMeat,
        } : { enabled: false, full: 0 },
        custom_items: [],
        needed_date: neededDate,
        pickup_time: pickupTime,
        delivery_type: deliveryType,
        address: deliveryType !== 'pickup' ? address.trim() : '',
        notes: notes.trim(),
        rush_order: rushOrder,
        total: total,
      };

      const result = await submitRequest(req);
      if (result) {
        setSubmittedRequest(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRequest) {
    return (
      <div className="min-h-screen bg-stone-50 font-lato flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 border border-stone-100 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <Check size={36} />
          </div>
          <div>
            <h1 className="font-playfair text-3xl font-black text-stone-800">Request Submitted!</h1>
            <p className="text-stone-500 mt-2 text-sm">
              Thank you, {submittedRequest.customer_name}! We have received your order request.
            </p>
          </div>

          <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 text-left space-y-2 text-sm text-stone-700">
            <div className="font-semibold text-orange-800 border-b border-orange-200 pb-1.5 mb-2">Request Summary</div>
            <div>📅 **Date Requested**: {formatDate(submittedRequest.needed_date)}</div>
            <div>⏰ **Time**: {submittedRequest.pickup_time}</div>
            <div>🚗 **Delivery**: {submittedRequest.delivery_type === 'pickup' ? '🏠 Pickup' : `🚗 Delivery to: ${submittedRequest.address}`}</div>
            <div>💵 **Estimated Total**: <span className="font-black text-orange-600">{fmt(submittedRequest.total)}</span></div>
          </div>

          <div className="text-xs text-stone-500 bg-stone-50 rounded-lg p-3 border border-stone-200/60 leading-relaxed">
            📢 **Next Steps**: Christine will review the kitchen schedule and text you at **{submittedRequest.contact}** within 24 hours to confirm your order and arrange the deposit.
          </div>

          <button
            onClick={() => {
              setSubmittedRequest(null);
              setCustomerName('');
              setContact('');
              setNeededDate('');
              setPickupTime('');
              setAddress('');
              setNotes('');
              setLumpiaEnabled(false);
              setLumpiaSets(1);
              setLumpiaHalves(0);
              setPancitEnabled(false);
              setPancitFull(1);
              setPancitHalf(0);
              setPancitLarge(0);
              setPancitExtraMeat(false);
              setRushOrder(false);
            }}
            className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl hover:bg-orange-700 transition-colors shadow-md"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-lato pb-12">
      {/* Visual Header */}
      <header className="bg-gradient-to-r from-orange-600 to-amber-500 text-white py-10 px-6 text-center shadow-md">
        <h1 className="font-playfair text-3xl md:text-4xl font-black flex items-center justify-center gap-2">
          🍜 Nanay's Orders Request
        </h1>
        <p className="text-white/80 text-sm mt-2 font-medium tracking-wide">
          Filipino Home Kitchen · Crispy Lumpia Shanghai & Chicken Pancit
        </p>
      </header>

      <div className="max-w-2xl mx-auto px-4 -mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 border border-stone-200/50 space-y-6">
          
          {/* Customer Details */}
          <div className="space-y-4">
            <h2 className="font-playfair text-lg font-black text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-2">
              <User size={18} className="text-orange-500" /> Contact Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer-name" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Your Name *</label>
                <input
                  id="customer-name"
                  required
                  type="text"
                  placeholder="e.g., Tita Cora"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="customer-contact" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Cell Phone Number *</label>
                <input
                  id="customer-contact"
                  required
                  type="tel"
                  placeholder="204-555-0100"
                  value={contact}
                  onChange={e => setContact(formatPhone(e.target.value))}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Menu Selection */}
          <div className="space-y-4">
            <h2 className="font-playfair text-lg font-black text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-2">
              <ChefHat size={18} className="text-orange-500" /> Menu Selection
            </h2>

            {/* Lumpia */}
            <div className={`border-2 rounded-xl overflow-hidden transition-colors ${lumpiaEnabled ? 'border-orange-400' : 'border-stone-200'}`}>
              <button
                type="button"
                className="w-full p-4 bg-orange-50/40 flex items-center cursor-pointer gap-4 text-left"
                onClick={() => setLumpiaEnabled(!lumpiaEnabled)}
              >
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${lumpiaEnabled ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
                  {lumpiaEnabled && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-stone-800">🥟 Lumpia Shanghai (Pork &amp; Veggies)</div>
                  <div className="text-xs text-stone-500">Full batch (100 pcs) / Half batch (50 pcs)</div>
                </div>
              </button>

              {lumpiaEnabled && (
                <div className="px-4 py-3 bg-white border-t border-stone-100 space-y-3">
                  {/* Full Set */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLumpiaSets(lumpiaSets > 0 ? 0 : 1)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${lumpiaSets > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
                    >
                      {lumpiaSets > 0 && <Check size={11} className="text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-stone-700">Full Batch (100 pcs)</div>
                      <div className="text-xs text-stone-400">{fmt(LUMPIA_PRICE[lumpiaSetsCooked ? 'cooked' : 'uncooked'])}</div>
                    </div>
                    {lumpiaSets > 0 && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setLumpiaSets(Math.max(1, lumpiaSets - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{lumpiaSets}</span>
                        <button type="button" onClick={() => setLumpiaSets(lumpiaSets + 1)} className={ROW_BTN}>+</button>
                        <button
                          type="button"
                          onClick={() => setLumpiaSetsCooked(!lumpiaSetsCooked)}
                          className={`ml-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${lumpiaSetsCooked ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-400'}`}
                        >
                          {lumpiaSetsCooked ? 'cooked' : 'frozen'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Half Set */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLumpiaHalves(lumpiaHalves > 0 ? 0 : 1)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${lumpiaHalves > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
                    >
                      {lumpiaHalves > 0 && <Check size={11} className="text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-stone-700">Half Batch (50 pcs)</div>
                      <div className="text-xs text-stone-400">{fmt(LUMPIA_HALF_PRICE[lumpiaHalvesCooked ? 'cooked' : 'uncooked'])}</div>
                    </div>
                    {lumpiaHalves > 0 && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setLumpiaHalves(Math.max(1, lumpiaHalves - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{lumpiaHalves}</span>
                        <button type="button" onClick={() => setLumpiaHalves(lumpiaHalves + 1)} className={ROW_BTN}>+</button>
                        <button
                          type="button"
                          onClick={() => setLumpiaHalvesCooked(!lumpiaHalvesCooked)}
                          className={`ml-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${lumpiaHalvesCooked ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-400'}`}
                        >
                          {lumpiaHalvesCooked ? 'cooked' : 'frozen'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sauces */}
                  <div className="pt-2 border-t border-stone-100">
                    <div className="text-xs text-stone-400 mb-2">Sauces (optional · {fmt(PANCIT_SAUCE_PRICE['sweet_and_sour'])} each)</div>
                    <div className="flex gap-2">
                      {[
                        { key: 'sweet_and_sour', label: 'Sweet & Sour' },
                        { key: 'sweet_chili', label: 'Sweet Chili' },
                      ].map(s => {
                        const isSelected = lumpiaSauces.includes(s.key as any);
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => {
                              setLumpiaSauces(prev =>
                                isSelected ? prev.filter(x => x !== s.key) : [...prev, s.key as any]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-200 text-stone-500'}`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pancit */}
            <div className={`border-2 rounded-xl overflow-hidden transition-colors ${pancitEnabled ? 'border-orange-400' : 'border-stone-200'}`}>
              <button
                type="button"
                className="w-full p-4 bg-orange-50/40 flex items-center cursor-pointer gap-4 text-left"
                onClick={() => setPancitEnabled(!pancitEnabled)}
              >
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${pancitEnabled ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
                  {pancitEnabled && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-stone-800">🍜 Chicken Pancit Tray</div>
                  <div className="text-xs text-stone-500">Tray size options (Small / Regular / Large)</div>
                </div>
              </button>

              {pancitEnabled && (
                <div className="px-4 py-3 bg-white border-t border-stone-100 space-y-3">
                  {/* Small */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPancitHalf(pancitHalf > 0 ? 0 : 1)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${pancitHalf > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
                    >
                      {pancitHalf > 0 && <Check size={11} className="text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-stone-700">Small Tray (serves 3-5)</div>
                      <div className="text-xs text-stone-400">{fmt(PANCIT_PRICE.half)}</div>
                    </div>
                    {pancitHalf > 0 && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPancitHalf(Math.max(1, pancitHalf - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{pancitHalf}</span>
                        <button type="button" onClick={() => setPancitHalf(pancitHalf + 1)} className={ROW_BTN}>+</button>
                      </div>
                    )}
                  </div>

                  {/* Regular */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPancitFull(pancitFull > 0 ? 0 : 1)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${pancitFull > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
                    >
                      {pancitFull > 0 && <Check size={11} className="text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-stone-700">Regular Tray (serves 8-10)</div>
                      <div className="text-xs text-stone-400">{fmt(PANCIT_PRICE.full)}</div>
                    </div>
                    {pancitFull > 0 && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPancitFull(Math.max(1, pancitFull - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{pancitFull}</span>
                        <button type="button" onClick={() => setPancitFull(pancitFull + 1)} className={ROW_BTN}>+</button>
                      </div>
                    )}
                  </div>

                  {/* Large */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPancitLarge(pancitLarge > 0 ? 0 : 1)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${pancitLarge > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
                    >
                      {pancitLarge > 0 && <Check size={11} className="text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-stone-700">Large Tray (serves 15-20)</div>
                      <div className="text-xs text-stone-400">{fmt(PANCIT_PRICE.large)}</div>
                    </div>
                    {pancitLarge > 0 && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPancitLarge(Math.max(1, pancitLarge - 1))} className={ROW_BTN}>−</button>
                        <span className="font-bold text-sm w-4 text-center">{pancitLarge}</span>
                        <button type="button" onClick={() => setPancitLarge(pancitLarge + 1)} className={ROW_BTN}>+</button>
                      </div>
                    )}
                  </div>

                  {/* Extra Meat */}
                  <div className="pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setPancitExtraMeat(!pancitExtraMeat)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${pancitExtraMeat ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-200 text-stone-500 hover:border-orange-300'}`}
                    >
                      🥩 Double meat &amp; veggies · +{fmt(PANCIT_EXTRA_MEAT_PRICE)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Date & Logistics */}
          <div className="space-y-4">
            <h2 className="font-playfair text-lg font-black text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-2">
              <CalendarDays size={18} className="text-orange-500" /> Date &amp; Logistics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="req-date" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Date Needed *</label>
                <input
                  id="req-date"
                  required
                  type="date"
                  value={neededDate}
                  onChange={e => setNeededDate(e.target.value)}
                  className={`w-full border-2 rounded-xl px-4 py-2.5 outline-none transition-colors ${isDateBlocked ? 'border-red-400 focus:border-red-500' : 'border-stone-200 focus:border-orange-500'}`}
                />
              </div>

              <div>
                <label htmlFor="req-time" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Time *</label>
                <input
                  id="req-time"
                  required
                  type="time"
                  value={pickupTime}
                  onChange={e => setPickupTime(e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="req-delivery" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Delivery Option</label>
                <select
                  id="req-delivery"
                  value={deliveryType}
                  onChange={e => setDeliveryType(e.target.value as any)}
                  className="w-full border-2 border-stone-200 bg-white rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="pickup">🏠 Pickup (free)</option>
                  <option value="city">🚗 City Delivery (+$5)</option>
                  <option value="outside">🛣️ Outside City (+$10)</option>
                </select>
              </div>
            </div>

            {isDateBlocked && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm leading-relaxed">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong>🔒 Date Fully Booked / Unavailable:</strong>
                  <div className="text-xs text-red-600 mt-0.5">{dateBlockReason || 'The kitchen is closed or off on this date. Please select another day.'}</div>
                </div>
              </div>
            )}

            {deliveryType !== 'pickup' && (
              <div>
                <label htmlFor="req-address" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Delivery Address *</label>
                <input
                  id="req-address"
                  required
                  type="text"
                  placeholder="Street address, City"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Notes & Allergies */}
          <div className="space-y-4">
            <h2 className="font-playfair text-lg font-black text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-2">
              <AlertCircle size={18} className="text-orange-500" /> Allergies &amp; Notes
            </h2>
            <div>
              <label htmlFor="req-notes" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Dietary Notes / Allergy info / Special instructions</label>
              <textarea
                id="req-notes"
                placeholder="e.g. Please send extra sweet & sour sauce. Gluten allergy notes, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-500 transition-colors h-24 resize-none"
              />
            </div>
          </div>

          {/* Pricing Overage Warning Alerts */}
          {earlyWarning && (
            <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs leading-relaxed">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong>⏰ Early Morning Prep Fee (+{fmt(EARLY_ORDER_FEE)}):</strong>
                <div>This order requires pickup/delivery before {deliveryType === 'pickup' ? '11am' : '12pm'}. Early morning batches require extra early hours, so a small prep fee is added.</div>
              </div>
            </div>
          )}

          {/* Estimated Total Card */}
          {hasItems && (
            <div ref={totalRef} className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-stone-600">Fulfillment:</span>
                <span className="text-sm font-bold text-stone-800">{deliveryType === 'pickup' ? '🏠 Pickup' : `🚗 Delivery (+${fmt(DELIVERY_FEE[deliveryType])})`}</span>
              </div>
              {earlyWarning && (
                <div className="flex justify-between items-center text-xs text-amber-700">
                  <span>Early Morning Prep Fee:</span>
                  <span>+{fmt(EARLY_ORDER_FEE)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-orange-200/60 pt-2 text-stone-800">
                <span className="text-base font-black">Estimated Total:</span>
                <span className="text-2xl font-black text-orange-600">{fmt(total)}</span>
              </div>
              <div className="text-[10px] text-stone-400 text-center pt-1">
                Prices include raw ingredient preparation. Final confirmation sent by SMS.
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 text-lg"
          >
            {submitting ? 'Submitting...' : 'Send Order Request'}
          </button>

        </form>
      </div>

      <AnimatePresence>
        {showFloatingTotal && (
          <m.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 md:right-8 bg-gradient-to-r from-orange-600 to-amber-500 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 z-40 backdrop-blur-md"
          >
            <div className="flex flex-col">
              <span className="text-[10px] text-white/85 uppercase tracking-wider font-bold">Estimated Total</span>
              <span className="text-xl font-black">{fmt(total)}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <button
              type="button"
              onClick={() => {
                totalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="text-xs font-bold bg-white text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-50 transition-colors active:scale-95 cursor-pointer"
            >
              View Order
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
