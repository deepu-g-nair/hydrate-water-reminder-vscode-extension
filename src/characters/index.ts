import { CharacterDef } from './types';
import { elephant } from './elephant';
import { cat } from './cat';
import { dog } from './dog';
import { rabbit } from './rabbit';
import { panda } from './panda';
import { bear } from './bear';
import { fox } from './fox';
import { penguin } from './penguin';
import { koala } from './koala';
import { tiger } from './tiger';

/**
 * Character registry. To add an animal: create `<name>.ts` exporting a
 * CharacterDef, add it here, and add its id to the `waterReminder.character`
 * enum in package.json. The animation engine needs no changes.
 */
export const CHARACTERS: readonly CharacterDef[] = [elephant, cat, dog, rabbit, panda, bear, fox, penguin, koala, tiger];
export const DEFAULT_CHARACTER = 'elephant';

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? elephant;
}
export type { CharacterDef };
