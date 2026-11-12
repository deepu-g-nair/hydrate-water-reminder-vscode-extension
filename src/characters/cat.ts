import { CharacterDef } from './types';
import { cheeks, eyes, INK, PINK } from './rig';

const skin = '#F6A95B', shade = '#D9823A';
export const cat: CharacterDef = {
  id: 'cat', label: 'Cat', skin, shade, outfit: '#7A6BB5', outfitLight: '#9A8DD0',
  tail: `<path d="M-24,-36 q-28,-2 -26,-34 q1,-10 9,-9" fill="none" stroke="${shade}" stroke-width="9" stroke-linecap="round"/>`,
  ears: `<g class="ear"><path d="M-36,-124 L-31,-164 L-4,-142 z" fill="${shade}"/><path d="M-30,-130 L-28,-154 L-12,-141 z" fill="${PINK}"/></g>
    <g class="ear"><path d="M12,-144 L37,-166 L40,-126 z" fill="${shade}"/><path d="M19,-143 L34,-156 L36,-133 z" fill="${PINK}"/></g>`,
  face: (happy) => `<path d="M-4,-146 v9 M4,-147 v11 M12,-146 v9" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="6" cy="-95" rx="17" ry="11" fill="#FFF3E2"/>
    ${cheeks()}${eyes(happy)}
    <path d="M2,-103 h8 l-4,5 z" fill="#E86A8E"/>
    <path d="M6,-98 q-5,${happy ? 9 : 6} -10,2 M6,-98 q5,${happy ? 9 : 6} 10,2" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M-14,-97 h-16 M-14,-92 l-15,4 M26,-98 h14 M26,-93 l13,4" stroke="${shade}" stroke-width="1.5" stroke-linecap="round"/>`,
};
