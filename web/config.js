// Edit this file to change the homescreen. Both TVs read it.
window.HOME_CONFIG = {
  // true = 9:41 PM, false = 21:41
  clock12h: true,

  // The dock, top to bottom. `android` lists package names to try in order.
  // `tizen` is matched against the app names on a Samsung TV.
  dock: [
    // HDMI devices. `device` names what is plugged in. The first press asks for the port.
    // `tvs: ['tizen']` shows the line on the Samsung only. Use ['android'] for the TCL, or remove for both.
    { key: 'livetv', name: 'Live TV', type: 'input', device: 'Fire Stick', tvs: ['tizen'] },
    { key: 'netflix', name: 'Netflix', android: ['com.netflix.ninja', 'com.netflix.mediaclient'], tizen: /netflix/i },
    { key: 'disney', name: 'Disney+', android: ['com.disney.disneyplus'], tizen: /disney/i },
    { key: 'prime', name: 'Prime Video', android: ['com.amazon.amazonvideo.livingroom', 'com.amazon.avod.thirdpartyclient'], tizen: /prime video|amazon/i },
    { key: 'spotify', name: 'Spotify', android: ['com.spotify.tv.android', 'com.spotify.music'], tizen: /spotify/i },
    // Opens the input whose name matches `input` (a Chromecast on HDMI).
    // If none matches: TCL shows how to cast to its built-in Chromecast, Samsung opens the input list.
    { key: 'cast', name: 'Chromecast', type: 'cast', input: /chromecast/i },
    { key: 'xbox', name: 'Xbox', type: 'input', device: 'Xbox', tvs: ['tizen'] }
  ],

  // Apps never shown in the All apps drawer (Android package names or Samsung app names).
  hidden: [/^com\.google\.android\.tungsten/, /^io\.jlynn\.tvhome/]
};
