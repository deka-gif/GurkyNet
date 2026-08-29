/**
 * Proof: /dashboard/topup-digital page heading shows "E-Wallet".
 * Usage: node scripts/screenshot-ewallet-title.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const baseUrl = process.argv[2] ?? 'http://localhost:4173';
const outDir = join(process.cwd(), 'scripts', 'screenshots', 'ewallet-title-after');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route('**/api/v1/products**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: [
        {
          code: 'DANA50',
          name: 'DANA Rp 50.000',
          brand: 'DANA',
          category: 'topup-digital',
          price: 50500,
          status: true,
        },
      ],
    }),
  });
});

const mockUser = {
  id: '1',
  name: 'Verifikasi Owner',
  email: 'owner-verify@gurkynet.test',
  role: 'User',
  isVerified: true,
  hasPin: true,
};

await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ user, token }) => {
    localStorage.setItem('gurkynet_auth_token', token);
    localStorage.setItem('gurkynet_user_data', JSON.stringify(user));
  },
  { user: mockUser, token: 'screenshot-mock-token' }
);

await page.goto(`${baseUrl}/dashboard/topup-digital`, {
  waitUntil: 'networkidle',
  timeout: 90000,
});

await page.waitForTimeout(1500);

const heading = page.locator('h1, h2').filter({ hasText: /E-Wallet|Top Up Digital/i }).first();
await heading.waitFor({ state: 'visible', timeout: 15000 });

const titleText = (await heading.innerText()).trim();
const shot = join(outDir, '01-topup-digital-title-1440px.png');
await page.screenshot({ path: shot, fullPage: false });

console.log(JSON.stringify({ titleText, shot, hasEwallet: /E-Wallet/i.test(titleText), hasOldLabel: /Top Up Digital/i.test(titleText) }, null, 2));

await browser.close();
