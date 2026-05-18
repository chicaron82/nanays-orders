import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const initialStock = {
  lumpia_sets: 0,
  wrapper_packs: 0,
  pancit_full: 0,
  pancit_half: 0,
  pork_frozen: 0,
  pork_thawed: 0,
  noodle_packs: 0,
  carrots_status: 'plenty',
  celery_status: 'plenty',
};

export function useStock() {
  const [stock, setStock] = useState(initialStock);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
    
    const subscription = supabase
      .channel('stock_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, (payload) => {
        fetchStock();
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  async function fetchStock() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('stock').select('*').eq('id', 1).single();
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error initially
      if (data) setStock(data);
    } catch (err) {
      console.error('Error fetching stock:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStock(newStock) {
    try {
      const { error } = await supabase.from('stock').upsert({ id: 1, ...newStock });
      if (error) throw error;
      toast.success('Stock updated! 📦');
      setStock(prev => ({ ...prev, ...newStock }));
    } catch (err) {
      console.error('Error updating stock:', err.message);
      toast.error('Failed to update stock');
      throw err;
    }
  }

  return { stock, loading, updateStock };
}
