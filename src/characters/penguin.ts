import { CharacterDef } from './types';
import { eyes, PINK } from './rig';

const skin = '#3A4A68', shade = '#27344D', orange = '#F5A623';
export const penguin: CharacterDef = {
  id: 'penguin', label: 'Penguin', skin, shade, leg: orange, outfit: '#E2574C', outfitLight: '#F08A7E',
  belly: `<ellipse cx="1" cy="-55" rx="20" ry="25" fill="#F7FAFC"/>`,
  ears: '',
  face: (happy) => `<path d="M-12,-145 q4,-9 9,-1 q4,-9 9,0" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
    <path d="M4,-80 C-36,-84 -38,-134 -12,-134 C-2,-134 2,-127 4,-122 C6,-127 12,-136 23,-134 C46,-132 44,-88 4,-80z" fill="#F7FAFC"/>
    <ellipse cx="-22" cy="-99" rx="6" ry="4" fill="${PINK}" opacity=".8"/><ellipse cx="31" cy="-101" rx="5" ry="3.6" fill="${PINK}" opacity=".8"/>
    ${eyes(happy)}
    <path d="M-5,-103 q11,-7 22,0 q-11,${happy ? 17 : 13} -22,0z" fill="${orange}"/>`,
};
