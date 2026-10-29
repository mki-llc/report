/* Live mode: Microsoft sign-in and the MKI Field Reports SharePoint site.
   On by default. ?preview shows sample data for one browser session. */
(function () {
  'use strict';
  var DB = window.DB;
  var CFG = {
    clientId: '2610288e-2f21-42af-8911-87432d67443d',
    tenant: '0157c8e2-f71d-470e-8c09-de1b16c24da0',
    host: 'mkiclt24.sharepoint.com',
    sitePath: '/sites/fieldreports',
    jobsFolder: 'Jobs', // inside the site's Documents library, same place the Form flow files photos
    lists: { jobs: 'MKI App Jobs', people: 'MKI App People', reports: 'MKI App Reports' },
    msal: 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.28.1/lib/msal-browser.min.js'
  };
  var G = 'https://graph.microsoft.com/v1.0';
  var BASE = ['User.Read', 'Sites.ReadWrite.All'];
  var MANAGE = ['Sites.Manage.All'];
  var SPS = ['https://' + CFG.host + '/AllSites.FullControl'];
  // Must match a redirect address registered on the "MKI Report" app in Microsoft Entra.
  var REDIRECT = location.hostname === 'report.mkillc.com' ? 'https://report.mkillc.com/app/' : /github\.io$/.test(location.hostname) ? 'https://mki-llc.github.io/report/app/' : location.origin + location.pathname;
  var OFFICE_TITLES = /owner|president|ceo|project manager|operations|office|admin|estimat|account/i;

  // Who counts as field crew. Their names and titles come from Microsoft 365, so adding, renaming or
  // removing someone in the admin center shows up here on the next load.
  var FIELD_TITLES = /foreman|field supervisor|superintendent/i;
  var LIVE = window.LIVE = { on: !!DB.live, ready: false, since: '2026-10-28', directory: false };
  if (!LIVE.on) return;

  var pca, account, me, site, drive, L = {}, jobsRoot = null, jobFolders = null;
  var $app = document.getElementById('app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- screens shown before the app itself ---------- */
  function screen(title, text, btns) {
    $app.innerHTML = '<main class="dark signin"><img class="logo" src="logo-white.svg" alt="MKI LLC"><h1>' + esc(title) + '</h1><p>' + text + '</p><div class="grow"></div>' + (btns || '') + '</main>';
  }
  function btn(act, label, kind) { return '<button class="' + (kind === 'link' ? 'u lbtn' : 'btn btn-white') + '" data-live="' + act + '">' + label + '</button>'; }
  function fail(e) {
    console.error(e);
    var msg = e && e.status === 403 ? 'Your Microsoft account doesn’t have access to the reports yet. Ask the office to check the app setup.' :
      e && e.status === 404 ? 'The MKI Field Reports site couldn’t be found.' :
      'Something went wrong talking to Microsoft. Check your signal and try again.';
    screen('CAN’T OPEN REPORTS', esc(msg) + '<br><br><span style="opacity:.6;font-size:13px">' + esc((e && e.message) || e) + '</span>', btn('retry', 'TRY AGAIN') + btn('signout', 'Sign in as someone else', 'link'));
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-live]'); if (!t) return;
    var a = t.dataset.live;
    if (a === 'retry') location.reload();
    if (a === 'signout') LIVE.signOut();
    if (a === 'setup') { sessionStorage.setItem('mki-setup', '1'); runSetup(); }
  });

  /* ---------- sign-in ---------- */
  function loadMsal() {
    if (window.msal) return Promise.resolve();
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = CFG.msal; s.onload = res; s.onerror = function () { rej(new Error('Couldn’t load Microsoft sign-in')); }; document.head.appendChild(s); });
  }
  var NEVER = new Promise(function () {});
  function token(scopes, extra) {
    return pca.acquireTokenSilent({ scopes: scopes, account: account }).then(function (r) { return r.accessToken; }).catch(function (e) {
      if (e instanceof msal.InteractionRequiredAuthError || /interaction_required|consent_required|login_required|no_tokens_found/.test(e.errorCode || '')) {
        try { sessionStorage.setItem('mki-return', location.hash || ''); } catch (x) {}
        return pca.acquireTokenRedirect({ scopes: scopes, account: account, extraScopesToConsent: extra }).then(function () { return NEVER; });
      }
      throw e;
    });
  }
  LIVE.signIn = function () { return pca.loginRedirect({ scopes: BASE, prompt: 'select_account' }); };
  LIVE.signOut = function () {
    DB.state.me = null; DB.state.draft = null; DB.save();
    var acc = account || (pca && pca.getAllAccounts()[0]);
    if (pca && acc) return pca.logoutRedirect({ account: acc, postLogoutRedirectUri: REDIRECT });
    location.hash = '#/signin'; location.reload();
  };

  /* ---------- web requests ---------- */
  function handle(r) {
    if (r.status === 204 || r.status === 202 && !r.headers.get('content-length')) return null;
    return r.text().then(function (tx) {
      var j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) { j = null; }
      if (!r.ok) {
        var er = j && (j.error || j['odata.error']), m = er && er.message; if (m && m.value) m = m.value;
        var e = new Error(m || r.statusText || ('Error ' + r.status)); e.status = r.status; e.code = er && er.code; throw e;
      }
      return j;
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // Every request has a time limit, so a dead connection ends in a clear message instead of a spinner
  // that never stops. LIVE.cancel() stops whatever is running.
  var inflight = [];
  function timed(url, opts, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var c = new AbortController(), timedOut = false; inflight.push(c);
    var tm = setTimeout(function () { timedOut = true; c.abort(); }, ms || 45000);
    var o = {}; for (var k in opts) o[k] = opts[k]; o.signal = c.signal;
    function done() { clearTimeout(tm); inflight = inflight.filter(function (x) { return x !== c; }); }
    return fetch(url, o).then(function (r) { done(); return r; }, function (e) {
      done();
      var er = new Error(timedOut ? 'Timed out' : (e && e.message) || 'Network error');
      er.timeout = timedOut; er.cancelled = !timedOut && c.cancelledByUser; er.network = true; throw er;
    });
  }
  var stopAsked = false;
  var stopWaiters = [];
  LIVE.cancel = function () {
    stopAsked = true; inflight.slice().forEach(function (c) { c.cancelledByUser = true; c.abort(); });
    var w = stopWaiters; stopWaiters = []; w.forEach(function (rej) { var e = new Error('Stopped'); e.cancelled = true; rej(e); });
  };
  // Between steps of a send: if Stop was pressed, end here.
  function stopCheck(v) { if (stopAsked) { var e = new Error('Stopped'); e.cancelled = true; throw e; } return v; }
  function send(url, opts, tries) {
    tries = tries || 0;
    var big = opts && opts.body && typeof Blob !== 'undefined' && opts.body instanceof Blob;
    return timed(url, opts, big ? 180000 : 45000).then(function (r) {
      if ((r.status === 429 || r.status === 503 || r.status === 504) && tries < 4) return wait((+r.headers.get('Retry-After') || 2) * 1000).then(function () { return send(url, opts, tries + 1); });
      return r;
    });
  }
  function api(method, path, body, scopes, headers) {
    return token(scopes || BASE).then(function (t) {
      var h = { Authorization: 'Bearer ' + t }, isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
      if (body !== undefined && !isBlob) h['Content-Type'] = 'application/json';
      if (headers) for (var k in headers) h[k] = headers[k];
      return send(path.indexOf('https://') === 0 ? path : G + path, { method: method, headers: h, body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body) });
    }).then(handle);
  }
  function getAll(path) {
    var out = [];
    function page(p) { return api('GET', p).then(function (j) { out = out.concat(j.value || []); return j['@odata.nextLink'] ? page(j['@odata.nextLink']) : out; }); }
    return page(path);
  }
  function sp(method, path, body, verbose) {
    return token(SPS).then(function (t) {
      var h = { Authorization: 'Bearer ' + t, Accept: 'application/json;odata=nometadata' };
      if (body) h['Content-Type'] = verbose ? 'application/json;odata=verbose' : 'application/json;odata=nometadata';
      if (method === 'MERGE') { h['X-HTTP-Method'] = 'MERGE'; h['IF-MATCH'] = '*'; method = 'POST'; }
      return send('https://' + CFG.host + CFG.sitePath + '/_api/' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined });
    }).then(handle);
  }
  function listPath(l) { return '/sites/' + site.id + '/lists/' + l.id; }

  /* ---------- start ---------- */
  LIVE.start = function () {
    screen('LOADING', 'One moment…');
    loadMsal().then(function () {
      pca = new msal.PublicClientApplication({
        auth: { clientId: CFG.clientId, authority: 'https://login.microsoftonline.com/' + CFG.tenant, redirectUri: REDIRECT, navigateToLoginRequestUrl: true },
        cache: { cacheLocation: 'localStorage' }
      });
      return pca.initialize().then(function () { return pca.handleRedirectPromise(); });
    }).then(function (res) {
      account = (res && res.account) || pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
      if (!account) { if (/^#\/off/.test(location.hash)) { try { sessionStorage.setItem('mki-return', location.hash); } catch (x) {} } DB.state.me = null; LIVE.ready = true; if (!/signin/.test(location.hash)) location.hash = '#/signin'; return window.APP.route(); }
      pca.setActiveAccount(account);
      return boot();
    }).catch(fail);
  };

  function boot() {
    screen('LOADING', 'Getting your jobs…');
    return api('GET', '/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle').then(function (u) {
      me = u;
      return api('GET', '/sites/' + CFG.host + ':' + CFG.sitePath + '?$select=id,webUrl');
    }).then(function (s) {
      site = s;
      return findLists();
    }).then(function (ok) {
      if (!ok || sessionStorage.getItem('mki-setup')) {
        if (sessionStorage.getItem('mki-setup')) return runSetup();
        return needSetup();
      }
      return load();
    });
  }
  function findLists() {
    return getAll('/sites/' + site.id + '/lists?$select=id,displayName&$top=200').then(function (ls) {
      var by = {}; ls.forEach(function (l) { by[l.displayName] = l; });
      L.jobs = by[CFG.lists.jobs]; L.people = by[CFG.lists.people]; L.reports = by[CFG.lists.reports];
      return !!(L.jobs && L.people && L.reports);
    });
  }
  // Columns added after the lists were first made. The office adds them quietly the first time it opens
  // the app; if that isn't possible the app keeps working without them.
  var cols = {};
  var LATER = { jobs: ['GC', 'GCEmail', 'GCProject'], reports: ['OfficeReview'] };
  function ensureColumns() {
    return Promise.all(['jobs', 'reports'].map(function (k) {
      return getAll(listPath(L[k]) + '/columns?$select=name').then(function (have) {
        var names = have.map(function (c) { return c.name; });
        return Promise.all(LATER[k].map(function (n) {
          if (names.indexOf(n) > -1) { cols[n] = true; return null; }
          var def = n === 'OfficeReview' ? { name: n, text: { allowMultipleLines: true, linesForEditing: 6 } } : { name: n, text: {} };
          return api('POST', listPath(L[k]) + '/columns', def, MANAGE).then(function () { cols[n] = true; }, function (e) { console.warn('column ' + n, e); });
        }));
      });
    })).catch(function (e) { console.warn('columns', e); });
  }
  function needSetup() {
    screen('ONE-TIME SETUP', 'The report app needs to set up its lists on the MKI Field Reports site. This is done once, by Alex or another Microsoft admin.<br><br>Microsoft will ask you to approve access. Foremen won’t see that screen.', btn('setup', 'SET UP THE APP') + btn('signout', 'Sign in as someone else', 'link'));
  }

  /* ---------- reading ---------- */
  function shortName(n) { var p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : p[0] || ''; }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function mkPerson(email, name, extra) {
    var p = { id: email, email: email, name: name || email, short: shortName(name || email), first: String(name || email).split(/\s+/)[0], ini: initials(name || email), role: '', usualJob: null, reminder: false };
    for (var k in extra || {}) p[k] = extra[k];
    return p;
  }
  function lines(t) { return String(t || '').split(/\n+/).map(function (s) { return s.replace(/^\s*\d+\.\s*/, '').trim(); }).filter(Boolean); }
  function parseReview(t) { if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } }
  function toRep(it) {
    var f = it.fields || {}, data = {}; try { data = JSON.parse(f.AppData || '{}'); } catch (e) { data = {}; }
    var cb = it.createdBy && it.createdBy.user || {};
    var email = String(f.PersonEmail || cb.email || '').toLowerCase();
    return {
      id: f.Title || ('i' + it.id), itemId: it.id, date: f.ReportDate, sentDate: f.SentDate || f.ReportDate, sentAt: f.SentAt || '00:00',
      person: email, personName: f.PersonName || cb.displayName || email,
      job: f.JobNumber || ('new:' + (f.JobName || '')), jobName: f.JobNumber ? null : (f.JobName || ''),
      weather: f.Weather || '', work: data.work || lines(f.Work), plan: data.plan || lines(f.Plan),
      mat: { yes: !!f.NeedsMaterials, text: f.Materials || '' }, delay: { yes: !!f.HadDelay, text: f.Delays || '' }, safety: { yes: !!f.SafetyIssue, text: f.Safety || '' },
      photos: +f.Photos || 0, videos: +f.Videos || 0, mediaFolder: f.MediaFolderId || null, mediaUrl: f.MediaFolderUrl || null, note: data.requestNote || '', taken: data.taken || [], recordPdf: data.recordPdf || '', review: parseReview(f.OfficeReview), photoData: null, off: !!data.off
    };
  }
  function load() {
    screen('LOADING', 'Getting your jobs…');
    var sel = '/items?$expand=fields&$top=500';
    return Promise.all([getAll(listPath(L.jobs) + sel), getAll(listPath(L.people) + sel), getAll(listPath(L.reports) + sel)]).then(function (r) {
      var s = DB.state, myEmail = String(me.mail || me.userPrincipalName || '').toLowerCase();
      s.jobs = r[0].map(function (it) { var f = it.fields; return { itemId: it.id, num: f.Title, name: f.JobName || f.Title, active: f.Active !== false, foreman: f.Foreman || null, address: f.Address || '', gc: f.GC || '', gcEmail: f.GCEmail || '', gcProject: f.GCProject || '' }; }).filter(function (j) { return j.num; });
      s.people = r[1].map(function (it) { var f = it.fields; return mkPerson(String(f.Title || '').toLowerCase(), f.FullName, { itemId: it.id, role: f.Role || '', usualJob: f.UsualJob || null, reminder: !!f.Reminder }); }).filter(function (p) { return p.id; });
      var all = r[2].map(toRep).filter(function (x) { return x.date; });
      s.reports = all.filter(function (x) { return !x.off; }); s.offs = all.filter(function (x) { return x.off; });
      // anyone who sent a report but isn't on the people list still shows up by name
      s.reports.forEach(function (rep) { if (!s.people.some(function (p) { return p.id === rep.person; })) s.people.push(mkPerson(rep.person, rep.personName, { extra: true })); });
      var mine = s.people.filter(function (p) { return p.id === myEmail; })[0];
      if (!mine) { mine = mkPerson(myEmail, me.displayName, { role: me.jobTitle || '', extra: true }); s.people.push(mine); }
      s.people.sort(function (a, b) { return (b.reminder - a.reminder) || a.name.localeCompare(b.name); });
      s.me = myEmail;
      s.role = OFFICE_TITLES.test(me.jobTitle || '') || OFFICE_TITLES.test(mine.role || '') ? 'office' : 'foreman';
      s.people.forEach(function (p) { p.crew = !p.extra && FIELD_TITLES.test(p.role || ''); });
      return (s.role === 'office' ? Promise.all([syncDirectory(), ensureColumns()]) : Promise.resolve()).then(function () { finishLoad(s); });
    });
  }
  // Office only: read MKI's Microsoft 365 users and use them as the crew list. Needs the
  // User.Read.All permission approved once for the organization. Without it the app keeps
  // using its own SharePoint list, so nothing breaks.
  function dirToken() {
    return pca.acquireTokenSilent({ scopes: ['User.Read.All'], account: account }).then(function (r) { return r.accessToken; });
  }
  // Plain foremen get the daily reminder. Someone who also has an office title (like "Owner / Foreman")
  // shows on the Foremen page but starts with the reminder off; the office can switch it on.
  function dailyByDefault(t) { return /foreman/i.test(t || '') && !OFFICE_TITLES.test(t || ''); }
  function syncDirectory() {
    return dirToken().then(function (t) {
      var out = [];
      function page(u) {
        return send(u, { headers: { Authorization: 'Bearer ' + t } }).then(handle).then(function (j) { out = out.concat(j.value || []); return j['@odata.nextLink'] ? page(j['@odata.nextLink']) : out; });
      }
      return page(G + '/users?$select=displayName,mail,userPrincipalName,jobTitle,accountEnabled&$top=999');
    }).then(function (users) {
      var s = DB.state, field = {};
      users.forEach(function (u) {
        var email = String(u.mail || u.userPrincipalName || '').toLowerCase();
        if (email && u.accountEnabled !== false && FIELD_TITLES.test(u.jobTitle || '')) field[email] = u;
      });
      s.people.forEach(function (p) {
        p.crew = !!field[p.id];
        // Blocked, removed, or no longer a field title: stop the 7 PM reminder email too.
        if (!p.crew && p.reminder && p.itemId) { p.reminder = false; LIVE.savePerson(p).catch(function (e) { console.warn('save person', e); }); }
      });
      Object.keys(field).forEach(function (email) {
        var u = field[email], p = s.people.filter(function (x) { return x.id === email; })[0];
        if (!p) {
          p = mkPerson(email, u.displayName, { role: u.jobTitle, reminder: dailyByDefault(u.jobTitle), crew: true });
          s.people.push(p);
          LIVE.savePerson(p).catch(function (e) { console.warn('save person', e); });
        } else {
          var nm = u.displayName || p.name;
          if (nm !== p.name || u.jobTitle !== p.role) {
            if (!p.itemId) p.reminder = dailyByDefault(u.jobTitle);
            p.name = nm; p.short = shortName(nm); p.first = nm.split(/\s+/)[0]; p.ini = initials(nm); p.role = u.jobTitle; p.extra = false;
            LIVE.savePerson(p).catch(function (e) { console.warn('save person', e); });
          }
        }
      });
      LIVE.directory = true;
    }).catch(function (e) { console.warn('Microsoft 365 user list not available yet, using the app list', e); LIVE.directory = false; });
  }
  function finishLoad(s) {
      s.people.sort(function (a, b) { return (b.reminder - a.reminder) || a.name.localeCompare(b.name); });
      LIVE.requests();
      DB.save();
      LIVE.ready = true;
      var h = location.hash.replace(/^#\/?/, '');
      // After Microsoft sends you back, the address can hold sign-in leftovers, so anything that isn't a screen goes home.
      var known = /^(office|report|sent|off)/.test(h);
      // Coming back from a Microsoft sign-in that interrupted something: go back to that screen.
      var back = null; try { back = sessionStorage.getItem('mki-return'); sessionStorage.removeItem('mki-return'); } catch (x) {}
      if (back && /^#\/(office|report|off)/.test(back)) { h = back.replace(/^#\/?/, ''); known = true; location.hash = back; if (/^#\/report/.test(back)) setTimeout(function () { window.APP.toast('You’re signed in again. Tap Send to finish your report.'); }, 600); }
      if (s.role === 'office' && !known) location.hash = '#/office';
      else if (!known || (s.role !== 'office' && /^office/.test(h))) location.hash = '#/';
      window.APP.route();
      if (s.role === 'office') startAutoRefresh();
  }
  // Office screens check SharePoint for new reports about once a minute while the page is open,
  // and right away when you come back to the tab, so nobody has to hit refresh.
  var refreshing = false, timer = null;
  function startAutoRefresh() {
    if (timer) return;
    timer = setInterval(function () { if (!document.hidden) refresh(); }, 45000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    window.addEventListener('focus', function () { refresh(); });
  }
  // New or removed employees in Microsoft 365 show up on the Foremen page within about 5 minutes,
  // without anyone reloading the app.
  var dirAt = Date.now();
  function quietRedraw() {
    var a = document.activeElement, typing = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
    if (/^#\/office/.test(location.hash) && !typing && !document.getElementById('layer').firstChild) { var y = window.scrollY; window.APP.route(); window.scrollTo(0, y); }
  }
  function refresh() {
    if (refreshing || !LIVE.ready) return;
    if (Date.now() - dirAt > 300000) { dirAt = Date.now(); syncDirectory().then(function () { DB.save(); quietRedraw(); }); }
    refreshing = true;
    var sel = '/items?$expand=fields&$top=500';
    Promise.all([getAll(listPath(L.reports) + sel), getAll(listPath(L.jobs) + sel)]).then(function (r) {
      var s = DB.state, old = {}, every = r[0].map(toRep).filter(function (x) { return x.date; }), fresh = every.filter(function (x) { return !x.off; }), offs = every.filter(function (x) { return x.off; });
      var offsChanged = offs.length !== (s.offs || []).length; s.offs = offs;
      s.reports.forEach(function (x) { old[x.id] = x; });
      var added = fresh.filter(function (x) { return !old[x.id]; });
      var changed = added.length || fresh.length !== s.reports.length || fresh.some(function (x) { var o = old[x.id]; return o && (o.job !== x.job || o.mediaFolder !== x.mediaFolder || o.photos !== x.photos || (!o._dirty && JSON.stringify(o.review) !== JSON.stringify(x.review))); });
      var jobs = r[1].map(function (it) { var f = it.fields; return { itemId: it.id, num: f.Title, name: f.JobName || f.Title, active: f.Active !== false, foreman: f.Foreman || null, address: f.Address || '', gc: f.GC || '', gcEmail: f.GCEmail || '', gcProject: f.GCProject || '' }; }).filter(function (j) { return j.num; });
      var jobsChanged = JSON.stringify(jobs) !== JSON.stringify(s.jobs);
      if (!changed && !jobsChanged && !offsChanged) return;
      fresh.forEach(function (x) {
        var o = old[x.id]; if (!o) return;
        if (o.photoData && o.mediaFolder === x.mediaFolder) { x.photoData = o.photoData; x.pdfs = o.pdfs; }
        if (o._dirty) { x.review = o.review; x._dirty = true; } // office edits still saving: keep them
      });
      s.reports = fresh; s.jobs = jobs;
      fresh.forEach(function (rep) { if (!s.people.some(function (p) { return p.id === rep.person; })) s.people.push(mkPerson(rep.person, rep.personName, { extra: true })); });
      LIVE.requests();
      // Redraw only when it won't interrupt: no tray or photo open, and nobody typing.
      var a = document.activeElement, typing = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
      var layerOpen = !!document.getElementById('layer').firstChild;
      if (/^#\/office/.test(location.hash) && !typing && !layerOpen) { var y = window.scrollY; window.APP.route(); window.scrollTo(0, y); }
      if (added.length) window.APP.toast(added.length === 1 ? 'New report from ' + (added[0].personName || 'a foreman') + '.' : added.length + ' new reports.');
    }).catch(function (e) { console.warn('refresh', e); }).then(function () { refreshing = false; });
  }
  LIVE.refresh = refresh;
  // Jobs a foreman typed in that aren't on the list yet. They wait on the Jobs page for the office.
  LIVE.requests = function () {
    var s = DB.state, seen = {};
    s.requests = [];
    s.reports.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (r) {
      if (r.job.indexOf('new:') !== 0 || seen[r.jobName]) return; seen[r.jobName] = 1;
      s.requests.push({ id: 'q:' + r.jobName, name: r.jobName, by: r.person, date: r.date, note: r.note || '' });
    });
  };

  /* ---------- photos and videos ---------- */
  function clean(s) { return String(s || '').replace(/["*:<>?\/\\|#%~&{}]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 90) || 'Untitled'; }
  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function getDrive() {
    if (drive) return Promise.resolve(drive);
    return api('GET', '/sites/' + site.id + '/drive?$select=id').then(function (d) { drive = d; return d; });
  }
  // Use the job's existing folder (the ones Lana and the Form already use) when there is one.
  function jobFolderName(rep) {
    var num = rep.job.indexOf('new:') === 0 ? '' : rep.job, name = rep.jobName || (DB.state.jobs.filter(function (j) { return j.num === rep.job; })[0] || {}).name || '';
    var fallback = clean((num ? num + ' ' : 'New ') + name);
    if (!num) return Promise.resolve(fallback);
    var p = jobFolders ? Promise.resolve(jobFolders) : getAll('/drives/' + drive.id + '/root:/' + encPath(CFG.jobsFolder) + ':/children?$select=name,folder&$top=500').then(function (k) { jobFolders = k.filter(function (x) { return x.folder; }).map(function (x) { return x.name; }); return jobFolders; }).catch(function () { jobFolders = []; return jobFolders; });
    return p.then(function (names) { return names.filter(function (n) { return n.indexOf(num) === 0; })[0] || fallback; });
  }
  var CHUNK = 327680 * 10;
  function uploadOne(path, blob, onBytes) {
    var url = '/drives/' + drive.id + '/root:/' + encPath(path);
    if (blob.size < 4e6) return api('PUT', url + ':/content?@microsoft.graph.conflictBehavior=replace', blob, null, { 'Content-Type': blob.type || 'application/octet-stream' }).then(function (it) { onBytes(blob.size); return it; });
    return api('POST', url + ':/createUploadSession', { item: { '@microsoft.graph.conflictBehavior': 'replace' } }).then(function (s) {
      var at = 0;
      function next(tries) {
        var end = Math.min(at + CHUNK, blob.size);
        return timed(s.uploadUrl, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + at + '-' + (end - 1) + '/' + blob.size }, body: blob.slice(at, end) }, 180000).then(function (r) {
          if (!r.ok && r.status !== 202) { if ((tries || 0) < 3) return wait(1500).then(function () { return next((tries || 0) + 1); }); return handle(r); }
          onBytes(end - at); at = end;
          return at < blob.size ? next(0) : r.json();
        }, function (e) { if (!e.cancelled && (tries || 0) < 3) return wait(1500).then(function () { return next((tries || 0) + 1); }); throw e; });
      }
      return next(0);
    });
  }
  function extOf(m, blob) {
    var n = (m.name || '').match(/\.[A-Za-z0-9]{2,5}$/); if (n) return n[0].toLowerCase();
    var t = blob.type || ''; return /png/.test(t) ? '.png' : /quicktime/.test(t) ? '.mov' : /mp4/.test(t) ? '.mp4' : /video/.test(t) ? '.mp4' : '.jpg';
  }
  // The folder name is fixed when the foreman first taps Send (date, name, time), so trying again after a
  // dropped connection fills the same folder instead of making a new one. Files already uploaded are skipped.
  function reportFolder(rep) {
    return getDrive().then(function () { return jobFolderName(rep); }).then(function (jf) {
      return CFG.jobsFolder + '/' + jf + '/' + clean(rep.date + ' ' + rep.personName + ' ' + rep.sentAt.replace(':', ''));
    });
  }
  function folderInfo(path) {
    return api('GET', '/drives/' + drive.id + '/root:/' + encPath(path) + '?$select=id,webUrl').then(function (f) { return { id: f.id, url: f.webUrl, path: path }; });
  }
  function uploadMedia(rep, media, progress, already, onUploaded) {
    if (!media.length) return Promise.resolve(null);
    already = already || [];
    return reportFolder(rep).then(function (folder) {
      return Promise.all(media.map(function (m) { return LIVE.blobs.get(m.key); })).then(function (blobs) {
        var total = 0, done = 0, n = 0, todo = 0;
        blobs.forEach(function (b, i) { if (b && already.indexOf(i) < 0) { total += b.size; todo++; } });
        var chain = Promise.resolve();
        blobs.forEach(function (b, i) {
          if (!b || already.indexOf(i) > -1) return;
          chain = chain.then(function () {
            stopCheck(); n++; progress(n, todo, total ? done / total : 0);
            return uploadOne(folder + '/' + String(i + 1).padStart(2, '0') + extOf(media[i], b), b, function (bytes) { done += bytes; progress(n, todo, total ? done / total : 1); }).then(function () { if (onUploaded) onUploaded(i); });
          });
        });
        return chain.then(function () { return folderInfo(folder); });
      });
    });
  }
  LIVE.loadMedia = function (rep) {
    if (!rep.mediaFolder) return Promise.resolve([]);
    return getDrive().then(function () {
      return getAll('/drives/' + drive.id + '/items/' + rep.mediaFolder + '/children?$expand=thumbnails&$top=200');
    }).then(function (kids) {
      rep.pdfs = kids.filter(function (k) { return k.file && /\.pdf$/i.test(k.name); }).map(function (k) { return { name: k.name, url: k.webUrl }; });
      kids = kids.filter(function (k) { return k.file && /^(image|video)\//.test(k.file.mimeType || '') || k.image || k.video; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      rep.photoData = kids.map(function (k) {
        var th = k.thumbnails && k.thumbnails[0], thumb = th && ((th.large || th.medium || th.small) || {}).url || null;
        var vid = !!k.video || /^video\//.test((k.file || {}).mimeType || '');
        var o = { thumb: thumb, src: k['@microsoft.graph.downloadUrl'], id: k.id, name: k.name };
        if (vid) { o.v = 1; o.dur = k.video && k.video.duration ? k.video.duration / 1000 : 0; o.thumb = thumb; }
        return o;
      });
      rep.photos = rep.photoData.length || rep.photos;
      return rep.photoData;
    });
  };

  /* ---------- writing ---------- */
  function repFields(rep, folder) {
    var num = rep.job.indexOf('new:') === 0 ? '' : rep.job;
    var name = rep.jobName || (DB.state.jobs.filter(function (j) { return j.num === rep.job; })[0] || {}).name || '';
    function numbered(a) { return a.map(function (t, i) { return (a.length > 1 ? (i + 1) + '. ' : '') + t; }).join('\n'); }
    return {
      Title: rep.id, ReportDate: rep.date, SentDate: rep.sentDate, SentAt: rep.sentAt, PersonEmail: rep.person, PersonName: rep.personName,
      JobNumber: num, JobName: name, Weather: rep.weather || '', Work: numbered(rep.work), Plan: numbered(rep.plan),
      NeedsMaterials: !!rep.mat.yes, Materials: rep.mat.text || '', HadDelay: !!rep.delay.yes, Delays: rep.delay.text || '', SafetyIssue: !!rep.safety.yes, Safety: rep.safety.text || '',
      Photos: rep.photos, Videos: rep.videos, MediaFolderId: folder ? folder.id : '', MediaFolderUrl: folder ? folder.url : '',
      AppData: JSON.stringify({ v: 1, work: rep.work, plan: rep.plan, requestNote: rep.note || '', taken: rep.taken || [], recordPdf: rep.recordPdf || '' })
    };
  }
  // Photos go up first, then the report row, so a dropped signal never leaves a report without its photos.
  function findReport(id) {
    return api('GET', listPath(L.reports) + "/items?$expand=fields&$filter=fields/Title eq '" + String(id).replace(/'/g, "''") + "'", undefined, null, { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' })
      .then(function (j) { return (j && j.value && j.value[0]) || null; });
  }
  // opts: { uploaded: [indexes already in SharePoint], onUploaded(i), tried: true if an earlier attempt may have saved the row }
  LIVE.sendReport = function (rep, media, progress, opts) {
    opts = opts || {};
    rep.personName = me.displayName; stopAsked = false;
    // Sign-in is checked before anything is uploaded, so an expired sign-in can't leave half a folder behind.
    return token(BASE).then(stopCheck).then(function () {
      return uploadMedia(rep, media, progress, opts.uploaded, opts.onUploaded);
    }).then(function (folder) {
      progress(-1);
      // The foreman's "as sent" PDF goes in the same folder as the photos, so the job folder has the full record.
      if (!opts.makeRecord) return folder;
      stopCheck();
      return reportFolder(rep).then(function (path) {
        // The PDF step has its own time limit and listens to Stop. If it can't finish, the report still goes
        // and the office can make the PDF later from SharePoint.
        var limit = new Promise(function (res) { setTimeout(function () { res(null); }, 45000); });
        var stop = new Promise(function (res, rej) { stopWaiters.push(rej); });
        return Promise.race([opts.makeRecord().catch(function (e) { console.warn('record pdf not made', e); return null; }), limit, stop]).then(function (pdf) {
          stopCheck();
          if (!pdf) return folder || folderInfo(path).catch(function () { return null; });
          return uploadOne(path + '/' + pdf.name, pdf.blob, function () {}).then(function () { rep.recordPdf = pdf.name; return folder || folderInfo(path); });
        });
      });
    }).then(stopCheck).then(function (folder) {
      if (folder) { rep.mediaFolder = folder.id; rep.mediaUrl = folder.url; rep.mediaPath = folder.path; }
      return (opts.tried ? findReport(rep.id).catch(function () { return null; }) : Promise.resolve(null)).then(function (found) {
        if (found) return found;
        return api('POST', listPath(L.reports) + '/items', { fields: repFields(rep, folder) });
      }).then(function (it) { rep.itemId = it.id; return rep; });
    });
  };
  // "I'm off today" from the reminder email: a row in the Reports list marked off, so the 7 PM email skips that day.
  LIVE.markOff = function (o) {
    return api('POST', listPath(L.reports) + '/items', { fields: { Title: o.id, ReportDate: o.date, SentDate: o.sentDate, SentAt: o.sentAt, PersonEmail: o.person, PersonName: o.personName, JobNumber: '', JobName: '', AppData: JSON.stringify({ v: 1, off: true }) } }).then(function (it) { o.itemId = it.id; return o; });
  };
  LIVE.hasReviewColumn = function () { return !!cols.OfficeReview; };
  LIVE.markRecord = function (r, name) {
    r.recordPdf = name;
    return api('PATCH', listPath(L.reports) + '/items/' + r.itemId + '/fields', { AppData: JSON.stringify({ v: 1, work: r.work, plan: r.plan, requestNote: r.note || '', taken: r.taken || [], recordPdf: name }) });
  };
  LIVE.saveReview = function (r) {
    if (!cols.OfficeReview) return Promise.reject(Object.assign(new Error('Review column missing'), { status: 0 }));
    return api('PATCH', listPath(L.reports) + '/items/' + r.itemId + '/fields', { OfficeReview: JSON.stringify(r.review) });
  };
  // Saves a PDF next to the report's photos (or in a new report folder if there are none).
  LIVE.savePdf = function (r, name, blob) {
    var p = r.mediaFolder ? api('GET', '/drives/' + (drive && drive.id) + '/items/' + r.mediaFolder + '?$select=id,webUrl,name,parentReference').catch(function () { return null; }) : Promise.resolve(null);
    return getDrive().then(function () { return p; }).then(function (f) {
      if (f && f.parentReference && f.parentReference.path) return f.parentReference.path.replace(/^\/drive\/root:\/?/, '') + '/' + f.name;
      return reportFolder({ job: r.job, jobName: r.jobName, date: r.date, personName: r.personName, sentAt: r.sentAt });
    }).then(function (path) {
      return uploadOne(decodeURIComponent(path) + '/' + name, blob, function () {}).then(function (it) {
        if (!r.mediaFolder) return folderInfo(decodeURIComponent(path)).then(function (fi) { r.mediaFolder = fi.id; r.mediaUrl = fi.url; return api('PATCH', listPath(L.reports) + '/items/' + r.itemId + '/fields', { MediaFolderId: fi.id, MediaFolderUrl: fi.url }); }).then(function () { return it; });
        return it;
      });
    });
  };
  // Makes an Outlook draft with the PDF attached, for the office to check and send. Returns the draft's web link.
  LIVE.emailDraft = function (to, subject, html, name, blob) {
    var MAIL = ['Mail.ReadWrite'];
    return api('POST', '/me/messages', { subject: subject, body: { contentType: 'HTML', content: html }, toRecipients: to.map(function (a) { return { emailAddress: { address: a } }; }) }, MAIL).then(function (msg) {
      if (blob.size < 3e6) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.readAsDataURL(blob); }).then(function (b64) {
          return api('POST', '/me/messages/' + msg.id + '/attachments', { '@odata.type': '#microsoft.graph.fileAttachment', name: name, contentType: 'application/pdf', contentBytes: b64 }, MAIL);
        }).then(function () { return msg; });
      }
      return api('POST', '/me/messages/' + msg.id + '/attachments/createUploadSession', { AttachmentItem: { attachmentType: 'file', name: name, size: blob.size, contentType: 'application/pdf' } }, MAIL).then(function (ses) {
        var at = 0, step = 3 * 1024 * 1024;
        function next() {
          var end = Math.min(at + step, blob.size);
          return timed(ses.uploadUrl, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + at + '-' + (end - 1) + '/' + blob.size, 'Content-Type': 'application/octet-stream' }, body: blob.slice(at, end) }, 120000).then(function (r) { if (!r.ok && r.status !== 200 && r.status !== 201) return handle(r); at = end; return at < blob.size ? next() : null; });
        }
        return next();
      }).then(function () { return msg; });
    }).then(function (msg) { return msg.webLink; });
  };
  // A report photo as a blob for the PDF (office side).
  LIVE.photoBlob = function (item) {
    if (!item || !item.id) return Promise.resolve(item && (item.src || item.thumb) || null);
    return getDrive().then(function () { return api('GET', '/drives/' + drive.id + '/items/' + item.id + '?$select=id,@microsoft.graph.downloadUrl'); }).then(function (f) {
      return timed(f['@microsoft.graph.downloadUrl'], {}, 60000).then(function (r) { if (!r.ok) throw new Error('photo ' + r.status); return r.blob(); });
    });
  };
  LIVE.patchReports = function (list) {
    return Promise.all(list.map(function (r) {
      var num = r.job.indexOf('new:') === 0 ? '' : r.job;
      return api('PATCH', listPath(L.reports) + '/items/' + r.itemId + '/fields', { JobNumber: num, JobName: r.jobName || (DB.state.jobs.filter(function (j) { return j.num === r.job; })[0] || {}).name || '' });
    }));
  };
  function jobFields(j, withNum) {
    var f = { JobName: j.name, Active: j.active, Foreman: j.foreman || '', Address: j.address || '' };
    if (cols.GC) { f.GC = j.gc || ''; f.GCEmail = j.gcEmail || ''; f.GCProject = j.gcProject || ''; }
    if (withNum) f.Title = j.num;
    return f;
  }
  LIVE.addJob = function (j) {
    return api('POST', listPath(L.jobs) + '/items', { fields: jobFields(j, true) }).then(function (it) { j.itemId = it.id; jobFolders = null; return j; });
  };
  LIVE.updateJob = function (j) {
    return api('PATCH', listPath(L.jobs) + '/items/' + j.itemId + '/fields', jobFields(j));
  };
  LIVE.savePerson = function (p) {
    var f = { Title: p.email || p.id, FullName: p.name, Role: p.role || '', Reminder: !!p.reminder, UsualJob: p.usualJob || '' };
    if (p.itemId) return api('PATCH', listPath(L.people) + '/items/' + p.itemId + '/fields', f);
    return api('POST', listPath(L.people) + '/items', { fields: f }).then(function (it) { p.itemId = it.id; p.extra = false; });
  };

  /* ---------- one-time setup ---------- */
  var T = function (name) { return { name: name, text: {} }; }, NOTE = function (name) { return { name: name, text: { allowMultipleLines: true, linesForEditing: 6 } }; };
  var B = function (name) { return { name: name, boolean: {} }; }, N = function (name) { return { name: name, number: {} }; };
  var SCHEMA = {
    jobs: [T('JobName'), B('Active'), T('Foreman'), T('Address')],
    people: [T('FullName'), T('Role'), B('Reminder'), T('UsualJob')],
    reports: [T('ReportDate'), T('SentDate'), T('SentAt'), T('PersonEmail'), T('PersonName'), T('JobNumber'), T('JobName'), T('Weather'), NOTE('Work'), NOTE('Plan'),
      B('NeedsMaterials'), NOTE('Materials'), B('HadDelay'), NOTE('Delays'), B('SafetyIssue'), NOTE('Safety'), N('Photos'), N('Videos'), T('MediaFolderId'), T('MediaFolderUrl'), NOTE('AppData')]
  };
  function step(text) { screen('SETTING UP', esc(text) + '<br><br><span style="opacity:.6;font-size:13px">Keep this page open. It takes about a minute.</span>'); }
  function runSetup() {
    step('Checking access…');
    // One approval screen covers both: making lists (Graph) and sharing them with everyone at MKI (SharePoint).
    return token(MANAGE, SPS).then(function () { return token(SPS); }).then(function () {
      step('Making the lists…');
      return findLists();
    }).then(function () {
      var chain = Promise.resolve();
      ['jobs', 'people', 'reports'].forEach(function (k) {
        chain = chain.then(function () {
          if (L[k]) return;
          return api('POST', '/sites/' + site.id + '/lists', { displayName: CFG.lists[k], columns: SCHEMA[k], list: { template: 'genericList' } }, MANAGE).then(function (l) { L[k] = l; });
        });
      });
      return chain;
    }).then(function () {
      step('Adding jobs and people…');
      return Promise.all([getAll(listPath(L.jobs) + '/items?$top=5'), getAll(listPath(L.people) + '/items?$top=5')]);
    }).then(function (r) {
      var chain = Promise.resolve(), seed = DB.seed;
      if (!r[0].length) seed.jobs.forEach(function (j) { chain = chain.then(function () { return api('POST', listPath(L.jobs) + '/items', { fields: { Title: j.num, JobName: j.name, Active: j.active, Foreman: '' } }); }); });
      if (!r[1].length) {
        var ppl = seed.people.map(function (p) { return { Title: p.email.toLowerCase(), FullName: p.name, Role: p.role, Reminder: p.reminder, UsualJob: p.usualJob || '' }; });
        var mine = String(me.mail || me.userPrincipalName).toLowerCase();
        if (!ppl.some(function (p) { return p.Title === mine; })) ppl.push({ Title: mine, FullName: me.displayName, Role: me.jobTitle || 'Owner', Reminder: false, UsualJob: '' });
        ppl.forEach(function (f) { chain = chain.then(function () { return api('POST', listPath(L.people) + '/items', { fields: f }); }); });
      }
      return chain;
    }).then(function () {
      step('Letting everyone at MKI send reports…');
      return sharePerms();
    }).then(function () {
      sessionStorage.removeItem('mki-setup');
      return load();
    }).catch(function (e) { sessionStorage.removeItem('mki-setup'); throw e; });
  }
  // Everyone at MKI (not guests): read Jobs and People, add to Reports but only see their own,
  // and add photos inside Documents > Jobs. Owners keep full access to everything.
  function sharePerms() {
    var everyone = 'c:0-.f|rolemanager|spo-grid-all-users/' + CFG.tenant, pid, reader, contrib;
    return Promise.all([sp('POST', 'web/ensureuser', { logonName: everyone }), sp('GET', 'web/roledefinitions/getbytype(2)?$select=Id'), sp('GET', 'web/roledefinitions/getbytype(3)?$select=Id')]).then(function (r) {
      pid = r[0].Id; reader = r[1].Id; contrib = r[2].Id;
      function grant(base, role) {
        return sp('POST', base + '/breakroleinheritance(copyRoleAssignments=true,clearSubscopes=true)').then(function () {
          return sp('POST', base + '/roleassignments/addroleassignment(principalid=' + pid + ',roledefid=' + role + ')');
        });
      }
      var lst = function (l) { return "web/lists(guid'" + l.id + "')"; };
      return grant(lst(L.jobs), reader)
        .then(function () { return grant(lst(L.people), reader); })
        .then(function () { return grant(lst(L.reports), contrib); })
        .then(function () { return sp('MERGE', lst(L.reports), { __metadata: { type: 'SP.List' }, ReadSecurity: 2, WriteSecurity: 2 }, true); })
        .then(function () { return getDrive(); })
        .then(function () { return api('GET', '/drives/' + drive.id + '/root:/' + encPath(CFG.jobsFolder) + '?$select=id').catch(function (e) { if (e.status === 404) return api('POST', '/drives/' + drive.id + '/root/children', { name: CFG.jobsFolder, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }); throw e; }); })
        .then(function () { return sp('GET', 'web/lists/getbytitle(\'Documents\')?$select=RootFolder/ServerRelativeUrl&$expand=RootFolder').catch(function () { return { RootFolder: { ServerRelativeUrl: CFG.sitePath + '/Shared Documents' } }; }); })
        .then(function (lib) { var url = lib.RootFolder.ServerRelativeUrl + '/' + CFG.jobsFolder; return grant("web/GetFolderByServerRelativePath(decodedurl='" + url.replace(/'/g, "''") + "')/ListItemAllFields", contrib); });
    });
  }

  /* ---------- photos and videos kept on the phone until the report is sent ---------- */
  var idb = null;
  function db() {
    return idb || (idb = new Promise(function (res, rej) {
      var r = indexedDB.open('mki-media', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('b'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    }));
  }
  function tx(mode, fn) {
    return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('b', mode), q = fn(t.objectStore('b')); t.oncomplete = function () { res(q && q.result); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); }; }); });
  }
  LIVE.blobs = {
    put: function (k, b) { return tx('readwrite', function (s) { return s.put(b, k); }); },
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }); },
    del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }); }
  };
})();
