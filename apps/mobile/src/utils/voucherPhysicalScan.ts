/**
 * Voucher Fisik scan/parse helpers — mirror of web `src/utils/voucherPhysicalScan.ts`
 * plus Mobile line-aware validation (dedup warnings without silent strip).
 */

export interface ScannedSerial {
  serial: string;
  scannedAt: string; // ISO 8601, client-supplied
}

export type SnEntry = {
  serial: string;
  /** 1-based line number in the raw textarea (newline-separated). */
  line: number;
};

/**
 * Expand a single token that may be a numeric suffix range (SN001-SN010).
 * Range width capped at `maxRange` (defaults to nasional limit ceiling).
 */
export function expandSnRangeToken(raw: string, maxRange = 200): string[] {
  const token = raw.trim();
  if (!token) return [];
  const rangeMatch = token.match(/^(.+?)(\d+)\s*[-–]\s*(.+?)(\d+)$/);
  if (rangeMatch) {
    const prefixA = rangeMatch[1];
    const start = parseInt(rangeMatch[2], 10);
    const prefixB = rangeMatch[3];
    const end = parseInt(rangeMatch[4], 10);
    if (
      prefixA === prefixB &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end >= start &&
      end - start <= maxRange
    ) {
      const width = rangeMatch[2].length;
      const out: string[] = [];
      for (let i = start; i <= end; i++) {
        out.push(`${prefixA}${String(i).padStart(width, '0')}`);
      }
      return out;
    }
  }
  return [token];
}

/** Legacy helper — comma/newline list or single range/token. */
export function expandSnRange(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  if (raw.includes(',') || raw.includes('\n')) {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((t) => expandSnRangeToken(t));
  }
  return expandSnRangeToken(raw);
}

/**
 * Parse raw SN textarea into ordered entries with line numbers.
 * - Newlines define baris (1-based).
 * - Commas within a line split multiple SN on that baris.
 * - Range tokens expand; all expanded values share the source line number.
 * Does NOT dedupe or truncate.
 */
export function parseSnEntries(raw: string, maxRange = 200): SnEntry[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const entries: SnEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    if (!line) continue;
    const tokens = line.includes(',')
      ? line
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [line];
    for (const token of tokens) {
      for (const serial of expandSnRangeToken(token, maxRange)) {
        entries.push({ serial, line: lineNo });
      }
    }
  }
  return entries;
}

export type SnDuplicateGroup = {
  serial: string;
  lines: number[];
};

export type SnInputValidation = {
  entries: SnEntry[];
  /** Unique serials in first-seen order (only meaningful when duplicates.length === 0). */
  uniqueSerials: string[];
  count: number;
  maxItems: number;
  overLimit: boolean;
  duplicates: SnDuplicateGroup[];
  /** Customer-facing duplicate messages (one per duplicate serial). */
  duplicateMessages: string[];
  empty: boolean;
  /** True when count > 0, no dups, not over limit. */
  ok: boolean;
};

function formatDuplicateMessage(serial: string, lines: number[]): string {
  const uniqLines = Array.from(new Set(lines)).sort((a, b) => a - b);
  if (uniqLines.length >= 2) {
    return `SN pada baris ${uniqLines[0]} dan baris ${uniqLines[1]} sama persis. Silakan periksa kembali.`;
  }
  // Same line appeared more than once (comma list / range collision on one line).
  return `SN pada baris ${uniqLines[0] ?? '?'} muncul lebih dari sekali. Silakan periksa kembali.`;
}

/**
 * Validate raw SN input without mutating or silently dropping duplicates.
 */
export function validateSnInput(raw: string, maxItems: number): SnInputValidation {
  const entries = parseSnEntries(raw);
  const count = entries.length;
  const empty = count === 0;
  const overLimit = count > maxItems;

  const lineMap = new Map<string, number[]>();
  for (const e of entries) {
    const prev = lineMap.get(e.serial);
    if (prev) prev.push(e.line);
    else lineMap.set(e.serial, [e.line]);
  }

  const duplicates: SnDuplicateGroup[] = [];
  const duplicateMessages: string[] = [];
  for (const [serial, lines] of lineMap) {
    if (lines.length > 1) {
      duplicates.push({ serial, lines: [...lines] });
      duplicateMessages.push(formatDuplicateMessage(serial, lines));
    }
  }

  const uniqueSerials: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.serial)) continue;
    seen.add(e.serial);
    uniqueSerials.push(e.serial);
  }

  const ok = !empty && !overLimit && duplicates.length === 0;

  return {
    entries,
    uniqueSerials,
    count,
    maxItems,
    overLimit,
    duplicates,
    duplicateMessages,
    empty,
    ok,
  };
}

export function toScannedSerials(
  serials: string[],
  nowIso: () => string = () => new Date().toISOString()
): ScannedSerial[] {
  return serials.map((serial) => ({ serial, scannedAt: nowIso() }));
}

// --- Legacy add-to-list helpers (camera / incremental path) — kept for parity ---

export type AddScanResult =
  | { ok: true; list: ScannedSerial[] }
  | { ok: false; reason: 'duplicate' | 'empty'; list: ScannedSerial[] };

export function addScannedSerial(
  list: ScannedSerial[],
  raw: string,
  nowIso: () => string = () => new Date().toISOString()
): AddScanResult {
  const serial = raw.trim();
  if (!serial) return { ok: false, reason: 'empty', list };
  if (list.some((s) => s.serial === serial)) return { ok: false, reason: 'duplicate', list };
  return { ok: true, list: [...list, { serial, scannedAt: nowIso() }] };
}

export function addScannedSerials(
  list: ScannedSerial[],
  serials: string[],
  nowIso: () => string = () => new Date().toISOString()
): { list: ScannedSerial[]; added: number; duplicates: number } {
  let next = list;
  let added = 0;
  let duplicates = 0;
  for (const raw of serials) {
    const result = addScannedSerial(next, raw, nowIso);
    if (result.ok === true) {
      next = result.list;
      added++;
      continue;
    }
    if (result.ok === false && result.reason === 'duplicate') duplicates++;
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

export function addCodesToScan(
  list: ScannedSerial[],
  codes: string[],
  maxItems: number,
  nowIso: () => string = () => new Date().toISOString()
): AddCodesToScanResult {
  const trimmed = codes.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return {
      list,
      added: 0,
      duplicates: 0,
      overflow: 0,
      atCapacity: list.length >= maxItems,
      noticeParts: [],
    };
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
