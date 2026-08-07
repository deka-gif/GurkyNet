import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /** Total visible duration in ms (default 15000). */
  durationMs: number;
  /** Opaque source id (e.g. backend notification id) for dedupe. */
  sourceId?: string;
}

interface ToastState {
  /** Currently visible toast (queue shows one at a time). */
  current: ToastItem | null;
  queue: ToastItem[];
  shownSourceIds: Set<string>;
  push: (input: Omit<ToastItem, 'id' | 'durationMs'> & { id?: string; durationMs?: number }) => void;
  dismiss: () => void;
  /** Advance to next queued toast after dismiss animation. */
  advance: () => void;
  clear: () => void;
  hasShownSource: (sourceId: string) => boolean;
  markSourceShown: (sourceId: string) => void;
}

const SESSION_KEY = 'gurkynet_toast_shown_ids';

function loadShownIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistShownIds(ids: Set<string>) {
  try {
    // Cap memory — keep recent 80 ids.
    const list = Array.from(ids).slice(-80);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(list));
  } catch {
    // ignore quota / private mode
  }
}

let seq = 0;
function nextId() {
  seq += 1;
  return `toast-${Date.now()}-${seq}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  queue: [],
  shownSourceIds: loadShownIds(),

  hasShownSource: (sourceId) => get().shownSourceIds.has(sourceId),

  markSourceShown: (sourceId) => {
    const next = new Set(get().shownSourceIds);
    next.add(sourceId);
    persistShownIds(next);
    set({ shownSourceIds: next });
  },

  push: (input) => {
    const sourceId = input.sourceId ? String(input.sourceId) : undefined;
    if (sourceId && get().shownSourceIds.has(sourceId)) {
      return;
    }
    if (sourceId) {
      get().markSourceShown(sourceId);
    }

    const item: ToastItem = {
      id: input.id || nextId(),
      type: input.type,
      title: input.title,
      description: input.description,
      durationMs: input.durationMs ?? 15_000,
      sourceId,
    };

    const { current, queue } = get();
    if (!current) {
      set({ current: item });
      return;
    }

    // No overlap — enqueue only.
    set({ queue: [...queue, item] });
  },

  dismiss: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next, queue: rest });
      return;
    }
    set({ current: null });
  },

  advance: () => {
    const { queue, current } = get();
    if (current) return;
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    set({ current: next, queue: rest });
  },

  clear: () => set({ current: null, queue: [] }),
}));
