import { sumarDias, diffDias, esDescanso, diaDelBlister, racha, mejorRacha } from './ciclo.js';

const $ = (id) => document.getElementById(id);
const ZONA = 'America/Bogota';
const reducir = matchMedia('(prefers-reduced-motion: reduce)');

let datos = null;   // última respuesta de /api/estado
let mesVisto = null; // 'YYYY-MM'
let ocupado = false;

// ---------- Fechas ----------
const fmtHoy = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHM = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtLargo = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fmtMes = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'long', year: 'numeric' });

const aDate = (f) => new Date(`${f}T00:00:00Z`);
const largo = (f) => fmtLargo.format(aDate(f)).replace(',', '');
const hoyLocal = () => fmtHoy.format(new Date());
function minutosAhora() {
  const [h, m] = fmtHM.format(new Date()).split(':').map(Number);
  return h * 60 + m;
}
function horaCorta(min) {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

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

// ---------- Pequeños detalles ----------
let toastTimer;
function toast(texto) {
  const t = $('toast');
  t.textContent = texto;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2800);
}

function haptico() {
  if (navigator.vibrate) navigator.vibrate(12);
  else document.querySelector('.haptico input')?.click();
}

function mostrar(vista) {
  $('login').hidden = vista !== 'login';
  $('inicio').hidden = vista !== 'inicio';
  if (vista === 'login') setTimeout(() => $('pin').focus(), 400);
}

// ---------- Estado derivado ----------
function derivar() {
  const { hoy, ajustes, tomas } = datos;
  const tomadas = new Set(tomas.map((t) => t.fecha));
  const deHoy = tomas.find((t) => t.fecha === hoy);
  return { hoy, ajustes, tomas, tomadas, deHoy, descansoHoy: esDescanso(hoy, ajustes) };
}

function estadoDia(f, d) {
  if (d.tomadas.has(f)) return 'tomada';
  if (diffDias(f, d.hoy) > 0) return esDescanso(f, d.ajustes) ? 'descanso futuro' : 'futuro';
  if (esDescanso(f, d.ajustes)) return 'descanso';
  if (f < d.ajustes.inicioRegistro) return 'fuera';
  if (f === d.hoy) return 'pendiente';
  return 'olvidada';
}

// ---------- Pintar ----------
function pintar() {
  const d = derivar();
  const ahora = minutosAhora();
  const { horaToma, minutosAlerta } = datos;

  const h = Math.floor(ahora / 60);
  $('saludo').textContent = `${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}, amor`;
  $('fecha-hoy').textContent = largo(d.hoy);

  // Botón principal
  const btn = $('btn-tomar');
  let estado, texto, sub, linea, alerta = false;
  const diaBl = diaDelBlister(d.hoy, d.ajustes);
  const maxBl = d.ajustes.blister === '21' ? 21 : 28;

  if (d.deHoy) {
    estado = 'tomada';
    texto = '¡Tomada!';
    sub = d.deHoy.tarde ? 'registrada' : `a las ${horaCorta(aMin(d.deHoy.hora))}`;
    const r = racha(d.tomadas, d.hoy, d.ajustes, d.ajustes.inicioRegistro);
    linea = r > 1 ? `Llevas ${r} días seguidos 🔥 Te amo` : 'Lista por hoy, eres la mejor 💕';
  } else if (d.descansoHoy) {
    estado = 'descanso';
    texto = 'Descanso';
    sub = 'hoy no toca';
    linea = `Semana de descanso 🌙 Día ${diaBl} de 28`;
  } else if (ahora >= horaToma + minutosAlerta) {
    estado = 'tarde';
    texto = 'Me la tomé';
    sub = '¡ya pasó la hora!';
    linea = 'Tómatela ya, amor 💕';
    alerta = true;
  } else {
    estado = 'pendiente';
    texto = 'Me la tomé';
    sub = 'toca aquí';
    linea = ahora >= horaToma
      ? 'Es la hora, amor 💜'
      : diaBl && diaBl <= maxBl ? `Hoy va la pastilla ${diaBl} de ${maxBl}` : `Tu recordatorio llega a las ${horaCorta(horaToma)}`;
  }
  btn.dataset.estado = estado;
  btn.setAttribute('aria-label', estado === 'tomada' ? `Pastilla de hoy tomada ${sub}` : 'Registrar que me tomé la pastilla de hoy');
  $('btn-texto').textContent = texto;
  $('btn-sub').textContent = sub;
  $('estado-texto').textContent = linea;
  $('estado-texto').classList.toggle('alerta', alerta);
  $('deshacer').style.visibility = d.deHoy ? 'visible' : 'hidden'; // reserva el espacio: nada salta

  // Estadísticas
  const r = racha(d.tomadas, d.hoy, d.ajustes, d.ajustes.inicioRegistro);
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
  $('st-hora').textContent = horas.length ? horaCorta(horas[Math.floor(horas.length / 2)]) : '—';

  const mejor = mejorRacha(d.tomadas, d.hoy, d.ajustes, d.ajustes.inicioRegistro);
  $('pie').textContent = mejor > 1 ? `Tu mejor racha: ${mejor} días 💖` : `Recordatorio diario a las ${horaCorta(horaToma)} 💌`;

  pintarCalendario();
}

