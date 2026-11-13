/**
 * Shows the character inside the active text editor using a single
 * TextEditorDecorationType. Owns the visual session:
 *
 *   enter (arrive, idle) -> wait (an occasional nudge) -> ack | dismiss -> gone
 *
 * While waiting, the character is a still picture most of the time and only
 * moves for a short "nudge" every so often. That keeps the cost of a reminder
 * that is left on screen for a long time close to zero.
 */
import * as vscode from 'vscode';
import { pickAckMessage, pickMessage, Settings, SoundStyle } from './config';
import { Entry, IDLE_MS, NUDGE_COUNT, NUDGE_EVERY_MS, pickEntry, timings } from './render/animations';
import { buildStageSvg, Phase } from './render/stage';

export type SoundName = 'in' | 'out';

export interface PresenterHooks {
  /** The character has gone. */
  onEnd(fromTimer: boolean): void;
  /** The character appeared / is no longer waiting for an answer. */
  onVisibility(awaitingAnswer: boolean): void;
  /** The reminder was answered (or timed out). `quiet`: closed because another window answered it. */
  onAnswer(kind: 'ack' | 'dismiss', fromTimer: boolean, quiet: boolean): void;
  sound(name: SoundName, style: SoundStyle): void;
}

export interface ShowOptions {
  /** Triggered by the reminder timer (true) or by a test / preview command (false). */
  fromTimer: boolean;
  message?: string;
  /** Force one entry style instead of following the settings. */
  entry?: Entry;
}

interface Session {
  editor: vscode.TextEditor;
  settings: Settings;
  entry: Entry;
  message: string;
  ackMessage?: string;
  phase: Phase;
  nudge: number;
  fromTimer: boolean;
  shownAt: number;
  lastNudgeAt: number;
  decoration?: vscode.TextEditorDecorationType;
  timers: Set<ReturnType<typeof setTimeout>>;
  nudgeTimer?: ReturnType<typeof setTimeout>;
  stale: vscode.Disposable[];
}

