import assert from 'node:assert/strict';
import {
  CacheTTL,
  cachedFetch,
  clearAllCache,
  getCached,
  invalidateCache,
  setCached,
} from './queryCache.ts';

clearAllCache();

// Fresh hit skips fetcher
{
  let calls = 0;
  setCached('t:a', { ok: 1 }, CacheTTL.BANNER);
  const data = await cachedFetch({
    key: 't:a',
    ttlMs: CacheTTL.BANNER,
    fetcher: async () => {
      calls += 1;
      return { ok: 2 };
    },
  });
  assert.deepEqual(data, { ok: 1 });
  assert.equal(calls, 0);
}

// Inflight dedupe
{
  clearAllCache();
  let calls = 0;
  const slow = () =>
    cachedFetch({
      key: 't:dedupe',
      ttlMs: 5000,
      fetcher: async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 40));
        return { n: calls };
      },
    });
  const [a, b] = await Promise.all([slow(), slow()]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
}

// Invalidate
{
  setCached('notifications:list', [1], 60_000);
  assert.ok(getCached('notifications:list'));
  invalidateCache('notifications');
  assert.equal(getCached('notifications:list'), null);
}

clearAllCache();
console.log('queryCache.test.ts OK');
