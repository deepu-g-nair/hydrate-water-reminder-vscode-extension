"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderTimer = exports.MAX_TIMEOUT = void 0;
exports.MAX_TIMEOUT = 2 ** 31 - 1;
class ReminderTimer {
    clock;
    onDue;
    onChange;
    handle;
    dueAt = 0;
    remaining = 0;
    intervalMs = 30 * 60_000;
    _state = 'stopped';
    constructor(clock, onDue, onChange = () => { }) {
        this.clock = clock;
        this.onDue = onDue;
        this.onChange = onChange;
    }
    get state() { return this._state; }
    get interval() { return this.intervalMs; }
    /** (Re)start a full interval. */
    start(intervalMs = this.intervalMs) {
        this.intervalMs = intervalMs;
        this.arm(intervalMs);
    }
    pause() {
        if (this._state === 'running')
            this.remaining = Math.max(0, this.dueAt - this.clock.now());
        else if (this._state === 'due')
            this.remaining = this.intervalMs;
        else
            return;
        this.cancel();
        this._state = 'paused';
        this.onChange();
    }
    resume() {
        if (this._state === 'paused')
            this.arm(this.remaining);
    }
    /** Restart the countdown. A paused timer stays paused with a full interval left. */
    reset() {
        if (this._state === 'paused') {
            this.remaining = this.intervalMs;
            this.onChange();
        }
        else if (this._state !== 'stopped')
            this.arm(this.intervalMs);
    }
    stop() {
        this.cancel();
        this._state = 'stopped';
        this.onChange();
    }
    /** The reminder that onDue triggered has ended: begin the next interval. */
    finished() {
        if (this._state === 'due')
            this.arm(this.intervalMs);
    }
    /** Apply a new interval; a running countdown restarts with it. */
    setInterval(intervalMs) {
        if (intervalMs === this.intervalMs)
            return;
        this.intervalMs = intervalMs;
        if (this._state === 'running')
            this.arm(intervalMs);
        else if (this._state === 'paused') {
            this.remaining = intervalMs;
            this.onChange();
        }
    }
    remainingMs() {
        if (this._state === 'running')
            return Math.max(0, this.dueAt - this.clock.now());
        if (this._state === 'paused')
            return this.remaining;
        return 0;
    }
    snapshot() {
        return { state: this._state, dueAt: this.dueAt, remainingMs: this.remaining, intervalMs: this.intervalMs };
    }
    /** Continue after a window reload. An overdue reminder fires after `graceMs`, once. */
    restore(s, graceMs = 5000) {
        this.intervalMs = s.intervalMs;
        if (s.state === 'paused') {
            this.cancel();
            this.remaining = Math.min(Math.max(0, s.remainingMs), s.intervalMs);
            this._state = 'paused';
            this.onChange();
        }
        else if (s.state === 'running' || s.state === 'due') {
            const left = s.state === 'due' ? 0 : s.dueAt - this.clock.now();
            this.arm(Math.min(Math.max(graceMs, left), s.intervalMs));
        }
        else {
            this.stop();
        }
    }
    dispose() { this.cancel(); this._state = 'stopped'; }
    arm(ms) {
        this.cancel();
        this._state = 'running';
        this.dueAt = this.clock.now() + ms;
        this.schedule(ms);
        this.onChange();
    }
    schedule(ms) {
        this.handle = this.clock.setTimeout(() => this.tick(), Math.min(Math.max(0, ms), exports.MAX_TIMEOUT));
    }
    tick() {
        this.handle = undefined;
        if (this._state !== 'running')
            return;
        const left = this.dueAt - this.clock.now();
        if (left > 0) {
            this.schedule(left);
            return;
        } // fired early (or long interval chunk)
        this._state = 'due';
        this.onChange();
        this.onDue();
    }
    cancel() {
        if (this.handle !== undefined) {
            this.clock.clearTimeout(this.handle);
            this.handle = undefined;
        }
    }
}
exports.ReminderTimer = ReminderTimer;
//# sourceMappingURL=timer.js.map