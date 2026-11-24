/* The Thinker's Journal — app logic. No frameworks, no tracking. Data lives on the device;
   optional sync: your Claude account (when opened as a Claude artifact) or a private GitHub Gist. */
(function () {
'use strict';
var TJ = window.TJ;

/* ================= utilities ================= */
var $ = function (s, r) { return (r || document).querySelector(s); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n, l) { return String(n).padStart(l || 2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayStr() { return ymd(new Date()); }
function parseYmd(s) { var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function diffDays(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 864e5); }
function fmtDate(s, y) { if (!s) return ''; return parseYmd(s).toLocaleDateString(undefined, y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }); }
function now() { return Date.now(); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
var EMBED = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
var ICON = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>',
  out: '<svg class="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8"/></svg>',
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
};

/* ================= references ================= */
function ref(s) {
  var i = s.indexOf(':'), k = s.slice(0, i), v = s.slice(i + 1), parts = v.split('|'), a = parts[0], b = parts[1] || '';
  switch (k) {
    case 'w': var t = a.replace(/_/g, ' '); return { kind: 'Wikipedia', label: t, url: 'https://en.wikipedia.org/wiki/Special:Search?go=Go&search=' + encodeURIComponent(t) };
    case 'sep': return { kind: 'Stanford Encyclopedia of Philosophy', label: b || a, url: 'https://plato.stanford.edu/entries/' + a + '/' };
    case 'ted': return { kind: 'TED talk', label: b || a, url: 'https://www.ted.com/talks/' + a };
    case 'fs': return { kind: 'Farnam Street', label: b || a, url: 'https://fs.blog/' + a + '/' };
    case 'gut': return { kind: 'Free book', label: b || ('Project Gutenberg #' + a), url: 'https://www.gutenberg.org/ebooks/' + a };
    case 'yt': return { kind: 'Video search', label: a, url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(a) };
    case 'b': return { kind: 'Book', label: a + (b ? ' — ' + b : ''), url: 'https://openlibrary.org/search?q=' + encodeURIComponent(a + ' ' + b) };
    case 'u': var host = ''; try { host = new URL(b).hostname.replace(/^www\d?\./, ''); } catch (e) {} return { kind: host || 'Link', label: a, url: b };
  }
  return { kind: 'Link', label: s, url: '#' };
}
function videoRef(q) { return q ? { kind: 'YouTube search', label: q, url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) } : null; }

/* ================= the 365-day plan ================= */
var PLAN = (function build() {
  var P = [null];
  function push(o) { o.n = P.length; P.push(o); return o; }
  function lesson(L, m, slot) { var o = {}; for (var k in L) o[k] = L[k]; o.m = m; o.type = 'lesson'; o.slot = slot; return push(o); }
  TJ.m1.forEach(function (L, i) {
    var n = i + 1;
    if (L) { lesson(L, 1, 'th'); return; }
    var sp = TJ.m1Special[n];
    if (n === 30) push({ m: 1, type: 'assess', p: 'I', t: sp.t, x: sp.x, week: range(22, 29) });
    else push({ m: 1, type: 'review', p: 'I', t: sp.t, x: sp.x, week: range(n - 6, n - 1) });
  });
  var ti = 0, ci = 0;
  for (var m = 2; m <= 12; m++) {
    var mo = TJ.months[m - 1], techMonth = m === 7 || m === 8 || m === 11, th = TJ.theme[m], thi = 0;
    var pattern = techMonth ? ['th', 'cr', 'th', 'cr', 'th', 'cr'] : ['th', 'te', 'th', 'cr', 'th', 'te'];
    var monthLessons = [];
    for (var w = 0; w < 4; w++) {
      var wk = [];
      pattern.forEach(function (s) {
        var L = s === 'th' ? th[thi++] : s === 'te' ? TJ.tech[ti++] : TJ.cross[ci++];
        var o = lesson(L, m, s); wk.push(o.n); monthLessons.push(o.n);
      });
      push({ m: m, type: 'review', p: mo.p, t: 'Week ' + (w + 1) + ' review', week: wk, x: 'Do the recall quiz for this week without notes. Re-read the lesson you scored worst on. Write what you will apply next week.' });
    }
    push({ m: m, type: 'project', p: mo.p, t: 'Month ' + m + ' output', x: mo.output + '. Spend today producing it — rough is fine, finished beats perfect.' });
    push({ m: m, type: 'assess', p: mo.p, t: 'Month ' + m + ' assessment', x: 'Rate yourself in the six areas below, take the month quiz, and write a short reflection.', week: monthLessons });
    if (m === 12) TJ.finale.forEach(function (L) { lesson(L, 12, 'fin'); });
  }
  return P;
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
})();
var N = PLAN.length - 1; /* 365 */
var MONTH_START = []; PLAN.forEach(function (d) { if (d && !MONTH_START[d.m]) MONTH_START[d.m] = d.n; });
function monthDays(m) { return PLAN.filter(function (d) { return d && d.m === m; }); }
function pName(p) { return (TJ.pillars[p] || {}).name || ''; }
function stepsFor(d) {
  var R = TJ.routine;
  return R.map(function (s) { return { id: s.id, name: s.name, min: s.min, hint: s.hint }; });
}

/* ================= state ================= */
var KEY = 'tj.v2', SKEY = 'tj.sync', TKEY = 'tj.timer';
function blank() { return { v: 2, settings: { name: '', start: '', mode: 'resume', sound: true, autoNext: true, u: 0 }, days: {}, cards: {}, ucards: {}, books: {}, cbooks: {}, links: {}, monthly: {}, quiz: {}, miles: {} }; }
var MAPS = ['days', 'cards', 'ucards', 'books', 'cbooks', 'links', 'monthly', 'quiz', 'miles'];
function normalize(x) { var b = blank(); if (!x || typeof x !== 'object') return b; b.settings = Object.assign(b.settings, x.settings || {}); MAPS.forEach(function (k) { if (x[k] && typeof x[k] === 'object') b[k] = x[k]; }); return b; }
var S = (function () { try { return normalize(JSON.parse(lsGet(KEY) || 'null')); } catch (e) { return blank(); } })();
var SY = (function () { try { return JSON.parse(lsGet(SKEY) || '{}') || {}; } catch (e) { return {}; } })();
var localOK = lsSet('tj.probe', '1');
function save() { lsSet(KEY, JSON.stringify(S)); cloudSoon(); updateBadge(); }
function saveSync() { lsSet(SKEY, JSON.stringify(SY)); }
function mergeState(a, b) {
  var o = blank();
  o.settings = ((b.settings && b.settings.u) || 0) > ((a.settings && a.settings.u) || 0) ? Object.assign(o.settings, b.settings) : Object.assign(o.settings, a.settings);
  MAPS.forEach(function (k) {
    o[k] = Object.assign({}, a[k] || {});
    var bk = b[k] || {};
    for (var id in bk) { var x = bk[id], y = o[k][id]; if (!y || ((x && x.u) || 0) > ((y && y.u) || 0)) o[k][id] = x; }
  });
  return o;
}
function day(n) { return S.days[n] || { s: {}, done: '', note: '', focus: 0, u: 0 }; }
function setDay(n, patch) { var d = Object.assign({ s: {} }, day(n), patch); d.u = now(); S.days[n] = d; save(); }
function isDone(n) { return !!(S.days[n] && S.days[n].done); }
function doneCount() { var c = 0; for (var k in S.days) if (S.days[k].done) c++; return c; }
function minutesDone() { var m = 0; for (var k in S.days) { var s = S.days[k].s || {}; TJ.routine.forEach(function (r) { if (s[r.id]) m += r.min; }); } return m; }
function doneDates() { var set = {}; for (var k in S.days) if (S.days[k].done) set[S.days[k].done] = 1; return set; }
function streak() { var set = doneDates(), d = todayStr(), c = 0; if (!set[d]) d = addDays(d, -1); while (set[d]) { c++; d = addDays(d, -1); } return c; }
function bestStreak() { var ds = Object.keys(doneDates()).sort(), best = 0, run = 0, prev = null; ds.forEach(function (d) { run = prev && diffDays(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }); return best; }
function nextUndone() { for (var n = 1; n <= N; n++) if (!isDone(n)) return n; return N; }
function doneTodayDay() { var t = todayStr(), r = 0; for (var k in S.days) if (S.days[k].done === t) r = Math.max(r, +k); return r; }
function currentDay() {
  if (S.settings.mode === 'calendar' && S.settings.start) return clamp(diffDays(S.settings.start, todayStr()) + 1, 1, N);
  var dt = doneTodayDay(); if (dt && !UI.keepGoing) return dt;
  return nextUndone();
}
function calendarDay() { return S.settings.start ? diffDays(S.settings.start, todayStr()) + 1 : 1; }

/* ================= spaced repetition ================= */
var IV = [0, 1, 3, 7, 16, 35, 90, 180];
function cardData(id) {
  if (id.charAt(0) === 'd') { var d = PLAN[+id.slice(1)]; return d && d.q ? { q: d.q, a: d.k, src: 'Day ' + d.n + ' · ' + d.t, p: d.p, n: d.n } : null; }
  var u = S.ucards[id]; return u && !u.del ? { q: u.q, a: u.a, src: 'Your card', p: u.p || 'I' } : null;
}
function allCardIds() { return Object.keys(S.cards).filter(function (id) { return !!cardData(id) && !S.cards[id].del; }); }
function dueIds() { var t = todayStr(); return allCardIds().filter(function (id) { return (S.cards[id].due || t) <= t; }); }
function grade(id, g) {
  var t = todayStr(), c = Object.assign({ box: 1, due: t }, S.cards[id] || {});
  if (g === 0) { c.box = 1; c.due = addDays(t, 1); }
  else if (g === 1) { c.due = addDays(t, Math.max(1, Math.round(IV[c.box] / 2))); }
  else if (g === 2) { c.box = Math.min(7, c.box + 1); c.due = addDays(t, IV[c.box]); }
  else { c.box = Math.min(7, c.box + 2); c.due = addDays(t, IV[c.box]); }
  c.u = now(); S.cards[id] = c; save();
}

/* ================= UI state ================= */
var UI = { tab: 'today', view: 0, open: null, keepGoing: false, libTab: 'journal', libQ: '', jq: '', openMonth: 0 };

/* ================= timer (survives screen lock and reloads) ================= */
var T = (function () { try { return JSON.parse(lsGet(TKEY) || 'null'); } catch (e) { return null; } })();
var tickH = null, wake = null, actx = null;
function saveT() { lsSet(TKEY, JSON.stringify(T)); }
function firstOpenStep(n) { var s = day(n).s || {}; for (var i = 0; i < 5; i++) if (!s[TJ.routine[i].id]) return i; return 5; }
function timerFor(n) { if (!T || T.n !== n) return { n: n, i: firstOpenStep(n), run: false, end: 0, left: (TJ.routine[Math.min(4, firstOpenStep(n))].min * 60000) }; return T; }
function startTimer(n) {
  ensureAudio();
  var t = timerFor(n); if (t.i > 4) { toast('All five steps are done. Complete the day below.'); return; }
  t.run = true; t.end = now() + t.left; T = t; saveT(); keepAwake(true); loop(); paintTimer();
}
function pauseTimer() { if (!T || !T.run) return; T.left = Math.max(0, T.end - now()); T.run = false; saveT(); keepAwake(false); paintTimer(); }
function resetTimer(n) { T = { n: n, i: firstOpenStep(n), run: false, end: 0, left: 0 }; if (T.i < 5) T.left = TJ.routine[T.i].min * 60000; saveT(); keepAwake(false); paintTimer(); }
function skipStep() { if (!T) return; var n = T.n; var s = Object.assign({}, day(n).s); s[TJ.routine[T.i].id] = 1; setDay(n, { s: s }); advance(false); }
function advance(fromTimer) {
  var n = T.n, prevEnd = T.end;
  T.i = firstOpenStep(n);
  if (T.i > 4) { T.run = false; T.left = 0; saveT(); keepAwake(false); chime(true); renderToday(); toast('Session complete. Rate your focus and complete the day.'); return; }
  T.left = TJ.routine[T.i].min * 60000;
  if (fromTimer && S.settings.autoNext && T.run) { T.end = prevEnd + T.left; } else { T.run = false; keepAwake(false); }
  saveT(); UI.open = T.i; renderToday();
}
function loop() {
  clearInterval(tickH);
  tickH = setInterval(function () {
    if (!T || !T.run) { clearInterval(tickH); return; }
    var guard = 0;
    while (T.run && now() >= T.end && guard++ < 6) {
      var s = Object.assign({}, day(T.n).s); s[TJ.routine[T.i].id] = 1; S.days[T.n] = Object.assign({ s: {} }, day(T.n), { s: s, u: now() }); save();
      chime(false); buzz(); advance(true);
    }
    paintTimer();
  }, 500);
}
function paintTimer() {
  var el = $('#tTime'); if (!el) return;
  var n = UI.view || currentDay(), t = timerFor(n);
  var left = t.run ? Math.max(0, t.end - now()) : t.left;
  var i = Math.min(4, t.i);
  el.textContent = t.i > 4 ? 'Done' : pad(Math.floor(left / 60000)) + ':' + pad(Math.floor(left / 1000) % 60);
  var st = $('#tStep'); if (st) st.textContent = t.i > 4 ? 'All five steps complete' : (TJ.routine[i].name + ' · ' + TJ.routine[i].min + ' min');
  var b = $('#tBtn'); if (b) { b.innerHTML = t.run ? ICON.pause + 'Pause' : ICON.play + (left < TJ.routine[i].min * 60000 && t.i <= 4 && left > 0 ? 'Resume' : 'Start'); b.dataset.act = t.run ? 'pause' : 'start'; }
  var segs = document.querySelectorAll('#segbar span'); var s = day(n).s || {};
  segs.forEach(function (sp, k) {
    var em = sp.firstChild, id = TJ.routine[k].id, w = s[id] ? 100 : 0;
    if (k === t.i && t.i <= 4 && !s[id]) w = 100 - (left / (TJ.routine[k].min * 600));
    sp.classList.toggle('cur', k === t.i && !s[id]); em.style.width = clamp(w, 0, 100) + '%';
  });
}
function ensureAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
function chime(big) {
  if (!S.settings.sound || !actx) return;
  try {
    var f = big ? [523, 659, 784] : [660, 880];
    f.forEach(function (hz, k) { var o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = hz; var t0 = actx.currentTime + k * 0.18; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 1); });
  } catch (e) {}
}
function buzz() { try { navigator.vibrate && navigator.vibrate([180, 80, 180]); } catch (e) {} }
function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {});
    if (!on && wake) { wake.release(); wake = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { if (T && T.run) { loop(); keepAwake(true); } paintTimer(); } else { pushNow(); } });

