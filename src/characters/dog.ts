import { CharacterDef } from './types';
import { cheeks, eyes, INK } from './rig';

const skin = '#E8C08A', shade = '#A9703F';
export const dog: CharacterDef = {
  id: 'dog', label: 'Dog', skin, shade, outfit: '#C8553D', outfitLight: '#E07A5F',
  tail: `<path d="M-24,-40 q-18,-6 -18,-26" fill="none" stroke="${shade}" stroke-width="9" stroke-linecap="round"/>`,
  ears: '',
  earsFront: `<g class="ear"><ellipse cx="-36" cy="-112" rx="12" ry="27" fill="${shade}" transform="rotate(14 -36 -112)"/></g>
    <g class="ear"><ellipse cx="41" cy="-114" rx="11" ry="25" fill="${shade}" transform="rotate(-14 41 -114)"/></g>`,
  face: (happy) => `<circle cx="20" cy="-116" r="13" fill="${shade}" opacity=".45"/>
    <ellipse cx="6" cy="-94" rx="19" ry="13" fill="#FFF6E9"/>
    ${cheeks()}${eyes(happy)}
    <ellipse cx="6" cy="-102" rx="6.5" ry="4.5" fill="${INK}"/>
    <path d="M6,-97 q-6,${happy ? 9 : 6} -11,1 M6,-97 q6,${happy ? 9 : 6} 11,1" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    ${happy ? '<rect x="2" y="-93" width="8" height="10" rx="4" fill="#F08A9B"/>' : ''}`,
};
