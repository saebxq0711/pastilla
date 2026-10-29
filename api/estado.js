import { responder, ruta } from './_lib/http.js';
import { haySesion } from './_lib/sesion.js';
import { estado } from './_lib/estado.js';

export default ruta(['GET'], async (req, res) => {
  if (!haySesion(req)) return responder(res, 401, { error: 'Sin sesión' });
  responder(res, 200, await estado());
});
