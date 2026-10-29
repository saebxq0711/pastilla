import { responder, leerJson, ruta } from './_lib/http.js';
import { haySesion } from './_lib/sesion.js';
import { db } from './_lib/db.js';
import { estado } from './_lib/estado.js';

export default ruta(['POST'], async (req, res) => {
  if (!haySesion(req)) return responder(res, 401, { error: 'Sin sesión' });

  const { blister, inicioBlister } = await leerJson(req);
  if (!['28', '21'].includes(blister)) return responder(res, 400, { error: 'Tipo de blister inválido' });
  if (inicioBlister !== null && !/^\d{4}-\d{2}-\d{2}$/.test(inicioBlister ?? '')) {
    return responder(res, 400, { error: 'Fecha inválida' });
  }

  await db()`update ajustes set blister = ${blister}, inicio_blister = ${inicioBlister} where id = 1`;
  responder(res, 200, await estado());
});
