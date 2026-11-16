// Menu photos (migration 022, docs/ticket-orders-menu-items.md commit 2): shrink on the phone, then upload.
//
// A phone photo is several MB and thousands of pixels across; the customer page shows it at under 700 px wide. So the
// longest side is capped at MAX_SIDE and it is re-encoded before it leaves her phone. WebP where the browser can
// encode it; Safari can't (canvas.toBlob silently hands back PNG), so there it falls back to JPEG. The bucket accepts
// only those two.
export const MENU_PHOTO_BUCKET = 'menu-photos';
export const MAX_SIDE = 1200;

/** The size to draw at: the longest side capped at `max`, the shape kept, never scaled UP. */
export function fitWithin(w: number, h: number, max: number = MAX_SIDE): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/** A photo's public address. Built as a string (the bucket is public) so nothing that only SHOWS a photo needs the
 *  storage client. */
export function menuPhotoUrl(path: string | null | undefined, base: string = import.meta.env.VITE_SUPABASE_URL ?? ''): string | null {
  if (!path) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${MENU_PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Where a new photo for an item goes: its own folder, a fresh name each time so a replaced photo is never cached. */
export function menuPhotoPath(itemId: string, type: string, now: number = Date.now()): string {
  return `${itemId}/${now}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

/** The picked photo, shrunk and re-encoded. createImageBitmap honours the camera's rotation in current browsers. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize the photo');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const webp = await toBlob(canvas, 'image/webp', 0.82);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!jpeg) throw new Error('This browser cannot resize the photo');
  return jpeg;
}
