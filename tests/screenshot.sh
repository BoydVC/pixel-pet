#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PIXEL_PET_PORT:-4304}"
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
mkdir -p screenshots dist
if [[ ! -f dist/pixel-pet.html ]]; then python3 build.py; fi
if ! ss -ltn | grep -q "127.0.0.1:$PORT "; then
  nohup python3 server.py > /tmp/pixel-pet-$PORT.log 2>&1 &
  sleep 1
fi
shot() {
  local url="$1" out="$2" size="$3"; shift 3 || true
  local prof; prof="$(mktemp -d /tmp/ppshot.XXXX)"
  timeout 45 "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --run-all-compositor-stages-before-draw --virtual-time-budget=28000 \
    --window-size="$size" --user-data-dir="$prof" --screenshot="$out" "$@" "$url" >/dev/null 2>&1 || true
  rm -rf "$prof"
  if [[ -f "$out" ]]; then echo "  $out ($(wc -c < "$out") bytes)"; else echo "  FAIL $out"; fi
}
U="http://127.0.0.1:$PORT"
# demo=1 auto-loads a sample hatched pet for pretty shots
shot "file://$PWD/dist/pixel-pet.html#home?demo=1" screenshots/00-best-home.png 1440,1100
# hash parsing: use #demo-home style — app supports ?demo=1 in search OR hash contains demo
shot "$U/?demo=1#home" screenshots/00-desktop-home.png 1440,1000
shot "$U/?demo=1#closet" screenshots/01-closet.png 1440,1100
shot "$U/?demo=1#game" screenshots/02-game.png 1440,1000
shot "$U/?demo=1#journal" screenshots/03-journal.png 1440,1000
shot "$U/?demo=1#about" screenshots/04-about.png 1440,1000
shot "$U/?demo=1#home" screenshots/05-phone.png 390,844 --user-agent="Mozilla/5.0 (iPhone)"
shot "$U/#home" screenshots/06-hatch.png 1440,1000
echo "screenshots done"
