# TV Home

A minimal homescreen for two TVs: a TCL Google TV and a Samsung. One shared design, two installers.

![Home](docs/home.jpg)

- Paper: your apps as a list of large type on white. No tiles.
- The selected app turns chestnut with an orange dot. The rest stay faint.
- Press Down past the dock and the list continues with every other app in smaller type.
- One warm sun on the right. It warms through the day and sinks and dims at night.
- Time and date top left. Inputs and Settings top right.
- Typeface: Bricolage Grotesque, bundled in `web/fonts` (SIL Open Font License).
- No ads, no tracking, no network calls. Everything runs on the TV.

| All apps | Chromecast |
|---|---|
| ![All apps](docs/all-apps.jpg) | ![Cast](docs/cast.jpg) |

## How it works

| Folder | What it is |
|---|---|
| `web/` | The homescreen UI. HTML, CSS, JS. Both TVs run this. |
| `web/config.js` | Dock apps, clock format, hidden apps. Edit this. |
| `android/` | TCL launcher. A full-screen WebView with a bridge to list and open apps and switch HDMI inputs. |
| `tizen/` | Samsung app manifest and icon. |
| `tools/` | Install and restore scripts. |
| `PROMPT.md` | Prompts to run in Claude Code at home. |

## Install

The easy route: open Claude Code on a computer on your home Wi-Fi, inside this repo, and paste a prompt from [PROMPT.md](PROMPT.md).

By hand:

```bash
# TCL: turn on USB debugging on the TV first (see PROMPT.md)
tools/tcl-install.sh 192.168.1.50
tools/tcl-restore.sh 192.168.1.50            # undo

# Samsung: turn on Developer mode on the TV first (see PROMPT.md)
tools/samsung-install.sh 192.168.1.60 MyCertProfile
```

Preview on a laptop: open `web/index.html` in Chrome. Up and Down move, Enter opens, Esc goes back.

## What each TV allows

| | TCL (Google TV) | Samsung (Tizen) |
|---|---|---|
| Replaces the Home button | Yes | No. Samsung locks Smart Hub. It installs as an app; pin it first in the Apps row. |
| Removes the ad rows | Yes, by disabling the stock home (reversible) | No |
| Chromecast line | Opens a Chromecast HDMI input if one exists, else shows how to cast to the TV's built-in Chromecast | Shows the Chromecast HDMI input full screen (depends on the model allowing it). Otherwise opens the input list. Back returns home. |
| Settings button | Opens system settings | Hidden. Samsung blocks it. Use the remote. |
| Supported models | Android 7+ | 2019 or newer |

## Change the dock

Edit `web/config.js`, then run the install script again. Android package names for common apps:

| App | Package |
|---|---|
| YouTube | `com.google.android.youtube.tv` |
| Apple TV | `com.apple.atve.androidtv.appletv` |
| Plex | `com.plexapp.android` |

Name your Chromecast's HDMI input "Chromecast" in the TV's input settings and the Chromecast line finds it.

## Credits

Approach informed by open-source projects on GitHub: Gathin23/cleanyourtv, simbasjungles/free-my-tv and mihirgupta0900/tv-home. No code copied.