export class Presenter implements vscode.Disposable {
  private session: Session | undefined;
  private lastMessage: string | undefined;
  private lastAck: string | undefined;
  private lastEntry: Entry | undefined;
  private counter = 0;
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly hooks: PresenterHooks) {
    this.subscriptions = [
      // Keep standing on the last visible line while the user scrolls or types.
      vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
        if (this.session && e.textEditor === this.session.editor) this.place();
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.session && e.document === this.session.editor.document) this.place();
      }),
      // Follow the user to another editor or editor group.
      vscode.window.onDidChangeActiveTextEditor((ed) => {
        const s = this.session;
        if (s && ed && ed !== s.editor && s.decoration) {
          try { s.editor.setDecorations(s.decoration, []); } catch { /* editor already closed */ }
          s.editor = ed;
          this.place();
        }
      }),
    ];
  }

  get visible(): boolean { return this.session !== undefined; }
  /** Still waiting for "I've had a drink!" or Dismiss. */
  get awaitingAnswer(): boolean { return this.session?.phase === 'enter' || this.session?.phase === 'wait'; }
  get fromTimer(): boolean { return this.session?.fromTimer ?? false; }

  /** @returns false when there is no text editor to appear in. */
  show(settings: Settings, opts: ShowOptions): boolean {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return false;
    this.clear(); // never two characters
    const entry = opts.entry
      ?? (settings.entryAnimation === 'random' ? pickEntry(settings.randomPool, this.lastEntry) : settings.entryAnimation);
    const message = opts.message ?? pickMessage(settings, this.lastMessage);
    this.lastEntry = entry;
    this.lastMessage = message;
    const now = Date.now();
    const s: Session = {
      editor, settings, entry, message, phase: 'enter', nudge: -1, fromTimer: opts.fromTimer,
      shownAt: now, lastNudgeAt: now, timers: new Set(), stale: [],
    };
    this.session = s;
    this.render(false);
    this.hooks.onVisibility(true);
    if (settings.sound) this.hooks.sound('in', settings.soundStyle);
    const t = timings(entry, settings.exitAnimation, settings.speed);
    if (settings.autoClose) this.after(s, t.enterMs + settings.displaySeconds * 1000, () => this.leave('dismiss', false));
    s.nudgeTimer = setTimeout(() => this.playNudge(), t.enterMs + IDLE_MS);
    return true;
  }

  acknowledge(): void { this.leave('ack', false); }
  dismiss(): void { this.leave('dismiss', false); }
  /** Close without sound or fuss: the reminder was answered in another window. */
  dismissQuietly(): void { this.leave('dismiss', true); }

  /** Ask for attention now (e.g. the user just came back to this window). */
  nudge(): void {
    const s = this.session;
    if (!s || !this.awaitingAnswer) return;
    const now = Date.now();
    const arrived = now - s.shownAt > timings(s.entry, s.settings.exitAnimation, s.settings.speed).enterMs + 1500;
    if (arrived && now - s.lastNudgeAt > 4000) this.playNudge();
  }

  private playNudge(): void {
    const s = this.session;
    if (!s || !this.awaitingAnswer) return;
    let next = Math.floor(Math.random() * NUDGE_COUNT);
    if (next === s.nudge) next = (next + 1) % NUDGE_COUNT;
    s.nudge = next;
    s.phase = 'wait';
    s.lastNudgeAt = Date.now();
    this.render(true);
    if (s.nudgeTimer) clearTimeout(s.nudgeTimer);
    s.nudgeTimer = setTimeout(() => this.playNudge(), NUDGE_EVERY_MS);
  }

  private leave(phase: 'ack' | 'dismiss', quiet: boolean): void {
    const s = this.session;
    if (!s || !this.awaitingAnswer) return;
    this.cancelTimers(s);
    s.phase = phase;
    if (phase === 'ack') this.lastAck = s.ackMessage = pickAckMessage(this.lastAck);
    this.render(false);
    this.hooks.onVisibility(false);
    this.hooks.onAnswer(phase, s.fromTimer, quiet);
    const t = timings(s.entry, s.settings.exitAnimation, s.settings.speed);
    const happy = phase === 'ack' ? t.happyMs : 0;
    if (s.settings.sound && !quiet) this.after(s, happy, () => this.hooks.sound('out', s.settings.soundStyle));
    this.after(s, t.exitMs + happy + 100, () => this.clear());
  }

  private after(s: Session, ms: number, fn: () => void): void {
    const h = setTimeout(() => { s.timers.delete(h); fn(); }, ms);
    s.timers.add(h);
  }

  private cancelTimers(s: Session): void {
    s.timers.forEach((h) => clearTimeout(h));
    s.timers.clear();
    if (s.nudgeTimer) clearTimeout(s.nudgeTimer);
    s.nudgeTimer = undefined;
  }

  /**
   * Swap in the self-animating SVG for the current phase.
   * @param overlap keep the previous picture for a moment so that swapping two
   *        identical poses (a nudge) cannot flicker.
   */
  private render(overlap: boolean): void {
    const s = this.session;
    if (!s) return;
    const kind = vscode.window.activeColorTheme.kind;
    const svg = buildStageSvg({
      phase: s.phase,
      character: s.settings.character,
      entry: s.entry,
      exit: s.settings.exitAnimation,
      speed: s.settings.speed,
      size: s.settings.size,
      message: s.message,
      ackMessage: s.ackMessage,
      nudge: s.nudge,
      dark: kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast,
      nonce: `${Date.now()}-${this.counter++}`,
    });
    const uri = vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64'));
    const next = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: s.settings.renderMode === 'floating'
        ? {
            contentIconPath: uri,
            // Docks the image to the bottom-left corner of the editor, out of the
            // text flow, and lets mouse clicks fall through to the code.
            textDecoration: 'none; position:absolute; bottom:0; left:0; z-index:5; pointer-events:none;',
          }
        : { contentIconPath: uri, margin: '0 0 0 3ch' },
    });
    const previous = s.decoration;
    s.decoration = next;
    this.place();
    if (!previous) return;
    if (overlap) {
      s.stale.push(previous);
      this.after(s, 160, () => { previous.dispose(); s.stale = s.stale.filter((d) => d !== previous); });
    } else {
      previous.dispose();
    }
  }

  /** Anchor the decoration to the end of the last fully visible line. */
  private place(): void {
    const s = this.session;
    if (!s?.decoration) return;
    try {
      const ranges = s.editor.visibleRanges;
      if (!ranges.length) return;
      const last = ranges[ranges.length - 1];
      const line = Math.min(s.editor.document.lineCount - 1, Math.max(last.start.line, last.end.line - 1));
      const eol = s.editor.document.lineAt(line).range.end;
      s.editor.setDecorations(s.decoration, [new vscode.Range(eol, eol)]);
    } catch {
      /* editor was closed mid-animation; the session timer still cleans up */
    }
  }

  /** Remove the character immediately and end the session. */
  clear(): void {
    const s = this.session;
    if (!s) return;
    const unanswered = this.awaitingAnswer;
    this.cancelTimers(s);
    s.stale.forEach((d) => d.dispose());
    s.decoration?.dispose();
    this.session = undefined;
    if (unanswered) this.hooks.onVisibility(false);
    this.hooks.onEnd(s.fromTimer);
  }

  dispose(): void {
    this.clear();
    this.subscriptions.forEach((d) => d.dispose());
  }
}
