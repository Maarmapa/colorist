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
 * Trae el stock por carta a través del cortafuegos same-origin.
 *
 * En PARALELO, y esto no es micro-optimización: en serie tardaba más de 80
 * segundos en producción —17 saltos encadenados de serverless a la tienda— y
 * la página se quedaba diciendo "checking stock" todo ese rato. Nadie espera
 * eso, y menos un jurado con tres minutos.
 *
 * Una llamada por CARTA, nunca una por tono. Cada una con su propio tope de
 * tiempo: una carta lenta no puede arrastrar a las otras dieciséis. Y si todas
 * fallan, no se reintenta en bucle: la app queda en modo snapshot y lo declara.
 */
export async function refrescarStock(cartas: Carta[], signal?: AbortSignal): Promise<{ ok: boolean; conStock: number }> {
  const TOPE_MS = 15_000;

  const unaCarta = async (c: Carta): Promise<number | null> => {
    try {
      const reloj = AbortSignal.timeout(TOPE_MS);
      const r = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: signal ? AbortSignal.any([signal, reloj]) : reloj,
        body: JSON.stringify({
          jsonrpc: '2.0', id: Date.now(),
          method: 'tools/call',
          params: { name: 'get_color_card', arguments: { brand: c.card_id } },
        }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      const texto = j?.result?.content?.[0]?.text;
      if (typeof texto !== 'string') return null;
      const datos = JSON.parse(texto) as { colors?: { code: string; disponible: boolean | null }[] };
      let n = 0;
      for (const col of datos.colors ?? []) {
        if (col.disponible === true) {
          stockVivo.set(`${c.card_id}:${String(col.code)}`, true);
          n++;
        }
      }
      return n;
    } catch {
      // Silencio a propósito: el modo snapshot es un estado válido, no un
      // error que haya que gritar diecisiete veces en la consola.
      return null;
    }
  };

  const resultados = await Promise.all(cartas.map(unaCarta));
  const buenas = resultados.filter((n): n is number => n !== null);
  stockConsultado = buenas.length > 0;
  return { ok: stockConsultado, conStock: buenas.reduce((a, b) => a + b, 0) };
}
