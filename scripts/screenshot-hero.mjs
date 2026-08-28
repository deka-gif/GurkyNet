/**
 * Capture Dashboard Home hero at 375/768/1440 — run: node scripts/screenshot-hero.mjs [before|after]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const phase = process.argv[2] || 'before';
const outDir = join(process.cwd(), 'scripts', 'screenshots', `hero-${phase}`);
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: '375px', width: 375, height: 812 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1440px', width: 1440, height: 900 },
];

const mockUser = {
  id: '1',
  name: 'Demo User GurkyNet',
  email: 'demo@gurkynet.test',
  role: 'User',
  isVerified: true,
  hasPin: true,
  avatar: '',
};

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1 });

for (const vp of viewports) {
  const page = await context.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ user, token }) => {
      localStorage.setItem('gurkynet_auth_token', token);
      localStorage.setItem('gurkynet_user_data', JSON.stringify(user));
    },
    { user: mockUser, token: 'screenshot-mock-token' }
  );

  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.dashboard-balance-card', { timeout: 15000 }).catch(() => {});

  const hero = page.locator('.dashboard-balance-card').first();
  const box = await hero.boundingBox();
  const cardHeight = box ? Math.round(box.height) : 0;

  const path = join(outDir, `dashboard-home-hero-${vp.name}.png`);
  if (box) {
    await hero.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage: false });
  }

  console.log(`${phase} ${vp.name}: hero height=${cardHeight}px -> ${path}`);
  await page.close();
}

await browser.close();
