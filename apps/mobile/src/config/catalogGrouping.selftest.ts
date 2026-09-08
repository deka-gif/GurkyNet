/**
 * Lightweight self-check for customer-facing catalog grouping.
 * Run: npx tsx src/config/catalogGrouping.selftest.ts
 */
import {
  CUSTOMER_FACING_SLUGS,
  groupCategoriesForCatalog,
  isHiddenRawCategorySlug,
} from './catalogGrouping';
import type { Category } from '../services/catalog.service';

let nextId = 1;
function cat(slug: string, name?: string): Category {
  return { id: nextId++, slug, name: name ?? slug, icon: null };
}

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  }
}

// Raw / legacy must be hidden
for (const raw of [
  'game-feature',
  'gamed',
  'saldo-emoney',
  'streaming-tv',
  'voucher-game',
  'pulsa-reguler',
  'paket-lainnya',
  'e-money',
  'unknown-orphan-xyz',
]) {
  assert(isHiddenRawCategorySlug(raw), `${raw} should be hidden`);
}

// Existing CF kept
for (const keep of [
  'pulsa',
  'data',
  'voucher-internet',
  'pln',
  'topup-digital',
  'game',
  'voucher-digital',
  'langganan-digital',
  'transfer',
]) {
  assert(CUSTOMER_FACING_SLUGS.has(keep), `${keep} must remain CF`);
  assert(!isHiddenRawCategorySlug(keep), `${keep} must not be hidden`);
}

assert(isHiddenRawCategorySlug('hp-pascabayar'), 'hp-pascabayar hidden on Mobile');

const sections = groupCategoriesForCatalog([
  cat('game-feature', 'Game Feature'),
  cat('gamed', 'Gamed'),
  cat('saldo-emoney', 'Saldo'),
  cat('streaming-tv', 'TV'),
  cat('voucher-game', 'VG'),
  cat('pulsa-reguler', 'Pulsa Reg'),
  cat('unknown-orphan-xyz', 'Orphan'),
  cat('topup-digital', 'E-Wallet'),
  cat('pln', 'Token PLN'),
  cat('voucher-digital', 'Voucher Digital'),
  cat('voucher-internet', 'Voucher Internet'),
  cat('game', 'Game'),
  cat('langganan-digital', 'Langganan Digital'),
  cat('transfer', 'Transfer'),
  cat('hp-pascabayar', 'HP Pascabayar'),
  cat('bpjs-kesehatan', 'BPJS Kesehatan'),
  cat('gas', 'Gas Negara'),
  cat('gas-prepaid', 'Gas Prepaid'),
]);

const allSlugs = sections.flatMap((s) => s.categories.map((c) => c.slug));
assert(!allSlugs.includes('game-feature'), 'raw game-feature not in groups');
assert(!allSlugs.includes('saldo-emoney'), 'raw saldo-emoney not in groups');
assert(!allSlugs.includes('unknown-orphan-xyz'), 'unknown not in groups');
assert(!allSlugs.includes('hp-pascabayar'), 'HP Pascabayar not in Mobile catalog');
assert(allSlugs.includes('topup-digital'), 'E-Wallet kept');
assert(allSlugs.includes('pln'), 'Token PLN kept');
assert(allSlugs.includes('voucher-digital'), 'Voucher Digital kept');
assert(allSlugs.includes('voucher-internet'), 'Voucher Internet kept');
assert(allSlugs.includes('game'), 'Game kept');
assert(allSlugs.includes('bpjs-kesehatan'), 'BPJS Kesehatan kept');
assert(allSlugs.includes('gas'), 'Gas Negara kept');
assert(allSlugs.includes('gas-prepaid'), 'Gas Prepaid kept');

const ewallet = sections.find((s) => s.id === 'topup-digital');
assert(ewallet?.title === 'E-Wallet', 'hub title E-Wallet');
assert(
  ewallet?.categories.every((c) => c.slug === 'topup-digital') ?? false,
  'E-Wallet only topup-digital'
);

const voucherHub = sections.find((s) => s.id === 'voucher');
assert(voucherHub?.title === 'Voucher Digital', 'hub Voucher Digital');
assert(
  !(voucherHub?.categories.some((c) => c.slug === 'voucher-internet') ?? true),
  'Voucher Internet not in Voucher Digital hub'
);

const telco = sections.find((s) => s.id === 'telco');
assert(
  telco?.categories.some((c) => c.slug === 'voucher-internet') ?? false,
  'Voucher Internet stays under Telekomunikasi'
);

const lainnya = sections.find((s) => s.id === 'lainnya');
assert(lainnya !== undefined, 'Lainnya has transfer');
assert(
  lainnya?.categories.every((c) => CUSTOMER_FACING_SLUGS.has(c.slug)) ?? false,
  'Lainnya only CF slugs'
);
assert(
  !(lainnya?.categories.some((c) => isHiddenRawCategorySlug(c.slug)) ?? true),
  'Lainnya has no raw'
);

if (failed > 0) {
  console.error(`catalogGrouping.selftest: ${failed} failure(s)`);
  process.exit(1);
}
console.log('catalogGrouping.selftest: OK');
