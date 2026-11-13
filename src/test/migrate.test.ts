import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SETTING_KEYS } from '../config';
import { RESET_MARKER_KEY, resetSavedSettingsOnce, SETTINGS_RESET_VERSION } from '../migrate';

const USER = 'user-target';
const fakes = (saved: Record<string, unknown>, state: Record<string, unknown> = {}) => {
  const updates: [string, unknown, unknown][] = [];
  return {
    saved, state, updates,
    memento: { get: <T>(k: string) => state[k] as T | undefined, update: async (k: string, v: unknown) => { if (v === undefined) delete state[k]; else state[k] = v; } },
    config: {
      inspect: (k: string) => ({ globalValue: saved[k] }),
      update: async (k: string, v: unknown, target: unknown) => { updates.push([k, v, target]); if (v === undefined) delete saved[k]; else saved[k] = v; },
    },
  };
};

test('first run after the update: every saved setting is removed from user settings', async () => {
  const f = fakes({ character: 'cat', entryAnimation: 'slide', exitAnimation: 'slide', intervalMinutes: 45, enabled: false, messages: ['x'] });
  const reset = await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER);
  assert.deepEqual([...reset].sort(), ['character', 'enabled', 'entryAnimation', 'exitAnimation', 'intervalMinutes', 'messages']);
  assert.deepEqual(f.saved, {});
  assert.ok(f.updates.every(([, value, target]) => value === undefined && target === USER));
  assert.equal(f.state[RESET_MARKER_KEY], SETTINGS_RESET_VERSION);
});

test('settings that were never saved are not touched', async () => {
  const f = fakes({ character: 'cat' });
  await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER);
  assert.deepEqual(f.updates.map(([k]) => k), ['character']);
});

test('it happens only once: later choices survive restarts and later versions', async () => {
  const f = fakes({ character: 'cat' });
  await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER);
  f.saved.character = 'tiger'; // the user picks again after the reset
  assert.deepEqual(await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER), []);
  assert.equal(f.saved.character, 'tiger');
});

test('a fresh install has nothing to reset and is marked as done', async () => {
  const f = fakes({});
  assert.deepEqual(await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER), []);
  assert.equal(f.updates.length, 0);
  assert.equal(f.state[RESET_MARKER_KEY], SETTINGS_RESET_VERSION);
});

test('saved state such as a paused countdown is forgotten too', async () => {
  const f = fakes({ character: 'cat' }, { 'waterReminder.timer': { state: 'paused' }, unrelated: 1 });
  await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER, ['waterReminder.timer']);
  assert.equal(f.state['waterReminder.timer'], undefined);
  assert.equal(f.state.unrelated, 1);
});

test('a marker from an older reset does not block this one', async () => {
  const f = fakes({ character: 'cat' }, { [RESET_MARKER_KEY]: '0.1.0' });
  assert.deepEqual(await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER), ['character']);
});

test('if settings cannot be written it never throws, and tries again next time', async () => {
  const f = fakes({ character: 'cat', size: 'large' });
  const broken = { inspect: f.config.inspect, update: async (k: string) => { if (k === 'character') throw new Error('read-only'); delete f.saved[k]; } };
  const reset = await resetSavedSettingsOnce(f.memento, broken, SETTING_KEYS, USER);
  assert.deepEqual(reset, ['size']);
  assert.equal(f.state[RESET_MARKER_KEY], undefined, 'not marked done, so the next start retries');
  assert.deepEqual(await resetSavedSettingsOnce(f.memento, f.config, SETTING_KEYS, USER), ['character']);
  assert.equal(f.state[RESET_MARKER_KEY], SETTINGS_RESET_VERSION);
});

test('every setting the extension has is covered by the reset', () => {
  const declared = Object.keys(require('../../package.json').contributes.configuration.properties).map((k: string) => k.replace('waterReminder.', ''));
  assert.deepEqual([...SETTING_KEYS].sort(), declared.sort());
});
