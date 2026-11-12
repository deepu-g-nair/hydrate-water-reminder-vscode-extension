"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const characters_1 = require("../characters");
const animations_1 = require("../render/animations");
const stage_1 = require("../render/stage");
const base = {
    phase: 'enter', character: 'elephant', entry: 'walk', exit: 'auto',
    speed: 'normal', size: 'medium', message: 'Time for water!', dark: true, nonce: 'n',
};
const balanced = (svg) => {
    const open = (svg.match(/<g[\s>]/g) ?? []).length;
    const close = (svg.match(/<\/g>/g) ?? []).length;
    return open === close;
};
(0, node_test_1.test)('every character x entry x exit x phase produces a well-formed stage', () => {
    for (const c of characters_1.CHARACTERS)
        for (const entry of animations_1.ENTRIES)
            for (const exit of animations_1.EXITS)
                for (const phase of ['enter', 'ack', 'dismiss']) {
                    const svg = (0, stage_1.buildStageSvg)({ ...base, character: c.id, entry, exit, phase });
                    assert.ok(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), `${c.id}/${entry}/${exit}/${phase}`);
                    assert.ok(balanced(svg), `unbalanced groups: ${c.id}/${entry}/${exit}/${phase}`);
                    assert.ok(!/undefined|NaN/.test(svg), `bad value in ${c.id}/${entry}/${exit}/${phase}`);
                    for (const cls of ['leg-a', 'leg-b', 'arm-a', 'arm-b', 'head'])
                        assert.ok(svg.includes(cls), `${c.id} is missing ${cls}`);
                }
});
(0, node_test_1.test)('every animation name used is defined', () => {
    for (const entry of animations_1.ENTRIES)
        for (const exit of animations_1.EXITS)
            for (const phase of ['enter', 'ack', 'dismiss']) {
                const svg = (0, stage_1.buildStageSvg)({ ...base, entry, exit, phase });
                const defined = new Set([...svg.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
                const used = [...svg.matchAll(/animation:([^;}"]+)/g)].flatMap((m) => m[1].split(/,(?![^(]*\))/)).map((a) => a.trim().split(/\s+/)[0]);
                for (const name of used)
                    assert.ok(defined.has(name), `keyframes "${name}" missing for ${entry}/${exit}/${phase}`);
            }
});
(0, node_test_1.test)('messages are escaped, never injected as markup', () => {
    const svg = (0, stage_1.buildStageSvg)({ ...base, message: '<script>alert(1)</script> & "quotes"' });
    assert.ok(!svg.includes('<script>'));
    assert.ok(svg.includes('&lt;script&gt;'));
});
(0, node_test_1.test)('acknowledgement shows the happy message, not the reminder', () => {
    const svg = (0, stage_1.buildStageSvg)({ ...base, phase: 'ack', message: 'REMINDER TEXT' });
    assert.ok(svg.includes(stage_1.DEFAULT_ACK_MESSAGE));
    assert.ok(!svg.includes('REMINDER TEXT'));
    const custom = (0, stage_1.buildStageSvg)({ ...base, phase: 'ack', ackMessage: 'Well done you' });
    assert.ok(custom.includes('Well done you') && !custom.includes(stage_1.DEFAULT_ACK_MESSAGE));
});
(0, node_test_1.test)('sprout entry draws the ground break and the leaf; walk does not', () => {
    const sprout = (0, stage_1.buildStageSvg)({ ...base, entry: 'sprout' });
    assert.ok(sprout.includes('class="mound"') && sprout.includes('class="clod"') && sprout.includes('class="leaf"'));
    const walk = (0, stage_1.buildStageSvg)({ ...base, entry: 'walk' });
    assert.ok(!walk.includes('class="mound"') && !walk.includes('class="leaf"'));
});
(0, node_test_1.test)('auto exit mirrors the entry', () => {
    assert.equal((0, animations_1.resolveExit)('sprout', 'auto'), 'burrow');
    assert.equal((0, animations_1.resolveExit)('walk', 'auto'), 'walk');
    assert.equal((0, animations_1.resolveExit)('slide', 'auto'), 'slide');
    assert.equal((0, animations_1.resolveExit)('bounce', 'auto'), 'bounce');
    assert.equal((0, animations_1.resolveExit)('fall', 'auto'), 'walk');
    assert.equal((0, animations_1.resolveExit)('sprout', 'slide'), 'slide');
});
(0, node_test_1.test)('speed scales durations; size scales the image', () => {
    const slow = (0, animations_1.timings)('walk', 'auto', 'slow'), normal = (0, animations_1.timings)('walk', 'auto', 'normal'), fast = (0, animations_1.timings)('walk', 'auto', 'fast');
    assert.ok(slow.enterMs > normal.enterMs && normal.enterMs > fast.enterMs);
    assert.ok(slow.exitMs > normal.exitMs && normal.exitMs > fast.exitMs);
    const w = (size) => Number(/width="(\d+)"/.exec((0, stage_1.buildStageSvg)({ ...base, size }))[1]);
    assert.ok(w('small') < w('medium') && w('medium') < w('large'));
});
(0, node_test_1.test)('each stage is unique so its animation restarts', () => {
    assert.notEqual((0, stage_1.buildStageSvg)({ ...base, nonce: 'a' }), (0, stage_1.buildStageSvg)({ ...base, nonce: 'b' }));
});
(0, node_test_1.test)('unknown character falls back to the elephant', () => {
    assert.equal((0, characters_1.getCharacter)('dragon').id, 'elephant');
});
(0, node_test_1.test)('long messages wrap to at most three lines', () => {
    const lines = (0, stage_1.wrap)('word '.repeat(60));
    assert.equal(lines.length, 3);
    assert.ok(lines.every((l) => l.length <= 34));
    assert.ok(lines[2].endsWith('…'));
});
//# sourceMappingURL=stage.test.js.map