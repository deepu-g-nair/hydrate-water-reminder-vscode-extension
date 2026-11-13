/** Settings model + validation (pure: no VS Code imports). */
import { CHARACTERS, DEFAULT_CHARACTER } from './characters';
import { ENTRIES, Entry, ENTRY_SETTINGS, EntrySetting, EXITS, ExitSetting, Size, Speed } from './render/animations';

export type RenderMode = 'floating' | 'inline';
export type SoundStyle = 'modern' | 'elegant' | 'warm' | 'water' | 'minimal';
export const SOUND_STYLES: readonly SoundStyle[] = ['modern', 'elegant', 'warm', 'water', 'minimal'];

export interface Settings {
  enabled: boolean;
  intervalMinutes: number;
  /** false: the character stays until the user answers. true: it leaves after displaySeconds. */
  autoClose: boolean;
  displaySeconds: number;
  character: string;
  /** 'random' picks a different style from randomPool each time. */
  entryAnimation: EntrySetting;
  exitAnimation: ExitSetting;
  randomPool: Entry[];
  size: Size;
  speed: Speed;
  messages: string[];
  sound: boolean;
  soundStyle: SoundStyle;
  systemNotification: boolean;
  renderMode: RenderMode;
}

export const DEFAULT_MESSAGES: readonly string[] = [
  'Hey! Time for some water! 💧',
  "You've been coding for a while. Take a sip!",
  "Hydration break! Don't forget me!",
  'Your code compiles. Do your kidneys? Drink up.',
  'Coffee is not water. Nice try.',
  "You debug better hydrated. It's science. Probably.",
  'Roses are red, your mouth is dry. Drink some water.',
  'Even your laptop has a cooling system. Drink!',
  "That bug isn't going anywhere. Go get water.",
  'Plot twist: the missing semicolon was thirst.',
  'I walked all the way here. The least you can do is sip.',
  'git commit -m "drank water". Make it true.',
  'Humans are 60% water. You are slipping below spec.',
  'Stack Overflow says: have you tried drinking water?',
  "Your brain is throwing warnings. It's dehydration.",
  'One sip now saves one headache later. Good trade.',
  'Still ignoring me? Bold move for a thirsty person.',
  "Tabs or spaces? Wrong question. It's water.",
  "Ship it! By 'it' I mean water. Into your mouth.",
  "It's free, it's healthy and it's right there. Drink.",
];

/** Shown, at random, when the user says they have had a drink. */
export const ACK_MESSAGES: readonly string[] = [
  'Yay! Stay hydrated! 🎉',
  'Nice! Your brain cells are doing a happy dance.',
  'Hydration level: legendary. Carry on!',
  "That's the spirit! Now go crush that bug.",
  "Refreshed and ready. The code doesn't stand a chance.",
  'Proud of you! See you at the next water break.',
  'Achievement unlocked: Functional Human. 🏆',
  'Glug glug hooray! Back to greatness.',
  'Look at you, taking care of yourself. Love that.',
  'Water in, brilliance out. Science!',
  'Your kidneys just gave you a five-star review. ⭐',
  'One step closer to being a houseplant with skills. 🌱',
  'Well done! Future you says thanks.',
  'Top-tier hydrating. Truly elite stuff.',
  'That was the best commit you made today.',
];

/** Longest message the speech bubble shows without cutting it off (3 lines). */
export const MAX_MESSAGE_LENGTH = 90;

export const INTERVAL_PRESETS: readonly number[] = [15, 30, 45, 60, 90];

export const DEFAULTS: Settings = {
  enabled: true, intervalMinutes: 30, autoClose: false, displaySeconds: 20, character: DEFAULT_CHARACTER,
  entryAnimation: 'random', exitAnimation: 'auto', randomPool: [...ENTRIES],
  size: 'medium', speed: 'normal', messages: [], sound: true, soundStyle: 'warm', systemNotification: true, renderMode: 'floating',
};

export const SETTING_KEYS = Object.keys(DEFAULTS) as (keyof Settings)[];

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Turn whatever is in settings.json into safe values. Never throws. */
export function normalize(raw: Partial<Record<keyof Settings, unknown>>): Settings {
  const messages = Array.isArray(raw.messages)
    ? raw.messages.filter((m): m is string => typeof m === 'string').map((m) => m.trim()).filter((m) => m.length > 0).map((m) => m.slice(0, 120))
    : [];
  const pool = Array.isArray(raw.randomPool)
    ? [...new Set(raw.randomPool.filter((e): e is Entry => typeof e === 'string' && (ENTRIES as readonly string[]).includes(e)))]
    : [];
  return {
    enabled: bool(raw.enabled, DEFAULTS.enabled),
    intervalMinutes: num(raw.intervalMinutes, 1, 24 * 60, DEFAULTS.intervalMinutes),
    autoClose: bool(raw.autoClose, DEFAULTS.autoClose),
    displaySeconds: num(raw.displaySeconds, 3, 600, DEFAULTS.displaySeconds),
    character: oneOf(raw.character, CHARACTERS.map((c) => c.id), DEFAULTS.character),
    entryAnimation: oneOf(raw.entryAnimation, ENTRY_SETTINGS, DEFAULTS.entryAnimation),
    exitAnimation: oneOf(raw.exitAnimation, EXITS, DEFAULTS.exitAnimation),
    randomPool: pool.length ? pool : [...ENTRIES],
    size: oneOf<Size>(raw.size, ['small', 'medium', 'large'], DEFAULTS.size),
    speed: oneOf<Speed>(raw.speed, ['slow', 'normal', 'fast'], DEFAULTS.speed),
    messages,
    sound: bool(raw.sound, DEFAULTS.sound),
    soundStyle: oneOf(raw.soundStyle, SOUND_STYLES, DEFAULTS.soundStyle),
    systemNotification: bool(raw.systemNotification, DEFAULTS.systemNotification),
    renderMode: oneOf<RenderMode>(raw.renderMode, ['floating', 'inline'], DEFAULTS.renderMode),
  };
}

/** Pick a reminder message, avoiding an immediate repeat when possible. */
export function pickMessage(s: Settings, previous?: string, random: () => number = Math.random): string {
  return pickFrom(s.messages.length ? s.messages : DEFAULT_MESSAGES, previous, random);
}

/** Pick a celebration message for the acknowledgement, avoiding an immediate repeat. */
export function pickAckMessage(previous?: string, random: () => number = Math.random): string {
  return pickFrom(ACK_MESSAGES, previous, random);
}

function pickFrom(pool: readonly string[], previous: string | undefined, random: () => number): string {
  const choices = pool.length > 1 ? pool.filter((m) => m !== previous) : pool;
  return choices[Math.floor(random() * choices.length) % choices.length];
}

export function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 1) return '<1m';
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
