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
  var _cls = "Grade XI";   // class chosen in the drop-down
  function setClass(cls) { _cls = cls; var sel = Utils.el("as-grade"); if (sel) sel.value = cls; render(); }
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
    var dim = new Date(year, month, 0).getDate(), now = ptToday().date, thisMonth = Utils.curYm() === ym;
    if (_ym !== ym) { _edit = {}; _ym = ym; }
    var mon = MONTHS[month - 1].slice(0, 3);
    var cls = _cls, title = Utils.grade(cls), sheet = _sheet(cls);
    var names = Data.allStudents().filter(function (s) { return s.cls === cls && Hourly.inGroup(s) && Utils.shown(s); }).map(Utils.fullName);
    var wrap = Utils.el("attsheet-wrap");
    if (!names.length) {
      wrap.innerHTML = "<div class='empty'><div class='empty-text'>No students in " + title + ".</div></div>"; return;
    }
    var days = []; for (var d = 1; d <= dim; d++) days.push(d);
    var marked = {}, classDays = 0;
    days.forEach(function (d) { marked[d] = _marked(sheet, names, d); if (marked[d]) classDays++; });
    var editing = _edit[cls] || null;

    var head = "<tr><th class='num'>#</th><th class='name-col'>Name</th>" + days.map(function (d) {
      var di = new Date(year, month - 1, d).getDay(), wk = di === 0 || di === 6;
      var locked = marked[d] && editing !== d;
      return "<th class='day-col" + (wk ? " weekend-col" : "") + (di === 1 ? " wk-start" : "") + (editing === d ? " editing" : "") +
        (locked ? " locked" : "") + (thisMonth && d === now.getDate() ? " today" : "") +
        "' title='" + d + " " + MONTHS[month - 1] + " (" + DAYS[di] + ")'>" + d + "<br><span class='dn'>" + DAYS[di].slice(0, 2) + "</span>" +
        (locked ? Utils.hoverEdit("Attendance.edit('" + cls + "'," + d + ")", "Change this day") : "") + "</th>";
    }).join("") + "<th class='sum' style='color:var(--accent3)'>P</th><th class='sum' style='color:var(--danger)'>A</th><th class='sum'>%</th></tr>";

    var allP = 0, allA = 0;
    var rows = names.map(function (n, si) {
      var rp = 0, ra = 0;
      var cells = days.map(function (d) {
        var di = new Date(year, month - 1, d).getDay(), wk = di === 0 || di === 6;
        var v = (sheet[n] || {})[d] || "";
        if (v === "P") rp++; if (v === "A") ra++;
        var locked = marked[d] && editing !== d;
        var cl = "as-btn-p" + (v === "P" ? " active-p" : v === "A" ? " active-a" : "");
        return "<td class='" + (wk ? "weekend-col" : "") + (di === 1 ? " wk-start" : "") + (editing === d ? " editing" : "") + "'>" + (locked
          ? "<span class='" + cl + " lockd'>" + (v || "–") + "</span>"
          : "<button class='" + cl + "' onclick='Attendance.mark(\"" + cls + "\"," + d + "," + si + ")'>" + (v || "--") + "</button>") + "</td>";
      }).join("");
      allP += rp; allA += ra;
      var t = rp + ra, pct = t ? Math.round(rp / t * 100) : null;
      return "<tr><td class='num'>" + (si + 1) + "</td><td class='name-col'>" + Utils.studentLink(n) + "</td>" + cells +
        "<td class='sum' style='color:var(--accent3)'>" + rp + "</td><td class='sum' style='color:var(--danger)'>" + ra + "</td>" +
        "<td class='sum' style='color:" + _pctCol(pct) + "'>" + (pct === null ? "--" : pct + "%") + "</td></tr>";
    }).join("");
    var foot = "<tr class='as-summary-row'><td></td><td class='name-col'>Present</td>" + days.map(function (d) {
      var c = names.filter(function (x) { return (sheet[x] || {})[d] === "P"; }).length;
      return "<td class='" + (new Date(year, month - 1, d).getDay() === 1 ? "wk-start" : "") + "' style='color:var(--accent3)'>" + (c || "--") + "</td>";
    }).join("") + "<td></td><td></td><td></td></tr>";

    var mPct = allP + allA ? Math.round(allP / (allP + allA) * 100) : null;
    var bar = editing ? "<div class='as-editbar'><span>Marking <b>" + editing + " " + mon + "</b>: click a box for P → A → blank.</span>" +
        "<button class='btn btn-secondary btn-sm' onclick='Attendance.allPresent(\"" + cls + "\"," + editing + ")'>Mark everyone present</button>" +
        (marked[editing] ? "<button class='btn btn-danger btn-sm' onclick='Attendance.clearDay(\"" + cls + "\"," + editing + ")'>Clear day</button>" : "") +
        "<button class='btn btn-primary btn-sm' onclick='Attendance.done(\"" + cls + "\")'>Done</button></div>"
      : "<div class='as-hint muted'>Click a box on a new day to start marking it. Marked days are locked: hover over the date and press &#9998; to change one.</div>";
    wrap.innerHTML =
      "<div class='month-sum'><b>" + title + " &middot; " + MONTHS[month - 1] + " " + year + "</b> &middot; " + names.length + " students &middot; " +
        classDays + " class day" + (classDays === 1 ? "" : "s") +
        (mPct === null ? "" : " &middot; <span style='color:" + _pctCol(mPct) + "'>" + mPct + "% present</span>") + "</div>" +
      "<div class='panel as-month'>" + bar + "<div style='overflow-x:auto'><table class='as-table as-week as-full'><thead>" + head + "</thead><tbody>" +
        rows + foot + "</tbody></table></div></div>";
  }

  function _names(cls) {
    return Data.allStudents().filter(function (s) { return s.cls === cls && Hourly.inGroup(s) && Utils.shown(s); }).map(Utils.fullName);
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
