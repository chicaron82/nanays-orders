import { useState, useEffect } from 'react';
import { fuzzyMatch, calcTotal } from '../lib/utils';
import { supabase } from '../lib/supabase';

const initialForm = {
  customer_name: "", contact: "",
  lumpia: { enabled: false, sets: 1, setsCooked: true, halves: 0, halvesCooked: true, sauces: [] },
  pancit: { enabled: false, full: 1, half: 0, large: 0, extraMeat: false },
  needed_date: "", pickup_time: "", delivery_type: "pickup", address: "",
  payment_status: "Unpaid", deposit_amount: "", notes: "", preferences: "",
  rush_order: false, order_status: "Pending", saveCustomer: false,
};

export function useOrderForm({ isOpen, editOrder, allOrders, stock: _stock, initialDate, onSave }) {
  const [form, setForm] = useState(initialForm);
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

  const existingNames = [...new Set(allOrders.map(o => o.customer_name))];
  const nameSuggestions = (!form.customer_name || form.customer_name.length < 2)
    ? []
    : existingNames
        .filter(n => fuzzyMatch(n, form.customer_name) && n.toLowerCase() !== form.customer_name.toLowerCase())
        .slice(0, 4);

  const formatPhone = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const setField = (path, value) => {
    setForm(f => {
      const clone = structuredClone(f);
      const keys = path.split('.');
      let cur = clone;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const handleSelectSuggestion = async (name) => {
    setField('customer_name', name);
    setShowSuggestions(false);
    try {
      const { data } = await supabase.from('customers').select('*').eq('name', name).single();
      if (data) {
        setForm(f => ({ ...f, customer_name: name, contact: data.contact || f.contact, preferences: data.preferences || f.preferences }));
      }
    } catch (e) { console.error(e); }
  };

  const hasItems =
    (form.lumpia.enabled && ((form.lumpia.sets || 0) + (form.lumpia.halves || 0) > 0)) ||
    (form.pancit.enabled && ((form.pancit.full || 0) + (form.pancit.half || 0) + (form.pancit.large || 0) > 0));

  const total = calcTotal(form);

  const handleSubmit = () => {
    if (!form.customer_name.trim() || !form.needed_date || !hasItems) return;
    const finalOrder = {
      ...form,
      total,
      deposit_amount: form.deposit_amount === '' ? null : Number(form.deposit_amount),
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
    handleSelectSuggestion, handleSubmit, hasItems, total,
  };
}
