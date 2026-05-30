import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExpenses() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });
        if (error) throw error;
        setExpenses(data || []);
      } catch (err) {
        console.error('Error fetching expenses:', err.message);
        toast.error('Failed to load expenses');
      } finally {
        setLoading(false);
      }
    }

    fetchExpenses();

    const subscription = supabase
      .channel('expenses_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setExpenses(prev => prev.some(e => e.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setExpenses(prev => prev.map(e => e.id === payload.new.id ? payload.new : e));
        } else if (payload.eventType === 'DELETE') {
          setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  async function addExpense(expense) {
    try {
      const { data, error } = await supabase.from('expenses').insert([expense]).select();
      if (error) throw error;
      setExpenses(prev =>
        [data[0], ...prev].sort((a, b) => b.date.localeCompare(a.date))
      );
      toast.success('Expense logged ✓');
      return data[0];
    } catch (err) {
      console.error('Error adding expense:', err.message);
      toast.error('Failed to log expense');
      throw err;
    }
  }

  async function deleteExpense(id) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('Expense removed 🗑️');
    } catch (err) {
      console.error('Error deleting expense:', err.message);
      toast.error('Failed to remove expense');
      throw err;
    }
  }

  return { expenses, loading, addExpense, deleteExpense };
}
