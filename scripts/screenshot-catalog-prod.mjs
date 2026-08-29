/**
 * Production catalog screenshots (real domain + live API data).
 * Usage: node scripts/screenshot-catalog-prod.mjs [after]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const phase = process.argv[2] || 'after';
const baseUrl = 'https://gurkynet.my.id';
const outDir = join(process.cwd(), 'scripts', 'screenshots', `catalog-reverify-${phase}-prod`);
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, '_meta.json'), JSON.stringify({ phase, baseUrl, capturedAt: new Date().toISOString() }, null, 2));

const viewports = [
  { name: '375px', width: 375, height: 812 },
  { name: '1440px', width: 1440, height: 900 },
];

const mockUser = {
  id: '1',
  name: 'Verifikasi Owner',
  email: 'owner-verify@gurkynet.test',
  role: 'User',
  isVerified: true,
  hasPin: true,
};

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1, ignoreHTTPSErrors: true });

for (const vp of viewports) {
  for (const [path, file] of [
    ['/dashboard/telekomunikasi', 'service-hub-telekomunikasi'],
    ['/dashboard/topup-digital', 'provider-grid-topup-digital'],
    ['/dashboard/voucher-digital', 'provider-grid-voucher-digital'],
  ]) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ user, token }) => {
        localStorage.setItem('gurkynet_auth_token', token);
        localStorage.setItem('gurkynet_user_data', JSON.stringify(user));
      },
      { user: mockUser, token: 'prod-screenshot-mock' }
    );
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 90000 });

    if (path.includes('topup-digital')) {
      const text = await page.locator('body').innerText();
      const hasEwallet = /DANA|OVO|SHOPEE PAY|LinkAja/i.test(text);
      const empty = /Provider belum tersedia|Katalog kosong/i.test(text);
      console.log(`${phase} ${vp.name} topup ewallet=${hasEwallet} empty=${empty}`);
    }
    if (path.includes('voucher-digital')) {
      const text = await page.locator('body').innerText();
      const telcoVoucher = /Voucher Telkomsel 2\.5 GB/i.test(text);
      console.log(`${phase} ${vp.name} voucher telkomsel-kuota=${telcoVoucher}`);
    }

    const shotPath = join(outDir, `${file}-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`saved ${shotPath}`);
    await page.close();
  }
}

await browser.close();
