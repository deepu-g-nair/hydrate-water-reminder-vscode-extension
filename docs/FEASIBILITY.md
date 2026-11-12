# Phase 1 — Technical feasibility report and architecture proposal

## 1. Verdict

A truly free-floating, clickable overlay on top of the code editor is **not possible** with the supported VS Code Extension API. No stable API gives an extension a DOM node, a canvas, or a webview layered over a text editor.

The closest extension-only result is achievable, with clear limits:

- **Can do:** an animated character drawn *inside the real text editor*, over the code, entering from the left or right, showing a speech bubble, reacting and walking out, while the developer keeps typing, selecting and scrolling underneath it.
- **Cannot do:** make the character itself clickable (no buttons in the bubble), let it roam freely across the workbench, or have it appear when no text editor is open.

The acknowledge and dismiss actions therefore live *next to* the character (status bar buttons, keyboard shortcuts, Command Palette), not on it.

## 2. Approaches investigated

| Approach | In the real editor? | Animation | Clickable? | Assessment |
|---|---|---|---|---|
| `TextEditorDecorationType` with `before`/`after` + `contentIconPath` (SVG) | Yes, attached to a text position | Yes: the SVG animates itself (CSS/SMIL inside the image) | No | **Selected.** Only supported way to paint custom visuals in the editor. |
| Same, plus extra CSS passed through the `textDecoration` value (`position:absolute`, `pointer-events:none`) | Yes, docked to an editor corner over the code | Same | No | **Selected as default mode**, with caveats (section 4). |
| Gutter decorations (`gutterIconPath`) | Gutter only | Animated SVG works, but about one line tall | No | Too small for a character. Useful only as a tiny "it's time" hint. |
| Moving a decoration by re-applying ranges on a timer | Yes | Jumps a whole character cell/line per step; each step is an extension-host round trip | No | Rejected: jerky, wasteful. Motion is done inside the SVG instead. |
| `WebviewPanel` | No: it *is* an editor tab, beside or instead of the code | Unrestricted HTML/CSS/JS | Yes | Cannot overlay code. Steals an editor group. |
| `WebviewView` (sidebar / bottom panel) | No | Unrestricted | Yes | Best *fallback stage* (see 3.3), never equivalent to an overlay. |
| Custom editors (`CustomTextEditorProvider`) | Replaces the text editor with a webview | Unrestricted | Yes | Would mean re-implementing the code editor. Not viable. |
| Webview editor insets (`createWebviewTextEditorInset`) | Yes, a webview between lines | Unrestricted | Yes | **Proposed API only**, unfinished since 2019; extensions using proposed API cannot be published and need Insiders + a launch flag. Not usable. |
| Inlay hints, CodeLens, hovers | Yes | None (text only) | CodeLens/hover links: yes | Not a rendering surface. Hover/CodeLens could add an optional in-editor "I've had a drink!" link later. |
| Patching workbench CSS/JS files | Yes | Unrestricted | Yes | Forbidden by the brief; breaks on update and marks the install "corrupt". |

