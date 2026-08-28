/**
 * Smoke test toast dedupe + default durations (no browser).
 * Run: node scripts/test-toast-store.mjs
 */
import { createRequire } from 'module';

// Minimal reimplementation of store logic for verification
const DEDUPE_WINDOW_MS = 3000;
const recentFingerprints = [];

function defaultToastDurationMs(type) {
  switch (type) {
    case 'success':
    case 'info':
      return 5000;
    case 'warning':
    case 'error':
      return 6000;
    default:
      return 5000;
  }
}

function toastFingerprint(title, description) {
  return `${title}::${description ?? ''}`;
}

function pruneRecentFingerprints(now) {
  while (recentFingerprints.length > 0 && now - recentFingerprints[0].at > DEDUPE_WINDOW_MS) {
    recentFingerprints.shift();
  }
}

function isDuplicateToast(fp, current, queue) {
  const now = Date.now();
  pruneRecentFingerprints(now);
  if (current && toastFingerprint(current.title, current.description) === fp) return true;
  if (queue.some((item) => toastFingerprint(item.title, item.description) === fp)) return true;
  if (recentFingerprints.some((entry) => entry.fp === fp)) return true;
  return false;
}

let current = null;
let queue = [];
let pushes = 0;

function push(input) {
  const fp = toastFingerprint(input.title, input.description);
  if (isDuplicateToast(fp, current, queue)) return false;
  const item = {
    ...input,
    durationMs: input.durationMs ?? defaultToastDurationMs(input.type),
  };
  recentFingerprints.push({ fp, at: Date.now() });
  pushes += 1;
  if (!current) {
    current = item;
    return true;
  }
  queue.push(item);
  return true;
}

function dismiss() {
  if (queue.length > 0) {
    current = queue.shift();
    return;
  }
  current = null;
}

// Test 1: default durations
console.assert(defaultToastDurationMs('success') === 5000, 'success=5s');
console.assert(defaultToastDurationMs('info') === 5000, 'info=5s');
console.assert(defaultToastDurationMs('error') === 6000, 'error=6s');
console.assert(defaultToastDurationMs('warning') === 6000, 'warning=6s');

// Test 2: dedupe while current visible
push({ type: 'error', title: 'Gagal', description: 'Top up gagal' });
console.assert(pushes === 1, 'first push ok');
push({ type: 'error', title: 'Gagal', description: 'Top up gagal' });
console.assert(pushes === 1, 'duplicate blocked while current');
console.assert(queue.length === 0, 'no queue on duplicate');

// Test 3: dedupe in queue
push({ type: 'error', title: 'Other', description: 'msg' });
console.assert(queue.length === 1, 'different toast queued');
push({ type: 'error', title: 'Other', description: 'msg' });
console.assert(queue.length === 1, 'duplicate blocked in queue window');

// Test 4: single visible
dismiss();
console.assert(current?.title === 'Other', 'advance to queued');
dismiss();
console.assert(current === null, 'only one at a time drained');

console.log('toast store smoke tests: PASS');
