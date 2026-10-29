import { leerAjustes, leerTomas } from './db.js';
import { hoyColombia, segundosDelDia, HORA_TOMA, MINUTOS_ALERTA } from './hora.js';
import { racha } from '../../public/ciclo.js';

/** Todo lo que la pantalla necesita, en una sola respuesta. */
export async function estado() {
  const ajustes = await leerAjustes();
  const tomas = await leerTomas();
  return {
    hoy: hoyColombia(),
    ahora: Math.floor(segundosDelDia() / 60),
    horaToma: HORA_TOMA,
    minutosAlerta: MINUTOS_ALERTA,
    // Si cambia, la app abierta se recarga sola para no quedarse con código viejo.
    version: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
    nombre: process.env.TRATO_ELLA || 'mi amor',
    nombreEl: process.env.NOMBRE_EL || 'él',
    ajustes,
    tomas,
  };
}

export function rachaDe({ tomas, hoy, ajustes }) {
  return racha(new Set(tomas.map((t) => t.fecha)), hoy, ajustes, ajustes.inicioRegistro);
}
