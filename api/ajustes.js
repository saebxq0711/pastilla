// Bellaface: siempre 21 pastillas + 7 de descanso. Solo se guarda el día 1 del blister;
// la app lo calcula a partir de "hoy me toca la pastilla N" o "mi última (la 21) fue el día X".
import { responder, leerJson, ruta } from './_lib/http.js';
import { haySesion } from './_lib/sesion.js';
import { db } from './_lib/db.js';
import { estado } from './_lib/estado.js';
import { hoyColombia } from './_lib/hora.js';
import { diffDias } from '../public/ciclo.js';

export default ruta(['POST'], async (req, res) => {
  if (!haySesion(req)) return responder(res, 401, { error: 'Sin sesión' });

  const { inicioBlister } = await leerJson(req);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioBlister ?? '')) return responder(res, 400, { error: 'Fecha inválida' });
  if (diffDias(inicioBlister, hoyColombia()) > 0) return responder(res, 400, { error: 'El blister no puede empezar en el futuro' });

  await db()`update ajustes set blister = '21', inicio_blister = ${inicioBlister} where id = 1`;
  responder(res, 200, await estado());
});
