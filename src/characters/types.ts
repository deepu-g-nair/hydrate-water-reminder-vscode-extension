/** Everything the animation engine needs to know about one animal. */
export interface CharacterDef {
  id: string;
  label: string;
  /** Head / body colour. */
  skin: string;
  /** Darker shade: outlines, far-side limbs. */
  shade: string;
  /** Arm and leg colour (defaults to skin / shade). */
  limb?: string;
  limbShade?: string;
  /** Dungarees colour. */
  outfit: string;
  outfitLight: string;
  /** Drawn behind the head circle. */
  ears: string;
  /** Drawn on top of the head circle (floppy ears etc.). */
  earsFront?: string;
  /** Drawn behind the body. */
  tail?: string;
  /** Facial features drawn on the head circle. */
  face(happy: boolean): string;
}
