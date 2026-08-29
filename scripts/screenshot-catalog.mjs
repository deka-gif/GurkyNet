/**
 * Catalog visual evidence — correct order: BEFORE (old UI) then AFTER (new UI).
 *
 * Usage:
 *   node scripts/screenshot-catalog.mjs before  # old committed UI + prod API
 *   node scripts/screenshot-catalog.mjs after   # new UI + prod API
 *
 * Env:
 *   PREVIEW_URL  — default http://127.0.0.1:4173
 *   API_BASE     — baked into build via VITE_API_BASE_URL
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const phase = process.argv[2];
if (phase !== 'before' && phase !== 'after') {
  console.error('Usage: node scripts/screenshot-catalog.mjs before|after');
  process.exit(1);
}

const previewUrl = (process.env.PREVIEW_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const outDir = join(process.cwd(), 'scripts', 'screenshots', `catalog-reverify-${phase}`);
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: '375px', width: 375, height: 812 },
  { name: '1440px', width: 1440, height: 900 },
];

const pages = [
  { path: '/dashboard/telekomunikasi', file: 'service-hub-telekomunikasi', wait: '.dashboard-panel, .grid' },
  { path: '/dashboard/topup-digital', file: 'provider-grid-topup-digital', wait: 'button:has-text("DANA"), button:has-text("OVO"), button:has-text("SHOPEE"), text=Provider belum tersedia' },
];

const meta = { phase, previewUrl, capturedAt: new Date().toISOString() };
writeFileSync(join(outDir, '_meta.json'), JSON.stringify(meta, null, 2));

const mockUser = {
  id: '1',
  name: 'Verifikasi Owner',
  email: 'verify@gurkynet.test',
  role: 'User',
  isVerified: true,
  hasPin: true,
};

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1 });

for (const vp of viewports) {
  for (const pg of pages) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto(`${previewUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ user, token }) => {
        localStorage.setItem('gurkynet_auth_token', token);
        localStorage.setItem('gurkynet_user_data', JSON.stringify(user));
      },
      { user: mockUser, token: 'screenshot-local-mock' }
    );

    await page.goto(`${previewUrl}${pg.path}`, { waitUntil: 'networkidle', timeout: 60000 });

    if (pg.path.includes('topup-digital')) {
      try {
        await page.waitForSelector('button:has-text("DANA"), button:has-text("OVO"), button:has-text("SHOPEE")', {
          timeout: 20000,
        });
        const providers = await page.locator('button[type="button"]').allTextContents();
        const hits = providers.filter((t) => /DANA|OVO|SHOPEE|LinkAja/i.test(t));
        console.log(`${phase} ${vp.name} topup providers visible: ${hits.slice(0, 6).join(' | ') || 'NONE'}`);
      } catch {
        const empty = await page.locator('text=Provider belum tersedia').count();
        console.warn(`${phase} ${vp.name} topup: empty state=${empty > 0}`);
      }
    }

    const shotPath = join(outDir, `${pg.file}-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`${phase} saved ${shotPath}`);
    await page.close();
  }
}

await browser.close();
