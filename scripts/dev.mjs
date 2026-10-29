// Servidor local que imita a Vercel: archivos de public/ y funciones de api/.
// Uso: npm run dev  (lee .env)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const PUERTO = Number(process.env.PORT || 3000);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname.startsWith('/api/')) {
      const nombre = pathname.slice(5).replace(/[^a-z-]/g, '');
      const modulo = await import(pathToFileURL(join(raiz, 'api', `${nombre}.js`)).href);
      return await modulo.default(req, res);
    }
    const ruta = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
    const archivo = await readFile(join(raiz, 'public', ruta));
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' });
    res.end(archivo);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ERR_MODULE_NOT_FOUND') console.error(err);
    res.writeHead(404).end('No encontrado');
  }
}).listen(PUERTO, '0.0.0.0', () => console.log(`Pastillita en http://localhost:${PUERTO}`));
