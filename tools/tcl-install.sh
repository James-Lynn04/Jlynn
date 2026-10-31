#!/usr/bin/env bash
# Builds the launcher and makes it the home screen on an Android / Google TV (TCL).
# Usage: tools/tcl-install.sh <TV_IP>
# Needs: adb, JDK 17, Android SDK (ANDROID_HOME set, or Android Studio installed).
set -euo pipefail
IP="${1:?Usage: tools/tcl-install.sh <TV_IP>}"
TV="$IP:5555"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="$HERE/backup/$IP"
APP=io.jlynn.tvhome/.HomeActivity
sh_tv() { adb -s "$TV" shell "$@"; }

echo "Connecting to $TV. Accept 'Allow USB debugging?' on the TV if it asks."
adb connect "$TV" >/dev/null
adb -s "$TV" wait-for-device
echo "TV: $(sh_tv getprop ro.product.manufacturer) $(sh_tv getprop ro.product.model), Android $(sh_tv getprop ro.build.version.release)"

mkdir -p "$BACKUP"
if [ ! -f "$BACKUP/home-before.txt" ]; then
  sh_tv cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -n 1 | tr -d '\r' > "$BACKUP/home-before.txt"
  sh_tv pm list packages -d | tr -d '\r' > "$BACKUP/disabled-before.txt"
  : > "$BACKUP/disabled-by-us.txt"
  echo "Backup saved in $BACKUP"
fi

echo "Building the launcher..."
(cd "$HERE/android" && ./gradlew -q assembleRelease)
APK="$HERE/android/app/build/outputs/apk/release/app-release.apk"

echo "Installing..."
adb -s "$TV" install -r "$APK"
sh_tv cmd package set-home-activity "$APP" >/dev/null || true

# Google TV keeps reclaiming the Home button unless its own home and setup app are disabled.
# Disabled, not uninstalled. tools/tcl-restore.sh turns them back on.
for PKG in com.google.android.apps.tv.launcherx com.google.android.tungsten.setupwraith; do
  if sh_tv pm list packages -e | tr -d '\r' | grep -qx "package:$PKG"; then
    read -r -p "Disable $PKG so Home opens the new screen? (reversible) [y/N] " OK
    if [ "${OK:-n}" = "y" ]; then
      sh_tv pm disable-user --user 0 "$PKG" >/dev/null && echo "$PKG" >> "$BACKUP/disabled-by-us.txt"
    fi
  fi
done

sh_tv am force-stop io.jlynn.tvhome
sh_tv am force-stop com.android.tv.settings || true
sh_tv input keyevent KEYCODE_HOME
echo "Done. Press Home on the remote. Undo with: tools/tcl-restore.sh $IP"
