import { responder, leerJson, ruta } from './_lib/http.js';
import { pinCorrecto, cookieDeSesion } from './_lib/sesion.js';

export default ruta(['POST'], async (req, res) => {
  const { pin } = await leerJson(req);
  if (!pinCorrecto(String(pin ?? ''))) {
    await new Promise((r) => setTimeout(r, 800)); // frena los intentos a ciegas
    return responder(res, 401, { error: 'PIN incorrecto' });
  }
  res.setHeader('Set-Cookie', cookieDeSesion());
  responder(res, 200, { ok: true });
});
