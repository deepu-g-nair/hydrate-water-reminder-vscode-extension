"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTING_KEYS = exports.DEFAULTS = exports.INTERVAL_PRESETS = exports.MAX_MESSAGE_LENGTH = exports.ACK_MESSAGES = exports.DEFAULT_MESSAGES = void 0;
exports.normalize = normalize;
exports.pickMessage = pickMessage;
exports.pickAckMessage = pickAckMessage;
exports.formatRemaining = formatRemaining;
/** Settings model + validation (pure: no VS Code imports). */
const characters_1 = require("./characters");
const animations_1 = require("./render/animations");
exports.DEFAULT_MESSAGES = [
    'Hey! Time for some water! 💧',
    "You've been coding for a while. Take a sip!",
    "Hydration break! Don't forget me!",
    'Your code compiles. Do your kidneys? Drink up.',
    'Coffee is not water. Nice try.',
    "You debug better hydrated. It's science. Probably.",
    'Roses are red, your mouth is dry. Drink some water.',
    'Even your laptop has a cooling system. Drink!',
    "That bug isn't going anywhere. Go get water.",
    'Plot twist: the missing semicolon was thirst.',
    'I walked all the way here. The least you can do is sip.',
    'git commit -m "drank water". Make it true.',
    'Humans are 60% water. You are slipping below spec.',
    'Stack Overflow says: have you tried drinking water?',
    "Your brain is throwing warnings. It's dehydration.",
    'One sip now saves one headache later. Good trade.',
    'Still ignoring me? Bold move for a thirsty person.',
    "Tabs or spaces? Wrong question. It's water.",
    "Ship it! By 'it' I mean water. Into your mouth.",
    "It's free, it's healthy and it's right there. Drink.",
];
/** Shown, at random, when the user says they have had a drink. */
exports.ACK_MESSAGES = [
    'Yay! Stay hydrated! 🎉',
    'Nice! Your brain cells are doing a happy dance.',
    'Hydration level: legendary. Carry on!',
    "That's the spirit! Now go crush that bug.",
    "Refreshed and ready. The code doesn't stand a chance.",
    'Proud of you! See you at the next water break.',
    'Achievement unlocked: Functional Human. 🏆',
    'Glug glug hooray! Back to greatness.',
    'Look at you, taking care of yourself. Love that.',
    'Water in, brilliance out. Science!',
    'Your kidneys just gave you a five-star review. ⭐',
    'One step closer to being a houseplant with skills. 🌱',
    'Well done! Future you says thanks.',
    'Top-tier hydrating. Truly elite stuff.',
    'That was the best commit you made today.',
];
/** Longest message the speech bubble shows without cutting it off (3 lines). */
exports.MAX_MESSAGE_LENGTH = 90;
exports.INTERVAL_PRESETS = [15, 30, 45, 60, 90];
exports.DEFAULTS = {
    enabled: true, intervalMinutes: 30, displaySeconds: 20, character: characters_1.DEFAULT_CHARACTER,
    entryAnimation: 'slide', exitAnimation: 'slide', size: 'medium', speed: 'normal', messages: [], renderMode: 'floating',
};
exports.SETTING_KEYS = Object.keys(exports.DEFAULTS);
const oneOf = (v, allowed, fallback) => typeof v === 'string' && allowed.includes(v) ? v : fallback;
const num = (v, min, max, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
/** Turn whatever is in settings.json into safe values. Never throws. */
function normalize(raw) {
    const messages = Array.isArray(raw.messages)
        ? raw.messages.filter((m) => typeof m === 'string').map((m) => m.trim()).filter((m) => m.length > 0).map((m) => m.slice(0, 120))
        : [];
    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : exports.DEFAULTS.enabled,
        intervalMinutes: num(raw.intervalMinutes, 1, 24 * 60, exports.DEFAULTS.intervalMinutes),
        displaySeconds: num(raw.displaySeconds, 3, 600, exports.DEFAULTS.displaySeconds),
        character: oneOf(raw.character, characters_1.CHARACTERS.map((c) => c.id), exports.DEFAULTS.character),
        entryAnimation: oneOf(raw.entryAnimation, animations_1.ENTRIES, exports.DEFAULTS.entryAnimation),
        exitAnimation: oneOf(raw.exitAnimation, animations_1.EXITS, exports.DEFAULTS.exitAnimation),
        size: oneOf(raw.size, ['small', 'medium', 'large'], exports.DEFAULTS.size),
        speed: oneOf(raw.speed, ['slow', 'normal', 'fast'], exports.DEFAULTS.speed),
        messages,
        renderMode: oneOf(raw.renderMode, ['floating', 'inline'], exports.DEFAULTS.renderMode),
    };
}
/** Pick a reminder message, avoiding an immediate repeat when possible. */
function pickMessage(s, previous, random = Math.random) {
    return pickFrom(s.messages.length ? s.messages : exports.DEFAULT_MESSAGES, previous, random);
}
/** Pick a celebration message for the acknowledgement, avoiding an immediate repeat. */
function pickAckMessage(previous, random = Math.random) {
    return pickFrom(exports.ACK_MESSAGES, previous, random);
}
function pickFrom(pool, previous, random) {
    const choices = pool.length > 1 ? pool.filter((m) => m !== previous) : pool;
    return choices[Math.floor(random() * choices.length) % choices.length];
}
function formatRemaining(ms) {
    const totalMin = Math.ceil(ms / 60_000);
    if (totalMin < 1)
        return '<1m';
    if (totalMin < 60)
        return `${totalMin}m`;
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}
//# sourceMappingURL=config.js.map