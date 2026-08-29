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
    await Promise.all(
      tools.map((t) =>
        this.mc.registerTool(t, { signal: control.signal }).catch((e) => {
          // Un registro que falla —nombre duplicado, permiso denegado por
          // Permissions-Policy— no puede tumbar la página. Se pierde esa tool.
          console.warn(`[colorist] no se pudo registrar "${t.name}":`, e);
        }),
      ),
    );
  }

  /** Apaga el grupo entero. Las tools desaparecen del contexto del agente. */
  apagar(): void {
    this.control?.abort();
    this.control = null;
  }
}

/** Los nombres de las tools vivas ahora, para pintarlas en pantalla. */
export async function toolsVivas(mc: Superficie): Promise<string[]> {
  try {
    const t = await mc.getTools?.();
    return Array.isArray(t) ? t.map((x) => x.name) : [];
  } catch {
    return [];
  }
}
