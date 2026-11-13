# Hydrate: Animated Water Reminder

A **Visual Studio Code extension** in which a little animal friend visits your editor to remind you to drink water.

**[Get it on the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=deepugnair.hydrate-reminder-animated)**

Instead of a plain notification, a cute 3D-style character rolls, floats, bounces or sprouts out of the ground right inside your code editor, holds up a glass of water, and waits until you have had a sip. You can keep typing the whole time.

## Features

- **Ten friends:** Baby Elephant, Cat, Dog, Rabbit, Panda, Bear, Fox, Penguin, Koala and Tiger.
- **3D-style look:** soft shading, ground shadows, and characters that turn their heads and move in depth.
- **Ten ways to arrive:** walk, slip on a wet floor, bounce, drop from above, sprout from the ground, roll in like a ball, float down with a balloon, run in from far away, appear in a puff of smoke, or peek round the edge first.
- **A surprise every time:** by default a different style is picked for each reminder. Prefer one? Choose it and it stays.
- **It waits for you:** the character stays until you click **I've had a drink!**, and gives a little wave or twirl now and then so you do not forget it.
- **Sound:** a soft chime when it arrives and when it leaves, in five styles: Modern, Elegant, Warm, Water and Minimal.
- **Reaches you outside VS Code:** if you are working in another application when a reminder is due, you also get a system notification.
- **Friendly messages:** 20 reminders and 15 cheers, some of them a bit sarcastic. Or write your own.
- **Your schedule:** every 15, 30, 45, 60 or 90 minutes, or any interval you like.
- **Stays out of your way:** clicks pass straight through the character to your code.

## Install

You need [Visual Studio Code](https://code.visualstudio.com/) on Windows, macOS or Linux.

**From inside VS Code (easiest)**

1. Open VS Code.
2. Open the Extensions view: click the Extensions icon in the left bar, or press `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`).
3. Search for **Hydrate: Animated Water Reminder**.
4. Click **Install**.

**From the Marketplace website**

1. Open the [Hydrate page on the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=deepugnair.hydrate-reminder-animated).
2. Click **Install**. Your browser asks to open VS Code; allow it, then click **Install** in VS Code.

**From the command line**

```
code --install-extension deepugnair.hydrate-reminder-animated
```

**From a `.vsix` file** (for example, one attached to a GitHub release)

1. Download the `.vsix` file.
2. In VS Code, open the Extensions view, click the `…` menu at the top, and choose **Install from VSIX…**.
3. Pick the downloaded file.

Updates install automatically when you install from the Marketplace.

## Getting started

After installing, the countdown starts automatically. Look for **💧 30m** at the right of the status bar: that is the time until your next reminder.

To see your friend right away:

1. Open any code or text file.
2. Press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`).
3. Run **Water Reminder: Test Reminder**.

When the character appears:

- Click **💧 I've had a drink!** in the status bar (or press `Ctrl+Alt+D`) once you have had some water.
- Click **✕ Dismiss** (or press `Ctrl+Alt+X`) to send it away without drinking.

## Make it yours

Click the **💧** item in the status bar for a quick menu, or use these commands from the Command Palette:

| Command | What it does |
|---|---|
| Water Reminder: Change Character | Choose your friend |
| Water Reminder: Change Animation | Choose "Surprise me", or one style for arriving and leaving |
| Water Reminder: Change Sound | Hear and pick one of five sound styles, or turn sound off |
| Water Reminder: Set Interval | Choose how often you are reminded |
| Water Reminder: Preview Character | Try a character and animation without saving |
| Water Reminder: Test Reminder | Show a reminder now |
| Water Reminder: Pause / Resume | Take a break from reminders |
| Water Reminder: Reset Timer | Start the countdown again |
| Water Reminder: Start | Turn reminders on |
| Water Reminder: Open Settings | See every option |

## Settings

Search for "Water Reminder" in Settings.

| Setting | What it controls | Default |
|---|---|---|
| Enabled | Reminders on or off | On |
| Interval Minutes | Minutes between reminders (1 to 1440) | 30 |
| Auto Close | Off: the character stays until you answer. On: it leaves by itself | Off |
| Display Seconds | How long it waits when Auto Close is on | 20 |
| Character | One of the ten friends | Elephant |
| Entry Animation | Random, or one of the ten styles | Random |
| Exit Animation | Automatic (leaves the way it came), or one fixed style | Automatic |
| Random Pool | Which styles Random may pick from | All ten |
| Size | Small, Medium or Large | Medium |
| Speed | Slow, Normal or Fast | Normal |
| Messages | Your own reminder messages | Built-in messages |
| Sound | Chime when the character arrives and leaves | On |
| Sound Style | Modern, Elegant, Warm, Water or Minimal | Warm |
| System Notification | Notify you when you are in another application | On |
| Render Mode | Floating or Inline (see Troubleshooting) | Floating |

### Always use one animation

Run **Water Reminder: Change Animation** and pick any style other than "Surprise me". To get the surprises back, pick "Surprise me" again.

### Custom messages

Add your own lines in `settings.json`. One is picked at random each time. Keep each under 90 characters so it fits in the speech bubble.

```json
"waterReminder.messages": [
  "Water. Now. Please.",
  "Your future self says thanks for drinking."
]
```

## Good to know

- The next countdown starts when you answer a reminder, so reminders never pile up, even after your computer has been asleep.
- The countdown continues after you reload the window.
- The character needs an open text file to appear in. If none is open, it waits and shows up when you are back in one.
- The character cannot be clicked. Use the status bar buttons or the keyboard shortcuts.
- **Several VS Code windows:** you get one reminder, in the window you are working in. Answer it once and every window starts its next countdown together. Pause, Resume and Reset apply to all open windows.
- **System notifications** come from your operating system, so they follow its rules: they are hidden while Do Not Disturb or Focus is on. On Windows the notification is labelled "Windows PowerShell", and on macOS "Script Editor", because those built-in tools are used to send it.
- The "3D" is a look (shading, shadows and depth), drawn as a flat picture inside the editor. It is not a 3D model.

## Troubleshooting

**The character does not appear in the corner, or looks out of place.**
Change **Render Mode** to **Inline** in Settings. The character then stands at the end of the last visible line.

**No reminders are showing.**
Check that the status bar shows a countdown and not "off" or "paused". Run **Water Reminder: Start** to turn reminders back on.

**No sound.**
Check your system volume and that **Sound** is on in Settings. Sound uses a player that comes with your operating system (PowerShell on Windows, `afplay` on macOS, `paplay` or `aplay` on Linux). On a locked-down work computer these may be blocked; the reminder itself still works.

**No system notification.**
Notifications only appear when no VS Code window is in front. Check that notifications are allowed in your operating system settings and that Do Not Disturb is off. On Linux, `notify-send` must be installed.

**I do not want sound or system notifications.**
Turn off **Sound** or **System Notification** in Settings.

## License

MIT

Stay hydrated! 💧
