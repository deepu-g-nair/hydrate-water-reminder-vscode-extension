"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Presenter = void 0;
/**
 * Shows the character inside the active text editor using a single
 * TextEditorDecorationType. Owns the visual session:
 *   enter (+ idle) -> ack | dismiss -> gone
 */
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
const animations_1 = require("./render/animations");
const stage_1 = require("./render/stage");
class Presenter {
    onEnd;
    onVisibility;
    session;
    lastMessage;
    lastAck;
    counter = 0;
    subscriptions;
    /** @param onEnd called once per session when the character is gone. */
    constructor(onEnd, onVisibility) {
        this.onEnd = onEnd;
        this.onVisibility = onVisibility;
        this.subscriptions = [
            // Keep standing on the last visible line while the user scrolls or types.
            vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
                if (this.session && e.textEditor === this.session.editor)
                    this.place();
            }),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (this.session && e.document === this.session.editor.document)
                    this.place();
            }),
            // Follow the user to another editor or editor group.
            vscode.window.onDidChangeActiveTextEditor((ed) => {
                const s = this.session;
                if (s && ed && ed !== s.editor && s.decoration) {
                    try {
                        s.editor.setDecorations(s.decoration, []);
                    }
                    catch { /* editor already closed */ }
                    s.editor = ed;
                    this.place();
                }
            }),
        ];
    }
    get visible() { return this.session !== undefined; }
    get awaitingAnswer() { return this.session?.phase === 'enter'; }
    /** @returns false when there is no text editor to appear in. */
    show(settings, fromTimer) {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return false;
        this.clear(); // never two characters
        const message = (0, config_1.pickMessage)(settings, this.lastMessage);
        this.lastMessage = message;
        const s = { editor, settings, message, phase: 'enter', fromTimer };
        this.session = s;
        this.render();
        this.onVisibility(true);
        const t = (0, animations_1.timings)(settings.entryAnimation, settings.exitAnimation, settings.speed);
        s.timer = setTimeout(() => this.leave('dismiss'), t.enterMs + settings.displaySeconds * 1000);
        return true;
    }
    acknowledge() { this.leave('ack'); }
    dismiss() { this.leave('dismiss'); }
    leave(phase) {
        const s = this.session;
        if (!s || s.phase !== 'enter')
            return;
        if (s.timer)
            clearTimeout(s.timer);
        s.phase = phase;
        if (phase === 'ack')
            this.lastAck = s.ackMessage = (0, config_1.pickAckMessage)(this.lastAck);
        this.render();
        this.onVisibility(false);
        const t = (0, animations_1.timings)(s.settings.entryAnimation, s.settings.exitAnimation, s.settings.speed);
        s.timer = setTimeout(() => this.clear(), t.exitMs + (phase === 'ack' ? t.happyMs : 0) + 100);
    }
    /** Swap in the self-animating SVG for the current phase. */
    render() {
        const s = this.session;
        if (!s)
            return;
        const kind = vscode.window.activeColorTheme.kind;
        const svg = (0, stage_1.buildStageSvg)({
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
    place() {
        const s = this.session;
        if (!s?.decoration)
            return;
        try {
            const ranges = s.editor.visibleRanges;
            if (!ranges.length)
                return;
            const last = ranges[ranges.length - 1];
            const line = Math.min(s.editor.document.lineCount - 1, Math.max(last.start.line, last.end.line - 1));
            const eol = s.editor.document.lineAt(line).range.end;
            s.editor.setDecorations(s.decoration, [new vscode.Range(eol, eol)]);
        }
        catch {
            /* editor was closed mid-animation; the session timer still cleans up */
        }
    }
    /** Remove the character immediately and end the session. */
    clear() {
        const s = this.session;
        if (!s)
            return;
        if (s.timer)
            clearTimeout(s.timer);
        s.decoration?.dispose();
        this.session = undefined;
        this.onVisibility(false);
        this.onEnd(s.fromTimer);
    }
    dispose() {
        this.clear();
        this.subscriptions.forEach((d) => d.dispose());
    }
}
exports.Presenter = Presenter;
//# sourceMappingURL=presenter.js.map