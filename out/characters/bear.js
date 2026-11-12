"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bear = void 0;
const rig_1 = require("./rig");
const skin = '#B98A62', shade = '#8A5E3D';
exports.bear = {
    id: 'bear', label: 'Bear', skin, shade, outfit: '#3D8B8B', outfitLight: '#63AEAE',
    ears: `<g class="ear"><circle cx="-28" cy="-140" r="14" fill="${shade}"/><circle cx="-28" cy="-140" r="7" fill="#E9CFAE"/></g>
    <g class="ear"><circle cx="33" cy="-142" r="13" fill="${shade}"/><circle cx="33" cy="-142" r="6.5" fill="#E9CFAE"/></g>`,
    face: (happy) => `<ellipse cx="6" cy="-95" rx="18" ry="13" fill="#E9CFAE"/>
    ${(0, rig_1.cheeks)()}${(0, rig_1.eyes)(happy)}
    <ellipse cx="6" cy="-102" rx="6" ry="4.2" fill="${rig_1.INK}"/>
    <path d="M6,-98 q-5,${happy ? 9 : 6} -10,1 M6,-98 q5,${happy ? 9 : 6} 10,1" fill="none" stroke="${rig_1.INK}" stroke-width="2" stroke-linecap="round"/>`,
};
//# sourceMappingURL=bear.js.map