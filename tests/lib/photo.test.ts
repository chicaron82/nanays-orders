import { describe, it, expect } from 'vitest';
import { fitWithin, menuPhotoUrl, menuPhotoPath } from '../../src/lib/photo';

describe('fitWithin', () => {
  it('caps a landscape phone photo at the longest side, keeping its shape', () => {
    expect(fitWithin(4032, 3024, 1200)).toEqual({ w: 1200, h: 900 });
  });
  it('caps a portrait one the same way', () => {
    expect(fitWithin(3024, 4032, 1200)).toEqual({ w: 900, h: 1200 });
  });
  it('never scales a small photo up', () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ w: 800, h: 600 });
  });
  it('a broken size draws nothing', () => {
    expect(fitWithin(0, 600)).toEqual({ w: 0, h: 0 });
  });
});

describe('menuPhotoUrl', () => {
  it('is the public object address in the menu-photos bucket', () => {
    expect(menuPhotoUrl('abc/1.webp', 'https://x.supabase.co/'))
      .toBe('https://x.supabase.co/storage/v1/object/public/menu-photos/abc/1.webp');
  });
  it('no photo yet is null', () => {
    expect(menuPhotoUrl(null, 'https://x.supabase.co')).toBeNull();
  });
});

describe('menuPhotoPath', () => {
  it('sits in the item\'s folder, named by time, with the right extension', () => {
    expect(menuPhotoPath('f', 'image/webp', 5)).toBe('f/5.webp');
    expect(menuPhotoPath('f', 'image/jpeg', 5)).toBe('f/5.jpg');
  });
});
