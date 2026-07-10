import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { Order } from '../types';

// Christine (Aaron's sister) — her Supabase auth uid. Orders she inserts ping
// Aaron on a separate channel (phone push via migration 020's trigger; in-app
// toast + chime below). Kept in sync with the WHEN clause in that migration.
const SISTER_UID = 'bf5238ff-3426-4862-bda1-d4037d9e5d5b';

// Descending G–E–C — deliberately distinct from useOrderRequests' ascending
// C–E–G so Aaron can tell a sister-order from a request-link ping by ear.
function playSisterOrderChime() {
  try {
    const ctx = new AudioContext();
    [784, 659, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // AudioContext blocked (e.g. no user gesture yet) — silent fail
  }
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  // The current session's uid, so a sister-order never chimes on Christine's own
  // device — only on the *other* signed-in kitchen clients (Aaron, Nanay).
  const myUidRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      myUidRef.current = session?.user?.id ?? null;
    });

    fetchOrders();

    const subscription = supabase
      .channel('orders_channel')
      // eslint-disable-next-line -- realtime payloads are dynamic DB rows
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const o = payload.new as Order;
          setOrders(prev => prev.some(existing => existing.id === o.id) ? prev : [o, ...prev]);
          // Sister-order alert: fire for everyone signed in EXCEPT Christine herself.
          if (o.created_by === SISTER_UID && myUidRef.current !== SISTER_UID) {
            toast.info(
              `New order from Christine — ${o.customer_name ?? 'customer'} • $${(o.total ?? 0).toFixed(2)}`,
              { duration: 8000 },
            );
            playSisterOrderChime();
          }
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as Order[]) || []);
    } catch (err) {
      console.error('Error fetching orders:', err.message);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function addOrder(orderData: Order) {
    try {
      const { data, error } = await supabase.from('orders').insert([orderData]).select();
      if (error) throw error;
      setOrders(prev => [data[0] as Order, ...prev]);
      toast.success('Order added! 🎉');
      return data[0];
    } catch (err) {
      console.error('Error adding order:', err.message);
      toast.error('Failed to add order');
      throw err;
    }
  }

  async function updateOrder(id: string | number, updates: Partial<Order>) {
    try {
      const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select();
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data[0] } : o));
      toast.success('Order updated! ✓');
    } catch (err) {
      console.error('Error updating order:', err.message);
      toast.error('Failed to update order');
      throw err;
    }
  }

  async function deleteOrder(id: string | number) {
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== id));
      toast.success('Order deleted 🗑️');
    } catch (err) {
      console.error('Error deleting order:', err.message);
      toast.error('Failed to delete order');
      throw err;
    }
  }

  return { orders, loading, addOrder, updateOrder, deleteOrder, refetch: fetchOrders };
}
