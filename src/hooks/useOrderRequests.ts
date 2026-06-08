import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { OrderRequest, Order } from '../types';

export function useOrderRequests() {
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only subscribe and fetch if user is authenticated (public page doesn't need to read requests)
    let subscription: any = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchRequests();

        subscription = supabase
          .channel('order_requests_channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, (payload: any) => {
            if (payload.eventType === 'INSERT') {
              setRequests(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
            } else if (payload.eventType === 'DELETE') {
              setRequests(prev => prev.filter(r => r.id !== payload.old.id));
            }
          })
          .subscribe();
      }
    });

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  async function fetchRequests() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_requests')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as OrderRequest[]) || []);
    } catch (err) {
      console.error('Error fetching requests:', err.message);
      toast.error('Failed to load order requests');
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest(requestData: Omit<OrderRequest, 'status' | 'id' | 'created_at'>) {
    try {
      const { data, error } = await supabase
        .from('order_requests')
        .insert([{ ...requestData, status: 'Pending' }])
        .select();

      if (error) throw error;
      toast.success('Order request submitted successfully! 🌟');
      return data[0] as OrderRequest;
    } catch (err) {
      console.error('Error submitting request:', err.message);
      toast.error('Failed to submit order request. Please try again.');
      throw err;
    }
  }

  async function approveRequest(request: OrderRequest) {
    try {
      // 1. Prepare Order insertion payload
      const orderPayload: Omit<Order, 'id' | 'created_at'> = {
        customer_name: request.customer_name,
        contact: request.contact,
        lumpia: request.lumpia,
        pancit: request.pancit,
        custom_items: request.custom_items || [],
        needed_date: request.needed_date,
        pickup_time: request.pickup_time,
        delivery_type: request.delivery_type,
        address: request.address || '',
        notes: request.notes || '',
        rush_order: request.rush_order,
        total: request.total,
        order_status: 'Pending',
        payment_status: 'Unpaid',
        deposit_amount: 0,
        tip_amount: 0,
        early_fee_waived: false,
      };

      // 2. Insert into main orders table
      const { error: insertError } = await supabase
        .from('orders')
        .insert([orderPayload]);

      if (insertError) throw insertError;

      // 3. Delete from requests table
      const { error: deleteError } = await supabase
        .from('order_requests')
        .delete()
        .eq('id', request.id);

      if (deleteError) throw deleteError;

      // 4. Update local state
      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success('Request approved and order created! 🎉');
    } catch (err) {
      console.error('Error approving request:', err.message);
      toast.error('Failed to approve request');
      throw err;
    }
  }

  async function declineRequest(id: string) {
    try {
      const { error } = await supabase
        .from('order_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Request declined and deleted 🗑️');
    } catch (err) {
      console.error('Error declining request:', err.message);
      toast.error('Failed to decline request');
      throw err;
    }
  }

  return {
    requests,
    loading,
    submitRequest,
    approveRequest,
    declineRequest,
    refetch: fetchRequests,
  };
}
