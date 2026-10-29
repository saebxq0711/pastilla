// Notificaciones push al iPhone de ella (iOS 16.4+ con la app agregada a inicio).
import webpush from 'web-push';
import { db } from './db.js';

let configurado = false;

export function hayPush() {
  if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) return false;
  if (!configurado) {
    webpush.setVapidDetails('mailto:avisos@pastillita.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
    configurado = true;
  }
  return true;
}

/** Envía a todos los dispositivos suscritos. Devuelve cuántos la recibieron. */
export async function notificar({ titulo, cuerpo }) {
  if (!hayPush()) return 0;
  const sql = db();
  const subs = await sql`select endpoint, suscripcion from push_suscripciones`;
  const carga = JSON.stringify({ titulo, cuerpo, url: '/' });
  let enviados = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.suscripcion, carga, { TTL: 3600, urgency: 'high' });
      enviados++;
    } catch (err) {
      // 404/410: el dispositivo ya no existe (app borrada, permiso quitado).
      if (err.statusCode === 404 || err.statusCode === 410) {
        await sql`delete from push_suscripciones where endpoint = ${s.endpoint}`;
      } else {
        console.error('Push falló', err.statusCode, err.body);
      }
    }
  }));
  return enviados;
}
