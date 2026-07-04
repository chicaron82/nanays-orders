import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  KITCHEN_BASE, geocodeUrl, routeUrl, driveMinutes, formatDriveEstimate,
  leaveByTime, deliveryBuffer, LEAVE_BUFFER_MIN, RUSH_BUFFER_MIN,
  geocode, driveMinutesBetween, estimateDriveMinutes,
  searchUrl, shortAddress, searchAddresses,
} from '../../src/lib/routing';

afterEach(() => vi.unstubAllGlobals());

// Helper: stub fetch to route by URL substring → the response bodies given.
function stubFetch(byUrl: (url: string) => { ok?: boolean; body?: unknown } | 'throw') {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const r = byUrl(url);
    if (r === 'throw') throw new Error('network');
    return { ok: r.ok ?? true, json: async () => r.body } as Response;
  }));
}

describe('routing — pure helpers', () => {
  it('geocodeUrl encodes the free-text address', () => {
    expect(geocodeUrl('629 Sherburn St, Winnipeg')).toBe(
      'https://nominatim-proxy.aaronsauddin.workers.dev/search?q=629%20Sherburn%20St%2C%20Winnipeg&format=json&limit=1'
    );
  });

  it('routeUrl orders coordinates as lon,lat;lon,lat', () => {
    expect(routeUrl(KITCHEN_BASE, { lat: 49.8816, lng: -97.1231 })).toBe(
      'https://routing.openstreetmap.de/routed-car/route/v1/driving/-97.1753295,49.8892483;-97.1231,49.8816?overview=false'
    );
  });

  it('driveMinutes applies the 0.85 correction and rounds (494s → 7 min)', () => {
    expect(driveMinutes(494)).toBe(7); // round(494*0.85/60) = round(6.998)
  });

  it('driveMinutes floors at 1 minute for tiny hops', () => {
    expect(driveMinutes(10)).toBe(1);
  });

  it('formatDriveEstimate renders the estimate, passes null through', () => {
    expect(formatDriveEstimate(7)).toBe('~7 min from the kitchen');
    expect(formatDriveEstimate(null)).toBeNull();
  });
});

describe('leaveByTime', () => {
  it('subtracts drive + default 15-min buffer from a 24h pickup time', () => {
    expect(leaveByTime('13:03', 4)).toBe('12:44 PM'); // 783 − 4 − 15 = 764 → 12:44
  });

  it('honours an explicit buffer (0 = arrive exactly at pickup minus drive)', () => {
    expect(leaveByTime('13:03', 4, 0)).toBe('12:59 PM');
    expect(leaveByTime('09:00', 30, 10)).toBe('8:20 AM');
  });

  it('formats midnight/noon boundaries as 12', () => {
    expect(leaveByTime('12:20', 10, 10)).toBe('12:00 PM');
    expect(leaveByTime('00:40', 10, 10)).toBe('12:20 AM');
  });

  it('returns null for unparseable or out-of-range times', () => {
    expect(leaveByTime('noon', 5)).toBeNull();
    expect(leaveByTime('25:00', 5)).toBeNull();
    expect(leaveByTime('10:75', 5)).toBeNull();
    expect(leaveByTime(null, 5)).toBeNull();
    expect(leaveByTime('', 5)).toBeNull();
  });

  it('returns null when drive + buffer would underflow before midnight', () => {
    expect(leaveByTime('00:10', 30, 10)).toBeNull();
  });
});

describe('deliveryBuffer', () => {
  // 2026-07-03 is a Friday → 07-04 Sat, 07-05 Sun, 07-06 Mon.
  it('uses the rush buffer for weekday AM and PM rush-hour pickups', () => {
    expect(deliveryBuffer('2026-07-06', '08:00')).toBe(RUSH_BUFFER_MIN); // Mon AM
    expect(deliveryBuffer('2026-07-06', '17:00')).toBe(RUSH_BUFFER_MIN); // Mon PM
  });

  it('uses the base buffer for weekday off-peak pickups', () => {
    expect(deliveryBuffer('2026-07-06', '12:00')).toBe(LEAVE_BUFFER_MIN);
    expect(deliveryBuffer('2026-07-06', '20:00')).toBe(LEAVE_BUFFER_MIN);
  });

  it('never counts weekends as rush, even inside the window', () => {
    expect(deliveryBuffer('2026-07-04', '17:00')).toBe(LEAVE_BUFFER_MIN); // Saturday
    expect(deliveryBuffer('2026-07-05', '08:00')).toBe(LEAVE_BUFFER_MIN); // Sunday
  });

  it('treats window edges as start-inclusive, end-exclusive', () => {
    expect(deliveryBuffer('2026-07-06', '15:30')).toBe(RUSH_BUFFER_MIN);
    expect(deliveryBuffer('2026-07-06', '15:29')).toBe(LEAVE_BUFFER_MIN);
    expect(deliveryBuffer('2026-07-06', '18:00')).toBe(LEAVE_BUFFER_MIN);
    expect(deliveryBuffer('2026-07-06', '09:00')).toBe(LEAVE_BUFFER_MIN);
  });

  it('falls back to the base buffer on unparseable date/time', () => {
    expect(deliveryBuffer('2026-07-06', 'noon')).toBe(LEAVE_BUFFER_MIN);
    expect(deliveryBuffer('not-a-date', '08:00')).toBe(LEAVE_BUFFER_MIN);
    expect(deliveryBuffer(null, null)).toBe(LEAVE_BUFFER_MIN);
  });
});

