// La mitad humana del banco de trabajo.
//
// El agente razona sobre color pero es literalmente ciego: nunca vio uno. Esta
// pantalla ve — pinta los 1.625 tonos con el valor real de la carta — pero no
// razona. El panel de herramientas de la derecha existe para que la persona
// vea, sin abrir DevTools, qué puede hacer el agente AHORA MISMO, y por qué
// una herramienta que estaba hace un segundo ya no está.

import { readableInk } from '../color/srgb-lab.ts';
import type { Carta } from '../data/cards.ts';
import type { Owned } from '../state/drawer.ts';

const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;

export interface EstadoUI {
  cartas: Carta[];
  objetivos: string[];
  cajon: readonly Owned[];
  destacar?: string[];
  tieneTono: (card: string, code: string) => boolean;
}

export function pintarTodo(e: EstadoUI): void {
  pintarObjetivos(e);
  pintarGrilla(e);
  const n = $('#kit-count');
  if (n) n.textContent = String(e.cajon.length);
}

function pintarObjetivos(e: EstadoUI) {
  const cont = $('#targets');
  if (!cont) return;
  if (e.objetivos.length === 0) {
    cont.innerHTML = '<p class="hint">No targets yet. Ask the agent for a palette, or use the demo button.</p>';
    return;
  }
  cont.innerHTML = e.objetivos
    .map(
      (hex) =>
        `<div class="target" style="background:${hex};color:${readableInk(hex)}" title="${hex}"><span>${hex}</span></div>`,
    )
    .join('');
}

function pintarGrilla(e: EstadoUI) {
  const cont = $('#grid');
  if (!cont) return;
  const destacados = new Set(e.destacar ?? []);
  const trozos: string[] = [];

  for (const c of e.cartas) {
    const conHex = c.tones.filter((t) => t.hex);
    const sinHex = c.tones.length - conHex.length;
    trozos.push(
      `<section class="card"><h3>${c.brand ?? ''} ${c.line ?? c.card_id}` +
        `<small>${conHex.length} tones${sinHex ? ` · ${sinHex} unmapped` : ''} · ${c.medium}</small></h3><div class="swatches" role="list">`,
    );
    for (const t of c.tones) {
      const clave = `${c.card_id}:${t.code}`;
      const mio = e.tieneTono(c.card_id, t.code);
      const marcado = destacados.has(clave);
      if (!t.hex) {
        // Un tono sin dato se dibuja con trama y se dice. Nunca un gris inventado.
        trozos.push(
          `<div class="sw unmapped" role="listitem" tabindex="-1" aria-label="${t.code}, colour value unmapped">${t.code}</div>`,
        );
        continue;
      }
      const cls = ['sw', mio ? 'owned' : '', marcado ? 'picked' : ''].filter(Boolean).join(' ');
      trozos.push(
        `<div class="${cls}" role="listitem" tabindex="-1" data-k="${clave}" ` +
          `style="background:${t.hex};color:${readableInk(t.hex)}" ` +
          `aria-label="${t.code}${t.name ? ' ' + t.name : ''}${mio ? ', in your kit' : ''}">${t.code}</div>`,
      );
    }
    trozos.push('</div></section>');
  }
  cont.innerHTML = trozos.join('');
}

/**
 * El panel que hace visible lo invisible.
 *
 * Casi nadie llama `getTools()`. Acá se usa para que la persona vea la
 * superficie real del agente, y sobre todo para que se VEA el momento en que
 * `prepare_order` desaparece — con el motivo escrito al lado.
 */
export function pintarPanelTools(vivas: string[], motivoSinCompra: string | null): void {
  const cont = $('#tools');
  if (!cont) return;
  if (vivas.length === 0) {
    cont.innerHTML = `<p class="hint">${motivoSinCompra ?? 'No agent connected.'}</p>`;
    return;
  }
  const filas = vivas.map((n) => `<li class="on"><code>${n}</code></li>`).join('');
  const apagada = motivoSinCompra
    ? `<li class="off"><code>prepare_order</code><em>${motivoSinCompra}</em></li>`
    : '';
  cont.innerHTML = `<ul class="toollist">${filas}${apagada}</ul>`;
}
