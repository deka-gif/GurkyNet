/**
 * Screenshot game vs voucher-digital with mocked product API.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const baseUrl = process.env.BASE_URL || 'https://gurkynet.my.id';
const outDir = join(process.cwd(), 'scripts', 'screenshots', 'game-voucher-after');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route('**/api/v1/products**', async (route) => {
  const url = new URL(route.request().url());
  const category = url.searchParams.get('category') || '';
  const fixturePath = join(process.cwd(), 'scripts', 'fixtures', `products-${category || 'all'}.json`);
  let body;
  try {
    body = readFileSync(fixturePath, 'utf8');
  } catch {
    await route.continue();
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body });
});

await page.route('**/api/v1/wallet**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { balance: 250000, wallet_number: '104200000099' } }),
  });
});

await page.route('**/api/v1/**', async (route) => {
  if (route.request().url().includes('/products') || route.request().url().includes('/wallet')) return;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
});

await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('gurkynet_auth_token', 'prod-screenshot-mock');
  localStorage.setItem('gurkynet_user_data', JSON.stringify({ id: '1', name: 'User', role: 'User', hasPin: true }));
});

for (const [path, file, category] of [
  ['/dashboard/game', 'game-providers', 'game'],
  ['/dashboard/voucher-digital', 'voucher-digital-providers', 'voucher-digital'],
]) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);
  const text = await page.locator('body').innerText();
  const meta = {
    path,
    hasSteam: /steam wallet/i.test(text),
    hasAlfamart: /alfamart/i.test(text),
    hasMobileLegends: /mobile legends/i.test(text),
    hasFreeFire: /free fire/i.test(text),
    loading: /Memuat katalog/i.test(text),
  };
  writeFileSync(join(outDir, `${file}.meta.json`), JSON.stringify(meta, null, 2));
  await page.screenshot({ path: join(outDir, `${file}-1440px.png`), fullPage: false });
  console.log(file, meta);
}

await browser.close();
