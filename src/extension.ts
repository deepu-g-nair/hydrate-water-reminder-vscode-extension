/** Extension host: lifecycle, commands, configuration, timer wiring, status bar. */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CHARACTERS } from './characters';
import { formatRemaining, INTERVAL_PRESETS, normalize, pickMessage, SETTING_KEYS, Settings, SOUND_STYLES, SoundStyle } from './config';
import { RESET_MARKER_KEY, resetSavedSettingsOnce } from './migrate';
import { notify, playSound } from './os';
import { Presenter } from './presenter';
import { ENTRIES, Entry, EntrySetting, EXITS, ExitSetting } from './render/animations';
import { SharedBus } from './shared';
import { ReminderTimer, TimerSnapshot } from './timer';

const SECTION = 'waterReminder';
const STATE_KEY = 'waterReminder.timer';
const NOTIFY_TITLE = 'Time for some water 💧';

const ENTRY_LABELS: Record<Entry, string> = {
  walk: 'Walk in',
  slide: 'Slip in on a wet floor',
  bounce: 'Bounce in',
  fall: 'Drop in from above',
  sprout: 'Sprout from the ground',
  roll: 'Roll in like a ball',
  balloon: 'Float down with a balloon',
  faraway: 'Run in from far away',
  poof: 'Appear in a puff of smoke',
  peek: 'Peek in, then hop out',
};
const EXIT_LABELS: Record<ExitSetting, string> = {
  auto: 'Automatic (leave the way it came)',
  walk: 'Wave and walk away',
  slide: 'Slip and slide away',
  bounce: 'Wave and bounce away',
  burrow: 'Burrow back into the ground',
  roll: 'Curl up and roll away',
  float: 'Float away with a balloon',
  faraway: 'Run off into the distance',
  poof: 'Vanish in a puff of smoke',
};

const SOUND_LABELS: Record<SoundStyle, string> = {
  modern: 'Modern: soft glass chime',
  elegant: 'Elegant: gentle strummed chord',
  warm: 'Warm: wooden marimba',
  water: 'Water: two droplets',
  minimal: 'Minimal: one soft tap',
};

function readSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const raw: Partial<Record<keyof Settings, unknown>> = {};
  for (const key of SETTING_KEYS) raw[key] = cfg.get(key);
  return normalize(raw);
}

