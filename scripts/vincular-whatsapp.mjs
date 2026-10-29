// Vincula el WhatsApp que envía los avisos (una sola vez).
//   npm run whatsapp:vincular            -> muestra un QR en http://localhost:3005
//   npm run whatsapp:vincular -- --forzar -> borra la sesión guardada y vincula de nuevo
// En el celular: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo.
import http from 'node:http';
import { exec } from 'node:child_process';
import QRCode from 'qrcode';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { db } from '../api/_lib/db.js';
import { authPostgres, crearSocket } from '../api/_lib/whatsapp.js';

const PUERTO = 3005;
const sql = db();

if (process.argv.includes('--forzar')) {
  await sql`delete from privado.whatsapp_auth`;
  console.log('Sesión anterior borrada.');
}

const auth = await authPostgres(sql);
if (auth.state.creds.me) {
  console.log(`Ya está vinculado como ${auth.state.creds.me.id}. Usa --forzar para vincular otro.`);
  await sql.end();
  process.exit(0);
}

let pantalla = { estado: 'esperando', qr: null };

const pagina = () => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Vincular WhatsApp</title>
${pantalla.estado === 'listo' ? '' : '<meta http-equiv="refresh" content="3">'}
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf5f2;color:#2a0e1c;font:16px system-ui,sans-serif}
  main{max-width:420px;padding:32px;text-align:center}
  h1{font:600 28px Georgia,serif;margin:0 0 8px}
  p{color:#6e5562;line-height:1.5;margin:0 0 20px}
  img{width:300px;height:300px;border-radius:20px;background:#fff;padding:14px;box-shadow:0 12px 32px rgba(42,14,28,.1)}
  ol{text-align:left;color:#6e5562;line-height:1.7;padding-left:20px}
  .ok{width:72px;height:72px;margin:0 auto 18px;border-radius:50%;background:#b4234f;display:grid;place-items:center}
</style></head><body><main>
${pantalla.estado === 'listo'
    ? `<div class="ok"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
       <h1>WhatsApp vinculado</h1><p>Ya puedes cerrar esta ventana. Los avisos saldrán desde ${pantalla.numero}.</p>`
    : pantalla.qr
      ? `<h1>Vincular WhatsApp</h1><p>Escanéalo con el celular del número que enviará los avisos.</p>
         <img src="${pantalla.qr}" alt="Código QR">
         <ol><li>Abre WhatsApp</li><li>Ajustes → Dispositivos vinculados</li><li>Vincular un dispositivo y apunta a este código</li></ol>`
      : `<h1>Preparando el código…</h1><p>Un momento.</p>`}
</main></body></html>`;

const servidor = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pagina());
}).listen(PUERTO, () => {
  console.log(`Abre http://localhost:${PUERTO} y escanea el QR.`);
  exec(`start "" http://localhost:${PUERTO}`);
});

function conectar() {
  const sock = crearSocket(auth);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      pantalla.qr = await QRCode.toDataURL(qr, { margin: 1, width: 600, color: { dark: '#2a0e1c', light: '#ffffff' } });
      console.log('QR listo (se renueva cada ~20 s).');
    }
    if (connection === 'open') {
      const numero = sock.user.id.split(':')[0].split('@')[0];
      pantalla = { estado: 'listo', numero: `+${numero}` };
      console.log(`Vinculado como +${numero}. Guardando la sesión…`);
      setTimeout(async () => {
        await auth.saveCreds();
        await auth.pendiente();
        sock.end(undefined);
        console.log('Listo.');
        setTimeout(async () => { servidor.close(); await sql.end(); process.exit(0); }, 4000);
      }, 6000);
    }
    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      if (pantalla.estado === 'listo') return;
      // Tras escanear, WhatsApp pide reiniciar la conexión: es parte normal del proceso.
      if (codigo === DisconnectReason.restartRequired) return conectar();
      if (codigo === DisconnectReason.loggedOut) {
        console.error('WhatsApp rechazó la vinculación. Vuelve a intentarlo con --forzar.');
        process.exit(1);
      }
      console.log(`Conexión cerrada (${codigo}), reintentando…`);
      setTimeout(conectar, 2000);
    }
  });
}

conectar();
