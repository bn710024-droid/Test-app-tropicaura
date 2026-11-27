/**
 * Format des contenus d'emballage : ≥ 1 000 g → « X kg » (une décimale au plus, virgule),
 * < 1 000 g → « X g ». Utilisé par la fiche, les cartes emballage, le panier et les commandes.
 *
 *     node scripts/test_contents.mjs
 */
import assert from 'node:assert/strict';
import { contentsText } from '../lib/weight.ts';

const NB = '\u00A0';
const cases = [
  [5000, `5${NB}kg`],
  [1500, `1,5${NB}kg`],
  [1000, `1${NB}kg`],
  [1250, `1,3${NB}kg`],
  [1240, `1,2${NB}kg`],
  [2050, `2,1${NB}kg`],
  [1950, `2${NB}kg`],
  [10000, `10${NB}kg`],
  [44000000, `44\u202F000${NB}kg`],
  [999.6, `1${NB}kg`],
  [999, `999${NB}g`],
  [500, `500${NB}g`],
  [250, `250${NB}g`],
  [12.4, `12${NB}g`],
];

let passed = 0;
for (const [grams, expected] of cases) {
  assert.equal(contentsText(grams), expected, `${grams} g`);
  passed += 1;
}
// Jamais « 5000 g » ni plus d'une décimale.
for (let g = 1000; g <= 20000; g += 10) {
  const text = contentsText(g);
  assert.match(text, /^\d+(,\d)?\u00A0kg$/, `${g} g → ${text}`);
}
passed += 1;
for (let g = 1; g < 1000; g += 1) assert.equal(contentsText(g), `${g}${NB}g`);
passed += 1;

console.log(`${passed} vérifications, 0 échec`);
