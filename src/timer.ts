/**
 * Reminder scheduling (pure: no VS Code imports, clock is injected for tests).
 *
 * Rules:
 *  - Exactly one pending timeout at any time (arming always cancels the old one).
 *  - When the interval elapses the timer enters "due" and calls onDue ONCE.
 *    It stays "due" until finished() is called, so a late or delayed callback
 *    (sleep, busy machine) can never produce a burst of reminders.
 *  - The next interval starts when the reminder ends (acknowledged, dismissed
 *    or expired), i.e. when finished() is called.
 */
export type TimerState = 'stopped' | 'running' | 'paused' | 'due';

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface TimerSnapshot {
  state: TimerState;
  dueAt: number;
  remainingMs: number;
  intervalMs: number;
}

export const MAX_TIMEOUT = 2 ** 31 - 1;

export class ReminderTimer {
  private handle: unknown;
  private dueAt = 0;
  private remaining = 0;
  private intervalMs = 30 * 60_000;
  private _state: TimerState = 'stopped';

  constructor(
    private readonly clock: Clock,
    private readonly onDue: () => void,
    private readonly onChange: () => void = () => {},
  ) {}

  get state(): TimerState { return this._state; }
  get interval(): number { return this.intervalMs; }

  /** (Re)start a full interval. */
  start(intervalMs: number = this.intervalMs): void {
    this.intervalMs = intervalMs;
    this.arm(intervalMs);
  }

  pause(): void {
    if (this._state === 'running') this.remaining = Math.max(0, this.dueAt - this.clock.now());
    else if (this._state === 'due') this.remaining = this.intervalMs;
    else return;
    this.cancel();
    this._state = 'paused';
    this.onChange();
  }

  resume(): void {
    if (this._state === 'paused') this.arm(this.remaining);
  }

  /** Restart the countdown. A paused timer stays paused with a full interval left. */
  reset(): void {
    if (this._state === 'paused') { this.remaining = this.intervalMs; this.onChange(); }
    else if (this._state !== 'stopped') this.arm(this.intervalMs);
  }

  stop(): void {
    this.cancel();
    this._state = 'stopped';
    this.onChange();
  }

  /** The reminder that onDue triggered has ended: begin the next interval. */
  finished(): void {
    if (this._state === 'due') this.arm(this.intervalMs);
  }

  /** Apply a new interval; a running countdown restarts with it. */
  setInterval(intervalMs: number): void {
    if (intervalMs === this.intervalMs) return;
    this.intervalMs = intervalMs;
    if (this._state === 'running') this.arm(intervalMs);
    else if (this._state === 'paused') { this.remaining = intervalMs; this.onChange(); }
  }

  remainingMs(): number {
    if (this._state === 'running') return Math.max(0, this.dueAt - this.clock.now());
    if (this._state === 'paused') return this.remaining;
    return 0;
  }

  snapshot(): TimerSnapshot {
    return { state: this._state, dueAt: this.dueAt, remainingMs: this.remaining, intervalMs: this.intervalMs };
  }

  /** Continue after a window reload. An overdue reminder fires after `graceMs`, once. */
  restore(s: TimerSnapshot, graceMs = 5000): void {
    this.intervalMs = s.intervalMs;
    if (s.state === 'paused') {
      this.cancel();
      this.remaining = Math.min(Math.max(0, s.remainingMs), s.intervalMs);
      this._state = 'paused';
      this.onChange();
    } else if (s.state === 'running' || s.state === 'due') {
      const left = s.state === 'due' ? 0 : s.dueAt - this.clock.now();
      this.arm(Math.min(Math.max(graceMs, left), s.intervalMs));
    } else {
      this.stop();
    }
  }

  dispose(): void { this.cancel(); this._state = 'stopped'; }

  private arm(ms: number): void {
    this.cancel();
    this._state = 'running';
    this.dueAt = this.clock.now() + ms;
    this.schedule(ms);
    this.onChange();
  }

  private schedule(ms: number): void {
    this.handle = this.clock.setTimeout(() => this.tick(), Math.min(Math.max(0, ms), MAX_TIMEOUT));
  }

  private tick(): void {
    this.handle = undefined;
    if (this._state !== 'running') return;
    const left = this.dueAt - this.clock.now();
    if (left > 0) { this.schedule(left); return; } // fired early (or long interval chunk)
    this._state = 'due';
    this.onChange();
    this.onDue();
  }

  private cancel(): void {
    if (this.handle !== undefined) { this.clock.clearTimeout(this.handle); this.handle = undefined; }
  }
}
