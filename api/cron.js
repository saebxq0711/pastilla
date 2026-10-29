// Lo llama pg_cron (Supabase) a las 9:00 pm y a las 9:30 pm, hora de Colombia.
// Cada llamada hace lo que ya esté vencido y la tabla `avisos` evita mensajes repetidos,
// así que da igual si llega dos veces o si el respaldo de Vercel también la llama.
import crypto from 'node:crypto';
import { responder, ruta } from './_lib/http.js';
import { db, leerAjustes } from './_lib/db.js';
import { hoyColombia, segundosDelDia, horaBonita, HORA_TOMA, MINUTOS_ALERTA } from './_lib/hora.js';
import { enviarWhatsApp, mensajesRecordatorio, mensajesAlerta } from './_lib/whatsapp.js';
import { esDescanso } from '../public/ciclo.js';

const TOLERANCIA_S = 60; // por si el reloj del cron se adelanta unos segundos

function autorizado(req) {
  const esperado = `Bearer ${process.env.CRON_SECRET}`;
  const recibido = req.headers.authorization || '';
  return Boolean(process.env.CRON_SECRET)
    && recibido.length === esperado.length
    && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}

function hhmm(minutos) {
  return horaBonita(`${Math.floor(minutos / 60)}:${minutos % 60}`);
}

export default ruta(['GET', 'POST'], async (req, res) => {
  if (!autorizado(req)) return responder(res, 401, { error: 'No autorizado' });

  const sql = db();
  const hoy = hoyColombia();
  const ahora = segundosDelDia();
  const ajustes = await leerAjustes();

  if (esDescanso(hoy, ajustes)) return responder(res, 200, { hoy, hecho: 'día de descanso' });

  const [toma] = await sql`select 1 from tomas where fecha = ${hoy}`;
  if (toma) return responder(res, 200, { hoy, hecho: 'ya se la tomó' });

  const tareas = [
    { tipo: 'recordatorio', desde: HORA_TOMA, mensajes: () => mensajesRecordatorio(hhmm(HORA_TOMA)) },
    { tipo: 'alerta', desde: HORA_TOMA + MINUTOS_ALERTA, mensajes: () => mensajesAlerta(hhmm(HORA_TOMA + MINUTOS_ALERTA)) },
  ];

  const hecho = [];
  const fallos = [];
  for (const t of tareas) {
    if (ahora < t.desde * 60 - TOLERANCIA_S) continue;
    // Se reserva el aviso antes de enviar; si no sale se libera para que el respaldo reintente.
    const [reservado] = await sql`
      insert into avisos (fecha, tipo) values (${hoy}, ${t.tipo})
      on conflict do nothing returning tipo`;
    if (!reservado) continue;

    try {
      if (!(await enviarWhatsApp(t.mensajes()))) throw new Error('Ningún mensaje salió');
      hecho.push(t.tipo);
    } catch (err) {
      console.error(`Aviso ${t.tipo} falló`, err);
      await sql`delete from avisos where fecha = ${hoy} and tipo = ${t.tipo}`;
      fallos.push(t.tipo);
    }
  }

  responder(res, fallos.length ? 502 : 200, { hoy, hecho, fallos });
});
