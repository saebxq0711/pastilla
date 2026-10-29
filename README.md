# Pastillita

Web para registrar la pastilla anticonceptiva todos los días, pensada para iPhone.

- **Blister visual** de 28 burbujas: la de hoy brilla, las tomadas quedan con el aluminio roto.
- **Un toque** en "Me la tomé" registra la pastilla de hoy y le llega un correo a él.
- **9:00 pm**: si aún no la ha registrado, le llega una notificación push a ella en el iPhone.
- **9:30 pm**: si sigue sin registrarla, le llega una alerta a él por correo (y otra push a ella).
- **Historial** con los días tomados, no tomados y de descanso. Tocando un día pasado se corrige.
- PIN de acceso: **0711** (teclado numérico, se pide una sola vez por dispositivo).
- Blister de **28 días** o de **21 + 7** (los días de descanso no generan avisos ni rompen la racha).
- Funciona como app en la pantalla de inicio del iPhone (Compartir → *Agregar a inicio*).

Sin framework: HTML, CSS y JS puro en `public/`, y funciones de Vercel en `api/`.

## Cómo funciona

| Pieza | Dónde |
|---|---|
| Página y API (`/api/*`) | Vercel |
| Base de datos (3 tablas pequeñas) | Supabase (PostgreSQL) |
| Avisos a la hora exacta | `pg_cron` de Supabase → llama a `/api/cron` |
| Respaldo de los avisos | Cron de Vercel a las 10 pm (por si `pg_cron` falla) |
| Correos | Gmail con contraseña de aplicación, o Resend con dominio propio |

El cron de Vercel en el plan gratis puede caer en cualquier minuto de la hora, por eso las horas exactas
las dispara `pg_cron`. `/api/cron` no repite correos aunque lo llamen varias veces (tabla `avisos`).

## Publicarlo

### 1. Supabase
1. Crea un proyecto (región São Paulo).
2. *SQL Editor* → pega y ejecuta [`db/schema.sql`](db/schema.sql).
3. Copia la cadena del **Transaction pooler** (puerto 6543) para Vercel.

### 2. Avisos
- **Correos a él:** Resend con el remitente genérico `onboarding@resend.dev`. Resend solo entrega
  ese remitente al dueño de la cuenta, por eso `CORREO_EL` es el Gmail de esa cuenta.
  Con un dominio propio verificado se puede cambiar `MAIL_FROM` y escribir a cualquier correo
  (incluido `CORREO_ELLA`). También sirve Gmail SMTP (`SMTP_USER` / `SMTP_PASS`).
- **Recordatorio a ella:** notificación push (Web Push, claves `VAPID_PUBLIC` / `VAPID_PRIVATE`).
  En iPhone funciona con la app agregada a la pantalla de inicio (iOS 16.4+); la app muestra
  cómo hacerlo y el botón *Activar*.

### 3. Vercel
1. *Add New → Project* → importa el repo `pastilla`. No requiere build.
2. Variables de entorno (ver [`.env.example`](.env.example)):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Cadena pooler de Supabase (6543) |
   | `APP_PIN` | El PIN que ella escribe una vez |
   | `SESSION_SECRET` | Cadena aleatoria de 64+ caracteres |
   | `CRON_SECRET` | Otra cadena aleatoria |
   | `CORREO_EL` / `CORREO_ELLA` | Los dos correos |
   | `APP_URL` | La URL final, ej. `https://pastilla.vercel.app` |
   | `SMTP_USER` / `SMTP_PASS` | Gmail + contraseña de aplicación |

3. Deploy.

### 4. Avisos a las 9:00 y 9:30 pm
`npm run db:init -- --cron` (con la cadena 5432) crea los jobs de `pg_cron`. Quedan inactivos hasta
guardar la URL de la app y el `CRON_SECRET`:

```sql
update privado.cron_config set url = 'https://TU-APP.vercel.app', secreto = 'TU_CRON_SECRET';
```

Para probar sin esperar:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/cron
```

### 5. En el iPhone de ella
Abrir la URL en Safari → *Compartir → Agregar a inicio* → abrir desde el ícono → PIN 0711 →
tocar *Activar* en la tarjeta del recordatorio y aceptar las notificaciones.

## Desarrollo local

```bash
docker run -d --name pastillita-db -e POSTGRES_PASSWORD=local -e POSTGRES_DB=pastillita -p 5440:5432 postgres:17-alpine
cp .env.example .env   # DATABASE_URL=postgresql://postgres:local@localhost:5440/pastillita y MAIL_MODO=log
npm install
npm run db:init
npm run dev            # http://localhost:3000
```

Con `MAIL_MODO=log` los correos se imprimen en la consola en vez de enviarse.
