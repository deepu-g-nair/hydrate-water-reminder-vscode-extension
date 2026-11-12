import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Clock, ReminderTimer } from '../timer';

class FakeClock implements Clock {
  t = 0;
  private id = 0;
  timers = new Map<number, { at: number; fn: () => void }>();
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) { this.timers.set(++this.id, { at: this.t + ms, fn }); return this.id; }
  clearTimeout(h: unknown) { this.timers.delete(h as number); }
  /** Move time forward, firing timers in order. */
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const next = [...this.timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = Math.max(this.t, next[1].at);
      next[1].fn();
    }
    this.t = end;
  }
  /** Simulate sleep: the clock jumps, then overdue callbacks run late. */
  jump(ms: number) { this.t += ms; this.advance(0); }
}

const MIN = 60_000;
const make = () => {
  const clock = new FakeClock();
  let due = 0;
  const timer = new ReminderTimer(clock, () => due++);
  return { clock, timer, due: () => due };
};

test('fires once after the interval', () => {
  const { clock, timer, due } = make();
  timer.start(30 * MIN);
  clock.advance(30 * MIN - 1);
  assert.equal(due(), 0);
  clock.advance(1);
  assert.equal(due(), 1);
  assert.equal(timer.state, 'due');
});

test('starting twice never creates duplicate timers', () => {
  const { clock, timer, due } = make();
  timer.start(10 * MIN);
  timer.start(10 * MIN);
  timer.start(10 * MIN);
  assert.equal(clock.timers.size, 1);
  clock.advance(60 * MIN);
  assert.equal(due(), 1);
});

test('a long sleep produces one reminder, not a burst', () => {
  const { clock, timer, due } = make();
  timer.start(15 * MIN);
  clock.jump(8 * 60 * MIN);
  assert.equal(due(), 1);
  clock.advance(8 * 60 * MIN);
  assert.equal(due(), 1, 'stays due until the reminder is finished');
});

test('next interval starts only when the reminder is finished', () => {
  const { clock, timer, due } = make();
  timer.start(15 * MIN);
  clock.advance(15 * MIN);
  clock.advance(5 * MIN); // reminder on screen
  timer.finished();
  assert.equal(timer.state, 'running');
  clock.advance(15 * MIN - 1);
  assert.equal(due(), 1);
  clock.advance(1);
  assert.equal(due(), 2);
});

test('finished() is ignored unless a reminder is due', () => {
  const { clock, timer } = make();
  timer.start(15 * MIN);
  clock.advance(5 * MIN);
  timer.finished();
  assert.equal(timer.remainingMs(), 10 * MIN);
});

test('pause keeps the remaining time and resume continues it', () => {
  const { clock, timer, due } = make();
  timer.start(30 * MIN);
  clock.advance(20 * MIN);
  timer.pause();
  clock.advance(120 * MIN);
  assert.equal(due(), 0);
  assert.equal(timer.remainingMs(), 10 * MIN);
  timer.resume();
  clock.advance(10 * MIN);
  assert.equal(due(), 1);
});

test('reset restarts the countdown; paused stays paused', () => {
  const { clock, timer } = make();
  timer.start(30 * MIN);
  clock.advance(29 * MIN);
  timer.reset();
  assert.equal(timer.remainingMs(), 30 * MIN);
  clock.advance(10 * MIN);
  timer.pause();
  timer.reset();
  assert.equal(timer.state, 'paused');
  assert.equal(timer.remainingMs(), 30 * MIN);
});

test('stop cancels everything', () => {
  const { clock, timer, due } = make();
  timer.start(5 * MIN);
  timer.stop();
  clock.advance(60 * MIN);
  assert.equal(due(), 0);
  assert.equal(clock.timers.size, 0);
});

test('changing the interval restarts a running countdown', () => {
  const { clock, timer, due } = make();
  timer.start(30 * MIN);
  clock.advance(10 * MIN);
  timer.setInterval(15 * MIN);
  assert.equal(timer.remainingMs(), 15 * MIN);
  timer.setInterval(15 * MIN); // unchanged: no restart
  clock.advance(15 * MIN);
  assert.equal(due(), 1);
});

test('an early timeout callback re-arms instead of firing', () => {
  const clock = new FakeClock();
  let due = 0;
  const timer = new ReminderTimer(clock, () => due++);
  timer.start(10 * MIN);
  const [id, entry] = [...clock.timers.entries()][0];
  clock.timers.delete(id);
  clock.t = 4 * MIN;
  entry.fn(); // fired 6 minutes early
  assert.equal(due, 0);
  clock.advance(6 * MIN);
  assert.equal(due, 1);
});

test('restore continues a running countdown after reload', () => {
  const a = make();
  a.timer.start(30 * MIN);
  a.clock.advance(12 * MIN);
  const snap = a.timer.snapshot();

  const b = make();
  b.clock.t = a.clock.t + 3 * MIN; // reload took a while
  b.timer.restore(snap);
  assert.equal(b.timer.remainingMs(), 15 * MIN);
});

test('restore of an overdue reminder fires once after the grace period', () => {
  const a = make();
  a.timer.start(30 * MIN);
  const snap = a.timer.snapshot();
  const b = make();
  b.clock.t = 5 * 60 * MIN;
  b.timer.restore(snap, 5000);
  b.clock.advance(4999);
  assert.equal(b.due(), 0);
  b.clock.advance(1);
  assert.equal(b.due(), 1);
});

test('restore keeps a paused timer paused', () => {
  const a = make();
  a.timer.start(30 * MIN);
  a.clock.advance(10 * MIN);
  a.timer.pause();
  const b = make();
  b.timer.restore(a.timer.snapshot());
  assert.equal(b.timer.state, 'paused');
  assert.equal(b.timer.remainingMs(), 20 * MIN);
  b.clock.advance(60 * MIN);
  assert.equal(b.due(), 0);
});

test('onChange reports every state transition', () => {
  const clock = new FakeClock();
  const states: string[] = [];
  const timer: ReminderTimer = new ReminderTimer(clock, () => {}, () => states.push(timer.state));
  timer.start(MIN);
  clock.advance(MIN);
  timer.finished();
  timer.pause();
  timer.resume();
  timer.stop();
  assert.deepEqual(states, ['running', 'due', 'running', 'paused', 'running', 'stopped']);
});
