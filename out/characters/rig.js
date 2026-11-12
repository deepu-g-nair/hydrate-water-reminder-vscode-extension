"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PINK = exports.INK = void 0;
exports.eyes = eyes;
exports.cheeks = cheeks;
exports.drawCharacter = drawCharacter;
/**
 * Shared "little human" body rig. Local coordinates: feet at y=0, facing right.
 * The animation engine only knows these class names:
 *   leg-a leg-b arm-a arm-b head ear eyes leaf
 * so any character drawn through this rig works with every animation.
 */
exports.INK = '#2B3A55';
exports.PINK = '#F7B6C8';
function eyes(happy, ink = exports.INK) {
    return happy
        ? `<path d="M-16,-113 q6,-8 12,0 M14,-115 q6,-8 12,0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
        : `<g class="eyes"><circle cx="-10" cy="-114" r="5.5" fill="${ink}"/><circle cx="20" cy="-116" r="5.5" fill="${ink}"/>` +
            `<circle cx="-8.2" cy="-116" r="1.8" fill="#fff"/><circle cx="21.8" cy="-118" r="1.8" fill="#fff"/></g>`;
}
function cheeks() {
    return `<ellipse cx="-22" cy="-100" rx="7" ry="4.5" fill="${exports.PINK}" opacity=".8"/><ellipse cx="32" cy="-103" rx="5" ry="4" fill="${exports.PINK}" opacity=".8"/>`;
}
function drawCharacter(c, happy, withLeaf) {
    const limb = c.limb ?? c.skin;
    const limbShade = c.limbShade ?? c.shade;
    const leaf = withLeaf
        ? `<g class="leaf"><path d="M2,-145 v-16" stroke="#4E9F3D" stroke-width="3" stroke-linecap="round"/>
       <path d="M2,-160 q-16,-14 -24,-2 q12,10 24,2z" fill="#6BCB77"/><path d="M2,-160 q14,-16 24,-6 q-10,12 -24,6z" fill="#4E9F3D"/></g>`
        : '';
    return `
  ${c.tail ?? ''}
  <rect class="limb leg-a" x="-22" y="-38" width="18" height="38" rx="8" fill="${limbShade}"/>
  <rect class="limb leg-b" x="4" y="-38" width="18" height="38" rx="8" fill="${limbShade}"/>
  <rect class="limb arm-a" x="-39" y="-76" width="14" height="34" rx="7" fill="${limbShade}"/>
  <rect x="-28" y="-82" width="56" height="56" rx="22" fill="${c.skin}" stroke="${c.shade}" stroke-width="1.5"/>
  <path d="M-27,-58 h54 v12 a20,20 0 0 1 -20,18 h-14 a20,20 0 0 1 -20,-18 z" fill="${c.outfit}"/>
  <rect x="-20" y="-74" width="7" height="18" fill="${c.outfit}"/><rect x="13" y="-74" width="7" height="18" fill="${c.outfit}"/>
  <rect x="-8" y="-52" width="16" height="11" rx="3" fill="${c.outfitLight}"/>
  <g class="limb arm-b">
    <rect x="25" y="-76" width="14" height="34" rx="7" fill="${limb}" stroke="${c.shade}" stroke-width="1"/>
    <rect x="27" y="-52" width="15" height="19" rx="3" fill="#E8F7FF" stroke="#5BB8E8" stroke-width="1.5"/>
    <rect x="28.5" y="-45" width="12" height="10.5" rx="2" fill="#5BB8E8"/>
  </g>
  <g class="head">
    ${c.ears}
    <circle cx="2" cy="-108" r="40" fill="${c.skin}" stroke="${c.shade}" stroke-width="1.5"/>
    ${c.face(happy)}
    ${c.earsFront ?? ''}
    ${leaf}
  </g>`;
}
//# sourceMappingURL=rig.js.map