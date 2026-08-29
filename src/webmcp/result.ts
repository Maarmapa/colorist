// El contrato de respuesta de las tools, y la razón por la que ninguna hace throw.
//
// EL DETALLE DEL SPEC QUE DECIDE ESTO: cuando el `execute` de una tool rechaza
// su promesa, la especificación descarta el motivo — el agente recibe un error
// pelado, sin la razón. O sea que un `throw new Error("ese tono no existe")`
// le llega al modelo como "algo falló", y el modelo hace lo único que puede
// hacer sin información: reintentar igual, o inventar una explicación.
//
// Así que acá **un fallo es un valor devuelto, no una excepción**. La tool
// resuelve con `{ok:false, error, message, hint}` y el agente lee exactamente
// qué pasó y qué hacer distinto. `hint` no es cortesía: es la diferencia entre
// un agente que se corrige solo y uno que insiste.
//
// Y como el spec serializa a JSON lo que se devuelva, estos objetos llegan tal
// cual. No hay envoltorio de MCP acá: eso es el formato del transporte, no el
// de la página.

export interface Ok<T> {
  ok: true;
  data?: T;
}

export interface Fail {
  ok: false;
  error: string;
  message: string;
  hint?: string;
}

export type Resultado<T = unknown> = (Ok<T> & T) | Fail;

/** Éxito: los campos del payload viajan al ras, con `ok:true` al lado. */
export function ok<T extends object>(data: T): Ok<T> & T {
  return { ok: true, ...data };
}

/**
 * Fallo explicado.
 *
 * @param error   slug estable, para que el agente pueda ramificar sin parsear prosa
 * @param message qué pasó, en una frase que se le puede repetir a la persona
 * @param hint    qué hacer distinto. Sin esto, el agente reintenta a ciegas.
 */
export function fail(error: string, message: string, hint?: string): Fail {
  return { ok: false, error, message, ...(hint ? { hint } : {}) };
}

/**
 * Envuelve el `execute` de una tool para que NINGUNA excepción escape.
 *
 * Cubre lo que no se previó: un bug, un dato con una forma inesperada, un
 * `undefined` donde iba un objeto. Sin esto, el primer caso raro convierte la
 * herramienta en un error mudo para el agente.
 *
 * El AbortSignal se distingue del resto a propósito: una llamada cancelada no
 * es una falla del sistema y no hay que sugerirle al agente que reintente.
 */
export function safeExecute<A extends object, R>(
  nombre: string,
  fn: (args: A, options?: { signal?: AbortSignal }) => Promise<R> | R,
): (args: A, options?: { signal?: AbortSignal }) => Promise<R | Fail> {
  return async (args, options) => {
    try {
      return await fn(args ?? ({} as A), options);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return fail('cancelled', 'The call was cancelled before it finished.');
      }
      const causa = e instanceof Error ? e.message : String(e);
      // Se registra en consola para poder depurarlo, y se devuelve algo que el
      // agente pueda entender.
      console.error(`[colorist] tool "${nombre}" threw:`, e);
      return fail(
        'internal',
        `The "${nombre}" tool hit an unexpected problem: ${causa}`,
        'This is a bug in the page, not in your request. Try a different tool or tell the person what you were attempting.',
      );
    }
  };
}

/**
 * Recorta un texto largo antes de que llegue al contexto del modelo.
 *
 * Una tool que devuelve 40 KB de catálogo se come la ventana del agente y hace
 * que la conversación pierda lo que importaba. Cortar es mejor que inundar —
 * pero el corte se DECLARA, porque un agente que no sabe que hay más asume que
 * lo que ve es todo y le responde eso a la persona.
 */
export function recortar<T>(items: T[], tope: number): { items: T[]; truncated: null | { shown: number; total: number; note: string } } {
  if (items.length <= tope) return { items, truncated: null };
  return {
    items: items.slice(0, tope),
    truncated: {
      shown: tope,
      total: items.length,
      note: `Showing the ${tope} best of ${items.length} matches. Narrow the query to see different ones.`,
    },
  };
}
