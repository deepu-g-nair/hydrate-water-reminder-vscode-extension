import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Cmd, notifyCommand, run, soundCommand } from '../os';

const NASTY = `"; Remove-Item C:\\ -Recurse; $(calc) \`whoami\` ' && rm -rf ~ #`;
const decode = (c: Cmd) => Buffer.from(c.args[c.args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');

test('windows: text from settings travels as environment variables, never inside the script', () => {
  const c = notifyCommand('win32', 'Title 💧', NASTY)!;
  assert.equal(c.cmd, 'powershell.exe');
  assert.deepEqual(c.env, { WR_TITLE: 'Title 💧', WR_BODY: NASTY });
  const script = decode(c);
  assert.ok(script.includes('$env:WR_BODY') && script.includes('$env:WR_TITLE'));
  assert.ok(!script.includes('Remove-Item') && !c.args.join(' ').includes('Remove-Item'));
  assert.ok(script.includes('silent="true"'), 'the toast is silent; the extension plays its own sound');
});

test('windows: the sound file path is passed as an environment variable', () => {
  const file = `C:\\Users\\O'Brien & Co\\ext\\media\\in.wav`;
  const c = soundCommand('win32', file)!;
  assert.deepEqual(c.env, { WR_SOUND: file });
  assert.ok(decode(c).includes('$env:WR_SOUND') && !decode(c).includes("O'Brien"));
  assert.ok(c.args.includes('-NoProfile') && c.args.includes('-NonInteractive'));
});

test('macOS: title and body are separate arguments read by the script', () => {
  const c = notifyCommand('darwin', 'T', NASTY)!;
  assert.equal(c.cmd, 'osascript');
  assert.deepEqual(c.args.slice(-2), ['T', NASTY]);
  const script = c.args.slice(0, -2).join(' ');
  assert.ok(script.includes('item 2 of argv') && !script.includes('rm -rf'));
  assert.deepEqual(soundCommand('darwin', '/x/in.wav'), { cmd: 'afplay', args: ['/x/in.wav'] });
});

test('linux: notify-send with "--" so a message can never be read as an option; sound has a fallback', () => {
  const c = notifyCommand('linux', 'T', '--help')!;
  assert.deepEqual(c.args.slice(-3), ['--', 'T', '--help']);
  const s = soundCommand('linux', '/x/in.wav')!;
  assert.equal(s.cmd, 'paplay');
  assert.equal(s.fallback?.cmd, 'aplay');
});

test('unsupported platforms do nothing', () => {
  assert.equal(soundCommand('aix', '/x'), undefined);
  assert.equal(notifyCommand('aix', 't', 'b'), undefined);
  assert.doesNotThrow(() => run(undefined));
});

test('run: a missing tool falls back, and failures never throw', () => {
  const started: string[] = [];
  const fakeSpawn = ((cmd: string) => {
    started.push(cmd);
    const child = Object.assign(new EventEmitter(), { unref() {} });
    if (cmd === 'paplay') queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    return child;
  }) as never;
  run(soundCommand('linux', '/x/in.wav'), fakeSpawn);
  return new Promise<void>((resolve) => setImmediate(() => {
    assert.deepEqual(started, ['paplay', 'aplay']);
    const throwing = (() => { throw new Error('spawn blocked'); }) as never;
    assert.doesNotThrow(() => run({ cmd: 'x', args: [] }, throwing));
    resolve();
  }));
});

test('run: passes the extra environment and hides the window', () => {
  let opts: { env?: Record<string, string>; windowsHide?: boolean; stdio?: string } = {};
  const fakeSpawn = ((_c: string, _a: string[], o: typeof opts) => { opts = o; return Object.assign(new EventEmitter(), { unref() {} }); }) as never;
  run({ cmd: 'x', args: [], env: { WR_BODY: 'hello' } }, fakeSpawn);
  assert.equal(opts.env?.WR_BODY, 'hello');
  assert.equal(opts.windowsHide, true);
  assert.equal(opts.stdio, 'ignore');
});
