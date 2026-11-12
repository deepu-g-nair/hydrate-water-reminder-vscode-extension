export type Entry = 'walk' | 'slide' | 'bounce' | 'fall' | 'sprout';
export type ExitSetting = 'auto' | 'walk' | 'slide' | 'bounce' | 'burrow';
export type Exit = Exclude<ExitSetting, 'auto'>;
export type Speed = 'slow' | 'normal' | 'fast';
export type Size = 'small' | 'medium' | 'large';

export const ENTRIES: readonly Entry[] = ['walk', 'slide', 'bounce', 'fall', 'sprout'];
export const EXITS: readonly ExitSetting[] = ['auto', 'walk', 'slide', 'bounce', 'burrow'];
export const SPEED: Record<Speed, number> = { slow: 1.5, normal: 1, fast: 0.65 };
export const SIZE: Record<Size, number> = { small: 0.75, medium: 1, large: 1.3 };

const ENTER_MS: Record<Entry, number> = { walk: 2200, slide: 1900, bounce: 2100, fall: 2000, sprout: 3000 };
const EXIT_MS: Record<Exit, number> = { walk: 2300, slide: 1500, bounce: 2200, burrow: 2400 };
const HAPPY_MS = 1600;

/** "auto" leaves the way the character came: sprout -> burrow, fall -> walk, otherwise the same style. */
export function resolveExit(entry: Entry, exit: ExitSetting): Exit {
  if (exit !== 'auto') return exit;
  if (entry === 'sprout') return 'burrow';
  if (entry === 'fall') return 'walk';
  return entry;
}

export interface Timings { enterMs: number; happyMs: number; exitMs: number; exit: Exit; k: number }

export function timings(entry: Entry, exit: ExitSetting, speed: Speed): Timings {
  const k = SPEED[speed];
  const x = resolveExit(entry, exit);
  return { enterMs: Math.round(ENTER_MS[entry] * k), happyMs: Math.round(HAPPY_MS * k), exitMs: Math.round(EXIT_MS[x] * k), exit: x, k };
}
