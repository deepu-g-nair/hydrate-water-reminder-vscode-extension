import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CHARACTERS, getCharacter } from '../characters';
import { ENTRIES, EXITS, NUDGE_COUNT, pickEntry, resolveExit, timings } from '../render/animations';
import { DEFAULT_ACK_MESSAGE, buildStageSvg, Phase, shade3d, StageOptions, wrap } from '../render/stage';

const base: StageOptions = {
  phase: 'enter', character: 'elephant', entry: 'walk', exit: 'auto',
  speed: 'normal', size: 'medium', message: 'Time for water!', dark: true, nonce: 'n',
};
const PHASES: Phase[] = ['enter', 'wait', 'ack', 'dismiss'];

const balanced = (svg: string) => (svg.match(/<g[\s>]/g) ?? []).length === (svg.match(/<\/g>/g) ?? []).length;

/** Every stage the extension can produce for one character. */
function* allStages(character = 'elephant'): Generator<[string, string]> {
  for (const entry of ENTRIES) for (const exit of EXITS) for (const phase of PHASES) {
    const nudges = phase === 'wait' ? [...Array(NUDGE_COUNT).keys()] : [0];
    for (const nudge of nudges) {
      yield [`${character}/${entry}/${exit}/${phase}/${nudge}`, buildStageSvg({ ...base, character, entry, exit, phase, nudge })];
    }
  }
}

test('every character x entry x exit x phase produces a well-formed stage', () => {
  for (const c of CHARACTERS) for (const [name, svg] of allStages(c.id)) {
    assert.ok(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), name);
    assert.ok(balanced(svg), `unbalanced groups: ${name}`);
    assert.ok(!/undefined|NaN/.test(svg), `bad value in ${name}`);
    for (const cls of ['leg-a', 'leg-b', 'arm-a', 'arm-b', 'head', 'pf', 'pb', 'shs']) assert.ok(svg.includes(cls), `${name} is missing ${cls}`);
  }
});

