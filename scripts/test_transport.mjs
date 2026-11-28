/**
 * Forfait transport des particuliers : un montant par zone de destination et par devise de client
 * (celle de son compte). Sans forfaits publiés : barème d'exemple, en euros seulement.
 *
 *     node scripts/test_transport.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transportFee, transportZone } from '../lib/countries.ts';
import { parseCatalog } from '../lib/catalog/schema.ts';
import { currencyOf } from '../lib/zones.ts';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
};
const fixture = JSON.parse(readFileSync(new URL('./fixtures/catalog-v2-one.json', import.meta.url), 'utf8'));
const z = (XOF, EUR, USD) => ({ XOF, EUR, USD });
const published = {
  currency: 'ZONES',
  zones: [
    { id: 'sn', label: 'Sénégal', fees: z(2000, 3, null) },
    { id: 'eu', label: 'Europe', fees: z(null, 45.5, 50) },
    { id: 'na', label: 'Amérique du Nord', fees: z(null, null, 60) },
  ],
};

test('devise du client : zone du pays du compte (F CFA, €, $ ; inconnu = $)', () => {
  assert.deepEqual(['SN', 'CI', 'FR', 'US', 'MA', ''].map((c) => currencyOf(c)), ['XOF', 'XOF', 'EUR', 'USD', 'USD', 'USD']);
});
test('sans forfaits publiés : barème d’exemple en euros, à confirmer dans une autre devise', () => {
  assert.equal(transportFee('FR'), 48);
  assert.equal(transportFee('SN', null, 'XOF'), null);
});
test('forfaits publiés : montant de la zone de destination, dans la devise du client', () => {
  const doc = parseCatalog({ ...fixture, transport: published });
  assert.deepEqual(doc.transport.sn, z(2000, 3, null));
  assert.equal(transportFee('SN', doc.transport, 'XOF'), 2000);
  assert.equal(transportFee('FR', doc.transport, 'EUR'), 45.5);
  assert.equal(transportFee('US', doc.transport, 'USD'), 60);
  assert.equal(transportFee('US', doc.transport, 'EUR'), null);
  assert.equal(transportZone('SN', doc.transport, 'XOF').currency, 'XOF');
});
test('anciennes formes reprises (€ seul, montant + devise)', () => {
  const old = parseCatalog({ ...fixture, transport: { currency: 'EUR', zones: [{ id: 'eu', fee: 48 }] } });
  assert.deepEqual(old.transport.eu, z(null, 48, null));
  const cfa = parseCatalog({ ...fixture, transport: { currency: 'XOF+EUR', zones: [{ id: 'sn', fee: 2500, currency: 'XOF' }] } });
  assert.deepEqual(cfa.transport.sn, z(2500, null, null));
});
test('montants illisibles ignorés', () => {
  assert.equal(parseCatalog({ ...fixture, transport: { currency: 'ZONES', zones: [{ id: 'eu', fees: z(-3, 'x', 99999) }] } }).transport, undefined);
});

console.log(`\n${passed}/${passed} tests réussis`);
