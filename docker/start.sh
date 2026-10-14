#!/bin/sh
set -e
npx prisma migrate deploy
if [ "$SEED_DEMO" = "true" ]; then
  npx tsx prisma/seed.ts
fi
if [ "$1" = "worker" ]; then
  exec npx tsx src/worker/main.ts
fi
exec npm start
