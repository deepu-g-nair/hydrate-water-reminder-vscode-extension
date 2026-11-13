import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FOCUS_BEAT_MS, FOCUS_STALE_MS, SharedBus } from '../shared';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-bus-'));
/** Two "windows" sharing one folder and one controllable clock. */
const pair = () => {
  const dir = tmp();
  const clock = { t: Date.now() };
  const now = () => clock.t;
  return { dir, clock, a: new SharedBus(dir, 'window-a', now), b: new SharedBus(dir, 'window-b', now) };
};

test('an event posted in one window reaches the other exactly once', () => {
  const { a, b, clock } = pair();
  clock.t += 1000;
  a.post('ack');
  assert.equal(b.poll().ack, clock.t);
  assert.deepEqual(b.poll(), {});
});

test('a window never receives its own events', () => {
  const { a } = pair();
  a.post('pause');
  a.post('reset');
  assert.deepEqual(a.poll(), {});
});

test('events from before a window opened are ignored', () => {
  const { dir, a, clock } = pair();
  a.post('pause');
  const late = new SharedBus(dir, 'window-c', () => clock.t);
  assert.deepEqual(late.poll(), {});
  clock.t += 5;
  a.post('resume');
  assert.ok(late.poll().resume);
});

test('different events do not overwrite each other', () => {
  const { a, b } = pair();
  a.post('ack');
  a.post('reset');
  const news = b.poll();
  assert.ok(news.ack && news.reset);
  assert.equal(news.pause, undefined);
});

test('two posts at the same instant are still both seen as new', () => {
  const { a, b } = pair();
  a.post('ack');
  assert.ok(b.poll().ack);
  a.post('ack'); // same clock value
  assert.ok(b.poll().ack);
});

test('focus: any window can tell whether the user is in VS Code', () => {
  const { a, b } = pair();
  assert.equal(b.anyWindowFocused(), false);
  a.setFocused(true);
  assert.equal(b.anyWindowFocused(), true);
  assert.equal(a.anyWindowFocused(), true);
  a.setFocused(false);
  assert.equal(b.anyWindowFocused(), false);
});

test('focus: switching windows in either event order ends with the new window focused', () => {
  const { a, b } = pair();
  a.setFocused(true);
  b.setFocused(true);  // B's focus event arrives first...
  a.setFocused(false); // ...then A's blur: must not wipe B's claim
  assert.equal(a.anyWindowFocused(), true);
  b.setFocused(false);
  assert.equal(a.anyWindowFocused(), false);
});

test('focus: a crashed window stops counting after a while; a live one keeps its claim fresh', () => {
  const { a, b, clock } = pair();
  a.setFocused(true);
  clock.t += FOCUS_STALE_MS + 1;
  assert.equal(b.anyWindowFocused(), false, 'no heartbeat: treated as gone');
  a.heartbeat();
  assert.equal(b.anyWindowFocused(), true);
  clock.t += FOCUS_BEAT_MS - 1;
  a.heartbeat(); // too early to matter
  clock.t += FOCUS_STALE_MS - FOCUS_BEAT_MS;
  assert.equal(b.anyWindowFocused(), true);
});

test('dispose releases this window\'s focus claim only', () => {
  const { a, b } = pair();
  b.setFocused(true);
  a.dispose();
  assert.equal(a.anyWindowFocused(), true);
  b.dispose();
  assert.equal(a.anyWindowFocused(), false);
});

test('claim: exactly one window wins, and the claim expires', () => {
  const { a, b } = pair();
  assert.equal(a.claim('notify', 60_000), true);
  assert.equal(b.claim('notify', 60_000), false);
  assert.equal(a.claim('notify', 60_000), false);
  assert.equal(b.claim('other', 60_000), true, 'claims are per name');
  assert.equal(b.claim('notify', -1), true, 'an expired claim can be taken over');
});

test('a broken or missing folder never throws', () => {
  const file = path.join(tmp(), 'not-a-folder');
  fs.writeFileSync(file, 'x');
  const bus = new SharedBus(path.join(file, 'bus'), 'w');
  assert.doesNotThrow(() => { bus.post('ack'); bus.poll(); bus.setFocused(true); bus.heartbeat(); bus.dispose(); });
  assert.equal(bus.claim('notify', 1000), false);
  assert.deepEqual(bus.poll(), {});
});

test('garbage in a shared file is ignored', () => {
  const { dir, b } = pair();
  fs.writeFileSync(path.join(dir, 'ack'), 'not a number');
  fs.writeFileSync(path.join(dir, 'pause'), '');
  assert.deepEqual(b.poll(), {});
  assert.equal(b.anyWindowFocused(), false);
});
