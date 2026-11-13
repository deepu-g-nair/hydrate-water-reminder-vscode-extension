/**
 * Keeps several VS Code windows in step.
 *
 * Every window runs its own copy of the extension. Without coordination each
 * one would remind, notify and play sounds separately. Windows therefore share
 * a few tiny files in the extension's global storage folder:
 *
 *   ack / pause / resume / reset   "this just happened" (a timestamp + who wrote it)
 *   focus                          which window, if any, the user is working in
 *   <name>.lock/                   a short-lived "I will do this, nobody else needs to" claim
 *
 * One file per fact means two windows writing at the same moment can never
 * overwrite each other's news. Everything here is best effort: any file error
 * is swallowed and simply means "no news".
 */
import * as fs from 'fs';
import * as path from 'path';

export type BusEvent = 'ack' | 'pause' | 'resume' | 'reset';
export const BUS_EVENTS: readonly BusEvent[] = ['ack', 'pause', 'resume', 'reset'];

/** A focused window refreshes its claim this often; older claims are ignored (crashed window). */
export const FOCUS_BEAT_MS = 60_000;
export const FOCUS_STALE_MS = 3 * FOCUS_BEAT_MS;

export class SharedBus {
  private readonly seen: Record<BusEvent, number> = { ack: 0, pause: 0, resume: 0, reset: 0 };
  private focused = false;
  private lastBeat = 0;

  constructor(readonly dir: string, private readonly id: string, private readonly now: () => number = Date.now) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* best effort */ }
    // Events that happened before this window opened are old news.
    for (const e of BUS_EVENTS) this.seen[e] = this.read(e)?.at ?? 0;
  }

  /** Tell the other windows that something happened here. */
  post(event: BusEvent): void {
    const at = Math.max(this.now(), this.seen[event] + 1);
    this.seen[event] = at;
    this.write(event, `${at} ${this.id}`);
  }

  /** News from other windows since the last call: event -> when it happened. */
  poll(): Partial<Record<BusEvent, number>> {
    const news: Partial<Record<BusEvent, number>> = {};
    for (const e of BUS_EVENTS) {
      const r = this.read(e);
      if (r && r.at > this.seen[e]) {
        this.seen[e] = r.at;
        if (r.id !== this.id) news[e] = r.at;
      }
    }
    return news;
  }

  /** Record whether the user is working in this window. */
  setFocused(focused: boolean): void {
    this.focused = focused;
    if (focused) {
      this.lastBeat = this.now();
      this.write('focus', `${this.lastBeat} ${this.id}`);
    } else if (this.read('focus')?.id === this.id) {
      this.write('focus', '');
    }
  }

  /** Call regularly. Keeps a focused window's claim fresh. */
  heartbeat(): void {
    if (this.focused && this.now() - this.lastBeat >= FOCUS_BEAT_MS) this.setFocused(true);
  }

  /** Is the user working in any VS Code window (this one included)? */
  anyWindowFocused(): boolean {
    if (this.focused) return true;
    const r = this.read('focus');
    return !!r && this.now() - r.at < FOCUS_STALE_MS;
  }

  /**
   * Try to become the one window that does something (e.g. sends the system
   * notification). Returns true for exactly one window per `ttlMs`.
   */
  claim(name: string, ttlMs: number): boolean {
    const lock = path.join(this.dir, `${name}.lock`);
    const take = () => { fs.mkdirSync(lock); return true; }; // mkdir is atomic: only one window succeeds
    try {
      return take();
    } catch {
      try {
        if (this.now() - fs.statSync(lock).mtimeMs < ttlMs) return false;
        fs.rmdirSync(lock);
        return take();
      } catch {
        return false;
      }
    }
  }

  dispose(): void {
    try { this.setFocused(false); } catch { /* best effort */ }
  }

  private read(name: string): { at: number; id: string } | undefined {
    try {
      const [at, id] = fs.readFileSync(path.join(this.dir, name), 'utf8').trim().split(' ');
      const n = Number(at);
      return Number.isFinite(n) && n > 0 && id ? { at: n, id } : undefined;
    } catch {
      return undefined;
    }
  }

  private write(name: string, content: string): void {
    try { fs.writeFileSync(path.join(this.dir, name), content); } catch { /* best effort */ }
  }
}
