// El filtro físico: la conversación del mesón, como test.
//
// La garantía que se prueba acá es la más difícil de conseguir en un
// recomendador: poder decir "no tengo un reemplazo honesto" en vez de ofrecer
// lo más parecido. Si esto se rompe, la app le vende a alguien un marcador al
// alcohol para pintar una pared — el color da perfecto y el trabajo se arruina.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { filtrarPorSuperficie, sirve, razon, sinReemplazoHonesto } from '../src/color/substrate.ts';
import { hexToLab } from '../src/color/srgb-lab.ts';

const dir = new URL('../data/cards/', import.meta.url);
const cartas = readdirSync(dir).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

const tonosDe = (cartas) => cartas.flatMap((c) =>
  c.tones.filter((t) => t.hex).map((t) => ({
    card: c.card_id, code: t.code, name: t.name, hex: t.hex,
    lab: hexToLab(t.hex), priceClp: c.base_price_clp ?? 0, available: true,
  })));

const TODOS = tonosDe(cartas);

test('un marcador al alcohol NUNCA se ofrece para un muro', () => {
  // El caso que este archivo existe para impedir. El color puede dar perfecto:
  // igual no sirve.
  const { usables } = filtrarPorSuperficie(TODOS, cartas, 'wall');
  const alcohol = usables.filter((t) => t.card.startsWith('copic-'));
  assert.equal(alcohol.length, 0, `${alcohol.length} tonos Copic se colaron para muro`);
  assert.ok(usables.length > 0, 'pero algo tiene que quedar para muro');
});

test('el papel sí acepta los marcadores al alcohol', () => {
  const { usables } = filtrarPorSuperficie(TODOS, cartas, 'paper');
  assert.ok(usables.some((t) => t.card === 'copic-sketch'), 'Copic debería servir para papel');
});

test('sin superficie declarada no se filtra nada, y no se inventa un default', () => {
  // La ignorancia se declara. Un default silencioso es una restricción que
  // nadie recuerda que estaba puesta.
  const r = filtrarPorSuperficie(TODOS, cartas, null);
  assert.equal(r.usables.length, TODOS.length);
  assert.equal(r.excluidos.length, 0);
});

test('cada exclusión viene con su razón física, no con un código', () => {
  const { excluidos } = filtrarPorSuperficie(TODOS, cartas, 'wall');
  assert.ok(excluidos.length > 0);
  for (const e of excluidos) {
    assert.ok(e.reason.length > 40, `razón demasiado corta para ${e.card}: "${e.reason}"`);
    assert.ok(/paper|lacquer|leather|water-based|surface/i.test(e.reason), `la razón de ${e.card} no explica nada físico`);
    assert.ok(e.tones > 0);
  }
});

test('el cuero solo acepta pintura para cuero', () => {
  const { usables } = filtrarPorSuperficie(TODOS, cartas, 'leather');
  const cartasUsadas = new Set(usables.map((t) => t.card));
  for (const id of cartasUsadas) {
    const c = cartas.find((x) => x.card_id === id);
    assert.ok(c.substrates.includes('leather'), `${id} no debería servir para cuero`);
  }
});

test('el rechazo honesto explica y no ofrece un sustituto', () => {
  const { excluidos } = filtrarPorSuperficie(TODOS, cartas, 'wall');
  const texto = sinReemplazoHonesto(excluidos, 'wall');
  assert.match(texto, /declines/i, 'debe decir explícitamente que se niega');
  assert.match(texto, /Nothing in this catalogue is made for wall/);
  // Y no puede colar una recomendación en el mismo mensaje.
  assert.doesNotMatch(texto, /closest match is|try |instead use/i);
});

test('sirve() y razon() coinciden: si no sirve, hay razón', () => {
  for (const c of cartas) {
    for (const s of ['paper', 'wall', 'leather', 'glass']) {
      if (sirve(c, s)) continue;
      const r = razon(c, s);
      assert.ok(r.includes(c.medium.replace(/-/g, ' ')), `la razón de ${c.card_id} debería nombrar su medio`);
    }
  }
});
