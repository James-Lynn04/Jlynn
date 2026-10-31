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
    // If none matches: TCL shows how to cast to its built-in Chromecast. Samsung asks once for the HDMI port and remembers it.
    { key: 'cast', name: 'Chromecast', type: 'cast', input: /chromecast/i, device: 'Chromecast' },
    { key: 'xbox', name: 'Xbox', type: 'input', device: 'Xbox', tvs: ['tizen'] }
  ],

  // NFL Sundays on the Samsung: the page turns navy and silver, shows your team's game and the day's schedule,
  // and the Live TV line becomes "Watch the game". Live scores come from ESPN when the TV is online.
  gameday: {
    team: 'DAL',              // ESPN team code
    teamName: 'Dallas Cowboys',
    watch: 'livetv',          // dock line that opens the game
    days: [0],                // 0 = Sunday. Also on any day the team plays.
    fromHour: 8,
    months: [9, 10, 11, 12, 1, 2],
    tvs: ['tizen'],
    // Plays once when the homescreen opens on gameday. A web link (needs the TV online) or a file in web/, e.g. 'intro.mp4'.
    intro: 'https://d8j0ntlcm91z4.cloudfront.net/user_3H1a5YWLrp0Ghy2JkwRFN6pMAeR/hf_20261031_045430_ed792f24-b206-4dd1-8cdc-33bd6b5dd36b.mp4'
  },

  // Apps never shown in the All apps drawer (Android package names or Samsung app names).
  hidden: [/^com\.google\.android\.tungsten/, /^io\.jlynn\.tvhome/]
};