describe('routing — geocode (async, mocked fetch)', () => {
  it('parses the first Nominatim hit into coords', async () => {
    stubFetch(() => ({ body: [{ lat: '49.8816171', lon: '-97.1231495' }] }));
    expect(await geocode('123 Marion St')).toEqual({ lat: 49.8816171, lng: -97.1231495 });
  });

  it('returns null on empty results, non-ok, or a thrown fetch', async () => {
    stubFetch(() => ({ body: [] }));
    expect(await geocode('nowhere')).toBeNull();
    stubFetch(() => ({ ok: false, body: [] }));
    expect(await geocode('123 Marion St')).toBeNull();
    stubFetch(() => 'throw');
    expect(await geocode('123 Marion St')).toBeNull();
  });
});

describe('routing — driveMinutesBetween (async, mocked fetch)', () => {
  it('reads OSRM duration and corrects it (494s → 7 min)', async () => {
    stubFetch(() => ({ body: { routes: [{ duration: 494 }] } }));
    expect(await driveMinutesBetween(KITCHEN_BASE, { lat: 49.88, lng: -97.12 })).toBe(7);
  });

  it('returns null when OSRM has no route', async () => {
    stubFetch(() => ({ body: { routes: [] } }));
    expect(await driveMinutesBetween(KITCHEN_BASE, { lat: 49.88, lng: -97.12 })).toBeNull();
  });
});

describe('routing — estimateDriveMinutes (composed)', () => {
  it('geocodes then routes → corrected minutes', async () => {
    stubFetch(url =>
      url.includes('/search')
        ? { body: [{ lat: '49.8816', lon: '-97.1231' }] }
        : { body: { routes: [{ duration: 494 }] } }
    );
    expect(await estimateDriveMinutes('123 Marion St, Winnipeg')).toBe(7);
  });

  it('short-circuits to null when the address will not geocode', async () => {
    stubFetch(() => ({ body: [] }));
    expect(await estimateDriveMinutes('the blue house')).toBeNull();
  });
});

describe('address autocomplete', () => {
  it('searchUrl encodes the query and carries the limit', () => {
    expect(searchUrl('1577 Erin St', 5)).toBe(
      'https://nominatim-proxy.aaronsauddin.workers.dev/search?q=1577%20Erin%20St&format=json&limit=5'
    );
  });

  it('shortAddress trims a verbose display_name to "street, city"', () => {
    expect(shortAddress('629, Sherburn Street, Minto, West End, Winnipeg, Manitoba, R3E 0C7, Canada'))
      .toBe('629 Sherburn Street, Winnipeg');
    expect(shortAddress('123, Rue Marion Street, Central, Winnipeg, Manitoba, Canada'))
      .toBe('123 Rue Marion Street, Winnipeg');
  });

  it('shortAddress does not duplicate the city and survives odd input', () => {
    expect(shortAddress('Winnipeg, Manitoba, Canada')).toBe('Winnipeg');
    expect(shortAddress('Somewhere, Selkirk, Manitoba')).toBe('Somewhere');
    expect(shortAddress('Plain Text')).toBe('Plain Text');
  });

  it('searchAddresses maps hits and ignores short queries / failures', async () => {
    stubFetch(() => ({ body: [
      { display_name: '1577 Erin Street, Winnipeg', lat: '49.88', lon: '-97.17' },
      { display_name: 'bad', lat: 'x', lon: 'y' },
    ] }));
    expect(await searchAddresses('1577 Erin St')).toEqual([
      { label: '1577 Erin Street, Winnipeg', lat: 49.88, lng: -97.17 },
    ]);
    expect(await searchAddresses('ab')).toEqual([]); // too short — never fetches
    stubFetch(() => 'throw');
    expect(await searchAddresses('1577 Erin St')).toEqual([]);
  });
});
