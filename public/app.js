import { sumarDias, diffDias, esDescanso, diaDelBlister, fechasDelBlister, racha, mejorRacha } from './ciclo.js';

const $ = (id) => document.getElementById(id);
const ZONA = 'America/Bogota';
const reducir = matchMedia('(prefers-reduced-motion: reduce)');
const DIAS_ATRAS = 62;

let datos = null;    // última respuesta de /api/estado
let mesVisto = null; // 'YYYY-MM'
let ocupado = false;
let recien = null;   // fecha recién registrada, para animar su burbuja una sola vez

// ---------- Fechas ----------
const fmtHoy = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHM = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtLargo = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fmtMes = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const fmtDiaSemana = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'narrow' });

const aDate = (f) => new Date(`${f}T00:00:00Z`);
const largo = (f) => fmtLargo.format(aDate(f)).replace(',', '');
const hoyLocal = () => fmtHoy.format(new Date());
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const minutosAhora = () => aMin(fmtHM.format(new Date()));
function horaCorta(min) {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
const svg = (id, clase = 'i') => `<svg class="${clase}"><use href="#${id}"/></svg>`;

// ---------- Red ----------
async function api(ruta, cuerpo) {
  const r = await fetch(`/api/${ruta}`, cuerpo === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const json = await r.json().catch(() => ({}));
  if (r.status === 401 && ruta !== 'login') { mostrar('login'); throw new Error('sesion'); }
  if (!r.ok) throw new Error(json.error || 'No se pudo conectar');
  return json;
}

// ---------- Detalles ----------
let toastTimer;
function toast(texto, { error = false } = {}) {
  const t = $('toast');
  t.querySelector('span').textContent = texto;
  t.querySelector('use').setAttribute('href', error ? '#i-alerta' : '#i-check-circulo');
  t.classList.toggle('error', error);
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2800);
}
const toastError = (err) => toast(navigator.onLine ? err.message : 'Sin conexión, intenta de nuevo', { error: true });

function haptico() {
  if (navigator.vibrate) navigator.vibrate(12);
  else document.querySelector('.haptico input')?.click();
}

function mostrar(vista) {
  $('login').hidden = vista !== 'login';
  $('inicio').hidden = vista !== 'inicio';
  $('barra').hidden = vista !== 'inicio';
}

// ---------- Estado derivado ----------
function derivar() {
  const { hoy, ajustes, tomas } = datos;
  const tomadas = new Set(tomas.map((t) => t.fecha));
  return { hoy, ajustes, tomas, tomadas, deHoy: tomas.find((t) => t.fecha === hoy), descansoHoy: esDescanso(hoy, ajustes) };
}

function estadoDia(f, d) {
  if (d.tomadas.has(f)) return 'tomada';
  if (diffDias(f, d.hoy) > 0) return esDescanso(f, d.ajustes) ? 'descanso futuro' : 'futuro';
  if (esDescanso(f, d.ajustes)) return 'descanso';
  if (f < d.ajustes.inicioRegistro) return 'fuera';
  if (f === d.hoy) return 'pendiente';
  return 'olvidada';
}

const ETIQUETAS = {
  tomada: 'Tomada', olvidada: 'No tomada', descanso: 'Descanso', pendiente: 'Pendiente',
  futuro: 'Aún no llega', 'descanso futuro': 'Descanso', fuera: 'Sin registro',
};

const sePuedeTocar = (f, d) => { const atras = diffDias(d.hoy, f); return atras >= 0 && atras <= DIAS_ATRAS; };

// ---------- Pintar ----------
function pintar() {
  const d = derivar();
  const ahora = minutosAhora();
  const { horaToma, minutosAlerta } = datos;

  $('fecha-hoy').textContent = largo(d.hoy);
  const h = Math.floor(ahora / 60);
  $('saludo').textContent = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  $('nombre').textContent = datos.nombre;
  $('info-el').textContent = datos.nombreEl;

  const r = racha(d.tomadas, d.hoy, d.ajustes, d.ajustes.inicioRegistro);
  const diaBl = diaDelBlister(d.hoy, d.ajustes);
  const activas = d.ajustes.blister === '21' ? 21 : 28;
  $('bl-titulo').textContent = d.descansoHoy ? `Descanso, día ${diaBl} de 28` : `Pastilla ${diaBl} de ${activas}`;
  $('racha-num').textContent = r;
  $('chip-racha').setAttribute('aria-label', `Racha de ${r} ${r === 1 ? 'día' : 'días'}`);

  // Línea de estado bajo el blister
  let icono = 'i-campana', texto, alerta = false;
  if (d.deHoy) {
    icono = 'i-check-circulo';
    texto = r > 1 ? `Vas ${r} días seguidos sin fallar, ${datos.nombre}` : `Lista por hoy, ${datos.nombre}`;
  } else if (d.descansoHoy) {
    icono = 'i-luna';
    texto = 'Semana de descanso, hoy no toca';
  } else if (ahora >= horaToma + minutosAlerta) {
    icono = 'i-alarma';
    texto = 'Ya pasó la hora, aún estás a tiempo';
    alerta = true;
  } else if (ahora >= horaToma) {
    icono = 'i-alarma';
    texto = `Es la hora de tu pastilla, ${datos.nombre}`;
  } else {
    texto = `Recordatorio a las ${horaCorta(horaToma)}`;
  }
  $('estado-icono').querySelector('use').setAttribute('href', `#${icono}`);
  $('estado-texto').textContent = texto;
  $('blister-estado').classList.toggle('alerta', alerta);

  // Barra inferior
  const barra = $('barra');
  barra.dataset.modo = d.deHoy ? 'hecho' : d.descansoHoy ? 'descanso' : 'accion';
  barra.classList.toggle('tarde', alerta);
  if (d.deHoy) {
    $('hecho-titulo').textContent = 'Tomada hoy';
    $('hecho-sub').textContent = d.deHoy.tarde ? 'Registrada desde el historial' : `A las ${horaCorta(aMin(d.deHoy.hora))}`;
  }
  $('descanso-sub').textContent = `Día ${diaBl} de 28`;

  // Estadísticas
  $('st-racha').textContent = r;
  $('st-racha-lbl').textContent = r === 1 ? 'día seguido' : 'días seguidos';
  const inicioMes = `${d.hoy.slice(0, 8)}01`;
  let tocaban = 0, hechas = 0;
  for (let f = inicioMes > d.ajustes.inicioRegistro ? inicioMes : d.ajustes.inicioRegistro; f <= d.hoy; f = sumarDias(f, 1)) {
    if (esDescanso(f, d.ajustes)) continue;
    if (d.tomadas.has(f)) { hechas++; tocaban++; } else if (f !== d.hoy) tocaban++;
  }
  $('st-mes').textContent = tocaban ? `${hechas}/${tocaban}` : '—';
  const horas = d.tomas.filter((t) => !t.tarde).slice(-30).map((t) => aMin(t.hora)).sort((a, b) => a - b);
  $('st-hora').textContent = horas.length ? horaCorta(horas[Math.floor(horas.length / 2)]).replace(/ (a|p)\. m\./, ' $1m') : '—';

  const mejor = mejorRacha(d.tomadas, d.hoy, d.ajustes, d.ajustes.inicioRegistro);
  $('pie').textContent = mejor > 1 ? `Mejor racha: ${mejor} días` : '';

  pintarBlister(d);
  pintarCalendario();
}

function pintarBlister(d) {
  const fechas = fechasDelBlister(d.hoy, d.ajustes);
  $('lamina-dias').innerHTML = fechas.slice(0, 7)
    .map((f) => `<span>${fmtDiaSemana.format(aDate(f)).toUpperCase()}</span>`).join('');

  const frag = document.createDocumentFragment();
  for (const f of fechas) {
    const est = estadoDia(f, d);
    const b = document.createElement('button');
    b.className = `burbuja ${est}${f === d.hoy ? ' hoy' : ''}${f === recien ? ' recien' : ''}`;
    b.dataset.fecha = f;
    b.disabled = !sePuedeTocar(f, d);
    b.setAttribute('aria-label', `${largo(f)}: ${ETIQUETAS[est]}`);
    if (est === 'tomada') b.innerHTML = svg('i-check', 'i marca-check');
    else if (est.startsWith('descanso')) b.innerHTML = svg('i-luna', 'i marca-luna');
    else b.innerHTML = `<span class="tableta"></span>${f === d.hoy && !reducir.matches ? '<span class="anillo"></span>' : ''}`;
    frag.append(b);
  }
  $('lamina-grid').replaceChildren(frag);
}

function pintarCalendario(direccion = 0) {
  const d = derivar();
  mesVisto ??= d.hoy.slice(0, 7);
  const primero = `${mesVisto}-01`;
  $('cal-titulo').textContent = fmtMes.format(aDate(primero)).replace(' de ', ' ');

  const huecos = (aDate(primero).getUTCDay() + 6) % 7; // lunes primero
  const [y, m] = mesVisto.split('-').map(Number);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const frag = document.createDocumentFragment();
  for (let i = 0; i < huecos; i++) {
    const v = document.createElement('span');
    v.className = 'dia vacio';
    frag.append(v);
  }
  for (let n = 1; n <= diasMes; n++) {
    const f = `${mesVisto}-${String(n).padStart(2, '0')}`;
    const est = estadoDia(f, d);
    const b = document.createElement('button');
    b.className = `dia ${est}${f === d.hoy ? ' hoy' : ''}`;
    b.textContent = n;
    b.dataset.fecha = f;
    b.disabled = !sePuedeTocar(f, d);
    b.setAttribute('aria-label', `${largo(f)}: ${ETIQUETAS[est]}`);
    frag.append(b);
  }
  const grid = $('cal-grid');
  grid.replaceChildren(frag);

  $('mes-sig').disabled = diffDias(primero, d.hoy) > 40;
  $('mes-ant').disabled = diffDias(d.hoy, primero) > 365;

  if (direccion && !reducir.matches) {
    grid.animate(
      [{ opacity: 0, transform: `translateX(${direccion * 18}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
}

function cambiarMes(delta) {
  const [y, m] = mesVisto.split('-').map(Number);
  mesVisto = new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
  pintarCalendario(delta);
}

// ---------- Animación al registrar ----------
/** La tableta de hoy salta de su burbuja. Devuelve una promesa que termina con la animación. */
function sacarTableta(fecha) {
  const burbuja = document.querySelector(`.burbuja[data-fecha="${fecha}"]`);
  const tableta = burbuja?.querySelector('.tableta');
  if (!tableta || reducir.matches) return Promise.resolve();
  burbuja.querySelector('.anillo')?.remove();
  chispas(burbuja);
  return tableta.animate(
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(-6px) scale(1.3)', opacity: 1, offset: 0.4 },
      { transform: 'translateY(-26px) scale(0.5) rotate(40deg)', opacity: 0 },
    ],
    { duration: 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
  ).finished;
}

function chispas(origen) {
  const caja = origen.getBoundingClientRect();
  const capa = $('chispas');
  capa.style.transform = `translate(${caja.left + caja.width / 2}px, ${caja.top + caja.height / 2}px)`;
  const total = 12;
  for (let i = 0; i < total; i++) {
    const c = document.createElement('i');
    c.className = 'chispa';
    capa.append(c);
    const ang = (i / total) * 360 + Math.random() * 12;
    const dist = 30 + Math.random() * 18;
    c.animate(
      [
        { transform: `rotate(${ang}deg) translateY(-10px) scaleY(0.4)`, opacity: 0 },
        { transform: `rotate(${ang}deg) translateY(-${dist * 0.7}px) scaleY(1)`, opacity: 1, offset: 0.35 },
        { transform: `rotate(${ang}deg) translateY(-${dist}px) scaleY(0.2)`, opacity: 0 },
      ],
      { duration: 560, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    ).finished.then(() => c.remove());
  }
}

// ---------- Acciones ----------
async function marcar(fecha, tomada) {
  if (ocupado) return;
  ocupado = true;
  const antes = datos;
  const esHoy = fecha === datos.hoy;

  // La petición sale ya; la pantalla cambia cuando la tableta termina de saltar.
  const peticion = api('dia', { fecha, tomada }).then((r) => ({ r }), (e) => ({ e }));
  if (tomada && esHoy) {
    haptico();
    await sacarTableta(fecha);
  }

  datos = {
    ...datos,
    tomas: tomada
      ? [...datos.tomas, { fecha, hora: fmtHM.format(new Date()), tarde: !esHoy }]
      : datos.tomas.filter((t) => t.fecha !== fecha),
  };
  recien = tomada ? fecha : null;
  pintar();
  setTimeout(() => { recien = null; }, 900);

  const { r, e } = await peticion;
  if (e) {
    if (e.message !== 'sesion') {
      datos = antes;
      pintar();
      toastError(e);
    }
  } else {
    datos = r;
    pintar();
    if (esHoy && tomada) toast(`Registrada. Le avisamos a ${datos.nombreEl}`);
    else if (esHoy) toast('Registro de hoy deshecho');
    else toast(tomada ? 'Día marcado como tomado' : 'Registro quitado');
  }
  ocupado = false;
}

$('btn-tomar').addEventListener('click', () => {
  if (!derivar().deHoy) marcar(datos.hoy, true);
});
$('deshacer').addEventListener('click', () => marcar(datos.hoy, false));
$('mes-ant').addEventListener('click', () => cambiarMes(-1));
$('mes-sig').addEventListener('click', () => cambiarMes(1));

// Deslizar el historial hacia los lados para cambiar de mes.
{
  const cal = document.querySelector('.historial');
  let x0 = null, y0 = 0;
  cal.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  cal.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (!$(dx < 0 ? 'mes-sig' : 'mes-ant').disabled) cambiarMes(dx < 0 ? 1 : -1);
    }
  });
  cal.addEventListener('pointercancel', () => { x0 = null; });
}

// ---------- Hojas ----------
function abrirHoja(hoja) {
  hoja.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => hoja.classList.add('abierta')));
}
function cerrarHoja(hoja) {
  if (!hoja.open) return;
  hoja.classList.remove('abierta');
  const fin = () => hoja.open && hoja.close();
  if (reducir.matches) return setTimeout(fin, 200);
  hoja.querySelector('.hoja-panel').addEventListener('transitionend', fin, { once: true });
  setTimeout(fin, 400);
}
for (const hoja of document.querySelectorAll('.hoja')) {
  hoja.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrarHoja(hoja); });
  hoja.addEventListener('cancel', (e) => { e.preventDefault(); cerrarHoja(hoja); });
}

let diaAbierto = null;
function abrirDia(f) {
  const d = derivar();
  // Hoy pendiente: tocar su burbuja es lo mismo que el botón principal.
  if (f === d.hoy && !d.deHoy && !d.descansoHoy) return marcar(f, true);

  const est = estadoDia(f, d);
  const toma = d.tomas.find((t) => t.fecha === f);
  diaAbierto = f;

  const chip = $('dia-chip');
  chip.className = `hoja-chip ${est.split(' ')[0]}`;
  chip.querySelector('use').setAttribute('href', {
    tomada: '#i-check-circulo', olvidada: '#i-alerta', descanso: '#i-luna',
  }[est.split(' ')[0]] || '#i-reloj');
  chip.querySelector('span').textContent = est === 'tomada'
    ? (toma.tarde ? 'Tomada, registrada después' : `Tomada a las ${horaCorta(aMin(toma.hora))}`)
    : ETIQUETAS[est];
  $('dia-titulo').textContent = f === d.hoy ? `Hoy, ${largo(f)}` : largo(f);
  $('dia-texto').textContent = est === 'tomada'
    ? 'Si se marcó por error, puedes quitar el registro.'
    : est.startsWith('descanso')
      ? 'Es un día de descanso del blister. Si igual te la tomaste, puedes marcarla.'
      : 'Si te la tomaste y no la registraste, márcala aquí.';
  $('dia-si').hidden = est === 'tomada';
  $('dia-no').hidden = est !== 'tomada';
  abrirHoja($('hoja-dia'));
}

for (const id of ['cal-grid', 'lamina-grid']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-fecha]');
    if (b && !b.disabled) abrirDia(b.dataset.fecha);
  });
}
$('dia-si').addEventListener('click', () => { cerrarHoja($('hoja-dia')); marcar(diaAbierto, true); });
$('dia-no').addEventListener('click', () => { cerrarHoja($('hoja-dia')); marcar(diaAbierto, false); });

// Ajustes
$('abrir-ajustes').addEventListener('click', () => {
  const { ajustes, hoy } = datos;
  const form = $('form-ajustes');
  form.blister.value = ajustes.blister;
  $('aj-inicio').value = ajustes.inicioBlister || ajustes.inicioRegistro;
  $('aj-inicio').max = hoy;
  abrirHoja($('hoja-ajustes'));
});
$('form-ajustes').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    datos = await api('ajustes', { blister: e.currentTarget.blister.value, inicioBlister: $('aj-inicio').value || datos.hoy });
    cerrarHoja($('hoja-ajustes'));
    pintar();
    toast('Blister actualizado');
  } catch (err) {
    if (err.message !== 'sesion') toastError(err);
  }
});

// ---------- Acceso con teclado numérico ----------
{
  const LARGO = 4;
  let codigo = '';
  const puntos = $('puntos');

  const pintarPuntos = () => [...puntos.children].forEach((p, i) => p.classList.toggle('lleno', i < codigo.length));

  async function enviar() {
    try {
      await api('login', { pin: codigo });
      puntos.classList.add('bien');
      await cargar();
    } catch {
      $('pin-estado').textContent = 'Código incorrecto';
      puntos.classList.remove('mal');
      void puntos.offsetWidth;
      puntos.classList.add('mal');
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      setTimeout(() => { codigo = ''; puntos.classList.remove('mal'); pintarPuntos(); }, 450);
    }
  }

  function tecla(d) {
    if (d === 'borrar') codigo = codigo.slice(0, -1);
    else if (codigo.length < LARGO) codigo += d;
    pintarPuntos();
    if (codigo.length === LARGO) enviar();
  }

  $('teclado').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) tecla(b.dataset.borrar !== undefined ? 'borrar' : b.dataset.d);
  });
  document.addEventListener('keydown', (e) => {
    if ($('login').hidden) return;
    if (/^\d$/.test(e.key)) tecla(e.key);
    else if (e.key === 'Backspace') tecla('borrar');
  });
}

// ---------- Arranque ----------
async function cargar() {
  try {
    datos = await api('estado');
    mostrar('inicio');
    pintar();
  } catch (err) {
    if (err.message !== 'sesion') toastError(err);
  }
}

// Al volver a la app (o cada minuto) se refresca: cambia el día, el texto de la hora, etc.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && datos) cargar();
});
setInterval(() => {
  if (!datos || document.hidden || ocupado) return;
  if (hoyLocal() !== datos.hoy) cargar();
  else pintar();
}, 60000);

cargar();
