"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rabbit = void 0;
const rig_1 = require("./rig");
const skin = '#F1E9E1', shade = '#C9B9AA';
exports.rabbit = {
    id: 'rabbit', label: 'Rabbit', skin, shade, outfit: '#E58FB1', outfitLight: '#F3B3CB',
    tail: `<circle cx="-30" cy="-36" r="9" fill="#fff" stroke="${shade}" stroke-width="1.5"/>`,
    ears: `<g class="ear"><ellipse cx="-16" cy="-166" rx="11" ry="32" fill="${skin}" stroke="${shade}" stroke-width="1.5" transform="rotate(-9 -16 -166)"/><ellipse cx="-16" cy="-164" rx="5" ry="22" fill="${rig_1.PINK}" transform="rotate(-9 -16 -166)"/></g>
    <g class="ear"><ellipse cx="20" cy="-168" rx="11" ry="32" fill="${skin}" stroke="${shade}" stroke-width="1.5" transform="rotate(9 20 -168)"/><ellipse cx="20" cy="-166" rx="5" ry="22" fill="${rig_1.PINK}" transform="rotate(9 20 -168)"/></g>`,
    face: (happy) => `${(0, rig_1.cheeks)()}${(0, rig_1.eyes)(happy)}
    <ellipse cx="6" cy="-101" rx="4.5" ry="3" fill="#E86A8E"/>
    <path d="M6,-98 q-5,${happy ? 8 : 5} -9,1 M6,-98 q5,${happy ? 8 : 5} 9,1" fill="none" stroke="${rig_1.INK}" stroke-width="2" stroke-linecap="round"/>
    <rect x="2.5" y="-95" width="7" height="7" rx="1.5" fill="#fff" stroke="${shade}" stroke-width="1"/>`,
};
//# sourceMappingURL=rabbit.js.map