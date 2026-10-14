# Despliegue en Coolify

Mesa se despliega como un Compose en un servidor Ubuntu. Coolify construye la imagen, inyecta las variables y termina TLS.

## Antes de crear el servicio

1. Crea el recurso desde este repositorio, tipo Docker Compose, usando el `docker-compose.yml` de la raíz.
2. Genera los secretos en el servidor, no en el repositorio:

```bash
openssl rand -hex 32    # TOKEN_ENCRYPTION_KEY
openssl rand -hex 24    # CRON_SECRET
```

3. En Coolify, define al menos:

- `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- `APP_URL` con la URL pública HTTPS, sin barra final
- `TRUST_PROXY=true`
- `ENABLE_HSTS=true` solo cuando el certificado ya responde
- `SEED_DEMO=false`
- `DISABLE_INPROCESS_WORKER=true`

`DATABASE_URL` y `REDIS_URL` del Compose apuntan a los servicios internos. No hace falta sustituirlas si Postgres y Redis se llaman `postgres` y `redis`.

4. Cambia `POSTGRES_PASSWORD` y `MINIO_ROOT_PASSWORD` del Compose antes de exponer el nodo. Los valores del archivo son de ejemplo.

## Arranque

La imagen ejecuta `prisma migrate deploy` y luego `npm start`. El servicio `worker` usa el mismo script con el argumento `worker` y es quien reclama las publicaciones programadas. No pongas `DISABLE_INPROCESS_WORKER=false` en la aplicación si el worker ya está en marcha: los dos pueden reclamar, y el bloqueo de Postgres evita el doble envío, pero no hace falta correr los dos.

La semilla de demostración no corre con `SEED_DEMO=false`. Crea la primera cuenta en `/registro`.

## Comprobaciones

- `GET /api/health` debe responder que la base acepta `SELECT 1`.
- Entra, crea un borrador, recarga y comprueba que sigue ahí.
- Programa una pieza y confirma que aparece en el calendario. Sin cuentas reales, el envío queda en manual o pendiente de autorización, no como publicado.
- Conecta una red solo después de pegar sus variables y de que el portal de esa red acepte la URL de retorno `{APP_URL}/api/integrations/{plataforma}/callback`.

## Copias

Programa un `pg_dump` del volumen de Postgres. Copia también el volumen de MinIO si subes imágenes. Guarda `TOKEN_ENCRYPTION_KEY` fuera del servidor: sin ella no se descifran las cuentas ya conectadas.

## Lo que Coolify no configura solo

Las apps de Meta, Google, X, LinkedIn, TikTok, Pinterest, Reddit, Tumblr, VK y WeChat se crean en el portal de cada empresa. Los permisos y la revisión los concede esa plataforma. Hasta entonces, la red sigue visible y el flujo manual funciona. El detalle está en [INTEGRACIONES.md](INTEGRACIONES.md).
