#!/bin/sh
# Grounded runs as the unprivileged "node" user (uid 1000), not root.
#
# When the container starts as root (the default), this script first makes the
# data folder belong to node, so folders created by Docker or by older Grounded
# versions (which ran as root) keep working, then drops privileges for good.
# If you start the container as another user (compose `user:`), it skips that
# step and just runs the app; that user then needs write access to the folder.
set -e

if [ "$(id -u)" = "0" ]; then
  data_dir="$(dirname "${DB_PATH:-/app/data/grounded.db}")"
  mkdir -p "$data_dir"
  chown -R node:node "$data_dir"
  exec su-exec node "$@"
fi

exec "$@"
