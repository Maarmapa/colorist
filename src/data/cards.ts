// Carga las cartas horneadas. Cero red: los hex viajan con la app.
//
// El stock es lo único que se pide en vivo, porque es lo único que cambia. Si
// no se puede consultar, la app sigue funcionando con el snapshot y lo DICE —
// un tono con disponibilidad desconocida nunca se recomienda como comprable.

import { hexToLab } from '../color/srgb-lab.ts';
import type { Tone } from '../color/gap.ts';

export interface CartaTono {
  code: string;
  name: string | null;
  hex: string | null;
  sku: string | null;
}

export interface Carta {
  card_id: string;
  brand: string | null;
  line: string | null;
  medium: string;
  opacity: 'opaque' | 'transparent';
  substrates: string[];
  base_price_clp: number | null;
  url: string | null;
  tones_total: number;
  tones_with_hex: number;
  baked_at: string;
  tones: CartaTono[];
}

const ARCHIVOS = [
  'copic-sketch', 'copic-ink', 'copic-ciao', 'copic-classic', 'copic-wide',
  'molotow-premium', 'molotow-premium-plus', 'molotow-premium-neon',
  'molotow-one4all-2mm', 'molotow-one4all-4mm', 'molotow-one4all-1.5mm', 'molotow-one4all-acrylic-twin',
  'uni-posca-3m', 'uni-posca-5m', 'uni-posca-8k', 'uni-posca-17k',
  'angelus-pearlescents-1oz',
];

/** Disponibilidad viva por `card:code`. null mientras no se pudo consultar. */
const stockVivo = new Map<string, boolean>();
let stockConsultado = false;

export async function cargarCartas(): Promise<Carta[]> {
  const mods = await Promise.all(
    ARCHIVOS.map((f) => import(`../../data/cards/${f}.json`).then((m) => m.default as Carta).catch(() => null)),
  );
  return mods.filter((c): c is Carta => c !== null);
}

/**
 * Los tonos que se pueden comprar hoy.
 *
 * `available` es `true` solo si el stock vivo lo confirmó. Mientras no se haya
 * podido consultar queda en `null`, y el motor no lo propone: afirmar
 * disponibilidad sin verificarla es exactamente lo que este producto no hace.
 */
export function tonosComprables(cartas: Carta[]): Tone[] {
  const out: Tone[] = [];
  for (const c of cartas) {
    for (const t of c.tones) {
      if (!t.hex) continue; // un tono sin color no se puede comparar ni pintar
      const lab = hexToLab(t.hex);
      if (!lab) continue;
      const clave = `${c.card_id}:${t.code}`;
      out.push({
        card: c.card_id,
        code: t.code,
        name: t.name,
        hex: t.hex,
        lab,
        priceClp: c.base_price_clp ?? 0,
        available: stockConsultado ? (stockVivo.get(clave) ?? false) : null,
      });
    }
  }
  return out;
}

export function hayStockVivo(): boolean {
  return stockConsultado;
}

/**
 * Trae el stock por carta desde el cortafuegos same-origin.
 *
 * Una llamada por carta, nunca una por tono. Si falla, no se reintenta en
 * bucle ni se rompe nada: la app queda en modo snapshot y el banner lo dice.
 */
export async function refrescarStock(cartas: Carta[], signal?: AbortSignal): Promise<{ ok: boolean; conStock: number }> {
  let conStock = 0;
  let alguna = false;

  for (const c of cartas) {
    try {
      const r = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal,
        body: JSON.stringify({
          jsonrpc: '2.0', id: Date.now(),
          method: 'tools/call',
          params: { name: 'get_color_card', arguments: { brand: c.card_id } },
        }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const texto = j?.result?.content?.[0]?.text;
      if (typeof texto !== 'string') continue;
      const datos = JSON.parse(texto) as { colors?: { code: string; disponible: boolean | null }[] };
      for (const col of datos.colors ?? []) {
        if (col.disponible === true) {
          stockVivo.set(`${c.card_id}:${String(col.code)}`, true);
          conStock++;
        }
      }
      alguna = true;
    } catch {
      // Silencio a propósito: el modo snapshot es un estado válido, no un error
      // que haya que gritar en consola una vez por carta.
    }
  }

  stockConsultado = alguna;
  return { ok: alguna, conStock };
}
