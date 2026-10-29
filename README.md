# Pastillita 💊

Web para registrar la pastilla anticonceptiva todos los días, pensada para iPhone.

- **Un toque** en el botón grande registra la pastilla de hoy y le llega un correo a él.
- **9:00 pm**: si aún no la ha registrado, le llega un recordatorio a ella.
- **9:30 pm**: si sigue sin registrarla, le llega una alerta a él.
- **Calendario** con los días tomados, no tomados y de descanso. Tocando un día pasado se corrige.
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

### 2. Correo
**Gmail (recomendado si no tienes dominio):**
1. En la cuenta de Gmail que enviará los correos, activa la verificación en 2 pasos.
2. Entra a <https://myaccount.google.com/apppasswords> y crea una contraseña de aplicación.
3. Usa ese correo en `SMTP_USER` y la contraseña de 16 letras en `SMTP_PASS`.

**Resend:** necesita un dominio verificado (el remitente `onboarding@resend.dev` solo entrega
al dueño de la cuenta). Usa `RESEND_API_KEY` y `MAIL_FROM`.

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
En Supabase → *SQL Editor*, abre [`db/cron.sql`](db/cron.sql), cambia `TU-APP` y `TU_CRON_SECRET`
y ejecútalo. Para probar sin esperar:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/cron
```

### 5. En el iPhone de ella
Abrir la URL en Safari → escribir el PIN → *Compartir → Agregar a inicio*.
Al abrirla desde el ícono pide el PIN una vez más (iOS guarda la sesión aparte) y queda guardado.

## Desarrollo local

```bash
docker run -d --name pastillita-db -e POSTGRES_PASSWORD=local -e POSTGRES_DB=pastillita -p 5440:5432 postgres:17-alpine
cp .env.example .env   # DATABASE_URL=postgresql://postgres:local@localhost:5440/pastillita y MAIL_MODO=log
npm install
npm run db:init
npm run dev            # http://localhost:3000
```

Con `MAIL_MODO=log` los correos se imprimen en la consola en vez de enviarse.
