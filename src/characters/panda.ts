import { CharacterDef } from './types';
import { cheeks } from './rig';

const black = '#2E3440';
export const panda: CharacterDef = {
  id: 'panda', label: 'Panda', skin: '#FAFAFA', shade: '#C9CED6', limb: black, limbShade: black,
  outfit: '#5FA777', outfitLight: '#86C59B',
  ears: `<g class="ear"><circle cx="-28" cy="-140" r="14" fill="${black}"/></g><g class="ear"><circle cx="33" cy="-142" r="13" fill="${black}"/></g>`,
  face: (happy) => `<ellipse cx="-11" cy="-113" rx="10" ry="13" fill="${black}" transform="rotate(20 -11 -113)"/>
    <ellipse cx="21" cy="-115" rx="10" ry="13" fill="${black}" transform="rotate(-20 21 -115)"/>
    ${happy
      ? '<path d="M-16,-112 q6,-7 11,0 M15,-114 q6,-7 11,0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
      : '<g class="eyes"><circle cx="-10" cy="-114" r="4.6" fill="#fff"/><circle cx="20" cy="-116" r="4.6" fill="#fff"/><circle cx="-9" cy="-114" r="2.6" fill="#2E3440"/><circle cx="21" cy="-116" r="2.6" fill="#2E3440"/></g>'}
    ${cheeks()}
    <ellipse cx="6" cy="-100" rx="5.5" ry="4" fill="${black}"/>
    <path d="M6,-96 q-5,${happy ? 9 : 6} -10,1 M6,-96 q5,${happy ? 9 : 6} 10,1" fill="none" stroke="${black}" stroke-width="2" stroke-linecap="round"/>`,
};
