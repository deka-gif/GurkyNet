/**
 * Voucher Fisik (Metode 3) — scan/dedup/session-persistence helpers. Kept as pure
 * functions (mirrors topupPaymentFlow.ts) so the barcode-scan hot path — which must
 * never make a network call per scan — is unit-testable without mounting the page.
 */

export interface ScannedSerial {
  serial: string;
  scannedAt: string; // ISO 8601, client-supplied — scanning itself never hits the network
}

const PENDING_VOUCHER_PHYSICAL_SCAN_KEY = 'gn_pending_voucher_physical_scan';

/** Support: SN1,SN2 or SN1-SN2 (numeric suffix range, capped at 200) or newline list. */
export function expandSnRange(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  if (raw.includes(',') || raw.includes('\n')) {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const rangeMatch = raw.match(/^(.+?)(\d+)\s*[-–]\s*(.+?)(\d+)$/);
  if (rangeMatch) {
    const prefixA = rangeMatch[1];
    const start = parseInt(rangeMatch[2], 10);
    const prefixB = rangeMatch[3];
    const end = parseInt(rangeMatch[4], 10);
    if (prefixA === prefixB && Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 200) {
      const width = rangeMatch[2].length;
      const out: string[] = [];
      for (let i = start; i <= end; i++) {
        out.push(`${prefixA}${String(i).padStart(width, '0')}`);
      }
      return out;
    }
  }
  return [raw];
}

export type AddScanResult =
  | { ok: true; list: ScannedSerial[] }
  | { ok: false; reason: 'duplicate' | 'empty'; list: ScannedSerial[] };

/** Rejects blank input and exact duplicates already in the local list — never mutates `list`. */
export function addScannedSerial(list: ScannedSerial[], raw: string, nowIso: () => string = () => new Date().toISOString()): AddScanResult {
  const serial = raw.trim();
  if (!serial) {
    return { ok: false, reason: 'empty', list };
  }
  if (list.some((s) => s.serial === serial)) {
    return { ok: false, reason: 'duplicate', list };
  }
  return { ok: true, list: [...list, { serial, scannedAt: nowIso() }] };
}

/** Bulk variant for pasted/range input — dedupes against the existing list AND within the batch itself. */
export function addScannedSerials(
  list: ScannedSerial[],
  serials: string[],
  nowIso: () => string = () => new Date().toISOString()
): { list: ScannedSerial[]; added: number; duplicates: number } {
  let next = list;
  let added = 0;
  let duplicates = 0;
  for (const raw of serials) {
    const result: AddScanResult = addScannedSerial(next, raw, nowIso);
    if (result.ok === true) {
      next = result.list;
      added++;
      continue;
    }
    if (result.ok === false && result.reason === 'duplicate') {
      duplicates++;
    }
  }
  return { list: next, added, duplicates };
}

export type AddCodesToScanResult = {
  list: ScannedSerial[];
  added: number;
  duplicates: number;
  overflow: number;
  atCapacity: boolean;
  noticeParts: string[];
};

/** Shared add-to-batch path for manual paste/range and camera single-code input. */
export function addCodesToScan(
  list: ScannedSerial[],
  codes: string[],
  maxItems: number,
  nowIso: () => string = () => new Date().toISOString()
): AddCodesToScanResult {
  const trimmed = codes.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { list, added: 0, duplicates: 0, overflow: 0, atCapacity: list.length >= maxItems, noticeParts: [] };
  }

  const room = maxItems - list.length;
  if (room <= 0) {
    return {
      list,
      added: 0,
      duplicates: 0,
      overflow: trimmed.length,
      atCapacity: true,
      noticeParts: [`Batch sudah mencapai maksimal ${maxItems} SN.`],
    };
  }

  const overflow = Math.max(0, trimmed.length - room);
  const toAdd = trimmed.slice(0, room);
  const result = addScannedSerials(list, toAdd, nowIso);
  const parts: string[] = [];
  if (result.added > 0) parts.push(`${result.added} SN ditambahkan`);
  if (result.duplicates > 0) parts.push(`${result.duplicates} SN sudah pernah discan (dilewati)`);
  if (overflow > 0) parts.push(`${overflow} SN dilewati (melebihi maksimal ${maxItems})`);

  return {
    list: result.list,
    added: result.added,
    duplicates: result.duplicates,
    overflow,
    atCapacity: result.list.length >= maxItems,
    noticeParts: parts,
  };
}

export function removeScannedSerial(list: ScannedSerial[], serial: string): ScannedSerial[] {
  return list.filter((s) => s.serial !== serial);
}

export interface PendingVoucherPhysicalScan {
  zona: string | null;
  skuCode: string | null;
  list: ScannedSerial[];
}

/** Survives an accidental refresh before the batch is submitted — never a network write. */
export function savePendingScan(state: PendingVoucherPhysicalScan): void {
  try {
    sessionStorage.setItem(PENDING_VOUCHER_PHYSICAL_SCAN_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — scan list just won't survive a refresh.
  }
}

export function loadPendingScan(): PendingVoucherPhysicalScan | null {
  try {
    const raw = sessionStorage.getItem(PENDING_VOUCHER_PHYSICAL_SCAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.list)) return null;
    return {
      zona: typeof parsed.zona === 'string' ? parsed.zona : null,
      skuCode: typeof parsed.skuCode === 'string' ? parsed.skuCode : null,
      list: parsed.list,
    };
  } catch {
    return null;
  }
}

export function clearPendingScan(): void {
  try {
    sessionStorage.removeItem(PENDING_VOUCHER_PHYSICAL_SCAN_KEY);
  } catch {
    // ignore
  }
}
