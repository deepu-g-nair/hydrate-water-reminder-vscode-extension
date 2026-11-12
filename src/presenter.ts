/**
 * Shows the character inside the active text editor using a single
 * TextEditorDecorationType. Owns the visual session:
 *   enter (+ idle) -> ack | dismiss -> gone
 */
import * as vscode from 'vscode';
import { pickAckMessage, pickMessage, Settings } from './config';
import { timings } from './render/animations';
import { buildStageSvg, Phase } from './render/stage';

interface Session {
  editor: vscode.TextEditor;
  settings: Settings;
  message: string;
  ackMessage?: string;
  phase: Phase;
  fromTimer: boolean;
  decoration?: vscode.TextEditorDecorationType;
  timer?: ReturnType<typeof setTimeout>;
}

export class Presenter implements vscode.Disposable {
  private session: Session | undefined;
  private lastMessage: string | undefined;
  private lastAck: string | undefined;
  private counter = 0;
  private readonly subscriptions: vscode.Disposable[];

  /** @param onEnd called once per session when the character is gone. */
  constructor(private readonly onEnd: (fromTimer: boolean) => void, private readonly onVisibility: (visible: boolean) => void) {
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
  get awaitingAnswer(): boolean { return this.session?.phase === 'enter'; }

  /** @returns false when there is no text editor to appear in. */
  show(settings: Settings, fromTimer: boolean): boolean {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return false;
    this.clear(); // never two characters
    const message = pickMessage(settings, this.lastMessage);
    this.lastMessage = message;
    const s: Session = { editor, settings, message, phase: 'enter', fromTimer };
    this.session = s;
    this.render();
    this.onVisibility(true);
    const t = timings(settings.entryAnimation, settings.exitAnimation, settings.speed);
    s.timer = setTimeout(() => this.leave('dismiss'), t.enterMs + settings.displaySeconds * 1000);
    return true;
  }

  acknowledge(): void { this.leave('ack'); }
  dismiss(): void { this.leave('dismiss'); }

  private leave(phase: 'ack' | 'dismiss'): void {
    const s = this.session;
    if (!s || s.phase !== 'enter') return;
    if (s.timer) clearTimeout(s.timer);
    s.phase = phase;
    if (phase === 'ack') this.lastAck = s.ackMessage = pickAckMessage(this.lastAck);
    this.render();
    this.onVisibility(false);
    const t = timings(s.settings.entryAnimation, s.settings.exitAnimation, s.settings.speed);
    s.timer = setTimeout(() => this.clear(), t.exitMs + (phase === 'ack' ? t.happyMs : 0) + 100);
  }

  /** Swap in the self-animating SVG for the current phase. */
  private render(): void {
    const s = this.session;
    if (!s) return;
    const kind = vscode.window.activeColorTheme.kind;
    const svg = buildStageSvg({
      phase: s.phase,
      character: s.settings.character,
      entry: s.settings.entryAnimation,
      exit: s.settings.exitAnimation,
      speed: s.settings.speed,
      size: s.settings.size,
      message: s.message,
      ackMessage: s.ackMessage,
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
    previous?.dispose();
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
    if (s.timer) clearTimeout(s.timer);
    s.decoration?.dispose();
    this.session = undefined;
    this.onVisibility(false);
    this.onEnd(s.fromTimer);
  }

  dispose(): void {
    this.clear();
    this.subscriptions.forEach((d) => d.dispose());
  }
}
