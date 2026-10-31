# Prompt for Claude Code

Run Claude Code on a computer on the same Wi-Fi as your TVs, inside this repo, and paste one of these.
The cloud session that built this repo cannot reach your home network, so this step runs at home.

## TCL (Google TV / Android TV)

First, on the TV: Settings > System > About > press OK on "Android TV OS build" 7 times.
Then Settings > System > Developer options > turn on USB debugging (and Network debugging if listed).

```text
My TCL Google TV is on my Wi-Fi. Find it, connect over ADB, and install the homescreen in this repo
with tools/tcl-install.sh. Install adb, a JDK 17 and the Android SDK command-line tools first if I
don't have them. Back up before changing anything and ask me before disabling any package.

After the launcher works, list the manufacturer ad, telemetry and recommendation packages on the TV
(TCL and Google), explain each in one line, and disable only the ones I approve with
pm disable-user --user 0. Never uninstall. Add every package you disable to
backup/<TV_IP>/disabled-by-us.txt so tools/tcl-restore.sh undoes it.

Check each step with a screenshot from the TV (adb exec-out screencap -p). Test the Home button from
inside Netflix. Gotchas: on Google TV, com.google.android.tungsten.setupwraith hijacks Home unless
disabled. If macOS blocks adb on the local network, use the adb-shell Python package instead.
```

## Samsung (Tizen)

First, on the TV: open Apps, press 1 2 3 4 5 on the remote, turn Developer mode ON, enter this
computer's IP address, then restart the TV.

```text
Install the homescreen in this repo on my Samsung TV with tools/samsung-install.sh. Install Tizen
Studio CLI with the TV extension if I don't have it, and walk me through making a Samsung
certificate profile in Certificate Manager. Find the TV's IP on my Wi-Fi. Ask before changing
anything on the TV.
```
