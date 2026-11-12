/** Extension host: lifecycle, commands, configuration, timer wiring, status bar. */
import * as vscode from 'vscode';
import { CHARACTERS } from './characters';
import { formatRemaining, INTERVAL_PRESETS, normalize, SETTING_KEYS, Settings } from './config';
import { Presenter } from './presenter';
import { Entry, ExitSetting } from './render/animations';
import { ReminderTimer, TimerSnapshot } from './timer';

const SECTION = 'waterReminder';
const STATE_KEY = 'waterReminder.timer';

const ENTRY_LABELS: Record<Entry, string> = {
  walk: 'Walk in from the left',
  slide: 'Slide in from the left',
  bounce: 'Bounce in from the left',
  fall: 'Drop gently from above',
  sprout: 'Sprout from the bottom (breaks through the ground)',
};
const EXIT_LABELS: Record<ExitSetting, string> = {
  auto: 'Automatic (leave the way it came)',
  walk: 'Walk away',
  slide: 'Slide away',
  bounce: 'Bounce away',
  burrow: 'Burrow back into the ground',
};

function readSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const raw: Partial<Record<keyof Settings, unknown>> = {};
  for (const key of SETTING_KEYS) raw[key] = cfg.get(key);
  return normalize(raw);
}

const setSetting = (key: keyof Settings, value: unknown) =>
  vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);

export function activate(ctx: vscode.ExtensionContext): void {
  let pending = false; // a reminder is due but could not be shown yet

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'waterReminder.menu';
  const ackItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  ackItem.text = "💧 I've had a drink!";
  ackItem.command = 'waterReminder.acknowledge';
  ackItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  const dismissItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
  dismissItem.text = '$(close) Dismiss';
  dismissItem.command = 'waterReminder.dismiss';

  const presenter = new Presenter(
    (fromTimer) => { if (fromTimer) timer.finished(); },
    (visible) => {
      void vscode.commands.executeCommand('setContext', 'waterReminder.visible', visible);
      if (visible) { ackItem.show(); dismissItem.show(); } else { ackItem.hide(); dismissItem.hide(); }
    },
  );

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
    () => { pending = true; tryShowPending(); },
    () => { void ctx.globalState.update(STATE_KEY, timer.snapshot()); refreshStatus(); },
  );

  /** Show a due reminder as soon as this window is focused and has a text editor. */
  function tryShowPending(): void {
    if (!pending || timer.state !== 'due') { pending = false; return; }
    if (!vscode.window.state.focused || !vscode.window.activeTextEditor) return; // wait
    pending = false;
    if (!presenter.show(readSettings(), true)) pending = true;
  }

  function showNow(settings: Settings): void {
    if (!presenter.show(settings, false)) {
      void vscode.window.showInformationMessage('Water Reminder: open a text file first. The character appears inside a text editor.');
    }
  }

  const intervalMs = () => readSettings().intervalMinutes * 60_000;

  async function pick<T extends string>(title: string, items: { label: string; value: T; description?: string }[]): Promise<T | undefined> {
    const choice = await vscode.window.showQuickPick(items, { title, placeHolder: title });
    return choice?.value;
  }

  const commands: Record<string, () => unknown> = {
    'waterReminder.start': async () => { await setSetting('enabled', true); pending = false; timer.start(intervalMs()); },
    'waterReminder.pause': () => { pending = false; timer.pause(); },
    'waterReminder.resume': () => {
      if (timer.state === 'paused') timer.resume();
      else if (timer.state === 'stopped') return commands['waterReminder.start']();
    },
    'waterReminder.reset': () => { pending = false; timer.reset(); },
    'waterReminder.test': () => showNow(readSettings()),
    'waterReminder.acknowledge': () => presenter.acknowledge(),
    'waterReminder.dismiss': () => presenter.dismiss(),
    'waterReminder.openSettings': () => vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${ctx.extension.id}`),

    'waterReminder.preview': async () => {
      const s = readSettings();
      const character = await pick('Preview: character', CHARACTERS.map((c) => ({ label: c.label, value: c.id, description: c.id === s.character ? 'current' : undefined })));
      if (!character) return;
      const entry = await pick<Entry>('Preview: entry animation', (Object.keys(ENTRY_LABELS) as Entry[]).map((e) => ({ label: ENTRY_LABELS[e], value: e, description: e === s.entryAnimation ? 'current' : undefined })));
      if (!entry) return;
      showNow({ ...s, character, entryAnimation: entry, exitAnimation: 'auto', displaySeconds: Math.min(s.displaySeconds, 8) });
    },

    'waterReminder.changeCharacter': async () => {
      const s = readSettings();
      const character = await pick('Choose your character', CHARACTERS.map((c) => ({ label: c.label, value: c.id, description: c.id === s.character ? 'current' : undefined })));
      if (!character) return;
      await setSetting('character', character);
      showNow({ ...s, character, displaySeconds: Math.min(s.displaySeconds, 8) });
    },

    'waterReminder.changeAnimation': async () => {
      const s = readSettings();
      const entry = await pick<Entry>('How should the character arrive?', (Object.keys(ENTRY_LABELS) as Entry[]).map((e) => ({ label: ENTRY_LABELS[e], value: e, description: e === s.entryAnimation ? 'current' : undefined })));
      if (!entry) return;
      const exit = await pick<ExitSetting>('How should it leave?', (Object.keys(EXIT_LABELS) as ExitSetting[]).map((e) => ({ label: EXIT_LABELS[e], value: e, description: e === s.exitAnimation ? 'current' : undefined })));
      if (!exit) return;
      await setSetting('entryAnimation', entry);
      await setSetting('exitAnimation', exit);
      showNow({ ...s, entryAnimation: entry, exitAnimation: exit, displaySeconds: Math.min(s.displaySeconds, 8) });
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
        { label: '$(gear) Open settings', value: 'waterReminder.openSettings' },
      ]);
      if (cmd) return commands[cmd]();
    },
  };

  const ticker = setInterval(refreshStatus, 15_000);

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
    vscode.window.onDidChangeWindowState(() => tryShowPending()),
    vscode.window.onDidChangeActiveTextEditor(() => tryShowPending()),
    { dispose: () => { clearInterval(ticker); timer.dispose(); } },
  );

  // Start, or continue where we left off before the window was reloaded.
  const settings = readSettings();
  const saved = ctx.globalState.get<TimerSnapshot>(STATE_KEY);
  if (!settings.enabled) timer.stop();
  else if (saved && saved.state !== 'stopped' && saved.intervalMs === settings.intervalMinutes * 60_000) timer.restore(saved);
  else timer.start(settings.intervalMinutes * 60_000);
}

export function deactivate(): void {
  /* everything is disposed through context.subscriptions */
}
