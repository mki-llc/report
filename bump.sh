#!/bin/sh
# Usage: ./bump.sh 38  -> sets the app version everywhere (asset ?v=, APP_V, version.json)
set -e
V="$1"; cd "$(dirname "$0")/app"
sed -i -E "s/\?v=[0-9]+\"/?v=$V\"/g; s/window.APP_V = '[0-9]+'/window.APP_V = '$V'/" index.html
printf '{"v":"%s"}\n' "$V" > version.json
grep -c "v=$V\"" index.html
