(function () {
  const cfg = window.HOME_CONFIG;
  const host = pickHost();
  const ROOT = document.body;
  const $ = (id) => document.getElementById(id);
  const KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13 };
  const BACK_KEYS = [10009, 27, 8, 461]; // Samsung, Esc, Backspace, LG

  // zone: 'list' | 'top' | 'sheet'. `items` is every focusable line: the dock first, then all other apps.
  const state = { zone: 'list', i: 0, top: 0, sheet: 0, items: [], sheetRows: [], sheetFrom: 'list' };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- Clock ----------
  function partOfDay(h) {
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }
  function tick() {
    const d = new Date();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    $('time').textContent = cfg.clock12h ? (h % 12 || 12) + ':' + m + (h < 12 ? ' AM' : ' PM') : h + ':' + m;
    $('date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    ROOT.dataset.tod = window.TOD_OVERRIDE || partOfDay(h);
  }

  // ---------- Apps ----------
  function matchDock(item, apps) {
    if (item.type === 'cast') return null;
    if (host.kind === 'android') {
      for (const id of item.android) {
        const hit = apps.find((a) => a.id === id);
        if (hit) return hit;
      }
      return null;
    }
    return apps.find((a) => item.tizen.test(a.name)) || null;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(apps) {
    const used = {};
    const dock = cfg.dock.map((item) => {
      const app = matchDock(item, apps);
      if (app) used[app.id] = true;
      let sub = '';
      if (item.type === 'cast') sub = 'Cast from your phone';
      else if (!app) sub = 'Not installed';
      return { kind: 'dock', item, app, name: item.name, sub };
    });
    const hidden = (a) => cfg.hidden.some((re) => re.test(a.id) || re.test(a.name));
    const rest = apps.filter((a) => !used[a.id] && !hidden(a))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ kind: 'app', app: a, name: a.name }));
    state.items = dock.concat(rest);

    let html = dock.map((d, n) => '<li class="item big' + (!d.app && d.item.type !== 'cast' ? ' missing' : '') + '" data-i="' + n + '">' +
      esc(d.name) + (d.sub ? '<span class="sub">' + d.sub + '</span>' : '') + '</li>').join('');
    if (rest.length) {
      html += '<li class="label">All apps</li>';
      html += rest.map((r, n) => '<li class="item small" data-i="' + (dock.length + n) + '">' + esc(r.name) + '</li>').join('');
    }
    $('list').innerHTML = html;
    state.i = Math.min(state.i, state.items.length - 1);
    paint();
  }

  function refresh() { host.apps().then(render); }

  // ---------- Focus ----------
  const topButtons = () => Array.prototype.filter.call(document.querySelectorAll('.pill'), (b) => !b.classList.contains('off'));
  const lineFor = (i) => $('list').querySelector('[data-i="' + i + '"]');

  function paint() {
    document.querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
    let el = null;
    if (state.zone === 'list') el = lineFor(state.i);
    if (state.zone === 'top') el = topButtons()[state.top];
    if (state.zone === 'sheet') el = $('sheetList').children[state.sheet];
    if (el) el.classList.add('focus');

    // Keep the focused line in the upper part of the page; the list scrolls under it.
    const line = lineFor(state.i);
    const view = $('list').parentNode.clientHeight;
    let shift = 0;
    if (line && line.offsetTop + line.offsetHeight > view * 0.7) shift = line.offsetTop - view * 0.35;
    $('list').style.transform = 'translateY(' + (-Math.max(0, shift)) + 'px)';
  }

  function go(zone) { state.zone = zone; paint(); }

  // ---------- Sheet (inputs list, cast card, messages) ----------
  function showSheet(title, body, rows) {
    if (state.zone !== 'sheet') state.sheetFrom = state.zone;
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = body || '';
    state.sheetRows = rows && rows.length ? rows : [{ label: 'Close', run: () => {} }];
    $('sheetList').innerHTML = state.sheetRows.map((r) => '<div class="row">' + esc(r.label) + '</div>').join('');
    state.sheet = 0;
    ROOT.classList.add('sheet-open');
    go('sheet');
  }
  function closeSheet() {
    ROOT.classList.remove('sheet-open');
    go(state.sheetFrom);
  }
  window.showSheet = showSheet;

  function showInputs() {
    host.inputs().then((list) => {
      if (!list.length) return showSheet('Inputs', 'Press <b>Source</b> or <b>Input</b> on your remote.', []);
      showSheet('Inputs', '', list.map((i) => ({ label: i.name, run: () => host.openInput(i) })));
    });
  }

  function castTo(item) {
    host.inputs().then((list) => {
      const hit = list.find((i) => item.input.test(i.name));
      if (hit) return host.openInput(hit);
      if (host.kind === 'tizen') return showInputs();
      showSheet('Ready to cast',
        'On your phone, open Netflix, YouTube, Disney+ or Spotify. Tap the <b>Cast</b> icon and pick <b>' +
        esc(host.deviceName()) + '</b>. Phone and TV need the same Wi-Fi.', []);
    });
  }

  // ---------- Actions ----------
  function activate() {
    if (state.zone === 'list') {
      const it = state.items[state.i];
      if (!it) return;
      if (it.kind === 'app') return host.launch(it.app);
      store.set('dock', state.i);
      if (it.item.type === 'cast') return castTo(it.item);
      if (it.app) return host.launch(it.app);
      const msg = host.storeFor(it.item);
      if (msg) showSheet(msg.title, msg.body, []);
    } else if (state.zone === 'top') {
      const action = topButtons()[state.top].dataset.action;
      if (action === 'inputs') showInputs();
      if (action === 'settings') host.settings();
    } else if (state.zone === 'sheet') {
      const r = state.sheetRows[state.sheet];
      closeSheet();
      if (r) r.run();
    }
  }

  function back() {
    if (state.zone === 'sheet') return closeSheet(), true;
    if (state.zone === 'top') return go('list'), true;
    if (state.i >= cfg.dock.length) { state.i = 0; return paint(), true; }
    return host.back();
  }
  window.tvBack = back; // called by the Android shell

  function move(key) {
    const z = state.zone;
    if (z === 'list') {
      if (key === KEY.UP) {
        if (state.i === 0) { state.top = 0; return go('top'); }
        state.i--;
      }
      if (key === KEY.DOWN) state.i = Math.min(state.items.length - 1, state.i + 1);
    } else if (z === 'top') {
      const n = topButtons().length;
      if (key === KEY.LEFT) state.top = Math.max(0, state.top - 1);
      if (key === KEY.RIGHT) state.top = Math.min(n - 1, state.top + 1);
      if (key === KEY.DOWN) return go('list');
    } else if (z === 'sheet') {
      const n = state.sheetRows.length;
      if (key === KEY.UP) state.sheet = Math.max(0, state.sheet - 1);
      if (key === KEY.DOWN) state.sheet = Math.min(n - 1, state.sheet + 1);
    }
    paint();
  }

  document.addEventListener('keydown', (e) => {
    const k = e.keyCode;
    if (k >= 37 && k <= 40) { e.preventDefault(); move(k); }
    else if (k === KEY.ENTER) { e.preventDefault(); activate(); }
    else if (BACK_KEYS.indexOf(k) >= 0) { e.preventDefault(); back(); }
  });

  // Android shell calls this each time Home is pressed or an app closes.
  window.tvOnResume = () => {
    ROOT.classList.remove('sheet-open');
    state.zone = 'list';
    if (state.i >= cfg.dock.length) state.i = 0;
    refresh();
  };

  // ---------- Start ----------
  if (!host.caps.settings) $('settingsBtn').classList.add('off');
  state.i = Math.min(Number(store.get('dock')) || 0, cfg.dock.length - 1);
  tick();
  setInterval(tick, 5000);
  refresh();
})();
