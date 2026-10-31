(function () {
  const cfg = window.HOME_CONFIG;
  const host = pickHost();
  const TV_ROOT = () => document.body;
  const $ = (id) => document.getElementById(id);
  const KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13 };
  const BACK_KEYS = [10009, 27, 8, 461]; // Samsung, Esc, Backspace, LG
  const GRID_COLS = 6;
  const CAST_GLYPH = '<svg class="glyph" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M6 14V11a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H28"/>' +
    '<path d="M6 22a18 18 0 0 1 18 18M6 30a10 10 0 0 1 10 10"/><circle cx="7" cy="39" r="1.4" fill="currentColor"/></svg>';

  const state = { zone: 'dock', dock: 0, top: 0, grid: 0, sheet: 0, dockItems: [], gridApps: [], sheetRows: [], sheetFrom: 'dock' };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- Clock and light ----------
  // Sunrise and sunset in local minutes after midnight (NOAA approximation).
  function sunTimes(d, lat, lon) {
    const rad = Math.PI / 180;
    const day = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
    const g = 2 * Math.PI / 365 * (day - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
      0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
    const ha = Math.acos(Math.max(-1, Math.min(1, cosHa))) / rad;
    const off = d.getTimezoneOffset();
    return { rise: 720 - 4 * (lon + ha) - eq - off, set: 720 - 4 * (lon - ha) - eq - off };
  }

  function fmt(mins) {
    let h = Math.floor(mins / 60) % 24;
    const m = String(Math.floor(mins % 60)).padStart(2, '0');
    if (!cfg.clock12h) return h + ':' + m;
    const ap = h < 12 ? ' AM' : ' PM';
    return (h % 12 || 12) + ':' + m + ap;
  }

  // Daylight crosses the wall from left (sunrise) to right (sunset), high at noon and warm at the ends.
  // After dark a low lamp glows in the corner and the wall dims.
  const PREVIEW = { morning: 0.12, day: 0.5, evening: 0.94 };
  function light(now, sun) {
    const t = now.getHours() * 60 + now.getMinutes();
    const o = window.TOD_OVERRIDE;
    let p = o ? PREVIEW[o] : (t - sun.rise) / (sun.set - sun.rise);
    const css = TV_ROOT().style;
    if (o === 'night' || (!o && (p < 0 || p > 1))) {
      css.setProperty('--wall', '#ebe3da');
      css.setProperty('--lx', '86%'); css.setProperty('--ly', '62%');
      css.setProperty('--lc', 'rgba(236, 132, 64, 0.42)');
      return 'night';
    }
    const warm = 1 - Math.sin(Math.PI * p);
    const r = 255, gr = Math.round(232 - 62 * warm), b = Math.round(200 - 100 * warm);
    css.setProperty('--wall', p > 0.85 ? '#f6f1eb' : '#fbf9f6');
    css.setProperty('--lx', (10 + 80 * p).toFixed(1) + '%');
    css.setProperty('--ly', (6 + 40 * warm).toFixed(1) + '%');
    css.setProperty('--lc', 'rgba(' + r + ',' + gr + ',' + b + ',' + (0.5 + 0.15 * warm).toFixed(2) + ')');
    return p < 0.35 ? 'morning' : p < 0.8 ? 'day' : 'evening';
  }

  function tick() {
    const d = new Date();
    let h = d.getHours();
    if (cfg.clock12h) {
      $('ampm').textContent = h < 12 ? 'AM' : 'PM';
      h = h % 12 || 12;
    }
    $('hh').textContent = h;
    $('mm').textContent = String(d.getMinutes()).padStart(2, '0');
    $('date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const loc = cfg.location;
    const sun = sunTimes(d, loc.lat, loc.lon);
    const t = d.getHours() * 60 + d.getMinutes();
    $('sun').innerHTML = t < sun.rise ? 'Sunrise <b>' + fmt(sun.rise) + '</b> in ' + loc.name
      : t < sun.set ? 'Sunset <b>' + fmt(sun.set) + '</b> in ' + loc.name
      : 'Sunrise <b>' + fmt(sun.rise) + '</b> in ' + loc.name;
    TV_ROOT().dataset.tod = light(d, sun);
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

  function tileHtml(name, icon, extra) {
    const inner = extra || (icon
      ? '<img src="' + icon + '" alt="" onerror="this.outerHTML=\'<span class=name>' + name.replace(/'/g, '') + '</span>\'">'
      : '<span class="name">' + name + '</span>');
    return inner;
  }

  function render(apps) {
    const used = {};
    state.dockItems = cfg.dock.map((item) => {
      const app = matchDock(item, apps);
      if (app) used[app.id] = true;
      return { item, app };
    });
    $('dock').innerHTML = state.dockItems.map((d, i) => {
      const cast = d.item.type === 'cast';
      const cls = 'tile' + (!cast && !d.app ? ' missing' : '');
      const body = cast ? tileHtml(d.item.name, null, CAST_GLYPH) : tileHtml(d.item.name, d.app && d.app.icon);
      return '<div class="' + cls + '" data-zone="dock" data-i="' + i + '">' + body + '</div>';
    }).join('');

    const hidden = (a) => cfg.hidden.some((re) => re.test(a.id) || re.test(a.name));
    state.gridApps = apps.filter((a) => !used[a.id] && !hidden(a)).sort((a, b) => a.name.localeCompare(b.name));
    $('grid').innerHTML = state.gridApps.map((a, i) =>
      '<div class="tile" data-zone="grid" data-i="' + i + '">' + tileHtml(a.name, a.icon) + '</div>').join('');

    state.dock = Math.min(state.dock, state.dockItems.length - 1);
    state.grid = Math.min(state.grid, Math.max(0, state.gridApps.length - 1));
    paint();
  }

  function refresh() { host.apps().then(render); }

  // ---------- Focus ----------
  const topButtons = () => Array.prototype.filter.call(document.querySelectorAll('.pill'), (b) => !b.classList.contains('off'));

  function paint() {
    document.querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
    let el = null;
    if (state.zone === 'dock') el = $('dock').children[state.dock];
    if (state.zone === 'top') el = topButtons()[state.top];
    if (state.zone === 'grid') el = $('grid').children[state.grid];
    if (state.zone === 'sheet') el = $('sheetList').children[state.sheet];
    if (el) el.classList.add('focus');

    if (state.zone === 'grid' && el) {
      const row = Math.floor(state.grid / GRID_COLS);
      $('grid').scrollTop = Math.max(0, row - 1) * el.offsetHeight * 1.25;
    }

    const d = state.dockItems[state.dock];
    if (d) {
      let sub = '';
      if (d.item.type === 'cast') sub = 'Cast from your phone';
      else if (!d.app) sub = 'Not installed';
      const label = $('dockLabel');
      label.innerHTML = state.zone === 'dock' ? d.item.name + (sub ? '<span class="sub">' + sub + '</span>' : '') : '&nbsp;';
      const tile = $('dock').children[state.dock];
      if (tile) label.style.transform = 'translateX(' + (tile.offsetLeft - $('dock').offsetLeft) + 'px)';
    }
    document.body.classList.toggle('drawer-open', state.zone === 'grid' || (state.zone === 'sheet' && state.sheetFrom === 'grid'));
  }

  function go(zone) { state.zone = zone; paint(); }

  // ---------- Sheet (inputs list, cast card, messages) ----------
  function showSheet(title, body, rows) {
    if (state.zone !== 'sheet') state.sheetFrom = state.zone;
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = body || '';
    state.sheetRows = rows && rows.length ? rows : [{ label: 'Close', run: () => {} }];
    $('sheetList').innerHTML = state.sheetRows.map((r) => '<div class="row">' + r.label + '</div>').join('');
    state.sheet = 0;
    document.body.classList.add('sheet-open');
    go('sheet');
  }
  function closeSheet() {
    document.body.classList.remove('sheet-open');
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
        host.deviceName() + '</b>. Phone and TV need the same Wi-Fi.', []);
    });
  }

  // ---------- Actions ----------
  function activate() {
    if (state.zone === 'dock') {
      const d = state.dockItems[state.dock];
      store.set('dock', state.dock);
      if (d.item.type === 'cast') return castTo(d.item);
      if (d.app) return host.launch(d.app);
      const msg = host.storeFor(d.item);
      if (msg) showSheet(msg.title, msg.body, []);
    } else if (state.zone === 'grid') {
      const a = state.gridApps[state.grid];
      if (a) host.launch(a);
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
    if (state.zone === 'grid' || state.zone === 'top') return go('dock'), true;
    return host.back();
  }
  window.tvBack = back; // called by the Android shell

  function move(key) {
    const z = state.zone;
    if (z === 'dock') {
      if (key === KEY.LEFT) state.dock = Math.max(0, state.dock - 1);
      if (key === KEY.RIGHT) state.dock = Math.min(state.dockItems.length - 1, state.dock + 1);
      if (key === KEY.UP) { state.top = topButtons().length - 1; return go('top'); }
      if (key === KEY.DOWN && state.gridApps.length) { state.grid = 0; return go('grid'); }
    } else if (z === 'top') {
      const n = topButtons().length;
      if (key === KEY.LEFT) state.top = Math.max(0, state.top - 1);
      if (key === KEY.RIGHT) state.top = Math.min(n - 1, state.top + 1);
      if (key === KEY.DOWN) return go('dock');
    } else if (z === 'grid') {
      const n = state.gridApps.length;
      const col = state.grid % GRID_COLS;
      if (key === KEY.LEFT && col > 0) state.grid--;
      if (key === KEY.RIGHT && col < GRID_COLS - 1 && state.grid < n - 1) state.grid++;
      if (key === KEY.DOWN && state.grid + GRID_COLS < n) state.grid += GRID_COLS;
      else if (key === KEY.DOWN && Math.floor(state.grid / GRID_COLS) < Math.floor((n - 1) / GRID_COLS)) state.grid = n - 1;
      if (key === KEY.UP) {
        if (state.grid < GRID_COLS) return go('dock');
        state.grid -= GRID_COLS;
      }
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
    if (state.zone === 'sheet') document.body.classList.remove('sheet-open');
    state.zone = 'dock';
    refresh();
  };

  // ---------- Start ----------
  if (!host.caps.settings) $('settingsBtn').classList.add('off');
  state.dock = Number(store.get('dock')) || 0;
  tick();
  setInterval(tick, 5000);
  refresh();
})();
