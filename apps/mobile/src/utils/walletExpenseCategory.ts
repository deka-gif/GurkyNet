import { CATALOG_GROUPS, type CatalogGroupId } from '../config/catalogGrouping';
import { colors } from '../theme';
import type { WalletMutation } from '../services/wallet.service';
import { isCreditMovement } from './walletMovement';

/** Big expense buckets shown on Wallet Financial Tracker (mirrors catalog hubs). */
export type ExpenseCategoryId = CatalogGroupId | 'lainnya';

export type ExpenseCategorySlice = {
  id: ExpenseCategoryId;
  label: string;
  amount: number;
  /** Unique ledger debit rows in this category (not double-counted). */
  count: number;
  /** Share of total debit amount (0–100). */
  percent: number;
};

const GROUP_LABEL: Record<ExpenseCategoryId, string> = {
  telco: 'Telekomunikasi',
  tagihan: 'Tagihan',
  'topup-digital': 'E-Wallet',
  game: 'Game',
  voucher: 'Voucher Digital',
  langganan: 'Langganan',
  international: 'International',
  lainnya: 'Lainnya',
};

/** Stable category colors — same id always same color across Tracker & Analisis. */
export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategoryId, string> = {
  telco: colors.primary[600],
  tagihan: '#3B82F6',
  'topup-digital': colors.accent[500],
  game: '#8B5CF6',
  voucher: '#F97316',
  langganan: '#EC4899',
  international: '#38BDF8',
  lainnya: colors.gray[400],
};

const SLUG_ALIASES: Array<{ id: ExpenseCategoryId; patterns: RegExp[] }> = [
  {
    id: 'telco',
    patterns: [
      /\bpulsa\b/,
      /\bpaket\s*data\b/,
      /\bvoucher\s*internet\b/,
      /\bsms\b/,
      /\besim\b/,
      /\bmasa\s*aktif\b/,
      /\btelekomunikasi\b/,
    ],
  },
  {
    id: 'tagihan',
    patterns: [
      /\btagihan\b/,
      /\bpembayaran\s*tagihan\b/,
      /\bpln\b/,
      /\btoken\s*pln\b/,
      /\bpdam\b/,
      /\bbpjs\b/,
      /\bpbb\b/,
      /\bsamsat\b/,
      /\bgas\b/,
      /\bmultifinance\b/,
    ],
  },
  {
    id: 'topup-digital',
    patterns: [/\be-?wallet\b/, /\be-?money\b/, /\btop\s*up\s*digital\b/, /\btopup\s*digital\b/],
  },
  { id: 'game', patterns: [/\bgame\b/, /\bvoucher\s*game\b/] },
  {
    id: 'voucher',
    patterns: [/\bvoucher\s*digital\b/, /\bvoucher\b(?!\s*internet)/],
  },
  {
    id: 'langganan',
    patterns: [/\blangganan\b/, /\bstreaming\b/, /\bnetflix\b/, /\bspotify\b/, /\bvidio\b/],
  },
  { id: 'international', patterns: [/\binternational\b/, /\binternasional\b/] },
];

function haystack(row: Pick<WalletMutation, 'service_name' | 'description'>): string {
  return `${row.service_name || ''} ${row.description || ''}`.toLowerCase();
}

/**
 * Map a debit ledger row to a catalog hub category.
 * Prefers Transaction.service_name (category + provider), falls back to description keywords.
 */
export function resolveExpenseCategoryId(
  row: Pick<WalletMutation, 'service_name' | 'description' | 'type' | 'direction'>
): ExpenseCategoryId {
  const text = haystack(row);

  if (
    text.includes('transfer') ||
    text.includes('withdraw') ||
    text.includes('tarik dana') ||
    text.includes('penyesuaian') ||
    text.includes('adjustment')
  ) {
    return 'lainnya';
  }

  for (const group of CATALOG_GROUPS) {
    const title = group.title.toLowerCase();
    if (text.includes(title)) return group.id;

    for (const slug of group.slugOrder) {
      const spaced = slug.replace(/-/g, ' ');
      if (text.includes(spaced) || text.includes(slug)) {
        return group.id;
      }
    }
  }

  for (const alias of SLUG_ALIASES) {
    if (alias.patterns.some((re) => re.test(text))) return alias.id;
  }

  return 'lainnya';
}

export function expenseCategoryLabel(id: ExpenseCategoryId): string {
  return GROUP_LABEL[id] || 'Lainnya';
}

export function expenseCategoryColor(id: ExpenseCategoryId): string {
  return EXPENSE_CATEGORY_COLORS[id] || EXPENSE_CATEGORY_COLORS.lainnya;
}

const CATEGORY_ORDER: ExpenseCategoryId[] = [
  'telco',
  'tagihan',
  'topup-digital',
  'game',
  'voucher',
  'langganan',
  'international',
  'lainnya',
];

/**
 * Aggregate debit amounts + unique ledger-row counts into big categories.
 * Each wallet_histories row counted once (by ledger id). Credits ignored.
 */
export function aggregateExpenseByCategory(rows: WalletMutation[]): ExpenseCategorySlice[] {
  const totals = new Map<ExpenseCategoryId, number>();
  const counts = new Map<ExpenseCategoryId, Set<string>>();

  for (const row of rows) {
    if (isCreditMovement(row)) continue;
    const id = resolveExpenseCategoryId(row);
    const amt = Math.abs(Number(row.amount) || 0);
    if (amt <= 0) continue;
    totals.set(id, (totals.get(id) || 0) + amt);
    const set = counts.get(id) || new Set<string>();
    set.add(String(row.id));
    counts.set(id, set);
  }

  const totalAmount = Array.from(totals.values()).reduce((s, n) => s + n, 0);

  return CATEGORY_ORDER
    .filter((id) => (totals.get(id) || 0) > 0)
    .map((id) => {
      const amount = totals.get(id) || 0;
      return {
        id,
        label: expenseCategoryLabel(id),
        amount,
        count: counts.get(id)?.size || 0,
        percent: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function topExpenseCategory(slices: ExpenseCategorySlice[]): ExpenseCategorySlice | null {
  if (slices.length === 0) return null;
  return slices[0];
}

export function currentMonthBounds(): {
  startDate: string;
  endDate: string;
  label: string;
  /** Canonical period key shared by Tracker + Analisis, e.g. "2026-09". */
  monthKey: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  const startDate = `${monthKey}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const endDate = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  const label = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return { startDate, endDate, label, monthKey };
}
