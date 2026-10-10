#!/bin/sh
set -e
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  pnpm prisma migrate deploy
else
  echo "No migrations yet, skipping migrate deploy."
fi
exec pnpm start