Sources: [VS Code API reference](https://code.visualstudio.com/api/references/vscode-api), [Webview guide](https://code.visualstudio.com/api/extension-guides/webview), [Custom editors guide](https://code.visualstudio.com/api/extension-guides/custom-editors), [Using proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api), [editor insets issue #85682](https://github.com/microsoft/vscode/issues/85682), [vscode-power-mode](https://github.com/hoovercj/vscode-power-mode).

## 3. Proposed architecture

### 3.1 Rendering: one self-animating SVG "stage" per phase

The extension attaches a single decoration to the end of the last visible line. Its `after` attachment shows an SVG image (460 × 210 px) containing the character, the speech bubble and **all** animation as CSS keyframes inside the SVG:

- limbs swing on their own pivots (a real walk cycle, not a sliding picture);
- the body bobs, breathes and blinks while idle;
- the bubble pops in after arrival;
- acknowledge swaps in a second SVG (happy face, hops, "Yay!", turn around, walk out); dismiss swaps in a third (turn around, walk out).

Consequences:

- The extension host does **zero work per frame**. It makes one `setDecorations` call per phase, plus one when the user scrolls.
- Chromium composites the image; the animation stays smooth even if the extension host is busy.
- A new character is a new drawing function. A new entry animation is a new set of keyframes. Neither touches the host code.

### 3.2 Two render modes (both in the PoC)

| Mode | How | Result |
|---|---|---|
| `floating` (default) | `after.textDecoration: "none; position:absolute; bottom:0; left:0 \| right:0; pointer-events:none"` | Character stands in the bottom-left/right corner of the editor, over the code. Clicks pass through to the code. |
| `inline` | Documented properties only (`contentIconPath`, `margin`) | Character stands just after the end of the last visible line's text; position depends on that line's length. |

### 3.3 Components (for Phase 2+)

- **Extension host:** timer, configuration, commands, status bar, session state machine (`enter → idle → ack | dismiss → gone`).
- **Stage renderer (`stage.ts`):** pure function `options → SVG string`; no VS Code imports, unit-testable.
- **Character library:** one module per animal exposing its drawing and pivot points.
- **Fallback stage (recommended):** a small `WebviewView` used *only* when no text editor is visible (e.g. Settings, an image, the welcome page). It will be described honestly as a panel, not an overlay.

## 4. Limitations to accept before approval

1. **No clicking the character.** Decorations deliver no pointer events to extensions. Actions are status bar buttons, shortcuts (`Ctrl+Alt+D`, `Ctrl+Alt+X`) and commands.
2. **`floating` mode relies on undocumented behaviour.** VS Code copies the `textDecoration` string into CSS verbatim, which lets extra declarations through. It goes through the official API and has been used by published extensions for years (Power Mode since 2016), but it is not a documented contract and could be tightened. `inline` mode is the documented-only fallback and can be switched to automatically.
3. **The character cannot cross the whole editor.** The API does not report the editor's pixel width, so the stage is a fixed-size box docked to one side. The character walks in from that edge and **leaves by the same edge** (it turns around). "Exit on the opposite side" would end in mid-editor, so it is not offered.
4. **Needs a visible text editor.** No editor → nothing to decorate (hence the fallback in 3.3).
5. **Anchor quirks.** The character stands on the last visible line. In a file shorter than the window it stands at the end of the file, not the bottom of the pane. With word wrap off and very long lines, a right-docked character sits at the right end of the scrollable width.
6. **One editor at a time.** It follows the active editor; on switching editors the stage is re-attached.
7. **Theme change mid-reminder** is not re-rendered (it would restart the animation); colours update on the next phase.
8. **"Falling" and "pop-up" entries** work inside the stage box only (drop from the top of the 210 px stage, rise from its bottom edge), not from the top of the editor.

## 5. What has and has not been verified

Verified here:

- The stage SVGs render and animate correctly in headless Chromium when loaded exactly the way a decoration loads them (`content: url(data:…)` on an absolutely positioned `::after`), for left/right entry, bubble, acknowledge and dismiss. See `simulation-preview.png` — a Chromium simulation, **not** a VS Code screenshot.
- Both source files transpile; `stage.ts` passes strict type-checking.

**Not verified — I could not run VS Code in my environment:**

- The PoC has not been launched in VS Code on Windows or macOS.
- `extension.ts` has not been type-checked against `@types/vscode` (no package downloads were possible).

Please run the checklist in the README on both platforms; the items most likely to need adjustment are flagged there.

## 6. Decisions needed before Phase 2

1. Accept status bar / shortcut actions instead of buttons on the bubble?
2. Ship `floating` as default with automatic `inline` fallback, or documented-only `inline`?
3. Include the `WebviewView` fallback for when no text editor is open?
4. Timer rule proposal: the next interval starts when the reminder is **acknowledged, dismissed or expires** (never while one is on screen), which also prevents stacked reminders after sleep/resume.
