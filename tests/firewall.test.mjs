// El cortafuegos de capacidades es un control de seguridad, así que se testea
// como tal: lo que importa no es que deje pasar lo bueno, es que NO deje pasar
// lo demás — incluso si el cliente se lo pide de frente.
//
// El escenario que estos tests cubren: alguien abre la consola en la app
// publicada, o un agente hostil apunta directo al endpoint, y trata de usar
// esta página como puente para cobrarle a alguien o para leer la operación de
// la tienda. Una allowlist en el navegador no lo detiene. Esta sí.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/catalog.js';

/** Mock mínimo de la respuesta de Vercel. */
function mockRes() {
  const r = { statusCode: null, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const llamar = async (body, method = 'POST') => {
  const res = mockRes();
  await handler({ method, body }, res);
  return res;
};

test('bloquea create_checkout aunque se lo pidan de frente', async () => {
  // La tool existe del otro lado y crea pre-pedidos. Esta app no puede
  // alcanzarla ni cambiando el código del navegador.
  const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_checkout', arguments: {} } });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error.message, /not exposed/i);
});

test('bloquea la captura de correos', async () => {
  const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'subscribe_back_in_stock', arguments: { email: 'x@y.cl' } } });
  assert.equal(res.statusCode, 403);
});

test('bloquea las tools sensibles de operación de la tienda', async () => {
  for (const t of ['get_recent_orders', 'get_sales_summary', 'get_stock_bulk', 'get_order_status', 'get_top_products']) {
    const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: t, arguments: {} } });
    assert.equal(res.statusCode, 403, `${t} debería estar bloqueada`);
  }
});

test('el rechazo le dice al agente qué SÍ puede usar', async () => {
  // Un "no" a secas hace que el agente reintente a ciegas. La lista lo corrige.
  const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_sales_summary', arguments: {} } });
  assert.match(res.body.error.message, /get_color_card/);
  assert.match(res.body.error.message, /search_products/);
});

test('solo pasan tools/list y tools/call', async () => {
  for (const m of ['initialize', 'resources/read', 'prompts/get', 'notifications/initialized', 'ping']) {
    const res = await llamar({ jsonrpc: '2.0', id: 1, method: m });
    assert.equal(res.statusCode, 403, `método ${m} debería estar bloqueado`);
  }
});

test('rechaza todo lo que no sea POST', async () => {
  for (const m of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
    const res = await llamar({}, m);
    assert.equal(res.statusCode, 405, `${m} debería rebotar`);
  }
});

test('rechaza un body que no es objeto', async () => {
  for (const b of [null, undefined, 'texto', 42]) {
    const res = await llamar(b);
    assert.equal(res.statusCode, 400);
  }
});

test('rechaza un body gigante antes de reenviarlo', async () => {
  const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_products', arguments: { query: 'x'.repeat(9000) } } });
  assert.equal(res.statusCode, 413);
});

test('la allowlist es de LECTURA de catálogo y nada más', async () => {
  // Este test existe para que agregar una tool al cortafuegos sea una decisión
  // consciente: si alguien suma una que escribe, el test lo frena acá.
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../api/catalog.js', import.meta.url), 'utf8'),
  );
  const bloque = src.slice(src.indexOf('TOOLS_PERMITIDAS'), src.indexOf('METODOS_PERMITIDOS'));
  for (const prohibida of ['checkout', 'subscribe', 'order', 'sales', 'customer', 'stock_bulk']) {
    assert.ok(!bloque.includes(prohibida), `"${prohibida}" no puede estar en la allowlist`);
  }
});

test('no reenvía el header Authorization', async () => {
  // Las tools sensibles de la tienda exigen credencial. Al no existir camino
  // para mandarla, esta app no las puede alcanzar ni por accidente.
  //
  // Se miran los comentarios aparte: la nota que explica por qué no se manda
  // Authorization nombra a Authorization, y un grep ingenuo se caza a sí mismo.
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../api/catalog.js', import.meta.url), 'utf8'),
  );
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const fetchCall = codigo.slice(codigo.indexOf('const upstream = await fetch'), codigo.indexOf('if (!upstream.ok)'));
  assert.ok(fetchCall.length > 0, 'no se encontró la llamada al upstream');
  assert.ok(!/authorization/i.test(fetchCall), 'el fetch al upstream no debe llevar Authorization');
});

test('no hay secretos ni variables de entorno en el cortafuegos', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../api/catalog.js', import.meta.url), 'utf8'),
  );
  assert.ok(!src.includes('process.env'), 'este archivo no puede depender de una env var');
});