test('every animation name used is defined', () => {
  for (const [name, svg] of allStages()) {
    const defined = new Set([...svg.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
    const used = [...svg.matchAll(/animation:([^;}"]+)/g)].flatMap((m) => m[1].split(/,(?![^(]*\))/)).map((a) => a.trim().split(/\s+/)[0]);
    assert.ok(used.length > 0, `no animation in ${name}`);
    for (const k of used) assert.ok(defined.has(k), `keyframes "${k}" missing for ${name}`);
  }
});

test('every gradient that is referenced is defined', () => {
  for (const c of CHARACTERS) for (const phase of PHASES) {
    const svg = buildStageSvg({ ...base, character: c.id, phase, entry: 'balloon' });
    const defined = new Set([...svg.matchAll(/Gradient id="([\w-]+)"/g)].map((m) => m[1]));
    for (const m of svg.matchAll(/url\(#([\w-]+)\)/g)) {
      assert.ok(defined.has(m[1]) || m[1] === 'above', `${c.id}/${phase}: #${m[1]} is not defined`);
    }
  }
});

test('nothing animates forever: a waiting character must come to rest', () => {
  for (const [name, svg] of allStages()) assert.ok(!svg.includes('infinite'), `infinite animation in ${name}`);
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

test('the waiting stage keeps the reminder text and the glass held out', () => {
  const svg = buildStageSvg({ ...base, phase: 'wait', nudge: 1 });
  assert.ok(svg.includes('Time for water!'));
  assert.ok(svg.includes('.arm-b{transform:rotate(-105deg)}'));
});

test('each nudge is a different move', () => {
  const css = (n: number) => /<style>([\s\S]*?)<\/style>/.exec(buildStageSvg({ ...base, phase: 'wait', nudge: n }))![1];
  assert.equal(new Set([...Array(NUDGE_COUNT).keys()].map(css)).size, NUDGE_COUNT);
});

test('props appear only with their animation', () => {
  const has = (o: Partial<StageOptions>, cls: string) => buildStageSvg({ ...base, ...o }).includes(`class="${cls}"`);
  assert.ok(has({ entry: 'sprout' }, 'mound') && has({ entry: 'sprout' }, 'clod') && has({ entry: 'sprout' }, 'leaf'));
  assert.ok(!has({ entry: 'walk' }, 'mound') && !has({ entry: 'walk' }, 'leaf'));
  assert.ok(has({ entry: 'balloon' }, 'balloon') && !has({ entry: 'walk' }, 'balloon'));
  assert.ok(has({ entry: 'balloon', phase: 'dismiss' }, 'balloon'), 'auto exit after a balloon entry floats away');
  assert.ok(has({ entry: 'roll' }, 'orbit') && !has({ entry: 'poof' }, 'orbit'));
  assert.ok(has({ entry: 'poof' }, 'spark') && has({ entry: 'walk', exit: 'poof', phase: 'dismiss' }, 'spark'));
});

test('shade3d turns flat fills into lit gradients and reuses one gradient per colour', () => {
  const { markup, defs } = shade3d('<rect fill="#FF0000"/><circle fill="#ff0000"/><path fill="#00FF00"/><path fill="none"/><text fill="#fff"/>');
  assert.equal((markup.match(/url\(#g0\)/g) ?? []).length, 2);
  assert.ok(markup.includes('url(#g1)'));
  assert.ok(markup.includes('fill="none"') && markup.includes('fill="#fff"'), 'non-colour and short fills are left alone');
  assert.equal((defs.match(/<radialGradient/g) ?? []).length, 2);
  assert.ok(defs.includes('stop-color="#ff0000"'));
});

test('auto exit mirrors the entry', () => {
  const expected = { walk: 'walk', slide: 'slide', bounce: 'bounce', fall: 'walk', sprout: 'burrow', roll: 'roll', balloon: 'float', faraway: 'faraway', poof: 'poof', peek: 'walk' };
  for (const e of ENTRIES) assert.equal(resolveExit(e, 'auto'), expected[e]);
  assert.equal(resolveExit('sprout', 'slide'), 'slide');
});

test('random entry: stays in the pool, never repeats back to back, reaches every style', () => {
  const seen = new Set<string>();
  let prev = pickEntry(ENTRIES);
  for (let i = 0; i < 3000; i++) {
    const next = pickEntry(ENTRIES, prev);
    assert.notEqual(next, prev);
    seen.add(prev = next);
  }
  assert.equal(seen.size, ENTRIES.length);
  for (let i = 0; i < 200; i++) assert.ok(['roll', 'poof'].includes(pickEntry(['roll', 'poof'])));
  assert.equal(pickEntry(['peek'], 'peek'), 'peek', 'a pool of one always returns it');
  assert.ok(ENTRIES.includes(pickEntry([])), 'an empty pool falls back to every style');
});

test('speed scales durations; size scales the image', () => {
  for (const e of ENTRIES) {
    const slow = timings(e, 'auto', 'slow'), normal = timings(e, 'auto', 'normal'), fast = timings(e, 'auto', 'fast');
    assert.ok(slow.enterMs > normal.enterMs && normal.enterMs > fast.enterMs);
    assert.ok(slow.exitMs > normal.exitMs && normal.exitMs > fast.exitMs);
  }
  const w = (size: StageOptions['size']) => Number(/width="(\d+)"/.exec(buildStageSvg({ ...base, size }))![1]);
  assert.ok(w('small') < w('medium') && w('medium') < w('large'));
});

test('each stage is unique so its animation restarts', () => {
  assert.notEqual(buildStageSvg({ ...base, nonce: 'a' }), buildStageSvg({ ...base, nonce: 'b' }));
});

test('unknown character falls back to the elephant', () => {
  assert.equal(getCharacter('dragon').id, 'elephant');
});

test('there are ten characters with unique ids', () => {
  assert.equal(CHARACTERS.length, 10);
  assert.equal(new Set(CHARACTERS.map((c) => c.id)).size, 10);
});

test('long messages wrap to at most three lines', () => {
  const lines = wrap('word '.repeat(60));
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.length <= 34));
  assert.ok(lines[2].endsWith('…'));
});
