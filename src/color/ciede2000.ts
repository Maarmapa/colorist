// CIEDE2000 — distancia perceptual entre dos colores.
//
// POR QUÉ ESTO VIVE EN LA PÁGINA Y NO EN UN SERVIDOR:
// es el corazón del proyecto. El agente sabe razonar sobre color pero no lo
// ve; esta página tiene los 358 tonos con su valor real y puede medir, en
// milisegundos y sin salir a la red, cuál de todos se parece más al que la
// persona quiere. Mover este cálculo a un servidor lo convertiría en una API
// más — y entonces WebMCP sobraría. Acá adentro, en cambio, cada llamada del
// agente cuesta cero requests y responde en el mismo frame.
//
// POR QUÉ CIEDE2000 Y NO LA DISTANCIA EUCLIDIANA EN RGB:
// en RGB, dos azules oscuros que el ojo no distingue quedan lejos, y dos
// verdes claramente distintos quedan cerca. CIEDE2000 corrige eso con los
// términos que el ojo realmente usa: pesa distinto la claridad, el croma y el
// tono, y agrega una rotación para los azules, donde la fórmula anterior
// fallaba feo. Para "¿qué marcador se parece más a este color?" la diferencia
// no es académica: es acertar o mandar a alguien a comprar el tono equivocado.
//
// Referencia: Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference
// Formula: Implementation Notes, Supplementary Test Data, and Mathematical
// Observations". Los 34 pares de prueba de ese paper están en
// tests/ciede2000.test.mjs — existen justamente porque esta fórmula tiene
// varios lugares donde una implementación razonable da un número casi
// correcto, y "casi" acá significa recomendar mal.

export interface Lab {
  L: number;
  a: number;
  b: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** atan2 en grados, normalizado a [0, 360). */
function hueAngle(b: number, a: number): number {
  if (a === 0 && b === 0) return 0;
  const h = deg(Math.atan2(b, a));
  return h >= 0 ? h : h + 360;
}

/**
 * Diferencia de color CIEDE2000 entre dos colores Lab.
 *
 * Los parámetros kL/kC/kH son los factores paramétricos de la fórmula; 1,1,1
 * es la condición de referencia y es lo que corresponde para comparar swatches
 * bajo luz de día, que es el caso de esta app.
 */
export function ciede2000(c1: Lab, c2: Lab, kL = 1, kC = 1, kH = 1): number {
  const { L: L1, a: a1, b: b1 } = c1;
  const { L: L2, a: a2, b: b2 } = c2;

  // Paso 1: C y h modificados por G, que expande el croma bajo para que los
  // grises no se comporten como un punto singular.
  const C1ab = Math.hypot(a1, b1);
  const C2ab = Math.hypot(a2, b2);
  const Cab = (C1ab + C2ab) / 2;

  const Cab7 = Cab ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);

  // Paso 2: las diferencias.
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  // Cuando alguno de los dos es acromático el tono no existe, y la diferencia
  // de tono tiene que ser 0 — no el resultado de restar dos ángulos que no
  // significan nada. Este es el primero de los tres lugares donde una
  // implementación distraída se desvía.
  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  // Paso 3: los promedios y los pesos.
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  // Promedio de tono: el segundo lugar delicado. Promediar 350° y 10° da 180°,
  // que es el tono opuesto al correcto (0°).
  let hp: number;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp = (h1p + h2p + 360) / 2;
  } else {
    hp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hp - 30)) +
    0.24 * Math.cos(rad(2 * hp)) +
    0.32 * Math.cos(rad(3 * hp + 6)) -
    0.2 * Math.cos(rad(4 * hp - 63));

  const dTheta = 30 * Math.exp(-(((hp - 275) / 25) ** 2));

  const Cp7 = Cp ** 7;
  const RC = 2 * Math.sqrt(Cp7 / (Cp7 + 25 ** 7));

  const Lp50 = (Lp - 50) ** 2;
  const SL = 1 + (0.015 * Lp50) / Math.sqrt(20 + Lp50);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  // El término de rotación: es lo que arregla la zona de los azules, donde
  // CIE94 daba diferencias que no se parecían a lo que ve el ojo.
  const RT = -Math.sin(rad(2 * dTheta)) * RC;

  const termL = dLp / (kL * SL);
  const termC = dCp / (kC * SC);
  const termH = dHp / (kH * SH);

  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + RT * termC * termH);
}

/** Cuán distinguible es una diferencia, en palabras que el agente puede repetirle a la persona. */
export function describeDelta(dE: number): string {
  if (dE < 1) return 'indistinguishable';
  if (dE < 2) return 'barely perceptible side by side';
  if (dE < 5) return 'noticeable but close';
  if (dE < 10) return 'clearly different';
  return 'a different color';
}
