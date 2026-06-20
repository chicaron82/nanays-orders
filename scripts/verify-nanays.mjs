// DiZee's authed-verify helper for Nanay's Orders. Logs in as the verify bot
// (creds from .env.local — VERIFY_EMAIL / VERIFY_PASSWORD), caches the session
// in .verify/ (gitignored), and screenshots a screen so visual/flow changes can
// be eyeballed before they reach sis's phone.
//
// READ/RENDER ONLY. Nanay's runs on real Supabase with real customer orders, and
// the RLS is trusted-crew allow-all — so the bot *could* write, which means it
// MUST NOT. Use clickText only to navigate and open views (e.g. open the order
// form, switch tabs). NEVER click Save / Submit / Add / Delete — opening a modal
// is render; submitting it is a real write to a real order.
//
// Viewport defaults to mobile portrait (390×844) because Nanay's is portrait-
// first (see manifest) — that's how the kitchen actually uses it, so the shot
// should match. Override with VIEWPORT=desktop for a wide capture.
//
//   node scripts/verify-nanays.mjs [path] [name] [clickText]
//   e.g. node scripts/verify-nanays.mjs / orders
//        node scripts/verify-nanays.mjs / new-order "New Order"
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const env = Object.fromEntries(
  readFileSync(new URL('.env.local', root), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const EMAIL = env.VERIFY_EMAIL;
const PW = env.VERIFY_PASSWORD;
if (!EMAIL || !PW) {
  console.error('Missing VERIFY_EMAIL / VERIFY_PASSWORD in .env.local.');
  console.error('Setup: create a verify-bot account in Nanay\'s Supabase, then add both keys to .env.local.');
  process.exit(1);
}

const verifyDir = fileURLToPath(new URL('.verify/', root));
const statePath = fileURLToPath(new URL('.verify/state.json', root));
mkdirSync(verifyDir, { recursive: true });

const path = process.argv[2] || '/';
const name = process.argv[3] || 'shot';
const clickText = process.argv[4];
const shot = `${verifyDir}${name}.png`;

// Nanay's has no strictPort, so Vite auto-bumps when another project holds the
// port — probe a small range and confirm by <title> rather than assuming one.
async function findPort() {
  for (const port of [5173, 5174, 5175, 5176, 5177]) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      const html = await res.text();
      if (html.includes('Nanay')) return port;
    } catch {
      // not listening on this port — try the next one
    }
  }
  throw new Error('Nanay\'s dev server not found on :5173-:5177 — is `npm run dev` running?');
}

const port = await findPort();
const BASE = `http://localhost:${port}`;
console.log('Found Nanay\'s on', BASE);

const viewport = process.env.VIEWPORT === 'desktop'
  ? { width: 1280, height: 900 }
  : { width: 390, height: 844 };

const fresh = existsSync(statePath) && (Date.now() - statSync(statePath).mtimeMs < 30 * 60 * 1000);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport,
  deviceScaleFactor: 2,
  ...(fresh ? { storageState: statePath } : {}),
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
if (await page.locator('input[type=password]').count()) {
  await page.locator('input[type=email]').first().fill(EMAIL);
  await page.locator('input[type=password]').fill(PW);
  await page.locator('button[type=submit]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await ctx.storageState({ path: statePath });
  console.log('LOGGED_IN as', EMAIL);
}

await page.goto(BASE + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
if (clickText) {
  await page.getByText(clickText, { exact: false }).first().click();
  await page.waitForTimeout(900);
}
await page.screenshot({ path: shot, fullPage: true });
console.log('SHOT', shot);
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
