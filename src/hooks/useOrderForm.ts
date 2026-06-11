import { useState, useEffect } from 'react';
import { fuzzyMatch, calcTotal, orderSubtotal, discountAmount, lastOrderFor } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { Order, OrderForm } from '../types';

const initialForm: OrderForm = {
  customer_name: "", contact: "",
  lumpia: { enabled: false, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: [] },
  pancit: { enabled: false, full: 1, half: 0, large: 0, extraMeat: false },
  custom_items: [],
  needed_date: "", pickup_time: "", delivery_type: "pickup", address: "",
  payment_status: "Unpaid", deposit_amount: null, notes: "", preferences: "",
  rush_order: false, early_fee_waived: false, order_status: "Pending", saveCustomer: false,
  discount_type: "flat", discount_value: null, discount_label: "",
};

interface UseOrderFormProps {
  isOpen: boolean;
  editOrder: Order | null;
  allOrders: Order[];
  initialDate?: string | null;
  onSave: (order: Order) => void;
  blockedSet?: ReadonlySet<string>;
}

export function useOrderForm({ isOpen, editOrder, allOrders, initialDate, onSave, blockedSet }: UseOrderFormProps) {
  const [form, setForm] = useState<OrderForm>(initialForm);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (editOrder) {
          const lumpia = editOrder.lumpia;
          const migratedLumpia = lumpia?.style != null
            ? { ...lumpia, setsCooked: lumpia.style === 'cooked', halvesCooked: lumpia.style === 'cooked' }
            : lumpia;
          setForm({ ...editOrder, lumpia: migratedLumpia, saveCustomer: false });
        } else {
          setForm({ ...initialForm, needed_date: initialDate || new Date().toISOString().split('T')[0] });
        }
      }, 0);
    }
  }, [isOpen, editOrder, initialDate]);

  const q = form.customer_name || '';
  const existingNames = [...new Set(allOrders.map(o => o.customer_name).filter((n): n is string => !!n))];
  const nameSuggestions = q.length < 2
    ? []
    : existingNames
        .filter(n => fuzzyMatch(n, q) && n.toLowerCase() !== q.toLowerCase())
        .slice(0, 4);

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const setField = (path: string, value: unknown) => {
    setForm(f => {
      const clone: any = structuredClone(f);
      const keys = path.split('.');
      let cur = clone;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const handleSelectSuggestion = async (name: string) => {
    setField('customer_name', name);
    setShowSuggestions(false);
    try {
      const { data } = await supabase.from('customers').select('*').eq('name', name).single();
      if (data) {
        setForm(f => ({ ...f, customer_name: name, contact: data.contact || f.contact, preferences: data.preferences || f.preferences }));
      }
    } catch (e) { console.error(e); }
  };

  const repeatSource = !editOrder && q.trim() ? lastOrderFor(q, allOrders) : undefined;
  const repeatAvailable = !!repeatSource;

  // Loyalty nudge: how many past (non-cancelled) orders match this customer.
  // Informs sis's thank-you-discount decision — never makes it for her.
  const repeatOrderCount = q.trim()
    ? allOrders.filter(o =>
        o.id !== editOrder?.id && o.order_status !== 'Cancelled' && fuzzyMatch(o.customer_name, q)
      ).length
    : 0;

  const applyRepeatLast = () => {
    if (!repeatSource) return;
    setForm(f => ({
      ...f,
      lumpia: repeatSource.lumpia ? structuredClone(repeatSource.lumpia) : f.lumpia,
      pancit: repeatSource.pancit ? structuredClone(repeatSource.pancit) : f.pancit,
      delivery_type: repeatSource.delivery_type || f.delivery_type,
      preferences: f.preferences || repeatSource.preferences || '',
    }));
  };

  const validCustomItems = (form.custom_items || []).filter(c => c.name?.trim() && (Number(c.price) || 0) > 0);
  const hasItems =
    (form.lumpia?.enabled && ((form.lumpia.sets || 0) + (form.lumpia.halves || 0) > 0)) ||
    (form.pancit?.enabled && ((form.pancit.full || 0) + (form.pancit.half || 0) + (form.pancit.large || 0) > 0)) ||
    validCustomItems.length > 0;

  const addCustomItem = () =>
    setForm(f => ({ ...f, custom_items: [...(f.custom_items || []), { name: '', price: 0 }] }));
  const updateCustomItem = (i: number, patch: Partial<{ name: string; price: number }>) =>
    setForm(f => ({ ...f, custom_items: (f.custom_items || []).map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const removeCustomItem = (i: number) =>
    setForm(f => ({ ...f, custom_items: (f.custom_items || []).filter((_, idx) => idx !== i) }));

  const isDateBlocked = !!(
    form.needed_date &&
    blockedSet?.has(form.needed_date) &&
    (!editOrder || editOrder.needed_date !== form.needed_date)
  );

  const subtotal = orderSubtotal(form);
  const discount = discountAmount(form, subtotal);
  const total = calcTotal(form);

  const handleSubmit = () => {
    if (!form.customer_name?.trim() || !form.needed_date || !hasItems || isDateBlocked) return;
    const hasDiscount = (Number(form.discount_value) || 0) > 0;
    const finalOrder: OrderForm = {
      ...form,
      total,
      deposit_amount: form.deposit_amount ?? null,
      custom_items: validCustomItems.map(c => ({ name: c.name.trim(), price: Number(c.price) || 0 })),
      // A label without a value is noise — persist discount fields only as a pair.
      discount_value: hasDiscount ? Number(form.discount_value) : null,
      discount_label: hasDiscount ? (form.discount_label?.trim() || '') : '',
    };
    if (finalOrder.saveCustomer) {
      supabase.from('customers').upsert({ name: finalOrder.customer_name, contact: finalOrder.contact, preferences: finalOrder.preferences }).then();
    }
    delete finalOrder.saveCustomer;
    onSave(finalOrder);
  };

  return {
    form, showSuggestions, setShowSuggestions,
    nameSuggestions, setField, formatPhone,
    handleSelectSuggestion, handleSubmit, hasItems, total, subtotal, discount,
    repeatAvailable, applyRepeatLast, repeatOrderCount,
    addCustomItem, updateCustomItem, removeCustomItem,
    isDateBlocked,
  };
}
