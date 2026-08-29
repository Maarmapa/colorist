// El motor que decide qué te falta de verdad — y cuándo NO comprar.
//
// La pregunta no es "¿qué color se parece a este?", que es lo que hace
// cualquier buscador. Es: dado lo que YA tenés en el cajón, ¿cuál es el color
// de tu paleta objetivo que peor podés resolver hoy, y cuánto mejora si gastás
// plata? Y sobre todo: ¿a partir de qué marcador dejás de mejorar?
//
// Por eso el criterio es el PEOR CASO y no el promedio. Un promedio esconde el
// tono que no podés hacer de ninguna manera: si tenés nueve colores perfectos
// y uno imposible, el promedio se ve bien y el trabajo igual sale mal. Se
// optimiza lo que más duele.
//
// El costo se mide en pesos y el beneficio en ΔE00, así que se puede decir la
// frase que ninguna tienda dice: "el cuarto marcador te compra 0,3 de ΔE, no
// lo compres".

import { ciede2000, type Lab } from './ciede2000.ts';
import { hexToLab } from './srgb-lab.ts';

export interface Tone {
  card: string;
  code: string;
  name: string | null;
  hex: string;
  lab: Lab;
  priceClp: number;
  /** null cuando no se pudo consultar el stock: no se afirma disponibilidad. */
  available: boolean | null;
}

export interface Gap {
  /** el color que se quería */
  target: string;
  /** el mejor tono del CAJÓN para ese objetivo, o null si el cajón está vacío */
  bestOwned: { card: string; code: string; name: string | null; hex: string; deltaE: number } | null;
  /** el mejor tono COMPRABLE que mejora lo que ya tenés */
  bestBuyable: { card: string; code: string; name: string | null; hex: string; deltaE: number; priceClp: number } | null;
  /** cuánto mejora comprar frente a arreglárselas con lo que hay */
  improvement: number | null;
}

/** ΔE por debajo del cual dos colores son indistinguibles para el ojo. */
export const IMPERCEPTIBLE = 2;

/**
 * Mejora mínima que justifica gastar. Por debajo de esto la compra no se
 * recomienda: es la frase "no lo compres" en forma de constante.
 */
export const MEJORA_MINIMA = 1.5;

function masCercano(objetivo: Lab, tonos: readonly Tone[]) {
  let mejor: Tone | null = null;
  let mejorD = Infinity;
  for (const t of tonos) {
    const d = ciede2000(objetivo, t.lab);
    if (d < mejorD) {
      mejorD = d;
      mejor = t;
    }
  }
  return mejor ? { tono: mejor, deltaE: mejorD } : null;
}

/**
 * Para cada color objetivo: con qué lo resolvés hoy y qué ganarías comprando.
 *
 * `catalogo` son los tonos comprables (ya filtrados por medio/sustrato antes
 * de llegar acá — un marcador al alcohol no puede aparecer como candidato para
 * un muro por más que el ΔE sea 0).
 */
export function analizarFaltantes(
  objetivos: string[],
  enCajon: readonly Tone[],
  catalogo: readonly Tone[],
): Gap[] {
  const salida: Gap[] = [];

  for (const target of objetivos) {
    const lab = hexToLab(target);
    if (!lab) continue; // un objetivo ilegible se salta, no se adivina

    const owned = masCercano(lab, enCajon);
    const dOwned = owned ? owned.deltaE : Infinity;

    // Solo se consideran comprables los que están disponibles HOY. Un tono con
    // stock desconocido (available === null) no entra: recomendarlo sería
    // afirmar algo que no se verificó.
    const comprables = catalogo.filter((t) => t.available === true && !enCajonTiene(enCajon, t));
    const buyable = masCercano(lab, comprables);

    const mejora = buyable && Number.isFinite(dOwned) ? dOwned - buyable.deltaE : buyable ? null : null;

    salida.push({
      target,
      bestOwned: owned
        ? { card: owned.tono.card, code: owned.tono.code, name: owned.tono.name, hex: owned.tono.hex, deltaE: round(owned.deltaE) }
        : null,
      bestBuyable:
        buyable && (!Number.isFinite(dOwned) || buyable.deltaE < dOwned)
          ? {
              card: buyable.tono.card,
              code: buyable.tono.code,
              name: buyable.tono.name,
              hex: buyable.tono.hex,
              deltaE: round(buyable.deltaE),
              priceClp: buyable.tono.priceClp,
            }
          : null,
      improvement: mejora == null ? null : round(mejora),
    });
  }

  return salida;
}

const enCajonTiene = (cajon: readonly Tone[], t: Tone) =>
  cajon.some((o) => o.card === t.card && o.code === t.code);

