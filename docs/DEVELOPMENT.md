# Animated Water Reminder — development notes

A little animal friend walks into your VS Code editor, or sprouts out of the ground, to remind you to drink water. It lives inside the text editor itself: no separate app, no extra window.

## Quick start (no build needed)

1. Open this folder in VS Code (the folder that contains `package.json`).
2. Press **F5**. A second window opens, titled **[Extension Development Host]**.
3. In that second window, open any code file.
4. Press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) and run **Water Reminder: Test Reminder**.
5. Click **💧 I've had a drink!** in the status bar, or **✕ Dismiss**.

To see the ground-breaking entry: run **Water Reminder: Change Animation** and pick **Sprout from the bottom**.

## Commands

| Command | What it does |
|---|---|
| Water Reminder: Start / Pause / Resume / Reset Timer | Control the countdown |
| Water Reminder: Set Interval | 15, 30, 45, 60, 90 minutes, or any custom value |
| Water Reminder: Test Reminder | Show a reminder now with your current settings |
| Water Reminder: Preview Character | Try any character and animation without saving |
| Water Reminder: Change Character | Pick and save a character |
| Water Reminder: Change Animation | Pick and save how it arrives and leaves |
| Water Reminder: Open Settings | All settings in one place |

The **💧 24m** item at the right of the status bar shows the time left; click it for a menu.
While the character is visible: `Ctrl+Alt+D` = "I've had a drink!", `Ctrl+Alt+X` = dismiss.

## Settings (`waterReminder.*`)

| Setting | Values | Default |
|---|---|---|
| `enabled` | on / off | on |
| `intervalMinutes` | 1 – 1440 | 30 |
| `displaySeconds` | 3 – 600: how long it waits for you | 20 |
| `character` | elephant, cat, dog, rabbit, panda, bear | elephant |
| `entryAnimation` | walk, slide, bounce, fall, sprout | walk |
| `exitAnimation` | auto, walk, slide, bounce, burrow | auto |
| `size` | small, medium, large | medium |
| `speed` | slow, normal, fast | normal |
| `messages` | your own list of messages (empty = the 20 built-in ones; keep each under 90 characters) | empty |
| `renderMode` | floating, inline | floating |

## How the timer behaves

- The next interval starts when a reminder **ends** (acknowledged, dismissed, or timed out).
- After sleep or a long pause you get one reminder, never a pile of them.
- The countdown survives a window reload. Pause stays paused.
- If no text file is open, or VS Code is in the background, the reminder waits and appears as soon as you are back in a text editor.
- Changing the interval restarts the countdown.

## Known limits

- The character cannot be clicked; use the status bar buttons or shortcuts.
- It needs an open text editor to appear in.
- It always uses the bottom-left corner and leaves by the left or into the ground.
- With several VS Code windows open, each window keeps its own countdown; only the focused one shows a reminder.
- `floating` mode relies on VS Code behaviour that is not formally documented. If it ever stops working after an update, switch `renderMode` to `inline`.

Details: `FEASIBILITY.md` (written for Phase 1; the "enter from right" option it mentions has since been removed).

## Build, test, package

Needs [Node.js](https://nodejs.org) 20 or newer.

```
npm install
npm test          # compiles, then runs the unit tests
npm run package   # creates animated-water-reminder-0.1.0.vsix
```

Install the `.vsix`: Extensions view → `…` menu → **Install from VSIX…**

The author is set to **Deepu G Nair**. The `publisher` field is `deepu-g-nair` because VS Code publisher IDs cannot contain spaces; before publishing to the Marketplace, make sure it matches the publisher ID you create there.

## Manual test checklist (Windows 10/11, macOS Intel / Apple Silicon)

| # | Check | Expected |
|---|---|---|
| 1 | Test Reminder with each of the 5 entry animations | Smooth entry, then speech bubble |
| 2 | Slide | Character slips in leaning back with arms flailing, overbalances, wobbles and recovers; on exit its feet slip and it slides away backwards |
| 2b | Sprout | Cracks and a dirt mound appear, a leaf pokes out, the character pushes up in stages, dirt flies, the leaf drops off |
| 3 | Acknowledge after sprout | Happy hops, "Yay!", then it burrows back down and the mound disappears |
| 4 | Each of the 6 characters | Looks right in a light and a dark theme |
| 5 | Size small / large, speed slow / fast | Scales and timing change |
| 6 | Type, click and scroll while visible | Editor behaves normally; character stays at the bottom |
| 7 | Split the editor and click the other group | Character moves to the active editor |
| 8 | Resize the window / drag the panel | Character stays in the corner |
| 9 | Set Interval → Custom → 1; wait | Reminder appears after 1 minute; countdown restarts only after it leaves |
| 10 | Pause, wait, Resume | Remaining time is kept |
| 11 | Developer: Reload Window mid-countdown | Countdown continues, not restarted |
| 12 | Close all editors when a reminder is due | Appears when you next open a text file |
| 13 | Custom `messages` | Only your messages are used |
| 14 | Help → Open Process Explorer while idle | Extension host CPU stays at ~0% |

## Adding a character

1. Copy `src/characters/bear.ts` to `src/characters/fox.ts` and edit the colours, ears and face.
2. Register it in `src/characters/index.ts`.
3. Add `"fox"` to the `waterReminder.character` enum in `package.json`.

Every animation works with the new character automatically.

## Project layout

```
src/extension.ts          commands, settings, status bar, timer wiring
src/timer.ts              countdown logic (no VS Code dependency)
src/config.ts             settings validation, messages
src/presenter.ts          puts the character in the editor (decorations)
src/render/stage.ts       animation engine: builds the self-animating SVG
src/render/animations.ts  animation names, durations, speed and size tables
src/characters/           one file per animal + shared body rig
src/test/                 unit tests (node:test)
```
