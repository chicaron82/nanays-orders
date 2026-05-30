import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { Stock } from '../types';

const initialStock: Stock = {
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
  const [stock, setStock] = useState<Stock>(initialStock);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStock() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('stock').select('*').eq('id', 1).single();
        if (error && error.code !== 'PGRST116') throw error; // ignore no rows error initially
        if (data) setStock(data as Stock);
      } catch (err) {
        console.error('Error fetching stock:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchStock();

    const subscription = supabase
      .channel('stock_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        fetchStock();
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  async function updateStock(newStock: Partial<Stock>, { silent = false }: { silent?: boolean } = {}) {
    try {
      const { error } = await supabase.from('stock').upsert({ id: 1, ...newStock });
      if (error) throw error;
      if (!silent) toast.success('Stock updated! 📦');
      setStock(prev => ({ ...prev, ...newStock }));
    } catch (err) {
      console.error('Error updating stock:', err.message);
      toast.error('Failed to update stock');
      throw err;
    }
  }

  return { stock, loading, updateStock };
}
