// GET: clave pública para suscribirse. POST: guarda la suscripción de este dispositivo.
import { responder, leerJson, ruta } from './_lib/http.js';
import { haySesion } from './_lib/sesion.js';
import { db } from './_lib/db.js';

export default ruta(['GET', 'POST'], async (req, res) => {
  if (!haySesion(req)) return responder(res, 401, { error: 'Sin sesión' });
  if (!process.env.VAPID_PUBLIC) return responder(res, 503, { error: 'Notificaciones no configuradas' });

  if (req.method === 'GET') return responder(res, 200, { clave: process.env.VAPID_PUBLIC });

  const { suscripcion } = await leerJson(req);
  if (!suscripcion?.endpoint?.startsWith('https://') || !suscripcion.keys?.p256dh || !suscripcion.keys?.auth) {
    return responder(res, 400, { error: 'Suscripción inválida' });
  }
  await db()`
    insert into push_suscripciones (endpoint, suscripcion) values (${suscripcion.endpoint}, ${db().json(suscripcion)})
    on conflict (endpoint) do update set suscripcion = excluded.suscripcion`;
  responder(res, 200, { ok: true });
});
