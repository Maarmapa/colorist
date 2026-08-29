// El motor de faltantes, que es donde vive la tesis del producto:
// una tienda que te dice cuándo NO comprar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarFaltantes, planDeCompra, MEJORA_MINIMA, IMPERCEPTIBLE } from '../src/color/gap.ts';
import { hexToLab } from '../src/color/srgb-lab.ts';

const tono = (card, code, hex, priceClp = 4300, available = true) => ({
  card, code, name: code, hex, lab: hexToLab(hex), priceClp, available,
});

const ROJO = '#d62828';
const AZUL = '#1d3557';
const VERDE = '#2a9d8f';

test('con el cajón vacío, todo objetivo es un hueco', () => {
  const cat = [tono('c', 'R1', ROJO)];
  const gaps = analizarFaltantes([ROJO], [], cat);
  assert.equal(gaps[0].bestOwned, null);
  assert.equal(gaps[0].bestBuyable.code, 'R1');
});

test('si ya tenés el color exacto, no hay nada que comprar', () => {
  // Es el corazón de la demo: el cajón cubre el objetivo y el plan queda vacío.
  const cat = [tono('c', 'R1', ROJO), tono('c', 'R2', '#d62829')];
  const cajon = [tono('c', 'R1', ROJO)];
  const gaps = analizarFaltantes([ROJO], cajon, cat);
  assert.equal(gaps[0].bestOwned.deltaE, 0);
  assert.equal(gaps[0].bestBuyable, null, 'no debería proponer comprar nada');

  const plan = planDeCompra([ROJO], cajon, cat);
  assert.equal(plan.recommended.length, 0);
  assert.equal(plan.totalClp, 0);
});

test('un tono agotado NUNCA se recomienda', () => {
  // available:false y available:null son distintos, y ninguno de los dos entra:
  // recomendar un stock desconocido es afirmar algo que no se verificó.
  const agotado = tono('c', 'R1', ROJO, 4300, false);
  const desconocido = tono('c', 'R2', ROJO, 4300, null);
  const gaps = analizarFaltantes([ROJO], [], [agotado, desconocido]);
  assert.equal(gaps[0].bestBuyable, null);

  const plan = planDeCompra([ROJO], [], [agotado, desconocido]);
  assert.equal(plan.recommended.length, 0);
});

test('el plan optimiza el PEOR caso, no el promedio', () => {
  // Con dos objetivos, uno perfectamente cubierto y otro imposible, el primer
  // marcador tiene que atacar el imposible. Un optimizador de promedio se
  // distrae mejorando el que ya estaba bien.
  const cajon = [tono('c', 'R1', ROJO)];
  const cat = [
    tono('c', 'R2', '#d62829'), // casi idéntico al que ya tiene: aporta nada
    tono('c', 'B1', AZUL),      // resuelve el objetivo descubierto
  ];
  const plan = planDeCompra([ROJO, AZUL], cajon, cat);
  assert.equal(plan.recommended[0].code, 'B1', 'el primer paso debe atacar el peor caso');
});

test('marca el paso donde deja de valer la pena y lo muestra igual', () => {
  // La frase "el cuarto no lo compres" solo se puede decir si el paso inútil
  // se calcula y se muestra en vez de esconderse.
  const cat = [
    tono('c', 'B1', AZUL),
    tono('c', 'V1', VERDE),
    tono('c', 'B2', '#1d3558'), // indistinguible de B1: no compra nada
  ];
  const plan = planDeCompra([AZUL, VERDE], [], cat);
  const inutiles = plan.steps.filter((s) => !s.worth);
  assert.ok(plan.recommended.length >= 1, 'debe recomendar al menos uno');
  assert.ok(plan.steps.length > plan.recommended.length || plan.worstAfterRecommended <= IMPERCEPTIBLE,
    'o muestra el paso inútil, o llegó a lo imperceptible');
  for (const s of inutiles) {
    assert.ok(s.buys < MEJORA_MINIMA, 'un paso marcado inútil debe comprar menos que el mínimo');
  }
});

test('cada paso reporta cuánto compra, y null cuando no había con qué comparar', () => {
  // Con el cajón vacío no existe un "peor caso antes": el primer marcador pasa
  // de no-poder-hacerlo a poder-hacerlo, y eso no es una resta. Devolver un
  // número ahí obliga a inventar un punto de partida — antes había un 100 de
  // relleno que producía cifras como "compra ΔE 68.4", que no miden nada y que
  // un agente repetiría como si fueran una medición.
  const plan = planDeCompra([AZUL, VERDE], [], [tono('c', 'B1', AZUL), tono('c', 'V1', VERDE)]);
  assert.equal(plan.steps[0].worstBefore, null, 'sin cajón no hay punto de partida');
  assert.equal(plan.steps[0].buys, null, 'y por lo tanto tampoco hay mejora medible');

  for (const s of plan.steps) {
    assert.equal(typeof s.priceClp, 'number');
    assert.equal(typeof s.worstAfter, 'number');
    if (s.worstBefore !== null) {
      assert.equal(typeof s.buys, 'number');
      assert.ok(s.worstAfter <= s.worstBefore, 'el peor caso no puede empeorar al agregar un tono');
    }
  }
});

test('con cajón, los pasos sí traen números medidos', () => {
  const cajon = [tono('c', 'R1', ROJO)];
  const plan = planDeCompra([ROJO, AZUL], cajon, [tono('c', 'B1', AZUL)]);
  assert.equal(typeof plan.steps[0].worstBefore, 'number');
  assert.equal(typeof plan.steps[0].buys, 'number');
});

test('el total en pesos es la suma de lo recomendado, no de todo lo evaluado', () => {
  const cat = [tono('c', 'B1', AZUL, 5000), tono('c', 'V1', VERDE, 3000), tono('c', 'B2', '#1d3558', 9999)];
  const plan = planDeCompra([AZUL, VERDE], [], cat);
  assert.equal(plan.totalClp, plan.recommended.reduce((s, r) => s + r.priceClp, 0));
  assert.ok(!plan.recommended.some((r) => r.code === 'B2'), 'B2 no aporta y no debe entrar al total');
});

test('un objetivo con hex ilegible se ignora, no rompe ni se adivina', () => {
  const gaps = analizarFaltantes(['no-es-un-color', AZUL], [], [tono('c', 'B1', AZUL)]);
  assert.equal(gaps.length, 1, 'solo el objetivo válido produce resultado');
  assert.equal(gaps[0].target, AZUL);
});

test('no propone comprar algo que ya está en el cajón', () => {
  const cajon = [tono('c', 'B1', AZUL)];
  const cat = [tono('c', 'B1', AZUL), tono('c', 'V1', VERDE)];
  const plan = planDeCompra([AZUL, VERDE], cajon, cat);
  assert.ok(!plan.steps.some((s) => s.code === 'B1'), 'B1 ya lo tiene');
});