function pintarCalendario(direccion = 0) {
  const d = derivar();
  mesVisto ??= d.hoy.slice(0, 7);
  const primero = `${mesVisto}-01`;
  $('cal-titulo').textContent = fmtMes.format(aDate(primero)).replace(' de ', ' ');

  const huecos = (aDate(primero).getUTCDay() + 6) % 7; // lunes primero
  const [y, m] = mesVisto.split('-').map(Number);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const grid = $('cal-grid');
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
    const atras = diffDias(d.hoy, f);
    b.disabled = atras < 0 || atras > 62;
    b.setAttribute('aria-label', `${largo(f)}: ${etiqueta(est)}`);
    frag.append(b);
  }
  grid.replaceChildren(frag);

  // No pasar de dos meses en el futuro (para ver descansos) ni de un año atrás.
  $('mes-sig').disabled = diffDias(primero, d.hoy) > 40;
  $('mes-ant').disabled = diffDias(d.hoy, primero) > 365;

  if (direccion && !reducir.matches) {
    grid.animate(
      [{ opacity: 0, transform: `translateX(${direccion * 18}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
}

function etiqueta(est) {
  return {
    tomada: 'tomada', olvidada: 'no tomada', descanso: 'descanso', pendiente: 'pendiente',
    futuro: 'aún no llega', 'descanso futuro': 'descanso', fuera: 'sin registro',
  }[est];
}

function cambiarMes(delta) {
  const [y, m] = mesVisto.split('-').map(Number);
  const nuevo = new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
  mesVisto = nuevo;
  pintarCalendario(delta);
}

// ---------- Celebración ----------
function celebrar() {
  if (reducir.matches) return;
  const cara = document.querySelector('.pastilla-cara');
  cara.animate(
    [{ transform: 'scale(0.92)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
    { duration: 620, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
  );

  const capa = $('chispas');
  const total = 16;
  for (let i = 0; i < total; i++) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    c.classList.add('chispa');
    c.innerHTML = '<use href="#i-corazon"/>';
    capa.append(c);
    const ang = (i / total) * Math.PI * 2 + Math.random() * 0.35;
    const dist = 125 + Math.random() * 55;
    const x = Math.cos(ang) * dist;
    const y = Math.sin(ang) * dist;
    const s = 0.6 + Math.random() * 0.7;
    const giro = (Math.random() - 0.5) * 60;
    c.animate(
      [
        { transform: 'translate(0,0) scale(0.4)', opacity: 0 },
        { transform: `translate(${x * 0.55}px,${y * 0.55}px) scale(${s})`, opacity: 1, offset: 0.35 },
        { transform: `translate(${x}px,${y - 24}px) scale(${s * 0.8}) rotate(${giro}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', delay: Math.random() * 80 },
    ).finished.then(() => c.remove());
  }
}

// ---------- Acciones ----------
async function marcar(fecha, tomada, { optimista = false } = {}) {
  if (ocupado) return;
  ocupado = true;
  const antes = datos;
  if (optimista) {
    const hm = fmtHM.format(new Date());
    datos = {
      ...datos,
      tomas: tomada
        ? [...datos.tomas, { fecha, hora: hm, tarde: false }]
        : datos.tomas.filter((t) => t.fecha !== fecha),
    };
    pintar();
  }
  try {
    const r = await api('dia', { fecha, tomada });
    datos = r;
    pintar();
    if (fecha === datos.hoy && tomada) {
      toast(r.aviso === 'fallo' ? 'Quedó registrada ✔ (el correo no salió)' : 'Listo, ya le avisé a tu amor 💌');
    } else if (fecha === datos.hoy) {
      toast('Listo, la quité del registro');
    } else {
      toast(tomada ? 'Día marcado como tomado ✔' : 'Día marcado como no tomado');
    }
  } catch (err) {
    if (err.message !== 'sesion') {
      datos = antes;
      pintar();
      toast(navigator.onLine ? err.message : 'Sin internet, intenta de nuevo');
    }
  } finally {
    ocupado = false;
  }
}

$('btn-tomar').addEventListener('click', () => {
  const d = derivar();
  if (d.deHoy) {
    haptico();
    toast('Ya está registrada hoy 💕');
    return;
  }
  haptico();
  marcar(d.hoy, true, { optimista: true });
  celebrar();
});

$('deshacer').addEventListener('click', () => marcar(datos.hoy, false, { optimista: true }));

$('mes-ant').addEventListener('click', () => cambiarMes(-1));
$('mes-sig').addEventListener('click', () => cambiarMes(1));

// Deslizar el calendario hacia los lados para cambiar de mes.
{
  const cal = document.querySelector('.calendario');
  let x0 = null, y0 = 0;
  cal.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  cal.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const btn = $(dx < 0 ? 'mes-sig' : 'mes-ant');
      if (!btn.disabled) cambiarMes(dx < 0 ? 1 : -1);
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
  const panel = hoja.querySelector('.hoja-panel');
  const fin = () => hoja.close();
  if (reducir.matches) return setTimeout(fin, 200);
  panel.addEventListener('transitionend', fin, { once: true });
  setTimeout(fin, 400); // por si no llega transitionend
}
for (const hoja of document.querySelectorAll('.hoja')) {
  hoja.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrarHoja(hoja); });
  hoja.addEventListener('cancel', (e) => { e.preventDefault(); cerrarHoja(hoja); });
}

