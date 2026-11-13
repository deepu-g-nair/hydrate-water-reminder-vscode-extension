# Development notes

## Build, test, package

Needs [Node.js](https://nodejs.org) 20 or newer (22.12+ avoids a known problem with the packaging tool).

```
npm install
npm test          # compiles, then runs the unit tests
npm run package   # creates the .vsix
```

To try it without building: open the folder in VS Code and press **F5** (`out/` is pre-built).

## How it works

- The character is one `TextEditorDecorationType` whose `after` attachment is an SVG image. All motion is CSS animation inside that SVG, so the extension does no per-frame work.
- Each phase is a separate SVG: `enter` (arrive + idle), `wait` (a short nudge, then still), `ack` / `dismiss` (leave).
- Nothing animates forever. After arriving, the character idles for about 30 seconds, then becomes a still picture and plays a short nudge every 30 seconds. A still picture costs almost nothing.
- The 3D look is made in `render/stage.ts`: every flat fill becomes a lit gradient (`shade3d`), there is a ground shadow that reacts to height, the head has back/front depth layers that slide when it looks around, and some styles move in depth. Real 3D transforms are not available for SVG drawn as an image, so this is a look, not a model.
- Sound and system notifications have no VS Code API. `os.ts` runs tools that ship with the operating system. Text from settings is passed as an environment variable or a separate argument, never inside a command.
- `shared.ts` keeps several windows in step through a few tiny files in the extension's global storage folder.
- `migrate.ts` resets every saved setting once, the first time 0.3.0 runs. To force another reset in a later release, change `SETTINGS_RESET_VERSION`; otherwise leave it alone.

## Project layout

```
src/extension.ts          commands, settings, status bar, timer + multi-window wiring
src/timer.ts              countdown logic (no VS Code dependency)
src/config.ts             settings validation, messages
src/presenter.ts          puts the character in the editor (decorations), nudges
src/os.ts                 sound and system notification commands
src/shared.ts             coordination between VS Code windows
src/render/stage.ts       animation engine: builds the self-animating SVG
src/render/animations.ts  style names, durations, speed and size tables
src/characters/           one file per animal + shared body rig
src/test/                 unit tests (node:test)
src/migrate.ts            one-time reset of saved settings (0.3.0)
media/<style>-in.wav      generated sounds: modern, elegant, warm, water, minimal
media/<style>-out.wav
tools/make-sounds.py      regenerates the sounds (needs numpy and scipy)
```

## Adding a character

1. Copy `src/characters/bear.ts` to `src/characters/owl.ts` and edit the colours, ears and face. Use flat `fill="#rrggbb"` colours; shading is added automatically.
2. Register it in `src/characters/index.ts`.
3. Add `"owl"` to the `waterReminder.character` enum (and its label) in `package.json`.

Every animation works with the new character automatically.

## Manual test checklist (Windows 10/11, macOS Intel / Apple Silicon)

| # | Check | Expected |
|---|---|---|
| 1 | **Preview Character** with each of the 10 styles | Smooth entry, then speech bubble; ground shadow under the character |
| 2 | Each of the 10 characters, light and dark theme | Shaded, rounded look; nothing missing |
| 3 | **Test Reminder** several times with Random | A different style each time |
| 4 | **Change Animation** → Slide, then Test Reminder several times | Always slides |
| 5 | Test Reminder, then wait a minute without clicking | Character stays; idles for ~30 s, then a small move about every 30 s |
| 6 | Switch to another app and back while it waits | It waves or hops when you return |
| 7 | **I've had a drink!** | Cheer message, happy hops, leaves in the matching style |
| 8 | Turn on Auto Close, Test Reminder | Leaves by itself after Display Seconds |
| 9 | Sound on | Chime on arrival and when it starts leaving; none when Sound is off |
| 9b | **Change Sound**, pick each style | The picked sound plays once and is used for the next reminder |
| 10 | Set interval to 1 minute, switch to another app, wait | System notification appears; character is waiting in VS Code when you come back |
| 11 | Same, but stay in VS Code | No system notification; character appears |
| 12 | Two VS Code windows, 1-minute interval | One reminder, in the window in front; after answering, the other window shows nothing and both countdowns restart together |
| 13 | Two windows: Pause in one | Both show "paused"; Resume restores both |
| 14 | Type, click and scroll while the character is visible | Editor behaves normally; character stays at the bottom |
| 15 | Developer: Reload Window mid-countdown | Countdown continues |
| 16 | Close all editors when a reminder is due | Appears when you next open a text file |
| 17 | Save some settings (character, interval) with the previous version, then run this version for the first time | A notice says settings were reset; all Water Reminder settings are back to default; it does not happen again on the next start |
| 18 | Help → Open Process Explorer while a character has been waiting for over a minute | Extension host and window CPU near 0% between nudges |

Notes for checks 9 and 10 on Windows: both go through `powershell.exe`. The sound may start up to a second after the character appears. The notification is labelled "Windows PowerShell". On a locked-down machine PowerShell may be restricted, in which case there is no sound or notification but everything else works.
