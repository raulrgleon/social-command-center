# Mesa

Mesa es un escritorio para redactar una publicación, conservar una versión independiente por red y distribuirla solo por las vías oficiales de cada plataforma. Si una red no permite publicación automática, Mesa no finge un envío: deja el texto listo para copiar y los archivos que hay que subir a mano.

La demostración local funciona sin claves de Facebook, Instagram, X ni ningún otro proveedor. Las cuentas de demostración no publican fuera de la aplicación.

## Arquitectura

- Next.js (App Router), React y TypeScript.
- PostgreSQL con Prisma 7 y el adaptador `pg`. La URL de la base vive en `prisma.config.ts`, no en el esquema.
- Sesiones propias: contraseña con Argon2id, cookie `mesa_session` HttpOnly y el token guardado solo como hash SHA-256.
- Tokens de redes y claves de IA cifrados con AES-256-GCM en el servidor. El navegador no los recibe.
- Un adaptador por plataforma, con el mismo contrato de publicación, listado y métricas.
- La programación se reclama en PostgreSQL con `FOR UPDATE SKIP LOCKED`. Redis y BullMQ son opcionales y no sustituyen esa cola.
- Multimedia en disco local (`storage/`) o en un almacén compatible con S3.

## Puesta en marcha local

Hace falta Node.js 22 o superior. No hace falta Docker ni un Postgres instalado: `npm run dev` arranca un Postgres embebido en el puerto 54329, aplica las migraciones y carga la demostración.

```bash
npm install
npm run dev
```

La primera ejecución crea `.env` (no se sube a git) con una clave de cifrado y un secreto de cron aleatorios. Abre http://localhost:3000.

Demostración:

- Correo: `demo@mesa.local`
- Contraseña: `mesa-demo-2026`

Esa contraseña solo existe en el entorno local. En producción la semilla no corre salvo que `SEED_DEMO=true` y definas `DEMO_PASSWORD`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Postgres embebido, migraciones, semilla y Next en desarrollo |
| `npm run build` | Compila la aplicación |
| `npm start` | Sirve la compilación |
| `npm test` | Pruebas de contadores, versiones, reintentos y adaptadores |
| `npm run lint` | ESLint |
| `npm run worker` | Proceso que reclama publicaciones vencidas |
| `npm run db:generate` | Genera el cliente de Prisma |
| `npm run db:migrate` | Crea una migración en desarrollo |
| `npm run db:deploy` | Aplica migraciones ya creadas |
| `npm run db:seed` | Carga la redacción de demostración |

## Variables de entorno

La lista completa, sin secretos, está en `.env.example`. Las imprescindibles:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Postgres. En Compose apunta al servicio `postgres`. |
| `TOKEN_ENCRYPTION_KEY` | 64 caracteres hexadecimales. Cifra tokens y la clave de IA. |
| `APP_URL` | URL pública. Se usa en OAuth y en los metadatos. |
| `CRON_SECRET` | Protege `POST /api/cron/publish` si un programador externo llama al proceso. |
| `REDIS_URL` | Opcional. Activa un worker de BullMQ además del reclamado en Postgres. |
| `DISABLE_INPROCESS_WORKER` | `true` en el servicio web de producción, para que solo el worker reclame envíos. |
| `TRUST_PROXY` | `true` detrás de Coolify o nginx, para leer la IP reenviada. |
| `ENABLE_HSTS` | `true` solo cuando el sitio ya se sirve por HTTPS. |
| `SEED_DEMO` | `false` en producción, salvo que quieras la redacción de ejemplo. |
| `OPENAI_API_KEY` | Opcional. Sin ella, el asistente local sigue disponible y se identifica como tal. |
| `S3_*` | Opcional. Sin ellas, los archivos se guardan en `storage/`. Instagram y Pinterest necesitan `S3_PUBLIC_BASE_URL` para publicar imágenes. |

Las claves `FACEBOOK_APP_ID`, `X_CLIENT_ID` y el resto aparecen vacías. Una red no se marca conectada hasta que su autorización oficial termina y la API responde.

## Docker

```bash
cp .env.example .env
# Rellena TOKEN_ENCRYPTION_KEY (openssl rand -hex 32) y CRON_SECRET.
docker compose up --build
```

Compose levanta Postgres 17, Redis 7, MinIO, la aplicación en el puerto 3000 y un worker. La contraseña de Postgres del ejemplo es solo para ese archivo local. Cámbiala antes de exponer el servidor.

## Producción

La copia pública está en https://mesa.dnet.llc. Corre en el servidor de DNET, solo en `127.0.0.1:3240`, y entra por el túnel ya existente. Postgres y Redis no se publican al exterior. La configuración vive en `/data/mesa/runtime.env` y no está en git.

`docker-compose.server.yml` es el archivo de ese servidor. No usa el Compose de ejemplo.

## Coolify

Los pasos están en [docs/COOLIFY.md](docs/COOLIFY.md).

## Integraciones

Qué red publica de verdad, qué permisos pide y qué queda en flujo manual está en [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md).

## Copias de seguridad

- Volumen de Postgres (`pg` en Compose, o `data/pg` en local). Un `pg_dump` diario es suficiente para el historial y las cuentas.
- Volumen o carpeta de multimedia (`minio` o `storage/`).
- `TOKEN_ENCRYPTION_KEY`. Sin esa clave, los tokens cifrados no se pueden leer. No está en la base y no se regenera sola.
- Redis no guarda el estado de las publicaciones. Se puede perder sin restaurarlo.

## Estructura

```
prisma/            esquema y migraciones
src/app/           páginas y rutas de API
src/components/    escritorio, editor, calendario, vistas previas
src/lib/adapters/  un adaptador por red
src/lib/platforms/ catálogo, límites y validación
src/lib/publish/   envío, idempotencia y reintentos
src/lib/ai/        asistente local y proveedor configurado
src/worker/        reclamado de publicaciones programadas
docker/            arranque de migraciones y worker
docs/              Coolify e integraciones
tests/             pruebas de dominio y adaptadores
```

## Qué no hace Mesa

No inventa estadísticas. No marca una publicación como enviada si la API no devolvió un identificador. No reintenta un envío cuyo resultado quedó ambiguo. No publica con la IA: el texto generado se queda en el editor hasta que la persona lo envía.
