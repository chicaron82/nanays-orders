import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, ChefHat, CheckSquare, User, CalendarDays, MapPin, PenLine } from 'lucide-react';
import { fuzzyMatch, calcTotal } from '../lib/utils';
import { supabase } from '../lib/supabase';

const initialForm = {
  customer_name: "", contact: "",
  lumpia: { enabled: false, style: "uncooked", sets: 1 },
  pancit: { enabled: false, full: 1, half: 0 },
  needed_date: "", pickup_time: "", delivery_type: "pickup", address: "",
  payment_status: "Unpaid", deposit_amount: "", notes: "", preferences: "",
  order_status: "Pending", saveCustomer: false,
};

export default function OrderFormModal({ isOpen, onClose, onSave, editOrder = null, allOrders = [] }) {
  const [form, setForm] = useState(initialForm);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (editOrder) setForm({ ...editOrder, saveCustomer: false });
        else setForm({ ...initialForm, needed_date: new Date().toISOString().split('T')[0] });
      }, 0);
    }
  }, [isOpen, editOrder]);

  const existingNames = [...new Set(allOrders.map(o => o.customer_name))];
  const nameSuggestions = (!form.customer_name || form.customer_name.length < 2) 
    ? [] 
    : existingNames.filter(n => fuzzyMatch(n, form.customer_name) && n.toLowerCase() !== form.customer_name.toLowerCase()).slice(0, 4);

  const setField = (path, value) => {
    setForm(f => {
      const clone = JSON.parse(JSON.stringify(f));
      const keys = path.split(".");
      let cur = clone;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const handleSelectSuggestion = async (name) => {
    setField("customer_name", name);
    setShowSuggestions(false);
    try {
      const { data } = await supabase.from('customers').select('*').eq('name', name).single();
      if (data) {
        setForm(f => ({ ...f, customer_name: name, contact: data.contact || f.contact, preferences: data.preferences || f.preferences }));
      }
    } catch(e) { console.error(e); }
  };

  const handleSubmit = () => {
    if (!form.customer_name.trim() || !form.needed_date) return;
    if (!form.lumpia.enabled && !form.pancit.enabled) return;
    
    const finalOrder = { ...form, total: calcTotal(form) };
    if (finalOrder.saveCustomer) {
      supabase.from('customers').upsert({ name: finalOrder.customer_name, contact: finalOrder.contact, preferences: finalOrder.preferences }).then();
    }
    delete finalOrder.saveCustomer;
    onSave(finalOrder);
  };

  const hasItems = form.lumpia.enabled || form.pancit.enabled;

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
            <h2 className="font-playfair text-white text-2xl font-black">{editOrder ? "Edit Order ✏️" : "New Order 🍜"}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={18}/></button>
          </div>

          <div className="p-6 space-y-6">
            {/* Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><User size={14}/> Customer Name *</label>
                <input value={form.customer_name} onChange={e => { setField("customer_name", e.target.value); setShowSuggestions(true); }}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-orange-500 outline-none transition-colors" placeholder="Tita Cora" />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-30 top-full mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
                    {nameSuggestions.map(n => (
                      <div key={n} className="px-4 py-3 hover:bg-orange-50 cursor-pointer text-stone-800" onClick={() => handleSelectSuggestion(n)}>{n}</div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><PenLine size={14}/> Contact</label>
                <input value={form.contact} onChange={e => setField("contact", e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-orange-500 outline-none transition-colors" placeholder="204-555-0100" />
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><ChefHat size={14}/> Menu Items</label>
              
              {/* Lumpia */}
              <div className={`border-2 rounded-xl overflow-hidden transition-colors ${form.lumpia.enabled ? 'border-orange-400 shadow-sm' : 'border-stone-200'}`}>
                <div className="p-4 bg-orange-50/50 flex items-center cursor-pointer gap-4" onClick={() => setField("lumpia.enabled", !form.lumpia.enabled)}>
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${form.lumpia.enabled ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}>
                    {form.lumpia.enabled && <CheckSquare size={16} />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800">🥟 Lumpia (100 pcs/batch)</div>
                    <div className="text-xs text-stone-500">Uncooked $30 · Cooked $35</div>
                  </div>
                </div>
                {form.lumpia.enabled && (
                  <div className="p-4 bg-white border-t border-stone-100 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <select value={form.lumpia.style} onChange={e => setField("lumpia.style", e.target.value)} className="w-full border-2 border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-orange-500">
                        <option value="uncooked">Uncooked / Frozen</option>
                        <option value="cooked">Cooked</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-stone-500">Batches:</span>
                      <button className="w-8 h-8 rounded-lg border-2 text-orange-600 font-bold hover:bg-orange-50" onClick={() => setField("lumpia.sets", Math.max(1, form.lumpia.sets - 1))}>−</button>
                      <span className="font-bold w-6 text-center">{form.lumpia.sets}</span>
                      <button className="w-8 h-8 rounded-lg border-2 text-orange-600 font-bold hover:bg-orange-50" onClick={() => setField("lumpia.sets", form.lumpia.sets + 1)}>+</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pancit */}
              <div className={`border-2 rounded-xl overflow-hidden transition-colors ${form.pancit.enabled ? 'border-orange-400 shadow-sm' : 'border-stone-200'}`}>
                <div className="p-4 bg-orange-50/50 flex items-center cursor-pointer gap-4" onClick={() => setField("pancit.enabled", !form.pancit.enabled)}>
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${form.pancit.enabled ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}>
                    {form.pancit.enabled && <CheckSquare size={16} />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800">🍜 Pancit Tray</div>
                    <div className="text-xs text-stone-500">Full $35 · Half $17.50</div>
                  </div>
                </div>
                {form.pancit.enabled && (
                  <div className="p-4 bg-white border-t border-stone-100 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-stone-700">Full Trays</span>
                      <div className="flex items-center gap-3">
                        <button className="w-8 h-8 rounded-lg border-2 text-orange-600 font-bold hover:bg-orange-50" onClick={() => setField("pancit.full", Math.max(0, form.pancit.full - 1))}>−</button>
                        <span className="font-bold w-6 text-center">{form.pancit.full}</span>
                        <button className="w-8 h-8 rounded-lg border-2 text-orange-600 font-bold hover:bg-orange-50" onClick={() => setField("pancit.full", form.pancit.full + 1)}>+</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-stone-700">Half / Small Trays</span>
                      <div className="flex items-center gap-3">
                        <button className="w-8 h-8 rounded-lg border-2 text-orange-600 font-bold hover:bg-orange-50" onClick={() => setField("pancit.half", Math.max(0, form.pancit.half - 1))}>−</button>
                        <span className="font-bold w-6 text-center">{form.pancit.half}</span>
                        <button className="w-8 h-8 rounded-lg border-2 text-orange-600 font-bold hover:bg-orange-50" onClick={() => setField("pancit.half", form.pancit.half + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Logistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><CalendarDays size={14}/> Date Needed *</label>
                <input type="date" value={form.needed_date} onChange={e => setField("needed_date", e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-orange-500 outline-none transition-colors" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2"><MapPin size={14}/> Delivery Type</label>
                <select value={form.delivery_type} onChange={e => setField("delivery_type", e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-orange-500 outline-none bg-white">
                  <option value="pickup">🏠 Pickup (free)</option>
                  <option value="city">🚗 City Delivery (+$5)</option>
                  <option value="outside">🛣️ Outside City (+$10)</option>
                </select>
              </div>
            </div>

            {/* Preferences & Notes */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 block">Customer Preferences</label>
                <input value={form.preferences} onChange={e => setField("preferences", e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-orange-500 outline-none" placeholder="Sweet chili sauce, no onions..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-stone-50 p-3 rounded-xl border border-stone-200">
                <input type="checkbox" checked={form.saveCustomer} onChange={e => setField("saveCustomer", e.target.checked)} className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500" />
                <span className="text-sm font-medium text-stone-700">Save preferences for next time</span>
              </label>
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={!form.customer_name.trim() || !form.needed_date || !hasItems} className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2">
              <Save size={20} /> {editOrder ? "Save Changes" : "Add Order"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
