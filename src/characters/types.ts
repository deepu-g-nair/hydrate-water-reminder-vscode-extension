/** Everything the animation engine needs to know about one animal. */
export interface CharacterDef {
  id: string;
  label: string;
  /** Head / body colour. */
  skin: string;
  /** Darker shade: outlines, far-side limbs. */
  shade: string;
  /** Arm colour (defaults to skin / shade). */
  limb?: string;
  limbShade?: string;
  /** Leg colour (defaults to limbShade). */
  leg?: string;
  /** Dungarees colour. */
  outfit: string;
  outfitLight: string;
  /** Drawn behind the head circle. Sits on the "back" depth layer. */
  ears: string;
  /** Drawn on top of the head circle (floppy ears etc.). */
  earsFront?: string;
  /** Drawn behind the body. */
  tail?: string;
  /** Drawn on the torso, under the dungarees (belly patch etc.). */
  belly?: string;
  /** Facial features drawn on the head circle. Sits on the "front" depth layer. */
  face(happy: boolean): string;
}
