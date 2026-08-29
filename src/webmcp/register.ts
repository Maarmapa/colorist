// Cómo se le entregan las herramientas al agente que está en esta pestaña.
//
// La superficie canónica es `document.modelContext`. El getter vivía en
// Navigator hasta el PR 184 del spec y Chrome 152 eliminó el alias, así que
// `navigator.modelContext` solo se acepta como reserva para implementaciones
// viejas — nunca como preferencia.
//
// Lo NATIVO manda siempre. El polyfill se carga únicamente si el navegador no
// trae la API, y nunca pisa una implementación existente: en el navegador
// integrado de ChatGPT, que trae WebMCP de fábrica, esta app no baja un byte
// extra.

export interface ToolDef {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (args: never, options?: { signal?: AbortSignal }) => Promise<unknown>;
}

interface Superficie {
  registerTool: (t: ToolDef, o?: { signal?: AbortSignal }) => Promise<unknown>;
  getTools?: () => Promise<ToolDef[]> | ToolDef[];
}

export function superficie(): Superficie | null {
  if (typeof document === 'undefined') return null;
  const d = document as Document & { modelContext?: Partial<Superficie> };
  const n = navigator as Navigator & { modelContext?: Partial<Superficie> };
  const mc = d.modelContext ?? n.modelContext;
  return typeof mc?.registerTool === 'function' ? (mc as Superficie) : null;
}

/** Carga el polyfill solo si de verdad no hay API. */
export async function asegurarSuperficie(): Promise<Superficie | null> {
  const nativa = superficie();
  if (nativa) return nativa;

  await new Promise<void>((resolver) => {
    const s = document.createElement('script');
    s.src = '/webmcp-polyfill.js';
    s.onload = () => resolver();
    s.onerror = () => resolver(); // sin polyfill la app funciona igual, sin agente
    document.head.appendChild(s);
  });

  return superficie();
}

/**
 * Un grupo de tools que se puede apagar entero.
 *
 * El `{signal}` de `registerTool` es lo que permite que una herramienta
 * DESAPAREZCA: no hay que desregistrar una por una, se aborta el controlador y
 * el navegador las saca del contexto del agente. Eso es lo que hace posible
 * que la superficie de tools sea una consecuencia del estado de la página y no
 * una lista fija decidida al cargar.
 */
export class GrupoDeTools {
  private control: AbortController | null = null;
  private readonly mc: Superficie;
  readonly nombre: string;

  constructor(mc: Superficie, nombre: string) {
    this.mc = mc;
    this.nombre = nombre;
  }

  get activo(): boolean {
    return this.control !== null;
  }

  /** Registra el grupo. Si ya estaba activo, no hace nada. */
  async encender(tools: ToolDef[]): Promise<void> {
    if (this.control) return;
    const control = new AbortController();
    this.control = control;
    // Con reloj, por lo mismo que `conReloj`: un registro que no contesta no
    // puede dejar colgado al que lo llamó. La tool igual queda registrada si
    // el polyfill termina después.
    await conReloj(
      Promise.all(
        tools.map((t) =>
          this.mc.registerTool(t, { signal: control.signal }).catch((e) => {
            console.warn(`[colorist] no se pudo registrar "${t.name}":`, e);
          }),
        ),
      ),
      1500,
      undefined as unknown as void[],
    );
  }

  /** Apaga el grupo entero. Las tools desaparecen del contexto del agente. */
  apagar(): void {
    this.control?.abort();
    this.control = null;
  }
}

/**
 * Espera una promesa AJENA con un reloj al lado.
 *
 * Esta función existe por haber tropezado tres veces con la misma piedra en
 * producción: `registerTool` y `getTools` del polyfill a veces no resuelven
 * nunca. Ni rechazan —eso lo agarra un try/catch— simplemente no terminan, y
 * un `await` sobre eso deja la página muda para siempre. La app quedaba con
 * las tools registradas, el catálogo respondiendo y los swatches pintados,
 * mientras el panel decía "Loading…" indefinidamente.
 *
 * La regla, ya aprendida caro: **nunca esperes sin reloj una promesa que no
 * escribiste vos.** Un try/catch te protege de que falle; no de que no
 * conteste.
 */
export function conReloj<T>(promesa: Promise<T>, ms: number, siNoContesta: T): Promise<T> {
  return Promise.race([
    promesa.catch(() => siNoContesta),
    new Promise<T>((r) => setTimeout(() => r(siNoContesta), ms)),
  ]);
}

/**
 * Los nombres de las tools vivas ahora, para pintarlas en pantalla.
 *
 * Se le pregunta al navegador en vez de llevar una lista propia: el punto del
 * panel es mostrar la superficie REAL que ve el agente, y una lista paralela
 * mentiría justo cuando más importa — en el momento en que una tool aparece o
 * desaparece.
 */
export async function toolsVivas(mc: Superficie): Promise<string[]> {
  const t = await conReloj(Promise.resolve(mc.getTools?.()), 1200, undefined);
  return Array.isArray(t) ? t.map((x) => x.name) : [];
}
