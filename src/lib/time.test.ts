import { describe, it, expect } from 'vitest';
import { formatTime12 } from './utils';

describe('formatTime12', () => {
  it('converts an afternoon pickup the way a customer reads it', () => {
    expect(formatTime12('14:30')).toBe('2:30 PM');
    expect(formatTime12('17:00')).toBe('5:00 PM');
  });

  it('leaves morning times alone but labels them', () => {
    expect(formatTime12('09:15')).toBe('9:15 AM');
    expect(formatTime12('9:15')).toBe('9:15 AM');
  });

  it('⭐ NOON is 12 PM, not 0 PM and not 12 AM', () => {
    // The classic modulo bug. On a page where the customer reads their own pickup time,
    // being twelve hours out is the worst possible failure.
    expect(formatTime12('12:00')).toBe('12:00 PM');
    expect(formatTime12('12:45')).toBe('12:45 PM');
  });

  it('⭐ MIDNIGHT is 12 AM, not 0 AM', () => {
    expect(formatTime12('00:00')).toBe('12:00 AM');
    expect(formatTime12('00:15')).toBe('12:15 AM');
  });

  it('keeps the leading zero on minutes', () => {
    expect(formatTime12('13:05')).toBe('1:05 PM');
  });

  it('⭐ returns junk AS-IS rather than blanking it', () => {
    // A weird stored value should look weird to whoever can fix it, not silently disappear
    // from an order the family is cooking against.
    expect(formatTime12('whenever')).toBe('whenever');
    expect(formatTime12('25:00')).toBe('25:00');
    expect(formatTime12('12:75')).toBe('12:75');
  });

  it('renders nothing for an absent time', () => {
    expect(formatTime12('')).toBe('');
    expect(formatTime12(null)).toBe('');
    expect(formatTime12(undefined)).toBe('');
  });
});
