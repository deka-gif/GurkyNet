/**
 * Toast UX proof: fixed position + humanized error (mock API intercept).
 * Usage: node scripts/screenshot-ewallet-toast.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const baseUrl = 'https://gurkynet.my.id';
const outDir = join(process.cwd(), 'scripts', 'screenshots', 'ewallet-toast-after');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route('**/api/v1/ewallet/inquiry', async (route) => {
  await route.fulfill({
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message: 'Nomor HP tidak terdaftar di DANA.',
      errors: { inquiry: ['Nomor HP tidak terdaftar di DANA.'] },
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
  { user: mockUser, token: 'prod-screenshot-mock' }
);

await page.goto(`${baseUrl}/dashboard/topup-digital`, { waitUntil: 'networkidle', timeout: 90000 });

await page.getByRole('button', { name: /DANA/i }).first().click({ timeout: 20000 });
await page.locator('input[placeholder*="08"], input[type="tel"]').first().fill('081234567890');
await page.locator('button').filter({ hasText: /80\.?000|Rp\s*80/i }).first().click({ timeout: 10000 });
await page.getByRole('button', { name: /^NEXT$/i }).click({ timeout: 15000 });

await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(400);

const toastShot = join(outDir, 'toast-inquiry-error-scrolled-1440px.png');
await page.screenshot({ path: toastShot, fullPage: false });
console.log(`saved ${toastShot}`);

const bodyText = await page.locator('body').innerText();
console.log(`has-perhatian=${/Perhatian/i.test(bodyText)}`);
console.log(`has-humanized=${/Nomor HP tidak terdaftar/i.test(bodyText)}`);
console.log(`has-server-error=${/Server Error/i.test(bodyText)}`);

await browser.close();
