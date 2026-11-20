#!/usr/bin/env bash
set -euo pipefail

SRC="/opt/apps/rf-link-planner/apps/web/dist/"
DEST="/opt/1panel/apps/openresty/openresty/www/sites/rf.andresptr.site/index/"

if [ ! -d "$SRC" ]; then
  echo "Error: Build directory $SRC not found. Run 'npm run build' first." >&2
  exit 1
fi

if [ ! -d "/opt/1panel/apps/openresty/openresty/www/sites/rf.andresptr.site" ]; then
  echo "Error: 1Panel site directory for rf.andresptr.site does not exist yet." >&2
  echo "Create the static website 'rf.andresptr.site' in 1Panel first, then re-run this script." >&2
  exit 1
fi

sudo mkdir -p "$DEST"
sudo rsync -av --delete "$SRC" "$DEST"
echo "Synced LinkSight RF static bundle to $DEST"
