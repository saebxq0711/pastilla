// Envío de correo. Dos caminos, según qué variables existan:
//   - SMTP_USER + SMTP_PASS  -> Gmail (u otro SMTP) con contraseña de aplicación.
//   - RESEND_API_KEY + MAIL_FROM -> Resend, con un dominio propio verificado.
// MAIL_MODO=log solo imprime el correo en consola (para pruebas locales).
import nodemailer from 'nodemailer';

let transporte;

function remitente() {
  return process.env.MAIL_FROM || `${process.env.MAIL_NOMBRE || 'Pastillita'} <${process.env.SMTP_USER}>`;
}

async function enviar({ para, asunto, html, texto }) {
  if (process.env.MAIL_MODO === 'log') {
    console.log(`\n[correo] para=${para} asunto="${asunto}"\n${texto}\n`);
    return;
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const puerto = Number(process.env.SMTP_PORT || 465);
    transporte ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: puerto,
      secure: puerto === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporte.sendMail({ from: remitente(), to: para, subject: asunto, html, text: texto });
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remitente(), to: [para], subject: asunto, html, text: texto }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return;
  }

  throw new Error('No hay correo configurado (SMTP_USER/SMTP_PASS o RESEND_API_KEY)');
}

const C = { fondo: '#faf5f2', tinta: '#2a0e1c', tinta2: '#6e5562', tinta3: '#a8929d', linea: '#efe6e9', acento: '#b4234f' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** icono: nombre del PNG en /correo (check, campana, alarma, deshacer). */
function plantilla({ icono, etiqueta, titulo, texto, detalles = [], boton }) {
  const url = process.env.APP_URL;
  const img = url
    ? `<img src="${url}/correo/${icono}.png" width="48" height="48" alt="" style="display:block;border:0;margin:0 0 20px">`
    : '';
  const filas = detalles.map(([k, v]) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${C.linea};font:500 14px ${SANS};color:${C.tinta2}">${k}</td>
        <td style="padding:12px 0;border-top:1px solid ${C.linea};font:600 14px ${SANS};color:${C.tinta};text-align:right">${v}</td>
      </tr>`).join('');
  const cta = boton && url
    ? `<a href="${url}" style="display:inline-block;margin-top:24px;padding:15px 28px;border-radius:999px;background:${C.acento};color:#ffffff;font:600 15px ${SANS};text-decoration:none">${boton}</a>`
    : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:32px 14px;background:${C.fondo}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:22px;border:1px solid ${C.linea}">
      <tr><td style="padding:34px 32px 30px">
        ${img}
        <p style="margin:0 0 8px;font:600 11px ${SANS};letter-spacing:2px;text-transform:uppercase;color:${C.tinta3}">${etiqueta}</p>
        <h1 style="margin:0 0 12px;font:600 26px/1.2 ${SERIF};color:${C.tinta}">${titulo}</h1>
        <p style="margin:0;font:400 16px/1.55 ${SANS};color:${C.tinta2}">${texto}</p>
        ${filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">${filas}</table>` : ''}
        ${cta}
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font:500 12px ${SANS};color:${C.tinta3}">Pastillita · aviso automático</p>
  </td></tr></table>
</body></html>`;
}

function correo(para, asunto, contenido) {
  const texto = [
    contenido.titulo,
    contenido.texto.replace(/<[^>]+>/g, ''),
    ...(contenido.detalles || []).map(([k, v]) => `${k}: ${v}`),
    contenido.boton && process.env.APP_URL ? `${contenido.boton}: ${process.env.APP_URL}` : '',
  ].filter(Boolean).join('\n');
  return enviar({ para, asunto, html: plantilla(contenido), texto });
}

const EL = () => process.env.CORREO_EL;
const ELLA = () => process.env.CORREO_ELLA;

export function avisarTomada({ hora, racha, tarde }) {
  return correo(EL(), `Pastilla tomada · ${hora}`, {
    icono: 'check',
    etiqueta: 'Registro de hoy',
    titulo: 'Ya se tomó la pastilla',
    texto: tarde ? 'La registró después de la hora del recordatorio.' : 'Quedó registrada a tiempo.',
    detalles: [['Hora', hora], ['Racha', racha === 1 ? '1 día' : `${racha} días seguidos`]],
  });
}

export function avisarDeshecha() {
  return correo(EL(), 'Registro de hoy deshecho', {
    icono: 'deshacer',
    etiqueta: 'Corrección',
    titulo: 'Se quitó el registro de hoy',
    texto: 'La pastilla de hoy se había marcado por error. Por ahora aparece como no tomada.',
  });
}

export function recordarAElla({ hora }) {
  return correo(ELLA(), 'Es hora de tu pastilla', {
    icono: 'campana',
    etiqueta: `Recordatorio · ${hora}`,
    titulo: 'Es hora de tu pastilla, mi amor',
    texto: 'Tómatela y regístrala con un toque para que quede en tu calendario.',
    boton: 'Registrar mi pastilla',
  });
}

export function alertarAEl({ hora }) {
  return correo(EL(), 'Aún no se ha tomado la pastilla', {
    icono: 'alarma',
    etiqueta: `Alerta · ${hora}`,
    titulo: 'Todavía no la ha registrado',
    texto: `Ya son las <b style="color:${C.tinta}">${hora}</b> y la pastilla de hoy no aparece registrada. Recuérdale con cariño.`,
  });
}
