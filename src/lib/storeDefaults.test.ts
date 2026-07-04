import { describe, it, expect } from 'vitest';
import { defaultCategoryForStore } from './storeDefaults';

describe('defaultCategoryForStore', () => {
  it('maps each known store to the category mom shops first there', () => {
    expect(defaultCategoryForStore('Superstore')).toBe('vegetables'); // veggies before meats
    expect(defaultCategoryForStore('Lucky')).toBe('wrappers');        // wrappers before veg
    expect(defaultCategoryForStore('Dollarama')).toBe('containers');
  });

  it('returns undefined for an unmapped or empty store, leaving the category untouched', () => {
    expect(defaultCategoryForStore('other')).toBeUndefined();
    expect(defaultCategoryForStore('')).toBeUndefined();
    expect(defaultCategoryForStore('Costco')).toBeUndefined();
  });
});
