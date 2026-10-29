// Crea las tablas en la base de DATABASE_URL (usa la conexión directa, puerto 5432).
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { ssl: local ? false : 'require', max: 1 });

await sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
console.log('Tablas listas ✔');
await sql.end();