const round = (n: number) => Math.round(n * 10) / 10;

export interface Compra {
  card: string;
  code: string;
  name: string | null;
  hex: string;
  priceClp: number;
  /** Peor caso ANTES de agregar este marcador. `null` = no había con qué
   *  cubrirlo, y entonces no existe un número: se dice, no se inventa. */
  worstBefore: number | null;
  /** peor caso DESPUÉS */
  worstAfter: number;
  /** Cuánto ΔE compra. `null` cuando no había punto de partida medible —
   *  restarle algo a "nada" daría una cifra fabricada. */
  buys: number | null;
  /** si conviene o no */
  worth: boolean;
}

export interface Plan {
  /** peor caso con lo que ya tenés */
  worstNow: number | null;
  steps: Compra[];
  /** los pasos que sí valen la pena */
  recommended: Compra[];
  totalClp: number;
  worstAfterRecommended: number | null;
}

/**
 * Plan de compra goloso sobre el PEOR CASO.
 *
 * En cada paso se elige el tono comprable que más baja el peor ΔE de toda la
 * paleta. Se sigue hasta que el siguiente marcador compra menos que
 * MEJORA_MINIMA — y ese paso se devuelve igual, marcado `worth:false`, porque
 * mostrar dónde deja de valer la pena es más útil que ocultarlo.
 */
export function planDeCompra(
  objetivos: string[],
  enCajon: readonly Tone[],
  catalogo: readonly Tone[],
  maxPasos = 6,
): Plan {
  const labs = objetivos.map(hexToLab).filter((l): l is Lab => l !== null);
  if (labs.length === 0) return { worstNow: null, steps: [], recommended: [], totalClp: 0, worstAfterRecommended: null };

  const teniendo: Tone[] = [...enCajon];
  const disponibles = catalogo.filter((t) => t.available === true && !enCajonTiene(enCajon, t));

  const peorCaso = (tonos: readonly Tone[]): number => {
    if (tonos.length === 0) return Infinity;
    let peor = 0;
    for (const lab of labs) {
      const c = masCercano(lab, tonos);
      const d = c ? c.deltaE : Infinity;
      if (d > peor) peor = d;
    }
    return peor;
  };

  const inicial = peorCaso(teniendo);
  const steps: Compra[] = [];
  const yaElegidos = new Set<string>();

  for (let paso = 0; paso < maxPasos; paso++) {
    const antes = peorCaso(teniendo);
    if (antes <= IMPERCEPTIBLE) break; // ya no hay nada que mejorar

    let mejor: { t: Tone; despues: number } | null = null;
    for (const cand of disponibles) {
      const clave = `${cand.card}::${cand.code}`;
      if (yaElegidos.has(clave)) continue;
      const despues = peorCaso([...teniendo, cand]);
      if (!mejor || despues < mejor.despues) mejor = { t: cand, despues };
    }
    if (!mejor) break;

    // Sin cobertura previa no hay "cuánto mejora": el primer marcador pasa de
    // no-poder-hacerlo a poder-hacerlo, y eso no es una resta. Antes acá había
    // un 100 de relleno que producía cifras como "compra ΔE 68.4", que no
    // significan nada y que un agente repetiría como si fueran medidas.
    const sinCobertura = !Number.isFinite(antes);
    const compra: Compra = {
      card: mejor.t.card,
      code: mejor.t.code,
      name: mejor.t.name,
      hex: mejor.t.hex,
      priceClp: mejor.t.priceClp,
      worstBefore: sinCobertura ? null : round(antes),
      worstAfter: round(mejor.despues),
      buys: sinCobertura ? null : round(antes - mejor.despues),
      // El primero siempre vale la pena si no había NADA con qué cubrir.
      worth: sinCobertura ? true : antes - mejor.despues >= MEJORA_MINIMA,
    };
    steps.push(compra);
    yaElegidos.add(`${mejor.t.card}::${mejor.t.code}`);
    teniendo.push(mejor.t);

    // Un paso que ya no vale la pena se muestra y se corta: la persona ve
    // exactamente dónde está el límite en vez de confiar en que lo cortamos bien.
    if (!compra.worth) break;
  }

  const recommended = steps.filter((s) => s.worth);
  const conRecomendados = [...enCajon, ...recommended.map((r) => catalogo.find((t) => t.card === r.card && t.code === r.code)!).filter(Boolean)];

  return {
    worstNow: Number.isFinite(inicial) ? round(inicial) : null,
    steps,
    recommended,
    totalClp: recommended.reduce((s, r) => s + r.priceClp, 0),
    worstAfterRecommended: recommended.length ? round(peorCaso(conRecomendados)) : Number.isFinite(inicial) ? round(inicial) : null,
  };
}
