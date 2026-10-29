// Marca o desmarca un día. Hoy le avisa a él por WhatsApp; los días pasados solo corrigen el calendario.
import { waitUntil } from '@vercel/functions';
import { responder, leerJson, ruta } from './_lib/http.js';
import { haySesion } from './_lib/sesion.js';
import { db } from './_lib/db.js';
import { hoyColombia, segundosDelDia, horaBonita, HORA_TOMA, MINUTOS_ALERTA } from './_lib/hora.js';
import { estado, rachaDe } from './_lib/estado.js';
import { enviarWhatsApp, mensajeTomada, mensajeDeshecha } from './_lib/whatsapp.js';
import { diffDias } from '../public/ciclo.js';

const DIAS_ATRAS = 62;

export default ruta(['POST'], async (req, res) => {
  if (!haySesion(req)) return responder(res, 401, { error: 'Sin sesión' });

  const { fecha, tomada } = await leerJson(req);
  const hoy = hoyColombia();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') || typeof tomada !== 'boolean') {
    return responder(res, 400, { error: 'Datos inválidos' });
  }
  const atras = diffDias(hoy, fecha);
  if (atras < 0) return responder(res, 400, { error: 'Ese día todavía no llega' });
  if (atras > DIAS_ATRAS) return responder(res, 400, { error: 'Solo se pueden corregir los últimos dos meses' });

  const sql = db();
  const esHoy = atras === 0;
  let cambio;

  if (tomada) {
    // En días pasados la hora real no se conoce: se guarda como registro tardío.
    cambio = await sql`
      insert into tomas (fecha, registrada_tarde)
      values (${fecha}, ${!esHoy})
      on conflict (fecha) do nothing
      returning fecha`;
    // Si marca un día anterior al primer registro, el calendario arranca desde ahí.
    await sql`update ajustes set inicio_registro = least(inicio_registro, ${fecha}::date) where id = 1`;
  } else {
    cambio = await sql`delete from tomas where fecha = ${fecha} returning fecha`;
  }

  const datos = await estado();
  responder(res, 200, datos);

  // El WhatsApp sale después de responder, para que el registro en la app sea instantáneo.
  if (esHoy && cambio.length > 0) {
    let mensajes;
    if (tomada) {
      const s = segundosDelDia();
      const hora = horaBonita(`${Math.floor(s / 3600)}:${Math.floor((s % 3600) / 60)}`);
      const tarde = s >= (HORA_TOMA + MINUTOS_ALERTA) * 60;
      mensajes = mensajeTomada({ hora, racha: rachaDe(datos), tarde });
    } else {
      mensajes = mensajeDeshecha();
    }
    waitUntil(enviarWhatsApp(mensajes).catch((err) => console.error('No se pudo avisar por WhatsApp', err)));
  }
});
