// La tool que no contesta hasta que un humano mira.
//
// Es la capacidad que ningún servidor puede ni empezar a imitar. Un backend
// puede calcular, puede devolver el candidato con menor ΔE, puede explicarlo.
// Lo que no puede hacer es **poner dos rectángulos en la pantalla de alguien y
// quedarse esperando un dedo**. Eso solo existe cuando el sitio le entrega
// herramientas al agente que ya está adentro de la pestaña.
//
// Y no es un adorno: resuelve un problema real. Cuando dos sustitutos quedan
// separados por menos de lo que el ojo distingue con confianza, el número ya
// no decide. CIEDE2000 dice "1,4 contra 1,6" y eso, en la práctica, es un
// empate — pero uno de los dos puede verse mejor sobre el papel que esa
// persona usa, o combinar mejor con lo que ya tiene alrededor. El modelo es
// ciego y no puede juzgarlo. La página muestra; el humano decide; la respuesta
// vuelve al agente. Cada uno pone el órgano que al otro le falta.
//
// El AbortSignal acá hace trabajo de verdad —no está de decoración—: si el
// agente cancela la llamada, o pasa el tiempo, o la persona cierra el panel,
// la promesa se resuelve con un motivo que el agente puede leer. Nunca queda
// colgada, y nunca hace throw: el spec descarta la razón de un rechazo.

import { readableInk } from '../color/srgb-lab.ts';

export interface Candidato {
  card: string;
  code: string;
  name: string | null;
  hex: string;
  deltaE: number;
}

export type Eleccion =
  | { picked: Candidato; index: number }
  | { picked: null; reason: 'timeout' | 'dismissed' | 'cancelled' };

const TOPE_MS = 90_000;

let cerrarActual: (() => void) | null = null;

/**
 * Muestra los candidatos a pantalla completa y espera una elección humana.
 *
 * Solo puede haber un panel abierto: si el agente pregunta dos veces, la
 * primera se cierra con `dismissed` en vez de apilar dos paneles que compiten
 * por el mismo clic.
 */
export function preguntarAlOjo(
  candidatos: Candidato[],
  pregunta: string,
  signal?: AbortSignal,
): Promise<Eleccion> {
  cerrarActual?.();

  return new Promise<Eleccion>((resolver) => {
    let listo = false;
    const terminar = (r: Eleccion) => {
      if (listo) return;
      listo = true;
      limpiar();
      resolver(r);
    };

    const capa = document.createElement('div');
    capa.className = 'eye';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', pregunta);

    capa.innerHTML = `
      <div class="eye-box">
        <p class="eye-q">${escapar(pregunta)}</p>
        <div class="eye-opts">
          ${candidatos
            .map(
              (c, i) => `
            <button class="eye-opt" data-i="${i}" style="background:${c.hex};color:${readableInk(c.hex)}"
                    aria-label="${escapar(c.code + (c.name ? ' ' + c.name : ''))}, delta E ${c.deltaE}">
              <span class="eye-code">${escapar(c.code)}</span>
              <span class="eye-name">${escapar(c.name ?? '')}</span>
              <span class="eye-de">ΔE ${c.deltaE}</span>
            </button>`,
            )
            .join('')}
        </div>
        <p class="eye-foot">
          The numbers say these are a tie. Your eye decides — the agent cannot see colour.
          <button class="eye-skip">Neither / cancel</button>
        </p>
      </div>`;

    document.body.appendChild(capa);
    (capa.querySelector('.eye-opt') as HTMLElement | null)?.focus();

    const alClic = (e: Event) => {
      const b = (e.target as HTMLElement).closest('.eye-opt') as HTMLElement | null;
      if (b) {
        const i = Number(b.dataset.i);
        const picked = candidatos[i];
        if (picked) return terminar({ picked, index: i });
      }
      if ((e.target as HTMLElement).closest('.eye-skip')) {
        terminar({ picked: null, reason: 'dismissed' });
      }
    };
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') terminar({ picked: null, reason: 'dismissed' });
    };
    const alAbortar = () => terminar({ picked: null, reason: 'cancelled' });

    capa.addEventListener('click', alClic);
    document.addEventListener('keydown', alTeclado);
    signal?.addEventListener('abort', alAbortar);

    const reloj = setTimeout(() => terminar({ picked: null, reason: 'timeout' }), TOPE_MS);

    function limpiar() {
      clearTimeout(reloj);
      capa.removeEventListener('click', alClic);
      document.removeEventListener('keydown', alTeclado);
      signal?.removeEventListener('abort', alAbortar);
      capa.remove();
      cerrarActual = null;
    }

    cerrarActual = () => terminar({ picked: null, reason: 'dismissed' });

    // Si el agente ya había cancelado antes de que se pintara nada.
    if (signal?.aborted) alAbortar();
  });
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
