import assert from 'node:assert/strict';
import {
  acceptRealtimeEventId,
  applyRealtimeAfterCursor,
} from './realtimeCursor.ts';

// FR-CS-01 — reconnect cursor must be attached to SSE/poll query.
const params = new URLSearchParams();
params.append('channels[]', 'chat.agents');
applyRealtimeAfterCursor(params, { 'chat.agents': 'evt-1', other: 'x' }, ['chat.agents']);
assert.equal(params.get('after[chat.agents]'), 'evt-1');
assert.equal(params.get('after[other]'), null);

// FR-CS-01 — duplicate event ids must be rejected (SSE reconnect replay belt).
const seen = new Set<string>();
assert.equal(acceptRealtimeEventId(seen, 'msg-a'), true);
assert.equal(acceptRealtimeEventId(seen, 'msg-a'), false);
assert.equal(acceptRealtimeEventId(seen, 'msg-b'), true);
assert.equal(acceptRealtimeEventId(seen, null), true);

console.log('RealtimeManager.after.test.ts OK');
