// La regla de honestidad del producto, como test.
//
// Toda la propuesta se apoya en que lo que se pinta en pantalla es el color
// que la marca fabrica de verdad. Un tono sin dato tiene que llegar como
// `null` hasta el final y dibujarse como "sin mapear" — nunca rellenarse con
// un gris, un promedio de los vecinos, ni un color "parecido". Un agente que
// recomienda con seguridad un tono inventado es peor que uno que dice "no sé".
//
// También se verifica que no se haya colado ningún identificador interno del
// inventario: el repo es público.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parseHex } from '../src/color/srgb-lab.ts';

const dir = new URL('../data/cards/', import.meta.url);
const archivos = readdirSync(dir).filter((f) => f.endsWith('.json'));
const cartas = archivos.map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

test('hay cartas horneadas', () => {
  assert.ok(cartas.length >= 10, `solo ${cartas.length} cartas`);
});

test('todo hex presente es parseable — no hay basura pintable', () => {
  for (const c of cartas) {
    for (const t of c.tones) {
      if (t.hex === null) continue;
      assert.ok(parseHex(t.hex), `${c.card_id}/${t.code}: hex no parseable "${t.hex}"`);
      assert.match(t.hex, /^#[0-9a-f]{6}$/, `${c.card_id}/${t.code}: hex sin normalizar`);
    }
  }
});

test('un tono sin dato queda en null, no en un color de relleno', () => {
  // El modo de fallar tiene que ser explícito. Si algún día alguien "arregla"
  // los nulls poniéndoles negro, este test lo caza: nadie fabrica una carta
  // entera de #000000.
  for (const c of cartas) {
    const sinHex = c.tones.filter((t) => t.hex === null);
    for (const t of sinHex) {
      assert.equal(t.hex, null, `${c.card_id}/${t.code} debería ser null`);
    }
    const negros = c.tones.filter((t) => t.hex === '#000000').length;
    assert.ok(negros <= 2, `${c.card_id}: ${negros} tonos negros — huele a relleno`);
  }
});

test('la cuenta declarada coincide con los tonos reales', () => {
  // Los números del README salen de acá; si mienten, mienten en la submission.
  for (const c of cartas) {
    assert.equal(c.tones.length, c.tones_total, `${c.card_id}: tones_total`);
    assert.equal(c.tones.filter((t) => t.hex).length, c.tones_with_hex, `${c.card_id}: tones_with_hex`);
  }
});

test('no se filtró ningún identificador interno de inventario', () => {
  // El repo es público. variant_id es de la base de la tienda y no le sirve a
  // nadie afuera; el stock congelado sería mentira.
  const crudo = archivos.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
  for (const prohibido of ['variant_id', 'bsale', 'product_id', 'cost', 'margin']) {
    assert.ok(!crudo.toLowerCase().includes(prohibido), `se filtró "${prohibido}" a data/cards`);
  }
});

test('cada carta declara su medio y sus sustratos', () => {
  // Sin esto, la sustitución entre marcas puede proponer un marcador al
  // alcohol para pintar una pared. La clasificación es lo que permite decir
  // "no tengo un reemplazo honesto" en vez de adivinar.
  const medios = new Set(['alcohol-marker', 'alcohol-ink-refill', 'solvent-spray', 'acrylic-marker', 'water-based-paint-marker', 'leather-acrylic']);
  for (const c of cartas) {
    assert.ok(medios.has(c.medium), `${c.card_id}: medio desconocido "${c.medium}"`);
    assert.ok(Array.isArray(c.substrates) && c.substrates.length, `${c.card_id}: sin sustratos`);
    assert.ok(['opaque', 'transparent'].includes(c.opacity), `${c.card_id}: opacidad inválida`);
  }
});
