/* MKI Report app. Preview build: data lives in this browser only. */
(function () {
  'use strict';
  var I = window.icon, DB = window.DB;
  var $app = document.getElementById('app'), $layer = document.getElementById('layer');
  var LOGO = 'logo-white.svg';

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function S() { return DB.state; }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dObj(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function wd(key) { return dObj(key).toLocaleDateString('en-US', { weekday: 'long' }); }
  function md(key) { return dObj(key).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); }
  function shortDate(key) { return dObj(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function relDate(key) {
    var t = dObj(todayKey()), d = dObj(key), diff = Math.round((t - d) / 864e5);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday';
    if (diff < 7) return shortDate(key);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function toMin(hm) { var p = hm.split(':'); return +p[0] * 60 + +p[1]; }
  function fmt12(hm) { if (!hm) return ''; var m = toMin(hm), h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12; return h12 + ':' + String(mm).padStart(2, '0') + ' ' + ap; }
  function dur(a, b) { var x = toMin(a), y = toMin(b); var over = y <= x; var mins = (over ? y + 1440 : y) - x; return { mins: mins, over: over }; }
  function durText(mins) {
    if (mins % 60 === 0) return (mins / 60) + (mins === 60 ? ' hour' : ' hours');
    if (mins % 30 === 0) return (mins / 60).toFixed(1) + ' hours';
    var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + ' hrs ' : '') + m + ' min';
  }
  function hrsShort(mins) { return (mins % 30 === 0 ? (mins / 60).toString() : (mins / 60).toFixed(2).replace(/0$/, '')) + ' hrs'; }
  function person(id) { return S().people.filter(function (p) { return p.id === id; })[0] || { id: id, short: id, name: id, ini: '?', first: id }; }
  function job(num) { return S().jobs.filter(function (j) { return j.num === num; })[0]; }
  function jobName(r) { if (r.jobName) return r.jobName; var j = job(r.job); return j ? j.name : r.job; }
  function sentText(r) { var p = r.sentAt.split(':'), h = +p[0], ap = h >= 12 ? 'PM' : 'AM'; return (h % 12 || 12) + ':' + p[1] + ' ' + ap; }
  function flagsOf(r) { var f = []; if (r.sentDate && r.sentDate !== r.date) f.push(['Sent late', 'neutral']); if (r.mat.yes) f.push(['Materials', 'warn']); if (r.delay.yes) f.push(['Delay', 'warn']); if (r.safety.yes) f.push(['Safety', 'err']); if (!f.filter(function (x) { return x[1] !== 'neutral'; }).length) f.push(['All clear', 'ok']); return f; }
  function pill(t, k, sm) { var ic = k === 'ok' ? 'check' : k === 'err' ? 'alert-circle' : k === 'warn' ? 'alert-triangle' : null; return '<span class="pill ' + k + '">' + (ic ? I(ic, sm ? 13 : 14) : '') + esc(t) + '</span>'; }
  function offs() { return S().offs || (S().offs = []); }
  function isOff(pid, dk) { return offs().some(function (o) { return o.person === pid && o.date === dk; }); }
  /* Toast, from Dan's KachDan design system (toast component + usage guideline):
     a short title, an optional message, at most one action (like Undo) and a close button.
     Success, info and warning fade out after 7 seconds (paused while the pointer or focus is on it).
     Errors stay until closed. Stacked bottom right on desktop, bottom center on phones.
     toast('Saved.')  ·  toast('Saved.', undoFn)  ·  toast(title, { kind: 'error', msg: '...', action: { label, fn } }) */
  var TOAST_ICON = { success: 'circle-check', info: 'info', warning: 'alert-triangle', error: 'alert-circle', neutral: 'info' };
  function toastBox() {
    var b = document.getElementById('toasts');
    if (!b) { b = document.createElement('div'); b.id = 'toasts'; b.className = 'toasts'; document.body.appendChild(b); }
    return b;
  }
  function placeToasts() {} // Toasts sit at the top (KachDan Toast v1.1), clear of the bottom action bars.
  function toast(title, opt) {
    if (typeof opt === 'function') opt = { action: { label: 'Undo', fn: opt } };
    else if (typeof opt === 'string') opt = { kind: opt };
    opt = opt || {};
    var kind = opt.kind || 'success', box = toastBox();
    [].forEach.call(box.children, function (o) { if (o.dataset.key === title + (opt.msg || '')) o.remove(); });
    // Over the limit, drop the oldest toast that isn't an error: errors stay until someone closes them.
    while (box.children.length >= (window.innerWidth < 700 ? 2 : 3)) { var old = box.querySelector('.toast:not(.t-error)') || box.firstChild; old.remove(); }
    var t = document.createElement('div');
    t.className = 'toast t-' + kind; t.dataset.key = title + (opt.msg || '');
    t.setAttribute('role', kind === 'error' || kind === 'warning' ? 'alert' : 'status');
    t.innerHTML = '<span class="tstripe"></span><div class="tbody">' + I(TOAST_ICON[kind], 20) + '<div class="ttext"><b></b>' + (opt.msg ? '<p></p>' : '') + (opt.action ? '<button class="tact"></button>' : '') + '</div><button class="tclose" aria-label="Close">' + I('x', 16) + '</button></div>';
    t.querySelector('b').textContent = title;
    if (opt.msg) t.querySelector('p').textContent = opt.msg;
    var timer = null, left = 7000, started = 0;
    function close() { clearTimeout(timer); if (t.classList.contains('out')) return; t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }
    function run() { if (kind === 'error') return; started = Date.now(); timer = setTimeout(close, left); }
    function pause() { if (kind === 'error' || !timer) return; clearTimeout(timer); timer = null; left = Math.max(1500, left - (Date.now() - started)); }
    if (opt.action) { var ab = t.querySelector('.tact'); ab.textContent = opt.action.label; ab.onclick = function () { close(); opt.action.fn(); }; }
    t.querySelector('.tclose').onclick = close;
    t.addEventListener('mouseenter', pause); t.addEventListener('mouseleave', function () { if (!timer && !t.contains(document.activeElement)) run(); });
    t.addEventListener('focusin', pause); t.addEventListener('focusout', function () { if (!timer && !t.matches(':hover')) run(); });
    // Sit above a sticky action bar (GC report) so toasts never cover its buttons.
    box.appendChild(t); placeToasts(); run();
    return t;
  }
  // Field validation, from the KachDan input + field-label + field-hint components: the label, border and
  // hint all take the state together, and a status hint always pairs its color with an icon.
  var fmemo = {};
  function fieldState(id, theme, msg) {
    var c = document.getElementById(id); if (!c) return;
    // Page fields (not dialogs) keep their state when a live refresh redraws the same page.
    if (!$layer.contains(c)) { if (theme) fmemo[id] = { h: location.hash, t: theme, m: msg }; else delete fmemo[id]; }
    var f = c.closest('.fld'); if (!f) return;
    var h = f.querySelector('.fhint');
    if (!h) { h = document.createElement('div'); h.className = 'fhint'; h.id = id + '-hint'; f.appendChild(h); }
    if (!('base' in h.dataset)) h.dataset.base = h.textContent;
    f.classList.remove('is-err', 'is-warn');
    if (theme) { f.classList.add(theme === 'err' ? 'is-err' : 'is-warn'); h.innerHTML = I(theme === 'err' ? 'alert-circle' : 'alert-triangle', 14) + '<span></span>'; h.querySelector('span').textContent = msg; }
    else { h.textContent = h.dataset.base; }
    h.hidden = !h.textContent;
    c.setAttribute('aria-describedby', h.id);
    if (theme === 'err') c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
  }
  function validEmails(v) { var a = String(v || '').split(/[,;\s]+/).filter(Boolean); return { list: a, bad: a.filter(function (x) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); }) }; }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function closeLayer() { $layer.innerHTML = ''; document.body.style.overflow = ''; V = null; }
  var layerHist = false;
  function openLayer(html) {
    var was = !!$layer.firstChild; $layer.innerHTML = html; document.body.style.overflow = 'hidden';
    // Browser Back closes the open tray or dialog instead of leaving the page.
    if (!was && !layerHist) { history.pushState({ layer: 1 }, ''); layerHist = true; }
    var f = $layer.querySelector('input,textarea,select,button:not([data-act=close]):not(.dim)'); if (f && !('ontouchstart' in window)) setTimeout(function () { if ($layer.contains(f) && !$layer.contains(document.activeElement)) f.focus({ preventScroll: true }); }, 30);
  }
  function isWide() { return window.matchMedia('(min-width:700px)').matches; }

  var MAXP = 30, MAXV = 5, MAXVSEC = 180; // photos+videos per report, videos per report, seconds per video
  var VIDS = {}; // video files picked in this session (preview only keeps a still frame after reload)
  function isVid(p) { return !!p && typeof p === 'object' && !!p.v; }
  function thumbOf(p) { return p && typeof p === 'object' ? p.thumb : p; }
  function srcOf(p) { return p && typeof p === 'object' ? (p.src || (p.key && VIDS[p.key]) || p.thumb) : p; }
  var LIVE = window.LIVE || { on: false };
  // Saves to SharePoint in the background; if it fails the office sees a message and can try again.
  // Saves to SharePoint in the background. If it fails, the change is put back on screen so nobody thinks it saved.
  function sync(pr, okMsg, undo) { if (!LIVE.on || !pr) return; pr.then(function () { if (okMsg) toast(okMsg); }, function (e) { console.error(e); if (undo) undo(); toast('Not saved', { kind: 'error', msg: e && e.status === 403 ? 'Your account isn’t allowed to change that. Ask Alex to check your access.' : 'Couldn’t save that to SharePoint, so it was put back. Check your connection and try again.' }); }); }
  function mmss(sec) { sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function playBadge(p, sm) { return isVid(p) ? '<span class="vbadge' + (sm ? ' sm' : '') + '">' + I('play', sm ? 10 : 12, '#fff') + (sm ? '' : mmss(p.dur)) + '</span>' : ''; }
  function mediaCount(arr) { var v = (arr || []).filter(isVid).length, ph = (arr || []).length - v; return (ph ? ph + (ph === 1 ? ' photo' : ' photos') : '') + (ph && v ? ' · ' : '') + (v ? v + (v === 1 ? ' video' : ' videos') : '') || 'None'; }
  /* ---------------- draft ---------------- */
  function newDraft() { return { date: todayKey(), day: todayKey(), job: null, work: [''], mat: { yes: null, text: '' }, delay: { yes: null, text: '' }, safety: { yes: null, text: '' }, plan: [''], photos: [], weather: null, errors: null }; }
  function items(x) { return (Array.isArray(x) ? x : [x || '']).map(function (t) { return String(t || '').trim(); }).filter(Boolean); }
  function fixDraft(d) { if (!Array.isArray(d.work)) d.work = [d.work || '']; if (!Array.isArray(d.plan)) d.plan = [d.plan || '']; if (!d.work.length) d.work = ['']; if (!d.plan.length) d.plan = ['']; if (!d.day) d.day = d.date; return d; }
  function hasContent(d) { fixDraft(d); return !!(d.job || items(d.work).length || items(d.plan).length || d.photos.length || d.mat.yes !== null || d.delay.yes !== null || d.safety.yes !== null); }
  // An unsent report with anything in it is kept for up to 30 days (the late-report window), so a report
  // started Friday is still there Monday. Empty ones from earlier days start fresh.
  function draftAge(d) { return Math.round((dObj(todayKey()) - dObj(d.day || d.date)) / 864e5); }
  function D() { var s = S(), t = todayKey(); if (!s.draft || (s.draft.date !== t && !(hasContent(s.draft) && draftAge(s.draft) <= 30))) { s.draft = newDraft(); } return fixDraft(s.draft); }
  var saveT, warned = false, saveFailed = false; function saveNow() { clearTimeout(saveT); saveT = null; saveFailed = !DB.save(); return !saveFailed; } function saveSoon() { clearTimeout(saveT); saveT = setTimeout(function () { if (!saveNow() && !warned) { warned = true; toast('Phone almost full', { kind: 'warning', msg: 'Your report is kept while the app is open.' }); } }, 300); }

  /* ---------------- router ---------------- */
  function route() {
    route0();
    for (var k in fmemo) { if (fmemo[k].h !== location.hash) delete fmemo[k]; else if (document.getElementById(k)) fieldState(k, fmemo[k].t, fmemo[k].m); }
    placeToasts();
  }
  function route0() {
    if (LIVE.on && !LIVE.ready) return;
    closeLayer();
    var h = location.hash.replace(/^#\/?/, '') || '', parts = h.split('/');
    var isOffice = parts[0] === 'office';
    // Upright-only cover is for foremen. Office people (and sign-in) can turn the iPad sideways.
    document.body.classList.toggle('foreman', !isOffice && !!S().me && parts[0] !== 'signin' && S().role !== 'office');
    window.scrollTo(0, 0);
    var me = S().me;
    if (!isOffice) {
      if (parts[0] === 'signin' || !me) return renderSignin();
      if (parts[0] === 'report') return renderReport();
      if (parts[0] === 'sent') return renderSent(parts[1]);
      if (parts[0] === 'off') return renderOff(parts[1]);
      return renderStart();
    }
    if (LIVE.on && S().role !== 'office') return go(me ? '#/' : '#/signin');
    var page = parts[1] || 'today';
    if (page === 'today' || page === 'reports' || page === 'foremen' || page === 'jobs') backTo = page;
    if (page === 'reports') return office('reports', renderReports);
    if (page === 'report') return office('reports', function () { return renderDetail(parts[2]); });
    if (page === 'gc') return office('reports', function () { return renderGC(parts[2]); });
    if (page === 'jobs') return office('jobs', renderJobs);
    if (page === 'foremen') return office('foremen', renderForemen);
    return office('today', renderToday);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', function () { if (layerHist) { layerHist = false; if ($layer.firstChild) { closeLayer(); } } });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && e.target.dataset && e.target.dataset.li) { e.preventDefault(); var dk = D(), key = e.target.dataset.li, at = +e.target.dataset.i + 1; dk[key].splice(at, 0, ''); saveSoon(); refresh('q-' + key); focusItem(key, at); return; }
    if (e.key === 'Escape' && $layer.firstChild && !document.querySelector('.viewer')) { closeLayer(); return; }
    if (e.key === 'Tab' && $layer.firstChild) { var f = [].slice.call($layer.querySelectorAll('button:not([disabled]),input,select,textarea,[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } else if (!$layer.contains(document.activeElement)) { e.preventDefault(); a.focus(); } }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-go]')) go(e.target.dataset.go);
    if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-act]')) e.target.click();
  });

  function previewBar(active) {
    if (LIVE.on) return ''; // live: no strip. Office people switch with "Send a report" in the menu and "Back to office" on the start screen.
    return '<nav class="pv" aria-label="Preview"><span class="pvl">PREVIEW</span><a href="#/" class="' + (active === 'f' ? 'on' : '') + '">Foreman</a><a href="#/office" class="' + (active === 'o' ? 'on' : '') + '">Office</a></nav>';
  }

  /* ---------------- foreman: start ---------------- */
  function renderStart() {
    var k = todayKey(), me = person(S().me);
    var already = S().reports.filter(function (r) { return r.person === me.id && r.date === k; })[0];
    var dr = S().draft, open = dr && hasContent(dr) && draftAge(dr) <= 30 ? fixDraft(dr) : null;
    if (open) {
      var forDay = open.day === k ? 'today' : shortDate(open.day), stuck = !!open.sendKey;
      $app.innerHTML = previewBar('f') + '<main class="dark start"><div class="top"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><div class="tag">END OF DAY REPORT</div><p class="weekday">' + wd(k).toUpperCase() + '</p><p class="date">' + md(k).toUpperCase() + '</p></div>' +
        '<div class="bottom"><button class="go" data-act="start">' + (stuck ? 'FINISH SENDING' : 'FINISH YOUR REPORT') + ' ' + I('arrow-right', 22, '#990000') + '</button>' +
        '<p class="hint">' + (stuck ? 'Your report for ' + esc(forDay) + ' hasn’t reached the office yet. It’s saved on this ' + (isWide() ? 'iPad' : 'phone') + '. Open it and tap Send.' : 'You started a report for ' + esc(forDay) + (open.job ? ' (' + esc(open.job.name) + ')' : '') + ' and didn’t send it yet. Everything you added is still there.') + '</p>' +
        (open.day !== k ? '<p class="who"><button data-act="discard">Throw it away and start today’s</button></p>' : '') +
        '<p class="who">Signed in as ' + esc(me.name) + '. <button data-act="signout">Not you?</button></p>' + (LIVE.on && S().role === 'office' ? '<p class="who"><a href="#/office" class="u" style="color:inherit">Back to office</a></p>' : '') + '</div></main>';
      return;
    }
    $app.innerHTML = previewBar('f') + '<main class="dark start"><div class="top"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><div class="tag">END OF DAY REPORT</div><p class="weekday">' + wd(k).toUpperCase() + '</p><p class="date">' + md(k).toUpperCase() + '</p></div>' +
      '<div class="bottom"><button class="go" data-act="start">' + (already ? 'SEND ANOTHER REPORT' : "START TODAY'S REPORT") + ' ' + I('arrow-right', 22, '#990000') + '</button>' +
      '<p class="hint">' + (already ? 'You already sent one today for ' + esc(jobName(already)) + '. Send another only if you worked a second job.' : 'Takes about 3 minutes. Tap the microphone on your keyboard to talk instead of typing.') + '</p>' +
      '<p class="who">Signed in as ' + esc(me.name) + '. <button data-act="signout">Not you?</button></p>' + (LIVE.on && S().role === 'office' ? '<p class="who"><a href="#/office" class="u" style="color:inherit">Back to office</a></p>' : '') + '</div></main>';
  }

  /* ---------------- foreman: "I'm off today" (from the 7 PM reminder email) ---------------- */
  var offBusy = false;
  function renderOff(dk) {
    var k = todayKey(), me = person(S().me), back = dObj(k); back.setDate(back.getDate() - 6);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk || '') || dk > k || dObj(dk) < back) dk = k;
    var forDay = dk === k ? 'today' : wd(dk) + ', ' + md(dk);
    function page(head, hint, extra) {
      $app.innerHTML = previewBar('f') + '<main class="dark start"><div class="top"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><div class="tag">END OF DAY REPORT</div><p class="weekday">' + wd(dk).toUpperCase() + '</p><p class="date">' + md(dk).toUpperCase() + '</p></div>' +
        '<div class="bottom"><p class="offh">' + head + '</p><p class="hint">' + hint + '</p>' + (extra || '') +
        '<p class="who">Signed in as ' + esc(me.name) + '. <button data-act="signout">Not you?</button></p></div></main>';
    }
    var sent = S().reports.filter(function (r) { return r.person === me.id && r.date === dk; })[0];
    if (sent) return page('REPORT ALREADY SENT', 'You sent a report for ' + esc(forDay) + ' (' + esc(jobName(sent)) + '), so there’s nothing to mark.', '<button class="go" data-go="#/">DONE ' + I('arrow-right', 22, '#990000') + '</button>');
    var done = '<button class="go" data-act="start">SEND A REPORT ' + I('arrow-right', 22, '#990000') + '</button>';
    if (isOff(me.id, dk) && !offBusy) return page('YOU’RE MARKED OFF', 'No reminder for ' + esc(forDay) + '. The office sees you were off, not a missed report. Worked after all? Send a report below.', done + '<p class="who"><button data-act="offundo" data-day="' + dk + '">Undo, I’m not off</button></p>');
    if (offBusy) return page('SAVING…', 'One moment.');
    var now = new Date(), o = { id: 'off-' + dk + '-' + Math.random().toString(36).slice(2, 8), date: dk, person: me.id, personName: me.name, sentDate: k, sentAt: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') };
    if (!LIVE.on) { offs().push(o); DB.save(); return renderOff(dk); }
    offBusy = true; page('SAVING…', 'One moment.');
    LIVE.markOff(o).then(function () {
      offBusy = false; offs().push(o); DB.save();
      if (/^#\/off/.test(location.hash)) renderOff(dk);
    }, function () {
      offBusy = false;
      if (/^#\/off/.test(location.hash)) page('DIDN’T SAVE', 'Couldn’t reach the office. Check your signal and try again.', '<button class="go" data-act="offretry">TRY AGAIN ' + I('arrow-right', 22, '#990000') + '</button>');
    });
  }

  /* ---------------- foreman: sign in ---------------- */
  function renderSignin() {
    $app.innerHTML = previewBar('f') + '<main class="dark signin"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><h1>SIGN IN ONCE</h1><p>Use your MKI work account, the same one you use for email. You stay signed in on this phone after that.</p><div class="grow"></div>' +
      '<button class="msbtn" data-act="signin"><svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>Sign in with Microsoft</button>' +
      (LIVE.on ? '<p class="cap">Only MKI accounts can sign in.</p></main>' : '') + (LIVE.on ? '' : '<p class="cap">Preview: this signs you in as Andy Harbin, a sample foreman. Nothing is sent anywhere. <button class="u" style="color:inherit;font:inherit;padding:12px 0;margin:-12px 0" data-act="resetdemo">Start over with fresh sample data</button></p></main>');
  }

  /* ---------------- foreman: report ---------------- */
  function qLabel(n, t, extra) { return '<div class="ql-l"><span class="n">' + n + '</span><span>' + t + '</span>' + (extra || '') + '</div>'; }
  function emsg(t) { return '<div class="emsg">' + I('alert-circle', 16) + esc(t) + '</div>'; }

  function hoursCard(d, e) {
    var hasS = !!d.start, hasF = !!d.finish, sum = 'No times yet', over = false;
    if (hasS && hasF) { var x = dur(d.start, d.finish); over = x.over; sum = (over ? 'Overnight · ' : '') + durText(x.mins) + ' on site'; }
    return '<section class="card' + (e.hours ? ' bad' : '') + '" id="q-hours">' + qLabel(2, 'HOURS ON SITE') +
      '<div class="times"><button class="tbox' + (hasS ? ' has' : '') + '" data-act="time" data-k="start"><span class="l">START</span><span class="v">' + (hasS ? fmt12(d.start) : 'Tap to pick') + '</span></button>' + I('arrow-right', 18, '#6B6262') +
      '<button class="tbox' + (hasF ? ' has' : '') + '" data-act="time" data-k="finish"><span class="l">FINISH</span><span class="v">' + (hasF ? fmt12(d.finish) : 'Tap to pick') + (over ? '<span class="nd">NEXT DAY</span>' : '') + '</span></button></div>' +
      '<div class="tfoot"><span class="s' + (hasS && hasF ? ' has' : '') + '">' + I(over ? 'moon' : 'clock', 16) + '<span>' + sum + '</span></span><button class="same" data-act="same">Same as yesterday</button></div>' +
      (e.hours ? emsg(e.hours) : '') + '</section>';
  }
  function crewCard(d, e) {
    return '<section class="card' + (e.crew ? ' bad' : '') + '" id="q-crew">' + qLabel(3, 'CREW ON SITE') +
      '<div class="step"><button data-act="crew" data-d="-1" aria-label="One less">' + I('minus', 22) + '</button><div class="num' + (d.crew ? '' : ' zero') + '" id="crewn">' + d.crew + '</div><button data-act="crew" data-d="1" aria-label="One more">' + I('plus', 22) + '</button></div>' +
      '<div class="help">Count everyone on site today, you included.</div>' + (e.crew ? emsg(e.crew) : '') + '</section>';
  }
  function textCard(n, key, title, d, e, ph) {
    return '<section class="card' + (e[key] ? ' bad' : '') + '" id="q-' + key + '">' + qLabel(n, title) +
      '<textarea aria-label="' + title + '" data-f="' + key + '" placeholder="' + (ph || 'Type or tap the mic to talk') + '" rows="4">' + esc(d[key]) + '</textarea>' +
      '<div class="mic">' + I('mic', 16) + 'Tap the mic on your keyboard to talk</div>' + (e[key] ? emsg(e[key]) : '') + '</section>';
  }
  function ynCard(n, key, title, d, e, detail) {
    var v = d[key];
    return '<section class="card' + (e[key] ? ' bad' : '') + '" id="q-' + key + '">' + qLabel(n, title) +
      '<div class="yn" role="radiogroup" aria-label="' + title + '"><button class="' + (v.yes === false ? 'on' : '') + '" data-act="yn" role="radio" aria-checked="' + (v.yes === false) + '" data-k="' + key + '" data-v="0">' + (v.yes === false ? I('check', 16) : '') + 'NO</button><button class="' + (v.yes === true ? 'on' : '') + '" data-act="yn" role="radio" aria-checked="' + (v.yes === true) + '" data-k="' + key + '" data-v="1">' + (v.yes === true ? I('check', 16) : '') + 'YES</button></div>' +
      (v.yes ? '<div class="dl">' + detail + '</div><textarea class="sm" data-f="' + key + '.text" placeholder="Type or tap the mic to talk" rows="3">' + esc(v.text) + '</textarea>' : '') +
      (e[key] ? emsg(e[key]) : '') + '</section>';
  }
  function photosCard(d) {
    var tiles = d.photos.map(function (p, i) { var th = thumbOf(p); return '<div class="tile"' + (th ? ' style="background-image:url(' + th + ')"' : '') + '><button class="tile-open" data-act="viewer" data-id="draft" data-i="' + i + '" aria-label="Open ' + (isVid(p) ? 'video' : 'photo') + ' ' + (i + 1) + '"></button>' + playBadge(p) + '<button class="rm" data-act="rmphoto" data-i="' + i + '" aria-label="Remove ' + (isVid(p) ? 'video' : 'photo') + '">' + I('x', 14, '#fff') + '</button></div>'; }).join('');
    return '<section class="card" id="q-photos"><div class="ph-h">' + qLabel(8, 'PHOTOS AND VIDEOS') + '<span class="help" style="font-weight:500">' + d.photos.length + ' of ' + MAXP + ' · optional</span></div>' +
      '<div class="grid">' + tiles + (d.photos.length < MAXP ? '<label class="addt">' + I('camera', 24) + 'Add<input type="file" accept="image/*,video/*" multiple class="sr" data-act="photos"></label>' : '') + '</div>' +
      '<div class="help">Videos can be up to 3 minutes each, ' + MAXV + ' per report.</div></section>';
  }

  function dayLabel(k) { var diff = Math.round((dObj(todayKey()) - dObj(k)) / 864e5); var long = wd(k) + ', ' + dObj(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); return diff === 0 ? 'Today · ' + long : diff === 1 ? 'Yesterday · ' + long : long; }
  function dateCard(d, e) {
    var late = d.day !== todayKey();
    return '<section class="card" id="q-date">' + qLabel(1, 'REPORT DATE') +
      '<button class="select has" data-act="dates">' + I('calendar', 20, '#6B6262') + '<span class="v">' + dayLabel(d.day) + '</span>' + I('chevron-down', 20, '#6B6262') + '</button>' +
      (late ? '<span class="jobtag">' + I('clock', 13) + 'Late report · the office will see it was sent today</span>' : '<div class="help">Forgot a day? Tap to pick an earlier date.</div>') + '</section>';
  }
  function listCard(n, key, title, d, e, add) {
    var arr = d[key];
    var rows = arr.map(function (v, i) {
      return '<div class="li-row"><span class="li-n">' + (i + 1) + '.</span><textarea class="li" rows="1" aria-label="' + title + ', item ' + (i + 1) + '" data-f="' + key + '.' + i + '" data-li="' + key + '" data-i="' + i + '" placeholder="' + (i === 0 ? 'Type or tap the mic to talk' : 'Next item') + '" enterkeyhint="next">' + esc(v) + '</textarea>' +
        (arr.length > 1 ? '<button class="li-x" data-act="rmitem" data-k="' + key + '" data-i="' + i + '" aria-label="Remove item ' + (i + 1) + '">' + I('x', 16) + '</button>' : '') + '</div>';
    }).join('');
    return '<section class="card' + (e[key] ? ' bad' : '') + '" id="q-' + key + '">' + qLabel(n, title) + '<div class="li-list">' + rows + '</div>' +
      '<button class="li-add" data-act="additem" data-k="' + key + '">' + I('plus', 18) + add + '</button>' +
      '<div class="mic">' + I('mic', 16) + 'One task per line. Tap the mic on your keyboard to talk</div>' + (e[key] ? emsg(e[key]) : '') + '</section>';
  }
  function jobCard(d, e) {
    var j = d.job;
    return '<section class="card' + (e.job ? ' bad' : '') + '" id="q-job">' + qLabel(2, 'JOB') +
      '<button class="select' + (j ? ' has' : '') + '" data-act="jobs">' + I('briefcase', 20, '#6B6262') + '<span class="v">' + (j ? esc(j.name) : 'Choose a job') + '</span>' + I('chevron-down', 20, '#6B6262') + '</button>' +
      (j && j.requested ? '<span class="jobtag">' + I('clock', 13) + 'New job · the office will confirm the name</span>' : '') +
      (e.job ? emsg(e.job) : '') + '</section>';
  }

  /* Update only the card that changed, so the page never re-draws or jumps under your thumb. */
  var CARD = {
    'q-job': function (d, e) { return jobCard(d, e); },
    'q-date': function (d, e) { return dateCard(d, e); },
    'q-work': function (d, e) { return listCard(3, 'work', 'WORK COMPLETED TODAY', d, e, 'Add another task'); },
    'q-plan': function (d, e) { return listCard(7, 'plan', 'PLAN FOR NEXT WORKDAY', d, e, 'Add another task'); },
    'q-mat': function (d, e) { return ynCard(4, 'mat', 'MATERIALS, EQUIPMENT, OR INSPECTIONS', d, e, 'What’s needed?'); },
    'q-delay': function (d, e) { return ynCard(5, 'delay', 'WEATHER, SITE, OR OTHER-TRADE DELAYS', d, e, 'What happened?'); },
    'q-safety': function (d, e) { return ynCard(6, 'safety', 'SAFETY OR QUALITY ISSUES', d, e, 'What happened?'); },
    'q-photos': function (d) { return photosCard(d); }
  };
  function updateBanner() {
    var d = D(), n = d.errors ? Object.keys(d.errors).length : 0, b = document.getElementById('banner');
    if (!b) return;
    if (!n) { b.remove(); d.errors = null; return; }
    b.innerHTML = I('alert-circle', 20) + (n === 1 ? '1 answer is missing. It’s marked below.' : n + ' answers are missing. They’re marked below.');
  }
  function refresh(id) {
    var el = document.getElementById(id), d = D();
    if (!el || !CARD[id]) { var y = window.scrollY; renderReport(); window.scrollTo(0, y); return; }
    var top = el.getBoundingClientRect().top;
    el.outerHTML = CARD[id](d, d.errors || {});
    var nc = document.getElementById(id); if (nc) [].forEach.call(nc.querySelectorAll('textarea'), autoGrow);
    if (id === 'q-job') { var wx = document.querySelector('.wx'); if (wx) wx.innerHTML = I('sun', 16, '#6B6262') + wxText(d); if (d.job && d.weather == null) getWeather(); }
    updateBanner();
    var n = document.getElementById(id); if (n) { var dy = n.getBoundingClientRect().top - top; if (Math.abs(dy) > 0.5) window.scrollBy(0, dy); }
  }
  function wxText(d) {
    if (!d.job) return 'Weather is added for you once you pick a job';
    if (d.weather === null || d.weather === undefined) return 'Getting the weather for the job site…';
    if (!d.weather) return d.day === todayKey() ? 'Weather isn’t available right now. It’s checked again when you send.' : 'Weather records aren’t available for that day.';
    return esc(d.weather) + ' · added for you';
  }
  function renderReport() {
    var d = D(), e = d.errors || {}, k = d.day, me = person(S().me);
    var nErr = Object.keys(e).length;
    var wx = wxText(d);
    var wide = isWide();
    var head = '<header class="fh"><div class="fhtop"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><a class="fback" href="#/">' + I('chevron-left', 18, '#fff') + 'Back</a></div><div class="wd">' + (wd(k) + ', ' + md(k)).toUpperCase() + '</div><h1 class="dt">HI, ' + esc(String(me.first || '').toUpperCase()) + '</h1></header>';
    var work = CARD['q-work'](d, e), mat = CARD['q-mat'](d, e), delay = CARD['q-delay'](d, e), safety = CARD['q-safety'](d, e), plan = CARD['q-plan'](d, e);
    // Once sending has started, the report is locked so what reaches the office and the PDF record always match.
    var locked = !!d.sendKey;
    var pend = locked && !sending ? '<div class="banner pend">' + I('alert-circle', 20) + '<span>Not sent yet. It’s saved on this ' + (isWide() ? 'iPad' : 'phone') + ' and locked so it can’t change halfway. Tap Send when you have signal. <button class="u" data-act="discard">Throw it away and start over</button></span></div>' : '';
    var body = pend + (nErr ? '<div class="banner" id="banner">' + I('alert-circle', 20) + (nErr === 1 ? '1 answer is missing. It’s marked below.' : nErr + ' answers are missing. They’re marked below.') + '</div>' : '') +
      (locked ? '<div class="lockwrap" inert>' : '') +
      '<div class="pair">' + dateCard(d, e) + jobCard(d, e) + '</div>' + '<div class="wx">' + I('sun', 16, '#6B6262') + wx + '</div>' +
      '<div class="cols"><div class="col">' + work + plan + '</div><div class="col">' + mat + delay + safety + '</div></div>' +
      photosCard(d) + (locked ? '</div>' : '') +
      '<div class="sendrow"><p class="help" style="margin:0">' + (d.sendKey ? 'Not sent yet. The report is locked until it goes through.' : 'Goes to the office right away. Photos go in the job folder.') + '</p><button class="btn btn-primary" data-act="send">SEND REPORT</button></div>';
    // phone order: work, materials, delays, safety, plan (cols use display:contents, so reorder for phone)
    if (!wide) body = body.replace('<div class="cols"><div class="col">' + work + plan + '</div><div class="col">' + mat + delay + safety + '</div></div>', work + mat + delay + safety + plan);
    $app.innerHTML = previewBar('f') + head + '<main class="ql">' + body + '</main>';
    if (d.job && d.weather == null) getWeather();
    if (LIVE.on && window.GC) GC.preload();
    [].forEach.call(document.querySelectorAll('textarea'), autoGrow);
  }

  /* Weather from the National Weather Service (free, no key). The job site address is turned into a
     map point (OpenStreetMap), the nearest NWS station is found for it, and that station's readings for
     the report day are summed up: conditions and low to high temperature. Jobs without an address fall
     back to Charlotte and say so. Works for late reports too, as far back as NWS keeps readings (about a week). */
  var HOME = { lat: 35.2271, lon: -80.8431 };
  function wxCache(k, v) {
    try { var c = JSON.parse(localStorage.getItem('mki-wx-cache') || '{}'); if (v === undefined) return c[k]; c[k] = v; localStorage.setItem('mki-wx-cache', JSON.stringify(c)); } catch (e) { return undefined; }
  }
  function getJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 8000);
    return fetch(url, { headers: { Accept: 'application/geo+json, application/json' }, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, function (e) { clearTimeout(tm); throw e; });
  }
  function jobAddress(dj) { if (!dj) return ''; if (dj.requested) return dj.addr || ''; var j = job(dj.num); return (j && j.address) || ''; }
  function geocode(addr) {
    if (!addr) return Promise.resolve(null);
    var k = 'g:' + addr.toLowerCase(), c = wxCache(k); if (c) return Promise.resolve(c);
    // Only places in the Carolinas count, so a stray word can't put the weather in another state.
    return getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&viewbox=-84.4,36.6,-75.4,32.0&bounded=1&q=' + encodeURIComponent(addr)).then(function (a) {
      if (!a || !a[0]) return null; var v = { lat: +(+a[0].lat).toFixed(4), lon: +(+a[0].lon).toFixed(4) }; wxCache(k, v); return v;
    }).catch(function () { return null; });
  }
  function station(pt) {
    var k = 's:' + pt.lat + ',' + pt.lon, c = wxCache(k); if (c) return Promise.resolve(c);
    return getJSON('https://api.weather.gov/points/' + pt.lat + ',' + pt.lon).then(function (j) {
      var rl = j.properties.relativeLocation && j.properties.relativeLocation.properties, town = rl ? rl.city + ', ' + rl.state : '';
      return getJSON(j.properties.observationStations).then(function (sj) {
        var f = sj.features && sj.features[0]; if (!f) throw new Error('No weather station');
        var v = { id: f.properties.stationIdentifier, town: town }; wxCache(k, v); return v;
      });
    });
  }
  function summarize(obs) {
    var temps = [], count = {};
    obs.forEach(function (o) {
      var p = o.properties || {}, c = p.temperature && p.temperature.value, t = (p.textDescription || '').trim();
      if (c != null) temps.push(Math.round(c * 9 / 5 + 32));
      if (t) count[t] = (count[t] || 0) + 1;
    });
    if (!temps.length && !Object.keys(count).length) return '';
    var byFreq = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
    var main = byFreq[0] || '', wet = byFreq.filter(function (t) { return /rain|drizzle|shower|thunder|storm|snow|sleet|freezing|ice/i.test(t); })[0];
    var txt = main + (wet && wet !== main ? ', ' + wet.toLowerCase() + ' at times' : '');
    if (temps.length) { var lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps); txt += (txt ? ', ' : '') + (lo === hi ? hi + '°F' : lo + '–' + hi + '°F'); }
    return txt;
  }
  // Promise of the weather line for a job and day, or '' if it can't be found.
  function dayWeather(dj, day) {
    var addr = jobAddress(dj);
    return geocode(addr).then(function (pt) {
      return station(pt || HOME).then(function (st) {
        // Workday only (6 AM to 6 PM), so a cold night or early fog doesn't describe the day on site.
        var start = dObj(day); start.setHours(6, 0, 0, 0); var end = dObj(day); end.setHours(18, 0, 0, 0); if (end > new Date()) end = new Date(); if (end <= start) { start = dObj(day); start.setHours(0, 0, 0, 0); }
        return getJSON('https://api.weather.gov/stations/' + st.id + '/observations?start=' + encodeURIComponent(start.toISOString()) + '&end=' + encodeURIComponent(end.toISOString())).then(function (j) {
          var t = summarize(j.features || []); if (!t) return '';
          return t + ' · ' + (pt ? (st.town || 'job site') : addr ? 'Charlotte, NC (job address not found)' : 'Charlotte, NC (no job address on file)');
        });
      });
    }).catch(function () { return ''; });
  }
  var wxBusy = null;
  function getWeather() {
    var d = D(), key = (d.job ? (d.job.num || d.job.name) : '') + '|' + d.day;
    if (!d.job || wxBusy === key) return; wxBusy = key;
    dayWeather(d.job, d.day).then(function (w) {
      var dd = D(); if (wxBusy !== key) return; wxBusy = null;
      if ((dd.job ? (dd.job.num || dd.job.name) : '') + '|' + dd.day !== key) return;
      dd.weather = w || ''; saveSoon();
      var el = document.querySelector('.wx'); if (el && location.hash.indexOf('report') > -1) el.innerHTML = I('sun', 16, '#6B6262') + wxText(dd);
    });
  }

  function wxTemp(w) { var m = String(w || '').match(/-?\d+(?:–-?\d+)?°F?/); return m ? m[0] : ''; }
  function wxRest(w) { return String(w || '').replace(/,?\s*-?\d+(?:–-?\d+)?°F?/, '').replace(/^\s*·\s*/, '').trim(); }
  function validate(d) {
    var e = {};
    if (!d.job) e.job = 'Pick a job';
    if (!items(d.work).length) e.work = 'Add at least one thing that got done';
    ['mat', 'delay', 'safety'].forEach(function (k) { if (d[k].yes === null) e[k] = 'Pick yes or no'; else if (d[k].yes && !d[k].text.trim()) e[k] = 'Add a few words'; });
    if (!items(d.plan).length) e.plan = 'Add at least one thing for next workday';
    return e;
  }

  var sending = false, stopSend = false;
  function send() {
    var d = D(), e = validate(d);
    if (Object.keys(e).length) {
      d.errors = e; renderReport();
      var b = document.getElementById('banner'); if (b) window.scrollTo(0, b.getBoundingClientRect().top + window.scrollY - 16);
      return;
    }
    if (sending) return; sending = true; stopSend = false;
    // The weather is read again when Send is tapped, so it covers the whole day so far, not just the morning.
    busy(-2);
    var wx = d.sendKey && d.weather != null ? Promise.resolve(d.weather) : Promise.race([dayWeather(d.job, d.day), new Promise(function (r) { setTimeout(function () { r(null); }, 5000); })]);
    wx.then(function (w) { if (w) d.weather = w; else if (d.weather == null) d.weather = ''; saveSoon(); if (stopSend) { sending = false; return; } finishSend(d); });
  }
  function finishSend(d) {
    var now = new Date(), s = S();
    // The report's ID and send time are fixed on the first try, so trying again never makes a second report or folder.
    if (!d.sendKey) { d.sendKey = { id: 'r' + now.getTime() + Math.random().toString(36).slice(2, 6), sentAt: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), sentDate: todayKey() }; d.uploaded = []; DB.save(); }
    var id = d.sendKey.id;
    var rep = { id: id, date: d.day, sentDate: d.sendKey.sentDate, person: s.me, job: d.job.num || ('new:' + d.job.name), jobName: d.job.num ? null : d.job.name, sentAt: d.sendKey.sentAt,
      weather: d.weather || '', work: items(d.work), mat: { yes: d.mat.yes, text: d.mat.yes ? d.mat.text.trim() : '' }, delay: { yes: d.delay.yes, text: d.delay.yes ? d.delay.text.trim() : '' }, safety: { yes: d.safety.yes, text: d.safety.yes ? d.safety.text.trim() : '' }, plan: items(d.plan), photos: d.photos.length, videos: d.photos.filter(isVid).length, photoData: d.photos.slice(0, MAXP) };
    if (LIVE.on) return sendLive(d, rep);
    sending = false; closeLayer();
    if (d.job.requested) s.requests.push({ id: 'q' + now.getTime(), name: d.job.name, by: s.me, date: todayKey(), note: d.job.addr || '' });
    s.reports.unshift(rep);
    s.draft = null;
    // Keep the newest photos; if storage is full, drop photo copies from older reports first, then this one's.
    var ok = DB.save();
    if (!ok) { s.reports.forEach(function (r) { if (r !== rep) r.photoData = []; }); ok = DB.save(); }
    if (!ok) { rep.photoData = []; ok = DB.save(); }
    if (!ok) { s.reports.shift(); s.draft = d; toast('Report not sent', { kind: 'error', msg: 'This phone is out of space. Nothing was lost. Free up some space and try again.' }); return; }
    go('#/sent/' + id);
  }

  function busy(n, total, frac) {
    var el = document.getElementById('busytxt');
    if (!el) { openLayer('<div class="busy" role="status" aria-live="polite"><div class="spin"></div><p id="busytxt"></p><div class="bar"><span id="busybar"></span></div><p class="bnote">Keep the app open until it says sent.</p>' + (LIVE.on ? '<button class="bcancel" data-act="cancelsend">Stop</button>' : '') + '</div>'); el = document.getElementById('busytxt'); }
    el.textContent = n === -2 ? 'Getting the weather…' : n === -1 ? 'Sending the report…' : n === 0 ? 'Sending…' : 'Uploading ' + n + ' of ' + total + '…';
    var b = document.getElementById('busybar'); if (b) b.style.width = Math.round((n === -1 ? 1 : frac || 0) * 100) + '%';
  }
  function sendLive(d, rep) {
    var s = S(), media = d.photos.filter(function (p) { return p && typeof p === 'object' && p.key; });
    rep.note = d.job.requested ? (d.job.addr || '') : '';
    rep.photoData = d.photos.map(function (p) { return typeof p === 'object' ? { v: p.v, key: p.key, thumb: p.thumb, dur: p.dur } : { thumb: p }; });
    busy(0);
    var tried = !!d.triedOnce; d.triedOnce = true; DB.save();
    rep.taken = d.photos.map(function (p) { return (p && p.taken) || null; });
    LIVE.sendReport(rep, media, busy, {
      tried: tried, uploaded: (d.uploaded || []).slice(),
      makeRecord: function () { var el = document.getElementById('busytxt'); if (el) el.textContent = 'Making the PDF record…'; return recordPdf(rep, d.photos); },
      onUploaded: function (i) { d.uploaded = d.uploaded || []; if (d.uploaded.indexOf(i) < 0) d.uploaded.push(i); saveSoon(); }
    }).then(function () {
      sending = false; closeLayer();
      s.reports.unshift(rep); s.draft = null; LIVE.requests(); DB.save();
      media.forEach(function (m) { LIVE.blobs.del(m.key).catch(function () {}); });
      go('#/sent/' + rep.id);
    }, function (e) {
      sending = false; console.error(e);
      if (e && e.cancelled) { closeLayer(); toast('Sending stopped', { kind: 'info', msg: 'Your report is saved here. Tap Send when you’re ready.' }); renderReport(); return; }
      var off = navigator.onLine === false || (e && e.network);
      var done = (d.uploaded || []).length, tot = media.length;
      closeLayer();
      openLayer('<div class="busy failed" role="alertdialog" aria-labelledby="ft"><div class="ficon">' + I('alert-circle', 34, '#fff') + '</div><h2 id="ft">NOT SENT YET</h2>' +
        '<p>' + (off ? 'The signal dropped' + (e && e.timeout ? ' and the upload timed out' : '') + '.' : 'Microsoft didn’t accept the report' + (e && e.status ? ' (error ' + e.status + ')' : '') + '.') + ' Your report is saved on this ' + (isWide() ? 'iPad' : 'phone') + (tot ? ', and ' + done + ' of ' + tot + ' photos already made it, so trying again picks up where it stopped.' : '.') + '</p>' +
        '<button class="btn btn-white" data-act="send">TRY AGAIN</button><button class="u lbtn" data-act="close">Close, I’ll send it later</button></div>');
      renderReport();
    });
  }

  /* ---------------- foreman: sent ---------------- */
  function renderSent(id) {
    var r = S().reports.filter(function (x) { return x.id === id; })[0];
    if (!r) return go('#/');
    var me = person(r.person), fl = [];
    if (r.mat.yes) fl.push('Needs materials'); if (r.delay.yes) fl.push('Delay'); if (r.safety.yes) fl.push('Safety');
    $app.innerHTML = previewBar('f') + '<main class="dark sent"><div class="okc">' + I('check', 38, '#fff') + '</div><h1>REPORT SENT</h1><p class="sub">' + (r.sentDate && r.sentDate !== r.date ? 'Your report for ' + shortDate(r.date) + ' is in. Thanks, ' : 'You’re done for today. Thanks, ') + esc(me.first) + '.</p>' +
      '<div class="sum"><div><span>Job</span><b>' + esc(jobName(r)) + '</b></div><div><span>Report for</span><b>' + shortDate(r.date) + '</b></div><div><span>Sent</span><b>' + shortDate(r.sentDate || r.date) + ' · ' + sentText(r) + '</b></div><div><span>Photos & videos</span><b>' + (r.photoData && r.photoData.length ? mediaCount(r.photoData) : ((r.photos ? r.photos + (r.photos === 1 ? ' photo' : ' photos') : '') + (r.photos && r.videos ? ' · ' : '') + (r.videos ? r.videos + (r.videos === 1 ? ' video' : ' videos') : '') || 'None')) + '</b></div><div><span>Flagged</span><b>' + (fl.length ? fl.join(', ') : 'Nothing') + '</b></div></div>' +
      '<div class="grow"></div><button class="btn btn-white" data-act="done">DONE</button><p class="cap">Next time you open the app it starts fresh.</p></main>';
  }

  /* ---------------- report date tray ---------------- */
  function keyOf(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function openDates() {
    var d = D(), t = dObj(todayKey()), rows = '';
    for (var i = 0; i < 7; i++) { var x = new Date(t); x.setDate(x.getDate() - i); var k = keyOf(x), sent = S().reports.some(function (r) { return r.person === S().me && r.date === k; });
      rows += '<button class="jrow' + (d.day === k ? ' on' : '') + '" data-act="pickday" data-day="' + k + '"><b>' + dayLabel(k) + '</b>' + (sent ? '<span>' + I('check', 13) + ' You already sent a report for this day</span>' : '') + '</button>'; }
    var min = new Date(t); min.setDate(min.getDate() - 30);
    openLayer('<div class="dim" data-act="close"></div><div class="tray sheet narrow" role="dialog" aria-label="Report date"><div class="th"><h2>Which day is this for?</h2><button class="btn btn-tertiary" data-act="close">CANCEL</button></div>' +
      '<div class="scroll">' + rows + '</div><div class="fld"><label for="pd">Older date</label><input id="pd" type="date" min="' + keyOf(min) + '" max="' + todayKey() + '" value="' + d.day + '"></div></div>');
  }
  function focusItem(k, i) { var el = document.querySelector('[data-f="' + k + '.' + i + '"]'); if (el) el.focus({ preventScroll: false }); }

  /* ---------------- job tray ---------------- */
  function recentJobs() {
    var me = S().me, seen = {}, out = [];
    S().reports.forEach(function (r) { if (r.person === me && !seen[r.job] && job(r.job) && job(r.job).active && out.length < 2) { seen[r.job] = 1; out.push({ j: job(r.job), when: relDate(r.date) }); } });
    return out;
  }
  function jobTray(q) {
    q = (q || '').trim().toLowerCase();
    var act = S().jobs.filter(function (j) { return j.active; }), cur = D().job, rows;
    function row(j, sub) { return '<button class="jrow' + (cur && cur.num === j.num ? ' on' : '') + '" data-act="pickjob" data-num="' + esc(j.num) + '"><b>' + esc(j.name) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</button>'; }
    if (q) {
      var m = act.filter(function (j) { return (j.name + ' ' + j.num).toLowerCase().indexOf(q) > -1; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      rows = '<div class="sl">Results</div>' + (m.length ? m.map(function (j) { return row(j); }).join('') : '<div class="empty">No job matches “' + esc(q) + '”. You can request it below.</div>');
    } else {
      var rec = recentJobs(), recNums = rec.map(function (x) { return x.j.num; });
      rows = (rec.length ? '<div class="sl">Your recent jobs</div>' + rec.map(function (x) { return row(x.j, x.when); }).join('') : '') +
        (act.length ? '' : '<div class="empty">No active jobs right now. Request the job below and the office will add it.</div>') + (act.length ? '<div class="sl">All jobs (A–Z)</div>' : '') + act.filter(function (j) { return recNums.indexOf(j.num) < 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (j) { return row(j); }).join('');
    }
    return rows + '<button class="reqlink" data-act="reqjob">' + I('plus', 18) + 'Job not listed? Request a new job</button>';
  }
  var lastJobQ = '';
  function openJobs(q) {
    q = q || '';
    openLayer('<div class="dim" data-act="close"></div><div class="tray sheet" role="dialog" aria-label="Choose a job"><div class="th"><h2>Choose a job</h2><button class="btn btn-tertiary" data-act="close">CANCEL</button></div>' +
      '<div class="search">' + I('search', 20, '#6B6262') + '<input type="search" aria-label="Search jobs" placeholder="Search jobs" data-act="jobq" autocomplete="off" value="' + esc(q) + '"></div><div class="scroll" id="jlist">' + jobTray(q) + '</div></div>');
  }
  function openReqJob(prefill) {
    openLayer('<div class="dim" data-act="close"></div><div class="tray sheet" role="dialog" aria-label="New job"><div class="th"><h2>New job</h2><button class="btn btn-tertiary" data-act="jobs">BACK</button></div>' +
      '<div class="fld"><label for="nj">Job name</label><input id="nj" maxlength="80" value="' + esc(prefill || '') + '" placeholder="e.g. Cornelius Fire Station 4" autocomplete="off"></div>' +
      '<div class="fld"><label for="na">Job site address (optional)</label><input id="na" placeholder="Street and town, e.g. 21440 Catawba Ave, Cornelius" autocomplete="off"></div>' +
      '<div class="note">' + I('info', 20) + '<span>The office checks the name so every report for this job lands in the same folder. You can send your report right away.</span></div>' +
      '<button class="btn btn-primary" data-act="usejob">USE THIS JOB</button></div>');
    setTimeout(function () { var i = document.getElementById('nj'); if (i && isWide()) i.focus(); }, 50);
  }

  /* ---------------- time tray ---------------- */
  var TT = null;
  function parseT(buf, ap) {
    if (!buf) return { ok: false };
    var h, m;
    if (buf.length <= 2) { h = +buf; m = 0; } else if (buf.length === 3) { h = +buf[0]; m = +buf.slice(1); } else { h = +buf.slice(0, 2); m = +buf.slice(2); }
    if (m > 59 || h > 23) return { ok: false, bad: true };
    var h24, autoPM = false;
    if (h >= 13 || (buf.length === 4 && h === 12)) { h24 = h; autoPM = true; } else if (h === 0) { h24 = 0; } else { h24 = ap === 'PM' ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h); }
    var shown = (h24 % 12 || 12) + ':' + String(m).padStart(2, '0');
    return { ok: true, hm: String(h24).padStart(2, '0') + ':' + String(m).padStart(2, '0'), shown: shown, ap: h24 >= 12 ? 'PM' : 'AM', autoPM: autoPM || h === 0 };
  }
  function openTime(k) {
    var d = D(), cur = d[k];
    var ap = cur ? (toMin(cur) >= 720 ? 'PM' : 'AM') : (k === 'start' ? 'AM' : 'PM');
    var buf = '';
    if (cur) { var mm = toMin(cur), h12 = Math.floor(mm / 60) % 12 || 12; buf = String(h12) + String(mm % 60).padStart(2, '0'); }
    TT = { k: k, buf: buf, ap: ap, fresh: !!cur };
    drawTime();
  }
  function drawTime() {
    var p = parseT(TT.buf, TT.ap), ap = p.ok && p.autoPM ? p.ap : TT.ap, d = D();
    var shown = TT.buf ? (p.ok ? p.shown : (TT.buf.length > 2 ? TT.buf.slice(0, TT.buf.length - 2) + ':' + TT.buf.slice(-2) : TT.buf)) : (TT.k === 'start' ? '7:00' : '3:30');
    var over = false, note = '';
    if (p.ok && TT.k === 'finish' && d.start) { var x = dur(d.start, p.hm); over = x.over; if (over) note = 'Started ' + fmt12(d.start) + ', finishing ' + fmt12(p.hm) + '. That’s overnight, so it counts as ' + durText(x.mins) + ' ending the next morning.'; }
    if (p.ok && TT.k === 'start' && d.finish) { var y = dur(p.hm, d.finish); if (y.over) note = 'Finish is ' + fmt12(d.finish) + ', so this counts as an overnight shift (' + durText(y.mins) + ').'; }
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (n) { return '<button data-act="key" data-k="' + n + '">' + n + '</button>'; }).join('') +
      '<button class="fn" data-act="key" data-k="clear">Clear</button><button data-act="key" data-k="0">0</button><button class="fn" data-act="key" data-k="del" aria-label="Delete">' + I('delete', 24) + '</button>';
    var inner = '<div class="th"><h2>' + (TT.k === 'start' ? 'When did you start?' : 'When did you finish?') + '</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
      '<div class="tt-disp" aria-live="polite"><span class="t' + (TT.buf ? '' : ' ph') + '">' + shown + '</span><span class="cur"></span><span class="ap">' + ap + '</span>' + (over ? '<span class="nd">NEXT DAY</span>' : '') + '</div>' +
      '<div class="ampm"><button class="' + (ap === 'AM' ? 'on' : '') + '" data-act="ap" data-v="AM" aria-pressed="' + (ap === 'AM') + '">' + I('sun', 20) + 'AM</button><button class="' + (ap === 'PM' ? 'on' : '') + '" data-act="ap" data-v="PM" aria-pressed="' + (ap === 'PM') + '">' + I('moon', 20) + 'PM</button></div>' +
      '<div class="pad">' + keys + '</div>' +
      (p.bad ? '<div class="tt-err" role="alert">That’s not a real time. Check the minutes.</div>' : '<div class="tt-hint">Type 728 for 7:28. Typing 1930 works too, it switches to 7:30 PM.</div>') +
      (note ? '<div class="tt-note">' + I('moon', 18) + '<span>' + esc(note) + '</span></div>' : '') +
      '<button class="btn btn-primary" data-act="tdone"' + (p.ok ? '' : ' disabled') + '>DONE</button>';
    // Update the open tray in place so it doesn't slide in again on every key press.
    var tray = $layer.querySelector('.tray[data-tt="' + TT.k + '"]');
    if (tray) { tray.innerHTML = inner; return; }
    openLayer('<div class="dim" data-act="close"></div><div class="tray sheet narrow" data-tt="' + TT.k + '" role="dialog" aria-modal="true" aria-label="' + (TT.k === 'start' ? 'Start time' : 'Finish time') + '">' + inner + '</div>');
  }

  /* ---------------- photo viewer: swipe, pinch or double-tap to zoom ---------------- */
  var V = null;
  function openViewer(id, i) {
    var pics, n;
    if (id === 'draft') { pics = D().photos; n = pics.length; }
    else { var r = S().reports.filter(function (x) { return x.id === id; })[0]; if (!r) return; pics = r.photoData || []; n = r.photos; }
    V = { pics: pics, n: n, i: +i || 0, s: 1, x: 0, y: 0 };
    var thumbs = ''; for (var k = 0; k < n; k++) thumbs += '<button class="vth" data-act="vgo" data-i="' + k + '" aria-label="Item ' + (k + 1) + '"' + (thumbOf(pics[k]) ? ' style="background-image:url(' + thumbOf(pics[k]) + ')"' : '') + '>' + (thumbOf(pics[k]) ? '' : I(isVid(pics[k]) ? 'play' : 'image', 14, '#fff')) + playBadge(pics[k], true) + '</button>';
    openLayer('<div class="viewer" role="dialog" aria-modal="true" aria-label="Photos"><div class="vbar"><span class="vcount" id="vcount"></span><button class="vbtn" data-act="close" aria-label="Close">' + I('x', 24, '#fff') + '</button></div>' +
      '<div class="vstage" id="vstage"><div class="vimg" id="vimg"></div>' + (n > 1 ? '<button class="vnav prev" data-act="vprev" aria-label="Previous photo">' + I('chevron-left', 28, '#fff') + '</button><button class="vnav next" data-act="vnext" aria-label="Next photo">' + I('chevron-right', 28, '#fff') + '</button>' : '') + '</div>' +
      '<div class="vhint">Pinch or double-tap to zoom</div>' + (n > 1 ? '<div class="vthumbs" id="vthumbs">' + thumbs + '</div>' : '') + '</div>');
    vShow(); vBind();
  }
  function vApply(anim) { var el = document.getElementById('vimg'); if (!el) return; el.style.transition = anim ? 'transform .2s ease' : 'none'; el.style.transform = 'translate(' + V.x + 'px,' + V.y + 'px) scale(' + V.s + ')'; }
  function vShow() {
    var el = document.getElementById('vimg'), p = V.pics[V.i];
    V.s = 1; V.x = 0; V.y = 0; vApply(false);
    var old = document.querySelector('.vimg video'); if (old) old.pause();
    if (isVid(p) && LIVE.on && p.key && !VIDS[p.key] && !p.src) { LIVE.blobs.get(p.key).then(function (b) { if (b && V && V.pics[V.i] === p) { VIDS[p.key] = URL.createObjectURL(b); vShow(); } }).catch(function () {}); }
    if (isVid(p)) el.innerHTML = VIDS[p.key] || p.src ? '<video src="' + esc(VIDS[p.key] || p.src) + '" controls playsinline' + (p.thumb ? ' poster="' + p.thumb + '"' : '') + '></video>' : '<div class="vph"' + (p.thumb ? ' style="background:url(' + p.thumb + ') center/cover"' : '') + '><span class="vnote">' + I('play', 28, '#fff') + 'Video · ' + mmss(p.dur) + '<br>' + (LIVE.on ? 'Saved with the report' : 'In the real app it plays from SharePoint') + '</span></div>';
    else el.innerHTML = p ? '<img src="' + esc(srcOf(p)) + '" alt="Photo ' + (V.i + 1) + '" draggable="false">' : '<div class="vph">' + I('image', 56, '#fff') + '<span>Sample photo</span></div>';
    var hint = document.querySelector('.vhint'); if (hint) hint.textContent = isVid(p) ? 'Swipe for the next one' : 'Pinch or double-tap to zoom';
    document.getElementById('vcount').textContent = (V.i + 1) + ' of ' + V.n;
    var th = document.querySelectorAll('.vth'); for (var k = 0; k < th.length; k++) th[k].classList.toggle('on', k === V.i);
    var cur = th[V.i]; if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function vGo(k) { if (!V) return; V.i = (k + V.n) % V.n; vShow(); }
  function vClamp() { var st = document.getElementById('vstage').getBoundingClientRect(), mx = st.width * (V.s - 1) / 2, my = st.height * (V.s - 1) / 2; V.x = Math.max(-mx, Math.min(mx, V.x)); V.y = Math.max(-my, Math.min(my, V.y)); }
  function vZoomAt(cx, cy, to) {
    if (isVid(V.pics[V.i])) return;
    var st = document.getElementById('vstage').getBoundingClientRect(), ox = cx - (st.left + st.width / 2), oy = cy - (st.top + st.height / 2);
    var k = to / V.s; V.x = ox - (ox - V.x) * k; V.y = oy - (oy - V.y) * k; V.s = to; if (V.s <= 1.01) { V.s = 1; V.x = 0; V.y = 0; } vClamp(); vApply(true);
  }
  function vBind() {
    var st = document.getElementById('vstage'), t0 = null, last = 0, pinch = null, moved = false;
    st.addEventListener('touchstart', function (e) {
      if (e.target.closest('.vnav') || e.target.tagName === 'VIDEO') { t0 = null; return; }
      if (e.touches.length === 2) { var a = e.touches[0], b = e.touches[1]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: V.s, cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 }; t0 = null; return; }
      var t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, vx: V.x, vy: V.y, time: Date.now() }; moved = false;
    }, { passive: true });
    st.addEventListener('touchmove', function (e) {
      if (!t0 && !pinch) return;
      e.preventDefault();
      if (pinch && e.touches.length === 2) { var a = e.touches[0], b = e.touches[1], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); var ns = Math.max(1, Math.min(5, pinch.s * d / pinch.d)); vZoomAt(pinch.cx, pinch.cy, ns); document.getElementById('vimg').style.transition = 'none'; return; }
      if (!t0) return; var t = e.touches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y; if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      if (V.s > 1) { V.x = t0.vx + dx; V.y = t0.vy + dy; vClamp(); vApply(false); }
      else { V.x = dx; vApply(false); }
    }, { passive: false });
    st.addEventListener('touchend', function (e) {
      vTouchAt = Date.now();
      if (pinch) { if (e.touches.length < 2) pinch = null; return; }
      if (!t0) return; var t = e.changedTouches[0], dx = t.clientX - t0.x;
      if (V.s === 1 && moved) { if (dx < -50 && V.n > 1) vGo(V.i + 1); else if (dx > 50 && V.n > 1) vGo(V.i - 1); else { V.x = 0; vApply(true); } t0 = null; return; }
      if (!moved) { var now = Date.now(); if (now - last < 300) { vZoomAt(t.clientX, t.clientY, V.s > 1 ? 1 : 2.5); last = 0; } else last = now; }
      t0 = null;
    });
    // mouse: click to zoom in or out, drag to move when zoomed
    st.addEventListener('mousedown', function (e) { if (e.target.closest('.vnav') || e.target.tagName === 'VIDEO' || Date.now() - vTouchAt < 800) return; vDrag = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y, moved: false }; });
    st.addEventListener('wheel', function (e) { e.preventDefault(); vZoomAt(e.clientX, e.clientY, Math.max(1, Math.min(5, V.s * (e.deltaY < 0 ? 1.15 : 0.87)))); }, { passive: false });
  }
  var vDrag = null, vTouchAt = 0;
  window.addEventListener('mousemove', function (e) { if (!vDrag || !V) return; var dx = e.clientX - vDrag.x, dy = e.clientY - vDrag.y; if (Math.abs(dx) + Math.abs(dy) > 4) vDrag.moved = true; if (V.s > 1 && vDrag.moved) { V.x = vDrag.vx + dx; V.y = vDrag.vy + dy; vClamp(); vApply(false); } });
  window.addEventListener('mouseup', function (e) { if (!vDrag || !V) return; if (!vDrag.moved && e.target.closest && e.target.closest('#vstage') && !e.target.closest('.vnav')) vZoomAt(e.clientX, e.clientY, V.s > 1 ? 1 : 2.5); vDrag = null; });
  document.addEventListener('keydown', function (e) { if (!V || !document.querySelector('.viewer')) return; if (e.key === 'ArrowRight') vGo(V.i + 1); if (e.key === 'ArrowLeft') vGo(V.i - 1); if (e.key === 'Escape') { closeLayer(); V = null; } });

  /* ---------------- office shell ---------------- */
  var NAV = [['today', 'Today', 'home', '#/office'], ['reports', 'All reports', 'list', '#/office/reports'], ['jobs', 'Jobs', 'briefcase', '#/office/jobs'], ['foremen', 'Foremen', 'user', '#/office/foremen']];
  function office(active, fn) {
    var reqs = S().requests.length;
    var side = '<aside class="side"><img class="logo" src="' + LOGO + '" alt="MKI LLC">' + NAV.map(function (n) { return '<a class="nav' + (n[0] === active ? ' on' : '') + '" href="' + n[3] + '">' + I(n[2], 20) + n[1] + (n[0] === 'jobs' && reqs ? '<span class="badge">' + reqs + '</span>' : '') + '</a>'; }).join('') +
      (LIVE.on ? (function () { var m = person(S().me); return '<div class="me"><div class="av" style="background:#5A2A2A">' + esc(m.ini) + '</div><div><b>' + esc(m.name) + '</b><span>' + esc(m.role || 'Office') + ' · <button class="u" style="color:inherit;font:inherit" data-act="signout">Sign out</button></span></div></div>'; })() : '<div class="me"><div class="av" style="background:#5A2A2A">AK</div><div><b>Alex Kovalev</b><span>Owner</span></div></div>') + '</aside>';
    if (LIVE.on) side = side.replace('<div class="me">', '<a class="nav send" href="#/">' + I('file-text', 20) + 'Send a report</a><div class="me">');
    var tabs = '<nav class="tabs">' + (LIVE.on ? NAV.concat([['send', 'Report', 'file-text', '#/']]) : NAV).map(function (n) { return '<a class="' + (n[0] === active ? 'on' : '') + '" href="' + n[3] + '">' + I(n[2], 22) + (n[0] === 'reports' ? 'Reports' : n[1]) + '</a>'; }).join('') + '</nav>';
    $app.innerHTML = previewBar('o') + '<div class="of">' + side + '<main class="main">' + fn() + '</main></div>' + tabs;
  }
  var backTo = 'reports';
  var BACKS = { today: ['#/office', 'Today'], reports: ['#/office/reports', 'All reports'], foremen: ['#/office/foremen', 'Foremen'], jobs: ['#/office/reports', 'All reports'] };
  function backLink() { var b = BACKS[backTo] || BACKS.reports; return '<a class="back" href="' + b[0] + '">' + I('chevron-left', 18) + b[1] + '</a>'; }
  var F = { job: '', who: '', range: '7', flag: '', q: '', chips: {}, more: 9, jobsShow: 'active', jq: '' };
  function dd(name, val, opts) { return '<label class="dd"><select aria-label="' + esc(opts[0][1]) + '" data-fil="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + I('chevron-down', 16) + '</label>'; }
  function jobOpts(all) { return [['', all]].concat(S().jobs.filter(function (j) { return j.active || j.num === F.job; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (j) { return [j.num, j.name]; })); }
  function whoOpts(all) { return [['', all]].concat(S().people.map(function (p) { return [p.id, p.name]; })); }
  function thumbs(r) { var n = r.photos, a = ''; for (var i = 0; i < Math.min(n, 3); i++) a += r.photoData && thumbOf(r.photoData[i]) ? '<span class="th36" style="background:url(' + thumbOf(r.photoData[i]) + ') center/cover">' + playBadge(r.photoData[i], true) + '</span>' : '<span class="th36">' + I(r.photoData && isVid(r.photoData[i]) ? 'play' : 'image', 14, '#fff') + '</span>'; if (n > 3) a += '<span class="mut" style="font:600 13px var(--in)">+' + (n - 3) + '</span>'; if (!n) a = '<span class="mut">None</span>'; return '<div class="thumbs">' + a + '</div>'; }
  function repRows(list, cols) {
    return list.map(function (r) {
      var p = person(r.person);
      return '<tr class="click" tabindex="0" role="link" aria-label="Open report: ' + esc(jobName(r)) + ', ' + shortDate(r.date) + '" data-go="#/office/report/' + r.id + '"><td class="date-td">' + shortDate(r.date) + '</td><td class="job">' + esc(jobName(r)) + '</td><td>' + esc(p.short) + '</td>' +
        '<td class="flags-td"><div class="flags">' + flagsOf(r).map(function (f) { return pill(f[0], f[1]); }).join('') + '</div></td><td class="thumbs-td">' + thumbs(r) + '</td><td class="go">' + I('chevron-right', 18) + '</td></tr>';
    }).join('');
  }
  function sorted() { return S().reports.slice().sort(function (a, b) { return (b.date + b.sentAt).localeCompare(a.date + a.sentAt); }); }

  /* ---------------- office: today ---------------- */
  function renderToday() {
    var k = todayKey(), s = S(), reps = sorted().filter(function (r) { return (!F.job || r.job === F.job) && (!F.who || r.person === F.who); });
    var today = reps.filter(function (r) { return r.date === k; });
    var dow = dObj(k).getDay(), weekend = dow === 0 || dow === 6;
    var sentIds = {}; today.forEach(function (r) { sentIds[r.person] = r; });
    var offToday = weekend ? [] : s.people.filter(function (p) { return p.crew && p.reminder && !sentIds[p.id] && isOff(p.id, k) && (!F.who || p.id === F.who); });
    var expected = weekend ? [] : s.people.filter(function (p) { return p.crew && p.reminder && offToday.indexOf(p) < 0 && (!F.who || p.id === F.who); });
    var missing = expected.filter(function (p) { return !sentIds[p.id]; });
    var mats = today.filter(function (r) { return r.mat.yes; });
    var weekStart = dObj(k); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    var safetyWk = reps.filter(function (r) { return r.safety.yes && dObj(r.date) >= weekStart; });
    var sentExp = expected.filter(function (p) { return sentIds[p.id]; }).length;
    function stat(l, v, sub, kind, go) { var tg = go ? 'button' : 'div'; return '<' + tg + ' class="stat ' + (kind || '') + (go ? ' go' : '') + '"' + (go || '') + '><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + (kind ? I(kind === 'ok' ? 'check' : kind === 'err' ? 'alert-circle' : 'alert-triangle', 14) : '') + esc(sub) + '</div>' + (go ? I('chevron-right', 16, '#6B6262') : '') + '</' + tg + '>'; }
    var people = expected.concat(offToday); today.forEach(function (r) { if (people.indexOf(person(r.person)) < 0) people.push(person(r.person)); });
    var fms = people.map(function (p) {
      var r = sentIds[p.id], off = !r && offToday.indexOf(p) > -1, jb = r ? jobName(r) : off ? 'Marked off today' : (p.usualJob && job(p.usualJob) ? job(p.usualJob).name : 'No report yet');
      var late = new Date().getHours() >= 19, tag = r ? 'button' : 'div'; // only a sent report opens something, so only that card is a button
      return '<' + tag + ' class="fm' + (r ? ' go' : '') + (r || off || !late ? '' : ' miss') + '"' + (r ? ' data-go="#/office/report/' + r.id + '" aria-label="Open ' + esc(p.short) + '’s report"' : '') + '><div class="av' + (r ? '' : ' gray') + '">' + p.ini + '</div><div class="t"><b>' + esc(p.short) + '</b><span>' + esc(jb) + '</span></div>' + (r ? pill('Sent ' + sentText(r), 'ok') : off ? pill('Off today', 'neutral') : late ? pill('Not sent', 'err') : pill('Not sent yet', 'neutral')) + (r ? I('chevron-right', 18, '#6B6262') : '') + '</' + tag + '>';
    }).join('');
    return '<div class="toprow"><div><div class="wdl">' + wd(k) + '</div><h1 class="h1">' + md(k) + '</h1></div><div class="filters">' + dd('job', F.job, jobOpts('All jobs')) + dd('who', F.who, whoOpts('All foremen')) + '</div></div>' +
      '<div class="stats">' + stat('REPORTS TODAY', weekend ? String(today.length) : sentExp + ' / ' + expected.length, weekend ? 'No reports expected on weekends' : !expected.length ? (today.length + ' sent · no daily reminders on') : missing.length ? missing.map(function (p) { return p.short; }).join(', ') + (missing.length > 1 ? ' haven’t' : ' hasn’t') + ' sent yet' : 'Everyone has sent') +
      stat('MISSING TODAY', missing.length, missing.length ? (missing.length === 1 ? 'Hasn’t sent yet' : 'Haven’t sent yet') : 'Nobody missing', missing.length ? (new Date().getHours() >= 19 ? 'err' : '') : 'ok') +
      stat('NEEDS MATERIALS', mats.length, mats.length ? mats.map(jobName).join(', ') : 'Nothing requested today', mats.length ? 'warn' : 'ok', mats.length === 1 ? ' data-go="#/office/report/' + mats[0].id + '"' : mats.length ? ' data-act="statf" data-k="mat"' : '') +
      stat('SAFETY ISSUES', safetyWk.length, safetyWk.length ? 'This week' : 'None this week', safetyWk.length ? 'err' : 'ok', safetyWk.length === 1 ? ' data-go="#/office/report/' + safetyWk[0].id + '"' : safetyWk.length ? ' data-act="statf" data-k="safety"' : '') + '</div>' +
      '<div class="sec-t">Foremen today</div>' + (fms ? '<div class="fms">' + fms + '</div>' : '<div class="blk"><p class="mut">' + (weekend ? 'It’s the weekend, so nobody is expected to send a report today.' : 'Nobody has daily reminders on.') + '</p></div>') +
      '<div class="tbl cards"><div class="hd"><span class="sec-t">Recent reports</span><a class="u" style="font:600 14px var(--in);color:var(--ink)" href="#/office/reports">See all reports</a></div><table><thead><tr><th>DATE</th><th>JOB</th><th>FOREMAN</th><th>FLAGS</th><th>PHOTOS</th><th></th></tr></thead><tbody>' + repRows(reps.slice(0, 5)) + '</tbody></table></div>';
  }

  /* ---------------- office: all reports ---------------- */
  function reportList() {
    return sorted().filter(function (r) {
      if (F.job && r.job !== F.job) return false; if (F.who && r.person !== F.who) return false;
      if (F.range !== 'all') { var days = (dObj(todayKey()) - dObj(r.date)) / 864e5; if (days >= +F.range) return false; }
      var c = F.chips; if (c.mat && !r.mat.yes) return false; if (c.delay && !r.delay.yes) return false; if (c.safety && !r.safety.yes) return false; if (c.photos && !r.photos) return false;
      if (F.q) { var hay = [jobName(r), person(r.person).name, items(r.work).join(' '), items(r.plan).join(' '), r.mat.text, r.delay.text, r.safety.text].join(' ').toLowerCase(); if (hay.indexOf(F.q.toLowerCase()) < 0) return false; }
      return true;
    });
  }
  /* Divider with a button or text in the middle (from Dan's design system: Divider, Type=Button / Type=Text) */
  function pager(shown, total) {
    var more = total > shown;
    return '<div class="pager"><div class="divider">' + '<span class="ln"></span>' + (more ? '<button class="obtn tertiary" data-act="more">Load more</button>' : '<span class="dv-t">' + (total ? 'That’s all ' + total + ' reports' : 'No reports') + '</span>') + '<span class="ln"></span></div>' +
      (more ? '<div class="pg-n">Showing ' + shown + ' of ' + total + ' reports</div>' : '') + '</div>';
  }
  function resultsHTML() {
    var list = reportList(), shown = list.slice(0, F.more);
    return '<div class="tbl cards"><table><thead><tr><th>DATE</th><th>JOB</th><th>FOREMAN</th><th>FLAGS</th><th>PHOTOS</th><th></th></tr></thead><tbody>' + (shown.length ? repRows(shown, 'crew') : '<tr><td colspan="6" class="empty-r">No reports match these filters. <button class="u" data-act="clearf">Clear filters</button></td></tr>') + '</tbody></table></div>' +
      (list.length ? pager(shown.length, list.length) : '');
  }
  /* Suggestions while typing: jobs and foremen that match, so a few letters is enough. */
  function suggestHTML(q) {
    q = (q || '').trim().toLowerCase(); if (!q) return '';
    var jobs = S().jobs.filter(function (j) { return (j.name + ' ' + j.num).toLowerCase().indexOf(q) > -1; }).slice(0, 4).map(function (j) { return '<button class="sg" data-act="sug" data-k="job" data-v="' + j.num + '">' + I('briefcase', 16, '#6B6262') + '<span>' + esc(j.name) + '</span><em>Job</em></button>'; });
    var ppl = S().people.filter(function (p) { return p.name.toLowerCase().indexOf(q) > -1; }).slice(0, 3).map(function (p) { return '<button class="sg" data-act="sug" data-k="who" data-v="' + p.id + '">' + I('user', 16, '#6B6262') + '<span>' + esc(p.name) + '</span><em>Foreman</em></button>'; });
    var n = reportList().length;
    return jobs.concat(ppl).join('') + '<div class="sg-note">' + n + (n === 1 ? ' report mentions' : ' reports mention') + ' “' + esc(q) + '”</div>';
  }
  function renderReports() {
    var chip = function (k, t) { return '<button class="chip' + (F.chips[k] ? ' on' : '') + '" data-act="chip" data-k="' + k + '">' + t + '</button>'; };
    return '<h1 class="h1">All reports</h1><div class="filters rf"><div class="osearch-w"><label class="osearch">' + I('search', 18, '#6B6262') + '<input type="search" aria-label="Search reports" placeholder="Search notes, jobs, foremen" value="' + esc(F.q) + '" data-fil="q" autocomplete="off"></label><div class="sugg" id="sugg" role="listbox"></div></div>' +
      dd('range', F.range, [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']]) + dd('job', F.job, jobOpts('All jobs')) + dd('who', F.who, whoOpts('All foremen')) + '</div>' +
      '<div class="chips">Quick filters ' + chip('mat', 'Needs materials') + chip('delay', 'Delays') + chip('safety', 'Safety') + chip('photos', 'Has photos') + '</div>' +
      '<div id="results">' + resultsHTML() + '</div>';
  }

  /* ---------------- office: report detail ---------------- */
  function renderDetail(id) {
    var r = S().reports.filter(function (x) { return x.id === id; })[0];
    if (!r) return '<a class="back" href="#/office/reports">' + I('chevron-left', 18) + 'All reports</a><p>Report not found.</p>';
    var p = person(r.person), late = r.sentDate && r.sentDate !== r.date;
    function list(l, arr) { var a = items(arr); return '<div class="blk"><div class="l">' + l + '</div>' + (a.length > 1 ? '<ol class="olist">' + a.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '<p>' + esc(a[0] || '') + '</p>') + '</div>'; }
    function blk(l, body, st) { return '<div class="blk"><div class="l">' + l + '</div>' + (st ? '<div>' + st + '</div>' : '') + (body ? '<p>' + esc(body) + '</p>' : '') + '</div>'; }
    if (LIVE.on && r.photos && !r.photoData && r.mediaFolder && !r._loading) { r._loading = true; LIVE.loadMedia(r).then(function () { r._loading = false; if (location.hash.indexOf(r.id) > -1 && !$layer.firstChild) { var y = window.scrollY; route(); window.scrollTo(0, y); } }, function () { r._loading = false; }); }
    var pics = r.photoData && r.photoData.length ? r.photoData : null;
    function ph(i, cls) {
      var more = i === 2 && r.photos > 3 ? '<span class="more">+' + (r.photos - 3) + '</span>' : '';
      var it = pics && pics[i], th = thumbOf(it), inner = th ? '' : I(isVid(it) ? 'play' : 'image', cls === 'big' ? 32 : 24, '#fff');
      return '<button class="ptile ' + cls + '" data-act="viewer" data-id="' + r.id + '" data-i="' + i + '" aria-label="Open item ' + (i + 1) + ' of ' + r.photos + '"' + (th ? ' style="background:url(' + th + ') center/cover"' : '') + '>' + inner + playBadge(it) + more + '</button>';
    }
    return backLink() +
      '<div class="dhead"><div><h1 class="h1">' + esc(jobName(r)) + '</h1><p>' + wd(r.date) + ', ' + md(r.date) + ' · ' + esc(p.short) + ' · Sent ' + (late ? shortDate(r.sentDate) + ' ' : '') + sentText(r) + '</p></div><div class="filters">' + (LIVE.on && r.mediaUrl ? '<button class="obtn tertiary" data-act="folder" data-id="' + r.id + '">' + I('folder', 18) + 'Open report folder</button>' : '') + '<button class="obtn primary" data-act="gcopen" data-id="' + r.id + '">' + I('file-text', 18, '#fff') + 'GC report</button></div></div>' +
      (function () {
        var rvw = r.review || {}, ls = (rvw.sent || []).slice(-1)[0], ld = (rvw.drafts || []).slice(-1)[0], bits = [];
        if (ls) bits.push(pill('Sent to GC ' + GC.fmtStamp(ls.at) + (ls.rev ? ' · Revision ' + ls.rev : ''), 'ok'));
        else if (ld) bits.push(pill('GC email drafted, not confirmed sent', 'warn'));
        else if (rvw.combinedInto) bits.push(pill('Combined into another GC report', 'neutral'));
        if (LIVE.on && r.itemId && !r.recordPdf) bits.push(pill('No as-sent PDF in the job folder', 'warn') + '<button class="u" data-act="recmake" data-id="' + r.id + '">Make it now</button>');
        return bits.length ? '<div class="gcstat">' + bits.join('') + '</div>' : '';
      })() +
      '<div class="dbody"><div class="dl-col"><div class="facts">' +
      '<div class="fact"><div class="l">WEATHER</div><div class="v">' + esc(wxTemp(r.weather) || '—') + '</div><div class="s">' + esc(r.weather ? wxRest(r.weather) : 'Not available') + '</div></div>' +
      '<div class="fact"><div class="l">PHOTOS & VIDEOS</div><div class="v">' + r.photos + '</div><div class="s">' + (r.videos ? mediaCount(r.photoData && r.photoData.length === r.photos ? r.photoData : []) || (r.videos + ' video') : r.photos ? 'Open one to see it' : 'None sent') + '</div></div>' +
      '<div class="fact"><div class="l">SENT</div><div class="v">' + sentText(r) + '</div><div class="s">' + (late ? 'Late · on ' + shortDate(r.sentDate) : 'Same day') + '</div></div></div>' +
      list('Work completed today', r.work) +
      blk('Materials, equipment, or inspections', r.mat.yes ? r.mat.text : '', r.mat.yes ? pill('Needs materials', 'warn') : pill('Nothing needed', 'ok')) +
      blk('Weather, site, or other-trade delays', r.delay.yes ? r.delay.text : '', r.delay.yes ? pill('Delay', 'warn') : pill('No delays', 'ok')) +
      blk('Safety or quality issues', r.safety.yes ? r.safety.text : '', r.safety.yes ? pill('Safety issue', 'err') : pill('No incidents', 'ok')) +
      list('Plan for next workday', r.plan) + '</div>' +
      '<div class="pbox"><div class="toprow"><span class="blk" style="padding:0"><span class="l">PHOTOS & VIDEOS · ' + r.photos + '</span></span>' + '</div>' +
      (r.photos ? ph(0, 'big') + (r.photos > 1 ? '<div class="two">' + ph(1, '') + (r.photos > 2 ? ph(2, '') : '<div style="background:none"></div>') + '</div>' : '') + '<div class="ofoot">Open a photo to see it full size</div>' : '<div class="ofoot">No photos with this report.</div>') + '</div></div>';
  }

  /* ---------------- GC report ---------------- */
  // GC report numbers are given once, the first time a GC report is downloaded, saved or emailed, and
  // never change after that (late reports or merged jobs don't renumber anything).
  function nextReportNo(r) {
    var max = 0; S().reports.forEach(function (x) { if (x.job === r.job && x.review && x.review.no) max = Math.max(max, x.review.no); });
    return max + 1;
  }
  function jobInfo(r) { var j = job(r.job) || {}; return { num: j.num || '', name: jobName(r), address: j.address || (r.job.indexOf('new:') === 0 ? r.note : '') || '', gc: j.gc || '', gcProject: j.gcProject || '' }; }
  function caption(n, taken, who) { return 'Photo ' + n + (who ? ' · ' + who : '') + (taken ? ' · taken ' + GC.fmtStamp(taken) : ''); }
  function photoSrc(ph) { return ph.key && LIVE.on ? LIVE.blobs.get(ph.key) : LIVE.on && ph.id ? LIVE.photoBlob(ph) : thumbOf(ph); }
  // The foreman's "as sent" record: everything he sent, unedited. Made on the phone at Send, or later by the office
  // from SharePoint if it's missing.
  function recordPdf(rep, photos) {
    var o = GC.original(rep), p = person(rep.person);
    var picks = (photos || []).map(function (ph, i) { return { ph: ph, i: i }; }).filter(function (x) { return x.ph && !isVid(x.ph); });
    return GC.toJpegs(picks.map(function (x) { return function () { return photoSrc(x.ph); }; })).then(function (imgs) {
      var m = { kind: 'record', job: jobInfo(rep), date: rep.date, weather: rep.weather, foreman: { name: rep.personName || p.name, role: p.role || '' }, sentDate: rep.sentDate, sentAt: rep.sentAt,
        sections: GC.SECTIONS.filter(function (sx) { return sx.k !== 'notes' && o[sx.k].length; }).map(function (sx) { return { t: sx.t, lines: o[sx.k] }; }),
        photos: imgs.map(function (im, k) { return { img: im, caption: caption(k + 1, (rep.taken || [])[picks[k].i] || picks[k].ph.taken) + (im ? '' : ' · could not be added, see the job folder') }; }),
        videos: (photos || []).filter(isVid).length, reviewed: null, rev: 0 };
      return GC.makePdf(m).then(function (blob) { return { name: GC.fileName(m), blob: blob }; });
    });
  }
  function rv(r) { if (!r.review || !r.review.sections) r.review = Object.assign(GC.newReview(r), r.review && r.review.combinedInto ? { combinedInto: r.review.combinedInto } : {}); return r.review; }
  function sameDay(r) { return S().reports.filter(function (x) { return x !== r && x.job === r.job && x.date === r.date; }); }
  function combined(r) { var ids = rv(r).combine || []; return S().reports.filter(function (x) { return ids.indexOf(x.id) > -1; }); }
  // What the GC report contains right now, as text, so a re-send with no changes keeps the same revision number.
  function gcHash(r) { var v = rv(r); return JSON.stringify([v.sections, v.photos, v.combine || [], v.otherPhotos || {}]); }
  function gcRev(r) { var sent = rv(r).sent || []; if (!sent.length) return 0; var last = sent[sent.length - 1]; return last.hash === gcHash(r) ? last.rev : last.rev + 1; }
  function loadAllMedia(list) { return Promise.all(list.map(function (x) { return LIVE.on && x.photos && !x.photoData && x.mediaFolder ? LIVE.loadMedia(x) : null; })); }
  function gcModel(r) {
    var v = rv(r), p = person(r.person), me = person(S().me), others = combined(r);
    return loadAllMedia([r].concat(others)).then(function () {
      var chosen = [];
      (r.photoData || []).forEach(function (x, i) { if (!isVid(x) && (!v.photos || v.photos.indexOf(i) > -1)) chosen.push({ x: x, t: (r.taken || [])[i], who: others.length ? person(r.person).short : '' }); });
      others.forEach(function (o) { var sel = (v.otherPhotos || {})[o.id]; (o.photoData || []).forEach(function (x, i) { if (!isVid(x) && (!sel || sel.indexOf(i) > -1)) chosen.push({ x: x, t: (o.taken || [])[i], who: person(o.person).short }); }); });
      return GC.toJpegs(chosen.map(function (c) { return function () { return photoSrc(c.x); }; })).then(function (imgs) {
        imgs.forEach(function (im, k) { if (!im) throw new Error('Photo ' + (k + 1) + ' couldn’t be loaded. Check the connection and try again'); });
        var all = [r].concat(others);
        return { kind: 'gc', job: jobInfo(r), reportNo: v.no || null, date: r.date, weather: r.weather, foreman: { name: r.personName || p.name, role: p.role || '' }, sentDate: r.sentDate, sentAt: r.sentAt,
          foremen: all.map(function (x) { return x.personName || person(x.person).name; }),
          prepared: all.map(function (x) { var px = person(x.person); return { name: x.personName || px.name, role: px.role || '', sentDate: x.sentDate, sentAt: x.sentAt }; }),
          sections: GC.SECTIONS.filter(function (sx) { return v.sections[sx.k] && v.sections[sx.k].on && GC.lines(v.sections[sx.k].text).length; }).map(function (sx) { return { t: sx.t, lines: GC.lines(v.sections[sx.k].text) }; }),
          photos: imgs.map(function (im, k) { return { img: im, caption: caption(k + 1, chosen[k].t, chosen[k].who) }; }),
          videos: all.reduce(function (n, x) { return n + (x.photoData || []).filter(isVid).length; }, 0),
          reviewed: S().me ? { name: me.name, role: me.role || '', at: v.savedAt || Date.now() } : null, rev: gcRev(r) };
      });
    });
  }
  var gcSaveT = null, gcPending = null;
  function gcSave(r, now) {
    var v = rv(r); v.savedAt = Date.now(); v.reviewedBy = S().me; DB.save(); r._dirty = true;
    clearTimeout(gcSaveT); gcSaveT = null; gcPending = null;
    var st = document.getElementById('gcsave');
    if (!LIVE.on) { r._dirty = false; if (st) st.textContent = 'Saved on this device'; return Promise.resolve(); }
    if (!LIVE.hasReviewColumn()) { if (st) st.textContent = 'Can’t save edits yet: Alex needs to open the app once to finish an update.'; return Promise.resolve(); }
    if (st) st.textContent = 'Saving…';
    var go2 = function () { return LIVE.saveReview(r).then(function () { r._dirty = false; var e = document.getElementById('gcsave'); if (e) e.textContent = 'All changes saved'; }, function (e) { console.error(e); var x = document.getElementById('gcsave'); if (x) x.textContent = e && e.status === 403 ? 'Your account can’t save changes to this report.' : 'Not saved: check the connection.'; throw e; }); };
    if (now) return go2();
    gcPending = r;
    return new Promise(function (res) { gcSaveT = setTimeout(function () { gcSaveT = null; gcPending = null; go2().then(res, res); }, 800); });
  }
  // "Foreman wrote" box under a section, shown only when the office text differs from the foreman's.
  function gcOrigHTML(r, k) {
    if (k === 'notes') return '';
    var cur = rv(r).sections[k], orig = GC.original(r)[k].join('\n');
    if (GC.lines(cur.text).join('\n') === orig) return '';
    return '<div class="gcorig"><div class="l">Foreman wrote</div><p>' + esc(orig || '(nothing)').replace(/\n/g, '<br>') + '</p><button class="u" data-act="gcrevert" data-id="' + r.id + '" data-k="' + k + '">Use the foreman’s words</button></div>';
  }
  function gcRedraw(id) {
    if (location.hash.indexOf('/gc/' + id) < 0 || $layer.firstChild) return;
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA/.test(a.tagName)) { var tmp = document.createElement('div'); tmp.innerHTML = renderGC(id); var np = tmp.querySelector('#gcphotos'), op = document.getElementById('gcphotos'); if (np && op) op.innerHTML = np.innerHTML; return; }
    var y = window.scrollY; route(); window.scrollTo(0, y);
  }
  function gcStatHTML(r) {
    var v = rv(r), sent = v.sent || [], drafts = v.drafts || [], last = sent[sent.length - 1], lastDraft = drafts[drafts.length - 1], rev = gcRev(r);
    return last ? pill('Sent to GC ' + GC.fmtStamp(last.at) + (last.rev ? ' · Revision ' + last.rev : ''), 'ok') + (rev !== last.rev ? '<span class="mut">You changed it since, so the next one goes out as Revision ' + rev + '.</span>' : '<span class="mut">No changes since it was sent.</span>') :
      lastDraft ? pill('Email draft made ' + GC.fmtStamp(lastDraft.at), 'warn') + '<span class="mut">Not confirmed as sent.</span><button class="u" data-act="gcsent" data-id="' + r.id + '">I sent it</button>' : pill('Not sent to the GC yet', 'neutral');
  }
  function renderGC(id) {
    var r = S().reports.filter(function (x) { return x.id === id; })[0];
    if (!r) return '<a class="back" href="#/office/reports">' + I('chevron-left', 18) + 'All reports</a><p>Report not found.</p>';
    [r].concat(combined(r)).forEach(function (x) {
      if (LIVE.on && x.photos && !x.photoData && x.mediaFolder && !x._loading && !x._mediaErr) { x._loading = true; LIVE.loadMedia(x).then(function () { x._loading = false; gcRedraw(r.id); }, function (e) { console.error(e); x._loading = false; x._mediaErr = true; gcRedraw(r.id); }); }
    });
    var v = rv(r), p = person(r.person), j = job(r.job), sent = v.sent || [], drafts = v.drafts || [];
    if (v.combinedInto) {
      var lead = gcReport(v.combinedInto);
      if (lead) return '<a class="back" href="#/office/report/' + r.id + '">' + I('chevron-left', 18) + 'Back to the report</a><div class="dhead"><div><h1 class="h1">GC report</h1></div></div>' +
        '<section class="card gccard"><p style="margin:0;font:15px/1.45 var(--in)">This report is combined into ' + esc(person(lead.person).short) + '’s GC report for the same job and day, so the GC gets one daily report.</p><div class="gcacts"><a class="obtn primary" href="#/office/gc/' + lead.id + '">Open the combined GC report</a><button class="obtn tertiary" data-act="gcuncombine" data-id="' + lead.id + '" data-o="' + r.id + '">Make it separate again</button></div></section>';
    }
    var secs = GC.SECTIONS.map(function (sx) {
      var cur = v.sections[sx.k], txt = (cur.text || []).join('\n');
      return '<section class="card gcsec' + (cur.on ? '' : ' off') + '"><div class="gchead"><label class="gcinc"><input type="checkbox" class="kd-cb" data-gc="on" data-k="' + sx.k + '"' + (cur.on ? ' checked' : '') + '><span>' + esc(sx.t) + '</span></label><span class="mut gcin">' + (cur.on ? 'In the GC report' : 'Not sent to the GC') + '</span></div>' +
        '<textarea class="gcta" rows="' + Math.max(2, (cur.text || []).length + 1) + '" data-gc="text" data-k="' + sx.k + '" placeholder="' + (sx.k === 'notes' ? 'Optional note for the GC' : 'One item per line') + '">' + esc(txt) + '</textarea>' +
        (cur.auto && cur.on ? '<p class="gchint">Turned on because the foreman mentions an inspection or test. Turn it off if the GC doesn’t need it.</p>' : sx.hint ? '<p class="gchint">' + esc(sx.hint) + '</p>' : '') +
        '<div class="gcorigw" id="gco-' + sx.k + '">' + gcOrigHTML(r, sx.k) + '</div></section>';
    }).join('');
    var pics = (r.photoData || []).map(function (x, i) { return { x: x, i: i }; }).filter(function (q) { return !isVid(q.x); });
    var vids = (r.photoData || []).filter(isVid).length;
    var photos = r.photos && !r.photoData ? (r._mediaErr ? '<p class="mut">The photos couldn’t be loaded. <button class="u" data-act="gcretry" data-id="' + r.id + '">Try again</button></p>' : !LIVE.on ? '<p class="mut">Sample reports in preview have no real photos to pick.</p>' : !r.mediaFolder ? '<p class="mut">This report’s photos aren’t in a SharePoint folder, so they can’t go in the PDF.</p>' : '<p class="mut">Loading photos…</p>') : pics.length ? '<div class="gcpics">' + pics.map(function (q, n) {
      var on = !v.photos || v.photos.indexOf(q.i) > -1, th = thumbOf(q.x);
      return '<label class="gcpic' + (on ? ' on' : '') + '"' + (th ? ' style="background-image:url(' + th + ')"' : '') + '><input type="checkbox" data-gc="photo" data-i="' + q.i + '"' + (on ? ' checked' : '') + ' aria-label="Include photo ' + (n + 1) + '"><span class="ck">' + I('check', 14, '#fff') + '</span></label>';
    }).join('') + '</div>' + (vids ? '<p class="gchint">Videos can’t go in a PDF. The report says they are in MKI’s job folder.</p>' : '') : vids ? '<p class="mut">This report has ' + (vids === 1 ? 'a video' : vids + ' videos') + ' and no photos. Videos can’t go in a PDF, so the report says they are in MKI’s job folder.</p>' : '<p class="mut">No photos with this report.</p>';
    var others = sameDay(r), comb = v.combine || [];
    combined(r).forEach(function (o) {
      var sel = (v.otherPhotos || {})[o.id], ps = (o.photoData || []).map(function (x, i) { return { x: x, i: i }; }).filter(function (q) { return !isVid(q.x); });
      if (o.photos && !o.photoData) { photos += '<p class="mut">Loading ' + esc(person(o.person).short) + '’s photos…</p>'; return; }
      if (!ps.length) return;
      photos += '<p class="gchint" style="margin:6px 0 0">' + esc(person(o.person).short) + '’s photos</p><div class="gcpics">' + ps.map(function (q, n) {
        var on = !sel || sel.indexOf(q.i) > -1, th = thumbOf(q.x);
        return '<label class="gcpic' + (on ? ' on' : '') + '"' + (th ? ' style="background-image:url(' + th + ')"' : '') + '><input type="checkbox" data-gc="photo" data-o="' + o.id + '" data-i="' + q.i + '"' + (on ? ' checked' : '') + ' aria-label="Include ' + esc(person(o.person).short) + '’s photo ' + (n + 1) + '"><span class="ck">' + I('check', 14, '#fff') + '</span></label>';
      }).join('') + '</div>';
    });
    var combo = others.length ? '<section class="card gccard"><div class="gchead"><span class="gct">Other reports for this job and day</span></div><p class="gchint" style="margin-top:-4px">GCs usually expect one daily report per job. Combining adds the other foreman’s answers to the text above, labelled with his name, and his photos to the PDF.</p>' + others.map(function (x) {
      var xv = x.review || {}, mine = comb.indexOf(x.id) > -1, elsewhere = xv.combinedInto && xv.combinedInto !== r.id, hasOwn = xv.combine && xv.combine.length;
      return '<div class="gcother"><span><b>' + esc(person(x.person).short) + '</b> · sent ' + sentText(x) + '</span>' + (mine ? '<span>' + pill('Combined', 'ok', 1) + ' <button class="u" data-act="gcuncombine" data-id="' + r.id + '" data-o="' + x.id + '">Separate</button></span>' : elsewhere ? '<span class="mut">In another GC report</span>' : hasOwn ? '<span class="mut">Already combines other reports. <a class="u" href="#/office/gc/' + x.id + '">Open it</a></span>' : (xv.sent && xv.sent.length) ? '<span class="mut">Already sent on its own</span>' : '<button class="obtn tertiary" data-act="gccombine" data-id="' + r.id + '" data-o="' + x.id + '">Combine into this report</button>') + '</div>';
    }).join('') + '</section>' : '';
    var stat = gcStatHTML(r);
    var gcEmails = (j && j.gcEmail) || '';
    return '<a class="back" href="#/office/report/' + r.id + '">' + I('chevron-left', 18) + 'Back to the report</a>' +
      '<div class="dhead"><div><h1 class="h1">GC report</h1><p>' + esc(jobName(r)) + ' · ' + wd(r.date) + ', ' + md(r.date) + ' · ' + esc(p.short) + (v.no ? ' · Report No. ' + v.no : '') + '</p></div></div>' +
      '<div class="gcstat" id="gcstat">' + stat + '</div>' +
      '<p class="gcintro">Fix wording, add anything missing and choose what the GC sees. The foreman’s original stays saved as it was, and the PDF shows who reviewed it.</p>' +
      (j ? '<section class="card gccard"><div class="gchead"><span class="gct">General contractor for this job</span></div><div class="gcgrid">' +
        '<div class="fld"><label for="gc-n">GC company</label><input id="gc-n" data-gcjob="gc" value="' + esc(j.gc || '') + '" placeholder="e.g. Rodgers Builders" autocomplete="off" aria-describedby="gc-n-hint"><div class="fhint" id="gc-n-hint">Shows at the top of the PDF</div></div>' +
        '<div class="fld"><label for="gc-p">GC project number</label><input id="gc-p" data-gcjob="gcProject" value="' + esc(j.gcProject || '') + '" placeholder="e.g. 24-118" autocomplete="off" aria-describedby="gc-p-hint"><div class="fhint" id="gc-p-hint">Shows at the top of the PDF</div></div>' +
        '<div class="fld wide"><label for="gc-e">GC email</label><input id="gc-e" type="email" multiple data-gcjob="gcEmail" value="' + esc(gcEmails) + '" placeholder="name@company.com" autocomplete="off" aria-describedby="gc-e-hint"><div class="fhint" id="gc-e-hint">Needed for Email to GC. Separate several with commas.</div></div></div></section>' : '<section class="card gccard"><p class="mut" style="margin:0">This report is on a job the office hasn’t approved yet. Approve or merge it on the Jobs page to add the GC details.</p></section>') +
      combo + secs +
      '<section class="card gccard" id="gcphotos"><div class="gchead"><span class="gct">Photos for the GC</span>' + (pics.length > 1 ? '<span><button class="u" data-act="gcall" data-id="' + r.id + '" data-v="1">All</button> · <button class="u" data-act="gcall" data-id="' + r.id + '" data-v="0">None</button></span>' : '') + '</div>' + photos + '</section>' +
      '<div class="gcbar"><span id="gcsave" class="mut">' + (v.savedAt ? 'All changes saved' : 'Changes save as you type') + '</span><div class="gcacts">' +
        '<button class="obtn tertiary" data-act="gcpdf" data-id="' + r.id + '">' + I('file-text', 18) + 'Download PDF</button>' +
        (LIVE.on ? '<button class="obtn tertiary" data-act="gcfolder" data-id="' + r.id + '">' + I('folder', 18) + 'Save to job folder</button><button class="obtn primary" data-act="gcmail" data-id="' + r.id + '">Email to GC</button>' : '') + '</div></div>';
  }
  // GC company and project number are optional, but the PDF header looks unfinished without them,
  // so making a PDF flags any that are empty (a warning, it doesn't stop anything).
  function gcMissingWarn() {
    [['gc-n', 'Not filled in, so the PDF leaves the GC company blank'], ['gc-p', 'Not filled in, so the PDF leaves the project number blank']].forEach(function (x) {
      var el = document.getElementById(x[0]); if (el && !el.value.trim()) fieldState(x[0], 'warn', x[1]);
    });
  }
  function gcText(t) { var el = document.getElementById('busytxt'); if (el) el.textContent = t; else gcBusy(t); }
  function gcReport(id) { return S().reports.filter(function (x) { return x.id === id; })[0]; }
  function gcBusy(text) { openLayer('<div class="busy" role="status" aria-live="polite"><div class="spin"></div><p id="busytxt">' + esc(text) + '</p></div>'); }
  function gcMake(r) {
    gcBusy('Making the PDF…'); var v = rv(r);
    // The report number is only given when it can be saved, so the same number is never handed out twice.
    var canStore = !LIVE.on || LIVE.hasReviewColumn(), fresh = !v.no && canStore;
    if (fresh) v.no = nextReportNo(r);
    return gcSave(r, true).catch(function (e) { if (fresh) { v.no = null; throw new Error('the report couldn’t be saved first. Check the connection and try again'); } }).then(function () { return gcModel(r); }).then(function (m) { return GC.makePdf(m).then(function (b) { return { m: m, blob: b, name: GC.fileName(m) }; }); });
  }
  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }
  // Lines from another foreman's report, labelled with his name, for a combined GC report.
  function otherLines(o, k) { var src = o.review && o.review.sections && o.review.sections[k] ? GC.lines(o.review.sections[k].text) : GC.original(o)[k]; var yes = { delay: o.delay.yes, safety: o.safety.yes, mat: o.mat.yes }; if (k in yes && !yes[k]) return []; return src.map(function (l) { return person(o.person).short + ': ' + l; }); }
  var NONE = { delay: 'No delays reported.', safety: 'No safety or quality issues reported.', mat: 'Nothing needed.' };
  function gcFail(e) { closeLayer(); console.error(e); toast('That didn’t work', { kind: 'error', msg: e && e.status === 403 ? 'Your account isn’t allowed to do that. Ask Alex to check your access.' : (((e && e.message) || 'Check the connection') + '. Try again.').replace(/^./, function (c) { return c.toUpperCase(); }) }); }

  /* ---------------- office: jobs ---------------- */
  function renderJobs() {
    var s = S(), q = F.jq.toLowerCase();
    var list = s.jobs.filter(function (j) { return (F.jobsShow === 'all' || (F.jobsShow === 'active') === j.active) && (!q || (j.name + j.num).toLowerCase().indexOf(q) > -1); })
      .sort(function (a, b) { return b.num.localeCompare(a.num); });
    var reqs = s.requests.map(function (r) {
      return '<div class="reqrow"><div class="t"><b>' + esc(r.name) + '</b><span>Asked by ' + esc(person(r.by).short) + ' · ' + shortDate(r.date) + (r.note ? ' · “' + esc(r.note) + '”' : '') + '</span></div><button class="obtn tertiary" data-act="merge" data-id="' + r.id + '">Merge into existing</button><button class="obtn secondary" data-act="approve" data-id="' + r.id + '">' + I('check', 18) + 'Approve</button></div>';
    }).join('');
    var rows = list.map(function (j) {
      var rs = s.reports.filter(function (r) { return r.job === j.num; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
      var fm = j.foreman ? person(j.foreman).short : rs[0] ? 'Last: ' + person(rs[0].person).short : '—';
      return '<tr' + (rs.length ? ' class="click" tabindex="0" data-act="jobreports" data-num="' + esc(j.num) + '" aria-label="See reports for ' + esc(j.name) + '"' : '') + '><td class="job"><span class="num">' + esc(j.num) + '</span>' + esc(j.name) + '</td><td>' + esc(fm) + '</td><td class="hide-m">' + (rs[0] ? relDate(rs[0].date) : 'No reports yet') + '</td><td class="hide-m">' + rs.length + '</td><td>' + (j.active ? pill('Active', 'ok') : '<span class="pill neutral">Finished</span>') + '</td>' +
        '<td class="go"><div class="menu-w"><button class="mbtn" data-act="jobmenu" data-num="' + esc(j.num) + '" aria-haspopup="menu" aria-label="More for ' + esc(j.name) + '">' + I('more-horizontal', 18) + '</button></div></td></tr>';
    }).join('');
    return '<div class="toprow"><h1 class="h1">Jobs</h1><button class="obtn primary" data-act="addjob">' + I('plus', 18, '#fff') + 'Add job</button></div>' +
      (s.requests.length ? '<div class="reqc"><div class="top">' + pill(s.requests.length + (s.requests.length === 1 ? ' new job request' : ' new job requests'), 'warn') + 'Foremen can ask for a job that isn’t on the list. Approve it, or merge it into a job that already exists.</div>' + reqs + '</div>' : '') +
      '<div class="filters"><label class="osearch">' + I('search', 18, '#6B6262') + '<input type="search" aria-label="Search jobs" placeholder="Search jobs" value="' + esc(F.jq) + '" data-fil="jq" autocomplete="off"></label>' + dd('jobsShow', F.jobsShow, [['active', 'Active jobs'], ['finished', 'Finished jobs'], ['all', 'All jobs']]) + '</div>' +
      '<div class="tbl cards jobs"><table><thead><tr><th>JOB</th><th>FOREMAN</th><th>LAST REPORT</th><th>REPORTS</th><th>STATUS</th><th></th></tr></thead><tbody id="jobsbody">' + (rows || '<tr><td colspan="6" class="mut">No jobs here.</td></tr>') + '</tbody></table></div>' +
      '<div class="ofoot">Finished jobs drop off the foreman’s list but keep their reports and photos. Job numbers match the job folders. Click a job to see its reports, or use ··· to edit it, mark it finished or reopen it. Add the job site address so reports get that town’s weather.</div>';
  }
  function nextNum() { var yy = String(new Date().getFullYear()).slice(2), max = 3000; S().jobs.forEach(function (j) { var p = j.num.split('-'); if (p[0] === yy) max = Math.max(max, +p[1]); }); return yy + '-' + (max + 1); }
  function openAddJob(prefill, reqId, addr, editNum) {
    var ej = editNum ? job(editNum) : null;
    if (ej) { prefill = ej.name; addr = ej.address; }
    openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="' + (ej ? 'Edit job' : reqId ? 'Approve job request' : 'Add a job') + '"><div class="toprow"><h2>' + (ej ? 'EDIT JOB' : reqId ? 'APPROVE JOB REQUEST' : 'ADD A JOB') + '</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
      '<div class="fld"><label for="aj-n">Job name</label><input id="aj-n" maxlength="80" value="' + esc(prefill || '') + '" autocomplete="off"></div>' +
      '<div class="fld"><label for="aj-a">Job site address<span class="opt">Optional</span></label><input id="aj-a" placeholder="Street, city, state" value="' + esc(addr || '') + '" autocomplete="off" aria-describedby="aj-a-hint"><div class="fhint" id="aj-a-hint">Gives reports that town’s weather</div></div>' +
      '<div class="fld"><label for="aj-f">Main foreman<span class="opt">Optional</span></label><label class="dd" style="display:flex"><select id="aj-f" style="width:100%;padding:15px 38px 15px 14px;font-size:16px;border-radius:12px"><option value="">Pick a foreman</option>' + S().people.filter(function (p) { return p.crew || (ej && ej.foreman === p.id); }).map(function (p) { return '<option value="' + p.id + '"' + (ej && ej.foreman === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>' + I('chevron-down', 18) + '</label></div>' +
      '<div class="fld"><label for="aj-gc">General contractor<span class="opt">Optional</span></label><input id="aj-gc" value="' + esc(ej ? ej.gc || '' : '') + '" autocomplete="off"></div>' +
      '<div class="fld"><label for="aj-gp">GC project number<span class="opt">Optional</span></label><input id="aj-gp" value="' + esc(ej ? ej.gcProject || '' : '') + '" autocomplete="off"></div>' +
      '<div class="fld"><label for="aj-ge">GC email for daily reports<span class="opt">Optional</span></label><input id="aj-ge" type="email" multiple value="' + esc(ej ? ej.gcEmail || '' : '') + '" autocomplete="off"></div>' +
      (ej ? '<div class="fld"><label>Job number</label><p style="margin:0;font:15px var(--in)">' + esc(ej.num) + ' <span class="mut" style="font-size:13px">· matches the job folder, so it can’t be changed here</span></p></div>' :
      '<div class="fld"><label for="aj-j">Job number</label><input id="aj-j" value="' + nextNum() + '" autocomplete="off"></div>' +
      '<div class="note" style="font-size:13px;color:var(--mut)">' + I('bell', 18) + '<span>Shows up on every foreman’s job list right away. A job folder is made in SharePoint the first time a report comes in.</span></div>') +
      '<div class="acts"><button class="obtn tertiary" data-act="close">Cancel</button><button class="obtn primary" data-act="' + (ej ? 'saveedit' : 'savejob') + '"' + (reqId ? ' data-req="' + reqId + '"' : '') + (ej ? ' data-num="' + esc(ej.num) + '"' : '') + '>' + (ej ? 'Save' : reqId ? 'Approve' : 'Add job') + '</button></div></div>');
    setTimeout(function () { var i = document.getElementById('aj-n'); if (i) i.focus(); }, 50);
  }
  function openMerge(reqId) {
    var r = S().requests.filter(function (x) { return x.id === reqId; })[0];
    openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="Merge"><div class="toprow"><h2>MERGE INTO A JOB</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
      '<p style="margin:0;font:15px/1.45 var(--in)">Reports sent under “' + esc(r.name) + '” will move to the job you pick.</p>' +
      '<div class="fld"><label for="mg">Job</label><label class="dd" style="display:flex"><select id="mg" style="width:100%">' + jobOpts('Pick a job').map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' + I('chevron-down', 18) + '</label></div>' +
      '<div class="acts"><button class="obtn tertiary" data-act="close">Cancel</button><button class="obtn primary" data-act="domerge" data-id="' + reqId + '">Merge</button></div></div>');
  }

  /* ---------------- office: foremen ---------------- */
  function renderForemen() {
    var s = S(), k = todayKey(), mon = dObj(k); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { var d = new Date(mon); d.setDate(d.getDate() + i); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    var sun = dObj(days[6]);
    var since = LIVE.on ? LIVE.since : '';
    var rows = s.people.filter(function (p) { return p.crew; }).map(function (p) {
      var cnt = 0, missedToday = false, pendingToday = false, missed = 0, worked = 0;
      var dots = days.map(function (dk, i) {
        var weekend = i > 4;
        var sentR = s.reports.filter(function (r) { return r.person === p.id && r.date === dk; })[0], sent = !!sentR;
        if (dk > k || dk < since) return '<td class="wkcell hide-m"><span class="dot"></span></td>';
        if (sent) { worked++; cnt++; return '<td class="wkcell hide-m"><button class="dot ok" data-go="#/office/report/' + sentR.id + '" aria-label="Open ' + esc(p.short) + '’s report for ' + shortDate(dk) + '" title="Open report">' + I('check', 16, '#067647') + '</button></td>'; }
        if (isOff(p.id, dk)) return '<td class="wkcell hide-m"><span class="dot off" title="Off">OFF</span></td>';
        if (weekend || !p.reminder) { if (!weekend) worked++; return '<td class="wkcell hide-m"><span class="dot"></span></td>'; }
        if (dk === k && new Date().getHours() < 19) { pendingToday = true; return '<td class="wkcell hide-m"><span class="dot" title="Not sent yet"></span></td>'; }
        worked++; missed++; if (dk === k) missedToday = true; return '<td class="wkcell hide-m"><span class="dot err">' + I('x', 14, '#D92D20') + '</span></td>';
      }).join('');
      var st = !p.reminder ? '<span class="mut">Not tracked</span>' : missedToday ? pill('Missed today', 'err') : missed ? pill(missed + ' missed', 'err') : pendingToday && !worked ? '<span class="mut">Not sent yet</span>' : pill(cnt + ' of ' + worked, 'ok');
      var uj = p.usualJob && job(p.usualJob) ? job(p.usualJob).name : (p.role === 'Field Supervisor' ? 'New construction only' : '');
      return '<tr><td class="job fn"><div class="fn-w"><span class="av sm">' + p.ini + '</span><div class="fn-t"><div class="fn-n">' + esc(p.short) + '</div>' + (uj ? '<div class="fn-j">' + esc(uj) + '</div>' : '') + '</div></div></td>' + dots + '<td class="fst">' + st + '</td><td><button class="switch' + (p.reminder ? ' on' : '') + '" data-act="rem" data-id="' + p.id + '" role="switch" aria-checked="' + p.reminder + '" aria-label="Daily reminder for ' + esc(p.short) + '"></button></td></tr>';
    }).join('');
    var mon0 = dObj(days[0]), range = mon0.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' to ' + (sun.getMonth() === mon0.getMonth() ? sun.getDate() : sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    var dh = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(function (d) { return '<th class="wkcell hide-m">' + d + '</th>'; }).join('');
    var dc = days.map(function () { return '<col class="c-d hide-m">'; }).join('');
    return '<div class="toprow"><h1 class="h1">Foremen</h1></div>' +
      '<div class="filters wk"><span class="wkl">This week · ' + range + '</span><span class="mut" style="font:14px var(--in)">Who sent a report each day</span></div>' +
      '<div class="tbl"><div style="overflow-x:auto"><table class="fmt"><colgroup><col class="c-n">' + dc + '<col class="c-w"><col class="c-r"></colgroup><thead><tr><th>FOREMAN</th>' + dh + '<th>THIS WEEK</th><th><span class="hide-m">REMINDER</span><span class="show-m" title="Daily reminder">' + I('bell', 16) + '</span></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="remc"><div class="sec-t" style="font-size:15px;color:var(--mut)">How this list works</div><div class="r">' + I('info', 20) + '<span style="flex:1">Everyone whose Microsoft 365 job title includes Foreman, Field Supervisor or Superintendent shows here, and people leave the list when their account is blocked or removed. The Reminder switch marks who is expected to send a report Monday to Friday. Weekend reports show up but are never counted as missed. At 7 PM Monday to Friday, anyone with Reminder on who hasn’t sent a report gets one email from the MKI Service mailbox, with an “I’m off today” button. Days marked off show as OFF, not missed.</span></div></div>';
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('.menu-w')) { var om = document.querySelector('.menu'); if (om) om.remove(); [].forEach.call(document.querySelectorAll('tr.mopen'), function (x) { x.classList.remove('mopen'); }); }
    var t = ev.target.closest('[data-act],[data-go]'); if (!t) return;
    if (t.dataset.go && !t.dataset.act) { if (ev.target.closest('button') && ev.target.closest('button') !== t) return; go(t.dataset.go); return; }
    var a = t.dataset.act, d;
    switch (a) {
      case 'start': go('#/report'); break;
      case 'offretry': route(); break;
      case 'offundo':
        var uo = offs().filter(function (o) { return o.person === S().me && o.date === t.dataset.day; });
        S().offs = offs().filter(function (o) { return uo.indexOf(o) < 0; }); DB.save();
        if (LIVE.on) uo.forEach(function (o) { if (o.itemId) LIVE.unmarkOff(o).catch(function () { toast('Couldn’t undo', { kind: 'error', msg: 'Check your signal and try again.' }); offs().push(o); DB.save(); }); });
        location.replace('#/'); toast('You’re not marked off'); break;
      case 'signin': if (LIVE.on) { LIVE.signIn(); break; } S().me = 'aharbin'; DB.save(); go('#/'); break;
      case 'folder': var fr = S().reports.filter(function (x) { return x.id === t.dataset.id; })[0]; if (fr && fr.mediaUrl) window.open(fr.mediaUrl, '_blank', 'noopener'); break;
      case 'resetdemo': DB.reset(); toast('Sample data reset', 'info'); go('#/signin'); break;
      case 'signout': if (S().draft && hasContent(S().draft) && !t.dataset.sure) { openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="Sign out"><div class="toprow"><h2>SIGN OUT?</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div><p style="margin:0;font:15px/1.45 var(--in)">There’s an unsent report on this ' + (isWide() ? 'iPad' : 'phone') + '. Signing out deletes it.</p><div class="acts"><button class="obtn tertiary" data-act="close">Stay signed in</button><button class="obtn primary" data-act="signout" data-sure="1">Sign out</button></div></div>'); break; }
        closeLayer(); if (LIVE.on) { LIVE.signOut(); break; } S().me = null; DB.save(); go('#/signin'); break;
      case 'done': go('#/'); break;
      case 'close': closeLayer(); V = null; break;
      case 'viewer': openViewer(t.dataset.id, t.dataset.i); break;
      case 'vprev': vGo(V.i - 1); break;
      case 'vnext': vGo(V.i + 1); break;
      case 'vgo': vGo(+t.dataset.i); break;
      case 'jobs': openJobs(lastJobQ); lastJobQ = ''; break;
      case 'dates': openDates(); break;
      case 'pickday': d = D(); d.day = t.dataset.day; d.weather = null; d.sendKey = null; d.uploaded = []; d.triedOnce = false; saveSoon(); closeLayer(); var dy0 = window.scrollY; renderReport(); window.scrollTo(0, dy0); break;
      case 'additem': d = D(); d[t.dataset.k].push(''); saveSoon(); refresh('q-' + t.dataset.k); focusItem(t.dataset.k, d[t.dataset.k].length - 1); break;
      case 'rmitem': d = D(); d[t.dataset.k].splice(+t.dataset.i, 1); if (!d[t.dataset.k].length) d[t.dataset.k] = ['']; saveSoon(); refresh('q-' + t.dataset.k); break;
      case 'pickjob': d = D(); var j = job(t.dataset.num); if (!d.job || d.job.num !== j.num) { d.weather = null; d.sendKey = null; d.uploaded = []; d.triedOnce = false; } d.job = { num: j.num, name: j.name }; if (d.errors) delete d.errors.job; saveSoon(); closeLayer(); refresh('q-job'); break;
      case 'reqjob': var q = document.querySelector('[data-act=jobq]'); lastJobQ = q ? q.value : ''; openReqJob(lastJobQ); break;
      case 'usejob': var nm = document.getElementById('nj').value.trim(); if (!nm) { document.getElementById('nj').focus(); return; } d = D(); d.sendKey = null; d.uploaded = []; d.triedOnce = false; d.job = { num: null, name: nm, requested: true, addr: document.getElementById('na').value.trim() }; d.weather = null; if (d.errors) delete d.errors.job; saveSoon(); closeLayer(); refresh('q-job'); break;
      case 'time': openTime(t.dataset.k); break;
      case 'ap': TT.ap = t.dataset.v; var pp = parseT(TT.buf, TT.ap); if (pp.ok && pp.autoPM) { /* 24h entry: convert back to 12h digits */ var m = toMin(pp.hm); TT.buf = String(Math.floor(m / 60) % 12 || 12) + String(m % 60).padStart(2, '0'); } TT.fresh = false; drawTime(); break;
      case 'key':
        var key = t.dataset.k;
        if (TT.fresh && /\d/.test(key)) { TT.buf = ''; } TT.fresh = false;
        if (key === 'clear') TT.buf = ''; else if (key === 'del') TT.buf = TT.buf.slice(0, -1); else if (TT.buf.length < 4) { if (!(TT.buf === '' && key === '0' && false)) TT.buf += key; }
        drawTime(); break;
      case 'tdone': var p3 = parseT(TT.buf, TT.ap); if (!p3.ok) return; d = D(); d[TT.k] = p3.hm; if (d.errors && d.start && d.finish) delete d.errors.hours; saveSoon(); var nextK = TT.k === 'start' && !d.finish ? 'finish' : null; closeLayer(); refresh('q-hours'); if (nextK) openTime(nextK); break;
      case 'same': d = D(); var rec = (S().recent[S().me] || {}).hours; if (!rec) { var last = S().reports.filter(function (r) { return r.person === S().me; })[0]; rec = last ? { start: last.start, finish: last.finish } : { start: '07:00', finish: '15:30' }; } d.start = rec.start; d.finish = rec.finish; if (d.errors) delete d.errors.hours; saveSoon(); refresh('q-hours'); toast('Hours filled in', { kind: 'info', msg: fmt12(rec.start) + ' to ' + fmt12(rec.finish) }); break;
      case 'crew': d = D(); d.crew = Math.max(0, Math.min(99, d.crew + (+t.dataset.d))); var n = document.getElementById('crewn'); n.textContent = d.crew; n.classList.toggle('zero', !d.crew); if (d.errors && d.crew && d.errors.crew) { delete d.errors.crew; refresh('q-crew'); } saveSoon(); break;
      case 'yn': if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); d = D(); d[t.dataset.k].yes = t.dataset.v === '1'; if (d.errors) delete d.errors[t.dataset.k]; saveSoon(); refresh('q-' + t.dataset.k); break;
      case 'rmphoto': d = D(); d.uploaded = []; var gone = d.photos.splice(+t.dataset.i, 1)[0]; if (LIVE.on && gone && gone.key) LIVE.blobs.del(gone.key).catch(function () {}); saveSoon(); refresh('q-photos'); break;
      case 'send': send(); break;
      case 'gcopen': go('#/office/gc/' + t.dataset.id); break;
      case 'gcretry': var rt = gcReport(t.dataset.id); rt._mediaErr = false; route(); break;
      case 'gccombine':
        var lr = gcReport(t.dataset.id), orp = gcReport(t.dataset.o), lv = rv(lr), ov = rv(orp);
        ['work', 'delay', 'safety', 'mat', 'plan'].forEach(function (k) {
          var add = otherLines(orp, k); if (!add.length) return;
          var cur = GC.lines(lv.sections[k].text).filter(function (l) { return l !== NONE[k]; });
          lv.sections[k].text = cur.concat(add);
        });
        lv.combine = (lv.combine || []).concat([orp.id]); ov.combinedInto = lr.id;
        gcSave(lr, true).catch(function () {}); if (LIVE.on && LIVE.hasReviewColumn()) sync(LIVE.saveReview(orp)); DB.save();
        var yc = window.scrollY; route(); window.scrollTo(0, yc); toast('Reports combined', { msg: person(orp.person).short + '’s report is now part of this one.' }); break;
      case 'gcuncombine':
        var lr2 = gcReport(t.dataset.id), or2 = gcReport(t.dataset.o), lv2 = rv(lr2), ov2 = rv(or2), tag = person(or2.person).short + ': ';
        ['work', 'delay', 'safety', 'mat', 'plan'].forEach(function (k) {
          var keep = GC.lines(lv2.sections[k].text).filter(function (l) { return l.indexOf(tag) !== 0; });
          lv2.sections[k].text = keep.length ? keep : GC.original(lr2)[k].slice();
        });
        lv2.combine = (lv2.combine || []).filter(function (x) { return x !== or2.id; }); ov2.combinedInto = null;
        gcSave(lr2, true).catch(function () {}); if (LIVE.on && LIVE.hasReviewColumn()) sync(LIVE.saveReview(or2)); DB.save();
        var yu = window.scrollY; route(); window.scrollTo(0, yu); toast('Reports separated'); break;
      case 'gcsent':
        var rs = gcReport(t.dataset.id), vs = rv(rs), dft = (vs.drafts || []).slice(-1)[0];
        if (dft) { vs.sent = (vs.sent || []).concat([{ rev: dft.rev, at: Date.now(), hash: dft.hash, by: S().me, to: dft.to, file: dft.file }]); vs.drafts = []; }
        gcSave(rs, true).catch(function () {}); closeLayer(); route(); toast('Marked as sent to the GC'); break;
      case 'recmake':
        var rr9 = gcReport(t.dataset.id); gcBusy('Making the as-sent PDF…');
        loadAllMedia([rr9]).then(function () { return recordPdf(rr9, rr9.photoData || []); }).then(function (out) {
          gcText('Saving it to the job folder…');
          return LIVE.savePdf(rr9, out.name, out.blob).then(function () { return LIVE.markRecord(rr9, out.name); });
        }).then(function () { closeLayer(); route(); toast('Saved in the job folder', { msg: 'The as-sent PDF is with the job’s photos.' }); }, gcFail); break;
      case 'gcrevert': var rr0 = gcReport(t.dataset.id); rv(rr0).sections[t.dataset.k].text = GC.original(rr0)[t.dataset.k].slice(); gcSave(rr0); var yr = window.scrollY; route(); window.scrollTo(0, yr); break;
      case 'gcall': var ra = gcReport(t.dataset.id); rv(ra).photos = t.dataset.v === '1' ? null : []; rv(ra).otherPhotos = {}; combined(ra).forEach(function (o) { rv(ra).otherPhotos[o.id] = t.dataset.v === '1' ? null : []; }); gcSave(ra); var ya = window.scrollY; route(); window.scrollTo(0, ya); break;
      case 'gcpdf':
        gcMissingWarn();
        gcMake(gcReport(t.dataset.id)).then(function (out) {
          closeLayer(); var u = URL.createObjectURL(out.blob), a = document.createElement('a'); a.href = u; a.download = out.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
          var yd = window.scrollY; route(); window.scrollTo(0, yd); gcMissingWarn(); toast('PDF downloaded', { msg: out.name });
        }, gcFail); break;
      case 'gcfolder':
        var rf = gcReport(t.dataset.id);
        gcMake(rf).then(function (out) { gcText('Saving to the job folder…'); return LIVE.savePdf(rf, out.name, out.blob).then(function () { closeLayer(); toast('Saved in the job folder', { msg: out.name }); }); }).catch(gcFail); break;
      case 'gcmail':
        var rm = gcReport(t.dataset.id), jm2 = job(rm.job), to = String((jm2 && jm2.gcEmail) || '').split(/[,;\s]+/).filter(function (x) { return /@/.test(x); });
        if (!jm2) { toast('Approve the job first', { kind: 'error', msg: 'Email to GC needs the job’s GC email. Approve the job request on the Jobs page and add it there.' }); break; }
        var ve = validEmails(jm2 && jm2.gcEmail), ge = document.getElementById('gc-e');
        gcMissingWarn();
        if (!ve.list.length || ve.bad.length) { fieldState('gc-e', 'err', !ve.list.length ? 'Add the GC’s email to send the report' : 'Check this address: ' + ve.bad[0] + '. Example: name@company.com'); if (ge) { ge.scrollIntoView({ block: 'center' }); ge.focus(); } break; }
        gcMake(rm).then(function (out) {
          // Many company mail systems refuse attachments over about 10 MB.
          if (out.blob.size > 9.5 * 1048576) { closeLayer(); toast('PDF too big to email', { kind: 'error', msg: 'It’s ' + mb(out.blob.size) + '. Many email systems refuse that. Untick some photos and try again.' }); return; }
          gcText('Saving a copy to the job folder…');
          return LIVE.savePdf(rm, out.name, out.blob).then(function () {
            gcText('Making the email in Outlook…');
            var subj = 'Daily report ' + (out.m.rev ? '(Revision ' + out.m.rev + ') ' : '') + '· ' + (out.m.job.num ? out.m.job.num + ' ' : '') + out.m.job.name + ' · ' + shortDate(rm.date);
            var body = '<p>Attached is MKI’s daily report for ' + esc(out.m.job.name) + ' on ' + esc(wd(rm.date) + ', ' + md(rm.date)) + (out.m.rev ? ' (Revision ' + out.m.rev + ', replaces the earlier version)' : '') + '.</p><p>' + esc(person(S().me).name) + '<br>MKI LLC</p>';
            return LIVE.emailDraft(to, subj, body, out.name, out.blob);
          }).then(function (link) {
            var v2 = rv(rm); v2.drafts = (v2.drafts || []).concat([{ rev: out.m.rev, at: Date.now(), hash: gcHash(rm), by: S().me, to: to, file: out.name }]); gcSave(rm, true).catch(function () {});
            route();
            openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="Email ready"><div class="toprow"><h2>EMAIL READY</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
              '<p style="margin:0;font:15px/1.45 var(--in)">The email to ' + esc(to.join(', ')) + ' is in your Outlook drafts with the PDF attached. Open it, look it over and press Send. A copy of the PDF is in the job folder.</p>' +
              '<a class="obtn primary" href="' + esc(link) + '" target="_blank" rel="noopener">Open the email in Outlook</a>' +
              '<p style="margin:6px 0 0;font:14px/1.45 var(--in);color:var(--mut)">After you press Send in Outlook, tap below so the app knows the GC has it.</p>' +
              '<div class="acts"><button class="obtn tertiary" data-act="close">Not sent yet</button><button class="obtn primary" data-act="gcsent" data-id="' + rm.id + '">I sent it</button></div></div>');
          });
        }).catch(gcFail); break;
      case 'cancelsend': stopSend = true; if (LIVE.on) LIVE.cancel(); if (document.getElementById('busytxt') && /weather/i.test(document.getElementById('busytxt').textContent)) { closeLayer(); toast('Sending stopped', { kind: 'info', msg: 'Your report is saved here. Tap Send when you’re ready.' }); renderReport(); } break;
      case 'discard':
        openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="Throw away report"><div class="toprow"><h2>THROW IT AWAY?</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div><p style="margin:0;font:15px/1.45 var(--in)">The unsent report for ' + esc(shortDate(S().draft.day)) + (S().draft.photos.length ? ' and its ' + mediaCount(S().draft.photos).toLowerCase() : '') + ' will be deleted from this ' + (isWide() ? 'iPad' : 'phone') + '. This can’t be undone.</p><div class="acts"><button class="obtn tertiary" data-act="close">Keep it</button><button class="obtn primary" data-act="dodiscard">Throw it away</button></div></div>');
        break;
      case 'dodiscard': var old = S().draft; S().draft = null; DB.save(); if (LIVE.on && old) (old.photos || []).forEach(function (m) { if (m && m.key) LIVE.blobs.del(m.key).catch(function () {}); }); closeLayer(); if (/^#\/report/.test(location.hash)) go('#/'); else route(); break;
      case 'soon': break;
      case 'statf': F.chips = {}; F.chips[t.dataset.k] = true; F.range = '7'; F.q = ''; F.job = ''; F.who = ''; F.more = 9; go('#/office/reports'); break;
      case 'clearf': F.chips = {}; F.q = ''; F.job = ''; F.who = ''; F.range = '7'; F.more = 9; route(); break;
      case 'jobreports': F.chips = {}; F.q = ''; F.who = ''; F.job = t.dataset.num; F.range = 'all'; F.more = 9; go('#/office/reports'); break;
      case 'chip': F.chips[t.dataset.k] = !F.chips[t.dataset.k]; F.more = 9; route(); break;
      case 'more': F.more += 9; document.getElementById('results') ? (document.getElementById('results').innerHTML = resultsHTML()) : route(); break;
      case 'sug': F[t.dataset.k] = t.dataset.v; F.q = ''; F.more = 9; route(); break;
      case 'addjob': openAddJob(); break;
      case 'savejob':
        var nm2 = document.getElementById('aj-n'), nf = document.getElementById('aj-j'), num = nf.value.trim() || nextNum();
        fieldState('aj-n'); fieldState('aj-j');
        var bad = function (el, msg) { fieldState(el.id, 'err', msg); el.focus(); };
        if (!nm2.value.trim()) { bad(nm2, 'Add the job name'); return; }
        if (!/^[A-Za-z0-9-]{1,20}$/.test(num)) { bad(nf, 'Use numbers and dashes only, like 26-3009'); return; }
        if (job(num)) { bad(nf, 'Job ' + num + ' already exists'); return; }
        var gev = validEmails(document.getElementById('aj-ge').value); if (gev.bad.length) { bad(document.getElementById('aj-ge'), 'Check this address: ' + gev.bad[0] + '. Example: name@company.com'); return; }
        var nj = { num: num, name: nm2.value.trim().slice(0, 80), active: true, foreman: document.getElementById('aj-f').value || null, address: document.getElementById('aj-a').value.trim().slice(0, 200), gc: document.getElementById('aj-gc').value.trim(), gcProject: document.getElementById('aj-gp').value.trim(), gcEmail: document.getElementById('aj-ge').value.trim() }, moved = [];
        S().jobs.push(nj);
        if (t.dataset.req) { var rqo = S().requests.filter(function (x) { return x.id === t.dataset.req; })[0]; if (rqo) S().reports.forEach(function (r) { if (r.jobName === rqo.name && r.job.indexOf('new:') === 0) { r.job = num; r.jobName = null; moved.push(r); } }); S().requests = S().requests.filter(function (x) { return x.id !== t.dataset.req; }); }
        DB.save(); closeLayer(); route(); if (LIVE.on) sync(LIVE.addJob(nj).then(function () { return LIVE.patchReports(moved); }), 'Job added'); else toast('Job added'); break;
      case 'approve': var rr = S().requests.filter(function (x) { return x.id === t.dataset.id; })[0]; openAddJob(rr.name, rr.id, rr.note || ''); break;
      case 'editjob': var om = document.querySelector('.menu'); if (om) om.remove(); openAddJob(null, null, null, t.dataset.num); break;
      case 'saveedit':
        var ej2 = job(t.dataset.num), en = document.getElementById('aj-n'); fieldState('aj-n');
        if (!en.value.trim()) { fieldState('aj-n', 'err', 'Add the job name'); en.focus(); return; }
        var gev2 = validEmails(document.getElementById('aj-ge').value); if (gev2.bad.length) { fieldState('aj-ge', 'err', 'Check this address: ' + gev2.bad[0] + '. Example: name@company.com'); document.getElementById('aj-ge').focus(); return; }
        var before = { name: ej2.name, address: ej2.address, foreman: ej2.foreman, gc: ej2.gc, gcProject: ej2.gcProject, gcEmail: ej2.gcEmail };
        ej2.name = en.value.trim().slice(0, 80); ej2.address = document.getElementById('aj-a').value.trim().slice(0, 200); ej2.foreman = document.getElementById('aj-f').value || null; ej2.gc = document.getElementById('aj-gc').value.trim(); ej2.gcProject = document.getElementById('aj-gp').value.trim(); ej2.gcEmail = document.getElementById('aj-ge').value.trim();
        DB.save(); closeLayer(); route();
        if (LIVE.on) sync(LIVE.updateJob(ej2), 'Job saved', function () { for (var bk in before) ej2[bk] = before[bk]; DB.save(); route(); }); else toast('Job saved');
        break;
      case 'merge': openMerge(t.dataset.id); break;
      case 'domerge': var mgs = document.getElementById('mg'), to = mgs.value; if (!to) { fieldState('mg', 'err', 'Pick the job to merge into'); mgs.focus(); return; } var rq2 = S().requests.filter(function (x) { return x.id === t.dataset.id; })[0]; var moved2 = []; S().reports.forEach(function (r) { if (r.jobName === rq2.name && r.job.indexOf('new:') === 0) { r.job = to; r.jobName = null; moved2.push(r); } }); S().requests = S().requests.filter(function (x) { return x.id !== rq2.id; }); DB.save(); sync(LIVE.on && LIVE.patchReports(moved2)); closeLayer(); route(); toast('Merged into ' + job(to).name + '.'); break;
      case 'jobmenu': var openM = document.querySelector('.menu'); var same = openM && openM.dataset.num === t.dataset.num; if (openM) openM.remove(); [].forEach.call(document.querySelectorAll('tr.mopen'), function (x) { x.classList.remove('mopen'); }); if (same) break; var jrow = t.closest('tr'); if (jrow) jrow.classList.add('mopen'); var jm = job(t.dataset.num); var mn = document.createElement('div'); mn.className = 'menu'; mn.setAttribute('role', 'menu'); mn.dataset.num = jm.num; mn.innerHTML = '<button role="menuitem" data-act="editjob" data-num="' + esc(jm.num) + '">' + I('file-text', 16) + 'Edit job</button><button role="menuitem" data-act="jobstate" data-num="' + esc(jm.num) + '">' + I(jm.active ? 'check' : 'arrow-right', 16) + (jm.active ? 'Mark job finished' : 'Reopen job') + '</button>'; t.parentNode.appendChild(mn); break;
      case 'jobstate': var jj = job(t.dataset.num); jj.active = !jj.active; DB.save(); route(); sync(LIVE.on && LIVE.updateJob(jj)); toast(jj.active ? 'Job reopened' : 'Job marked finished', { msg: jj.name, action: { label: 'Undo', fn: function () { jj.active = !jj.active; DB.save(); route(); sync(LIVE.on && LIVE.updateJob(jj)); } } }); break;
      case 'rem': var pr = person(t.dataset.id); pr.reminder = !pr.reminder; DB.save(); route(); sync(LIVE.on && LIVE.savePerson(pr)); break;
    }
  });
  document.addEventListener('focusout', function (ev) { if (ev.target.dataset && ev.target.dataset.fil === 'q') setTimeout(function () { var sg = document.getElementById('sugg'); if (sg && !sg.contains(document.activeElement)) sg.classList.remove('open'); }, 150); });
  document.addEventListener('focusin', function (ev) { if (ev.target.dataset && ev.target.dataset.fil === 'q' && ev.target.value.trim()) { var sg = document.getElementById('sugg'); sg.innerHTML = suggestHTML(ev.target.value); sg.classList.add('open'); } });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { var sg = document.getElementById('sugg'); if (sg) sg.classList.remove('open'); } if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.fil === 'q') { ev.target.blur(); } });
  // GC report editing: section text, include switches, photos, and the job's GC details.
  function gcCurrent() { var m = location.hash.match(/^#\/office\/gc\/(.+)$/); return m ? gcReport(m[1]) : null; }
  document.addEventListener('input', function (ev) {
    var g = ev.target.closest('[data-gc="text"]'); if (!g) return;
    var r = gcCurrent(); if (!r) return; rv(r).sections[g.dataset.k].text = g.value.split('\n'); gcSave(r);
    var box = document.getElementById('gco-' + g.dataset.k); if (box) box.innerHTML = gcOrigHTML(r, g.dataset.k);
    var st = document.getElementById('gcstat'); if (st) st.innerHTML = gcStatHTML(r);
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, r = gcCurrent(); if (!r) return;
    var v = rv(r);
    if (t.dataset.gc === 'text') return;
    if (t.dataset.gc === 'on') { v.sections[t.dataset.k].on = t.checked; gcSave(r); var sec = t.closest('.gcsec'); if (sec) { sec.classList.toggle('off', !t.checked); var lab = sec.querySelector('.gcin'); if (lab) lab.textContent = t.checked ? 'In the GC report' : 'Not sent to the GC'; } var st1 = document.getElementById('gcstat'); if (st1) st1.innerHTML = gcStatHTML(r); return; }
    if (t.dataset.gc === 'photo') {
      var src = t.dataset.o ? gcReport(t.dataset.o) : r, store = t.dataset.o ? ((v.otherPhotos = v.otherPhotos || {})[t.dataset.o]) : v.photos;
      var all = (src.photoData || []).map(function (x, i) { return isVid(x) ? -1 : i; }).filter(function (i) { return i > -1; });
      var cur = store ? store.slice() : all.slice(), i = +t.dataset.i;
      cur = t.checked ? cur.concat([i]).filter(function (x, k, a) { return a.indexOf(x) === k; }) : cur.filter(function (x) { return x !== i; });
      if (t.dataset.o) v.otherPhotos[t.dataset.o] = cur.length === all.length ? null : cur; else v.photos = cur.length === all.length ? null : cur; t.closest('.gcpic').classList.toggle('on', t.checked); gcSave(r); var st2 = document.getElementById('gcstat'); if (st2) st2.innerHTML = gcStatHTML(r); return;
    }
    if (t.dataset.gcjob) {
      if (t.dataset.gcjob === 'gcEmail') { var vb = validEmails(t.value).bad; fieldState(t.id, vb.length ? 'err' : '', vb.length ? 'Check this address: ' + vb[0] + '. Example: name@company.com' : ''); }
      else if (t.value.trim()) fieldState(t.id);
      var j = job(r.job); if (!j) return; var before = j[t.dataset.gcjob];
      j[t.dataset.gcjob] = t.value.trim(); DB.save();
      if (LIVE.on) sync(LIVE.updateJob(j), null, function () { j[t.dataset.gcjob] = before; DB.save(); var y2 = window.scrollY; route(); window.scrollTo(0, y2); });
    }
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.dataset.f) { var d = D(), f = t.dataset.f; if (f.indexOf('.') > -1) { var p = f.split('.'); d[p[0]][p[1]] = t.value; f = p[0]; } else d[f] = t.value; if (d.errors && d.errors[f] && t.value.trim()) { delete d.errors[f]; var c = t.closest('.card'); c.classList.remove('bad'); var em = c.querySelector('.emsg'); if (em) em.remove(); updateBanner(); } saveSoon(); autoGrow(t); }
    if (t.dataset.act === 'jobq') document.getElementById('jlist').innerHTML = jobTray(t.value);
    if (t.dataset.fil === 'q') { F.q = t.value; F.more = 9; document.getElementById('results').innerHTML = resultsHTML(); var sg = document.getElementById('sugg'); sg.innerHTML = suggestHTML(t.value); sg.classList.toggle('open', !!t.value.trim()); }
    if (t.dataset.fil === 'jq') { F.jq = t.value; var tmp = document.createElement('div'); tmp.innerHTML = renderJobs(); var nb = tmp.querySelector('#jobsbody'); document.getElementById('jobsbody').innerHTML = nb.innerHTML; }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'pd' && t.value) { var dd0 = D(), mx = todayKey(); if (t.value <= mx) { dd0.day = t.value; dd0.weather = null; dd0.sendKey = null; dd0.uploaded = []; dd0.triedOnce = false; saveSoon(); closeLayer(); var yy = window.scrollY; renderReport(); window.scrollTo(0, yy); } return; }
    if (t.dataset.fil && t.tagName === 'SELECT') { F[t.dataset.fil] = t.value; F.more = 9; route(); }
    if (t.dataset.act === 'photos') addPhotos(t.files);
  });
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, t.classList.contains('li') ? 52 : t.classList.contains('sm') ? 99 : 110) + 'px'; }

  /* Photos are shrunk on the phone before saving, so reports stay small. */
  // When a photo was actually taken, read from the photo itself (EXIF DateTimeOriginal). If the phone
  // didn't keep it, there's no time rather than a wrong one.
  function exifTime(f) {
    if (!f || !/jpe?g/i.test(f.type || f.name || '') || !f.slice) return Promise.resolve(null);
    return new Promise(function (res) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var v = new DataView(fr.result), o = 2;
          if (v.getUint16(0) !== 0xFFD8) return res(null);
          while (o + 4 < v.byteLength) {
            var mk = v.getUint16(o), len = v.getUint16(o + 2);
            if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
              var t = o + 10, le = v.getUint16(t) === 0x4949;
              var u16 = function (a) { return v.getUint16(a, le); }, u32 = function (a) { return v.getUint32(a, le); };
              var find = function (ifd, tag) { var n = u16(ifd); for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return 0; };
              var ifd0 = t + u32(t + 4), ex = find(ifd0, 0x8769), dt = 0;
              if (ex) dt = find(t + u32(ex + 8), 0x9003);
              if (!dt) dt = find(ifd0, 0x0132);
              if (!dt) return res(null);
              var at = t + u32(dt + 8), str = '';
              for (var k = 0; k < 19; k++) str += String.fromCharCode(v.getUint8(at + k));
              var m = str.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
              return res(m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null);
            }
            if ((mk & 0xFF00) !== 0xFF00) break;
            o += 2 + len;
          }
          res(null);
        } catch (e) { res(null); }
      };
      fr.onerror = function () { res(null); };
      fr.readAsArrayBuffer(f.slice(0, 262144));
    });
  }
  function addPhotos(files) {
    var d = D(), list = Array.prototype.slice.call(files, 0, MAXP - d.photos.length), vids = d.photos.filter(isVid).length, msgs = [];
    var chainP = Promise.resolve();
    var jobs = list.map(function (f) {
      return chainP = chainP.then(function () { return new Promise(function (res) {
        var url = URL.createObjectURL(f);
        if (/^video\//.test(f.type)) {
          if (vids >= MAXV) { msgs.push('Up to ' + MAXV + ' videos per report.'); URL.revokeObjectURL(url); return res(null); }
          vids++;
          var v = document.createElement('video'), done = false; v.muted = true; v.playsInline = true; v.preload = 'auto';
          var finish = function (thumb) { if (done) return; done = true; var key = 'v' + Date.now() + Math.random().toString(36).slice(2, 6); VIDS[key] = url; var item = { v: 1, key: key, thumb: thumb || null, dur: v.duration || 0, name: f.name, size: f.size }; if (!LIVE.on) return res(item); LIVE.blobs.put(key, f).then(function () { res(item); }, function () { msgs.push('This phone is out of space for “' + f.name + '”.'); res(null); }); };
          v.onloadedmetadata = function () { if (v.duration > MAXVSEC + 1) { done = true; vids--; msgs.push('“' + f.name + '” is ' + mmss(v.duration) + '. Videos can be up to 3 minutes.'); URL.revokeObjectURL(url); return res(null); } try { v.currentTime = Math.min(0.5, v.duration / 2); } catch (e) { finish(null); } };
          v.onseeked = function () { try { var sc = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * sc); c.height = Math.round(v.videoHeight * sc); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); finish(c.toDataURL('image/jpeg', 0.7)); } catch (e) { finish(null); } };
          v.onerror = function () { finish(null); };
          setTimeout(function () { finish(null); }, 4000);
          v.src = url; return;
        }
        var img = new Image();
        img.onload = function () {
          var s2 = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s2); c.height = Math.round(img.height * s2); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var thumb = c.toDataURL('image/jpeg', 0.72);
          if (!LIVE.on) { URL.revokeObjectURL(url); return res({ thumb: thumb }); }
          // Live: a full-size copy (up to 2560px) is kept on the phone until the report is sent.
          var s3 = Math.min(1, 2560 / Math.max(img.width, img.height)), c2 = document.createElement('canvas'); c2.width = Math.round(img.width * s3); c2.height = Math.round(img.height * s3); c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
          URL.revokeObjectURL(url);
          c2.toBlob(function (b) { var key = 'p' + Date.now() + Math.random().toString(36).slice(2, 6); LIVE.blobs.put(key, b || f).then(function () { res({ key: key, thumb: thumb, name: f.name }); }, function () { msgs.push('This phone is out of space for more photos.'); res(null); }); }, 'image/jpeg', 0.86);
        };
        img.onerror = function () { res(null); }; img.src = url;
      }); });
    });
    var times = list.map(exifTime);
    Promise.all([Promise.all(jobs), Promise.all(times)]).then(function (both) { var urls = both[0]; urls.forEach(function (u, i) { if (u && typeof u === 'object' && both[1][i]) u.taken = both[1][i]; }); urls.forEach(function (u) { if (u) d.photos.push(u); }); d.uploaded = []; saveSoon(); refresh('q-photos'); if (msgs.length) toast(msgs.length > 1 ? 'Some items weren’t added' : 'Not added', { kind: 'warning', msg: msgs[0] }); });
  }


  /* ---------------- updates ----------------
     A home-screen app never reloads itself, so it checks version.json when it opens, when it comes back
     to the front, and when you move between screens. A new version loads at a safe moment: never while a
     report is open or sending, while typing, or with a tray open (the draft is saved on the device anyway). */
  var updV = null, updAt = 0;
  function safeToUpdate() {
    var a = document.activeElement;
    if (sending || $layer.firstChild || /^#\/(report|sent|off)/.test(location.hash) || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return false;
    // Save anything still waiting first. Never reload while work exists only in memory.
    if (saveT) saveNow();
    if (saveFailed) return false;
    if (gcPending) { gcSave(gcPending, true).then(function () { checkUpdate(false); }, function () {}); return false; }
    return !S().reports.some(function (r) { return r._dirty; });
  }
  function applyUpdate() {
    if (!updV) return false;
    // Tried this version already (the server's page may still be the old one): stop, and check again later.
    var tried = null; try { tried = sessionStorage.getItem('mki-upd'); } catch (e) {}
    if (tried === updV || new RegExp('[?&]v=' + updV.replace(/\W/g, '\\$&') + '(&|$)').test(location.search)) { updV = null; return false; }
    if (!safeToUpdate()) return false;
    try { sessionStorage.setItem('mki-upd', updV); } catch (e) {}
    // A new address skips the browser's copy of the old page.
    location.replace(location.pathname + '?v=' + encodeURIComponent(updV) + location.hash);
    return true;
  }
  window.addEventListener('pagehide', function () { if (saveT) saveNow(); });
  function checkUpdate(force) {
    if (updV) { applyUpdate(); return; }
    if (!force && Date.now() - updAt < 60000) return;
    updAt = Date.now();
    if (!window.fetch || !window.APP_V || /localhost|127\.0\.0\.1/.test(location.hostname)) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.v && String(j.v) !== String(window.APP_V)) { updV = String(j.v); applyUpdate(); }
    }).catch(function () {});
  }
  window.addEventListener('hashchange', function () { checkUpdate(false); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkUpdate(true); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) checkUpdate(true); });
  setTimeout(function () { checkUpdate(true); }, 3000);
  setInterval(function () { if (!document.hidden) checkUpdate(true); }, 15 * 60000);

  // Typing in a field that shows an error clears it; the check runs again on the next save or send.
  document.addEventListener('input', function (ev) { var f = ev.target.closest && ev.target.closest('.fld.is-err,.fld.is-warn'); if (f && ev.target.id) fieldState(ev.target.id); });

  window.APP = { route: route, toast: toast, go: go, checkUpdate: checkUpdate };
  if (LIVE.on) { document.body.classList.add('live'); LIVE.start(); } else route();
})();
