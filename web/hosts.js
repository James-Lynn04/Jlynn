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
    inputs: () => Promise.resolve([{ id: 'hdmi1', name: 'HDMI 1' }, { id: 'hdmi2', name: 'HDMI 2' }, { id: 'tv', name: 'Live TV' }]),
    openInput: (input) => sheet('Switching to ' + input.name, 'On the TV this changes the source.'),
    settings: () => sheet('Settings', 'On the TV this opens system settings.'),
    deviceName: () => 'Living Room TV',
    storeFor: (item) => ({ title: item.name + ' is not installed', body: 'On the TV this opens the store.' }),
    back: () => false
  };
}

function pickHost() {
  if (window.TVHost) return androidHost(window.TVHost);
  if (window.tizen && window.tizen.application) return tizenHost(window.tizen);
  return demoHost();
}
