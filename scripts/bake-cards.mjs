// Hornea las cartas de color al repo, desde el endpoint MCP público de la tienda.
//
// POR QUÉ SE HORNEA EN VEZ DE PEDIRLO EN VIVO:
// los valores hex de un tono no cambian nunca — el B24 de Copic es el mismo
// color desde que existe. El stock cambia cada quince minutos. Entonces se
// separan: el color viaja con la app (se pinta al instante, cero requests, y
// CIEDE2000 corre sobre datos locales) y el stock se pide en vivo como una
// capa encima. Además la demo no depende de que la tienda esté arriba: si el
// endpoint se cae, la app sigue pintando los 1.632 tonos y lo dice.
//
// NO SE GUARDA `variant_id` NI STOCK. El variant_id es un identificador
// interno del inventario y no le sirve a nadie afuera; el stock es un dato
// vivo que congelado sería mentira.
//
// Uso:  node scripts/bake-cards.mjs
// El endpoint es público: este script no necesita ninguna credencial, y si
// algún día la necesitara, algo se diseñó mal.

import { writeFile, mkdir } from 'node:fs/promises';

const MCP = 'https://www.boykot.cl/api/mcp';

// Las cartas que se publican, con su medio físico. La clasificación NO es
// decorativa: es lo que permite que la app se niegue a proponer un marcador al
// alcohol para pintar una pared, o un spray nitro para un cuaderno. Una
// sustitución entre marcas que ignore el sustrato es una recomendación que
// arruina el trabajo de alguien.
const CARTAS = [
  // Copic — tinta al alcohol, transparente, se superpone. Papel.
  { id: 'copic-sketch', medium: 'alcohol-marker', opacity: 'transparent', substrates: ['paper', 'cardstock'] },
  { id: 'copic-ink', medium: 'alcohol-ink-refill', opacity: 'transparent', substrates: ['paper', 'cardstock'] },
  { id: 'copic-ciao', medium: 'alcohol-marker', opacity: 'transparent', substrates: ['paper', 'cardstock'] },
  { id: 'copic-classic', medium: 'alcohol-marker', opacity: 'transparent', substrates: ['paper', 'cardstock'] },
  { id: 'copic-wide', medium: 'alcohol-marker', opacity: 'transparent', substrates: ['paper', 'cardstock'] },

  // Molotow Premium — laca sintética en aerosol, opaca. Muro, metal, madera.
  { id: 'molotow-premium', medium: 'solvent-spray', opacity: 'opaque', substrates: ['wall', 'metal', 'wood', 'canvas'] },
  { id: 'molotow-premium-plus', medium: 'solvent-spray', opacity: 'opaque', substrates: ['wall', 'metal', 'wood', 'canvas'] },
  { id: 'molotow-premium-neon', medium: 'solvent-spray', opacity: 'opaque', substrates: ['wall', 'metal', 'wood', 'canvas'], note: 'fluorescent pigment' },

  // ONE4ALL — acrílico base agua, opaco, casi cualquier sustrato.
  { id: 'molotow-one4all-2mm', medium: 'acrylic-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'metal', 'glass', 'plastic'] },
  { id: 'molotow-one4all-4mm', medium: 'acrylic-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'metal', 'glass', 'plastic'] },
  { id: 'molotow-one4all-1.5mm', medium: 'acrylic-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'metal', 'glass', 'plastic'] },
  { id: 'molotow-one4all-acrylic-twin', medium: 'acrylic-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'metal', 'glass', 'plastic'] },

  // POSCA — pigmento base agua, opaco, mate.
  { id: 'uni-posca-3m', medium: 'water-based-paint-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'glass', 'plastic', 'fabric'] },
  { id: 'uni-posca-5m', medium: 'water-based-paint-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'glass', 'plastic', 'fabric'] },
  { id: 'uni-posca-8k', medium: 'water-based-paint-marker', opacity: 'opaque', substrates: ['paper', 'canvas', 'wood', 'glass', 'plastic', 'fabric'] },
  { id: 'uni-posca-17k', medium: 'water-based-paint-marker', opacity: 'opaque', substrates: ['wall', 'canvas', 'wood', 'metal'] },

  // Angelus — acrílico para cuero.
  { id: 'angelus-pearlescents-1oz', medium: 'leather-acrylic', opacity: 'opaque', substrates: ['leather', 'canvas'], note: 'pearlescent finish' },
];

async function tool(name, args) {
  const r = await fetch(MCP, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
  });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`${name}: ${j.error.message}`);
  return JSON.parse(j.result.content[0].text);
}

const HEX = /^#?[0-9a-f]{6}$/i;
const norm = (h) => (typeof h === 'string' && HEX.test(h.trim()) ? `#${h.trim().replace(/^#/, '').toLowerCase()}` : null);

const stamp = process.env.BAKE_DATE || new Date().toISOString().slice(0, 10);
await mkdir(new URL('../data/cards/', import.meta.url), { recursive: true });

const resumen = [];

for (const c of CARTAS) {
  const raw = await tool('get_color_card', { brand: c.id });
  if (!raw.colors) {
    console.error(`  ✗ ${c.id}: sin colores — se omite`);
    continue;
  }

  const tones = raw.colors.map((t) => ({
    code: String(t.code),
    name: t.name ?? null,
    hex: norm(t.hex),          // null si no hay dato: jamás un color inventado
    sku: t.sku ?? null,
  }));

  const conHex = tones.filter((t) => t.hex).length;

  const card = {
    card_id: c.id,
    brand: raw.brand_name ?? null,
    line: raw.product_name ?? null,
    medium: c.medium,
    opacity: c.opacity,
    substrates: c.substrates,
    ...(c.note ? { note: c.note } : {}),
    base_price_clp: raw.base_price_clp ?? null,
    url: raw.url ?? null,
    tones_total: tones.length,
    tones_with_hex: conHex,
    baked_at: stamp,
    tones,
  };

  await writeFile(new URL(`../data/cards/${c.id}.json`, import.meta.url), JSON.stringify(card, null, 1) + '\n');
  resumen.push({ id: c.id, total: tones.length, hex: conHex, medium: c.medium });
  console.log(`  ✓ ${c.id.padEnd(30)} ${String(tones.length).padStart(4)} tonos, ${conHex} con hex`);
  await new Promise((r) => setTimeout(r, 1200)); // amable con el endpoint
}

const totalTonos = resumen.reduce((s, r) => s + r.total, 0);
const totalHex = resumen.reduce((s, r) => s + r.hex, 0);

await writeFile(
  new URL('../data/PROVENANCE.md', import.meta.url),
  `# Where this color data comes from

Generated by \`scripts/bake-cards.mjs\` on **${stamp}** from the public MCP
endpoint of a real art supply store in Santiago, Chile
(\`${MCP}\`, tool \`get_color_card\`, no credentials required).

**${totalTonos} tones across ${resumen.length} color cards, ${totalHex} of them with a
verified hex value.**

Hex values are baked into the repository because they never change. Stock is
*not* baked — it is fetched live at runtime, because a frozen stock number
would be a lie. No internal inventory identifiers are stored here.

## Coverage, honestly

${resumen.map((r) => `- \`${r.id}\` — ${r.hex}/${r.total} tones with hex (${Math.round((100 * r.hex) / r.total)}%) · ${r.medium}`).join('\n')}

### Tones without a hex value

${totalTonos - totalHex} tones ship with \`hex: null\`. They are **never painted and never
recommended as a color match** — the interface draws them with a diagonal
hatch and the label \`unmapped\`, and the tools report them as unmapped rather
than guessing. A color the manufacturer never made is worse than no answer.

### Cards the store sells that are *not* here

The store's catalog has 62 color cards, but only 17 carry per-tone hex data.
The other 45 — including the whole Holbein watercolor range, Createx airbrush,
ZIG and most of the Angelus leather line — are sold with no color values
mapped, so they cannot be painted or matched, and are deliberately absent
rather than approximated.

**Copic ACREA** deserves a specific mention: the store sells it (6 SKUs, a
water-based *opaque* acrylic marker that behaves nothing like the alcohol
markers above), but it has no color card at all, so it is invisible to this
workbench. That is a gap in the source data, not a choice.

## Reproducing

\`\`\`bash
node scripts/bake-cards.mjs
\`\`\`

The endpoint is public and unauthenticated. If this script ever needs a
credential, something has been designed wrong.
`,
);

console.log(`\n${totalTonos} tonos, ${totalHex} con hex, en ${resumen.length} cartas → data/cards/`);
