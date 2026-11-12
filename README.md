# Hydrate: Animated Water Reminder

A little animal friend visits your editor to remind you to drink water.

Instead of a plain notification, a cute character walks, bounces, slips or sprouts out of the ground right inside your code editor, holds up a glass of water, and waits for you to take a sip. You can keep typing the whole time.

## Features

- **Six friends:** Baby Elephant, Cat, Dog, Rabbit, Panda and Bear.
- **Five ways to arrive:** walk in, slip in on a wet floor, bounce in, drop from above, or sprout from the ground like a little tree.
- **Lively reactions:** a happy dance and a different cheerful message each time you have had your drink.
- **20 built-in messages**, some friendly, some a bit sarcastic. Or write your own.
- **Your schedule:** remind every 15, 30, 45, 60 or 90 minutes, or any interval you like.
- **Stays out of your way:** clicks pass straight through the character to your code, and it leaves by itself if you are busy.
- **Light on resources:** no extra windows or background apps.

## Getting started

After installing, the countdown starts automatically. Look for **💧 30m** at the right of the status bar: that is the time until your next reminder.

To see your friend right away:

1. Open any code or text file.
2. Press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`).
3. Run **Water Reminder: Test Reminder**.

When the character appears:

- Click **💧 I've had a drink!** in the status bar (or press `Ctrl+Alt+D`) once you have had some water.
- Click **✕ Dismiss** (or press `Ctrl+Alt+X`) to send it away.
- Or do nothing, and it leaves on its own after a short while.

## Make it yours

Click the **💧** item in the status bar for a quick menu, or use these commands from the Command Palette:

| Command | What it does |
|---|---|
| Water Reminder: Change Character | Choose your friend |
| Water Reminder: Change Animation | Choose how it arrives and leaves |
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
| Display Seconds | How long the character waits for you | 20 |
| Character | Elephant, Cat, Dog, Rabbit, Panda or Bear | Elephant |
| Entry Animation | Walk, Slide, Bounce, Fall or Sprout | Slide |
| Exit Animation | Automatic, Walk, Slide, Bounce or Burrow | Slide |
| Size | Small, Medium or Large | Medium |
| Speed | Slow, Normal or Fast | Normal |
| Messages | Your own reminder messages | Built-in messages |
| Render Mode | Floating or Inline (see Troubleshooting) | Floating |

### Custom messages

Add your own lines in `settings.json`. One is picked at random each time. Keep each under 90 characters so it fits in the speech bubble.

```json
"waterReminder.messages": [
  "Water. Now. Please.",
  "Your future self says thanks for drinking."
]
```

## Good to know

- The next countdown starts when a reminder ends, so reminders never pile up, even after your computer has been asleep.
- The countdown continues after you reload the window.
- The character needs an open text file to appear in. If none is open, it waits and shows up when you are back in one.
- The character cannot be clicked. Use the status bar buttons or the keyboard shortcuts.
- With several VS Code windows open, only the one you are working in shows the reminder.

## Troubleshooting

**The character does not appear in the corner, or looks out of place.**
Change **Render Mode** to **Inline** in Settings. The character then stands at the end of the last visible line.

**No reminders are showing.**
Check that the status bar shows a countdown and not "off" or "paused". Run **Water Reminder: Start** to turn reminders back on.

## License

MIT

Stay hydrated! 💧
