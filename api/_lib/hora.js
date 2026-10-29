// Todo se calcula en hora de Colombia (UTC-5, sin horario de verano).
export const ZONA = 'America/Bogota';

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
});
const fmtHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function hoyColombia(d = new Date()) {
  return fmtFecha.format(d);
}

/** Segundos transcurridos del día en Colombia. */
export function segundosDelDia(d = new Date()) {
  const [h, m, s] = fmtHora.format(d).split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function minutos(texto) {
  const [h, m] = texto.split(':').map(Number);
  return h * 60 + m;
}

/** Hora del recordatorio, en minutos desde medianoche (21:00 por defecto). */
export const HORA_TOMA = minutos(process.env.HORA_TOMA || '21:00');
/** Minutos de gracia antes de avisarle a él. */
export const MINUTOS_ALERTA = Number(process.env.MINUTOS_ALERTA || 30);

/** '20:47' -> '8:47 p. m.' */
export function horaBonita(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`;
}
