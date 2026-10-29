import postgres from 'postgres';

let sql;

/**
 * Una sola conexión por instancia. `prepare: false` porque en Vercel se usa el
 * pooler de Supabase (puerto 6543, modo transacción), que no admite prepared statements.
 */
export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    sql = postgres(url, {
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
    select blister,
           to_char(inicio_blister, 'YYYY-MM-DD') as "inicioBlister",
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
