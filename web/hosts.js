// One adapter per TV platform. app.js only talks to the object returned by pickHost().
// Every host exposes:
//   kind, caps {settings}, apps() -> Promise<[{id, name, icon}]>, launch(app),
//   inputs() -> Promise<[{id, name}]>, openInput(input), settings(), deviceName(),
//   storeFor(dockItem), back() -> true if the host handled Back.

function androidHost(bridge) {
  const parse = (s) => { try { return JSON.parse(s) || []; } catch (e) { return []; } };
  return {
    kind: 'android',
    caps: { settings: true },
    apps: () => Promise.resolve(parse(bridge.apps()).map((a) => ({
      id: a.id, name: a.name, icon: 'https://app.local/icon/' + encodeURIComponent(a.id)
    }))),
    launch: (app) => bridge.launch(app.id),
    inputs: () => Promise.resolve(parse(bridge.inputs())),
    openInput: (input) => bridge.openInput(input.id),
    settings: () => bridge.settings(),
    deviceName: () => bridge.deviceName(),
    storeFor: (item) => { bridge.playStore(item.android[0]); return null; },
    back: () => false
  };
}

function tizenHost(tizen) {
  const W = window.innerWidth, H = window.innerHeight;
  let passthrough = false;
  const sourceName = (s) => (s.type === 'TV' ? 'TV' : s.type.replace('_', ' ') + ' ' + (s.number || ''));
  const host = {
    kind: 'tizen',
    caps: { settings: false },
    apps: () => new Promise((resolve) => {
      try {
        tizen.application.getAppsInfo((list) => resolve(list
          .filter((a) => a.show)
          .map((a) => ({ id: a.id, name: a.name, icon: a.iconPath }))), () => resolve([]));
      } catch (e) { resolve([]); }
    }),
    launch: (app) => tizen.application.launch(app.id, null, () => {}),
    inputs: () => new Promise((resolve) => {
      try {
        tizen.systeminfo.getPropertyValue('VIDEOSOURCE', (v) => resolve((v.connected || []).map((s) => ({
          id: s.type + (s.number || ''), name: sourceName(s), src: s
        }))), () => resolve([]));
      } catch (e) { resolve([]); }
    }),
    // Shows the HDMI picture full screen behind a transparent page. Back returns home.
    openInput: (input) => {
      try {
        tizen.tvwindow.setSource(input.src, () => {
          tizen.tvwindow.show(() => {
            passthrough = true;
            document.body.classList.add('passthrough');
          }, null, ['0px', '0px', W + 'px', H + 'px'], 'MAIN');
        }, null, 'MAIN');
      } catch (e) { /* tv.window not available on this model */ }
    },
    settings: () => {},
    deviceName: () => 'this TV',
    storeFor: (item) => ({
      title: item.name + ' is not installed',
      body: 'Open <b>Apps</b> on the Samsung home and search for <b>' + item.name + '</b>.'
    }),
    back: () => {
      if (passthrough) {
        try { tizen.tvwindow.hide(() => {}, null, 'MAIN'); } catch (e) {}
        passthrough = false;
        document.body.classList.remove('passthrough');
        return true;
      }
      try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
      return true;
    }
  };
  return host;
}

// Browser preview, so the design can be checked on a laptop.
function demoHost() {
  const names = ['Netflix', 'Disney+', 'Prime Video', 'Spotify', 'YouTube', 'Plex', 'Apple TV', 'Max',
    'Crave', 'CBC Gem', 'Twitch', 'Photos', 'Music', 'Play Store', 'Live TV', 'Files', 'Browser'];
  const pkg = {
    'Netflix': 'com.netflix.ninja', 'Disney+': 'com.disney.disneyplus',
    'Prime Video': 'com.amazon.amazonvideo.livingroom', 'Spotify': 'com.spotify.tv.android'
  };
  const sheet = (title, body) => window.showSheet && window.showSheet(title, body, []);
  return {
    kind: 'demo',
    caps: { settings: true },
    apps: () => Promise.resolve(names.map((n) => ({ id: pkg[n] || 'demo.' + n.toLowerCase().replace(/\W/g, ''), name: n }))),
    launch: (app) => sheet('Opening ' + app.name, 'On the TV this opens the app.'),
    inputs: () => Promise.resolve([{ id: 'hdmi1', name: 'HDMI 1' }, { id: 'hdmi2', name: 'HDMI 2' }, { id: 'hdmi3', name: 'HDMI 3' }, { id: 'hdmi4', name: 'HDMI 4' }]),
    openInput: (input) => sheet('Switching to ' + input.name, 'On the TV this changes the source.'),
    settings: () => sheet('Settings', 'On the TV this opens system settings.'),
    deviceName: () => 'Living Room TV',
    storeFor: (item) => ({ title: item.name + ' is not installed', body: 'On the TV this opens the store.' }),
    // Four of the November 1, 2026 games, for the preview only. The TV loads every game from ESPN.
    schedule: () => {
      // Records (ARI 2-5, DAL 3-4) and odds found online on Oct 31: DraftKings ARI +230 / DAL -285, DAL -6, O/U 54.5.
      // For the other games only the favorite was found, so no moneyline is shown.
      const g = (utc, away, home, network, venue, mine, odds) => ({
        start: new Date(utc), state: 'pre', detail: '', network, venue, mine: !!mine, odds: odds || null,
        away: { abbr: away[0], name: away[1], score: '0', record: away[2] || '' }, home: { abbr: home[0], name: home[1], score: '0', record: home[2] || '' }
      });
      return Promise.resolve({ week: 8, games: [
        g('2026-11-01T18:00:00Z', ['ARI', 'Cardinals', '2-5'], ['DAL', 'Cowboys', '3-4'], 'FOX', 'AT&T Stadium', true, { fav: 'DAL', home: -285, away: 230, details: 'DAL -6', total: 54.5 }),
        g('2026-11-01T18:00:00Z', ['BAL', 'Ravens'], ['BUF', 'Bills'], 'CBS', 'Highmark Stadium', false, { fav: 'BUF', home: null, away: null }),
        g('2026-11-01T21:25:00Z', ['NE', 'Patriots'], ['MIA', 'Dolphins'], 'CBS', 'Hard Rock Stadium'),
        g('2026-11-02T01:20:00Z', ['PHI', 'Eagles'], ['WSH', 'Commanders'], 'NBC', 'Northwest Stadium', false, { fav: 'WSH', home: null, away: null })
      ] });
    },
    // The Cowboys' next game for the preview countdown: vs Cardinals, Nov 1 2026 at noon Central.
    nextGame: () => Promise.resolve({ start: new Date('2026-11-01T18:00:00Z'), state: 'pre', opp: 'ARI', home: true }),
    back: () => false
  };
}

function pickHost() {
  if (window.TVHost) return androidHost(window.TVHost);
  if (window.tizen && window.tizen.application) return tizenHost(window.tizen);
  return demoHost();
}
