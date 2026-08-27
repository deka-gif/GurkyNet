/**
 * FR-CS-01 — attach after[channel]=id so SSE reconnect / poll skip already-seen events.
 */
export function applyRealtimeAfterCursor(
  params: URLSearchParams,
  after: Record<string, string>,
  channels: string[]
): void {
  for (const [ch, id] of Object.entries(after)) {
    if (id && channels.includes(ch)) {
      params.append(`after[${ch}]`, id);
    }
  }
}

/**
 * FR-CS-01 — reject replayed event ids (belt for reconnect when buffer still holds old ids).
 */
export function acceptRealtimeEventId(seen: Set<string>, id: string | null | undefined, max = 500): boolean {
  if (!id) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > max) {
    const first = seen.values().next().value as string | undefined;
    if (first) seen.delete(first);
  }
  return true;
}
