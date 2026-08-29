import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHex, rgbToLab, hexToLab, readableInk } from '../src/color/srgb-lab.ts';
import { ciede2000 } from '../src/color/ciede2000.ts';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);

test('los anclas conocidos de sRGB → Lab', () => {
  // Valores estándar de sRGB bajo D65. Si la linealización gamma faltara,
  // el gris medio sería el que más se desviaría — por eso está en la lista.
  const casos = [
    ['#ffffff', { L: 100, a: 0, b: 0 }],
    ['#000000', { L: 0, a: 0, b: 0 }],
    ['#ff0000', { L: 53.24, a: 80.09, b: 67.2 }],
    ['#00ff00', { L: 87.73, a: -86.18, b: 83.18 }],
    ['#0000ff', { L: 32.3, a: 79.19, b: -107.86 }],
    ['#808080', { L: 53.59, a: 0, b: 0 }],
  ];
  for (const [hex, esperado] of casos) {
    const lab = hexToLab(hex);
    cerca(lab.L, esperado.L, 0.02, `${hex} L`);
    cerca(lab.a, esperado.a, 0.02, `${hex} a`);
    cerca(lab.b, esperado.b, 0.02, `${hex} b`);
  }
});

test('un hex inválido devuelve null, nunca un color inventado', () => {
  // Es la regla del producto: un tono sin dato se reporta como sin mapear.
  // Si esto devolviera negro por defecto, la app pintaría con seguridad un
  // color que la marca nunca fabricó.
  for (const malo of ['', 'rojo', '#12', '#zzzzzz', '#1234567', null, undefined, 42]) {
    assert.equal(parseHex(malo), null, `${String(malo)} debería ser null`);
    if (typeof malo === 'string') assert.equal(hexToLab(malo), null);
  }
});

test('acepta las formas válidas de hex', () => {
  assert.deepEqual(parseHex('#FFF'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('  #A1b2C3  '), { r: 161, g: 178, b: 195 });
});

test('el mismo color contra sí mismo da distancia 0 pasando por Lab', () => {
  for (const hex of ['#fdf4a6', '#3A8DC7', '#F5E3DA', '#101820']) {
    assert.equal(ciede2000(hexToLab(hex), hexToLab(hex)), 0);
  }
});

test('el orden perceptual es el que espera el ojo, no el de RGB', () => {
  // Dos azules oscuros vecinos tienen que quedar MÁS cerca entre sí que un
  // azul de un amarillo. En distancia euclidiana sobre RGB este orden se
  // invierte en varios casos; es la razón entera de usar CIEDE2000.
  const azul = hexToLab('#3A8DC7');
  const azulVecino = hexToLab('#3E90C9');
  const amarillo = hexToLab('#fdf4a6');
  assert.ok(ciede2000(azul, azulVecino) < ciede2000(azul, amarillo));
  assert.ok(ciede2000(azul, azulVecino) < 2, 'vecinos casi imperceptibles');
});

test('el texto sobre el swatch se elige por contraste, no por gusto', () => {
  assert.equal(readableInk('#ffffff'), '#000000');
  assert.equal(readableInk('#000000'), '#ffffff');
  assert.equal(readableInk('#fdf4a6'), '#000000'); // amarillo claro
  assert.equal(readableInk('#101820'), '#ffffff'); // negro Boykot
  assert.equal(readableInk('sin-hex'), '#000000'); // degrada, no explota
});
