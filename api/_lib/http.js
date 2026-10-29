export function responder(res, status, datos) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}

export async function leerJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let texto = '';
  for await (const parte of req) texto += parte;
  return texto ? JSON.parse(texto) : {};
}

/** Envuelve un handler: método permitido y errores como JSON. */
export function ruta(metodos, handler) {
  return async (req, res) => {
    if (!metodos.includes(req.method)) return responder(res, 405, { error: 'Método no permitido' });
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      responder(res, 500, { error: 'Algo salió mal, intenta de nuevo' });
    }
  };
}
