/* Preview data. Replaced by SharePoint lists once Microsoft sign-in is connected. */
(function () {
  var KEY = 'mki-preview-v1';

  var PEOPLE = [
    { id: 'agalindo', name: 'Abraham Galindo', short: 'Abraham G.', first: 'Abraham', ini: 'AG', email: 'agalindo@mkillc.com', role: 'Foreman', usualJob: '26-3007', reminder: true },
    { id: 'bfogle', name: 'Brian Fogle', short: 'Brian F.', first: 'Brian', ini: 'BF', email: 'brian.fogle@mkillc.com', role: 'Foreman', usualJob: '26-3008', reminder: true },
    { id: 'medwards', name: 'Matthew Edwards', short: 'Matthew E.', first: 'Matthew', ini: 'ME', email: 'matt@mkillc.com', role: 'Foreman', usualJob: '26-3005', reminder: true },
    { id: 'aharbin', name: 'Andy Harbin', short: 'Andy H.', first: 'Andy', ini: 'AH', email: 'andy@mkillc.com', role: 'Field Supervisor', usualJob: null, reminder: false }
  ];

  var JOBS = [
    { num: '26-3008', name: 'Covenant Day Fieldhouse', active: true },
    { num: '26-3007', name: 'Bradley Law Interior Upfit', active: true },
    { num: '26-3006', name: 'Real Life Church', active: true },
    { num: '26-3005', name: 'Catawba College Smokestack', active: true },
    { num: '26-3003', name: 'Lake Forest Church', active: true },
    { num: '26-3002', name: 'Newman Park Renovations', active: true },
    { num: '25-3022', name: 'Lake City Church Mooresville', active: true },
    { num: '26-3001', name: 'Daimler Truck Upfit', active: false }
  ];

  function dayKey(offset) {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); // weekends: sample data ends on Friday
    // walk back over weekends so sample data lands on workdays
    var n = 0;
    while (n < offset) { d.setDate(d.getDate() - 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; }
    return d.toISOString().slice(0, 10);
  }

  function R(id, off, who, job, sent, start, finish, crew, mat, delay, safety, photos, work, plan) {
    return {
      id: id, date: dayKey(off), person: who, job: job, sentAt: sent,
      start: start, finish: finish, crew: crew,
      weather: 'Clear, 68°',
      work: work || 'Hung drywall and taped seams. Cleaned up staging area at end of day.',
      mat: mat ? { yes: true, text: mat } : { yes: false, text: '' },
      delay: delay ? { yes: true, text: delay } : { yes: false, text: '' },
      safety: safety ? { yes: true, text: safety } : { yes: false, text: '' },
      plan: plan || 'Continue where we left off.',
      photos: photos
    };
  }

  var REPORTS = [
    R('r1', 0, 'agalindo', '26-3007', '16:12', '07:00', '15:30', 6, '40 sheets of 5/8" drywall for Monday. Framing inspection unit 210 needs scheduling.', null, null, 3,
      ['Hung drywall on level 2, east side', 'Taped and first coat in units 204–206', 'Cleaned up staging area'],
      ['Second coat units 204–206', 'Start hanging units 207–209']),
    R('r2', 0, 'bfogle', '26-3008', '17:03', '06:30', '15:00', 4, null, null, null, 6,
      'Framed the north locker room walls. Set door frames for rooms 104 and 105.', 'Start blocking for the bench supports.'),
    R('r3', 1, 'medwards', '26-3005', '16:40', '07:00', '15:30', 5, 'Scaffold rental extension past Friday.', 'Lift was down for 2 hours in the morning, waiting on the rental company.', null, 4),
    R('r4', 1, 'agalindo', '26-3007', '16:05', '07:00', '15:30', 6, null, null, null, 2),
    R('r5', 1, 'bfogle', '26-3008', '16:55', '06:30', '15:00', 4, null, null, 'Laborer cut his hand on a stud edge, first aid on site, back to work.', 5),
    R('r6', 2, 'medwards', '26-3005', '16:20', '07:00', '15:30', 5, null, null, null, 3),
    R('r7', 2, 'agalindo', '26-3007', '15:58', '07:00', '16:00', 7, null, null, null, 8),
    R('r8', 2, 'bfogle', '26-3008', '17:10', '06:30', '15:00', 4, null, 'Electrician wasn’t done in room 106, we moved to 104.', null, 2),
    R('r9', 3, 'medwards', '26-3006', '16:15', '07:00', '15:00', 3, null, null, null, 4),
    R('r10', 3, 'agalindo', '26-3007', '16:02', '07:00', '15:30', 6, null, null, null, 3),
    R('r11', 3, 'bfogle', '26-3008', '16:48', '06:30', '15:00', 4, null, null, null, 2),
    R('r12', 4, 'agalindo', '26-3007', '16:10', '07:00', '15:30', 6, 'Drywall delivery for Wednesday.', null, null, 4),
    R('r13', 4, 'bfogle', '26-3008', '16:51', '06:30', '15:00', 4, null, null, null, 3),
    R('r14', 4, 'medwards', '26-3005', '16:30', '07:00', '15:30', 5, null, 'Rain stopped work at the top level after lunch.', null, 5)
  ];

  var REQUESTS = [
    { id: 'q1', name: 'Bradley Law Interior Upfit, Phase 2', by: 'agalindo', date: dayKey(0), note: 'Second floor, separate contract' }
  ];

  function load() {
    var base = { v: 1, jobs: JOBS, people: PEOPLE, reports: REPORTS, requests: REQUESTS, me: null, draft: null, recent: {} };
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { for (var k in base) if (!(k in s) || (Array.isArray(base[k]) && !Array.isArray(s[k]))) s[k] = base[k]; return s; } } catch (e) {}
    return base;
  }
  var state = load();
  // Returns true when saved. False means the phone's storage for this page is full.
  function save() { try { localStorage.setItem(KEY, JSON.stringify(window.DB ? window.DB.state : state)); return true; } catch (e) { return false; } }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} state = load(); window.DB.state = state; }

  window.DB = { state: state, save: save, reset: reset, dayKey: dayKey };
})();
