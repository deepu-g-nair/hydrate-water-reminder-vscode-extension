/**
 * Sound and system notifications.
 *
 * VS Code has no API for either, so these use tools that ship with each
 * operating system (nothing is bundled or installed):
 *   Windows: powershell.exe      macOS: afplay / osascript      Linux: paplay|aplay / notify-send
 *
 * Text that comes from settings (the reminder message) is never placed in a
 * command line or script. It travels as an environment variable (Windows) or
 * as a separate argument (macOS, Linux), so it cannot be run as code.
 */
import { spawn } from 'child_process';

export interface Cmd {
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  /** Tried if `cmd` is not installed. */
  fallback?: Cmd;
}

const powershell = (script: string, env: Record<string, string>): Cmd => ({
  cmd: 'powershell.exe',
  // -EncodedCommand takes the script as base64 UTF-16, which avoids every quoting problem.
  args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
  env,
});

const WIN_SOUND = '(New-Object System.Media.SoundPlayer $env:WR_SOUND).PlaySync()';

// A silent toast (the extension plays its own sound). Falls back to a tray balloon
// on systems where the toast API is not available to PowerShell.
const WIN_TOAST = `
$ErrorActionPreference = 'Stop'
try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  $xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text></text><text></text></binding></visual><audio silent="true"/></toast>')
  $nodes = $xml.GetElementsByTagName('text')
  $nodes.Item(0).AppendChild($xml.CreateTextNode($env:WR_TITLE)) | Out-Null
  $nodes.Item(1).AppendChild($xml.CreateTextNode($env:WR_BODY)) | Out-Null
  $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
  $app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show($toast)
} catch {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $icon = New-Object System.Windows.Forms.NotifyIcon
  $icon.Icon = [System.Drawing.SystemIcons]::Information
  $icon.Visible = $true
  $icon.ShowBalloonTip(8000, $env:WR_TITLE, $env:WR_BODY, [System.Windows.Forms.ToolTipIcon]::None)
  Start-Sleep -Seconds 9
  $icon.Dispose()
}`;

/** Command that plays a WAV file, or undefined on an unsupported platform. */
export function soundCommand(platform: string, file: string): Cmd | undefined {
  switch (platform) {
    case 'win32': return powershell(WIN_SOUND, { WR_SOUND: file });
    case 'darwin': return { cmd: 'afplay', args: [file] };
    case 'linux': return { cmd: 'paplay', args: [file], fallback: { cmd: 'aplay', args: ['-q', file] } };
    default: return undefined;
  }
}

/** Command that shows a system notification, or undefined on an unsupported platform. */
export function notifyCommand(platform: string, title: string, body: string): Cmd | undefined {
  switch (platform) {
    case 'win32': return powershell(WIN_TOAST, { WR_TITLE: title, WR_BODY: body });
    case 'darwin': return {
      cmd: 'osascript',
      args: ['-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', title, body],
    };
    case 'linux': return { cmd: 'notify-send', args: ['-a', 'Hydrate', '--', title, body] };
    default: return undefined;
  }
}

/** Run a command in the background. Never throws; a missing tool is silently skipped. */
export function run(c: Cmd | undefined, spawnFn: typeof spawn = spawn): void {
  if (!c) return;
  try {
    const child = spawnFn(c.cmd, c.args, { env: { ...process.env, ...c.env }, stdio: 'ignore', windowsHide: true });
    child.on('error', () => run(c.fallback, spawnFn));
    child.unref();
  } catch {
    run(c.fallback, spawnFn);
  }
}

export const playSound = (file: string) => run(soundCommand(process.platform, file));
export const notify = (title: string, body: string) => run(notifyCommand(process.platform, title, body));
