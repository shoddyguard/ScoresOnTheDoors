#!/bin/sh
set -e

# Allow the container to run as an arbitrary UID/GID.
# Set PUID and/or PGID at runtime to override the defaults (both 1001).
PUID=${PUID:-1001}
PGID=${PGID:-1001}

CURRENT_UID=$(id -u nextjs)
CURRENT_GID=$(getent group nodejs | cut -d: -f3)

if [ "$PGID" != "$CURRENT_GID" ]; then
    groupmod -g "$PGID" nodejs
fi

if [ "$PUID" != "$CURRENT_UID" ]; then
    usermod -u "$PUID" nextjs
fi

chown nextjs:nodejs /data

echo "Running database migrations..."
gosu nextjs npx prisma db push --skip-generate

echo "Starting application..."
exec gosu nextjs node server.js