const setSetting = (key: keyof Settings, value: unknown) =>
  vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  // --- one-time settings reset ---------------------------------------------------------------
  // 0.3.0 changes most defaults. The first time it runs, every saved Water Reminder setting is
  // cleared so everyone starts from the new defaults. The marker is synced with Settings Sync,
  // so a second computer does not wipe choices made after the reset.
  try { ctx.globalState.setKeysForSync([RESET_MARKER_KEY]); } catch { /* older editors */ }
  const wiped = await resetSavedSettingsOnce(
    ctx.globalState, vscode.workspace.getConfiguration(SECTION), SETTING_KEYS, vscode.ConfigurationTarget.Global, [STATE_KEY]);
  if (wiped.length) {
    void vscode.window.showInformationMessage(
      'Hydrate was updated. Your Water Reminder settings were reset to the new defaults.', 'Open Settings',
    ).then((choice) => { if (choice) void vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${ctx.extension.id}`); });
  }

  // --- reminder that is due but not on screen yet -------------------------------------------
  let pending = false;        // a reminder is due and still has to be shown in this window
  // Decided once per reminder, at the moment it becomes due:
  //   'yes'  VS Code was not in front and this window was chosen to notify and show the character
  //   'no'   another VS Code window was in front (or another window was chosen): wait for focus
  let background: 'undecided' | 'yes' | 'no' = 'undecided';
  let dueMessage: string | undefined;
  let lastMessage: string | undefined;

  const play = (name: 'in' | 'out', style: SoundStyle) => playSound(path.join(ctx.extensionPath, 'media', `${style}-${name}.wav`));

  const bus = new SharedBus(path.join(ctx.globalStorageUri.fsPath, 'bus'), vscode.env.sessionId);

  // --- status bar ---------------------------------------------------------------------------
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'waterReminder.menu';
  const ackItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  ackItem.text = "💧 I've had a drink!";
  ackItem.command = 'waterReminder.acknowledge';
  ackItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  const dismissItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
  dismissItem.text = '$(close) Dismiss';
  dismissItem.command = 'waterReminder.dismiss';

  const presenter = new Presenter({
    onEnd: (fromTimer) => { if (fromTimer) timer.finished(); },
    onVisibility: (awaiting) => {
      void vscode.commands.executeCommand('setContext', 'waterReminder.visible', awaiting);
      if (awaiting) { ackItem.show(); dismissItem.show(); } else { ackItem.hide(); dismissItem.hide(); }
    },
    onAnswer: (_kind, fromTimer, quiet) => {
      if (!fromTimer) return;
      timer.finished();            // the next interval starts the moment the reminder is answered
      if (!quiet) bus.post('ack'); // and every other window is told, so nobody reminds twice
    },
    sound: (name, style) => play(name, style),
  });

  const refreshStatus = () => {
    switch (timer.state) {
      case 'running': status.text = `💧 ${formatRemaining(timer.remainingMs())}`; status.tooltip = 'Water Reminder: time until the next reminder'; break;
      case 'paused': status.text = '💧 paused'; status.tooltip = `Water Reminder: paused with ${formatRemaining(timer.remainingMs())} left`; break;
      case 'due': status.text = '💧 now!'; status.tooltip = 'Water Reminder: time for a drink'; break;
      default: status.text = '💧 off'; status.tooltip = 'Water Reminder: off';
    }
    status.show();
  };

  const timer: ReminderTimer = new ReminderTimer(
    { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    () => {
      pending = true;
      background = 'undecided';
      dueMessage = lastMessage = pickMessage(readSettings(), lastMessage);
      tryShowPending();
    },
    () => { void ctx.globalState.update(STATE_KEY, timer.snapshot()); refreshStatus(); },
  );

  /**
   * Show a due reminder.
   *  - This window is in front: show the character here.
   *  - Another VS Code window is in front: wait; the user will see it there, or here when they switch.
   *  - No VS Code window is in front (the user is in another app): ONE window sends a system
   *    notification and shows the character in the background, ready for when the user comes back.
   */
  function tryShowPending(): void {
    if (!pending) return;
    if (timer.state !== 'due') { pending = false; return; }
    const s = readSettings();
    if (!vscode.window.state.focused && background !== 'yes') {
      if (background === 'no') return;
      if (bus.anyWindowFocused() || !bus.claim('notify', 10_000)) { background = 'no'; return; }
      background = 'yes';
      if (s.systemNotification) notify(NOTIFY_TITLE, dueMessage ?? 'Time to drink some water.');
    }
    if (!vscode.window.activeTextEditor) return; // the character needs a text editor; wait for one
    if (presenter.show(s, { fromTimer: true, message: dueMessage })) pending = false;
  }

  /** Apply what happened in other VS Code windows. */
  function sync(): void {
    const news = bus.poll();
    if (news.ack) {
      pending = false;
      if (presenter.awaitingAnswer && presenter.fromTimer) presenter.dismissQuietly();
      timer.finished();
      timer.startAt(news.ack + timer.interval);
    }
    if (news.pause) { pending = false; timer.pause(); }
    if (news.resume) timer.resume();
    if (news.reset) { pending = false; timer.reset(); }
    tryShowPending();
  }

  function showNow(settings: Settings, entry?: Entry): void {
    if (!presenter.show(settings, { fromTimer: false, entry })) {
      void vscode.window.showInformationMessage('Water Reminder: open a text file first. The character appears inside a text editor.');
    }
  }
  /** Previews leave by themselves so that trying things out never needs a click. */
  const preview = (s: Settings, entry?: Entry) => showNow({ ...s, autoClose: true, displaySeconds: Math.min(s.displaySeconds, 8) }, entry);

  const intervalMs = () => readSettings().intervalMinutes * 60_000;

  async function pick<T extends string>(title: string, items: { label: string; value: T; description?: string }[]): Promise<T | undefined> {
    const choice = await vscode.window.showQuickPick(items, { title, placeHolder: title });
    return choice?.value;
  }
  const entryItems = (current: EntrySetting) =>
    ENTRIES.map((e) => ({ label: ENTRY_LABELS[e], value: e, description: e === current ? 'current' : undefined }));

  const commands: Record<string, () => unknown> = {
    'waterReminder.start': async () => { await setSetting('enabled', true); pending = false; timer.start(intervalMs()); bus.post('reset'); },
    'waterReminder.pause': () => { pending = false; timer.pause(); bus.post('pause'); },
    'waterReminder.resume': () => {
      if (timer.state === 'paused') { timer.resume(); bus.post('resume'); }
      else if (timer.state === 'stopped') return commands['waterReminder.start']();
    },
    'waterReminder.reset': () => { pending = false; timer.reset(); bus.post('reset'); },
    'waterReminder.test': () => showNow(readSettings()),
    'waterReminder.acknowledge': () => presenter.acknowledge(),
    'waterReminder.dismiss': () => presenter.dismiss(),
    'waterReminder.openSettings': () => vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${ctx.extension.id}`),

    'waterReminder.preview': async () => {
      const s = readSettings();
      const character = await pick('Preview: character', CHARACTERS.map((c) => ({ label: c.label, value: c.id, description: c.id === s.character ? 'current' : undefined })));
      if (!character) return;
      const entry = await pick<Entry>('Preview: animation', entryItems(s.entryAnimation));
      if (!entry) return;
      preview({ ...s, character, exitAnimation: 'auto' }, entry);
    },

    'waterReminder.changeCharacter': async () => {
      const s = readSettings();
      const character = await pick('Choose your character', CHARACTERS.map((c) => ({ label: c.label, value: c.id, description: c.id === s.character ? 'current' : undefined })));
      if (!character) return;
      await setSetting('character', character);
      preview({ ...s, character });
    },

    'waterReminder.changeAnimation': async () => {
      const s = readSettings();
      const entry = await pick<EntrySetting>('How should the character arrive?', [
        { label: '$(sparkle) Surprise me: a different style every time', value: 'random', description: s.entryAnimation === 'random' ? 'current' : undefined },
        ...entryItems(s.entryAnimation),
      ]);
      if (!entry) return;
      if (entry === 'random') {
        await setSetting('entryAnimation', 'random');
        await setSetting('exitAnimation', 'auto');
        preview({ ...s, entryAnimation: 'random', exitAnimation: 'auto' });
        return;
      }
      const exit = await pick<ExitSetting>('How should it leave?', EXITS.map((e) => ({ label: EXIT_LABELS[e], value: e, description: e === s.exitAnimation ? 'current' : undefined })));
      if (!exit) return;
      await setSetting('entryAnimation', entry);
      await setSetting('exitAnimation', exit);
      preview({ ...s, entryAnimation: entry, exitAnimation: exit });
    },

    'waterReminder.changeSound': async () => {
      const s = readSettings();
      const choice = await pick<SoundStyle | 'off'>('Reminder sound', [
        ...SOUND_STYLES.map((st) => ({ label: SOUND_LABELS[st], value: st, description: s.sound && st === s.soundStyle ? 'current' : undefined })),
        { label: 'No sound', value: 'off', description: s.sound ? undefined : 'current' },
      ]);
      if (!choice) return;
      if (choice === 'off') { await setSetting('sound', false); return; }
      await setSetting('sound', true);
      await setSetting('soundStyle', choice);
      play('in', choice); // let them hear what they picked
    },

    'waterReminder.setInterval': async () => {
      const current = readSettings().intervalMinutes;
      const choice = await pick('Remind me every…', [
        ...INTERVAL_PRESETS.map((m) => ({ label: `${m} minutes`, value: String(m), description: m === current ? 'current' : undefined })),
        { label: 'Custom…', value: 'custom' },
      ]);
      if (!choice) return;
      let minutes = Number(choice);
      if (choice === 'custom') {
        const input = await vscode.window.showInputBox({
          title: 'Reminder interval in minutes', value: String(current),
          validateInput: (v) => (/^\d+(\.\d+)?$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 1440 ? undefined : 'Enter a number of minutes between 1 and 1440'),
        });
        if (!input) return;
        minutes = Number(input);
      }
      await setSetting('intervalMinutes', minutes); // the configuration listener restarts the countdown
    },

    'waterReminder.menu': async () => {
      const running = timer.state === 'running' || timer.state === 'due';
      const cmd = await pick('Water Reminder', [
        running ? { label: '$(debug-pause) Pause', value: 'waterReminder.pause' } : { label: '$(play) Start / Resume', value: 'waterReminder.resume' },
        { label: '$(refresh) Reset timer', value: 'waterReminder.reset' },
        { label: '$(watch) Set interval…', value: 'waterReminder.setInterval' },
        { label: '$(eye) Test reminder now', value: 'waterReminder.test' },
        { label: '$(smiley) Change character…', value: 'waterReminder.changeCharacter' },
        { label: '$(rocket) Change animation…', value: 'waterReminder.changeAnimation' },
        { label: '$(unmute) Change sound…', value: 'waterReminder.changeSound' },
        { label: '$(gear) Open settings', value: 'waterReminder.openSettings' },
      ]);
      if (cmd) return commands[cmd]();
    },
  };

  // --- housekeeping ---------------------------------------------------------------------------
  const ticker = setInterval(() => { refreshStatus(); bus.heartbeat(); sync(); }, 15_000);

  // React quickly to news from other windows; the 15 s ticker is the safety net.
  let watcher: fs.FSWatcher | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  try {
    watcher = fs.watch(bus.dir, { persistent: false }, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(sync, 80);
    });
    watcher.on('error', () => { /* fall back to the ticker */ });
  } catch { /* fall back to the ticker */ }

  ctx.subscriptions.push(
    status, ackItem, dismissItem, presenter,
    ...Object.entries(commands).map(([id, fn]) => vscode.commands.registerCommand(id, fn)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) return;
      const s = readSettings();
      if (!s.enabled) { pending = false; timer.stop(); }
      else if (timer.state === 'stopped') timer.start(s.intervalMinutes * 60_000);
      else timer.setInterval(s.intervalMinutes * 60_000);
    }),
    vscode.window.onDidChangeWindowState((w) => {
      bus.setFocused(w.focused);
      sync();
      if (w.focused) presenter.nudge(); // "welcome back": wave at the user if still waiting
    }),
    vscode.window.onDidChangeActiveTextEditor(() => tryShowPending()),
    {
      dispose: () => {
        clearInterval(ticker);
        if (debounce) clearTimeout(debounce);
        watcher?.close();
        timer.dispose();
        bus.dispose();
      },
    },
  );

  // Start, or continue where we left off before the window was reloaded.
  bus.setFocused(vscode.window.state.focused);
  const settings = readSettings();
  const saved = ctx.globalState.get<TimerSnapshot>(STATE_KEY);
  if (!settings.enabled) timer.stop();
  else if (saved && saved.state !== 'stopped' && saved.intervalMs === settings.intervalMinutes * 60_000) timer.restore(saved);
  else timer.start(settings.intervalMinutes * 60_000);
}

export function deactivate(): void {
  /* everything is disposed through context.subscriptions */
}
