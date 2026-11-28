/**
 * Format des contenus d'emballage : ≥ 1 000 g → « X kg » (deux décimales au plus, zéros
 * inutiles retirés, virgule),
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
  [1250, `1,25${NB}kg`],
  [1240, `1,24${NB}kg`],
  [2050, `2,05${NB}kg`],
  [1950, `1,95${NB}kg`],
  [1255, `1,26${NB}kg`],
  [1001, `1${NB}kg`],
  [1100, `1,1${NB}kg`],
  [2500, `2,5${NB}kg`],
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
// Jamais « 5000 g », jamais plus de deux décimales ni de zéro final (« 1,50 kg »).
for (let g = 1000; g <= 20000; g += 5) {
  const text = contentsText(g);
  assert.match(text, /^\d+(,\d?[1-9])?\u00A0kg$/, `${g} g → ${text}`);
}
passed += 1;
for (let g = 1; g < 1000; g += 1) assert.equal(contentsText(g), `${g}${NB}g`);
passed += 1;

console.log(`${passed} vérifications, 0 échec`);
