import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { localYMD } from '../lib/utils';
import type { BlockedDay } from '../types';

export function useBlockedDays() {
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);

  useEffect(() => {
    async function fetchBlockedDays() {
      try {
        const { data, error } = await supabase
          .from('blocked_days')
          .select('*')
          .order('date', { ascending: true });
        if (error) throw error;
        setBlockedDays((data as BlockedDay[]) || []);
      } catch (err) {
        console.error('Error fetching blocked days:', err.message);
      }
    }

    fetchBlockedDays();

    const subscription = supabase
      .channel('blocked_days_channel')
      // eslint-disable-next-line -- realtime payloads are dynamic DB rows
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_days' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setBlockedDays(prev =>
            prev.some(d => d.id === payload.new.id) ? prev : [...prev, payload.new].sort((a, b) => a.date.localeCompare(b.date))
          );
        } else if (payload.eventType === 'UPDATE') {
          setBlockedDays(prev => prev.map(d => d.id === payload.new.id ? payload.new : d));
        } else if (payload.eventType === 'DELETE') {
          setBlockedDays(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  async function blockDay(date: string, reason?: string) {
    try {
      const { data, error } = await supabase
        .from('blocked_days')
        .insert([{ date, reason: reason || null }])
        .select();
      if (error) throw error;
      setBlockedDays(prev =>
        [...prev, data[0] as BlockedDay].sort((a, b) => a.date.localeCompare(b.date))
      );
      toast.success('Day blocked 🔒');
    } catch (err) {
      console.error('Error blocking day:', err.message);
      toast.error('Failed to block day');
      throw err;
    }
  }

  async function blockRange(startDate: string, endDate: string, reason?: string) {
    const dates: { date: string; reason: string | null }[] = [];
    const d = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (d <= end) {
      dates.push({ date: localYMD(d), reason: reason || null });
      d.setDate(d.getDate() + 1);
    }
    if (dates.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('blocked_days')
        .upsert(dates, { onConflict: 'date' })
        .select();
      if (error) throw error;
      setBlockedDays(prev => {
        const incoming = (data as BlockedDay[]);
        const merged = [...prev.filter(d => !incoming.some(n => n.date === d.date)), ...incoming];
        return merged.sort((a, b) => a.date.localeCompare(b.date));
      });
      toast.success(`${dates.length} day${dates.length !== 1 ? 's' : ''} blocked 🔒`);
    } catch (err) {
      console.error('Error blocking range:', err.message);
      toast.error('Failed to block date range');
      throw err;
    }
  }

  async function unblockDay(date: string) {
    try {
      const { error } = await supabase.from('blocked_days').delete().eq('date', date);
      if (error) throw error;
      setBlockedDays(prev => prev.filter(d => d.date !== date));
      toast.success('Day unblocked ✓');
    } catch (err) {
      console.error('Error unblocking day:', err.message);
      toast.error('Failed to unblock day');
      throw err;
    }
  }

  const blockedSet = useMemo<ReadonlySet<string>>(
    () => new Set(blockedDays.map(d => d.date)),
    [blockedDays]
  );

  return { blockedDays, blockedSet, blockDay, blockRange, unblockDay };
}
