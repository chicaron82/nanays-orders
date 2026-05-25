import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    
    const subscription = supabase
      .channel('orders_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev]);
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
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err.message);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function addOrder(orderData) {
    try {
      const { data, error } = await supabase.from('orders').insert([orderData]).select();
      if (error) throw error;
      setOrders(prev => [data[0], ...prev]);
      toast.success('Order added! 🎉');
      return data[0];
    } catch (err) {
      console.error('Error adding order:', err.message);
      toast.error('Failed to add order');
      throw err;
    }
  }

  async function updateOrder(id, updates) {
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

  async function deleteOrder(id) {
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
