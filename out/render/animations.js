"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIZE = exports.SPEED = exports.EXITS = exports.ENTRIES = void 0;
exports.resolveExit = resolveExit;
exports.timings = timings;
exports.ENTRIES = ['walk', 'slide', 'bounce', 'fall', 'sprout'];
exports.EXITS = ['auto', 'walk', 'slide', 'bounce', 'burrow'];
exports.SPEED = { slow: 1.5, normal: 1, fast: 0.65 };
exports.SIZE = { small: 0.75, medium: 1, large: 1.3 };
const ENTER_MS = { walk: 2200, slide: 1900, bounce: 2100, fall: 2000, sprout: 3000 };
const EXIT_MS = { walk: 2300, slide: 1500, bounce: 2200, burrow: 2400 };
const HAPPY_MS = 1600;
/** "auto" leaves the way the character came: sprout -> burrow, fall -> walk, otherwise the same style. */
function resolveExit(entry, exit) {
    if (exit !== 'auto')
        return exit;
    if (entry === 'sprout')
        return 'burrow';
    if (entry === 'fall')
        return 'walk';
    return entry;
}
function timings(entry, exit, speed) {
    const k = exports.SPEED[speed];
    const x = resolveExit(entry, exit);
    return { enterMs: Math.round(ENTER_MS[entry] * k), happyMs: Math.round(HAPPY_MS * k), exitMs: Math.round(EXIT_MS[x] * k), exit: x, k };
}
//# sourceMappingURL=animations.js.map