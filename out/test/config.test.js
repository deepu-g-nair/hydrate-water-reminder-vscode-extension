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
const config_1 = require("../config");
const stage_1 = require("../render/stage");
(0, node_test_1.test)('empty input yields defaults', () => {
    assert.deepEqual((0, config_1.normalize)({}), config_1.DEFAULTS);
});
(0, node_test_1.test)('invalid values fall back or are clamped', () => {
    const s = (0, config_1.normalize)({
        enabled: 'yes', intervalMinutes: -5, displaySeconds: 99999, character: 'dragon',
        entryAnimation: 'teleport', exitAnimation: 42, size: 'huge', speed: null, messages: 'hello', renderMode: 'overlay',
    });
    assert.equal(s.enabled, true);
    assert.equal(s.intervalMinutes, 1);
    assert.equal(s.displaySeconds, 600);
    assert.equal(s.character, 'elephant');
    assert.equal(s.entryAnimation, config_1.DEFAULTS.entryAnimation);
    assert.equal(s.exitAnimation, config_1.DEFAULTS.exitAnimation);
    assert.equal(s.size, 'medium');
    assert.equal(s.speed, 'normal');
    assert.deepEqual(s.messages, []);
    assert.equal(s.renderMode, 'floating');
});
(0, node_test_1.test)('valid values are kept', () => {
    const s = (0, config_1.normalize)({ intervalMinutes: 45, character: 'panda', entryAnimation: 'sprout', exitAnimation: 'burrow', size: 'large', speed: 'fast' });
    assert.equal(s.intervalMinutes, 45);
    assert.equal(s.character, 'panda');
    assert.equal(s.entryAnimation, 'sprout');
    assert.equal(s.exitAnimation, 'burrow');
});
(0, node_test_1.test)('custom messages are cleaned', () => {
    const s = (0, config_1.normalize)({ messages: ['  Drink!  ', '', 7, '   ', 'x'.repeat(500)] });
    assert.equal(s.messages.length, 2);
    assert.equal(s.messages[0], 'Drink!');
    assert.equal(s.messages[1].length, 120);
});
(0, node_test_1.test)('pickMessage uses custom messages when present, defaults otherwise', () => {
    assert.ok(config_1.DEFAULT_MESSAGES.includes((0, config_1.pickMessage)(config_1.DEFAULTS)));
    assert.equal((0, config_1.pickMessage)({ ...config_1.DEFAULTS, messages: ['only one'] }, 'only one'), 'only one');
});
(0, node_test_1.test)('pickMessage avoids repeating the previous message', () => {
    const s = { ...config_1.DEFAULTS, messages: ['a', 'b'] };
    for (let i = 0; i < 20; i++)
        assert.equal((0, config_1.pickMessage)(s, 'a'), 'b');
});
(0, node_test_1.test)('formatRemaining', () => {
    assert.equal((0, config_1.formatRemaining)(20_000), '1m');
    assert.equal((0, config_1.formatRemaining)(0), '<1m');
    assert.equal((0, config_1.formatRemaining)(29.2 * 60_000), '30m');
    assert.equal((0, config_1.formatRemaining)(60 * 60_000), '1h');
    assert.equal((0, config_1.formatRemaining)(90 * 60_000), '1h 30m');
});
(0, node_test_1.test)('there are 20 distinct built-in messages and each fits the speech bubble', () => {
    assert.equal(config_1.DEFAULT_MESSAGES.length, 20);
    assert.equal(new Set(config_1.DEFAULT_MESSAGES).size, 20);
    for (const m of config_1.DEFAULT_MESSAGES) {
        assert.ok(m.length <= config_1.MAX_MESSAGE_LENGTH, `too long: ${m}`);
        const lines = (0, stage_1.wrap)(m);
        assert.ok(lines.length <= 3 && lines.join(' ') === m, `does not fit the bubble: ${m}`);
    }
});
(0, node_test_1.test)('all 20 messages come up when picking at random', () => {
    const seen = new Set();
    let prev;
    for (let i = 0; i < 2000; i++) {
        prev = (0, config_1.pickMessage)(config_1.DEFAULTS, prev);
        seen.add(prev);
    }
    assert.equal(seen.size, 20);
});
(0, node_test_1.test)('defaults: elephant that slides in and slides out', () => {
    assert.equal(config_1.DEFAULTS.character, 'elephant');
    assert.equal(config_1.DEFAULTS.entryAnimation, 'slide');
    assert.equal(config_1.DEFAULTS.exitAnimation, 'slide');
});
(0, node_test_1.test)('celebration messages are distinct, fit the bubble and are picked at random without repeats', () => {
    assert.ok(config_1.ACK_MESSAGES.length >= 10);
    assert.equal(new Set(config_1.ACK_MESSAGES).size, config_1.ACK_MESSAGES.length);
    for (const m of config_1.ACK_MESSAGES) {
        const lines = (0, stage_1.wrap)(m);
        assert.ok(lines.length <= 3 && lines.join(' ') === m, `does not fit the bubble: ${m}`);
    }
    const seen = new Set();
    let prev;
    for (let i = 0; i < 2000; i++) {
        const next = (0, config_1.pickAckMessage)(prev);
        assert.notEqual(next, prev);
        seen.add(prev = next);
    }
    assert.equal(seen.size, config_1.ACK_MESSAGES.length);
});
//# sourceMappingURL=config.test.js.map