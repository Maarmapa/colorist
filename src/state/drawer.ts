// El cajón: qué marcadores ya tenés.
//
// ESTE ARCHIVO ES LA RAZÓN POR LA QUE EL PROYECTO NECESITA WebMCP.
//
// Todo lo demás —el catálogo, los precios, el stock— vive en un servidor y
// cualquier cliente MCP remoto lo puede pedir. Esto no. Lo que hay en tu cajón
// es tuyo, vive en tu navegador, no tiene cuenta ni login, y nunca sale de
// esta pestaña. Un servidor no puede consultarlo porque no sabe que existe.
//
// Y de ahí sale la consecuencia interesante: si el cálculo local dice que no
// te falta nada, la herramienta de comprar **deja de existir** para el agente.
// No devuelve un error ni un "no deberías": desaparece de `getTools()`. Un MCP
// remoto puede contestar mal desde una tool de carro; no puede no tenerla.
//
// Se guarda en localStorage y no se sube a ningún lado. No hay endpoint que
// reciba esto, ni siquiera uno propio — se puede verificar en el panel de red:
// cargar el cajón no genera un solo request.

const CLAVE = 'colorist.drawer.v1';

export interface Owned {
  /** card_id de la carta, ej "copic-sketch" */
  card: string;
  /** código del tono, ej "E00" */
  code: string;
  /** cuánto queda, si la persona lo declaró. null = lo tiene, sin detalle. */
  level?: 'full' | 'low' | null;
}

type Escucha = (d: Owned[]) => void;

const escuchas = new Set<Escucha>();
let cajon: Owned[] = cargar();

function cargar(): Owned[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const d = JSON.parse(crudo);
    if (!Array.isArray(d)) return [];
    // Se valida la forma: un localStorage editado a mano no puede tumbar la app.
    return d.filter((x) => x && typeof x.card === 'string' && typeof x.code === 'string');
  } catch {
    return [];
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cajon));
  } catch {
    // Modo incógnito con almacenamiento bloqueado: la sesión sigue funcionando
    // en memoria. Perder el cajón al recargar es mejor que romperse.
  }
  for (const f of escuchas) f(cajon);
}

export function getDrawer(): readonly Owned[] {
  return cajon;
}

export function drawerSize(): number {
  return cajon.length;
}

export function has(card: string, code: string): boolean {
  return cajon.some((o) => o.card === card && o.code === code.toUpperCase());
}

export function addMany(items: Owned[]): number {
  let sumados = 0;
  for (const it of items) {
    const code = it.code.toUpperCase();
    if (has(it.card, code)) continue;
    cajon.push({ card: it.card, code, level: it.level ?? null });
    sumados++;
  }
  if (sumados) guardar();
  return sumados;
}

export function removeMany(items: { card: string; code: string }[]): number {
  const antes = cajon.length;
  const fuera = new Set(items.map((i) => `${i.card}::${i.code.toUpperCase()}`));
  cajon = cajon.filter((o) => !fuera.has(`${o.card}::${o.code}`));
  if (cajon.length !== antes) guardar();
  return antes - cajon.length;
}

export function clearDrawer(): void {
  cajon = [];
  guardar();
}

export function onDrawerChange(f: Escucha): () => void {
  escuchas.add(f);
  return () => escuchas.delete(f);
}
