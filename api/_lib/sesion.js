import crypto from 'node:crypto';

const COOKIE = 'pastillita';
const DURACION_S = 400 * 86400; // el máximo que permiten los navegadores

// La firma incluye el PIN: si se cambia el PIN, todas las sesiones caducan.
function firmar(valor) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(`${valor}|${process.env.APP_PIN}`)
    .digest('base64url');
}

function igual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function pinCorrecto(pin) {
  return Boolean(process.env.APP_PIN) && igual(pin, process.env.APP_PIN);
}

export function cookieDeSesion() {
  const vence = Date.now() + DURACION_S * 1000;
  return `${COOKIE}=${vence}.${firmar(vence)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACION_S}`;
}

export function haySesion(req) {
  const cookies = req.headers.cookie || '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [vence, firma] = m[1].split('.');
  return Number(vence) > Date.now() && igual(firma, firmar(vence));
}
