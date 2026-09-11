/**
 * Pure helpers for Cek Wilayah Kartu FAQ lookup/parse (no RN / API).
 * Titles must stay in sync with laravel/app/Support/CekWilayahKartuFaq.php
 * (prefix uses U+2014 EM DASH).
 */

export type HelpFaqItem = {
  id: number;
  question: string;
  answer: string;
};

export const CEK_WILAYAH_FAQ_PREFIX = 'Cek Wilayah Kartu — ';

export function isCekWilayahFaq(item: HelpFaqItem): boolean {
  return item.question.startsWith(CEK_WILAYAH_FAQ_PREFIX);
}

/** FAQ shown in Help "Pertanyaan umum" — excludes Cek Wilayah Kartu articles. */
export function customerFacingFaqs(items: HelpFaqItem[]): HelpFaqItem[] {
  return items.filter((f) => !isCekWilayahFaq(f));
}

export function cekWilayahFaqTitle(providerLabel: string): string {
  return `${CEK_WILAYAH_FAQ_PREFIX}${providerLabel}`;
}

export function findCekWilayahFaq(
  items: HelpFaqItem[],
  providerSlug: string
): HelpFaqItem | null {
  const labels: Record<string, string> = {
    telkomsel: 'Telkomsel',
    indosat: 'Indosat',
    tri: 'Tri',
    axis: 'Axis',
    xl: 'XL',
    smartfren: 'Smartfren',
  };
  const title = cekWilayahFaqTitle(labels[providerSlug] || providerSlug);
  return items.find((f) => f.question === title) || null;
}

/** Parse numbered steps + trailing note from FAQ answer text. */
export function parseCekWilayahAnswer(answer: string): {
  steps: string[];
  note: string | null;
} {
  const lines = String(answer || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const steps: string[] = [];
  const notes: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+[\.\)]\s*(.+)$/);
    if (m) {
      steps.push(m[1].trim());
      continue;
    }
    notes.push(line.replace(/^Alternatif:\s*/i, '').trim());
  }
  return {
    steps,
    note: notes.length ? notes.join(' ') : null,
  };
}
