/**
 * One-time reset of saved settings (pure: no VS Code imports, so it can be unit-tested).
 *
 * Version 0.3.0 changes most defaults (random animation, stay until answered,
 * sound, system notification). The first time that version runs, every Water
 * Reminder setting the user had saved is removed, so everyone starts from the
 * new defaults. It happens once: a marker records that it has been done.
 *
 * To force another reset in a future release, change SETTINGS_RESET_VERSION.
 * Leave it alone otherwise, or every update would wipe people's choices.
 */
export const SETTINGS_RESET_VERSION = '0.3.0';
export const RESET_MARKER_KEY = 'waterReminder.settingsResetFor';

export interface MementoLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export interface ConfigLike {
  inspect(key: string): { globalValue?: unknown } | undefined;
  update(key: string, value: unknown, target: unknown): PromiseLike<void>;
}

/**
 * @param keys          setting names (without the section prefix) to reset
 * @param userTarget    the "user settings" configuration target
 * @param stateKeys     saved state to forget as well (e.g. a paused countdown)
 * @returns the settings that had a saved value and were reset. Empty when
 *          nothing was saved, or when the reset has already been done.
 */
export async function resetSavedSettingsOnce(
  state: MementoLike, config: ConfigLike, keys: readonly string[], userTarget: unknown, stateKeys: readonly string[] = [],
): Promise<string[]> {
  if (state.get<string>(RESET_MARKER_KEY) === SETTINGS_RESET_VERSION) return [];
  const reset: string[] = [];
  let failed = false;
  for (const key of keys) {
    try {
      if (config.inspect(key)?.globalValue === undefined) continue; // nothing saved: already the default
      await config.update(key, undefined, userTarget);              // undefined removes the saved value
      reset.push(key);
    } catch {
      failed = true; // e.g. settings.json is read-only or broken: try again next start
    }
  }
  try {
    for (const key of stateKeys) await state.update(key, undefined);
    if (!failed) await state.update(RESET_MARKER_KEY, SETTINGS_RESET_VERSION);
  } catch { /* try again next start */ }
  return reset;
}
