import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CHARACTERS, getCharacter } from '../characters';
import { ENTRIES, EXITS, resolveExit, timings } from '../render/animations';
import { DEFAULT_ACK_MESSAGE, buildStageSvg, StageOptions, wrap } from '../render/stage';

const base: StageOptions = {
  phase: 'enter', character: 'elephant', entry: 'walk', exit: 'auto',
  speed: 'normal', size: 'medium', message: 'Time for water!', dark: true, nonce: 'n',
};

const balanced = (svg: string) => {
  const open = (svg.match(/<g[\s>]/g) ?? []).length;
  const close = (svg.match(/<\/g>/g) ?? []).length;
  return open === close;
};

test('every character x entry x exit x phase produces a well-formed stage', () => {
  for (const c of CHARACTERS) for (const entry of ENTRIES) for (const exit of EXITS) for (const phase of ['enter', 'ack', 'dismiss'] as const) {
    const svg = buildStageSvg({ ...base, character: c.id, entry, exit, phase });
    assert.ok(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), `${c.id}/${entry}/${exit}/${phase}`);
    assert.ok(balanced(svg), `unbalanced groups: ${c.id}/${entry}/${exit}/${phase}`);
    assert.ok(!/undefined|NaN/.test(svg), `bad value in ${c.id}/${entry}/${exit}/${phase}`);
    for (const cls of ['leg-a', 'leg-b', 'arm-a', 'arm-b', 'head']) assert.ok(svg.includes(cls), `${c.id} is missing ${cls}`);
  }
});

test('every animation name used is defined', () => {
  for (const entry of ENTRIES) for (const exit of EXITS) for (const phase of ['enter', 'ack', 'dismiss'] as const) {
    const svg = buildStageSvg({ ...base, entry, exit, phase });
    const defined = new Set([...svg.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
    const used = [...svg.matchAll(/animation:([^;}"]+)/g)].flatMap((m) => m[1].split(/,(?![^(]*\))/)).map((a) => a.trim().split(/\s+/)[0]);
    for (const name of used) assert.ok(defined.has(name), `keyframes "${name}" missing for ${entry}/${exit}/${phase}`);
  }
});

test('messages are escaped, never injected as markup', () => {
  const svg = buildStageSvg({ ...base, message: '<script>alert(1)</script> & "quotes"' });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
});

test('acknowledgement shows the happy message, not the reminder', () => {
  const svg = buildStageSvg({ ...base, phase: 'ack', message: 'REMINDER TEXT' });
  assert.ok(svg.includes(DEFAULT_ACK_MESSAGE));
  assert.ok(!svg.includes('REMINDER TEXT'));
  const custom = buildStageSvg({ ...base, phase: 'ack', ackMessage: 'Well done you' });
  assert.ok(custom.includes('Well done you') && !custom.includes(DEFAULT_ACK_MESSAGE));
});

test('sprout entry draws the ground break and the leaf; walk does not', () => {
  const sprout = buildStageSvg({ ...base, entry: 'sprout' });
  assert.ok(sprout.includes('class="mound"') && sprout.includes('class="clod"') && sprout.includes('class="leaf"'));
  const walk = buildStageSvg({ ...base, entry: 'walk' });
  assert.ok(!walk.includes('class="mound"') && !walk.includes('class="leaf"'));
});

test('auto exit mirrors the entry', () => {
  assert.equal(resolveExit('sprout', 'auto'), 'burrow');
  assert.equal(resolveExit('walk', 'auto'), 'walk');
  assert.equal(resolveExit('slide', 'auto'), 'slide');
  assert.equal(resolveExit('bounce', 'auto'), 'bounce');
  assert.equal(resolveExit('fall', 'auto'), 'walk');
  assert.equal(resolveExit('sprout', 'slide'), 'slide');
});

test('speed scales durations; size scales the image', () => {
  const slow = timings('walk', 'auto', 'slow'), normal = timings('walk', 'auto', 'normal'), fast = timings('walk', 'auto', 'fast');
  assert.ok(slow.enterMs > normal.enterMs && normal.enterMs > fast.enterMs);
  assert.ok(slow.exitMs > normal.exitMs && normal.exitMs > fast.exitMs);
  const w = (size: StageOptions['size']) => Number(/width="(\d+)"/.exec(buildStageSvg({ ...base, size }))![1]);
  assert.ok(w('small') < w('medium') && w('medium') < w('large'));
});

test('each stage is unique so its animation restarts', () => {
  assert.notEqual(buildStageSvg({ ...base, nonce: 'a' }), buildStageSvg({ ...base, nonce: 'b' }));
});

test('unknown character falls back to the elephant', () => {
  assert.equal(getCharacter('dragon').id, 'elephant');
});

test('long messages wrap to at most three lines', () => {
  const lines = wrap('word '.repeat(60));
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.length <= 34));
  assert.ok(lines[2].endsWith('…'));
});
