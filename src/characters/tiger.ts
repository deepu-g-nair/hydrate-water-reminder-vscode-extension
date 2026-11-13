import { CharacterDef } from './types';
import { cheeks, eyes, INK } from './rig';

const skin = '#F5A340', shade = '#D27A1F', stripe = '#4A3222', cream = '#FFF3E2';
export const tiger: CharacterDef = {
  id: 'tiger', label: 'Tiger', skin, shade, outfit: '#3B5B92', outfitLight: '#5C7DB8',
  tail: `<path d="M-24,-36 q-30,-2 -28,-36 q1,-10 9,-10" fill="none" stroke="${shade}" stroke-width="9" stroke-linecap="round"/>
    <path d="M-45,-44 l-9,2 M-51,-58 l-9,-1 M-48,-72 l-8,-4" stroke="${stripe}" stroke-width="3.5" stroke-linecap="round"/>`,
  ears: `<g class="ear"><circle cx="-28" cy="-140" r="14" fill="${shade}"/><circle cx="-28" cy="-140" r="7.5" fill="${cream}"/></g>
    <g class="ear"><circle cx="33" cy="-142" r="13" fill="${shade}"/><circle cx="33" cy="-142" r="7" fill="${cream}"/></g>`,
  face: (happy) => `<path d="M-9,-147 l3.5,13 l3.5,-13z M0,-148 l3.5,15 l3.5,-15z M9,-147 l3.5,13 l3.5,-13z" fill="${stripe}"/>
    <path d="M-37,-114 l13,3 l-13,4z M-36,-101 l12,2 l-12,4z M41,-116 l-12,3 l12,4z M40,-103 l-11,2 l11,4z" fill="${stripe}"/>
    <ellipse cx="6" cy="-95" rx="18" ry="12" fill="${cream}"/>
    ${cheeks()}${eyes(happy)}
    <path d="M1,-103 h10 l-5,6 z" fill="#E86A8E"/>
    <path d="M6,-97 q-5,${happy ? 9 : 6} -10,2 M6,-97 q5,${happy ? 9 : 6} 10,2" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
};
