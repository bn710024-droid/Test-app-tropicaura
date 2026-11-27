/**
 * Forfait transport des particuliers : réglé dans la tour (Réglages › Transport), publié dans le
 * catalogue (`transport`, en euros) ; sans lui, le barème d'exemple de l'application.
 *
 *     node scripts/test_transport.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transportFee, transportZone } from '../lib/countries.ts';
import { parseCatalog } from '../lib/catalog/schema.ts';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
};

const fixture = JSON.parse(readFileSync(new URL('./fixtures/catalog-v2-one.json', import.meta.url), 'utf8'));
const published = {
  currency: 'EUR',
  zones: [
    { id: 'sn', label: 'Sénégal', fee: 5 },
    { id: 'ao', label: 'Afrique de l’Ouest', fee: 20 },
    { id: 'af', label: 'Afrique', fee: 30 },
    { id: 'eu', label: 'Europe', fee: 45.5 },
    { id: 'na', label: 'Amérique du Nord', fee: 60 },
    { id: 'monde', label: 'Reste du monde', fee: 0 },
  ],
};

test('sans forfaits publiés : barème de l’application', () => {
  assert.equal(transportFee('SN'), 6);
  assert.equal(transportFee('FR'), 48);
  assert.equal(transportFee('US', null), 62);
  assert.equal(transportFee('JP'), 78);
});

test('forfaits publiés : montant de la zone du pays', () => {
  const fees = { sn: 5, eu: 45.5, monde: 0 };
  assert.equal(transportFee('SN', fees), 5);
  assert.equal(transportFee('FR', fees), 45.5);
  assert.equal(transportFee('JP', fees), 0);
  // Zone non publiée : barème de l'application pour cette zone.
  assert.equal(transportFee('CI', fees), 24);
  assert.equal(transportZone('FR', fees).id, 'eu');
});

test('catalogue sans transport : rien de lu', () => {
  const doc = parseCatalog(fixture);
  assert.ok(doc, 'catalogue refusé');
  assert.equal(doc.transport, undefined);
});

test('catalogue avec transport en euros : forfaits lus par zone', () => {
  const doc = parseCatalog({ ...fixture, transport: published });
  assert.deepEqual(doc.transport, { sn: 5, ao: 20, af: 30, eu: 45.5, na: 60, monde: 0 });
});

test('autre devise ou montants illisibles : ignorés', () => {
  assert.equal(parseCatalog({ ...fixture, transport: { ...published, currency: 'XOF' } }).transport, undefined);
  const bad = { currency: 'EUR', zones: [{ id: 'eu', fee: -3 }, { id: 'sn', fee: '6' }, { id: 'na', fee: 99999 }] };
  assert.equal(parseCatalog({ ...fixture, transport: bad }).transport, undefined);
});

console.log(`\n${passed}/${passed} tests réussis`);
