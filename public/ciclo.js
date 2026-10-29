// Lógica de fechas y del blister. La comparten el navegador y las funciones de /api.
// Las fechas viajan como texto 'YYYY-MM-DD' (día de Colombia) para no pelear con zonas horarias.

const DIA_MS = 86400000;

function aUTC(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(fecha, n) {
  return new Date(aUTC(fecha) + n * DIA_MS).toISOString().slice(0, 10);
}

/** Días de b hasta a (a - b). */
export function diffDias(a, b) {
  return Math.round((aUTC(a) - aUTC(b)) / DIA_MS);
}

/** Día 1 del blister de referencia: el que ella configuró o, si no, el primer día registrado. */
function ancla(ajustes) {
  return ajustes.inicioBlister || ajustes.inicioRegistro;
}

/** Día del blister (1..28). */
export function diaDelBlister(fecha, ajustes) {
  return ((((diffDias(fecha, ancla(ajustes))) % 28) + 28) % 28) + 1;
}

/** Las 28 fechas del blister que contiene `fecha`. */
export function fechasDelBlister(fecha, ajustes) {
  const inicio = sumarDias(fecha, 1 - diaDelBlister(fecha, ajustes));
  return Array.from({ length: 28 }, (_, i) => sumarDias(inicio, i));
}

/** En blister de 21 + 7, los días 22..28 son de descanso. */
export function esDescanso(fecha, ajustes) {
  return ajustes.blister === '21' && diaDelBlister(fecha, ajustes) > 21;
}

/** Días seguidos tomándola. Los días de descanso no rompen la racha. */
export function racha(tomadas, hoy, ajustes, inicioRegistro) {
  let f = tomadas.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (f >= inicioRegistro) {
    if (!esDescanso(f, ajustes)) {
      if (!tomadas.has(f)) break;
      n++;
    }
    f = sumarDias(f, -1);
  }
  return n;
}

export function mejorRacha(tomadas, hoy, ajustes, inicioRegistro) {
  let mejor = 0;
  let actual = 0;
  for (let f = inicioRegistro; f <= hoy; f = sumarDias(f, 1)) {
    if (esDescanso(f, ajustes)) continue;
    if (tomadas.has(f)) {
      actual++;
      if (actual > mejor) mejor = actual;
    } else if (f !== hoy) {
      actual = 0;
    }
  }
  return mejor;
}
