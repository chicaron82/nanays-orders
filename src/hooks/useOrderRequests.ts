import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { OrderRequest, Order } from '../types';

function playRequestChime() {
  try {
    const ctx = new AudioContext();
    const frequencies = [523, 659, 784]; // C5, E5, G5
    frequencies.forEach((freq, i) => {
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

export function useOrderRequests() {
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(false);
  // Request IDs whose approval is in flight — guards a double-tap (slow network,
  // impatient second press) from inserting two orders for the same request.
  const approvingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only subscribe and fetch if user is authenticated (public page doesn't need to read requests)
    let cancelled = false;
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return;

      fetchRequests();

      // Unique name per invocation so Strict Mode's double-invoke doesn't get
      // back the already-subscribed cached channel and throw on .on().
      subscription = supabase
        .channel(`order_requests_channel_${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const req = payload.new as OrderRequest;
            setRequests(prev => prev.some(r => r.id === req.id) ? prev : [req, ...prev]);
            toast.info(`New request from ${req.customer_name} — $${req.total.toFixed(2)}`, {
              duration: 8000,
            });
            playRequestChime();
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setRequests(prev => prev.filter(r => r.id !== payload.old.id));
          }
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
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
    const id = request.id;
    // Re-entrancy guard: a second tap for the same request is a no-op while the
    // first is still in flight, so we never insert two orders for one request.
    if (!id || approvingRef.current.has(id)) return;
    approvingRef.current.add(id);

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
        source: 'request',  // came in through the public request link
      };

      // 2. Insert into main orders table. If this fails, nothing was created —
      //    throw so the caller can surface it; the request stays in the queue.
      const { error: insertError } = await supabase
        .from('orders')
        .insert([orderPayload]);

      if (insertError) throw insertError;

      // The order now exists — it's the source of truth. Drop the request from the
      // local queue immediately so it can't be re-approved into a second order,
      // even if the cleanup delete below fails.
      setRequests(prev => prev.filter(r => r.id !== id));

      // 3. Delete from requests table (cleanup). A failure here is NOT a failed
      //    approval — the order was created — so don't surface it as one (that
      //    would invite a re-tap and a duplicate order).
      const { error: deleteError } = await supabase
        .from('order_requests')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Order created, but request cleanup failed:', deleteError.message);
        toast.success('Order created! 🎉 (Refresh if the request still shows.)');
        return;
      }

      toast.success('Request approved and order created! 🎉');
    } catch (err) {
      console.error('Error approving request:', err.message);
      toast.error('Failed to approve request');
      throw err;
    } finally {
      approvingRef.current.delete(id);
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
