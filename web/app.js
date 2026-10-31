(function () {
  const cfg = window.HOME_CONFIG;
  const host = pickHost();
  const ROOT = document.body;
  const $ = (id) => document.getElementById(id);
  const KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13 };
  const BACK_KEYS = [10009, 27, 8, 461]; // Samsung, Esc, Backspace, LG

  // zone: 'list' | 'top' | 'sheet'. `items` is every focusable line: the dock first, then all other apps.
  const state = { zone: 'list', i: 0, dockLen: 0, top: 0, sheet: 0, items: [], sheetRows: [], sheetFrom: 'list' };

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
    if (cfg.gameday) {
      if (cfg.gameday.months.indexOf(d.getMonth() + 1) >= 0 || gd.on) loadGames(d);
      const on = isGameday(d);
      if (on !== gd.on) { gd.on = on; ROOT.classList.toggle('gameday', on); paintGame(); refresh(); if (on) playIntro(); }
    }
  }

  // ---------- Gameday (Samsung, NFL Sundays) ----------
  const gd = { on: false, games: [], week: null, loaded: 0, day: '' };

  function isGameday(d) {
    const g = cfg.gameday;
    if (!g) return false;
    const kind = host.kind === 'demo' ? (window.PREVIEW_TV || 'tizen') : host.kind;
    if (g.tvs.indexOf(kind) < 0) return false;
    if (window.GAMEDAY_OVERRIDE !== undefined && window.GAMEDAY_OVERRIDE !== null) return window.GAMEDAY_OVERRIDE;
    const inSeason = g.months.indexOf(d.getMonth() + 1) >= 0;
    const teamPlays = gd.games.some((x) => x.mine && sameDay(x.start, d));
    return inSeason && ((g.days.indexOf(d.getDay()) >= 0 && d.getHours() >= g.fromHour) || teamPlays);
  }

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const ymd = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

  // ESPN's public scoreboard: every game that day with kickoff, network, score and status.
  function loadGames(d) {
    const day = ymd(d);
    if (gd.day === day && Date.now() - gd.loaded < (gd.on ? 60000 : 1800000)) return;
    gd.day = day; gd.loaded = Date.now();
    const got = host.schedule ? host.schedule(d)
      : fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + day).then((r) => r.json()).then(parseEspn);
    got.then((res) => { gd.games = res.games; gd.week = res.week; paintGame(); refresh(); })
      .catch(() => { gd.games = []; paintGame(); });
  }

  function parseEspn(data) {
    const team = cfg.gameday.team;
    const games = (data.events || []).map((e) => {
      const c = e.competitions[0];
      const side = (h) => {
        const t = c.competitors.find((x) => x.homeAway === h);
        return { abbr: t.team.abbreviation, name: t.team.shortDisplayName, score: t.score, record: t.records && t.records[0] ? t.records[0].summary : '' };
      };
      const home = side('home'), away = side('away');
      const b = (c.broadcasts || [])[0];
      return {
        odds: parseOdds((c.odds || [])[0], home.abbr, away.abbr),
        start: new Date(e.date), home, away,
        network: b && b.names ? b.names[0] : '',
        state: c.status.type.state, detail: c.status.type.shortDetail,
        venue: c.venue ? c.venue.fullName : '',
        mine: home.abbr === team || away.abbr === team
      };
    });
    return { games, week: data.week ? data.week.number : null };
  }

  // Favorite and moneylines from ESPN's odds block. ESPN has used two shapes; read either.
  function parseOdds(o, homeAbbr, awayAbbr) {
    if (!o) return null;
    const ml = (side) => {
      const t = o[side + 'TeamOdds'];
      if (t && t.moneyLine !== undefined && t.moneyLine !== null) return Number(t.moneyLine);
      const m = o.moneyline && o.moneyline[side];
      const v = m && ((m.close && m.close.odds) || (m.current && m.current.odds) || (m.open && m.open.odds));
      return v !== undefined && v !== null && v !== 'OFF' ? Number(v) : null;
    };
    const home = ml('home'), away = ml('away');
    let fav = null;
    if (o.homeTeamOdds && o.homeTeamOdds.favorite) fav = homeAbbr;
    else if (o.awayTeamOdds && o.awayTeamOdds.favorite) fav = awayAbbr;
    else if (home !== null && away !== null) fav = home < away ? homeAbbr : awayAbbr;
    else if (o.details) fav = o.details.split(' ')[0];
    return { fav, home, away, details: o.details || '', total: o.overUnder || null };
  }

  const money = (n) => (n === null || isNaN(n) ? '' : (n > 0 ? '+' : '') + n);

  function oddsCell(x) {
    const o = x.odds;
    if (!o || !o.fav) return '';
    const n = o.fav === x.home.abbr ? o.home : o.away;
    return esc(o.fav) + (n !== null ? ' <b>' + esc(money(n)) + '</b>' : '');
  }

  function kickoff(d) {
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    if (h === 12 && m === '00') return 'Noon';
    return cfg.clock12h ? (h % 12 || 12) + ':' + m + (h < 12 ? ' AM' : ' PM') : h + ':' + m;
  }

  function myGame() { return gd.games.find((x) => x.mine); }

  // Scorebug: record before kickoff, score once the game starts; countdown or game clock in the middle.
  function paintBug() {
    const g = myGame();
    const team = cfg.gameday.team;
    const side = (id, t) => {
      const el = $(id);
      el.className = 'team' + (t && t.abbr === team ? ' mine' : '');
      el.children[0].textContent = t ? t.abbr : '';
      el.children[1].textContent = !t ? '' : g.state === 'pre' ? (t.record || '') : t.score;
    };
    side('bugAway', g && g.away);
    side('bugHome', g && g.home);
    if (!g) { $('bugState').textContent = 'No game today'; $('bugClock').textContent = ''; return; }
    if (g.state === 'pre') {
      const left = Math.max(0, Math.floor((g.start - Date.now()) / 1000));
      const hh = Math.floor(left / 3600), mm = Math.floor(left % 3600 / 60), ss = left % 60;
      $('bugState').textContent = left ? 'Kickoff in' : 'Kickoff';
      $('bugClock').textContent = left > 86400 ? kickoff(g.start) : hh + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    } else {
      $('bugState').textContent = g.state === 'in' ? 'Live' : 'Final';
      $('bugClock').textContent = g.state === 'in' ? g.detail : g.away.score + ' - ' + g.home.score;
    }
  }
  setInterval(() => { if (gd.on) paintBug(); }, 1000);

  function paintGame() {
    paintBug();
    const g = myGame();
    const team = cfg.gameday.team;
    $('gEyebrow').textContent = 'Gameday' + (gd.week ? '  ·  Week ' + gd.week : '');
    if (!g) {
      $('gTitle').textContent = cfg.gameday.teamName;
      $('gMeta').textContent = gd.games.length ? 'No game today' : 'Loading the schedule';
      $('gOdds').textContent = '';
    } else {
      const me = g.home.abbr === team ? g.home : g.away;
      const them = g.home.abbr === team ? g.away : g.home;
      $('gTitle').textContent = me.name + (g.home.abbr === team ? ' vs ' : ' at ') + them.name;
      const o = g.odds;
      if (o && o.fav) {
        const favName = o.fav === g.home.abbr ? g.home.name : g.away.name;
        const parts = [favName + ' favored'];
        if (o.home !== null && o.away !== null) parts.push(g.away.abbr + ' ' + money(o.away), g.home.abbr + ' ' + money(o.home));
        if (o.details) parts.push(o.details);
        if (o.total) parts.push('O/U ' + o.total);
        $('gOdds').innerHTML = parts.map(esc).join('<i></i>');
      } else $('gOdds').textContent = '';
      if (g.state === 'pre') $('gMeta').innerHTML = esc(kickoff(g.start)) + '<i></i>' + esc(g.network) + '<i></i>' + esc(g.venue);
      else $('gMeta').innerHTML = '<b>' + esc(me.abbr + ' ' + me.score + '  ' + them.abbr + ' ' + them.score) + '</b><i></i>' + esc(g.detail) + '<i></i>' + esc(g.network);
    }
    const rows = gd.games.slice().sort((a, b) => a.start - b.start).map((x) => {
      const right = x.state === 'pre' ? esc(x.network) : esc(x.away.score + ' - ' + x.home.score);
      const left = x.state === 'pre' ? esc(kickoff(x.start)) : (x.state === 'in' ? '<b>Live</b>' : 'Final');
      return '<li class="g' + (x.mine ? ' mine' : '') + (x.state === 'in' ? ' live' : '') + '"><span class="t">' + left +
        '</span><span class="m">' + esc(x.away.abbr) + ' <i>at</i> ' + esc(x.home.abbr) + '</span><span class="o">' + (x.state === 'post' ? '' : oddsCell(x)) + '</span><span class="n">' + right + '</span></li>';
    });
    const first = gd.games[0];
    $('slateTitle').textContent = first ? first.start.toLocaleDateString('en-US', { weekday: 'long' }) + "'s games" : "Today's games";
    const head = rows.length ? '<li class="g head"><span class="t">Kickoff</span><span class="m">Game</span><span class="o">Favorite</span><span class="n">TV</span></li>' : '';
    $('gList').innerHTML = head + rows.join('') || '<li class="g empty">Schedule loads when the TV is online</li>';
  }

  // The gameday intro plays once each time the homescreen opens. Any button skips it.
  let introPlayed = false;
  function playIntro() {
    const v = $('intro');
    if (introPlayed || !cfg.gameday.intro || !v) return;
    introPlayed = true;
    const done = () => { ROOT.classList.remove('intro'); v.pause(); v.removeAttribute('src'); v.load(); };
    v.onended = done;
    v.onerror = done;
    v.src = cfg.gameday.intro;
    ROOT.classList.add('intro');
    // Play with the crowd sound; if the browser refuses sound, play muted instead.
    const p = v.play();
    if (p && p.catch) p.catch(() => { v.muted = true; const q = v.play(); if (q && q.catch) q.catch(done); });
    window.skipIntro = done;
  }

  // ---------- Kickoff countdown (Samsung) ----------
  // The next team game from ESPN's team schedule. Shown in a football on game day until kickoff.
  const kick = { game: null, loaded: 0 };

  function loadNext() {
    if (Date.now() - kick.loaded < 1800000) return;
    kick.loaded = Date.now();
    const got = host.nextGame ? host.nextGame()
      : fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/' + cfg.gameday.team.toLowerCase() + '/schedule')
        .then((r) => r.json()).then(parseNext);
    got.then((g) => { kick.game = g; paintKick(); }).catch(() => { kick.game = null; paintKick(); });
  }

  function parseNext(data) {
    const team = cfg.gameday.team;
    const now = Date.now();
    const next = (data.events || [])
      .map((e) => {
        const c = e.competitions[0];
        const them = c.competitors.find((x) => x.team.abbreviation !== team);
        const home = c.competitors.find((x) => x.homeAway === 'home');
        return { start: new Date(e.date), state: c.status.type.state, opp: them.team.abbreviation, home: home.team.abbreviation === team };
      })
      .filter((g) => g.state === 'pre' && g.start.getTime() > now)
      .sort((a, b) => a.start - b.start)[0];
    return next || null;
  }

  function kickOn() {
    const kind = host.kind === 'demo' ? (window.PREVIEW_TV || 'tizen') : host.kind;
    return !!cfg.gameday && cfg.gameday.tvs.indexOf(kind) >= 0;
  }

  function paintKick() {
    const g = kick.game;
    const left = g ? Math.floor((g.start - Date.now()) / 1000) : -1;
    // Only on the day the team plays, before kickoff. The browser preview's Gameday switch counts as that day.
    const today = g && (sameDay(g.start, new Date()) || (host.kind === 'demo' && window.GAMEDAY_OVERRIDE === true));
    const show = kickOn() && g && left > 0 && today;
    ROOT.classList.toggle('has-kick', !!show);
    if (!show) return;
    const d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), m = Math.floor(left % 3600 / 60), sec = left % 60;
    const two = (n) => String(n).padStart(2, '0');
    $('kickClock').textContent = d > 0 ? d + 'd ' + h + 'h ' + two(m) + 'm' : h + ':' + two(m) + ':' + two(sec);
    const day = g.start.toLocaleDateString('en-US', { weekday: 'short' });
    $('kickGame').textContent = (g.home ? 'vs ' : 'at ') + g.opp + '  ·  ' + day + ' ' + kickoff(g.start);
  }
  setInterval(paintKick, 1000);

  // ---------- Apps ----------
  // Dock lines meant for this TV. `tvs` limits a line to 'android' or 'tizen'.
  // The browser preview acts as the Samsung unless window.PREVIEW_TV says 'android'.
  function dockFor() {
    const kind = host.kind === 'demo' ? (window.PREVIEW_TV || 'tizen') : host.kind;
    return cfg.dock.filter((item) => !item.tvs || item.tvs.indexOf(kind) >= 0);
  }

  function matchDock(item, apps) {
    if (item.type === 'cast' || item.type === 'input') return null;
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
    const dock = dockFor().map((item) => {
      const app = matchDock(item, apps);
      if (app) used[app.id] = true;
      let sub = '';
      if (item.type === 'cast' && host.kind === 'tizen') sub = savedPort(item) ? savedPort(item).name + '. Right to change' : 'Pick its HDMI port';
      else if (item.type === 'cast') sub = 'Cast from your phone';
      else if (item.type === 'input') sub = savedPort(item) ? savedPort(item).name + '. Right to change' : 'Pick its HDMI port';
      else if (!app) sub = 'Not installed';
      let name = item.name;
      if (gd.on && item.key === cfg.gameday.watch) {
        const g = myGame();
        name = 'Watch the game';
        sub = item.name + (g && g.network ? '. Find ' + g.network : '');
      }
      return { kind: 'dock', item, app, name, sub };
    });
    state.dockLen = dock.length;
    // More lines, smaller type, so the dock always fits the page.
    ROOT.style.setProperty('--big', Math.min(gd.on ? 5.6 : 10.5, (gd.on ? 46 : 64) / (dock.length * 1.12)).toFixed(2));
    const hidden = (a) => cfg.hidden.some((re) => re.test(a.id) || re.test(a.name));
    const rest = apps.filter((a) => !used[a.id] && !hidden(a))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ kind: 'app', app: a, name: a.name }));
    state.items = dock.concat(rest);

    let html = dock.map((d, n) => '<li class="item big' + (!d.app && !d.item.type ? ' missing' : '') + '" data-i="' + n + '">' +
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
      // Samsung doesn't report input names, so ask once which port the Chromecast is on and remember it.
      if (host.kind === 'tizen') return openPort(item);
      showSheet('Ready to cast',
        'On your phone, open Netflix, YouTube, Disney+ or Spotify. Tap the <b>Cast</b> icon and pick <b>' +
        esc(host.deviceName()) + '</b>. Phone and TV need the same Wi-Fi.', []);
    });
  }

  // Devices on an HDMI port (Fire Stick, Xbox). The first press asks which port; the TV remembers it.
  function savedPort(item) {
    try { return JSON.parse(store.get('port:' + item.key)); } catch (e) { return null; }
  }

  function pickPort(item, open) {
    host.inputs().then((list) => {
      if (!list.length) return showSheet(item.name, 'Press <b>Source</b> on your remote and pick the port the <b>' + esc(item.device) + '</b> is in.', []);
      showSheet(item.name, 'Which HDMI port is the <b>' + esc(item.device) + '</b> plugged into? The TV remembers your pick.',
        list.map((i) => ({ label: i.name, run: () => {
          store.set('port:' + item.key, JSON.stringify({ id: i.id, name: i.name }));
          refresh();
          if (open) host.openInput(i);
        } })));
    });
  }

  function openPort(item) {
    const saved = savedPort(item);
    if (!saved) return pickPort(item, true);
    host.inputs().then((list) => {
      const hit = list.find((i) => i.id === saved.id);
      if (hit) host.openInput(hit);
      else pickPort(item, true);
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
      if (it.item.type === 'input') return openPort(it.item);
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
    if (state.i >= state.dockLen) { state.i = 0; return paint(), true; }
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
      const it = state.items[state.i];
      const portLine = it && it.item && (it.item.type === 'input' || (it.item.type === 'cast' && host.kind === 'tizen'));
      if (key === KEY.RIGHT && portLine) return pickPort(it.item, false);
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
    if (ROOT.classList.contains('intro')) { e.preventDefault(); return window.skipIntro(); }
    if (k >= 37 && k <= 40) { e.preventDefault(); move(k); }
    else if (k === KEY.ENTER) { e.preventDefault(); activate(); }
    else if (BACK_KEYS.indexOf(k) >= 0) { e.preventDefault(); back(); }
  });

  // Android shell calls this each time Home is pressed or an app closes.
  window.tvOnResume = () => {
    ROOT.classList.remove('sheet-open');
    state.zone = 'list';
    if (state.i >= state.dockLen) state.i = 0;
    refresh();
  };

  // ---------- Start ----------
  if (!host.caps.settings) $('settingsBtn').classList.add('off');
  state.i = Number(store.get('dock')) || 0;
  tick();
  setInterval(tick, 5000);
  window.tvGameday = () => { tick(); paintKick(); };
  if (cfg.gameday) { loadNext(); setInterval(loadNext, 60000); }
  refresh();
})();
