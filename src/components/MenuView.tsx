// The Menu tab: the dishes sis adds, edits and prices herself (migration 021). Aaron, 2026-11-16: *"this way she can
// add and edit items on her own without going through us"*, and *"a check box if she wants it to appear on the
// customer request page"*. Ticket: docs/ticket-orders-menu-items.md.
//
// • Lumpia and pancit are not here: they carry stock and cooking math and stay in the code.
// • A new item starts kitchen-only. The checkbox puts it on the customer page.
// • No delete. "Take off the menu" hides it from both forms, and every order that has it keeps its own copy.
import { useEffect, useRef, useState } from 'react';
import { Plus, Check, X, ChefHat, Eye, EyeOff, Camera } from 'lucide-react';
import type { MenuItem } from '../types';
import type { MenuItemDraft } from '../hooks/useMenuItems';
import { fmt } from '../lib/utils';
import { menuPhotoUrl } from '../lib/photo';

interface Props {
  menu: MenuItem[];
  loaded: boolean;
  onAdd: (draft: MenuItemDraft) => Promise<MenuItem | null>;
  onUpdate: (id: string, patch: Partial<Omit<MenuItem, 'id' | 'created_at'>>) => Promise<boolean>;
  /** Shrinks and uploads a photo for an item already saved (useMenuItems.uploadPhoto). */
  onPhoto: (item: MenuItem, file: File) => Promise<boolean>;
}

const INPUT = 'w-full border-2 border-stone-200 rounded-lg px-3 py-2 text-sm focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors';

