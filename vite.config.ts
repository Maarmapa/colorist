import { defineConfig, type Connect } from 'vite';
import handler from './api/catalog.js';

// El cortafuegos de capacidades corre en producción como función serverless.
// En desarrollo se monta EL MISMO archivo como middleware, en vez de un proxy
// distinto: si dev y producción no comparten el código, el control de
// seguridad que se prueba no es el que se despliega.
function cortafuegosEnDev(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/api/catalog')) return next();
    const trozos: Buffer[] = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', async () => {
      let body: unknown = null;
      try { body = JSON.parse(Buffer.concat(trozos).toString() || 'null'); } catch { body = null; }
      const fake = {
        statusCode: 200,
        setHeader: (k: string, v: string) => res.setHeader(k, v),
        status(c: number) { this.statusCode = c; return this; },
        json(b: unknown) {
          res.statusCode = this.statusCode;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(b));
          return this;
        },
      };
      await (handler as (q: unknown, s: unknown) => Promise<void>)({ method: req.method, body }, fake);
    });
  };
}

export default defineConfig({
  build: { target: 'es2022', outDir: 'dist' },
  server: { port: 5180 },
  plugins: [{
    name: 'cortafuegos-dev',
    configureServer(server) { server.middlewares.use(cortafuegosEnDev()); },
  }],
});
