import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ACK_MESSAGES, pickAckMessage, DEFAULT_MESSAGES, DEFAULTS, formatRemaining, MAX_MESSAGE_LENGTH, normalize, pickMessage } from '../config';
import { wrap } from '../render/stage';

test('empty input yields defaults', () => {
  assert.deepEqual(normalize({}), DEFAULTS);
});

test('invalid values fall back or are clamped', () => {
  const s = normalize({
    enabled: 'yes', intervalMinutes: -5, displaySeconds: 99999, character: 'dragon',
    entryAnimation: 'teleport', exitAnimation: 42, size: 'huge', speed: null, messages: 'hello', renderMode: 'overlay',
  });
  assert.equal(s.enabled, true);
  assert.equal(s.intervalMinutes, 1);
  assert.equal(s.displaySeconds, 600);
  assert.equal(s.character, 'elephant');
  assert.equal(s.entryAnimation, DEFAULTS.entryAnimation);
  assert.equal(s.exitAnimation, DEFAULTS.exitAnimation);
  assert.equal(s.size, 'medium');
  assert.equal(s.speed, 'normal');
  assert.deepEqual(s.messages, []);
  assert.equal(s.renderMode, 'floating');
});

test('valid values are kept', () => {
  const s = normalize({ intervalMinutes: 45, character: 'panda', entryAnimation: 'sprout', exitAnimation: 'burrow', size: 'large', speed: 'fast' });
  assert.equal(s.intervalMinutes, 45);
  assert.equal(s.character, 'panda');
  assert.equal(s.entryAnimation, 'sprout');
  assert.equal(s.exitAnimation, 'burrow');
});

test('custom messages are cleaned', () => {
  const s = normalize({ messages: ['  Drink!  ', '', 7, '   ', 'x'.repeat(500)] });
  assert.equal(s.messages.length, 2);
  assert.equal(s.messages[0], 'Drink!');
  assert.equal(s.messages[1].length, 120);
});

test('pickMessage uses custom messages when present, defaults otherwise', () => {
  assert.ok(DEFAULT_MESSAGES.includes(pickMessage(DEFAULTS)));
  assert.equal(pickMessage({ ...DEFAULTS, messages: ['only one'] }, 'only one'), 'only one');
});

test('pickMessage avoids repeating the previous message', () => {
  const s = { ...DEFAULTS, messages: ['a', 'b'] };
  for (let i = 0; i < 20; i++) assert.equal(pickMessage(s, 'a'), 'b');
});

test('formatRemaining', () => {
  assert.equal(formatRemaining(20_000), '1m');
  assert.equal(formatRemaining(0), '<1m');
  assert.equal(formatRemaining(29.2 * 60_000), '30m');
  assert.equal(formatRemaining(60 * 60_000), '1h');
  assert.equal(formatRemaining(90 * 60_000), '1h 30m');
});

test('there are 20 distinct built-in messages and each fits the speech bubble', () => {
  assert.equal(DEFAULT_MESSAGES.length, 20);
  assert.equal(new Set(DEFAULT_MESSAGES).size, 20);
  for (const m of DEFAULT_MESSAGES) {
    assert.ok(m.length <= MAX_MESSAGE_LENGTH, `too long: ${m}`);
    const lines = wrap(m);
    assert.ok(lines.length <= 3 && lines.join(' ') === m, `does not fit the bubble: ${m}`);
  }
});

test('all 20 messages come up when picking at random', () => {
  const seen = new Set<string>();
  let prev: string | undefined;
  for (let i = 0; i < 2000; i++) { prev = pickMessage(DEFAULTS, prev); seen.add(prev); }
  assert.equal(seen.size, 20);
});

test('defaults: elephant that slides in and slides out', () => {
  assert.equal(DEFAULTS.character, 'elephant');
  assert.equal(DEFAULTS.entryAnimation, 'slide');
  assert.equal(DEFAULTS.exitAnimation, 'slide');
});

test('celebration messages are distinct, fit the bubble and are picked at random without repeats', () => {
  assert.ok(ACK_MESSAGES.length >= 10);
  assert.equal(new Set(ACK_MESSAGES).size, ACK_MESSAGES.length);
  for (const m of ACK_MESSAGES) {
    const lines = wrap(m);
    assert.ok(lines.length <= 3 && lines.join(' ') === m, `does not fit the bubble: ${m}`);
  }
  const seen = new Set<string>();
  let prev: string | undefined;
  for (let i = 0; i < 2000; i++) {
    const next = pickAckMessage(prev);
    assert.notEqual(next, prev);
    seen.add(prev = next);
  }
  assert.equal(seen.size, ACK_MESSAGES.length);
});