/* ================= rendering helpers ================= */
function chip(p, text) { return '<span class="chip p-' + p + '"><i></i>' + esc(text || pName(p)) + '</span>'; }
function refList(arr) {
  if (!arr.length) return '';
  return '<ul class="refs">' + arr.map(function (r) { return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener"><span><span>' + esc(r.label) + '</span><small>' + esc(r.kind) + '</small></span>' + ICON.out + '</a></li>'; }).join('') + '</ul>';
}
function toast(msg) { var t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(function () { t.style.display = 'none'; }, 2600); }
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); $('#sheet').scrollTop = 0; }
function closeSheet() { $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); if (Q.onClose) { var f = Q.onClose; Q.onClose = null; f(); } }
$('#scrim').addEventListener('click', closeSheet);

/* ================= Today ================= */
function dialSVG(cur) {
  var c = 150, s = '', mo = 0;
  for (var n = 1; n <= N; n++) {
    var a = (n - 1) / N * 2 * Math.PI - Math.PI / 2, d = PLAN[n], done = isDone(n), isCur = n === cur;
    var r1 = isCur ? 112 : d.type === 'lesson' ? 126 : 120, r2 = isCur ? 147 : 141;
    var col = isCur ? '#f2896b' : done ? '#8fd3b0' : (d.m % 2 ? '#2a3d35' : '#22332c');
    s += '<line x1="' + (c + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (c + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (c + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (c + r2 * Math.sin(a)).toFixed(1) + '" stroke="' + col + '" stroke-width="' + (isCur ? 3 : 1.7) + '" stroke-linecap="round"/>';
  }
  for (var m = 1; m <= 12; m++) {
    var mid = MONTH_START[m] + 14, a2 = (mid - 1) / N * 2 * Math.PI - Math.PI / 2;
    s += '<text x="' + (c + 103 * Math.cos(a2)).toFixed(1) + '" y="' + (c + 103 * Math.sin(a2) + 4).toFixed(1) + '" text-anchor="middle" font-size="11" fill="' + (PLAN[cur].m === m ? '#ede8dd' : '#56665e') + '" font-family="Inter,sans-serif">' + m + '</text>';
  }
  return '<svg viewBox="0 0 300 300" role="img" aria-label="Year dial: ' + doneCount() + ' of 365 days complete">' + s + '</svg>';
}
function greeting() { var h = new Date().getHours(); var g = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; return g + (S.settings.name ? ', ' + S.settings.name : ''); }
function renderToday() {
  var v = $('#v-today'); if (!v) return;
  var cur = currentDay(), n = UI.view || cur, d = PLAN[n], dd = day(n), mo = TJ.months[d.m - 1];
  var due = dueIds().length, st = streak();
  var h = '';
  if (!UI.view) {
    h += '<div class="hero"><div class="dial">' + dialSVG(cur) + '<div class="center"><small>Day</small><b>' + cur + '</b><small>of 365</small></div></div>';
    h += '<p class="greet mute small">' + esc(greeting()) + ' · ' + esc(fmtDate(todayStr())) + (S.settings.mode === 'resume' && S.settings.start && calendarDay() !== cur ? ' · calendar day ' + Math.max(1, calendarDay()) : '') + '</p>';
    h += '<div class="stats3"><div class="stat"><b>' + st + '</b><span>day streak</span></div><div class="stat"><b>' + doneCount() + '</b><span>days done</span></div><div class="stat"><b>' + (Math.round(minutesDone() / 6) / 10) + '</b><span>hours</span></div></div></div>';
    if (doneTodayDay() && !UI.keepGoing && S.settings.mode === 'resume') h += '<div class="banner"><span class="small">Today\'s session is done. Rest is part of learning.</span><button class="btn sm" data-act="keepgoing">Next day</button></div>';
    if (due) h += '<div class="banner"><span class="small"><b>' + due + '</b> recall card' + (due > 1 ? 's' : '') + ' due · about ' + Math.max(1, Math.round(due * 0.4)) + ' min</span><button class="btn sm" data-act="review">Review</button></div>';
  } else {
    h += '<div class="banner"><span class="small">Viewing Day ' + n + (n === cur ? ' (today)' : '') + '</span><button class="btn sm" data-act="backtoday">Back to today</button></div>';
  }
  h += '<div class="dayhead"><div class="meta">' + chip(d.p) + '<span class="chip">Month ' + d.m + ' · ' + esc(mo.title) + '</span>' + (isDone(n) ? '<span class="chip" style="color:var(--sage)">Done ' + esc(fmtDate(dd.done)) + '</span>' : '') + '</div>';
  h += '<p class="faint tiny" style="margin:0 0 4px">Day ' + n + (d.type === 'review' ? ' · weekly review' : d.type === 'project' ? ' · monthly output' : d.type === 'assess' ? ' · monthly assessment' : '') + '</p><h1>' + esc(d.t) + '</h1>';
  if (d.k) h += '<p class="key">' + esc(d.k) + '</p>';
  h += '</div>';
  // session
  h += '<div class="session"><div class="sesscard"><div class="row between"><div><div class="timer" id="tTime">15:00</div><div class="small mute" id="tStep"></div></div><div class="row" style="gap:6px"><button class="btn primary" id="tBtn" data-act="start" data-n="' + n + '">' + ICON.play + 'Start</button><button class="btn sm ghost" data-act="skip" title="Mark this step done and move on">Skip</button></div></div>';
  h += '<div class="segbar" id="segbar">' + TJ.routine.map(function (r) { return '<span style="flex:' + r.min + '"><em></em></span>'; }).join('') + '</div><div class="row between tiny faint"><span>45-minute session</span><button class="tiny faint" data-act="reset" data-n="' + n + '" style="min-height:32px">Reset timer</button></div></div></div>';
  // steps
  var t = timerFor(n), openI = UI.open == null ? Math.min(4, t.i) : UI.open, s = dd.s || {};
  h += '<div class="steps">' + TJ.routine.map(function (r, i) {
    return '<div class="step' + (openI === i ? '' : ' closed') + (t.i === i && !isDone(n) ? ' cur' : '') + '"><header data-act="openstep" data-i="' + i + '"><button class="tick' + (s[r.id] ? ' on' : '') + '" data-act="tick" data-i="' + i + '" data-n="' + n + '" aria-label="Mark ' + r.name + ' done">' + ICON.check + '</button><b>' + r.name + '</b><span class="mins">' + r.min + ' min</span></header><div class="body">' + stepBody(d, r.id, n) + '</div></div>';
  }).join('') + '</div>';
  // finish
  h += '<div class="card"><label class="lab" style="margin-top:0">How focused were you?</label><div class="focusrow">' + [1, 2, 3, 4, 5].map(function (k) { return '<button data-act="focus" data-k="' + k + '" data-n="' + n + '" class="' + (dd.focus === k ? 'on' : '') + '" aria-label="Focus ' + k + ' of 5">' + k + '</button>'; }).join('') + '</div>';
  h += '<div class="donebar">' + (isDone(n) ? '<span class="grow small" style="color:var(--sage)">Completed ' + esc(fmtDate(dd.done, true)) + '</span><button class="btn sm ghost" data-act="undone" data-n="' + n + '">Undo</button>' : '<button class="btn coral block" data-act="complete" data-n="' + n + '">Complete Day ' + n + '</button>') + '</div></div>';
  h += '<div class="navdays">' + (n > 1 ? '<button class="btn sm" data-act="goto" data-n="' + (n - 1) + '">← Day ' + (n - 1) + '</button>' : '<span></span>') + (n < N ? '<button class="btn sm" data-act="goto" data-n="' + (n + 1) + '">Day ' + (n + 1) + ' →</button>' : '') + '</div>';
  v.innerHTML = h;
  paintTimer();
}
function stepBody(d, id, n) {
  var dd = day(n), h = '';
  if (d.type === 'lesson') {
    if (id === 'learn') return '<p class="small mute" style="margin:0">Read slowly. Stop when you can say the key idea in your own words.</p>' + (d.r.length ? refList(d.r.map(ref)) : '<p class="small">Use your notes from the year — open Library → Journal.</p>');
    if (id === 'explore') { var vr = videoRef(d.v); return '<p class="small mute" style="margin:0">Pick one video from the search — a short, clear one beats a long one.</p>' + (vr ? refList([vr]) : '<p class="small">Free choice: watch a talk related to anything you studied this month.</p>'); }
    if (id === 'practice') return '<div class="prompt">' + esc(d.x) + '</div>';
    if (id === 'reflect') return '<p class="small mute" style="margin:0 0 6px">What surprised you? Where did you see this at work or in life today?</p><textarea class="field" id="note" data-n="' + n + '" placeholder="Your notes, answers and reflection…">' + esc(dd.note || '') + '</textarea><p class="tiny faint" id="noteSaved" style="margin:4px 0 0">Saved automatically</p>';
    if (id === 'explain') return '<p class="small mute" style="margin:0">Say it out loud in 60 seconds, as if to a friend outside engineering. Then answer:</p>' + (d.q ? '<div class="prompt"><b>' + esc(d.q) + '</b><details style="margin-top:8px"><summary class="small" style="cursor:pointer;color:var(--sage)">Show the key idea</summary><p class="small" style="margin:6px 0 0">' + esc(d.k) + '</p></details></div><p class="tiny faint" style="margin:4px 0 0">When you complete the day, this question joins your Review deck.</p>' : '<div class="prompt">Explain what you did today to someone else.</div>');
  }
  var lessons = (d.week || []).filter(function (k) { return PLAN[k].q; });
  if (d.type === 'review') {
    if (id === 'learn') return '<p class="small" style="margin:0 0 8px">Recall quiz: this week\'s ' + lessons.length + ' questions, no notes.</p><button class="btn primary" data-act="weekquiz" data-n="' + n + '">Start recall quiz</button>' + quizResult(n) + '<ul class="refs" style="margin-top:12px">' + (d.week || []).map(function (k) { return '<li><a href="#" data-act="goto" data-n="' + k + '"><span><span>Day ' + k + ' · ' + esc(PLAN[k].t) + '</span><small>' + esc(pName(PLAN[k].p)) + (isDone(k) ? ' · done' : ' · not done yet') + '</small></span></a></li>'; }).join('') + '</ul>';
    if (id === 'explore') return '<p class="small" style="margin:0">Re-open the lesson you scored worst on and re-read or re-watch its best reference.</p>';
    if (id === 'practice') return '<div class="prompt">' + esc(d.x) + '</div>';
    if (id === 'reflect') return '<p class="small mute" style="margin:0 0 6px">What stuck this week? What didn\'t? What will you apply next week?</p><textarea class="field" id="note" data-n="' + n + '">' + esc(dd.note || '') + '</textarea>';
    if (id === 'explain') return '<p class="small" style="margin:0">Explain the best idea of the week to someone today — at work, at home or on a call.</p>';
  }
  if (d.type === 'project') {
    if (id === 'learn') return '<p class="small" style="margin:0">Skim your notes from this month (Library → Journal) and list the three ideas you will use.</p>';
    if (id === 'explore') return '<p class="small" style="margin:0">Find one excellent example of this kind of work and note what makes it good.</p>';
    if (id === 'practice') return '<div class="prompt"><b>This month\'s output:</b> ' + esc(d.x) + '</div>';
    if (id === 'reflect') return '<textarea class="field" id="note" data-n="' + n + '" placeholder="Draft, outline or link to your output…">' + esc(dd.note || '') + '</textarea>';
    if (id === 'explain') return '<p class="small" style="margin:0">Show your output to one person and ask for one piece of feedback.</p>';
  }
  if (d.type === 'assess') {
    if (id === 'learn') return '<p class="small" style="margin:0 0 8px">Month quiz: ' + lessons.length + ' questions from this month.</p><button class="btn primary" data-act="weekquiz" data-n="' + n + '">Start month quiz</button>' + quizResult(n);
    if (id === 'explore') return '<p class="small" style="margin:0">Look back at your focus ratings and notes this month. What pattern do you see?</p>';
    if (id === 'practice') return assessForm(d.m);
    if (id === 'reflect') return '<p class="small mute" style="margin:0 0 6px">' + esc(d.x) + '</p><textarea class="field" id="note" data-n="' + n + '" placeholder="Biggest lesson, what to keep, what to change…">' + esc(dd.note || '') + '</textarea>';
    if (id === 'explain') return '<p class="small" style="margin:0">Tell someone the single biggest lesson of your month.</p>';
  }
  return h;
}
function quizResult(n) { var q = S.quiz['w' + n]; return q ? '<p class="small" style="margin:8px 0 0;color:var(--sage)">Last score: ' + q.score + ' / ' + q.total + ' · ' + esc(fmtDate(q.date)) + '</p>' : ''; }
var AREAS = [['know', 'Knowledge', 'Can I explain what I studied without notes?'], ['comm', 'Communication', 'Can I express my thoughts clearly?'], ['emo', 'Emotional maturity', 'Do I recognise and regulate my emotions better?'], ['fin', 'Financial literacy', 'Can I make informed money decisions?'], ['tech', 'Technical ability', 'Can I solve problems independently?'], ['dec', 'Decision-making', 'Do I consider alternatives and consequences?']];
var SCALE = ['', 'I barely understand it', 'I recognise the concepts', 'I can explain them', 'I can apply them independently', 'I can teach it and handle the unfamiliar'];
function assessForm(m) {
  var a = (S.monthly[m] && S.monthly[m].r) || {};
  return '<p class="small mute" style="margin:0">1 = barely understand · 3 = can explain · 5 = can teach it</p>' + AREAS.map(function (x) {
    return '<label class="lab">' + x[1] + ' <span class="faint">— ' + x[2] + '</span></label><div class="focusrow">' + [1, 2, 3, 4, 5].map(function (k) { return '<button data-act="rate" data-m="' + m + '" data-a="' + x[0] + '" data-k="' + k + '" class="' + (a[x[0]] === k ? 'on' : '') + '" title="' + esc(SCALE[k]) + '">' + k + '</button>'; }).join('') + '</div>';
  }).join('');
}

/* ================= quiz / review sheet ================= */
var Q = { ids: [], i: 0, shown: false, score: 0, onDone: null, onClose: null, title: '' };
function runQuiz(ids, title, onDone) {
  ids = ids.filter(function (id) { return cardData(id); });
  if (!ids.length) { toast('No questions here yet.'); return; }
  Q = { ids: shuffle(ids), i: 0, shown: false, score: 0, onDone: onDone, onClose: function () { render(); }, title: title };
  paintQuiz();
}
function paintQuiz() {
  if (Q.i >= Q.ids.length) {
    var pct = Math.round(Q.score / Q.ids.length * 100);
    openSheet('<h2>' + esc(Q.title) + '</h2><p class="mute">You recalled</p><p class="serif" style="font-size:52px;margin:0;line-height:1">' + (Math.round(Q.score * 10) / 10) + ' <span class="mute" style="font-size:22px">/ ' + Q.ids.length + '</span></p><p class="small mute">' + (pct >= 80 ? 'Strong recall. These cards will come back less often.' : pct >= 50 ? 'Decent. The ones you missed come back tomorrow.' : 'Normal for a first pass — forgetting is how memory gets stronger. They come back tomorrow.') + '</p><button class="btn primary block" data-act="closesheet">Done</button>');
    if (Q.onDone) { Q.onDone(Math.round(Q.score * 10) / 10, Q.ids.length); Q.onDone = null; }
    return;
  }
  var id = Q.ids[Q.i], c = cardData(id);
  var h = '<div class="row between"><span class="small mute">' + esc(Q.title) + '</span><span class="small mute">' + (Q.i + 1) + ' / ' + Q.ids.length + '</span></div>';
  h += '<div class="flash"><div>' + chip(c.p) + '</div><p class="qq">' + esc(c.q) + '</p>' + (Q.shown ? '<div class="aa">' + esc(c.a) + '<p class="tiny faint" style="margin:8px 0 0">' + esc(c.src) + '</p></div>' : '') + '</div>';
  if (!Q.shown) h += '<p class="small mute" style="text-align:center">Answer in your head (or out loud) first.</p><button class="btn primary block" data-act="show">Show answer</button>';
  else h += '<div class="grades"><button class="btn" data-act="grade" data-g="0">Forgot<small>tomorrow</small></button><button class="btn" data-act="grade" data-g="1">Hard<small>soon</small></button><button class="btn primary" data-act="grade" data-g="2">Good<small>later</small></button><button class="btn" data-act="grade" data-g="3">Easy<small>much later</small></button></div>';
  openSheet(h);
}

/* ================= Journey ================= */
var QUARTERS = [['Q1', 'Foundation', 'Learn how to learn. Build the habits.', 1], ['Q2', 'Depth', 'Psychology, history, communication, money in depth.', 4], ['Q3', 'Application', 'Embedded, motor control, strategy — build things.', 7], ['Q4', 'Mastery', 'Economics, advanced projects, your own viewpoint.', 10]];
function renderJourney() {
  var v = $('#v-journey'), cur = currentDay(), h = '<h1 style="margin-top:8px">Your year</h1><p class="mute small">12 months, six pillars, one evening at a time. Tap a month to see every day.</p>';
  h += '<input class="field" id="jq" placeholder="Search all 365 days — e.g. CAN, Stoic, SIP" value="' + esc(UI.jq) + '" autocomplete="off">';
  if (UI.jq.trim()) {
    var q = UI.jq.trim().toLowerCase(), res = PLAN.filter(function (d) { return d && ((d.t + ' ' + (d.k || '') + ' ' + (d.x || '')).toLowerCase().indexOf(q) >= 0); });
    h += '<div class="card" style="padding:6px 8px">' + (res.length ? res.slice(0, 60).map(function (d) { return dayRow(d, cur); }).join('') : '<p class="empty">Nothing matches “' + esc(UI.jq) + '”.</p>') + '</div>';
    v.innerHTML = h; bindSearch(); return;
  }
  QUARTERS.forEach(function (qq) {
    h += '<div class="q"><h3>' + qq[0] + ' · ' + qq[1] + '</h3><span class="small mute">' + qq[2] + '</span></div>';
    for (var m = qq[3]; m < qq[3] + 3; m++) {
      var mo = TJ.months[m - 1], ds = monthDays(m), dn = ds.filter(function (d) { return isDone(d.n); }).length, open = UI.openMonth === m;
      h += '<div class="month"><button data-act="month" data-m="' + m + '"><div class="row between"><span class="mn">Month ' + m + ' · Days ' + ds[0].n + '–' + ds[ds.length - 1].n + '</span>' + chip(mo.p) + '</div><h3 style="margin-top:6px">' + esc(mo.title) + '</h3><p class="small mute" style="margin:4px 0 0">' + esc(mo.goal) + '</p><div class="bar"><em style="width:' + Math.round(dn / ds.length * 100) + '%"></em></div><p class="tiny faint" style="margin:6px 0 0">' + dn + ' / ' + ds.length + ' days · Book: ' + esc(mo.book) + '</p></button>';
      if (open) h += '<div class="daylist"><p class="small" style="margin:6px 8px"><b>Output:</b> <span class="mute">' + esc(mo.output) + '</span></p>' + ds.map(function (d) { return dayRow(d, cur); }).join('') + '</div>';
      h += '</div>';
    }
  });
  h += '<div class="card flat small mute"><b style="color:var(--ink)">How the weeks work.</b> Each week has six lessons and a review. Outside the technical months, two lessons a week continue your technical track (C, CAN/CANoe, power electronics, Python, control, AUTOSAR, safety, career), one is a cross-pillar skill (Excel, PPT, money, mind), and three follow the month\'s theme.</div>';
  v.innerHTML = h; bindSearch();
}
function dayRow(d, cur) { return '<button class="dayrow' + (d.n === cur ? ' today' : '') + '" data-act="goto" data-n="' + d.n + '"><span class="n">' + d.n + '</span><span class="dot p-' + d.p + '"></span><span class="grow" style="text-align:left">' + esc(d.t) + (d.type !== 'lesson' ? ' <span class="faint tiny">· ' + (d.type === 'review' ? 'review' : d.type === 'project' ? 'output' : 'assessment') + '</span>' : '') + '</span>' + (isDone(d.n) ? '<span class="ok">' + ICON.check + '</span>' : '') + '</button>'; }
function bindSearch() { var i = $('#jq'); if (!i) return; i.oninput = debounce(function () { UI.jq = i.value; renderJourney(); var j = $('#jq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }, 250); }

/* ================= Review ================= */
function renderReview() {
  var v = $('#v-review'), ids = allCardIds(), due = dueIds(), boxes = [0, 0, 0];
  ids.forEach(function (id) { var b = S.cards[id].box || 1; boxes[b <= 2 ? 0 : b <= 4 ? 1 : 2]++; });
  var h = '<h1 style="margin-top:8px">Review</h1><p class="mute small">Every lesson you complete adds its question here. Cards come back just before you would forget them — a few minutes a day locks in the whole year.</p>';
  h += '<div class="card" style="text-align:center"><p class="serif" style="font-size:56px;margin:0;line-height:1">' + due.length + '</p><p class="mute" style="margin:4px 0 14px">card' + (due.length === 1 ? '' : 's') + ' due today</p>' + (due.length ? '<button class="btn primary block" data-act="review">Start review</button>' : '<p class="small mute" style="margin:0">' + (ids.length ? 'All caught up. Come back tomorrow.' : 'Complete your first lesson to create your first card.') + '</p>') + '</div>';
  h += '<div class="boxes"><div class="stat"><b>' + boxes[0] + '</b><span>learning</span></div><div class="stat"><b>' + boxes[1] + '</b><span>getting there</span></div><div class="stat"><b>' + boxes[2] + '</b><span>mastered</span></div></div>';
  var qs = Object.keys(S.quiz).filter(function (k) { return S.quiz[k] && S.quiz[k].total; }).sort(function (a, b) { return (+b.slice(1)) - (+a.slice(1)); });
  h += '<div class="card"><h3>Weekly quiz results</h3>' + (qs.length ? qs.slice(0, 12).map(function (k) { var q = S.quiz[k], d = PLAN[+k.slice(1)]; return '<div class="row between item"><span class="small">Day ' + d.n + ' · ' + esc(d.t) + ' <span class="faint">(Month ' + d.m + ')</span></span><b class="small">' + q.score + '/' + q.total + '</b></div>'; }).join('') : '<p class="small mute" style="margin:6px 0 0">Your first weekly quiz is on Day 7.</p>') + '</div>';
  h += '<div class="card"><h3>Add your own card</h3><p class="small mute" style="margin:4px 0 0">Anything worth remembering — from work, a book, a meeting.</p><label class="lab">Question</label><input class="field" id="ucq" maxlength="300"><label class="lab">Answer</label><textarea class="field" id="uca" style="min-height:80px" maxlength="1000"></textarea><button class="btn block" style="margin-top:10px" data-act="addcard">Add card</button></div>';
  var mine = Object.keys(S.ucards).filter(function (k) { return !S.ucards[k].del; });
  if (mine.length) h += '<div class="card"><h3>Your cards (' + mine.length + ')</h3>' + mine.map(function (k) { return '<div class="item row between"><span class="small">' + esc(S.ucards[k].q) + '</span><button class="btn sm ghost" data-act="delcard" data-id="' + k + '">Delete</button></div>'; }).join('') + '</div>';
  v.innerHTML = h;
}

/* ================= Library ================= */
var REFINDEX = (function () {
  var map = {};
  PLAN.forEach(function (d) { if (!d || !d.r) return; d.r.concat(d.v ? [] : []).forEach(function (s) { var r = ref(s); if (!map[r.url]) map[r.url] = { r: r, p: d.p, days: [] }; map[r.url].days.push(d.n); }); });
  return Object.keys(map).map(function (k) { return map[k]; });
})();
var STATUS = { '': 'To read', reading: 'Reading', done: 'Finished' };
function bookList() {
  var b = TJ.books.map(function (x, i) { return { id: 'b' + i, title: x[0], author: x[1], m: x[2], p: x[3], url: x[4] }; });
  Object.keys(S.cbooks).forEach(function (k) { var c = S.cbooks[k]; if (!c.del) b.push({ id: k, title: c.title, author: c.author, m: 0, p: 'I', url: '', mine: true }); });
  return b;
}
function renderLibrary() {
  var v = $('#v-library'), t = UI.libTab, q = UI.libQ.trim().toLowerCase();
  var h = '<h1 style="margin-top:8px">Library</h1><div class="seg" role="tablist">' + [['journal', 'Journal'], ['books', 'Books'], ['refs', 'References']].map(function (x) { return '<button data-act="libtab" data-t="' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
  if (t !== 'books') h += '<input class="field" id="libq" placeholder="' + (t === 'journal' ? 'Search your notes' : 'Search ' + REFINDEX.length + ' references') + '" value="' + esc(UI.libQ) + '" autocomplete="off">';
  if (t === 'journal') {
    var ents = Object.keys(S.days).filter(function (k) { return (S.days[k].note || '').trim(); }).map(Number).sort(function (a, b) { return b - a; });
    if (q) ents = ents.filter(function (n) { return (S.days[n].note + ' ' + PLAN[n].t).toLowerCase().indexOf(q) >= 0; });
    h += '<div class="card" style="padding:4px 16px">' + (ents.length ? ents.map(function (n) { var d = PLAN[n], x = S.days[n]; return '<div class="item"><button class="link" data-act="goto" data-n="' + n + '"><div class="row between"><b class="small">Day ' + n + ' · ' + esc(d.t) + '</b><span class="tiny faint">' + esc(fmtDate(x.done)) + '</span></div><p class="small mute" style="margin:4px 0 0;white-space:pre-wrap">' + esc((x.note || '').slice(0, 260)) + ((x.note || '').length > 260 ? '…' : '') + '</p></button></div>'; }).join('') : '<p class="empty">' + (q ? 'No notes match.' : 'Your notes from the Reflect step appear here.') + '</p>') + '</div>';
  } else if (t === 'books') {
    var bl = bookList();
    h += '<p class="small mute">One main book a month. Finishing is optional; understanding is not. Tap the status to change it.</p><div class="card" style="padding:4px 16px">' + bl.map(function (b) {
      var st = (S.books[b.id] && S.books[b.id].st) || '';
      var link = b.url || ('https://openlibrary.org/search?q=' + encodeURIComponent(b.title.replace(/\(.*\)/, '') + ' ' + b.author));
      return '<div class="item row between"><div class="grow"><b class="small">' + esc(b.title) + '</b><p class="tiny mute" style="margin:2px 0 0">' + esc(b.author) + (b.m ? ' · Month ' + b.m : '') + ' · <a href="' + esc(link) + '" target="_blank" rel="noopener">' + (b.url ? 'Read free' : 'Find it') + '</a>' + (b.mine ? ' · <button class="tiny faint" data-act="delbook" data-id="' + b.id + '">remove</button>' : '') + '</p></div><button class="btn sm status" data-act="bookst" data-id="' + b.id + '" style="' + (st === 'done' ? 'color:var(--sage);border-color:var(--sage)' : st === 'reading' ? 'color:var(--coral);border-color:#6b4b3e' : '') + '">' + STATUS[st] + '</button></div>';
    }).join('') + '</div><div class="card"><h3>Add a book</h3><label class="lab">Title</label><input class="field" id="bt" maxlength="160"><label class="lab">Author</label><input class="field" id="ba" maxlength="120"><button class="btn block" style="margin-top:10px" data-act="addbook">Add book</button></div>';
  } else {
    var mine = Object.keys(S.links).filter(function (k) { return !S.links[k].del; }).map(function (k) { return { id: k, r: { label: S.links[k].label, url: S.links[k].url, kind: 'Saved by you' } }; });
    var all = REFINDEX.filter(function (x) { return !q || (x.r.label + ' ' + x.r.kind).toLowerCase().indexOf(q) >= 0; });
    var saveBox = '<details class="card"' + (mine.length ? ' open' : '') + '><summary class="serif" style="cursor:pointer;font-size:18px">Your saved links' + (mine.length ? ' (' + mine.length + ')' : '') + '</summary>' + mine.map(function (x) { return '<div class="row" style="gap:6px"><div class="grow">' + refList([x.r]) + '</div><button class="btn sm ghost" data-act="dellink" data-id="' + x.id + '" aria-label="Delete link">✕</button></div>'; }).join('') + '<label class="lab">Name</label><input class="field" id="lk" maxlength="140"><label class="lab">URL (https://…)</label><input class="field" id="lu" inputmode="url" maxlength="600"><button class="btn block" style="margin-top:10px" data-act="addlink">Save link</button></details>';
    h += '<p class="small mute">Every article, video and book linked in the 365 days, grouped by pillar.</p>';
    ['T', 'C', 'P', 'F', 'S', 'I'].forEach(function (p) {
      var g = all.filter(function (x) { return x.p === p; }); if (!g.length) return;
      h += '<div class="q"><h3 class="p-' + p + '">' + esc(TJ.pillars[p].full) + ' <span class="small mute" style="display:inline;font-family:Inter,sans-serif;font-weight:400">' + g.length + '</span></h3></div>' + '<ul class="refs">' + g.map(function (x) { return '<li><a href="' + esc(x.r.url) + '" target="_blank" rel="noopener"><span><span>' + esc(x.r.label) + '</span><small>' + esc(x.r.kind) + ' · Day ' + x.days.slice(0, 3).join(', ') + (x.days.length > 3 ? '…' : '') + '</small></span>' + ICON.out + '</a></li>'; }).join('') + '</ul>';
    });
    h += saveBox;
  }
  v.innerHTML = h;
  var li = $('#libq'); if (li) li.oninput = debounce(function () { UI.libQ = li.value; renderLibrary(); var j = $('#libq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }, 250);
}

/* ================= Progress ================= */
var MILES = [
  ['Day 90 — Foundation', ['A daily reading habit', 'Can explain 10 mental models', 'A working monthly budget', 'Can explain how an inverter works to a non-engineer']],
  ['Day 180 — Understanding', ['Can explain key biases and Stoic ideas', 'Know the basics of investing in India', 'Recorded three talks', 'A Python script that saves time at work']],
  ['Day 270 — Application', ['Built and debugged an embedded project', 'FOC pipeline working in simulation', 'Analysed three decisions with mental models', 'Comfortable in CANoe and basic CAPL']],
  ['Day 365 — Independence', ['Capstone on GitHub with a demo video', 'Annual report written', 'Finances reviewed and automated', 'A three-year career plan']]
];
var RULES = ['Understand before moving on. Don\'t finish a book just to tick a box.', 'Question what you read — respected authors can be wrong.', 'Don\'t confuse confidence with competence. Say "I don\'t know".', 'Apply something every week.', 'Don\'t turn everything into productivity. Music, friends and rest count.', 'Don\'t chase the top 1%. Chase your previous self.', 'Missed a day? Never double up. Just resume — the app waits for you.'];
function renderYou() {
  var v = $('#v-you'), h = '<h1 style="margin-top:8px">Progress</h1>';
  var dc = doneCount(), cards = allCardIds(), mast = cards.filter(function (id) { return (S.cards[id].box || 1) >= 5; }).length, notes = Object.keys(S.days).filter(function (k) { return (S.days[k].note || '').trim(); }).length;
  h += '<div class="stats3" style="margin-top:12px"><div class="stat"><b>' + dc + '</b><span>of 365 days</span></div><div class="stat"><b>' + streak() + '</b><span>streak · best ' + bestStreak() + '</span></div><div class="stat"><b>' + (Math.round(minutesDone() / 6) / 10) + '</b><span>hours</span></div><div class="stat"><b>' + notes + '</b><span>notes</span></div><div class="stat"><b>' + cards.length + '</b><span>cards</span></div><div class="stat"><b>' + mast + '</b><span>mastered</span></div></div>';
  // last 12 weeks
  var set = doneDates(), t = todayStr(), startW = addDays(t, -(83 + ((parseYmd(t).getDay() + 6) % 7) - 6));
  var cells = ''; for (var i = 0; i < 84; i++) { var dd = addDays(startW, i); cells += '<i class="' + (set[dd] ? 'd' : '') + (dd === t ? ' t' : '') + '" title="' + dd + '"></i>'; }
  h += '<div class="card"><div class="row between"><h3>Last 12 weeks</h3><span class="tiny faint">Mon → Sun, by week</span></div><div class="heat" style="grid-template-columns:none;grid-template-rows:repeat(7,auto);grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)">' + cells + '</div></div>';
  // pillar balance
  h += '<div class="card"><h3>Pillar balance</h3><p class="small mute" style="margin:4px 0 6px">Lessons done out of the year\'s lessons in each pillar.</p>' + ['T', 'I', 'C', 'P', 'F', 'S'].map(function (p) {
    var tot = 0, dn = 0; PLAN.forEach(function (d) { if (d && d.type === 'lesson' && d.p === p) { tot++; if (isDone(d.n)) dn++; } });
    return '<div class="pbar"><span class="p-' + p + '">' + esc(pName(p)) + '</span><div class="bar"><em style="width:' + (tot ? Math.round(dn / tot * 100) : 0) + '%;background:var(--p' + p + ')"></em></div><b>' + dn + '/' + tot + '</b></div>';
  }).join('') + '</div>';
  // monthly assessment
  var ms = Object.keys(S.monthly).filter(function (k) { return S.monthly[k] && S.monthly[k].r; }).sort(function (a, b) { return a - b; });
  h += '<div class="card"><h3>Monthly self-assessment</h3>' + (ms.length ? '<div class="scroll"><table class="rt"><thead><tr><th>Month</th>' + AREAS.map(function (a) { return '<th title="' + a[1] + '">' + a[1].split(' ')[0].slice(0, 5) + '</th>'; }).join('') + '</tr></thead><tbody>' + ms.map(function (m) { var r = S.monthly[m].r; return '<tr><td>' + m + '</td>' + AREAS.map(function (a) { return '<td>' + (r[a[0]] || '–') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<p class="small mute" style="margin:6px 0 0">Your first assessment is on Day 30.</p>') + '</div>';
  // milestones
  h += '<div class="card"><h3>Quarterly milestones</h3>' + MILES.map(function (g, gi) { return '<p class="small" style="margin:12px 0 2px"><b>' + g[0] + '</b></p>' + g[1].map(function (x, xi) { var id = 'm' + gi + '_' + xi, on = S.miles[id] && S.miles[id].on; return '<label class="check"><input type="checkbox" data-act="mile" data-id="' + id + '"' + (on ? ' checked' : '') + '><span class="small">' + esc(x) + '</span></label>'; }).join(''); }).join('') + '</div>';
  // settings
  var st = S.settings;
  h += '<div class="card"><h3>Settings</h3><label class="lab">Your name</label><input class="field" id="sName" value="' + esc(st.name) + '" maxlength="40"><label class="lab">Start date (Day 1)</label><input class="field" type="date" id="sStart" value="' + esc(st.start) + '"><label class="lab">When you miss a day</label><select class="field" id="sMode"><option value="resume"' + (st.mode === 'resume' ? ' selected' : '') + '>Resume where I left off (recommended)</option><option value="calendar"' + (st.mode === 'calendar' ? ' selected' : '') + '>Follow the calendar strictly</option></select><label class="check" style="margin-top:8px"><input type="checkbox" id="sSound"' + (st.sound ? ' checked' : '') + '><span class="small">Chime and vibrate when a step ends</span></label><label class="check"><input type="checkbox" id="sAuto"' + (st.autoNext ? ' checked' : '') + '><span class="small">Start the next step automatically</span></label></div>';
  // sync
  h += '<div class="card"><h3>Sync & backup</h3>' + syncPanel() + '<hr class="sep"><div class="row wrap" style="gap:8px"><button class="btn" data-act="exportmd">Export to Obsidian (.zip)</button><button class="btn" data-act="exportjson">Backup (.json)</button><label class="btn" style="cursor:pointer">Restore backup<input type="file" id="importFile" accept=".json,application/json" hidden></label><button class="btn ghost" data-act="copynotes">Copy notes</button></div><p class="tiny faint" style="margin:10px 0 0">' + (localOK ? 'Everything is saved on this device as you go.' : 'This browser blocks storage here — use Backup often, or install the app version.') + '</p></div>';
  h += '<div class="card flat"><h3>Rules of the journey</h3><ul class="small mute" style="padding-left:18px;margin:8px 0 0">' + RULES.map(function (r) { return '<li style="margin:4px 0">' + esc(r) + '</li>'; }).join('') + '</ul></div>';
  h += '<div class="card flat"><p class="tiny faint" style="margin:0">References are free web pages, Wikipedia articles, official docs and video searches chosen for each day. Book links go to free copies where they exist, otherwise to a library search.</p><button class="btn sm ghost" style="margin-top:10px;color:var(--coral)" data-act="reset">Erase all data on this device</button></div>';
  v.innerHTML = h;
  $('#sName').onchange = function () { S.settings.name = this.value.trim(); S.settings.u = now(); save(); };
  $('#sStart').onchange = function () { if (this.value) { S.settings.start = this.value; S.settings.u = now(); save(); } };
  $('#sMode').onchange = function () { S.settings.mode = this.value; S.settings.u = now(); save(); };
  $('#sSound').onchange = function () { S.settings.sound = this.checked; S.settings.u = now(); save(); if (this.checked) { ensureAudio(); chime(false); } };
  $('#sAuto').onchange = function () { S.settings.autoNext = this.checked; S.settings.u = now(); save(); };
  $('#importFile').onchange = importFile;
  var tok = $('#ghTok'); if (tok) tok.onkeydown = function (e) { if (e.key === 'Enter') connectGist(); };
}

/* ================= Onboarding ================= */
function renderOnboard() {
  $('#v-onboard').innerHTML = '<div class="onb"><h1>Welcome to your year.</h1><p class="mute">365 evenings. 45 minutes each. Six pillars: thinking, communication, mind, money, technical depth and strategy — with a technical track built for EV and power-electronics work.</p>' +
    '<div class="card"><label class="lab" style="margin-top:0">What should I call you?</label><input class="field" id="oName" maxlength="40" autocomplete="given-name"><label class="lab">Day 1 is</label><input class="field" type="date" id="oStart" value="' + todayStr() + '"><label class="lab">If you miss a day</label><select class="field" id="oMode"><option value="resume">Resume where I left off (recommended)</option><option value="calendar">Follow the calendar strictly</option></select></div>' +
    '<div class="card flat small mute"><b style="color:var(--ink)">How each evening works</b><br>15 min deep learning · 10 min explore · 10 min practice · 5 min reflect · 5 min explain. Press Start and the timer walks you through it. Every lesson you finish becomes a recall card in Review.</div>' +
    '<button class="btn primary block" data-act="begin">Begin Day 1</button><p class="tiny faint" style="text-align:center">Your data stays on this device. Back it up any time from Progress.</p></div>';
}

/* ================= tabs + render ================= */
var TABS = ['today', 'journey', 'review', 'library', 'progress'];
function setTab(t, keepScroll) {
  if (TABS.indexOf(t) < 0) t = 'today';
  UI.tab = t;
  document.querySelectorAll('nav.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
  if (location.hash.slice(1) !== t) { try { history.replaceState(null, '', '#' + t); } catch (e) { location.hash = t; } }
  render(); if (!keepScroll) window.scrollTo(0, 0);
}
function render() {
  var onb = !S.settings.start;
  $('#tabs').style.display = onb ? 'none' : '';
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('on'); });
  if (onb) { renderOnboard(); $('#v-onboard').classList.add('on'); return; }
  var id = UI.tab === 'progress' ? 'you' : UI.tab;
  ({ today: renderToday, journey: renderJourney, review: renderReview, library: renderLibrary, you: renderYou })[id]();
  $('#v-' + id).classList.add('on');
  updateBadge();
}
function updateBadge() { var b = $('#dueBadge'); if (!b) return; var n = dueIds().length; b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
window.addEventListener('hashchange', function () { var t = location.hash.slice(1); if (t && t !== UI.tab && TABS.indexOf(t) >= 0) setTab(t); });

/* ================= events ================= */
document.addEventListener('click', function (e) {
  var tabBtn = e.target.closest('nav.tabs button'); if (tabBtn) { if (tabBtn.dataset.tab === 'today') { UI.view = 0; UI.open = null; } setTab(tabBtn.dataset.tab); return; }
  var a = e.target.closest('[data-act]'); if (!a) return;
  var act = a.dataset.act, n = +a.dataset.n || 0;
  if (a.tagName === 'A' && act) e.preventDefault();
  switch (act) {
    case 'start': startTimer(UI.view || currentDay()); break;
    case 'pause': pauseTimer(); break;
    case 'skip': if (!T || T.n !== (UI.view || currentDay())) T = timerFor(UI.view || currentDay()); if (T.i <= 4) skipStep(); break;
    case 'reset': resetTimer(n); UI.open = null; renderToday(); break;
    case 'openstep': if (e.target.closest('.tick')) return; var i = +a.dataset.i; UI.open = UI.open === i ? -1 : i; renderToday(); break;
    case 'tick': e.stopPropagation(); var dn = day(n), s = Object.assign({}, dn.s), id = TJ.routine[+a.dataset.i].id; s[id] = s[id] ? 0 : 1; setDay(n, { s: s }); if (T && T.n === n && !T.run) { T.i = firstOpenStep(n); if (T.i < 5) T.left = TJ.routine[T.i].min * 60000; saveT(); } renderToday(); break;
    case 'focus': setDay(n, { focus: +a.dataset.k }); renderToday(); break;
    case 'complete': completeDay(n); break;
    case 'undone': setDay(n, { done: '' }); renderToday(); toast('Marked as not done.'); break;
    case 'goto': UI.view = n === currentDay() ? 0 : n; UI.open = null; closeSheet(); setTab('today'); break;
    case 'backtoday': UI.view = 0; UI.open = null; renderToday(); window.scrollTo(0, 0); break;
    case 'keepgoing': UI.keepGoing = true; UI.view = 0; UI.open = null; renderToday(); window.scrollTo(0, 0); break;
    case 'review': runQuiz(dueIds(), 'Today\'s review', null); break;
    case 'weekquiz': var d = PLAN[n]; runQuiz(d.week.filter(function (k) { return PLAN[k].q; }).map(function (k) { return 'd' + k; }), d.t, function (sc, tot) { S.quiz['w' + n] = { score: sc, total: tot, date: todayStr(), u: now() }; save(); }); break;
    case 'show': Q.shown = true; paintQuiz(); break;
    case 'grade': var g = +a.dataset.g; grade(Q.ids[Q.i], g); Q.score += g >= 2 ? 1 : g === 1 ? 0.5 : 0; Q.i++; Q.shown = false; paintQuiz(); break;
    case 'closesheet': closeSheet(); break;
    case 'rate': var m = +a.dataset.m, mm = Object.assign({ r: {} }, S.monthly[m] || {}); mm.r = Object.assign({}, mm.r); mm.r[a.dataset.a] = +a.dataset.k; mm.u = now(); S.monthly[m] = mm; save(); renderToday(); break;
    case 'month': UI.openMonth = UI.openMonth === +a.dataset.m ? 0 : +a.dataset.m; renderJourney(); break;
    case 'libtab': UI.libTab = a.dataset.t; UI.libQ = ''; renderLibrary(); break;
    case 'bookst': var bid = a.dataset.id, cur = (S.books[bid] && S.books[bid].st) || '', nx = cur === '' ? 'reading' : cur === 'reading' ? 'done' : ''; S.books[bid] = { st: nx, u: now() }; save(); renderLibrary(); break;
    case 'addbook': var bt = $('#bt').value.trim(), ba = $('#ba').value.trim(); if (!bt) { toast('Add a title first.'); return; } S.cbooks['c' + now()] = { title: bt, author: ba, u: now() }; save(); renderLibrary(); toast('Book added.'); break;
    case 'delbook': S.cbooks[a.dataset.id] = { del: 1, u: now() }; save(); renderLibrary(); break;
    case 'addlink': var lk = $('#lk').value.trim(), lu = $('#lu').value.trim(); if (!/^https:\/\/\S+$/i.test(lu)) { toast('Use a full https:// link.'); return; } S.links['l' + now()] = { label: lk || lu, url: lu, u: now() }; save(); renderLibrary(); break;
    case 'dellink': S.links[a.dataset.id] = { del: 1, u: now() }; save(); renderLibrary(); break;
    case 'addcard': var cq = $('#ucq').value.trim(), ca = $('#uca').value.trim(); if (!cq || !ca) { toast('Write both a question and an answer.'); return; } var cid = 'u' + now(); S.ucards[cid] = { q: cq, a: ca, u: now() }; S.cards[cid] = { box: 1, due: todayStr(), u: now() }; save(); renderReview(); toast('Card added — it\'s due today.'); break;
    case 'delcard': S.ucards[a.dataset.id] = { del: 1, u: now() }; if (S.cards[a.dataset.id]) S.cards[a.dataset.id] = { del: 1, u: now() }; save(); renderReview(); break;
    case 'mile': S.miles[a.dataset.id] = { on: a.checked ? 1 : 0, u: now() }; save(); break;
    case 'exportmd': exportObsidian(); break;
    case 'exportjson': saveFile('thinkers-journal-backup-' + todayStr() + '.json', JSON.stringify(S, null, 1)); break;
    case 'copynotes': copyText(notesMarkdown()); break;
    case 'reset': openSheet('<h2>Erase everything?</h2><p class="mute">This deletes all progress, notes and cards on this device. Make a backup first if you might want them.</p><div class="row" style="gap:8px"><button class="btn grow" data-act="closesheet">Cancel</button><button class="btn coral grow" data-act="reallyreset">Erase</button></div>'); break;
    case 'reallyreset': S = blank(); T = null; saveT(); save(); closeSheet(); UI.view = 0; render(); break;
    case 'begin': S.settings.name = $('#oName').value.trim(); S.settings.start = $('#oStart').value || todayStr(); S.settings.mode = $('#oMode').value; S.settings.u = now(); save(); setTab('today'); break;
    case 'ghconnect': connectGist(); break;
    case 'ghsync': syncGist(true); break;
    case 'ghoff': SY = {}; saveSync(); Cloud.kind = Cloud.kind === 'gist' ? null : Cloud.kind; setSync('local'); renderYou(); break;
  }
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'note') { var n = +e.target.dataset.n; saveNote(n, e.target.value); var s = $('#noteSaved'); if (s) s.textContent = 'Saving…'; }
});
document.addEventListener('change', function (e) { if (e.target.matches('input[data-act=mile]')) { /* handled by click */ } });
var saveNote = debounce(function (n, val) { var d = Object.assign({ s: {} }, day(n)); d.note = val; d.u = now(); S.days[n] = d; save(); var s = $('#noteSaved'); if (s) s.textContent = 'Saved'; }, 500);
function completeDay(n) {
  var d = PLAN[n], t = todayStr(), nt = $('#note');
  var patch = { done: t }; if (nt && +nt.dataset.n === n) patch.note = nt.value;
  setDay(n, patch);
  if (d.q && !S.cards['d' + n]) { S.cards['d' + n] = { box: 1, due: addDays(t, 1), u: now() }; save(); }
  if (T && T.n === n) { T.run = false; saveT(); keepAwake(false); }
  ensureAudio(); chime(true);
  UI.view = 0; UI.open = null; UI.keepGoing = false;
  renderToday(); window.scrollTo(0, 0);
  toast('Day ' + n + ' complete · ' + streak() + '-day streak');
}

/* ================= export: Obsidian vault (zip), JSON, clipboard ================= */
var CRC = (function () { var c, t = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  var enc = new TextEncoder(), parts = [], central = [], off = 0;
  files.forEach(function (f) {
    var nm = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    var lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nm, data);
    var ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + data.length;
  });
  var cdSize = central.reduce(function (s, x) { return s + x.length; }, 0);
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
}
function safeName(s) { return String(s).replace(/[\\/:*?"<>|#^\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80); }
function dayFile(d) { return 'Day ' + pad(d.n, 3) + ' - ' + safeName(d.t); }
function monthFile(m) { return 'Month ' + pad(m) + ' - ' + safeName(TJ.months[m - 1].title); }
function mdRefs(d) { var r = (d.r || []).map(ref); var v = videoRef(d.v); if (v) r.push(v); return r.map(function (x) { return '- [' + x.label.replace(/[\[\]]/g, '') + '](' + x.url + ') — ' + x.kind; }).join('\n'); }
function exportObsidian() {
  var root = 'Thinkers Journal/', files = [], cur = currentDay();
  PLAN.forEach(function (d) {
    if (!d) return; var x = day(d.n);
    var md = '---\nday: ' + d.n + '\nmonth: ' + d.m + '\npillar: ' + pName(d.p) + '\ntype: ' + d.type + '\nstatus: ' + (x.done ? 'done' : 'todo') + (x.done ? '\ncompleted: ' + x.done : '') + (x.focus ? '\nfocus: ' + x.focus : '') + '\ntags: [thinkers-journal, pillar/' + pName(d.p).toLowerCase() + ']\n---\n\n';
    md += '# Day ' + d.n + ' — ' + d.t + '\n\n' + (d.k ? '> ' + d.k + '\n\n' : '') + '## Practice\n' + (d.x || '') + '\n\n## My notes\n' + (x.note || '_No notes yet._') + '\n\n';
    if (d.q) md += '## Recall\n' + d.q + '\n?\n' + d.k + '\n\n';
    var rr = mdRefs(d); if (rr) md += '## References\n' + rr + '\n\n';
    md += '---\n[[' + monthFile(d.m) + ']]' + (d.n > 1 ? ' · ← [[' + dayFile(PLAN[d.n - 1]) + ']]' : '') + (d.n < N ? ' · [[' + dayFile(PLAN[d.n + 1]) + ']] →' : '') + '\n';
    files.push({ name: root + 'Daily/' + dayFile(d) + '.md', data: md });
  });
  TJ.months.forEach(function (mo) {
    var md = '# Month ' + mo.n + ' — ' + mo.title + '\n\n**Goal:** ' + mo.goal + '\n**Output:** ' + mo.output + '\n**Book:** ' + mo.book + '\n\n' + monthDays(mo.n).map(function (d) { return '- [' + (isDone(d.n) ? 'x' : ' ') + '] [[' + dayFile(d) + ']]'; }).join('\n') + '\n';
    var a = S.monthly[mo.n]; if (a && a.r) md += '\n## Self-assessment\n' + AREAS.map(function (x) { return '- ' + x[1] + ': ' + (a.r[x[0]] || '–') + '/5'; }).join('\n') + '\n';
    files.push({ name: root + 'Curriculum/' + monthFile(mo.n) + '.md', data: md });
  });
  var dash = '# The Thinker\'s Journal\n\n- Current day: [[' + dayFile(PLAN[cur]) + ']]\n- Days complete: ' + doneCount() + ' / 365\n- Streak: ' + streak() + ' (best ' + bestStreak() + ')\n- Hours: ' + (Math.round(minutesDone() / 6) / 10) + '\n- Exported: ' + todayStr() + '\n\n## Months\n' + TJ.months.map(function (m) { return '- [[' + monthFile(m.n) + ']] — ' + m.goal; }).join('\n') + '\n\n## Rules\n' + RULES.map(function (r) { return '- ' + r; }).join('\n') + '\n';
  files.push({ name: root + 'Dashboard.md', data: dash });
  files.push({ name: root + 'Library/Books.md', data: '# Books\n\n' + bookList().map(function (b) { var st = (S.books[b.id] && S.books[b.id].st) || ''; return '- [' + (st === 'done' ? 'x' : ' ') + '] ' + b.title + ' — ' + b.author + (st === 'reading' ? ' (reading)' : '') + (b.url ? ' · [free](' + b.url + ')' : ''); }).join('\n') + '\n' });
  files.push({ name: root + 'Library/References.md', data: '# References\n\n' + REFINDEX.map(function (x) { return '- [' + x.r.label.replace(/[\[\]]/g, '') + '](' + x.r.url + ') — ' + x.r.kind + ' · ' + x.days.map(function (n) { return '[[' + dayFile(PLAN[n]) + '|Day ' + n + ']]'; }).join(', '); }).join('\n') + '\n' });
  files.push({ name: root + 'Flashcards.md', data: '#flashcards\n\n' + allCardIds().map(function (id) { var c = cardData(id); return c.q.replace(/\n/g, ' ') + '::' + c.a.replace(/\n/g, ' '); }).join('\n') + '\n' });
  saveFile('thinkers-journal-obsidian-' + todayStr() + '.zip', makeZip(files));
}
function notesMarkdown() {
  return '# The Thinker\'s Journal — notes (' + todayStr() + ')\n\n' + Object.keys(S.days).map(Number).sort(function (a, b) { return a - b; }).filter(function (n) { return (S.days[n].note || '').trim(); }).map(function (n) { return '## Day ' + n + ' — ' + PLAN[n].t + '\n' + S.days[n].note + '\n'; }).join('\n');
}
function saveFile(name, data) {
  var blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
  var go = function (dl) {
    if (dl) { dl.save({ filename: name, data: blob }).then(function () { toast('Saved ' + name); }).catch(function (e) { if (e && e.code !== 'declined') fallback(); }); return; }
    fallback();
  };
  function fallback() {
    try { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast('Downloading ' + name); }
    catch (e) { toast('Download blocked here — use Copy notes instead.'); }
  }
  if (window.claude && window.claude.use) window.claude.use('downloads').then(go).catch(function () { go(null); }); else go(null);
}
function copyText(txt) { try { navigator.clipboard.writeText(txt).then(function () { toast('Copied to clipboard.'); }, function () { showCopy(txt); }); } catch (e) { showCopy(txt); } }
function showCopy(txt) { openSheet('<h2>Copy your notes</h2><p class="small mute">Select all and copy.</p><textarea class="field" style="min-height:50vh" readonly>' + esc(txt) + '</textarea>'); }
function importFile(e) {
  var f = e.target.files && e.target.files[0]; if (!f) return;
  var rd = new FileReader();
  rd.onload = function () { try { var x = normalize(JSON.parse(rd.result)); S = mergeState(S, x); save(); render(); toast('Backup restored and merged.'); } catch (err) { toast('That file is not a Thinker\'s Journal backup.'); } };
  rd.readAsText(f);
}

/* ================= cloud sync ================= */
var Cloud = { kind: null, db: null, base: '', last: {}, busy: false, again: false };
function setSync(state, text) {
  var el = $('#syncDot'); if (!el) return;
  el.className = 'syncdot' + (state === 'on' ? ' on' : state === 'err' ? ' err' : '');
  el.querySelector('span').textContent = text || (state === 'on' ? (Cloud.kind === 'gist' ? 'Synced · GitHub' : 'Synced · Claude') : state === 'busy' ? 'Syncing…' : state === 'err' ? 'Sync paused' : (localOK ? 'On this device' : 'Not saved'));
}
function chunks() {
  var core = {}; Object.keys(S).forEach(function (k) { if (k !== 'days') core[k] = S[k]; });
  var out = { core: core }; [[1, 90], [91, 180], [181, 270], [271, 400]].forEach(function (r, i) { var o = {}; for (var k in S.days) if (+k >= r[0] && +k <= r[1]) o[k] = S.days[k]; out['q' + (i + 1)] = o; });
  return out;
}
var cloudSoon = debounce(function () { pushNow(); }, 2500);
function pushNow() { if (Cloud.kind === 'claude') pushClaude(); else if (Cloud.kind === 'gist') syncGist(false, true); }
async function initCloud() {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      var res = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      var db = res[0], user = res[1];
      if (db && user) {
        var id = await user.id();
        if (id) { Cloud.kind = 'claude'; Cloud.db = db; Cloud.base = 'data/users/' + id; await pullClaude(); return; }
      }
    }
  } catch (e) { /* fall through */ }
  if (SY.token && !EMBED) { Cloud.kind = 'gist'; syncGist(false); }
  else setSync('local');
}
async function pullClaude() {
  setSync('busy');
  var timer = setTimeout(function () { setSync('err', 'Cloud not reachable'); }, 10000);
  try {
    var names = ['core', 'q1', 'q2', 'q3', 'q4'], remote = blank(), any = false;
    for (var i = 0; i < names.length; i++) {
      var snap = await Cloud.db.doc(Cloud.base + '/' + names[i]).get();
      if (snap.exists) { any = true; var body = snap.data(); var obj = JSON.parse(body.json || '{}'); if (names[i] === 'core') { Object.keys(obj).forEach(function (k) { remote[k] = obj[k]; }); } else Object.assign(remote.days, obj); Cloud.last[names[i]] = body.json; }
    }
    clearTimeout(timer);
    if (any) { var hadStart = !!S.settings.start; S = mergeState(S, normalize(remote)); lsSet(KEY, JSON.stringify(S)); if (!hadStart || UI.tab) render(); }
    setSync('on'); pushClaude();
  } catch (e) { clearTimeout(timer); Cloud.kind = null; setSync(localOK ? 'local' : 'err'); }
}
async function pushClaude() {
  if (Cloud.kind !== 'claude') return;
  if (Cloud.busy) { Cloud.again = true; return; }
  Cloud.busy = true;
  try {
    var c = chunks();
    for (var k in c) {
      var json = JSON.stringify(c[k]);
      if (Cloud.last[k] === json) continue;
      await Cloud.db.doc(Cloud.base + '/' + k).set({ json: json, u: now() });
      Cloud.last[k] = json;
    }
    setSync('on');
  } catch (e) { setSync('err', e && e.code === 'quota_exceeded' ? 'Cloud full' : 'Sync paused'); }
  Cloud.busy = false;
  if (Cloud.again) { Cloud.again = false; pushClaude(); }
}
/* GitHub Gist sync — free, private, works from the installed app (not inside the Claude preview). */
var GH = 'https://api.github.com';
async function gh(method, path, body) {
  var r = await fetch(GH + path, { method: method, headers: { Authorization: 'Bearer ' + SY.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { var err = new Error('GitHub ' + r.status); err.status = r.status; throw err; }
  return r.json();
}
async function connectGist() {
  var tok = ($('#ghTok') || {}).value; tok = (tok || '').trim();
  if (!/^(gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(tok)) { toast('That doesn\'t look like a GitHub token.'); return; }
  SY = { token: tok }; saveSync(); Cloud.kind = 'gist';
  await syncGist(true); renderYou();
}
async function syncGist(manual, pushOnly) {
  if (!SY.token) return;
  if (Cloud.busy) { Cloud.again = true; return; }
  Cloud.busy = true; setSync('busy');
  try {
    if (!pushOnly) {
      if (!SY.gistId) { var list = await gh('GET', '/gists?per_page=100'); var g0 = list.filter(function (g) { return g.description === 'thinkers-journal-sync'; })[0]; if (g0) { SY.gistId = g0.id; saveSync(); } }
      if (SY.gistId) {
        var g = await gh('GET', '/gists/' + SY.gistId), f = g.files && g.files['thinkers-journal.json'];
        if (f) { var txt = f.truncated ? await (await fetch(f.raw_url)).text() : f.content; S = mergeState(S, normalize(JSON.parse(txt))); lsSet(KEY, JSON.stringify(S)); }
      }
    }
    var content = JSON.stringify(S);
    if (content !== Cloud.last.gist) {
      if (SY.gistId) await gh('PATCH', '/gists/' + SY.gistId, { files: { 'thinkers-journal.json': { content: content } } });
      else { var ng = await gh('POST', '/gists', { description: 'thinkers-journal-sync', public: false, files: { 'thinkers-journal.json': { content: content } } }); SY.gistId = ng.id; }
      Cloud.last.gist = content;
    }
    SY.last = new Date().toISOString(); saveSync(); setSync('on');
    if (!pushOnly) render();
    if (manual) toast('Synced with GitHub.');
  } catch (e) {
    setSync('err', e.status === 401 ? 'Token rejected' : 'Sync paused');
    if (manual) toast(e.status === 401 ? 'GitHub rejected the token. Check it has the gist scope.' : 'Could not reach GitHub. Your data is safe on this device.');
  }
  Cloud.busy = false;
  if (Cloud.again) { Cloud.again = false; syncGist(false, true); }
}
function syncPanel() {
  if (Cloud.kind === 'claude') return '<p class="small" style="margin:6px 0 0"><span style="color:var(--sage)">●</span> Synced to your Claude account. Open this page on any device where you\'re signed in and your progress follows you.</p>';
  if (EMBED) return '<p class="small mute" style="margin:6px 0 0">Saved in this browser. For the full offline app with GitHub sync, install the standalone version.</p>';
  if (SY.token) return '<p class="small" style="margin:6px 0 0"><span style="color:var(--sage)">●</span> Synced to a private GitHub Gist' + (SY.last ? ' · last ' + esc(new Date(SY.last).toLocaleString()) : '') + '.</p><div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn sm" data-act="ghsync">Sync now</button><button class="btn sm ghost" data-act="ghoff">Disconnect</button></div>';
  return '<p class="small mute" style="margin:6px 0 0">Saved on this phone, offline. To sync between phone and laptop for free, connect a private GitHub Gist: create a token at github.com → Settings → Developer settings → Personal access tokens → Tokens (classic), tick only <b>gist</b>, and paste it here. The token stays on this device.</p><label class="lab">GitHub token</label><input class="field" id="ghTok" type="password" autocomplete="off" placeholder="ghp_…"><button class="btn block" style="margin-top:10px" data-act="ghconnect">Connect & sync</button>';
}

/* ================= boot ================= */
if ('serviceWorker' in navigator && !EMBED && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(function () {}); }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
var startTab = location.hash.slice(1);
setTab(TABS.indexOf(startTab) >= 0 ? startTab : 'today', true);
if (T && T.run) loop();
setSync('local');
initCloud();
setInterval(function () { if (UI.tab === 'today' && !(T && T.run) && document.visibilityState === 'visible' && !document.activeElement.matches('textarea,input')) { var d = todayStr(); if (d !== setInterval.lastDay) { setInterval.lastDay = d; renderToday(); } } }, 60000);
setInterval.lastDay = todayStr();
window.TJApp = { PLAN: PLAN, state: function () { return S; } };
})();
