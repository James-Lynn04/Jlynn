#!/usr/bin/env bash
# Puts the TCL / Google TV back the way tools/tcl-install.sh found it.
# Usage: tools/tcl-restore.sh <TV_IP> [--uninstall]
set -euo pipefail
IP="${1:?Usage: tools/tcl-restore.sh <TV_IP> [--uninstall]}"
TV="$IP:5555"
BACKUP="$(cd "$(dirname "$0")/.." && pwd)/backup/$IP"
sh_tv() { adb -s "$TV" shell "$@"; }

adb connect "$TV" >/dev/null
adb -s "$TV" wait-for-device

if [ -f "$BACKUP/disabled-by-us.txt" ]; then
  while read -r PKG; do
    [ -n "$PKG" ] && sh_tv pm enable "$PKG" >/dev/null && echo "Re-enabled $PKG"
  done < "$BACKUP/disabled-by-us.txt"
fi

HOME_BEFORE="$(cat "$BACKUP/home-before.txt" 2>/dev/null || true)"
case "$HOME_BEFORE" in
  */*) sh_tv cmd package set-home-activity "$HOME_BEFORE" >/dev/null && echo "Home set back to $HOME_BEFORE" ;;
esac

if [ "${2:-}" = "--uninstall" ]; then adb -s "$TV" uninstall io.jlynn.tvhome; fi
sh_tv input keyevent KEYCODE_HOME
echo "Restored."
