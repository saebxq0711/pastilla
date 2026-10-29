import postgres from 'postgres';

let sql;

/**
 * Una sola conexión por instancia, por el pooler de Supabase en modo SESIÓN (puerto 5432).
 * El modo transacción (6543) reparte las consultas que viajan juntas por la misma conexión
 * entre conexiones distintas del servidor y devuelve las respuestas cruzadas o se cuelga;
 * postgres.js manda juntas las consultas en paralelo (y Baileys hace muchas). Por eso, si la
 * URL trae el 6543, se cambia al 5432 del mismo pooler.
 */
export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    sql = postgres(url.replace(/(\.pooler\.supabase\.com):6543\b/, '$1:5432'), {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: local ? false : 'require',
    });
  }
  return sql;
}

export async function leerAjustes() {
  const [a] = await db()`
    select to_char(inicio_blister, 'YYYY-MM-DD') as "inicioBlister",
           to_char(inicio_registro, 'YYYY-MM-DD') as "inicioRegistro"
    from ajustes where id = 1`;
  return a;
}

export async function leerTomas() {
  return db()`
    select to_char(fecha, 'YYYY-MM-DD') as fecha,
           to_char(tomada_en at time zone 'America/Bogota', 'HH24:MI') as hora,
           registrada_tarde as tarde
    from tomas order by fecha`;
}
