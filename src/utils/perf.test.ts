import assert from 'node:assert/strict';
import { debounce, throttle } from './perf.ts';

await new Promise<void>((resolve) => {
  let count = 0;
  const d = debounce(() => {
    count += 1;
  }, 50);
  d();
  d();
  d();
  setTimeout(() => {
    assert.equal(count, 1);
    resolve();
  }, 120);
});

await new Promise<void>((resolve) => {
  let count = 0;
  const t = throttle(() => {
    count += 1;
  }, 80);
  t();
  t();
  t();
  assert.equal(count, 1);
  setTimeout(() => {
    t();
    assert.ok(count >= 2);
    resolve();
  }, 100);
});

console.log('perf.test.ts OK');
