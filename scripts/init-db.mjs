// Crea las tablas en la base de DATABASE_URL (usa la conexión directa o el session pooler, 5432).
// Con --cron también programa los avisos de las 9:00 y 9:30 pm (solo en Supabase).
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { ssl: local ? false : 'require', max: 1, onnotice: () => {} });
const leer = (f) => readFile(new URL(`../db/${f}`, import.meta.url), 'utf8');

await sql.unsafe(await leer('schema.sql'));
console.log('Tablas listas');

if (process.argv.includes('--cron')) {
  await sql.unsafe(await leer('cron.sql'));
  const jobs = await sql`select jobname, schedule from cron.job where jobname like 'pastillita-%' order by jobname`;
  console.log('Cron programado:', jobs.map((j) => `${j.jobname} (${j.schedule})`).join(', '));
}

await sql.end();
