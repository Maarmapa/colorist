// Cortafuegos de capacidades entre esta app y el MCP de la tienda.
//
// NO es un proxy de conveniencia. Es el único lugar del sistema donde se
// decide qué puede pedirle esta página al catálogo, y está del lado del
// servidor a propósito: una allowlist en el navegador es una sugerencia, y
// cualquiera con la consola abierta la saltea.
//
// POR QUÉ EXISTE, primero lo aburrido: el endpoint de la tienda hoy responde
// `access-control-allow-origin: *, *.boykot.cl` — dos valores en un header que
// admite exactamente uno, porque dos capas lo agregan y HTTP los une con coma.
// Ningún navegador acepta eso, así que desde otro origen no se puede leer.
// Verificado en Chrome real: TypeError: Failed to fetch. Al ser same-origin,
// acá no hay CORS que valga: el navegador nunca cruza un origen.
//
// Y ahora lo interesante: ya que hay un punto de control, se usa como tal.
//
//   · Solo pasan `tools/list` y `tools/call`. Nada de `initialize`, nada de
//     métodos que no necesitamos.
//   · Solo pasan las tools de LECTURA del catálogo. `create_checkout` y
//     `subscribe_back_in_stock` existen del otro lado y quedan bloqueadas
//     ACÁ, no por buena voluntad del cliente. Esta página no puede cobrarle a
//     nadie ni anotar el mail de nadie aunque su código se lo proponga, y
//     aunque un agente hostil llame directo al endpoint.
//   · No se reenvía el header `Authorization`. Las tools sensibles de la
//     tienda (ventas, pedidos, clientes) exigen credencial; al no existir un
//     camino para mandarla, esta app no puede alcanzarlas ni por accidente.
//   · No se loguea nada, no hay cookies, no se guarda una IP.
//
// Sin secretos: el endpoint de destino es público y no lleva credencial.
// Si algún día este archivo necesitara una variable de entorno, algo se
// diseñó mal y hay que parar.

const UPSTREAM = 'https://www.boykot.cl/api/mcp';

// Lectura del catálogo, y nada más. Agregar un nombre acá es una decisión
// deliberada, no un descuido.
const TOOLS_PERMITIDAS = new Set([
  'get_color_card',
  'search_products',
  'get_product',
  'list_brands',
  'get_promotions',
]);

const METODOS_PERMITIDOS = new Set(['tools/list', 'tools/call']);

const MAX_BODY = 8 * 1024;

function rechazo(res, status, code, message) {
  res.status(status).json({
    jsonrpc: '2.0',
    id: null,
    error: { code, message },
  });
}

export default async function handler(req, res) {
  // Same-origin: no hace falta CORS. Se declara explícitamente que no se
  // acepta desde otros orígenes, en vez de dejarlo al azar del host.
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return rechazo(res, 405, -32600, 'Only POST is accepted.');
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return rechazo(res, 400, -32700, 'Body must be a JSON-RPC object.');
  }
  if (JSON.stringify(body).length > MAX_BODY) {
    return rechazo(res, 413, -32600, 'Request too large.');
  }

  const { method, params } = body;

  if (!METODOS_PERMITIDOS.has(method)) {
    return rechazo(res, 403, -32601, `Method "${method}" is not available through this app.`);
  }

  if (method === 'tools/call') {
    const name = params?.name;
    if (!TOOLS_PERMITIDAS.has(name)) {
      // El mensaje dice qué SÍ se puede: un agente que recibe "no" a secas
      // reintenta a ciegas; uno que recibe la lista, se corrige.
      return rechazo(
        res,
        403,
        -32601,
        `Tool "${name}" is not exposed by this app. Available: ${[...TOOLS_PERMITIDAS].join(', ')}. ` +
          'Tools that write, charge, or read store operations are blocked at this boundary by design.',
      );
    }
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      // Sin Authorization a propósito: ver la nota de arriba.
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      return rechazo(res, 502, -32603, `The store catalog answered ${upstream.status}.`);
    }

    const datos = await upstream.json();

    // Se devuelve la respuesta del MCP tal cual: este archivo controla QUÉ se
    // puede pedir, no reescribe lo que la tienda contesta.
    return res.status(200).json(datos);
  } catch (e) {
    const causa = e?.name === 'TimeoutError' ? 'timed out' : 'is unreachable';
    // Un fallo acá no rompe la app: el cliente degrada al snapshot horneado y
    // lo muestra. Por eso el error viaja como respuesta y no como excepción.
    return rechazo(res, 504, -32603, `The store catalog ${causa}. The app falls back to its bundled snapshot.`);
  }
}
