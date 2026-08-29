// Sobre qué vas a pintar, y por qué eso manda sobre el color.
//
// Este archivo es la conversación del mesón de una tienda de arte, escrita en
// código. Alguien entra y pide "un marcador de este color para pintar una
// pared". El color existe: hay un Copic que da en el clavo con ΔE 0,8. Y la
// respuesta correcta sigue siendo NO — la tinta al alcohol es transparente, se
// va con el sol y no cubre. Venderle ese marcador es venderle un trabajo que
// se arruina en dos semanas.
//
// Por eso el filtro físico corre ANTES que la distancia de color, nunca
// después. Un candidato que no sirve para el sustrato no es un candidato
// "peor": no es candidato. Si se filtrara al final, el ranking ya estaría
// contaminado y el mejor resultado sería el equivocado.
//
// Y de acá sale la capacidad más difícil de conseguir en un sistema de
// recomendación: poder decir "no tengo un reemplazo honesto para esto", con la
// razón física, en vez de ofrecer lo más parecido que haya.

import type { Carta } from '../data/cards.ts';
import type { Tone } from './gap.ts';

export const SUPERFICIES = [
  'paper', 'cardstock', 'canvas', 'wall', 'wood', 'metal', 'glass', 'plastic', 'fabric', 'leather',
] as const;

export type Superficie = (typeof SUPERFICIES)[number];

/** Por qué un medio no sirve para una superficie. En castellano llano, para que el agente lo pueda repetir. */
const PORQUE: Record<string, string> = {
  'alcohol-marker':
    'alcohol ink is transparent and made for paper — it does not cover, and it fades outdoors',
  'alcohol-ink-refill':
    'alcohol ink is transparent and made for paper — it does not cover, and it fades outdoors',
  'solvent-spray':
    'solvent spray needs a surface that tolerates lacquer, and it bleeds through thin paper',
  'acrylic-marker': 'water-based acrylic is not made for this surface',
  'water-based-paint-marker': 'water-based pigment does not hold on this surface',
  'leather-acrylic': 'leather paint is formulated for leather and does not bond here',
};

export function sirve(carta: Carta, superficie: Superficie): boolean {
  return carta.substrates.includes(superficie);
}

/** Por qué esta carta no sirve acá. */
export function razon(carta: Carta, superficie: Superficie): string {
  const base = PORQUE[carta.medium] ?? 'this medium is not made for this surface';
  return `${carta.brand ?? carta.card_id} ${carta.line ?? ''} is ${carta.medium.replace(/-/g, ' ')}: ${base}.`.replace(/\s+/g, ' ');
}

export interface FiltroResultado {
  /** los tonos que SÍ se pueden usar sobre esa superficie */
  usables: Tone[];
  /** cuántos quedaron afuera y por qué, agrupado por carta */
  excluidos: { card: string; tones: number; reason: string }[];
}

/**
 * Deja solo lo que físicamente sirve. Se aplica ANTES del cálculo de color.
 *
 * Sin superficie declarada no se filtra nada: no se inventa una restricción
 * que la persona no puso. La ignorancia se declara, no se rellena con un
 * default que después nadie recuerda que estaba puesto.
 */
export function filtrarPorSuperficie(
  tonos: Tone[],
  cartas: Carta[],
  superficie: Superficie | null,
): FiltroResultado {
  if (!superficie) return { usables: tonos, excluidos: [] };

  const porCarta = new Map(cartas.map((c) => [c.card_id, c]));
  const usables: Tone[] = [];
  const fuera = new Map<string, number>();

  for (const t of tonos) {
    const carta = porCarta.get(t.card);
    if (!carta) continue;
    if (sirve(carta, superficie)) usables.push(t);
    else fuera.set(t.card, (fuera.get(t.card) ?? 0) + 1);
  }

  const excluidos = [...fuera.entries()].map(([card, tones]) => ({
    card,
    tones,
    reason: razon(porCarta.get(card)!, superficie),
  }));

  return { usables, excluidos };
}

/**
 * El rechazo honesto.
 *
 * Cuando para una superficie no queda NINGÚN medio que sirva, la respuesta no
 * es el tono más parecido: es que no hay. Devolver "lo más cercano" acá sería
 * exactamente el error que este archivo existe para impedir.
 */
export function sinReemplazoHonesto(excluidos: FiltroResultado['excluidos'], superficie: Superficie): string {
  return (
    `Nothing in this catalogue is made for ${superficie}. ` +
    excluidos.map((e) => e.reason).join(' ') +
    ' Rather than offer the closest colour on an unsuitable medium, this workbench declines.'
  );
}
