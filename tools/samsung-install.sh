#!/usr/bin/env bash
# Packages the homescreen as a Tizen app and installs it on a Samsung TV.
# Usage: tools/samsung-install.sh <TV_IP> <certificate-profile>
# Needs: Tizen Studio with the TV extension (tizen and sdb on PATH) and a Samsung
# certificate profile made in Tizen Studio's Certificate Manager.
set -euo pipefail
IP="${1:?Usage: tools/samsung-install.sh <TV_IP> <certificate-profile>}"
PROFILE="${2:?Give the certificate profile name from Certificate Manager}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/build/tizen"

rm -rf "$OUT" && mkdir -p "$OUT"
cp "$HERE"/web/* "$OUT"/
cp "$HERE"/tizen/config.xml "$HERE"/tizen/icon.png "$OUT"/

tizen package -t wgt -s "$PROFILE" -- "$OUT"
WGT="$(ls "$OUT"/*.wgt | head -n 1)"

sdb connect "$IP"
TARGET="$(sdb devices | awk 'NR>1 && $1 ~ /'"$IP"'/ {print $3; exit}')"
[ -n "$TARGET" ] || { echo "TV not found. Is Developer Mode on with this computer's IP?"; exit 1; }

tizen install -n "$(basename "$WGT")" -t "$TARGET" -- "$OUT"
tizen run -p JLtvHome01.Home -t "$TARGET"
echo "Installed. On the TV, move 'Home' to the first spot in your Apps row."
