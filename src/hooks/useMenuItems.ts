// The menu sis manages herself (migration 021, docs/ticket-orders-menu-items.md): load it, add to it, change it.
//
// The kitchen gets every row. The customer page runs as anon, and RLS hands it only the rows that are on the menu AND
// ticked for the customer page, so one hook serves both and the page still filters (lib/menu requestPageMenu).
//
// ⚠️ Realtime: none of nanays' tables are in the supabase_realtime publication (checked 2026-11-16: it lists no tables),
// so the subscription below is the repo's pattern, ready for when that's switched on. Until then each write puts the
// saved row into state itself, which is what keeps her own screen current.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { MenuItem } from '../types';
import { MENU_PHOTO_BUCKET, menuPhotoPath, shrinkPhoto } from '../lib/photo';

export type MenuItemDraft = Pick<MenuItem, 'name' | 'price' | 'on_request_page'>;

/** PostgREST can hand `numeric` back as a string; the money math wants a number. */
function normalize(row: MenuItem): MenuItem {
  return { ...row, price: Number(row.price) };
}

export function useMenuItems() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchMenu() {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .order('sort', { ascending: true })
          .order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setMenu(((data as MenuItem[]) || []).map(normalize));
      } catch (err) {
        console.error('Error fetching the menu:', err.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchMenu();

    const subscription = supabase
      .channel(`menu_items_channel_${Date.now()}`)
      // eslint-disable-next-line -- realtime payloads are dynamic DB rows
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setMenu(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, normalize(payload.new)]);
        } else if (payload.eventType === 'UPDATE') {
          setMenu(prev => prev.map(m => m.id === payload.new.id ? normalize(payload.new) : m));
        } else if (payload.eventType === 'DELETE') {
          setMenu(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(subscription); };
  }, []);

  /** A new item goes to the end of her list. Returns the saved row, or null when it didn't save. */
  async function addItem(draft: MenuItemDraft): Promise<MenuItem | null> {
    try {
      const sort = menu.reduce((n, m) => Math.max(n, m.sort), -1) + 1;
      const { data, error } = await supabase
        .from('menu_items')
        .insert([{ name: draft.name.trim(), price: draft.price, on_request_page: draft.on_request_page, sort }])
        .select();
      if (error) throw error;
      const row = normalize(data[0] as MenuItem);
      setMenu(prev => [...prev.filter(m => m.id !== row.id), row]);
      toast.success(`${row.name} added to the menu 🍽️`);
      return row;
    } catch (err) {
      console.error('Error adding a menu item:', err.message);
      toast.error("Couldn't add it to the menu");
      return null;
    }
  }

  /** Name, price, the customer-page tick, on/off the menu, the photo. Returns whether it saved. */
  async function updateItem(id: string, patch: Partial<Omit<MenuItem, 'id' | 'created_at'>>): Promise<boolean> {
    try {
      const clean = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
      const { data, error } = await supabase.from('menu_items').update(clean).eq('id', id).select();
      if (error) throw error;
      const row = normalize(data[0] as MenuItem);
      setMenu(prev => prev.map(m => m.id === id ? row : m));
      return true;
    } catch (err) {
      console.error('Error saving a menu item:', err.message);
      toast.error("Couldn't save that change");
      return false;
    }
  }

  /**
   * A new photo for an item (migration 022): shrunk on the phone, uploaded, pointed at, and only THEN the old one
   * removed, so a failure at any step leaves the item with a photo that exists. Returns whether it saved.
   */
  async function uploadPhoto(item: MenuItem, file: File): Promise<boolean> {
    try {
      const blob = await shrinkPhoto(file);
      const path = menuPhotoPath(item.id, blob.type);
      const { error } = await supabase.storage.from(MENU_PHOTO_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      const old = item.photo_path;
      if (!(await updateItem(item.id, { photo_path: path }))) {
        await supabase.storage.from(MENU_PHOTO_BUCKET).remove([path]);
        return false;
      }
      if (old) await supabase.storage.from(MENU_PHOTO_BUCKET).remove([old]); // a leftover file is harmless; no toast
      toast.success(`Photo saved for ${item.name} 📸`);
      return true;
    } catch (err) {
      console.error('Error uploading a menu photo:', err.message);
      toast.error("Couldn't save the photo");
      return false;
    }
  }

  return { menu, loaded, addItem, updateItem, uploadPhoto };
}
