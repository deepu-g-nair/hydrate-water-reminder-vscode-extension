import { CharacterDef } from './types';
import { cheeks, eyes, INK } from './rig';

const skin = '#B98A62', shade = '#8A5E3D';
export const bear: CharacterDef = {
  id: 'bear', label: 'Bear', skin, shade, outfit: '#3D8B8B', outfitLight: '#63AEAE',
  ears: `<g class="ear"><circle cx="-28" cy="-140" r="14" fill="${shade}"/><circle cx="-28" cy="-140" r="7" fill="#E9CFAE"/></g>
    <g class="ear"><circle cx="33" cy="-142" r="13" fill="${shade}"/><circle cx="33" cy="-142" r="6.5" fill="#E9CFAE"/></g>`,
  face: (happy) => `<ellipse cx="6" cy="-95" rx="18" ry="13" fill="#E9CFAE"/>
    ${cheeks()}${eyes(happy)}
    <ellipse cx="6" cy="-102" rx="6" ry="4.2" fill="${INK}"/>
    <path d="M6,-98 q-5,${happy ? 9 : 6} -10,1 M6,-98 q5,${happy ? 9 : 6} 10,1" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
};