let diaAbierto = null;
$('cal-grid').addEventListener('click', (e) => {
  const b = e.target.closest('.dia');
  if (!b || b.disabled) return;
  const d = derivar();
  const f = b.dataset.fecha;
  const est = estadoDia(f, d);
  diaAbierto = f;

  const chip = $('dia-chip');
  const toma = d.tomas.find((t) => t.fecha === f);
  chip.className = `hoja-chip ${est === 'tomada' ? '' : est.split(' ')[0]}`;
  chip.textContent = est === 'tomada'
    ? (toma.tarde ? 'Tomada · registrada después' : `Tomada a las ${horaCorta(aMin(toma.hora))}`)
    : etiqueta(est).replace(/^./, (c) => c.toUpperCase());
  $('dia-titulo').textContent = f === d.hoy ? `Hoy, ${largo(f)}` : largo(f);
  $('dia-texto').textContent = est === 'tomada'
    ? '¿Quieres quitar este registro?'
    : est.startsWith('descanso')
      ? 'Es día de descanso del blister. Si igual te la tomaste, puedes marcarla.'
      : '¿Te la tomaste este día? Puedes marcarlo aunque se te haya olvidado registrarlo.';
  $('dia-si').hidden = est === 'tomada';
  $('dia-no').hidden = est !== 'tomada';
  abrirHoja($('hoja-dia'));
});

$('dia-si').addEventListener('click', async () => {
  cerrarHoja($('hoja-dia'));
  const esHoy = diaAbierto === datos.hoy;
  if (esHoy) { haptico(); celebrar(); }
  await marcar(diaAbierto, true, { optimista: true });
});
$('dia-no').addEventListener('click', async () => {
  cerrarHoja($('hoja-dia'));
  await marcar(diaAbierto, false, { optimista: true });
});

// Ajustes
$('abrir-ajustes').addEventListener('click', () => {
  const { ajustes, hoy } = datos;
  const form = $('form-ajustes');
  form.blister.value = ajustes.blister;
  $('aj-inicio').value = ajustes.inicioBlister || hoy;
  $('aj-inicio').max = hoy;
  $('campo-inicio').hidden = ajustes.blister !== '21';
  abrirHoja($('hoja-ajustes'));
});
$('form-ajustes').addEventListener('change', (e) => {
  if (e.target.name === 'blister') $('campo-inicio').hidden = e.target.value !== '21';
});
$('form-ajustes').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const blister = form.blister.value;
  try {
    datos = await api('ajustes', { blister, inicioBlister: blister === '21' ? $('aj-inicio').value || datos.hoy : null });
    cerrarHoja($('hoja-ajustes'));
    pintar();
    toast('Guardado 💕');
  } catch (err) {
    if (err.message !== 'sesion') toast(err.message);
  }
});

// ---------- Login ----------
$('form-pin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const boton = form.querySelector('button');
  boton.disabled = true;
  $('pin-error').textContent = '';
  try {
    await api('login', { pin: $('pin').value.trim() });
    $('pin').blur();
    await cargar();
  } catch (err) {
    $('pin-error').textContent = err.message === 'PIN incorrecto' ? 'Ese no es, intenta otra vez 🙈' : err.message;
    form.classList.remove('mal');
    void form.offsetWidth;
    form.classList.add('mal');
    $('pin').select();
  } finally {
    boton.disabled = false;
  }
});

// ---------- Arranque ----------
async function cargar() {
  try {
    datos = await api('estado');
    mostrar('inicio');
    pintar();
  } catch (err) {
    if (err.message !== 'sesion') {
      toast(navigator.onLine ? err.message : 'Sin internet, intenta de nuevo');
    }
  }
}

// Al volver a la app (o cada minuto) se refresca: cambia el día, el texto de la hora, etc.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && datos) cargar();
});
setInterval(() => {
  if (!datos || document.hidden) return;
  if (hoyLocal() !== datos.hoy) cargar();
  else pintar();
}, 60000);

cargar();
