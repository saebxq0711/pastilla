// Envía un mensaje de prueba: npm run whatsapp:probar -- 573181813313
import { db } from '../api/_lib/db.js';
import { enviarWhatsApp } from '../api/_lib/whatsapp.js';

const numero = process.argv[2] || process.env.WHATSAPP_EL;
const n = await enviarWhatsApp([{ numero, texto: '*Pastillita*\nMensaje de prueba: WhatsApp quedó conectado. Desde ahora te llegan aquí los avisos de las 9:00 y 9:30 p. m.' }]);
console.log(n ? `Enviado a ${numero}` : `No se pudo enviar a ${numero}`);
await db().end();
process.exit(n ? 0 : 1);
