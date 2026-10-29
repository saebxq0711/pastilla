# Pastillita

Web para registrar la pastilla anticonceptiva todos los días, pensada para iPhone.
Todos los avisos llegan por **WhatsApp**: ella no instala nada ni activa nada.

- **Blister visual** de 28 burbujas: la de hoy brilla, las tomadas quedan con el aluminio roto.
- **Un toque** en "Me la tomé" registra la pastilla de hoy y a él le llega un WhatsApp.
- **9:00 pm**: si aún no la ha registrado, les llega un WhatsApp a los dos.
- **9:30 pm**: si sigue sin registrarla, otro WhatsApp a cada uno.
- **Historial** con los días tomados, no tomados y de descanso. Tocando un día pasado se corrige.
- Blister de **28 días** o de **21 + 7** (los días de descanso no generan avisos ni rompen la racha).
- PIN de acceso: **0711** (teclado numérico, se pide una sola vez por dispositivo).

Sin framework: HTML, CSS y JS puro en `public/`, y funciones de Vercel en `api/`.

## Cómo funciona

| Pieza | Dónde |
|---|---|
| Página y API (`/api/*`) | Vercel |
| Base de datos | Supabase (PostgreSQL) |
| Avisos a la hora exacta | `pg_cron` de Supabase → llama a `/api/cron` |
| Respaldo de los avisos | Cron de Vercel a las 10 pm (por si `pg_cron` falla) |
| WhatsApp | Número vinculado como "dispositivo" (Baileys); la sesión vive en `privado.whatsapp_auth` |

No hay servidor encendido: cada aviso se conecta a WhatsApp unos segundos, envía y cierra.
`/api/cron` no repite mensajes aunque lo llamen varias veces (tabla `avisos`).

## Publicarlo

### 1. Supabase
Con la cadena del **Session pooler** (puerto 5432):

```bash
DATABASE_URL="postgresql://…:5432/postgres" node scripts/init-db.mjs --cron
```

Crea las tablas y los dos jobs de `pg_cron`. Los jobs quedan inactivos hasta guardar la URL:

```sql
update privado.cron_config set url = 'https://TU-APP.vercel.app', secreto = 'TU_CRON_SECRET';
```

### 2. WhatsApp (una sola vez)
```bash
npm run whatsapp:vincular     # abre un QR en http://localhost:3005
```
En el celular del número que envía: WhatsApp → *Dispositivos vinculados* → *Vincular un dispositivo*.

Probar: `npm run whatsapp:probar -- 57XXXXXXXXXX`.

- Si ese celular no abre WhatsApp en 14 días, WhatsApp lo desvincula: `npm run whatsapp:vincular -- --forzar`.
- Es vinculación no oficial: WhatsApp podría restringir el número.

### 3. Vercel
Importa el repo y pega las variables de `.env.production` (ver [`.env.example`](.env.example)):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Cadena del Transaction pooler de Supabase (6543) |
| `APP_PIN` | PIN de acceso (0711 si no se define) |
| `SESSION_SECRET` / `CRON_SECRET` | Cadenas aleatorias largas |
| `APP_URL` | La URL final; va en los mensajes de ella |
| `WHATSAPP_ELLA` / `WHATSAPP_EL` | Números con indicativo, ej. `573001234567` |
| `NOMBRE_ELLA` / `NOMBRE_EL` | Nombres para los mensajes de él |
| `TRATO_ELLA` | Cómo se le habla a ella (por defecto "mi amor") |

Para probar el cron sin esperar:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/cron
```

### 4. En el iPhone de ella
Abrir la URL en Safari → PIN 0711. Opcional: *Compartir → Agregar a inicio* para tenerla como app.

## Desarrollo local

```bash
docker run -d --name pastillita-db -e POSTGRES_PASSWORD=local -e POSTGRES_DB=pastillita -p 5440:5432 postgres:17-alpine
cp .env.example .env   # DATABASE_URL=postgresql://postgres:local@localhost:5440/pastillita
npm install
npm run db:init
npm run dev            # http://localhost:3000
```

Sin `WHATSAPP_*` en el `.env` local no sale ningún mensaje.
