// Lo llama pg_cron (Supabase) a las 9:00 pm y a las 9:30 pm, hora de Colombia.
// Cada llamada hace lo que ya esté vencido y la tabla `avisos` evita correos repetidos,
// así que da igual si llega dos veces o si el respaldo de Vercel también la llama.
import crypto from 'node:crypto';
import { responder, ruta } from './_lib/http.js';
import { db, leerAjustes } from './_lib/db.js';
import { hoyColombia, segundosDelDia, horaBonita, HORA_TOMA, MINUTOS_ALERTA } from './_lib/hora.js';
import { recordarAElla, alertarAEl } from './_lib/correo.js';
import { notificar } from './_lib/push.js';
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

  const horaToma = hhmm(HORA_TOMA);
  const horaAlerta = hhmm(HORA_TOMA + MINUTOS_ALERTA);

  // Cada tarea manda por todos sus canales; cuenta como hecha si al menos uno llegó.
  const tareas = [
    {
      tipo: 'recordatorio',
      desde: HORA_TOMA,
      canales: [
        () => notificar({ titulo: 'Es hora de tu pastilla', cuerpo: 'Tómatela y regístrala con un toque.' }),
        process.env.CORREO_ELLA && (() => recordarAElla({ hora: horaToma }).then(() => 1)),
      ],
    },
    {
      tipo: 'alerta',
      desde: HORA_TOMA + MINUTOS_ALERTA,
      canales: [
        () => alertarAEl({ hora: horaAlerta }).then(() => 1),
        () => notificar({ titulo: 'Aún no registras tu pastilla', cuerpo: `Ya son las ${horaAlerta}. Tómatela y márcala en la app.` }),
      ],
    },
  ];

  const hecho = [];
  const fallos = [];
  for (const t of tareas) {
    if (ahora < t.desde * 60 - TOLERANCIA_S) continue;
    // Se reserva el aviso antes de enviar; si nada llega se libera para que el respaldo reintente.
    const [reservado] = await sql`
      insert into avisos (fecha, tipo) values (${hoy}, ${t.tipo})
      on conflict do nothing returning tipo`;
    if (!reservado) continue;

    const resultados = await Promise.allSettled(t.canales.filter(Boolean).map((c) => c()));
    for (const r of resultados) if (r.status === 'rejected') console.error(`Aviso ${t.tipo} falló`, r.reason);
    if (resultados.some((r) => r.status === 'fulfilled' && r.value > 0)) {
      hecho.push(t.tipo);
    } else {
      await sql`delete from avisos where fecha = ${hoy} and tipo = ${t.tipo}`;
      fallos.push(t.tipo);
    }
  }

  responder(res, fallos.length ? 502 : 200, { hoy, hecho, fallos });
});
