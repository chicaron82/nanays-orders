import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  KITCHEN_BASE, geocodeUrl, routeUrl, driveMinutes, formatDriveEstimate,
  geocode, driveMinutesBetween, estimateDriveMinutes,
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
