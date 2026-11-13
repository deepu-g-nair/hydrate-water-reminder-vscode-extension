import { CharacterDef } from './types';
import { cheeks, eyes, INK } from './rig';

const skin = '#AAB3BF', shade = '#7C8794';
export const koala: CharacterDef = {
  id: 'koala', label: 'Koala', skin, shade, outfit: '#D9705A', outfitLight: '#E99583',
  belly: `<ellipse cx="1" cy="-56" rx="18" ry="22" fill="#D9DEE5"/>`,
  ears: `<g class="ear"><circle cx="-33" cy="-132" r="19" fill="${shade}"/><circle cx="-33" cy="-132" r="11" fill="#F1D9DC"/></g>
    <g class="ear"><circle cx="38" cy="-134" r="17" fill="${shade}"/><circle cx="38" cy="-134" r="10" fill="#F1D9DC"/></g>`,
  face: (happy) => `${cheeks()}${eyes(happy)}
    <ellipse cx="6" cy="-101" rx="8.5" ry="11" fill="#3A3F4B"/>
    <path d="M-1,-87 q7,${happy ? 8 : 5} 14,0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
};
