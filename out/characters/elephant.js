"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.elephant = void 0;
const rig_1 = require("./rig");
const skin = '#9DB4D6', shade = '#7F99C2';
exports.elephant = {
    id: 'elephant', label: 'Baby Elephant', skin, shade, outfit: '#4F7CAC', outfitLight: '#6C97C6',
    ears: `<g class="ear"><ellipse cx="-36" cy="-112" rx="24" ry="28" fill="${shade}"/><ellipse cx="-37" cy="-112" rx="14" ry="18" fill="${rig_1.PINK}"/></g>
    <g class="ear"><ellipse cx="42" cy="-114" rx="20" ry="25" fill="${shade}"/><ellipse cx="43" cy="-114" rx="11" ry="15" fill="${rig_1.PINK}"/></g>`,
    face: (happy) => `<path d="M-4,-147 q4,-10 10,-1" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
    ${(0, rig_1.cheeks)()}${(0, rig_1.eyes)(happy)}
    <path d="M-10,-88 q8,${happy ? 12 : 7} 17,2" fill="none" stroke="${rig_1.INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14,-104 C40,-102 47,-82 41,-68 C38,-60 29,-62 29,-68" fill="none" stroke="${shade}" stroke-width="13" stroke-linecap="round"/>`,
};
//# sourceMappingURL=elephant.js.map