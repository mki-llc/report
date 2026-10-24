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
  function flagsOf(r) { var f = []; if (r.mat.yes) f.push(['Materials', 'warn']); if (r.delay.yes) f.push(['Delay', 'warn']); if (r.safety.yes) f.push(['Safety', 'err']); if (!f.length) f.push(['All clear', 'ok']); return f; }
  function pill(t, k, sm) { var ic = k === 'ok' ? 'check' : k === 'err' ? 'alert-circle' : k === 'warn' ? 'alert-triangle' : null; return '<span class="pill ' + k + '">' + (ic ? I(ic, sm ? 13 : 14) : '') + esc(t) + '</span>'; }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function closeLayer() { $layer.innerHTML = ''; document.body.style.overflow = ''; }
  function openLayer(html) { $layer.innerHTML = html; document.body.style.overflow = 'hidden'; }
  function isWide() { return window.matchMedia('(min-width:700px)').matches; }

  var MAXP = 30; // photos per report
  /* ---------------- draft ---------------- */
  function newDraft() { return { date: todayKey(), job: null, start: null, finish: null, crew: 0, work: '', mat: { yes: null, text: '' }, delay: { yes: null, text: '' }, safety: { yes: null, text: '' }, plan: '', photos: [], weather: null, errors: null }; }
  function D() { var s = S(); if (!s.draft || s.draft.date !== todayKey()) { s.draft = newDraft(); } return s.draft; }
  var saveT; function saveSoon() { clearTimeout(saveT); saveT = setTimeout(DB.save, 300); }

  /* ---------------- router ---------------- */
  function route() {
    closeLayer();
    var h = location.hash.replace(/^#\/?/, '') || '', parts = h.split('/');
    var isOffice = parts[0] === 'office';
    document.body.classList.toggle('foreman', !isOffice);
    window.scrollTo(0, 0);
    var me = S().me;
    if (!isOffice) {
      if (parts[0] === 'signin' || !me) return renderSignin();
      if (parts[0] === 'report') return renderReport();
      if (parts[0] === 'sent') return renderSent(parts[1]);
      return renderStart();
    }
    var page = parts[1] || 'today';
    if (page === 'reports') return office('reports', renderReports);
    if (page === 'report') return office('reports', function () { return renderDetail(parts[2]); });
    if (page === 'jobs') return office('jobs', renderJobs);
    if (page === 'foremen') return office('foremen', renderForemen);
    return office('today', renderToday);
  }
  window.addEventListener('hashchange', route);

  function previewBar(active) {
    return '<nav class="pv" aria-label="Preview"><span class="pvl">PREVIEW</span><a href="#/" class="' + (active === 'f' ? 'on' : '') + '">Foreman</a><a href="#/office" class="' + (active === 'o' ? 'on' : '') + '">Office</a></nav>';
  }

  /* ---------------- foreman: start ---------------- */
  function renderStart() {
    var k = todayKey(), me = person(S().me);
    var already = S().reports.filter(function (r) { return r.person === me.id && r.date === k; })[0];
    $app.innerHTML = previewBar('f') + '<main class="dark start"><div class="top"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><div class="tag">END OF DAY REPORT</div><p class="weekday">' + wd(k).toUpperCase() + '</p><p class="date">' + md(k).toUpperCase() + '</p></div>' +
      '<div class="bottom"><button class="go" data-act="start">' + (already ? 'SEND ANOTHER REPORT' : "START TODAY'S REPORT") + ' ' + I('arrow-right', 22, '#990000') + '</button>' +
      '<p class="hint">' + (already ? 'You already sent one today for ' + esc(jobName(already)) + '. Send another only if you worked a second job.' : 'Takes about 3 minutes. Tap the microphone on your keyboard to talk instead of typing.') + '</p>' +
      '<p class="who">Signed in as ' + esc(me.name) + '. <button data-act="signout">Not you?</button></p></div></main>';
  }

  /* ---------------- foreman: sign in ---------------- */
  function renderSignin() {
    $app.innerHTML = previewBar('f') + '<main class="dark signin"><img class="logo" src="' + LOGO + '" alt="MKI LLC"><h1>SIGN IN ONCE</h1><p>Use your MKI work account, the same one you use for email. You stay signed in on this phone after that.</p><div class="grow"></div>' +
      '<button class="msbtn" data-act="signin"><svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>Sign in with Microsoft</button>' +
      '<p class="cap">Preview: this signs you in as a sample foreman. Nothing is sent anywhere.</p></main>';
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
      '<div class="yn" role="radiogroup"><button class="' + (v.yes === false ? 'on' : '') + '" data-act="yn" data-k="' + key + '" data-v="0">' + (v.yes === false ? I('check', 16) : '') + 'NO</button><button class="' + (v.yes === true ? 'on' : '') + '" data-act="yn" data-k="' + key + '" data-v="1">' + (v.yes === true ? I('check', 16) : '') + 'YES</button></div>' +
      (v.yes ? '<div class="dl">' + detail + '</div><textarea class="sm" data-f="' + key + '.text" placeholder="Type or tap the mic to talk" rows="3">' + esc(v.text) + '</textarea>' : '') +
      (e[key] ? emsg(e[key]) : '') + '</section>';
  }
  function photosCard(d) {
    var tiles = d.photos.map(function (p, i) { return '<div class="tile" style="background-image:url(' + p + ')"><button class="rm" data-act="rmphoto" data-i="' + i + '" aria-label="Remove photo">' + I('x', 14, '#fff') + '</button></div>'; }).join('');
    return '<section class="card" id="q-photos"><div class="ph-h">' + qLabel(9, 'PHOTOS') + '<span class="help" style="font-weight:500">' + d.photos.length + ' of ' + MAXP + ' · optional</span></div>' +
      '<div class="grid">' + tiles + (d.photos.length < MAXP ? '<label class="addt">' + I('camera', 24) + 'Add<input type="file" accept="image/*" multiple class="sr" data-act="photos"></label>' : '') + '</div></section>';
  }
  function jobCard(d, e) {
    var j = d.job;
    return '<section class="card' + (e.job ? ' bad' : '') + '" id="q-job">' + qLabel(1, 'JOB') +
      '<button class="select' + (j ? ' has' : '') + '" data-act="jobs">' + I('briefcase', 20, '#6B6262') + '<span class="v">' + (j ? esc(j.name) : 'Choose a job') + '</span>' + I('chevron-down', 20, '#6B6262') + '</button>' +
      (j && j.requested ? '<span class="jobtag">' + I('clock', 13) + 'New job · the office will confirm the name</span>' : '') +
      (e.job ? emsg(e.job) : '') + '</section>';
  }

  /* Update only the card that changed, so the page never re-draws or jumps under your thumb. */
  var CARD = {
    'q-job': function (d, e) { return jobCard(d, e); },
    'q-hours': function (d, e) { return hoursCard(d, e); },
    'q-crew': function (d, e) { return crewCard(d, e); },
    'q-mat': function (d, e) { return ynCard(5, 'mat', 'MATERIALS, EQUIPMENT, OR INSPECTIONS', d, e, 'What’s needed?'); },
    'q-delay': function (d, e) { return ynCard(6, 'delay', 'WEATHER, SITE, OR OTHER-TRADE DELAYS', d, e, 'What happened?'); },
    'q-safety': function (d, e) { return ynCard(7, 'safety', 'SAFETY OR QUALITY ISSUES', d, e, 'What happened?'); },
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
    if (id === 'q-job') { var wx = document.querySelector('.wx'); if (wx) wx.innerHTML = I('sun', 16, '#6B6262') + (d.job ? (d.weather ? esc(d.weather) + ' at the job site · added for you' : 'Getting the weather for the job site…') : 'Weather is added for you once you pick a job'); if (d.job && !d.weather) getWeather(); }
    updateBanner();
    var n = document.getElementById(id); if (n) { var dy = n.getBoundingClientRect().top - top; if (Math.abs(dy) > 0.5) window.scrollBy(0, dy); }
  }
  function renderReport() {
    var d = D(), e = d.errors || {}, k = todayKey(), me = person(S().me);
    var nErr = Object.keys(e).length;
    var wx = d.job ? (d.weather ? esc(d.weather) + ' at the job site · added for you' : 'Getting the weather for the job site…') : 'Weather is added for you once you pick a job';
    var wide = isWide();
    var head = '<header class="fh"><div class="row"><div><img class="logo" src="' + LOGO + '" alt="MKI LLC"><div class="wd">' + wd(k).toUpperCase() + '</div><div class="dt">' + md(k).toUpperCase() + '</div></div><div class="name">' + esc(me.short) + '</div></div></header>';
    var work = textCard(4, 'work', 'WORK COMPLETED TODAY', d, e);
    var mat = ynCard(5, 'mat', 'MATERIALS, EQUIPMENT, OR INSPECTIONS', d, e, 'What’s needed?');
    var delay = ynCard(6, 'delay', 'WEATHER, SITE, OR OTHER-TRADE DELAYS', d, e, 'What happened?');
    var safety = ynCard(7, 'safety', 'SAFETY OR QUALITY ISSUES', d, e, 'What happened?');
    var plan = textCard(8, 'plan', 'PLAN FOR NEXT WORKDAY', d, e);
    var body = (nErr ? '<div class="banner" id="banner">' + I('alert-circle', 20) + (nErr === 1 ? '1 answer is missing. It’s marked below.' : nErr + ' answers are missing. They’re marked below.') + '</div>' : '') +
      jobCard(d, e) + '<div class="wx">' + I('sun', 16, '#6B6262') + wx + '</div>' +
      '<div class="pair">' + hoursCard(d, e) + crewCard(d, e) + '</div>' +
      '<div class="cols"><div class="col">' + work + plan + '</div><div class="col">' + mat + delay + safety + '</div></div>' +
      photosCard(d) +
      '<div class="sendrow"><p class="help" style="margin:0">Goes to the office and the job folder right away.</p><button class="btn btn-primary" data-act="send">SEND REPORT</button></div>';
    // phone order: work, materials, delays, safety, plan (cols use display:contents, so reorder for phone)
    if (!wide) body = body.replace('<div class="cols"><div class="col">' + work + plan + '</div><div class="col">' + mat + delay + safety + '</div></div>', work + mat + delay + safety + plan);
    $app.innerHTML = previewBar('f') + head + '<main class="ql">' + body + '</main>';
    if (d.job && !d.weather) getWeather();
  }

  /* weather from the National Weather Service (free). Preview uses the Charlotte airport station. */
  var wxBusy = false;
  function getWeather() {
    if (wxBusy) return; wxBusy = true;
    fetch('https://api.weather.gov/stations/KCLT/observations/latest', { headers: { Accept: 'application/geo+json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var p = j.properties, c = p.temperature && p.temperature.value, t = (p.textDescription || '').trim();
        var f = c == null ? null : Math.round(c * 9 / 5 + 32);
        D().weather = (t || 'Weather') + (f != null ? ', ' + f + '°' : '');
      })
      .catch(function () { D().weather = 'Weather unavailable right now'; })
      .then(function () { wxBusy = false; saveSoon(); var el = document.querySelector('.wx'); if (el && location.hash.indexOf('report') > -1) el.innerHTML = I('sun', 16, '#6B6262') + esc(D().weather) + ' at the job site · added for you'; });
  }

  function validate(d) {
    var e = {};
    if (!d.job) e.job = 'Pick a job';
    if (!d.start || !d.finish) e.hours = 'Add your start and finish time';
    else if (d.start === d.finish) e.hours = 'Start and finish can’t be the same time';
    if (!d.crew) e.crew = 'Add how many people were on site';
    if (!d.work.trim()) e.work = 'Say what got done today';
    ['mat', 'delay', 'safety'].forEach(function (k) { if (d[k].yes === null) e[k] = 'Pick yes or no'; else if (d[k].yes && !d[k].text.trim()) e[k] = 'Add a few words'; });
    if (!d.plan.trim()) e.plan = 'Say what’s next';
    return e;
  }

  function send() {
    var d = D(), e = validate(d);
    if (Object.keys(e).length) {
      d.errors = e; renderReport();
      var b = document.getElementById('banner'); if (b) window.scrollTo(0, b.getBoundingClientRect().top + window.scrollY - 16);
      return;
    }
    var now = new Date(), s = S();
    var id = 'r' + now.getTime();
    var rep = { id: id, date: todayKey(), person: s.me, job: d.job.num || ('new:' + d.job.name), jobName: d.job.num ? null : d.job.name, sentAt: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      start: d.start, finish: d.finish, crew: d.crew, weather: d.weather || '', work: d.work.trim(), mat: d.mat, delay: d.delay, safety: d.safety, plan: d.plan.trim(), photos: d.photos.length, photoData: d.photos.slice(0, MAXP) };
    if (d.job.requested) s.requests.push({ id: 'q' + now.getTime(), name: d.job.name, by: s.me, date: todayKey(), note: d.job.addr || '' });
    s.reports.unshift(rep);
    s.recent[s.me] = s.recent[s.me] || {}; s.recent[s.me].hours = { start: d.start, finish: d.finish };
    s.draft = null;
    try { DB.save(); } catch (err) { rep.photoData = []; DB.save(); }
    go('#/sent/' + id);
  }

  /* ---------------- foreman: sent ---------------- */
  function renderSent(id) {
    var r = S().reports.filter(function (x) { return x.id === id; })[0];
    if (!r) return go('#/');
    var me = person(r.person), fl = [];
    if (r.mat.yes) fl.push('Needs materials'); if (r.delay.yes) fl.push('Delay'); if (r.safety.yes) fl.push('Safety');
    $app.innerHTML = previewBar('f') + '<main class="dark sent"><div class="okc">' + I('check', 38, '#fff') + '</div><h1>REPORT SENT</h1><p class="sub">You’re done for today. Thanks, ' + esc(me.first) + '.</p>' +
      '<div class="sum"><div><span>Job</span><b>' + esc(jobName(r)) + '</b></div><div><span>Sent</span><b>' + shortDate(r.date) + ' · ' + sentText(r) + '</b></div><div><span>Hours</span><b>' + fmt12(r.start) + ' to ' + fmt12(r.finish) + '</b></div><div><span>Photos</span><b>' + r.photos + '</b></div><div><span>Flagged</span><b>' + (fl.length ? fl.join(', ') : 'Nothing') + '</b></div></div>' +
      '<div class="grow"></div><button class="btn btn-white" data-act="done">DONE</button><p class="cap">Next time you open the app it starts fresh.</p></main>';
  }

  /* ---------------- job tray ---------------- */
  function recentJobs() {
    var me = S().me, seen = {}, out = [];
    S().reports.forEach(function (r) { if (r.person === me && !seen[r.job] && job(r.job) && job(r.job).active && out.length < 2) { seen[r.job] = 1; out.push({ j: job(r.job), when: relDate(r.date) }); } });
    return out;
  }
  function jobTray(q) {
    q = (q || '').trim().toLowerCase();
    var act = S().jobs.filter(function (j) { return j.active; }), cur = D().job, rows;
    function row(j, sub) { return '<button class="jrow' + (cur && cur.num === j.num ? ' on' : '') + '" data-act="pickjob" data-num="' + j.num + '"><b>' + esc(j.name) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</button>'; }
    if (q) {
      var m = act.filter(function (j) { return (j.name + ' ' + j.num).toLowerCase().indexOf(q) > -1; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      rows = '<div class="sl">Results</div>' + (m.length ? m.map(function (j) { return row(j); }).join('') : '<div class="empty">No job matches “' + esc(q) + '”. You can request it below.</div>');
    } else {
      var rec = recentJobs(), recNums = rec.map(function (x) { return x.j.num; });
      rows = (rec.length ? '<div class="sl">Your recent jobs</div>' + rec.map(function (x) { return row(x.j, x.when); }).join('') : '') +
        '<div class="sl">All jobs (A–Z)</div>' + act.filter(function (j) { return recNums.indexOf(j.num) < 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (j) { return row(j); }).join('');
    }
    return rows + '<button class="reqlink" data-act="reqjob">' + I('plus', 18) + 'Job not listed? Request a new job</button>';
  }
  function openJobs() {
    openLayer('<div class="dim" data-act="close"></div><div class="tray sheet" role="dialog" aria-label="Choose a job"><div class="grab"></div><div class="th"><h2>Choose a job</h2><button class="btn btn-tertiary" data-act="close">CANCEL</button></div>' +
      '<div class="search">' + I('search', 20, '#6B6262') + '<input type="search" aria-label="Search jobs" placeholder="Search jobs" data-act="jobq" autocomplete="off"></div><div class="scroll" id="jlist">' + jobTray('') + '</div></div>');
  }
  function openReqJob(prefill) {
    openLayer('<div class="dim" data-act="close"></div><div class="tray sheet" role="dialog" aria-label="New job"><div class="grab"></div><div class="th"><h2>New job</h2><button class="btn btn-tertiary" data-act="jobs">BACK</button></div>' +
      '<div class="fld"><label for="nj">Job name</label><input id="nj" value="' + esc(prefill || '') + '" placeholder="e.g. Cornelius Fire Station 4" autocomplete="off"></div>' +
      '<div class="fld"><label for="na">Address or general contractor (optional)</label><input id="na" placeholder="e.g. 21440 Catawba Ave" autocomplete="off"></div>' +
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
    if (h >= 13) { h24 = h; autoPM = true; } else if (h === 0) { h24 = 0; } else { h24 = ap === 'PM' ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h); }
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
    var inner = '<div class="grab"></div><div class="th"><h2>' + (TT.k === 'start' ? 'When did you start?' : 'When did you finish?') + '</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
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

  /* ---------------- office shell ---------------- */
  var NAV = [['today', 'Today', 'home', '#/office'], ['reports', 'All reports', 'list', '#/office/reports'], ['jobs', 'Jobs', 'briefcase', '#/office/jobs'], ['foremen', 'Foremen', 'user', '#/office/foremen']];
  function office(active, fn) {
    var reqs = S().requests.length;
    var side = '<aside class="side"><img class="logo" src="' + LOGO + '" alt="MKI LLC">' + NAV.map(function (n) { return '<a class="nav' + (n[0] === active ? ' on' : '') + '" href="' + n[3] + '">' + I(n[2], 20) + n[1] + (n[0] === 'jobs' && reqs ? '<span class="badge">' + reqs + '</span>' : '') + '</a>'; }).join('') +
      '<div class="me"><div class="av" style="background:#5A2A2A">AK</div><div><b>Alex Kovalev</b><span>Owner</span></div></div></aside>';
    var tabs = '<nav class="tabs">' + NAV.map(function (n) { return '<a class="' + (n[0] === active ? 'on' : '') + '" href="' + n[3] + '">' + I(n[2], 22) + (n[0] === 'reports' ? 'Reports' : n[1]) + '</a>'; }).join('') + '</nav>';
    $app.innerHTML = previewBar('o') + '<div class="of">' + side + '<main class="main">' + fn() + '</main></div>' + tabs;
  }
  var F = { job: '', who: '', range: '7', flag: '', q: '', chips: {}, more: 9, jobsShow: 'active', jq: '' };
  function dd(name, val, opts) { return '<label class="dd"><select aria-label="' + esc(opts[0][1]) + '" data-fil="' + name + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + I('chevron-down', 16) + '</label>'; }
  function jobOpts(all) { return [['', all]].concat(S().jobs.filter(function (j) { return j.active; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (j) { return [j.num, j.name]; })); }
  function whoOpts(all) { return [['', all]].concat(S().people.map(function (p) { return [p.id, p.name]; })); }
  function thumbs(r) { var n = r.photos, a = ''; for (var i = 0; i < Math.min(n, 3); i++) a += r.photoData && r.photoData[i] ? '<span class="th36" style="background:url(' + r.photoData[i] + ') center/cover"></span>' : '<span class="th36">' + I('image', 14, '#fff') + '</span>'; if (n > 3) a += '<span class="mut" style="font:600 13px var(--in)">+' + (n - 3) + '</span>'; if (!n) a = '<span class="mut">None</span>'; return '<div class="thumbs">' + a + '</div>'; }
  function repRows(list, cols) {
    return list.map(function (r) {
      var p = person(r.person);
      return '<tr class="click" data-go="#/office/report/' + r.id + '"><td class="date-td">' + shortDate(r.date) + '</td><td class="job">' + esc(jobName(r)) + '</td><td>' + esc(p.short) + '</td>' +
        (cols === 'crew' ? '<td class="hide-m">' + r.crew + '</td>' : '') +
        '<td class="flags-td"><div class="flags">' + flagsOf(r).map(function (f) { return pill(f[0], f[1]); }).join('') + '</div></td><td class="thumbs-td">' + thumbs(r) + '</td><td class="go">' + I('chevron-right', 18) + '</td></tr>';
    }).join('');
  }
  function sorted() { return S().reports.slice().sort(function (a, b) { return (b.date + b.sentAt).localeCompare(a.date + a.sentAt); }); }

  /* ---------------- office: today ---------------- */
  function renderToday() {
    var k = todayKey(), s = S(), reps = sorted().filter(function (r) { return (!F.job || r.job === F.job) && (!F.who || r.person === F.who); });
    var today = reps.filter(function (r) { return r.date === k; });
    var dow = dObj(k).getDay(), weekend = dow === 0 || dow === 6;
    var expected = weekend ? [] : s.people.filter(function (p) { return p.reminder && (!F.who || p.id === F.who); });
    var sentIds = {}; today.forEach(function (r) { sentIds[r.person] = r; });
    var missing = expected.filter(function (p) { return !sentIds[p.id]; });
    var mats = today.filter(function (r) { return r.mat.yes; });
    var weekStart = dObj(k); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    var safetyWk = reps.filter(function (r) { return r.safety.yes && dObj(r.date) >= weekStart; });
    var sentExp = expected.filter(function (p) { return sentIds[p.id]; }).length;
    function stat(l, v, sub, kind) { return '<div class="stat ' + (kind || '') + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + (kind ? I(kind === 'ok' ? 'check' : kind === 'err' ? 'alert-circle' : 'alert-triangle', 14) : '') + esc(sub) + '</div></div>'; }
    var people = expected.slice(); today.forEach(function (r) { if (people.indexOf(person(r.person)) < 0) people.push(person(r.person)); });
    var fms = people.map(function (p) {
      var r = sentIds[p.id], jb = r ? jobName(r) : (p.usualJob && job(p.usualJob) ? job(p.usualJob).name : 'No report yet');
      return '<button class="fm' + (r ? '' : ' miss') + '"' + (r ? ' data-go="#/office/report/' + r.id + '"' : '') + '><div class="av' + (r ? '' : ' gray') + '">' + p.ini + '</div><div class="t"><b>' + esc(p.short) + '</b><span>' + esc(jb) + '</span></div>' + (r ? pill('Sent ' + sentText(r).replace(' PM', '').replace(' AM', ''), 'ok') : pill('Not sent', 'err')) + '</button>';
    }).join('');
    return '<div class="toprow"><div><div class="wdl">' + wd(k) + '</div><h1 class="h1">' + md(k) + '</h1></div><div class="filters">' + dd('job', F.job, jobOpts('All jobs')) + dd('who', F.who, whoOpts('All foremen')) + '</div></div>' +
      '<div class="stats">' + stat('REPORTS TODAY', weekend ? String(today.length) : sentExp + ' / ' + expected.length, weekend ? 'No reports expected on weekends' : missing.length ? missing.map(function (p) { return p.short; }).join(', ') + ' hasn’t sent yet' : 'Everyone has sent') +
      stat('MISSING TODAY', missing.length, missing.length ? 'Reminder goes out at 5:30 PM' : 'Nobody missing', missing.length ? 'err' : 'ok') +
      stat('NEEDS MATERIALS', mats.length, mats.length ? mats.map(jobName).join(', ') : 'Nothing requested today', mats.length ? 'warn' : 'ok') +
      stat('SAFETY ISSUES', safetyWk.length, safetyWk.length ? 'This week' : 'None this week', safetyWk.length ? 'err' : 'ok') + '</div>' +
      '<div class="sec-t">Foremen today</div>' + (fms ? '<div class="fms">' + fms + '</div>' : '<div class="blk"><p class="mut">' + (weekend ? 'It’s the weekend, so nobody is expected to send a report today.' : 'Nobody has daily reminders on.') + '</p></div>') +
      '<div class="tbl cards"><div class="hd"><span class="sec-t">Recent reports</span><a class="u" style="font:600 14px var(--in);color:var(--ink)" href="#/office/reports">See all reports</a></div><table><thead><tr><th>DATE</th><th>JOB</th><th>FOREMAN</th><th>FLAGS</th><th>PHOTOS</th><th></th></tr></thead><tbody>' + repRows(reps.slice(0, 5)) + '</tbody></table></div>';
  }

  /* ---------------- office: all reports ---------------- */
  function reportList() {
    return sorted().filter(function (r) {
      if (F.job && r.job !== F.job) return false; if (F.who && r.person !== F.who) return false;
      if (F.range !== 'all') { var days = (dObj(todayKey()) - dObj(r.date)) / 864e5; if (days >= +F.range) return false; }
      var c = F.chips; if (c.mat && !r.mat.yes) return false; if (c.delay && !r.delay.yes) return false; if (c.safety && !r.safety.yes) return false; if (c.photos && !r.photos) return false;
      if (F.q) { var hay = [jobName(r), person(r.person).name, r.work, r.plan, r.mat.text, r.delay.text, r.safety.text].join(' ').toLowerCase(); if (hay.indexOf(F.q.toLowerCase()) < 0) return false; }
      return true;
    });
  }
  /* Divider with a button or text in the middle (from Dan's design system: Divider, Type=Button / Type=Text) */
  function pager(shown, total) {
    var more = total > shown;
    return '<div class="pager"><div class="divider">' + '<span class="ln"></span>' + (more ? '<button class="obtn tertiary" data-act="more">Load more' + I('chevron-down', 18) + '</button>' : '<span class="dv-t">' + (total ? 'That’s all ' + total + ' reports' : 'No reports') + '</span>') + '<span class="ln"></span></div>' +
      (more ? '<div class="pg-n">Showing ' + shown + ' of ' + total + ' reports</div>' : '') + '</div>';
  }
  function resultsHTML() {
    var list = reportList(), shown = list.slice(0, F.more);
    return '<div class="tbl cards"><table><thead><tr><th>DATE</th><th>JOB</th><th>FOREMAN</th><th>CREW</th><th>FLAGS</th><th>PHOTOS</th><th></th></tr></thead><tbody>' + (shown.length ? repRows(shown, 'crew') : '<tr><td colspan="7" class="mut">No reports match these filters.</td></tr>') + '</tbody></table></div>' +
      pager(shown.length, list.length);
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
    var p = person(r.person), x = dur(r.start, r.finish);
    function blk(l, body, st) { return '<div class="blk"><div class="l">' + l + '</div>' + (st ? '<div>' + st + '</div>' : '') + (body ? '<p>' + esc(body) + '</p>' : '') + '</div>'; }
    var pics = r.photoData && r.photoData.length ? r.photoData : null;
    function ph(i, cls) { return pics && pics[i] ? '<div class="' + cls + '" style="background:url(' + pics[i] + ') center/cover"></div>' : '<div class="' + cls + '">' + I('image', cls === 'big' ? 32 : 24, '#fff') + '</div>'; }
    return '<a class="back" href="#/office/reports">' + I('chevron-left', 18) + 'All reports</a>' +
      '<div class="dhead"><div><h1 class="h1">' + esc(jobName(r)) + '</h1><p>' + wd(r.date) + ', ' + md(r.date) + ' · ' + esc(p.short) + ' · Sent ' + sentText(r) + '</p></div><div class="filters"><button class="obtn tertiary" data-act="soon">' + I('folder', 18) + 'Open job folder</button><button class="obtn secondary" data-act="soon">' + I('file-text', 18) + 'Download PDF</button></div></div>' +
      '<div class="dbody"><div class="dl-col"><div class="facts"><div class="fact"><div class="l">CREW ON SITE</div><div class="v">' + r.crew + '</div><div class="s">Foreman included</div></div>' +
      '<div class="fact"><div class="l">WEATHER</div><div class="v">' + esc((r.weather || '—').split(',').slice(-1)[0].trim()) + '</div><div class="s">' + esc((r.weather || '').split(',')[0]) + '</div></div>' +
      '<div class="fact"><div class="l">HOURS</div><div class="v">' + hrsShort(x.mins) + '</div><div class="s">' + fmt12(r.start) + ' to ' + fmt12(r.finish) + (x.over ? ' next day' : '') + '</div></div></div>' +
      blk('Work completed today', r.work) +
      blk('Materials, equipment, or inspections', r.mat.yes ? r.mat.text : '', r.mat.yes ? pill('Needs materials', 'warn') : pill('Nothing needed', 'ok')) +
      blk('Weather, site, or other-trade delays', r.delay.yes ? r.delay.text : '', r.delay.yes ? pill('Delay', 'warn') : pill('No delays', 'ok')) +
      blk('Safety or quality issues', r.safety.yes ? r.safety.text : '', r.safety.yes ? pill('Safety issue', 'err') : pill('No incidents', 'ok')) +
      blk('Plan for next workday', r.plan) + '</div>' +
      '<div class="pbox"><div class="toprow"><span class="blk" style="padding:0"><span class="l">PHOTOS · ' + r.photos + '</span></span>' + (r.photos ? '<button class="obtn link" data-act="soon">Download all</button>' : '') + '</div>' +
      (r.photos ? ph(0, 'big') + (r.photos > 1 ? '<div class="two">' + ph(1, '') + (r.photos > 2 ? ph(2, '') : '<div style="background:none"></div>') + '</div>' : '') + '<div class="ofoot">Tap a photo to open it full size</div>' : '<div class="ofoot">No photos with this report.</div>') + '</div></div>';
  }

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
      var fm = rs[0] ? person(rs[0].person).short : (j.foreman ? person(j.foreman).short : '—');
      return '<tr><td class="job"><span class="num">' + j.num + '</span>' + esc(j.name) + '</td><td>' + esc(fm) + '</td><td class="hide-m">' + (rs[0] ? relDate(rs[0].date) : 'No reports yet') + '</td><td class="hide-m">' + rs.length + '</td><td>' + (j.active ? pill('Active', 'ok') : '<span class="pill neutral">Finished</span>') + '</td>' +
        '<td class="go"><button data-act="jobstate" data-num="' + j.num + '" title="' + (j.active ? 'Mark finished' : 'Reopen') + '" aria-label="' + (j.active ? 'Mark finished' : 'Reopen') + '">' + I('more-horizontal', 18) + '</button></td></tr>';
    }).join('');
    return '<div class="toprow"><h1 class="h1">Jobs</h1><button class="obtn primary" data-act="addjob">' + I('plus', 18, '#fff') + 'Add job</button></div>' +
      (s.requests.length ? '<div class="reqc"><div class="top">' + pill(s.requests.length + (s.requests.length === 1 ? ' new job request' : ' new job requests'), 'warn') + 'Foremen can ask for a job that isn’t on the list. Approve it, or merge it into a job that already exists.</div>' + reqs + '</div>' : '') +
      '<div class="filters"><label class="osearch">' + I('search', 18, '#6B6262') + '<input type="search" aria-label="Search jobs" placeholder="Search jobs" value="' + esc(F.jq) + '" data-fil="jq" autocomplete="off"></label>' + dd('jobsShow', F.jobsShow, [['active', 'Active jobs'], ['finished', 'Finished jobs'], ['all', 'All jobs']]) + '</div>' +
      '<div class="tbl cards"><table><thead><tr><th>JOB</th><th>FOREMAN</th><th>LAST REPORT</th><th>REPORTS</th><th>STATUS</th><th></th></tr></thead><tbody id="jobsbody">' + (rows || '<tr><td colspan="6" class="mut">No jobs here.</td></tr>') + '</tbody></table></div>' +
      '<div class="ofoot">Finished jobs drop off the foreman’s list but keep their reports and photos. Job numbers match the job folders. Tap ··· to mark a job finished or reopen it.</div>';
  }
  function nextNum() { var yy = String(new Date().getFullYear()).slice(2), max = 3000; S().jobs.forEach(function (j) { var p = j.num.split('-'); if (p[0] === yy) max = Math.max(max, +p[1]); }); return yy + '-' + (max + 1); }
  function openAddJob(prefill, reqId) {
    openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="Add a job"><div class="toprow"><h2>ADD A JOB</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
      '<div class="fld"><label for="aj-n">Job name</label><input id="aj-n" value="' + esc(prefill || '') + '" autocomplete="off"></div>' +
      '<div class="fld"><label for="aj-a">Address<span class="opt">Optional</span></label><input id="aj-a" placeholder="Street, city" autocomplete="off"></div>' +
      '<div class="fld"><label for="aj-f">Main foreman<span class="opt">Optional</span></label><label class="dd" style="display:flex"><select id="aj-f" style="width:100%;padding:15px 38px 15px 14px;font-size:16px;border-radius:12px"><option value="">Pick a foreman</option>' + S().people.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' + I('chevron-down', 18) + '</label></div>' +
      '<div class="fld"><label for="aj-j">Job number</label><input id="aj-j" value="' + nextNum() + '" autocomplete="off"></div>' +
      '<div class="note" style="font-size:13px;color:var(--mut)">' + I('bell', 18) + '<span>Shows up on every foreman’s job list right away. A job folder is made in SharePoint the first time a report comes in.</span></div>' +
      '<div class="acts"><button class="obtn tertiary" data-act="close">Cancel</button><button class="obtn primary" data-act="savejob"' + (reqId ? ' data-req="' + reqId + '"' : '') + '>Add job</button></div></div>');
    setTimeout(function () { var i = document.getElementById('aj-n'); if (i) i.focus(); }, 50);
  }
  function openMerge(reqId) {
    var r = S().requests.filter(function (x) { return x.id === reqId; })[0];
    openLayer('<div class="dim" data-act="close"></div><div class="modal" role="dialog" aria-label="Merge"><div class="toprow"><h2>MERGE INTO A JOB</h2><button data-act="close" aria-label="Close">' + I('x', 22) + '</button></div>' +
      '<p style="margin:0;font:15px/1.45 var(--in)">Reports sent under “' + esc(r.name) + '” will move to the job you pick.</p>' +
      '<label class="dd" style="display:flex"><select id="mg" style="width:100%;padding:15px 38px 15px 14px;font-size:16px;border-radius:12px">' + jobOpts('Pick a job').map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' + I('chevron-down', 18) + '</label>' +
      '<div class="acts"><button class="obtn tertiary" data-act="close">Cancel</button><button class="obtn primary" data-act="domerge" data-id="' + reqId + '">Merge</button></div></div>');
  }

  /* ---------------- office: foremen ---------------- */
  function renderForemen() {
    var s = S(), k = todayKey(), mon = dObj(k); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    var days = [0, 1, 2, 3, 4].map(function (i) { var d = new Date(mon); d.setDate(d.getDate() + i); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    var fri = dObj(days[4]);
    var rows = s.people.map(function (p) {
      var cnt = 0, missedToday = false, missed = 0, worked = 0;
      var dots = days.map(function (dk) {
        var sent = s.reports.some(function (r) { return r.person === p.id && r.date === dk; });
        if (dk > k) return '<td class="wkcell"><span class="dot"></span></td>';
        worked++; if (sent) { cnt++; return '<td class="wkcell"><span class="dot ok">' + I('check', 16, '#067647') + '</span></td>'; }
        if (!p.reminder) return '<td class="wkcell"><span class="dot"></span></td>';
        missed++; if (dk === k) missedToday = true; return '<td class="wkcell"><span class="dot err">' + I('x', 14, '#D92D20') + '</span></td>';
      }).join('');
      var st = !p.reminder ? '<span class="mut">Not tracked</span>' : missedToday ? pill('Missed today', 'err') : missed ? pill(missed + ' missed', 'err') : pill(cnt + ' of ' + worked, 'ok');
      var uj = p.usualJob && job(p.usualJob) ? job(p.usualJob).name : (p.role === 'Field Supervisor' ? 'New construction only' : '—');
      return '<tr><td class="job"><div style="display:flex;align-items:center;gap:8px;white-space:nowrap"><span class="av sm">' + p.ini + '</span>' + esc(p.short) + '</div></td><td class="hide-m">' + esc(uj) + '</td>' + dots.replace(/<td class="wkcell">/g, '<td class="wkcell hide-m">') + '<td>' + st + '</td><td><button class="switch' + (p.reminder ? ' on' : '') + '" data-act="rem" data-id="' + p.id + '" role="switch" aria-checked="' + p.reminder + '" aria-label="Daily reminder for ' + esc(p.short) + '"></button></td></tr>';
    }).join('');
    var range = dObj(days[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' to ' + fri.getDate();
    return '<div class="toprow"><h1 class="h1">Foremen</h1><button class="obtn tertiary" data-act="soon">' + I('plus', 18) + 'Add foreman</button></div>' +
      '<div class="filters wk">' + dd('week', 'this', [['this', 'This week · ' + range]]) + '<span class="mut" style="font:14px var(--in)">Who sent a report each workday</span></div>' +
      '<div class="tbl"><div style="overflow-x:auto"><table class="fmt"><colgroup><col class="c-n"><col class="c-j hide-m"><col class="c-d hide-m"><col class="c-d hide-m"><col class="c-d hide-m"><col class="c-d hide-m"><col class="c-d hide-m"><col class="c-w"><col class="c-r"></colgroup><thead><tr><th>FOREMAN</th><th class="hide-m">USUAL JOB</th><th class="hide-m">MON</th><th class="hide-m">TUE</th><th class="hide-m">WED</th><th class="hide-m">THU</th><th class="hide-m">FRI</th><th>THIS WEEK</th><th><span class="hide-m">DAILY REMINDER</span><span class="show-m" title="Daily reminder">' + I('bell', 16) + '</span></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="remc"><div class="sec-t" style="font-size:15px;color:var(--mut)">Reminders</div><div class="r">' + I('bell', 20) + '<span style="flex:1">Anyone at MKI can sign in and send a report. People with Daily reminder on are expected every workday: if they haven’t sent one by 5:30 PM they get a text, and if it’s still missing at 7 PM you get an email.</span><button class="obtn link" data-act="soon">Change times</button></div></div>';
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act],[data-go]'); if (!t) return;
    if (t.dataset.go && !t.dataset.act) { if (ev.target.closest('button') && ev.target.closest('button') !== t) return; go(t.dataset.go); return; }
    var a = t.dataset.act, d;
    switch (a) {
      case 'start': go('#/report'); break;
      case 'signin': S().me = 'medwards'; DB.save(); go('#/'); break;
      case 'signout': S().me = null; DB.save(); go('#/signin'); break;
      case 'done': go('#/'); break;
      case 'close': closeLayer(); break;
      case 'jobs': openJobs(); break;
      case 'pickjob': d = D(); var j = job(t.dataset.num); if (!d.job || d.job.num !== j.num) { d.weather = null; } d.job = { num: j.num, name: j.name }; if (d.errors) delete d.errors.job; saveSoon(); closeLayer(); refresh('q-job'); break;
      case 'reqjob': var q = document.querySelector('[data-act=jobq]'); openReqJob(q ? q.value : ''); break;
      case 'usejob': var nm = document.getElementById('nj').value.trim(); if (!nm) { document.getElementById('nj').focus(); return; } d = D(); d.job = { num: null, name: nm, requested: true, addr: document.getElementById('na').value.trim() }; d.weather = null; if (d.errors) delete d.errors.job; saveSoon(); closeLayer(); refresh('q-job'); break;
      case 'time': openTime(t.dataset.k); break;
      case 'ap': TT.ap = t.dataset.v; var pp = parseT(TT.buf, TT.ap); if (pp.ok && pp.autoPM) { /* 24h entry: convert back to 12h digits */ var m = toMin(pp.hm); TT.buf = String(Math.floor(m / 60) % 12 || 12) + String(m % 60).padStart(2, '0'); } TT.fresh = false; drawTime(); break;
      case 'key':
        var key = t.dataset.k;
        if (TT.fresh && /\d/.test(key)) { TT.buf = ''; } TT.fresh = false;
        if (key === 'clear') TT.buf = ''; else if (key === 'del') TT.buf = TT.buf.slice(0, -1); else if (TT.buf.length < 4) { if (!(TT.buf === '' && key === '0' && false)) TT.buf += key; }
        var p2 = parseT(TT.buf, TT.ap); if (p2.ok && p2.autoPM) TT.ap = p2.ap;
        drawTime(); break;
      case 'tdone': var p3 = parseT(TT.buf, TT.ap); if (!p3.ok) return; d = D(); d[TT.k] = p3.hm; if (d.errors && d.start && d.finish) delete d.errors.hours; saveSoon(); var nextK = TT.k === 'start' && !d.finish ? 'finish' : null; closeLayer(); refresh('q-hours'); if (nextK) openTime(nextK); break;
      case 'same': d = D(); var rec = (S().recent[S().me] || {}).hours; if (!rec) { var last = S().reports.filter(function (r) { return r.person === S().me; })[0]; rec = last ? { start: last.start, finish: last.finish } : { start: '07:00', finish: '15:30' }; } d.start = rec.start; d.finish = rec.finish; if (d.errors) delete d.errors.hours; saveSoon(); refresh('q-hours'); toast('Filled in ' + fmt12(rec.start) + ' to ' + fmt12(rec.finish)); break;
      case 'crew': d = D(); d.crew = Math.max(0, Math.min(99, d.crew + (+t.dataset.d))); var n = document.getElementById('crewn'); n.textContent = d.crew; n.classList.toggle('zero', !d.crew); if (d.errors && d.crew && d.errors.crew) { delete d.errors.crew; refresh('q-crew'); } saveSoon(); break;
      case 'yn': if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); d = D(); d[t.dataset.k].yes = t.dataset.v === '1'; if (!d[t.dataset.k].yes) d[t.dataset.k].text = ''; if (d.errors) delete d.errors[t.dataset.k]; saveSoon(); refresh('q-' + t.dataset.k); break;
      case 'rmphoto': d = D(); d.photos.splice(+t.dataset.i, 1); saveSoon(); refresh('q-photos'); break;
      case 'send': send(); break;
      case 'soon': toast('Works once the app is connected to MKI’s SharePoint.'); break;
      case 'chip': F.chips[t.dataset.k] = !F.chips[t.dataset.k]; F.more = 9; route(); break;
      case 'more': F.more += 9; document.getElementById('results') ? (document.getElementById('results').innerHTML = resultsHTML()) : route(); break;
      case 'sug': F[t.dataset.k] = t.dataset.v; F.q = ''; F.more = 9; route(); break;
      case 'addjob': openAddJob(); break;
      case 'savejob':
        var nm2 = document.getElementById('aj-n'), num = document.getElementById('aj-j').value.trim();
        if (!nm2.value.trim()) { nm2.classList.add('err'); nm2.focus(); return; }
        S().jobs.push({ num: num || nextNum(), name: nm2.value.trim(), active: true, foreman: document.getElementById('aj-f').value || null });
        if (t.dataset.req) { var rq = t.dataset.req; S().reports.forEach(function (r) { var rqo = S().requests.filter(function (x) { return x.id === rq; })[0]; if (rqo && r.jobName === rqo.name) { r.job = num; r.jobName = null; } }); S().requests = S().requests.filter(function (x) { return x.id !== rq; }); }
        DB.save(); closeLayer(); route(); toast('Job added. Foremen see it right away.'); break;
      case 'approve': var rr = S().requests.filter(function (x) { return x.id === t.dataset.id; })[0]; openAddJob(rr.name, rr.id); break;
      case 'merge': openMerge(t.dataset.id); break;
      case 'domerge': var to = document.getElementById('mg').value; if (!to) return; var rq2 = S().requests.filter(function (x) { return x.id === t.dataset.id; })[0]; S().reports.forEach(function (r) { if (r.jobName === rq2.name) { r.job = to; r.jobName = null; } }); S().requests = S().requests.filter(function (x) { return x.id !== rq2.id; }); DB.save(); closeLayer(); route(); toast('Merged into ' + job(to).name + '.'); break;
      case 'jobstate': var jj = job(t.dataset.num); jj.active = !jj.active; DB.save(); route(); toast(jj.name + (jj.active ? ' is active again.' : ' marked finished.')); break;
      case 'rem': var pr = person(t.dataset.id); pr.reminder = !pr.reminder; DB.save(); route(); break;
    }
  });
  document.addEventListener('focusout', function (ev) { if (ev.target.dataset && ev.target.dataset.fil === 'q') setTimeout(function () { var sg = document.getElementById('sugg'); if (sg && !sg.contains(document.activeElement)) sg.classList.remove('open'); }, 150); });
  document.addEventListener('focusin', function (ev) { if (ev.target.dataset && ev.target.dataset.fil === 'q' && ev.target.value.trim()) { var sg = document.getElementById('sugg'); sg.innerHTML = suggestHTML(ev.target.value); sg.classList.add('open'); } });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { var sg = document.getElementById('sugg'); if (sg) sg.classList.remove('open'); } if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.fil === 'q') { ev.target.blur(); } });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.dataset.f) { var d = D(), f = t.dataset.f; if (f.indexOf('.') > -1) { var p = f.split('.'); d[p[0]][p[1]] = t.value; f = p[0]; } else d[f] = t.value; if (d.errors && d.errors[f] && t.value.trim()) { delete d.errors[f]; var c = t.closest('.card'); c.classList.remove('bad'); var em = c.querySelector('.emsg'); if (em) em.remove(); updateBanner(); } saveSoon(); autoGrow(t); }
    if (t.dataset.act === 'jobq') document.getElementById('jlist').innerHTML = jobTray(t.value);
    if (t.dataset.fil === 'q') { F.q = t.value; F.more = 9; document.getElementById('results').innerHTML = resultsHTML(); var sg = document.getElementById('sugg'); sg.innerHTML = suggestHTML(t.value); sg.classList.toggle('open', !!t.value.trim()); }
    if (t.dataset.fil === 'jq') { F.jq = t.value; var tmp = document.createElement('div'); tmp.innerHTML = renderJobs(); var nb = tmp.querySelector('#jobsbody'); document.getElementById('jobsbody').innerHTML = nb.innerHTML; }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset.fil && t.tagName === 'SELECT') { F[t.dataset.fil] = t.value; F.more = 9; route(); }
    if (t.dataset.act === 'photos') addPhotos(t.files);
  });
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, t.classList.contains('sm') ? 99 : 110) + 'px'; }

  /* Photos are shrunk on the phone before saving, so reports stay small. */
  function addPhotos(files) {
    var d = D(), list = Array.prototype.slice.call(files, 0, MAXP - d.photos.length);
    var jobs = list.map(function (f) {
      return new Promise(function (res) {
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function () { var s = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72)); };
        img.onerror = function () { res(null); }; img.src = url;
      });
    });
    Promise.all(jobs).then(function (urls) { urls.forEach(function (u) { if (u) d.photos.push(u); }); saveSoon(); refresh('q-photos'); });
  }

  route();
})();
