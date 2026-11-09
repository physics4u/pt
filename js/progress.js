// ================================================================
//  progress.js — Settings → Progress over the years (admins).
//  Works out each academic year's figures the same way the Dashboard
//  does (by switching the year briefly, then switching back) and draws
//  them side by side: fees received, students, teaching hours, plus a
//  table with growth from the year before.
// ================================================================
var Progress = (function () {

  // Academic years that have records, oldest first, up to the current year
  function _years() {
    var seen = {}, cur = defaultAcadStart();
    Data.get().students.forEach(function (s) {
      String(s.yearCls || "").split(";").forEach(function (x) { var y = x.split(":")[0]; if (/^\d{4}-03$/.test(y) && y <= cur) seen[y] = true; });
    });
    seen[cur] = true;
    return Object.keys(seen).sort();
  }

  // One year's figures (people, not records: a group + hourly student counts once)
  function _year(start) {
    setAcademicYear(start);
    var all = Data.allStudents(), people = {}, p1 = {}, p2 = {}, hr = {};
    all.forEach(function (s) {
      var n = Utils.fullName(s), c = Utils.clsOf(s);
      people[n] = 1;
      if (Hourly.hourlyIn(s)) hr[n] = 1;
      else if (c === "Grade XI") p1[n] = 1;
      else if (c === "Grade XII") p2[n] = 1;
    });
    var T = Dashboard.totals(), n = Object.keys(people).length;
    return {
      start: start, label: acadLabel(start), current: start === defaultAcadStart(),
      students: n, p1: Object.keys(p1).length, p2: Object.keys(p2).length, hourly: Object.keys(hr).length,
      fees: T.fees, groupFees: T.groupFees, hourlyFees: T.hourlyFees,
      p1Hours: T.p1Hours, p2Hours: T.p2Hours, hourlyHours: T.hourlyHours, p1Days: T.p1Days, p2Days: T.p2Days,
      perStudent: n ? T.fees / n : 0
    };
  }

  // The same date in the year starting `start` (today's day and month, that year's calendar)
  function _sameDay(start) {
    var t = ptToday().iso, shift = Number(start.slice(0, 4)) - Number(defaultAcadStart().slice(0, 4));
    var y = Number(t.slice(0, 4)) + shift, md = t.slice(5);
    if (md === "02-29" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) md = "02-28";
    return y + "-" + md;
  }

  // One year's figures up to a date (fees by the day they were received,
  // classes and sessions held by then, students who had started by then)
  function _soFar(start, cut) {
    setAcademicYear(start);
    var D = Data.get(), first = acadFirstDay(), rc = Utils.rosterCls(), feeMonths = acadEntryMonths();
    var r = { start: start, label: acadLabel(start), cut: cut, groupFees: 0, hourlyFees: 0, p1Hours: 0, p2Hours: 0, hourlyHours: 0 };
    Object.keys(D.paygrid || {}).forEach(function (sk) {
      var k = sk.split("|"); if (feeMonths.indexOf(k[2]) < 0) return;
      var mo = k[2].slice(5);
      Object.keys(D.paygrid[sk]).forEach(function (nm) {
        if ((mo === "03" || mo === "04") && rc[nm] !== k[1]) return;
        var e = D.paygrid[sk][nm];
        if (e.status === "Paid" && String(e.paydate || k[2] + "-01") <= cut) r.groupFees += Number(e.amount) || 0;
      });
    });
    var people = {}, hourly = {};
    Data.allStudents().forEach(function (s) {
      var n = Utils.fullName(s);
      if (Hourly.hourlyIn(s)) hourly[n] = 1;
      if (String(s.startDate || first) <= cut) people[n] = 1;
    });
    (D.hourpay || []).forEach(function (x) {
      if (hourly[x.student] && x.date >= first && x.date <= cut) r.hourlyFees += Number(x.amount) || 0;
    });
    (D.sessions || []).forEach(function (x) {
      if (hourly[x.student] && x.date >= first && x.date <= cut) r.hourlyHours += Hourly.sessionHours(x);
    });
    Object.keys(D.syllabus || {}).forEach(function (sk) {
      var k = sk.split("|"); if (!Dashboard.plannerKeyInYear(sk)) return;
      Object.keys(D.syllabus[sk]).forEach(function (day) {
        var e = D.syllabus[sk][day], dt = k[1] + "-" + String(day).padStart(2, "0");
        if (!e.chapter || dt < first || dt > cut) return;
        var a = Hourly.parseTime(e.start), b = Hourly.parseTime(e.end);
        if (a === null || b === null || b <= a) return;
        if (k[0] === "Grade XI") r.p1Hours += b - a; else if (k[0] === "Grade XII") r.p2Hours += b - a;
      });
    });
    r.fees = r.groupFees + r.hourlyFees;
    r.hours = r.p1Hours + r.p2Hours + r.hourlyHours;
    r.students = Object.keys(people).length;
    return r;
  }

  function compute() {
    var keep = viewYear(), rows = [];
    try { _years().forEach(function (y) { rows.push(_year(y)); }); }
    finally { setAcademicYear(keep); }
    return rows;
  }
  // Every year up to today's date in that year
  function computeSoFar() {
    var keep = viewYear(), rows = [];
    try { _years().forEach(function (y) { rows.push(_soFar(y, _sameDay(y))); }); }
    finally { setAcademicYear(keep); }
    return rows;
  }

  // ---------- drawing ----------
  function _css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function _font() { return document.documentElement.classList.contains("font-courier") ? "'Courier New', Courier, monospace" : "'Segoe UI', Roboto, Arial, sans-serif"; }
  function money(v) { return "₹" + Math.round(v || 0).toLocaleString("en-IN"); }
  function lakh(v) { return v >= 100000 ? "₹" + (v / 100000).toFixed(2) + "L" : v >= 1000 ? "₹" + Math.round(v / 1000) + "k" : "₹" + Math.round(v); }
  function hm(h) { var m = Math.round((h || 0) * 60); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }

  // Stacked vertical bars: series = [{key, label, color}], fmt(total) for the label on top
  function _bars(canvas, rows, series, fmt, sub) {
    var dpr = window.devicePixelRatio || 1;
    var W = Math.max(280, canvas.parentElement.clientWidth - 8), H = 230;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
    var PAD_L = 10, PAD_R = 10, PAD_T = 30, PAD_B = sub ? 46 : 30, cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B;
    var totals = rows.map(function (r) { return series.reduce(function (t, s) { return t + (r[s.key] || 0); }, 0); });
    var max = Math.max.apply(null, totals.concat([1]));
    var slot = cw / rows.length, bw = Math.min(64, slot * 0.58), base = PAD_T + ch;
    ctx.strokeStyle = _css("--border"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, base + 0.5); ctx.lineTo(W - PAD_R, base + 0.5); ctx.stroke();
    rows.forEach(function (r, i) {
      var x = PAD_L + slot * i + (slot - bw) / 2, y = base;
      series.forEach(function (s, si) {
        var h = (r[s.key] || 0) / max * ch; if (h <= 0) return;
        ctx.fillStyle = s.color; ctx.globalAlpha = r.current ? 0.55 : 1;
        var top = si === series.length - 1 || !series.slice(si + 1).some(function (n) { return r[n.key] > 0; });
        _rect(ctx, x, y - h, bw, h, top ? 4 : 0);
        y -= h;
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = _css("--text"); ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.font = "bold " + (slot < 46 ? 10 : 12) + "px " + _font();
      ctx.fillText(fmt(totals[i], r), x + bw / 2, y - 4);
      ctx.fillStyle = _css("--text2"); ctx.textBaseline = "top"; ctx.font = "12px " + _font();
      ctx.fillText((slot < 60 ? r.label.slice(2) : r.label) + (r.current ? "*" : ""), x + bw / 2, base + 6);
      if (sub) { var t = sub(r, i); if (t) { ctx.fillStyle = t.color || _css("--text3"); ctx.font = "bold " + (slot < 46 ? 10 : 11) + "px " + _font(); ctx.fillText(t.text, x + bw / 2, base + 22); } }
    });
  }
  function _rect(ctx, x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  }
  function _legend(items) {
    return "<div class='prog-legend'>" + items.map(function (s) {
      return "<span><i style='background:" + s.color + "'></i>" + s.label + "</span>"; }).join("") + "</div>";
  }
  function _growth(rows, key, fair) {
    return function (r, i) {
      if (!i || !rows[i - 1][key]) return null;
      var g = (r[key] - rows[i - 1][key]) / rows[i - 1][key] * 100;
      if (r.current && !fair) return { text: "so far", color: _css("--text3") };
      return { text: (g >= 0 ? "+" : "") + Math.round(g) + "%", color: g >= 0 ? _css("--accent3") : _css("--danger") };
    };
  }

  function render() {
    var box = Utils.el("progress-body"); if (!box) return;
    var rows = compute(); meta();
    var C1 = _css("--plus1"), C2 = _css("--plus2"), CH = _css("--hourly") || _css("--accent"), CI = _css("--income");
    var fees = [{ key: "groupFees", label: "Group fees", color: CI }, { key: "hourlyFees", label: "Hourly fees", color: CH }];
    var stu = [{ key: "p1", label: "Plus 1", color: C1 }, { key: "p2", label: "Plus 2", color: C2 }, { key: "hourly", label: "Hourly", color: CH }];
    var hrs = [{ key: "p1Hours", label: "Plus 1", color: C1 }, { key: "p2Hours", label: "Plus 2", color: C2 }, { key: "hourlyHours", label: "Hourly", color: CH }];
    var first = rows[0], lastFull = rows.filter(function (r) { return !r.current; }).pop();
    var cagr = first && lastFull && lastFull !== first && first.fees > 0
      ? (Math.pow(lastFull.fees / first.fees, 1 / (rows.indexOf(lastFull) - rows.indexOf(first))) - 1) * 100 : null;
    var sf = computeSoFar(), now = sf[sf.length - 1], prev = sf[sf.length - 2];
    sf.forEach(function (r, i) { r.current = i === sf.length - 1; });
    var dm = Utils.fmtDate(now.cut).replace(/ \d{4}$/, "");
    function chg(a, b) {
      if (!b) return "<td class='c muted'>\u2014</td>";
      var g = (a - b) / b * 100;
      return "<td class='c' style='color:" + (g >= 0 ? "var(--accent3)" : "var(--danger)") + ";font-weight:700'>" + (g >= 0 ? "+" : "") + Math.round(g) + "%</td>";
    }
    function line(lbl, a, b, f) { return "<tr><td>" + lbl + "</td><td class='r'><b>" + f(a) + "</b></td><td class='r'>" + f(b) + "</td>" + chg(a, b) + "</tr>"; }
    var same = !prev ? "" :
      "<div class='prog-same'><div class='prog-title'>Same point last year &middot; up to " + dm + "</div>" +
      "<table class='tests-table prog-table prog-cmp'><thead><tr><th></th><th class='r'>" + now.label + "<small>to " + Utils.fmtDate(now.cut) + "</small></th>" +
        "<th class='r'>" + prev.label + "<small>to " + Utils.fmtDate(prev.cut) + "</small></th><th class='c'>Change</th></tr></thead><tbody>" +
        line("Fees received", now.fees, prev.fees, money) +
        line("&nbsp;&nbsp;Group fees", now.groupFees, prev.groupFees, money) +
        line("&nbsp;&nbsp;Hourly fees", now.hourlyFees, prev.hourlyFees, money) +
        line("Students", now.students, prev.students, String) +
        line("Teaching hours", now.hours, prev.hours, hm) +
        line("&nbsp;&nbsp;Plus 1", now.p1Hours, prev.p1Hours, hm) +
        line("&nbsp;&nbsp;Plus 2", now.p2Hours, prev.p2Hours, hm) +
        line("&nbsp;&nbsp;Hourly", now.hourlyHours, prev.hourlyHours, hm) +
      "</tbody></table></div>";
    var best = rows.filter(function (r) { return !r.current; }).sort(function (a, b) { return b.fees - a.fees; })[0];
    box.innerHTML = _strip() +
      "<div class='prog-kpis'>" +
        "<div><span>Fees received, all years</span><b>" + money(rows.reduce(function (t, r) { return t + r.fees; }, 0)) + "</b></div>" +
        (cagr === null ? "" : "<div><span>Average yearly growth (" + first.label + " to " + lastFull.label + ")</span><b style='color:" + (cagr >= 0 ? "var(--accent3)" : "var(--danger)") + "'>" + (cagr >= 0 ? "+" : "") + cagr.toFixed(1) + "%</b></div>") +
        (best ? "<div><span>Best year for fees</span><b>" + best.label + " &middot; " + lakh(best.fees) + "</b></div>" : "") +
        "<div><span>Students taught, all years</span><b>" + rows.reduce(function (t, r) { return t + r.students; }, 0) + "</b></div>" +
      "</div>" +
      "<div class='prog-grid'>" + same +
        "<div class='prog-chart'><div class='prog-title'>Fees received up to " + dm + ", each year</div>" + _legend(fees) + "<canvas id='prog-sofar'></canvas></div>" +
      "</div>" +
      "<div class='prog-grid'>" +
        "<div class='prog-chart'><div class='prog-title'>Fees received per year</div>" + _legend(fees) + "<canvas id='prog-fees'></canvas></div>" +
        "<div class='prog-chart'><div class='prog-title'>Students per year</div>" + _legend(stu) + "<canvas id='prog-students'></canvas></div>" +
        "<div class='prog-chart'><div class='prog-title'>Teaching hours per year</div>" + _legend(hrs) + "<canvas id='prog-hours'></canvas></div>" +
        "<div class='prog-chart'><div class='prog-title'>Fees per student</div>" + _legend([{ label: "Fees received ÷ students", color: _css("--text3") }]) + "<canvas id='prog-per'></canvas></div>" +
      "</div>" +
      "<div style='overflow-x:auto'><table class='tests-table prog-table'><thead><tr><th class='num'>#</th><th>Year</th><th class='c'>Students</th>" +
        "<th class='c'>Plus 1</th><th class='c'>Plus 2</th><th class='c'>Hourly</th><th class='r'>Fees received</th><th class='c'>Growth</th>" +
        "<th class='r'>Per student</th><th class='c'>Plus 1 hrs / days</th><th class='c'>Plus 2 hrs / days</th><th class='c'>Hourly hrs</th></tr></thead><tbody>" +
      rows.map(function (r, i) {
        var g = i && rows[i - 1].fees ? (r.fees - rows[i - 1].fees) / rows[i - 1].fees * 100 : null;
        return "<tr><td class='num'>" + (i + 1) + "</td><td><b>" + r.label + "</b>" + (r.current ? " <span class='muted small'>so far</span>" : "") + "</td>" +
          "<td class='c'>" + r.students + "</td><td class='c'>" + r.p1 + "</td><td class='c'>" + r.p2 + "</td><td class='c'>" + r.hourly + "</td>" +
          "<td class='r'>" + money(r.fees) + "</td>" +
          "<td class='c' style='color:" + (g === null || r.current ? "var(--text3)" : g >= 0 ? "var(--accent3)" : "var(--danger)") + "'>" +
            (g === null ? "—" : r.current ? "so far" : (g >= 0 ? "+" : "") + Math.round(g) + "%") + "</td>" +
          "<td class='r'>" + money(r.perStudent) + "</td>" +
          "<td class='c'>" + hm(r.p1Hours) + " / " + r.p1Days + "</td><td class='c'>" + hm(r.p2Hours) + " / " + r.p2Days + "</td><td class='c'>" + hm(r.hourlyHours) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      "<p class='section-note' style='margin:8px 0 0'>* " + acadLabel(defaultAcadStart()) + " is in progress (shown lighter, “so far”). Students are people enrolled in the year (someone in group and hourly classes counts once). Growth compares fees received with the year before. “Same point last year” counts fees by the day they were received, classes and hourly sessions held, and students who had started, up to today&rsquo;s date in each year.</p>";
    _bars(Utils.el("prog-sofar"), sf, fees, lakh, _growth(sf, "fees", true));
    _bars(Utils.el("prog-fees"), rows, fees, lakh, _growth(rows, "fees"));
    _bars(Utils.el("prog-students"), rows, stu, function (v, r) { return String(r.students); });
    _bars(Utils.el("prog-hours"), rows, hrs, function (v) { return hm(v); });
    _bars(Utils.el("prog-per"), rows, [{ key: "perStudent", label: "", color: _css("--text3") }], lakh);
  }

  // Logo, title and date at the top (for the picture)
  function _strip() {
    var y = _years();
    return "<div class='pf-idstrip prog-strip'><img src='logo.png' alt=''><div class='pf-id-main'><div class='pf-id-name'>Progress over the years</div>" +
      "<div class='pf-id-sub'>Academic years " + acadLabel(y[0]) + " to " + acadLabel(y[y.length - 1]) + "</div></div>" +
      "<div class='pf-id-right'><div class='pf-id-date'>" + Utils.fmtDate(ptToday().date) + "</div><div class='pf-id-org'>PT &middot; Physics Tuition</div></div></div>";
  }

  // Share: a picture of the whole section, laid out at a fixed width so it
  // looks the same from a phone or a computer
  function share(btn) {
    var d = Utils.el("sec-progress"); if (!d) return;
    if (!d.open) d.open = true;
    var box = Utils.el("progress-body");
    box.classList.add("prog-snap"); render();
    var y = _years();
    var file = "PT progress " + acadLabel(y[0]).replace("\u2013", "-") + " to " + acadLabel(y[y.length - 1]).replace("\u2013", "-") + " - " + Utils.fmtDate(ptToday().date) + ".png";
    Utils.snap(box, file, btn).then(function () { box.classList.remove("prog-snap"); render(); });
  }

  // Header label: "2021-22 to 2026-27 · 6 years"
  function meta() {
    var m = Utils.el("progress-meta"); if (!m) return;
    var y = _years();
    m.textContent = y.length > 1 ? acadLabel(y[0]) + " to " + acadLabel(y[y.length - 1]) + " \u00b7 " + y.length + " years" : acadLabel(y[0]);
  }

  // Draw when the section is opened (it needs its width)
  function toggle(el) { if (el.open) render(); }

  return { compute: compute, computeSoFar: computeSoFar, render: render, toggle: toggle, meta: meta, share: share };
})();
