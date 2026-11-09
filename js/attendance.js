// ================================================================
//  attendance.js — Attendance (P / A per student per day)
//
//  Same layout as the Monthly Planner: Plus 1 and Plus 2 sections
//  (closed when the page opens), each month split into weeks
//  (Mon–Sun) with only the current week open.
//  A day that has marks is locked: hover its date and press ✏ to change
//  it. Clicking a cell on an empty day starts marking that day; it stays
//  open until Done (or until you start another day).
// ================================================================

var Attendance = (function () {
  var CLASSES = [["Grade XI", "Plus 1"], ["Grade XII", "Plus 2"]];
  var _open = {};      // "Grade XI" → section open; "Grade XI|w2" → week open
  var _ym = null;      // month shown
  var _edit = {};      // cls → day being marked / edited

  function init() {
    var sel = Utils.el("attsheet-month");
    var ym = Utils.curYm();
    var opts = Array.from(sel.options).map(function (o) { return o.value; });
    sel.value = opts.includes(ym) ? ym : opts[0];
    _open = {}; _edit = {}; _ym = null;
    render();
  }
  function setClass(cls) { _open[cls] = true; render(); }       // used by links into Attendance
  function step(n) {
    var sel = Utils.el("attsheet-month"), i = sel.selectedIndex + n;
    if (i < 0 || i >= sel.options.length) return;
    sel.selectedIndex = i; render();
  }
  function toggle(key, el) { _open[key] = el.open; }

  function _weeks(year, month) {
    var dim = new Date(year, month, 0).getDate(), weeks = [], cur = [];
    for (var d = 1; d <= dim; d++) {
      cur.push(d);
      if (new Date(year, month - 1, d).getDay() === 0 || d === dim) { weeks.push(cur); cur = []; }
    }
    return weeks;
  }
  function _sheet(cls) { return ((Data.get().attsheets || {})["attsheet|" + cls + "|" + _ym]) || {}; }
  function _marked(sheet, names, d) { return names.some(function (n) { var v = (sheet[n] || {})[d]; return v === "P" || v === "A"; }); }
  function _pctCol(p) { return p === null ? "var(--text3)" : p >= 75 ? "var(--accent3)" : p >= 50 ? "var(--accent2)" : "var(--danger)"; }

  function render() {
    var ym = Utils.el("attsheet-month").value; if (!ym) return;
    var p = ym.split("-"), year = Number(p[0]), month = Number(p[1]);
    var weeks = _weeks(year, month), now = new Date(), thisMonth = Utils.curYm() === ym;
    if (_ym !== ym) {
      Object.keys(_open).forEach(function (k) { if (k.indexOf("|w") > 0) delete _open[k]; });
      _edit = {}; _ym = ym;
      if (thisMonth) weeks.forEach(function (w, i) {
        if (w.indexOf(now.getDate()) >= 0) CLASSES.forEach(function (c) { _open[c[0] + "|w" + i] = true; });
      });
    }
    var mon = MONTHS[month - 1].slice(0, 3);
    var sf = (Utils.el("as-status") || {}).value || "";

    Utils.el("attsheet-wrap").innerHTML = CLASSES.map(function (c) {
      var cls = c[0], sheet = _sheet(cls);
      var students = Data.allStudents().filter(function (s) { return s.cls === cls && Hourly.inGroup(s) && (!sf || s.status === sf); });
      var names = students.map(Utils.fullName);
      // Month totals per student
      var mP = {}, mA = {}, classDays = 0, allP = 0, allA = 0;
      names.forEach(function (n) {
        mP[n] = 0; mA[n] = 0;
        Object.keys(sheet[n] || {}).forEach(function (d) { var v = sheet[n][d]; if (v === "P") mP[n]++; if (v === "A") mA[n]++; });
        allP += mP[n]; allA += mA[n];
      });
      for (var d0 = 1; d0 <= new Date(year, month, 0).getDate(); d0++) if (_marked(sheet, names, d0)) classDays++;
      var mPct = allP + allA ? Math.round(allP / (allP + allA) * 100) : null;

      var body;
      if (!names.length) {
        body = "<div class='empty' style='padding:20px'><div class='empty-text'>No students in " + c[1] + ".</div></div>";
      } else {
        body = weeks.map(function (w, wi) {
          var wkey = cls + "|w" + wi, wP = 0, wA = 0, wDays = 0;
          var head = "<tr><th class='num'>#</th><th class='name-col'>Name</th>" + w.map(function (d) {
            var di = new Date(year, month - 1, d).getDay(), wk = di === 0 || di === 6;
            var marked = _marked(sheet, names, d), editing = _edit[cls] === d;
            if (marked) wDays++;
            return "<th class='day-col" + (wk ? " weekend-col" : "") + (editing ? " editing" : "") + (marked && !editing ? " locked" : "") +
              (thisMonth && d === now.getDate() ? " today" : "") + "' title='" + d + " " + MONTHS[month - 1] + " (" + DAYS[di] + ")'>" +
              d + "<br><span class='dn'>" + DAYS[di].slice(0, 2) + "</span>" +
              (marked && !editing ? Utils.hoverEdit("Attendance.edit('" + cls + "'," + d + ")", "Change this day") : "") + "</th>";
          }).join("") + "<th class='sum'>Week</th><th class='sum'>Month</th></tr>";
          var rows = names.map(function (n, si) {
            var rp = 0, ra = 0;
            var cells = w.map(function (d) {
              var di = new Date(year, month - 1, d).getDay(), wk = di === 0 || di === 6;
              var v = (sheet[n] || {})[d] || "";
              if (v === "P") rp++; if (v === "A") ra++;
              var locked = _marked(sheet, names, d) && _edit[cls] !== d;
              var cl = "as-btn-p" + (v === "P" ? " active-p" : v === "A" ? " active-a" : "");
              return "<td class='" + (wk ? "weekend-col" : "") + (_edit[cls] === d ? " editing" : "") + "'>" + (locked
                ? "<span class='" + cl + " lockd'>" + (v || "–") + "</span>"
                : "<button class='" + cl + "' onclick='Attendance.mark(\"" + cls + "\"," + d + "," + si + ")'>" + (v || "--") + "</button>") + "</td>";
            }).join("");
            wP += rp; wA += ra;
            var mt = mP[n] + mA[n], pct = mt ? Math.round(mP[n] / mt * 100) : null;
            return "<tr><td class='num'>" + (si + 1) + "</td><td class='name-col'>" + Utils.studentLink(n) + "</td>" + cells +
              "<td class='sum'><span style='color:var(--accent3)'>" + rp + "</span> / <span style='color:var(--danger)'>" + ra + "</span></td>" +
              "<td class='sum' style='color:" + _pctCol(pct) + "'>" + (pct === null ? "--" : pct + "%") + "</td></tr>";
          }).join("");
          var foot = "<tr class='as-summary-row'><td></td><td class='name-col'>Present</td>" + w.map(function (d) {
            var n = names.filter(function (x) { return (sheet[x] || {})[d] === "P"; }).length;
            return "<td style='color:var(--accent3)'>" + (n || "--") + "</td>";
          }).join("") + "<td></td><td></td></tr>";
          var editing = _edit[cls] && w.indexOf(_edit[cls]) >= 0 ? _edit[cls] : null;
          var bar = editing ? "<div class='as-editbar'><span>Marking <b>" + editing + " " + mon + "</b>: click a box for P → A → blank.</span>" +
              "<button class='btn btn-secondary btn-sm' onclick='Attendance.allPresent(\"" + cls + "\"," + editing + ")'>Mark everyone present</button>" +
              (_marked(sheet, names, editing) ? "<button class='btn btn-danger btn-sm' onclick='Attendance.clearDay(\"" + cls + "\"," + editing + ")'>Clear day</button>" : "") +
              "<button class='btn btn-primary btn-sm' onclick='Attendance.done(\"" + cls + "\")'>Done</button></div>" : "";
          var wt = wP + wA, wPct = wt ? Math.round(wP / wt * 100) : null;
          var meta = wDays ? wDays + " class day" + (wDays === 1 ? "" : "s") + " &middot; <span style='color:" + _pctCol(wPct) + "'>" + wPct + "% present</span>" : "not marked yet";
          return "<details class='section syl-week'" + (_open[wkey] ? " open" : "") + " ontoggle='Attendance.toggle(\"" + wkey + "\", this)'>" +
            "<summary><span class='section-title'>Week " + (wi + 1) + " <span class='muted' style='font-weight:500'>" + w[0] +
            (w.length > 1 ? "–" + w[w.length - 1] : "") + " " + mon + "</span></span><span class='section-meta'>&middot; " + meta + "</span>" +
            (thisMonth && w.indexOf(now.getDate()) >= 0 ? "<span class='chip chip-gold' style='margin-left:6px'>This week</span>" : "") +
            "<span class='show-pill' aria-hidden='true'></span></summary><div class='section-body' style='padding:0'>" + bar +
            "<div style='overflow-x:auto'><table class='as-table as-week'><thead>" + head + "</thead><tbody>" + rows + foot + "</tbody></table></div></div></details>";
        }).join("");
      }
      return "<details class='section tests-section syl-class as-class'" + (_open[cls] ? " open" : "") + " ontoggle='Attendance.toggle(\"" + cls + "\", this)'>" +
        "<summary><span class='section-title'>" + c[1] + "</span><span class='section-meta'>&middot; " + MONTHS[month - 1] + " " + year +
        " &middot; " + names.length + " students &middot; " + classDays + " class day" + (classDays === 1 ? "" : "s") +
        (mPct === null ? "" : " &middot; <span style='color:" + _pctCol(mPct) + "'>" + mPct + "% present</span>") + "</span>" +
        "<span class='show-pill' aria-hidden='true'></span></summary><div class='section-body syl-weeks'>" + body + "</div></details>";
    }).join("");
  }

  function _names(cls) {
    var sf = (Utils.el("as-status") || {}).value || "";
    return Data.allStudents().filter(function (s) { return s.cls === cls && Hourly.inGroup(s) && (!sf || s.status === sf); }).map(Utils.fullName);
  }
  function _rec(cls) {
    var D = Data.get(), sk = "attsheet|" + cls + "|" + _ym;
    if (!D.attsheets) D.attsheets = {};
    if (!D.attsheets[sk]) D.attsheets[sk] = {};
    return D.attsheets[sk];
  }

  // Click a box: P → A → blank. Marking a new day makes it the open one.
  function mark(cls, d, si) {
    var name = _names(cls)[si]; if (!name) return;
    var sheet = _rec(cls);
    if (!sheet[name]) sheet[name] = {};
    var cur = sheet[name][d] || "";
    sheet[name][d] = cur === "" ? "P" : cur === "P" ? "A" : "";
    _edit[cls] = d;
    Data.save(); render();
  }
  function edit(cls, d) { _edit[cls] = d; render(); }
  function done(cls) { delete _edit[cls]; render(); }
  function allPresent(cls, d) {
    var sheet = _rec(cls);
    _names(cls).forEach(function (n) { if (!sheet[n]) sheet[n] = {}; if (!sheet[n][d]) sheet[n][d] = "P"; });
    Data.save(); render();
  }
  function clearDay(cls, d) {
    Dialog.confirm("Clear attendance for " + d + " " + MONTHS[Number(_ym.split("-")[1]) - 1] + " (" + Utils.grade(cls) + ")?",
                   { okText: "Clear", danger: true }).then(function (ok) {
      if (!ok) return;
      var sheet = _rec(cls);
      Object.keys(sheet).forEach(function (n) { if (sheet[n]) { delete sheet[n][d]; delete sheet[n][String(d)]; } });
      delete _edit[cls];
      Data.save(); render();
    });
  }

  return { init: init, setClass: setClass, step: step, toggle: toggle, render: render,
           mark: mark, edit: edit, done: done, allPresent: allPresent, clearDay: clearDay };
})();
