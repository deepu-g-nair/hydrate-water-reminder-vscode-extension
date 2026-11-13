export type Entry = 'walk' | 'slide' | 'bounce' | 'fall' | 'sprout' | 'roll' | 'balloon' | 'faraway' | 'poof' | 'peek';
export type Exit = 'walk' | 'slide' | 'bounce' | 'burrow' | 'roll' | 'float' | 'faraway' | 'poof';
export type ExitSetting = 'auto' | Exit;
export type EntrySetting = 'random' | Entry;
export type Speed = 'slow' | 'normal' | 'fast';
export type Size = 'small' | 'medium' | 'large';

export const ENTRIES: readonly Entry[] = ['walk', 'slide', 'bounce', 'fall', 'sprout', 'roll', 'balloon', 'faraway', 'poof', 'peek'];
export const ENTRY_SETTINGS: readonly EntrySetting[] = ['random', ...ENTRIES];
export const EXITS: readonly ExitSetting[] = ['auto', 'walk', 'slide', 'bounce', 'burrow', 'roll', 'float', 'faraway', 'poof'];
export const SPEED: Record<Speed, number> = { slow: 1.5, normal: 1, fast: 0.65 };
export const SIZE: Record<Size, number> = { small: 0.75, medium: 1, large: 1.3 };

const ENTER_MS: Record<Entry, number> = {
  walk: 2200, slide: 1900, bounce: 2100, fall: 2000, sprout: 3000, roll: 2300, balloon: 3400, faraway: 2400, poof: 1700, peek: 3600,
};
const EXIT_MS: Record<Exit, number> = {
  walk: 2300, slide: 1500, bounce: 2200, burrow: 2400, roll: 1900, float: 3000, faraway: 2500, poof: 1400,
};
const HAPPY_MS = 1600;

/** How long the character keeps moving on its own after arriving, before it settles. */
export const IDLE_MS = 30_000;
/** A "nudge" is a short attention-grabbing move made while waiting. */
export const NUDGE_MS = 2600;
export const NUDGE_IDLE_MS = 8000;
export const NUDGE_EVERY_MS = 30_000;
export const NUDGE_COUNT = 5;

/** The matching way out for each way in. */
const PAIRED_EXIT: Record<Entry, Exit> = {
  walk: 'walk', slide: 'slide', bounce: 'bounce', fall: 'walk', sprout: 'burrow',
  roll: 'roll', balloon: 'float', faraway: 'faraway', poof: 'poof', peek: 'walk',
};

/** "auto" leaves the way the character came. */
export function resolveExit(entry: Entry, exit: ExitSetting): Exit {
  return exit === 'auto' ? PAIRED_EXIT[entry] : exit;
}

/** Pick a random entry from the pool, avoiding an immediate repeat when possible. */
export function pickEntry(pool: readonly Entry[], previous?: Entry, random: () => number = Math.random): Entry {
  const valid = pool.filter((e) => ENTRIES.includes(e));
  const base = valid.length ? valid : ENTRIES;
  const choices = base.length > 1 ? base.filter((e) => e !== previous) : base;
  return choices[Math.floor(random() * choices.length) % choices.length];
}

export interface Timings { enterMs: number; happyMs: number; exitMs: number; exit: Exit; k: number }

export function timings(entry: Entry, exit: ExitSetting, speed: Speed): Timings {
  const k = SPEED[speed];
  const x = resolveExit(entry, exit);
  return { enterMs: Math.round(ENTER_MS[entry] * k), happyMs: Math.round(HAPPY_MS * k), exitMs: Math.round(EXIT_MS[x] * k), exit: x, k };
}
