// WhatsApp por vinculación (como WhatsApp Web) con Baileys.
// La sesión vive en privado.whatsapp_auth; cada envío se conecta unos segundos, manda y cierra.
// La vinculación se hace una sola vez con `npm run whatsapp:vincular`.
import makeWASocket, {
  Browsers, BufferJSON, DisconnectReason, initAuthCreds, makeCacheableSignalKeyStore, proto,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { db } from './db.js';

export const logger = pino({ level: process.env.WA_LOG || 'silent' });

// libsignal imprime por consola las sesiones de cifrado (con sus claves): no deben llegar a los logs.
for (const metodo of ['info', 'warn']) {
  const original = console[metodo].bind(console);
  console[metodo] = (primero, ...resto) => {
    if (typeof primero === 'string' && /session/i.test(primero) && resto.length) return;
    original(primero, ...resto);
  };
}

/** Estado de autenticación de Baileys guardado en Postgres. */
export async function authPostgres(sql = db()) {
  const aTexto = (v) => JSON.stringify(v, BufferJSON.replacer);
  const deTexto = (t) => JSON.parse(t, BufferJSON.reviver);

  // Las escrituras van en fila para que ninguna pise a otra y se puedan esperar al cerrar.
  let cola = Promise.resolve();
  const encolar = (fn) => (cola = cola.then(fn, fn));

  const [fila] = await sql`select valor from privado.whatsapp_auth where id = 'creds'`;
  const creds = fila ? deTexto(fila.valor) : initAuthCreds();

  const keys = {
    async get(tipo, ids) {
      const datos = Object.fromEntries(ids.map((id) => [id, null]));
      if (!ids.length) return datos;
      const filas = await sql`
        select id, valor from privado.whatsapp_auth where id in ${sql(ids.map((id) => `${tipo}-${id}`))}`;
      for (const f of filas) {
        let valor = deTexto(f.valor);
        if (tipo === 'app-state-sync-key') valor = proto.Message.AppStateSyncKeyData.fromObject(valor);
        datos[f.id.slice(tipo.length + 1)] = valor;
      }
      return datos;
    },
    set(datos) {
      const guardar = [];
      const borrar = [];
      for (const tipo in datos) {
        for (const id in datos[tipo]) {
          const valor = datos[tipo][id];
          if (valor) guardar.push({ id: `${tipo}-${id}`, valor: aTexto(valor) });
          else borrar.push(`${tipo}-${id}`);
        }
      }
      return encolar(async () => {
        if (guardar.length) {
          await sql`insert into privado.whatsapp_auth ${sql(guardar, 'id', 'valor')}
                    on conflict (id) do update set valor = excluded.valor`;
        }
        if (borrar.length) await sql`delete from privado.whatsapp_auth where id in ${sql(borrar)}`;
      });
    },
  };

  return {
    state: { creds, keys },
    saveCreds: () => encolar(() => sql`
      insert into privado.whatsapp_auth (id, valor) values ('creds', ${aTexto(creds)})
      on conflict (id) do update set valor = excluded.valor`),
    pendiente: () => cola,
  };
}

export function crearSocket(auth) {
  const sock = makeWASocket({
    auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, logger) },
    logger,
    browser: Browsers.macOS('Pastillita'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    generateHighQualityLinkPreview: false,
  });
  sock.ev.on('creds.update', auth.saveCreds);
  return sock;
}

function esperarApertura(sock, ms = 25000) {
  return new Promise((ok, mal) => {
    const reloj = setTimeout(() => mal(new Error('WhatsApp no conectó a tiempo')), ms);
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        clearTimeout(reloj);
        ok();
      } else if (connection === 'close') {
        clearTimeout(reloj);
        const codigo = lastDisconnect?.error?.output?.statusCode;
        const err = new Error(codigo === DisconnectReason.loggedOut
          ? 'WhatsApp se desvinculó: hay que volver a escanear el QR'
          : `WhatsApp cerró la conexión (${codigo})`);
        err.codigo = codigo;
        mal(err);
      }
    });
  });
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Envía varios mensajes en una sola conexión. mensajes: [{ numero: '57311…', texto }].
 * Devuelve cuántos salieron.
 */
