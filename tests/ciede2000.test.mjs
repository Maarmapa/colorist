// Los 34 pares de prueba de Sharma, Wu & Dalal (2005).
//
// Existen porque CIEDE2000 tiene tres lugares donde una implementación
// razonable da un número casi correcto: el promedio de tono cuando los ángulos
// cruzan 0°/360°, la diferencia de tono cuando alguno de los colores es
// acromático, y el término de rotación RT en la zona de los azules. Los pares
// del paper están elegidos justamente para caer en esas trampas — los pares
// 1 a 16 son casi todos casos borde, no colores de verdad.
//
// Acá esto no es un ejercicio: si la fórmula se desvía, la app recomienda con
// seguridad el marcador equivocado, que es peor que no recomendar nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ciede2000, describeDelta } from '../src/color/ciede2000.ts';

// [L1, a1, b1, L2, a2, b2, dE00 esperado]
const SHARMA = [
  [50.0000, 2.6772, -79.7751, 50.0000, 0.0000, -82.7485, 2.0425],
  [50.0000, 3.1571, -77.2803, 50.0000, 0.0000, -82.7485, 2.8615],
  [50.0000, 2.8361, -74.0200, 50.0000, 0.0000, -82.7485, 3.4412],
  [50.0000, -1.3802, -84.2814, 50.0000, 0.0000, -82.7485, 1.0000],
  [50.0000, -1.1848, -84.8006, 50.0000, 0.0000, -82.7485, 1.0000],
  [50.0000, -0.9009, -85.5211, 50.0000, 0.0000, -82.7485, 1.0000],
  [50.0000, 0.0000, 0.0000, 50.0000, -1.0000, 2.0000, 2.3669],
  [50.0000, -1.0000, 2.0000, 50.0000, 0.0000, 0.0000, 2.3669],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0009, 7.1792],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0010, 7.1792],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0011, 7.2195],
  [50.0000, 2.4900, -0.0010, 50.0000, -2.4900, 0.0012, 7.2195],
  [50.0000, -0.0010, 2.4900, 50.0000, 0.0009, -2.4900, 4.8045],
  [50.0000, -0.0010, 2.4900, 50.0000, 0.0010, -2.4900, 4.8045],
  [50.0000, -0.0010, 2.4900, 50.0000, 0.0011, -2.4900, 4.7461],
  [50.0000, 2.5000, 0.0000, 50.0000, 0.0000, -2.5000, 4.3065],
  [50.0000, 2.5000, 0.0000, 73.0000, 25.0000, -18.0000, 27.1492],
  [50.0000, 2.5000, 0.0000, 61.0000, -5.0000, 29.0000, 22.8977],
  [50.0000, 2.5000, 0.0000, 56.0000, -27.0000, -3.0000, 31.9030],
  [50.0000, 2.5000, 0.0000, 58.0000, 24.0000, 15.0000, 19.4535],
  [50.0000, 2.5000, 0.0000, 50.0000, 3.1736, 0.5854, 1.0000],
  [50.0000, 2.5000, 0.0000, 50.0000, 3.2972, 0.0000, 1.0000],
  [50.0000, 2.5000, 0.0000, 50.0000, 1.8634, 0.5757, 1.0000],
  [50.0000, 2.5000, 0.0000, 50.0000, 3.2592, 0.3350, 1.0000],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.2630],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.2480, -4.9620, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.6940, 23.0331, 14.9730, -42.5619, 2.0373],
  [36.4612, 47.8580, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.4410, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.1350, 0.9033, -0.0636, -0.5514, 0.9082],
];

test('los 34 pares de referencia de Sharma', () => {
  const fallas = [];
  SHARMA.forEach(([L1, a1, b1, L2, a2, b2, esperado], i) => {
    const got = ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
    // El paper publica 4 decimales; se tolera 1e-4 por redondeo de punto flotante.
    if (Math.abs(got - esperado) > 1e-4) {
      fallas.push(`par ${i + 1}: esperado ${esperado}, obtenido ${got.toFixed(4)}`);
    }
  });
  assert.deepEqual(fallas, [], `\n${fallas.join('\n')}`);
});

test('es simétrica: dE(a,b) === dE(b,a)', () => {
  // No es obvio: el promedio de tono y el término de rotación se calculan
  // sobre los dos colores a la vez, y una implementación que se apoye en el
  // orden se rompe acá y en ningún otro lado.
  SHARMA.forEach(([L1, a1, b1, L2, a2, b2], i) => {
    const ab = ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
    const ba = ciede2000({ L: L2, a: a2, b: b2 }, { L: L1, a: a1, b: b1 });
    assert.ok(Math.abs(ab - ba) < 1e-10, `par ${i + 1} no es simétrico: ${ab} vs ${ba}`);
  });
});

test('un color contra sí mismo da exactamente 0', () => {
  for (const [L, a, b] of [[50, 2.5, 0], [0, 0, 0], [100, 0, 0], [22.7, 20.1, -46.7]]) {
    assert.equal(ciede2000({ L, a, b }, { L, a, b }), 0);
  }
});

test('describeDelta no promete lo que la fórmula no dice', () => {
  assert.equal(describeDelta(0.5), 'indistinguishable');
  assert.equal(describeDelta(1.5), 'barely perceptible side by side');
  assert.equal(describeDelta(3), 'noticeable but close');
  assert.equal(describeDelta(7), 'clearly different');
  assert.equal(describeDelta(30), 'a different color');
});
