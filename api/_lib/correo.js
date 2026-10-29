// Envío de correo. Dos caminos, según qué variables existan:
//   - SMTP_USER + SMTP_PASS  -> Gmail (u otro SMTP) con contraseña de aplicación.
//   - RESEND_API_KEY + MAIL_FROM -> Resend, con un dominio propio verificado.
// MAIL_MODO=log solo imprime el correo en consola (para pruebas locales).
import nodemailer from 'nodemailer';

let transporte;

function remitente() {
  const nombre = process.env.MAIL_NOMBRE || 'Pastillita 💊';
  return process.env.MAIL_FROM || `${nombre} <${process.env.SMTP_USER}>`;
}

async function enviar({ para, asunto, html, texto }) {
  if (process.env.MAIL_MODO === 'log') {
    console.log(`\n✉️  [correo] para=${para} asunto="${asunto}"\n${texto}\n`);
    return;
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporte ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporte.sendMail({ from: remitente(), to: para, subject: asunto, html, text: texto });
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: remitente(), to: [para], subject: asunto, html, text: texto }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return;
  }

  throw new Error('No hay correo configurado (SMTP_USER/SMTP_PASS o RESEND_API_KEY)');
}

function plantilla({ emoji, titulo, parrafos, boton }) {
  const url = process.env.APP_URL;
  const cuerpo = parrafos
    .map((p) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#5b3a52">${p}</p>`)
    .join('');
  const cta = boton && url
    ? `<a href="${url}" style="display:inline-block;margin-top:8px;padding:14px 26px;border-radius:999px;background:#ee4a85;background-image:linear-gradient(135deg,#ff7aa8,#ee4a85 55%,#a46bff);color:#fff;font-weight:700;font-size:16px;text-decoration:none">${boton}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#fff3f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px 28px;text-align:center;box-shadow:0 10px 30px rgba(238,74,133,.12)">
    <div style="font-size:44px;line-height:1;margin-bottom:12px">${emoji}</div>
    <h1 style="margin:0 0 14px;font-size:22px;color:#3b1730">${titulo}</h1>
    ${cuerpo}${cta}
  </div>
  <p style="text-align:center;margin:16px 0 0;font-size:12px;color:#b08aa3">Pastillita · hecho con cariño 💕</p>
</body></html>`;
}

function correo(para, asunto, contenido) {
  return enviar({
    para,
    asunto,
    html: plantilla(contenido),
    texto: [contenido.titulo, ...contenido.parrafos.map((p) => p.replace(/<[^>]+>/g, ''))].join('\n'),
  });
}

const EL = () => process.env.CORREO_EL;
const ELLA = () => process.env.CORREO_ELLA;

export function avisarTomada({ hora, racha, tarde }) {
  const dias = racha === 1 ? '1 día' : `${racha} días`;
  return correo(EL(), tarde ? '💊 Ya se tomó la pastilla (un poquito tarde)' : '💊 Ya se tomó la pastilla', {
    emoji: '💊',
    titulo: 'Ya se tomó la pastilla',
    parrafos: [
      `Hoy se la tomó a las <b>${hora}</b>`,
      racha > 1 ? `Lleva <b>${dias} seguidos</b> 🔥` : 'Todo en orden por hoy 💕',
    ],
  });
}

export function avisarDeshecha() {
  return correo(EL(), '↩️ Se desmarcó la pastilla de hoy', {
    emoji: '↩️',
    titulo: 'Se desmarcó la pastilla de hoy',
    parrafos: ['El registro de hoy se marcó por error y se quitó. Todavía no aparece como tomada.'],
  });
}

export function recordarAElla({ hora }) {
  return correo(ELLA(), '💜 Amor, es hora de tu pastilla', {
    emoji: '💜',
    titulo: 'Es hora de tu pastilla',
    parrafos: [`Son las ${hora}: tómatela y regístrala con un toque, así quedo tranquilo 🥰`],
    boton: 'Registrar mi pastilla',
  });
}

export function alertarAEl({ hora }) {
  return correo(EL(), '⏰ Aún no se ha tomado la pastilla', {
    emoji: '⏰',
    titulo: 'Aún no se ha tomado la pastilla',
    parrafos: [
      `Ya son las <b>${hora}</b> y todavía no ha registrado la pastilla de hoy.`,
      'Recuérdale con cariño 💕',
    ],
  });
}