export async function enviarWhatsApp(mensajes) {
  const destinos = mensajes.filter((m) => m.numero);
  if (!destinos.length) return 0;

  const auth = await authPostgres();
  if (!auth.state.creds.me) throw new Error('WhatsApp no está vinculado (npm run whatsapp:vincular)');

  for (let intento = 1; ; intento++) {
    const sock = crearSocket(auth);
    try {
      await esperarApertura(sock);
      let enviados = 0;
      for (const m of destinos) {
        const [r] = await sock.onWhatsApp(m.numero);
        if (!r?.exists) {
          console.error(`El número ${m.numero} no tiene WhatsApp`);
          continue;
        }
        await sock.sendMessage(r.jid, { text: m.texto });
        enviados++;
      }
      await pausa(2500); // deja salir los mensajes antes de cerrar
      return enviados;
    } catch (err) {
      // WhatsApp a veces pide reiniciar la conexión al abrirla; se reintenta una vez.
      if (err.codigo === DisconnectReason.restartRequired && intento < 2) continue;
      throw err;
    } finally {
      sock.end(undefined);
      await auth.pendiente();
    }
  }
}

// ---------- Mensajes ----------
const ELLA = () => process.env.NOMBRE_ELLA || 'ella';
const TRATO = process.env.TRATO_ELLA || 'mi amor'; // cómo se le habla a ella
const Trato = TRATO.charAt(0).toUpperCase() + TRATO.slice(1);
const EL = () => process.env.NOMBRE_EL || '';
/** URL de la app: APP_URL o, si falta o quedó el ejemplo, la de producción que da Vercel. */
function urlApp() {
  const propia = process.env.APP_URL;
  if (propia && !propia.includes('TU-APP')) return propia.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : '';
}
const url = () => (urlApp() ? `\n${urlApp()}` : '');

/** 'Buenos días' / 'Buenas tardes' / 'Buenas noches' según la hora de Colombia. */
function saludo() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export function mensajesRecordatorio(hora) {
  return [
    {
      numero: process.env.WHATSAPP_ELLA,
      texto: `*Pastillita*\n${saludo()}, ${TRATO}. Son las ${hora}: es hora de tu pastilla.\nCuando te la tomes, regístrala aquí:${url()}`,
    },
    {
      numero: process.env.WHATSAPP_EL,
      texto: `*Pastillita*\n${EL() ? `${EL()}, s` : 'S'}on las ${hora} y ${ELLA()} aún no ha registrado la pastilla de hoy. Ya le llegó su recordatorio.`,
    },
  ];
}

export function mensajeTomada({ hora, racha, tarde }) {
  const detalle = [
    tarde ? 'Fue después de la hora del recordatorio.' : '',
    racha > 1 ? `Lleva ${racha} días seguidos.` : '',
  ].filter(Boolean).join(' ');
  return [{
    numero: process.env.WHATSAPP_EL,
    texto: `*Pastillita*\n${ELLA()} se tomó la pastilla de hoy a las ${hora}.${detalle ? `\n${detalle}` : ''}`,
  }];
}

export function mensajeDeshecha() {
  return [{
    numero: process.env.WHATSAPP_EL,
    texto: `*Pastillita*\n${ELLA()} quitó el registro de hoy porque lo había marcado por error. Por ahora la pastilla aparece como no tomada.`,
  }];
}

export function mensajesAlerta(hora) {
  return [
    {
      numero: process.env.WHATSAPP_ELLA,
      texto: `*Pastillita*\n${Trato}, ya son las ${hora} y tu pastilla de hoy sigue sin registrarse. Tómatela y márcala aquí:${url()}`,
    },
    {
      numero: process.env.WHATSAPP_EL,
      texto: `*Pastillita*\n${EL() ? `${EL()}, y` : 'Y'}a son las ${hora} y ${ELLA()} todavía no registra la pastilla de hoy. Recuérdale con cariño.`,
    },
  ];
}
