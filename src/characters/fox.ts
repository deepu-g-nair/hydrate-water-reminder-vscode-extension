import { CharacterDef } from './types';
import { eyes, INK, PINK } from './rig';

const skin = '#F08A3C', shade = '#C4622A', cream = '#FFF3E2', dark = '#4A2E20';
export const fox: CharacterDef = {
  id: 'fox', label: 'Fox', skin, shade, limb: '#5B3A29', limbShade: dark, outfit: '#3F8F6B', outfitLight: '#62B08D',
  tail: `<ellipse cx="-44" cy="-60" rx="15" ry="31" fill="${skin}" transform="rotate(-26 -44 -60)"/>
    <ellipse cx="-56" cy="-84" rx="9" ry="12" fill="${cream}" transform="rotate(-26 -56 -84)"/>`,
  ears: `<g class="ear"><path d="M-36,-126 L-31,-172 L-3,-142 z" fill="${shade}"/><path d="M-30,-134 L-28,-158 L-13,-142 z" fill="${cream}"/><path d="M-33,-158 L-31,-172 L-23,-162 z" fill="${dark}"/></g>
    <g class="ear"><path d="M11,-144 L38,-172 L41,-126 z" fill="${shade}"/><path d="M19,-144 L35,-160 L36,-134 z" fill="${cream}"/><path d="M30,-164 L38,-172 L39,-158 z" fill="${dark}"/></g>`,
  face: (happy) => `<path d="M-36,-104 q8,26 38,27 q30,-1 38,-23 q-16,-14 -38,-8 q-22,-6 -38,4z" fill="${cream}"/>
    <ellipse cx="-22" cy="-98" rx="6" ry="4" fill="${PINK}" opacity=".7"/>
    ${eyes(happy)}
    <ellipse cx="6" cy="-100" rx="5.5" ry="4" fill="${INK}"/>
    <path d="M6,-96 q-5,${happy ? 9 : 6} -10,1 M6,-96 q5,${happy ? 9 : 6} 10,1" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
};
