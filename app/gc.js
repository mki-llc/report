/* Daily report PDF for the general contractor (GC), and the office screen that prepares it.

   Two kinds of PDF come out of here:
   1. "As sent" record: made on the foreman's phone the moment a report is sent, with every answer,
      and saved in the job folder next to the photos. It is never changed afterwards.
   2. GC report: the office reviews the foreman's report, fixes wording, adds what's missing, picks
      which sections and photos the GC sees, then saves it to the job folder or emails it. The
      foreman's original stays as it was; the office version is stored separately with who reviewed
      it and when. Once a version has been emailed, later changes go out as Revision 1, 2, ...
   jsPDF is loaded only when a PDF is needed. */
(function () {
  'use strict';
  var JSPDF = 'vendor/jspdf-2.5.1.umd.min.js';
  var RED = [153, 0, 0], INK = [30, 27, 27], MUT = [107, 98, 98], LINE = [226, 220, 220], SOFT = [250, 247, 247];
  var COMPANY = 'MKI LLC';

  var SECTIONS = [
    { k: 'work', t: 'Work completed', on: true },
    { k: 'delay', t: 'Delays and impacts', on: true },
    { k: 'safety', t: 'Safety and quality', on: true },
    { k: 'mat', t: 'Materials, equipment and inspections', on: false, hint: 'Off by default: often orders to MKI’s own office. Turn on for inspections or things needed from the GC.' },
    { k: 'plan', t: 'Plan for next workday', on: false, hint: 'Off by default: a look-ahead can read as a commitment.' },
    { k: 'notes', t: 'Notes from MKI', on: false, hint: 'Anything the office wants to add for the GC.' }
  ];
  function lines(x) { return (Array.isArray(x) ? x : String(x || '').split(/\n+/)).map(function (t) { return String(t || '').replace(/^\s*\d+\.\s*/, '').trim(); }).filter(Boolean); }
  // What the foreman said, per section, as a list of lines.
  function original(r) {
    return {
      work: lines(r.work),
      delay: r.delay.yes ? lines(r.delay.text) : ['No delays reported.'],
      safety: r.safety.yes ? lines(r.safety.text) : ['No safety or quality issues reported.'],
      mat: r.mat.yes ? lines(r.mat.text) : ['Nothing needed.'],
      plan: lines(r.plan),
      notes: []
    };
  }
  // A fresh office review based on the foreman's report.
  function newReview(r) {
    var o = original(r), sec = {};
    SECTIONS.forEach(function (s) { sec[s.k] = { on: s.on, text: o[s.k].slice() }; });
    if (r.mat.yes && /inspect|test|inspector|pressure/i.test(r.mat.text)) sec.mat.on = true;
    return { v: 1, sections: sec, photos: null, sent: [], savedAt: null, reviewedBy: null, reviewedAt: null };
  }

  function loadPdfLib() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = JSPDF;
      s.onload = function () { res(window.jspdf.jsPDF); }; s.onerror = function () { rej(new Error('Couldn’t load the PDF maker')); };
      document.head.appendChild(s);
    });
  }
  // Any image source (blob, data URL, http URL) to a JPEG data URL no bigger than max px, for the PDF.
  function toJpeg(src, max) {
    return Promise.resolve(src).then(function (s) {
      if (!s) return null;
      if (typeof s === 'string' && /^https?:/.test(s)) return fetch(s).then(function (r) { if (!r.ok) throw new Error('photo ' + r.status); return r.blob(); });
      return s;
    }).then(function (s) {
      if (!s) return null;
      return new Promise(function (res) {
        var img = new Image(), url = typeof s === 'string' ? s : URL.createObjectURL(s);
        img.onload = function () {
          var k = Math.min(1, (max || 1400) / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          if (typeof s !== 'string') URL.revokeObjectURL(url);
          try { res({ data: c.toDataURL('image/jpeg', 0.78), w: c.width, h: c.height }); } catch (e) { res(null); }
        };
        img.onerror = function () { if (typeof s !== 'string') URL.revokeObjectURL(url); res(null); };
        img.src = url;
      });
    }).catch(function () { return null; });
  }

  function fmtDate(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  function fmtStamp(ms) { if (!ms) return ''; var d = new Date(ms); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function t12(hm) { if (!hm) return ''; var p = hm.split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM'); }

  /* model: { kind: 'record'|'gc', job:{num,name,address,gc,gcProject}, reportNo, date, weather, foreman:{name,role}, sentDate, sentAt,
              sections:[{t, lines}], photos:[{img:{data,w,h}, caption}], videos, reviewed:{name, role, at}, rev, note } */
  function makePdf(m) {
    return loadPdfLib().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'pt', format: 'letter' }), W = 612, H = 792, X = 44, CW = W - 2 * X, y = 0;
      function color(c) { doc.setTextColor(c[0], c[1], c[2]); }
      function font(style, size) { doc.setFont('helvetica', style); doc.setFontSize(size); }
      function need(h) { if (y + h > H - 70) { doc.addPage(); y = 50; } }
      function txt(s, x, yy, o) { doc.text(String(s), x, yy, o || {}); }
      // header
      doc.setFillColor(RED[0], RED[1], RED[2]); doc.rect(0, 0, W, 6, 'F');
      font('bold', 20); color(RED); txt(COMPANY, X, 46);
      font('normal', 9); color(MUT); txt('Plumbing subcontractor', X, 60);
      font('bold', 16); color(INK); txt(m.kind === 'record' ? 'FOREMAN DAILY REPORT' : 'DAILY REPORT', W - X, 44, { align: 'right' });
      font('normal', 10); color(MUT);
      txt((m.reportNo ? 'Report No. ' + m.reportNo : '') + (m.rev ? '  ·  Revision ' + m.rev : ''), W - X, 60, { align: 'right' });
      y = 82;
      if (m.kind === 'record') { doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]); doc.rect(X, y - 12, CW, 20, 'F'); font('normal', 9); color(MUT); txt('As submitted by the foreman. Internal record, not edited.', X + 8, y + 1); y += 22; }
      // info grid
      var rows = [
        ['Project', (m.job.num ? m.job.num + '  ' : '') + m.job.name], ['Date', fmtDate(m.date)],
        ['Site address', m.job.address || '—'], ['Weather', m.weather || 'Not available'],
        ['General contractor', m.job.gc || '—'], ['GC project no.', m.job.gcProject || '—'],
        ['Foreman', m.foreman.name], ['Submitted', (m.sentDate && m.sentDate !== m.date ? fmtDate(m.sentDate).replace(/, \d{4}$/, '') + ', ' : '') + t12(m.sentAt) + (m.sentDate && m.sentDate !== m.date ? ' (late)' : '')]
      ];
      // two columns of label-over-value cells
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.6);
      var colW = CW / 2, padR = 14;
      for (var i = 0; i < rows.length; i += 2) {
        var hRow = 0, cells = [rows[i], rows[i + 1]].map(function (cell) { font('normal', 10); var v = doc.splitTextToSize(String(cell[1]), colW - padR); hRow = Math.max(hRow, v.length * 12.5); return [cell[0], v]; });
        cells.forEach(function (cell, j) {
          var cx = X + j * colW;
          font('bold', 7.5); color(MUT); txt(cell[0].toUpperCase(), cx, y + 8);
          font('normal', 10); color(INK); doc.text(cell[1], cx, y + 21);
        });
        y += hRow + 22; doc.line(X, y - 4, X + CW, y - 4);
      }
      y += 10;
      // sections
      m.sections.forEach(function (s) {
        need(44);
        font('bold', 11); color(RED); txt(s.t.toUpperCase(), X, y); y += 6;
        doc.setDrawColor(RED[0], RED[1], RED[2]); doc.setLineWidth(1); doc.line(X, y, X + CW, y); y += 15;
        var numbered = s.lines.length > 1;
        s.lines.forEach(function (l, n) {
          font('normal', 10.5); color(INK);
          var pre = numbered ? (n + 1) + '.' : '', wrap = doc.splitTextToSize(l, CW - (numbered ? 20 : 0));
          need(wrap.length * 14 + 4);
          if (pre) txt(pre, X, y);
          doc.text(wrap, X + (numbered ? 20 : 0), y); y += wrap.length * 14 + 3;
        });
        y += 12;
      });
      if (m.videos) { need(20); font('italic', 9.5); color(MUT); txt(m.videos === 1 ? '1 video was also recorded. It is kept in MKI’s job folder.' : m.videos + ' videos were also recorded. They are kept in MKI’s job folder.', X, y); y += 18; }
      // sign-off
      need(m.kind === 'gc' ? 96 : 50);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.6); doc.line(X, y, X + CW, y); y += 16;
      font('normal', 9.5); color(INK);
      txt('Prepared by ' + m.foreman.name + (m.foreman.role ? ', ' + m.foreman.role : '') + ', sent from the field ' + (m.sentDate ? fmtDate(m.sentDate).replace(/, \d{4}$/, '') + ' at ' : '') + t12(m.sentAt) + '.', X, y); y += 14;
      if (m.reviewed && m.reviewed.name) { txt('Reviewed by ' + m.reviewed.name + (m.reviewed.role ? ', ' + m.reviewed.role : '') + ', ' + fmtStamp(m.reviewed.at) + '.', X, y); y += 14; }
      if (m.rev) { color(MUT); txt('Revision ' + m.rev + ' replaces the earlier version of this report.', X, y); y += 14; color(INK); }
      if (m.kind === 'gc') { y += 18; color(MUT); txt('Received by (GC): ______________________________     Date: ______________', X, y); y += 10; }
      // photos, two per row
      if (m.photos.length) {
        doc.addPage(); y = 50;
        font('bold', 11); color(RED); txt('PHOTOS', X, y); y += 6; doc.setDrawColor(RED[0], RED[1], RED[2]); doc.setLineWidth(1); doc.line(X, y, X + CW, y); y += 14;
        var gap = 14, pw = (CW - gap) / 2, ph = pw * 0.75;
        m.photos.forEach(function (p, n) {
          var col = n % 2; if (col === 0) need(ph + 30);
          var px = X + col * (pw + gap), img = p.img;
          doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]); doc.rect(px, y, pw, ph, 'F');
          if (img) { var k = Math.min(pw / img.w, ph / img.h), iw = img.w * k, ih = img.h * k; doc.addImage(img.data, 'JPEG', px + (pw - iw) / 2, y + (ph - ih) / 2, iw, ih); }
          font('normal', 8.5); color(MUT); txt(p.caption, px, y + ph + 12);
          if (col === 1 || n === m.photos.length - 1) y += ph + 26;
        });
      }
      // footer on every page
      var pages = doc.getNumberOfPages();
      for (var pg = 1; pg <= pages; pg++) {
        doc.setPage(pg); font('normal', 8); color(MUT);
        txt(COMPANY + '  ·  ' + (m.job.num ? m.job.num + ' ' : '') + m.job.name + '  ·  ' + fmtDate(m.date), X, H - 28);
        txt('Page ' + pg + ' of ' + pages, W - X, H - 28, { align: 'right' });
      }
      return doc.output('blob');
    });
  }

  function fileName(m) {
    var base = m.date + ' Daily Report ' + (m.job.num || 'New job') + (m.kind === 'record' ? ' ' + m.foreman.name + ' as sent' : '') + (m.rev ? ' Rev ' + m.rev : '');
    return base.replace(/[\\/:*?"<>|#%]/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf';
  }

  window.GC = { SECTIONS: SECTIONS, original: original, newReview: newReview, makePdf: makePdf, toJpeg: toJpeg, fileName: fileName, lines: lines, fmtStamp: fmtStamp };
})();
