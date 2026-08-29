/**
 * Wallet vs Top Up Saldo remount fix + E-Wallet label screenshots.
 * Usage: node scripts/screenshot-wallet-remount.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const baseUrl = process.env.BASE_URL || 'https://gurkynet.my.id';
const outDir = join(process.cwd(), 'scripts', 'screenshots', 'wallet-remount-after');
mkdirSync(outDir, { recursive: true });

const mockUser = {
  id: '1',
  name: 'Verifikasi Owner',
  email: 'owner-verify@gurkynet.test',
  role: 'User',
  isVerified: true,
  hasPin: true,
};

const mockWallet = {
  success: true,
  data: {
    id: 1,
    wallet_number: '104200000099',
    walletNo: '104200000099',
    balance: 250000,
    status: 'active',
    summary: {
      income_this_month: 150000,
      expense_this_month: 50000,
      mutation_count: 3,
    },
    history: [],
  },
};

const mockHistory = {
  success: true,
  data: {
    data: [],
    current_page: 1,
    last_page: 1,
  },
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route('**/api/v1/**', async (route) => {
  const url = route.request().url();
  if (url.includes('/wallet/history')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockHistory) });
    return;
  }
  if (url.includes('/wallet')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWallet) });
    return;
  }
  if (url.includes('/products')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 1, code: 'VIP-DANA80', name: 'DANA Rp 80.000', price: 81850, operatorName: 'DANA', category: 'topup-digital', status: true, ops_status: 'active' },
        ],
      }),
    });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
});

async function seedAuth() {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ user, token }) => {
      localStorage.setItem('gurkynet_auth_token', token);
      localStorage.setItem('gurkynet_user_data', JSON.stringify(user));
    },
    { user: mockUser, token: 'prod-screenshot-mock' }
  );
}

async function nav(path) {
  await seedAuth();
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);
}

function tabState(bodyText) {
  return {
    ringkasan: /Pemasukan Bulan Ini|Riwayat Mutasi Saldo/i.test(bodyText),
    isiSaldo: /Top Up Saldo GurkyPay/i.test(bodyText),
    topUpDigital: /Top Up Digital/i.test(bodyText),
    eWalletTitle: /\bE-Wallet\b/i.test(bodyText),
  };
}

const log = [];

await seedAuth();

// 1. /dashboard/wallet → Ringkasan
await page.goto(`${baseUrl}/dashboard/wallet`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1000);
let text = await page.locator('body').innerText();
let state = tabState(text);
log.push({ step: '1-wallet-direct', ...state, url: page.url() });
await page.screenshot({ path: join(outDir, '01-wallet-ringkasan-1440px.png') });
console.log('1-wallet ringkasan=', state);

// 2. Sidebar Top Up Saldo → Isi Saldo
await nav('/dashboard/topup');
text = await page.locator('body').innerText();
state = tabState(text);
log.push({ step: '2-topup-saldo', ...state, url: page.url() });
await page.screenshot({ path: join(outDir, '02-topup-isi-saldo-1440px.png') });
console.log('2-topup isi saldo=', state);

// 3. Sidebar Wallet → Ringkasan again (remount proof)
await nav('/dashboard/wallet');
text = await page.locator('body').innerText();
state = tabState(text);
log.push({ step: '3-wallet-again', ...state, url: page.url() });
await page.screenshot({ path: join(outDir, '03-wallet-back-ringkasan-1440px.png') });
console.log('3-wallet again ringkasan=', state);

// 4. Sidebar labels
const sidebarText = await page.locator('aside').innerText();
log.push({
  step: '4-sidebar-labels',
  hasTopUpSaldo: /Top Up Saldo/i.test(sidebarText),
  hasEWallet: /E-Wallet/i.test(sidebarText),
  hasTopUpDigital: /Top Up Digital/i.test(sidebarText),
});
await page.screenshot({ path: join(outDir, '04-sidebar-ewallet-label-1440px.png') });
console.log('4-sidebar', log.at(-1));

// 5. E-Wallet catalog page
await nav('/dashboard/topup-digital');
text = await page.locator('body').innerText();
log.push({
  step: '5-ewallet-page',
  ...tabState(text),
  hasDana: /DANA/i.test(text),
  url: page.url(),
});
await page.screenshot({ path: join(outDir, '05-ewallet-catalog-1440px.png') });
console.log('5-ewallet page', log.at(-1));

writeFileSync(join(outDir, '_results.json'), JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), log }, null, 2));
console.log(`Results: ${join(outDir, '_results.json')}`);

await browser.close();