export default function MenuView({ menu, loaded, onAdd, onUpdate, onPhoto }: Props) {
  // 'new' = the add sheet; an id = editing that item; null = just the list.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const onMenu = menu.filter(m => m.active);
  const retired = menu.filter(m => !m.active);

  return (
    <div className="max-w-2xl mx-auto px-6 py-4 space-y-5">
      <div className="flex justify-between items-center gap-3 pb-2 border-b border-white/20">
        <div>
          <h2 className="font-playfair text-2xl font-black text-white drop-shadow-sm">Menu 🍽️</h2>
          <p className="text-xs text-white/80 mt-0.5">Everything here can go on an order. Tick an item to offer it on the customer page too.</p>
        </div>
        {editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')}
            className="shrink-0 bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 text-sm active:scale-95">
            <Plus size={16} /> Add an item
          </button>
        )}
      </div>

      {editing === 'new' && (
        <ItemEditor
          title="New menu item"
          initial={{ name: '', price: 0, on_request_page: false }}
          onCancel={() => setEditing(null)}
          onSave={async (d, file) => {
            const added = await onAdd(d);
            if (!added) return;
            // The item exists now, so its photo has somewhere to go. A failed photo still leaves the item saved.
            if (file) await onPhoto(added, file);
            setEditing(null);
          }}
        />
      )}

      {!loaded ? <p className="text-sm text-white/80 text-center py-8">Loading the menu…</p>
        : onMenu.length === 0 && editing !== 'new' ? (
          <div className="flex flex-col items-center py-12 text-white/80">
            <ChefHat size={32} className="text-white/60 mb-3" />
            <p className="text-sm">Nothing on the menu yet. Add your first item.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {onMenu.map(item => editing === item.id ? (
              <li key={item.id}>
                <ItemEditor
                  title={`Editing ${item.name}`}
                  initial={item}
                  photoUrl={menuPhotoUrl(item.photo_path)}
                  onCancel={() => setEditing(null)}
                  onSave={async (d, file) => {
                    if (!(await onUpdate(item.id, d))) return;
                    if (file && !(await onPhoto(item, file))) return; // stay open: the toast said why
                    setEditing(null);
                  }}
                  onRetire={async () => { if (await onUpdate(item.id, { active: false })) setEditing(null); }}
                />
              </li>
            ) : (
              <li key={item.id}>
                <button type="button" onClick={() => setEditing(item.id)}
                  className="w-full bg-white border-2 border-stone-200 hover:border-orange-300 rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-colors">
                  <Thumb url={menuPhotoUrl(item.photo_path)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-800 truncate">{item.name}</div>
                    <div className="text-sm text-stone-500">{fmt(item.price)}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${item.on_request_page ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-500 border border-stone-200'}`}>
                    {item.on_request_page ? <><Eye size={12} /> Customer page</> : <><EyeOff size={12} /> Kitchen only</>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

      {retired.length > 0 && (
        <div className="pt-2">
          <button type="button" onClick={() => setShowRetired(v => !v)} className="text-sm font-semibold text-white/80 hover:text-white">
            {showRetired ? '▾' : '▸'} Off the menu ({retired.length})
          </button>
          {showRetired && (
            <ul className="mt-2 space-y-2">
              {retired.map(item => (
                <li key={item.id} className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-500 truncate">{item.name}</div>
                    <div className="text-xs text-stone-400">{fmt(item.price)}</div>
                  </div>
                  <button type="button" onClick={() => onUpdate(item.id, { active: true })}
                    className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700">
                    Put back on the menu
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** A photo, or a camera placeholder before there is one. */
function Thumb({ url, size = 'w-12 h-12' }: { url: string | null; size?: string }) {
  return url
    ? <img src={url} alt="" className={`${size} rounded-lg object-cover shrink-0 ring-1 ring-stone-200`} />
    : <span className={`${size} rounded-lg shrink-0 bg-stone-100 text-stone-300 flex items-center justify-center`}><Camera size={18} /></span>;
}

interface EditorProps {
  title: string;
  initial: MenuItemDraft;
  /** The saved photo, when editing an item that has one. */
  photoUrl?: string | null;
  /** `file` = a photo picked in this sheet, uploaded after the item saves. */
  onSave: (draft: MenuItemDraft, file: File | null) => Promise<void>;
  onCancel: () => void;
  /** Only when editing an item already on the menu. */
  onRetire?: () => Promise<void>;
}

function ItemEditor({ title, initial, photoUrl = null, onSave, onCancel, onRetire }: EditorProps) {
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(initial.price ? String(initial.price) : '');
  const [onRequestPage, setOnRequestPage] = useState(initial.on_request_page);
  const [saving, setSaving] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(f);
    setPreview(previewRef.current);
    setFile(f);
  };
  const priceNum = Number(price);
  const valid = name.trim().length > 0 && priceNum > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), price: Math.round(priceNum * 100) / 100, on_request_page: onRequestPage }, file); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white border-2 border-orange-300 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">{title}</div>
      <div className="flex gap-2">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Name</span>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Dish name" className={INPUT} />
        </label>
        <label className="relative w-28 shrink-0">
          <span className="sr-only">Price</span>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-400 pointer-events-none">$</span>
          <input type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className={`${INPUT} pl-6`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Thumb url={preview ?? photoUrl} size="w-16 h-16" />
        {/* No `capture`: the phone offers both the camera and the photo library. */}
        <label className="cursor-pointer text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1.5">
          <Camera size={16} /> {preview || photoUrl ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/*" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
        </label>
      </div>
      <button type="button" onClick={() => setOnRequestPage(v => !v)} aria-pressed={onRequestPage}
        className="flex items-center gap-2.5 text-sm text-stone-700">
        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${onRequestPage ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
          {onRequestPage && <Check size={12} className="text-white" />}
        </span>
        Show on the customer page
      </button>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={save} disabled={!valid || saving}
          className="bg-orange-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40 active:scale-95">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm font-semibold text-stone-500 hover:text-stone-700">Cancel</button>
        {onRetire && (
          confirmRetire ? (
            <span className="ml-auto flex items-center gap-1.5 text-sm">
              <span className="text-stone-500">Take it off?</span>
              <button type="button" onClick={onRetire} aria-label="Yes, take it off the menu" className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100"><Check size={14} /></button>
              <button type="button" onClick={() => setConfirmRetire(false)} aria-label="Keep it on the menu" className="p-1.5 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"><X size={14} /></button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmRetire(true)} className="ml-auto text-sm font-semibold text-red-500 hover:text-red-600">
              Take off the menu
            </button>
          )
        )}
      </div>
    </div>
  );
}
