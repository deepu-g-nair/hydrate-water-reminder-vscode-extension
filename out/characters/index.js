"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CHARACTER = exports.CHARACTERS = void 0;
exports.getCharacter = getCharacter;
const elephant_1 = require("./elephant");
const cat_1 = require("./cat");
const dog_1 = require("./dog");
const rabbit_1 = require("./rabbit");
const panda_1 = require("./panda");
const bear_1 = require("./bear");
/**
 * Character registry. To add an animal: create `<name>.ts` exporting a
 * CharacterDef, add it here, and add its id to the `waterReminder.character`
 * enum in package.json. The animation engine needs no changes.
 */
exports.CHARACTERS = [elephant_1.elephant, cat_1.cat, dog_1.dog, rabbit_1.rabbit, panda_1.panda, bear_1.bear];
exports.DEFAULT_CHARACTER = 'elephant';
function getCharacter(id) {
    return exports.CHARACTERS.find((c) => c.id === id) ?? elephant_1.elephant;
}
//# sourceMappingURL=index.js.map