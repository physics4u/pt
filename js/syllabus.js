// ================================================================
//  syllabus.js — Monthly Planner (chapter and timing for each day)
//
//  Two collapsible sections, Plus 1 and Plus 2, closed when the page is
//  opened from the menu. Inside each, the month is split into weeks
//  (Mon–Sun); only the current week starts open. An entered day is
//  locked: hover it and press ✏ to change it (Clear appears then).
//  Empty days stay open for typing and lock once something is entered.
// ================================================================

var Syllabus = (function () {
  var CLASSES = [["Grade XI", "Plus 1"], ["Grade XII", "Plus 2"]];
  var _open = {};     // "Grade XI" → section open; "Grade XI|w2" → week open
  var _ym = null;     // month shown
  var _editing = {};  // "Grade XI|12" → day unlocked for editing

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  // Opening the planner from the menu: this month, sections closed
  function init() {
    var sel = Utils.el("syllabus-month");
    var ym = Utils.curYm();
    var opts = Array.from(sel.options).map(function (o) { return o.value; });
    sel.value = opts.includes(ym) ? ym : opts[0];
    _open = {}; _editing = {}; _ym = null;
    render();
  }
  // Open one class (kept for links into the planner)
  var _cls = "Grade XI";   // class chosen in the drop-down
  function setClass(cls) { _cls = cls; var sel = Utils.el("syl-grade"); if (sel) sel.value = cls; render(); }
  function step(n) {
    var sel = Utils.el("syllabus-month"), i = sel.selectedIndex + n;
    if (i < 0 || i >= sel.options.length) return;
    sel.selectedIndex = i; render();
  }
  function toggle(key, el) { _open[key] = el.open; }

  function _isEntered(ent) {
    return !!(ent && ((ent.chapter && ent.chapter !== "-- None --") || (ent.start && ent.start !== "--") || (ent.end && ent.end !== "--")));
  }
  function _hours(ent) {
    if (!ent) return 0;
    var a = Hourly.parseTime(ent.start), b = Hourly.parseTime(ent.end);
    return a === null || b === null || b <= a ? 0 : b - a;
  }
  function _store(cls, ym) {
    var D = Data.get();
    if (!D.syllabus) D.syllabus = {};
    return D.syllabus[cls + "|" + ym] || {};
  }

  // Weeks of the month, Monday to Sunday: [[1..7], [8..14], ...]
  function _weeks(year, month) {
    var dim = new Date(year, month, 0).getDate(), weeks = [], cur = [];
    for (var d = 1; d <= dim; d++) {
      cur.push(d);
      if (new Date(year, month - 1, d).getDay() === 0 || d === dim) { weeks.push(cur); cur = []; }
    }
    return weeks;
  }

  function render() {
    var ym = Utils.el("syllabus-month").value; if (!ym) return;
    var p = ym.split("-"), year = Number(p[0]), month = Number(p[1]);
    var weeks = _weeks(year, month);
    var now = ptToday().date, thisMonth = Utils.curYm() === ym;
    if (_ym !== ym) {                       // new month: open only the current week
      Object.keys(_open).forEach(function (k) { if (k.indexOf("|w") > 0) delete _open[k]; });
      _editing = {};
      _ym = ym;
      if (thisMonth) weeks.forEach(function (w, i) {
        if (w.indexOf(now.getDate()) >= 0) CLASSES.forEach(function (c) { _open[c[0] + "|w" + i] = true; });
      });
    }
    var mon = MONTHS[month - 1].slice(0, 3);

    Utils.el("syllabus-table-wrap").innerHTML = CLASSES.filter(function (c) { return c[0] === _cls; }).map(function (c) {
      var cls = c[0], saved = _store(cls, ym), chapters = Settings.chapters(cls);
      var days = 0, hrs = 0;
      var weekHtml = weeks.map(function (w, wi) {
        var wd = 0, wh = 0, chs = [];
        var rows = w.map(function (d) {
          var ent = saved[String(d)] || saved[d] || {};
          var di = new Date(year, month - 1, d).getDay(), wk = di === 0 || di === 6;
          var entered = _isEntered(ent), h = _hours(ent);
          if (entered) { wd++; wh += h; if (ent.chapter && ent.chapter !== "-- None --" && chs.indexOf(ent.chapter) < 0) chs.push(ent.chapter); }
          var isToday = thisMonth && d === now.getDate();
          var rowCls = (wk ? "weekend" + (entered ? " weekend-entered" : "") : entered ? "syl-entered" : "syl-empty") + (isToday ? " syl-today" : "");
          var date = "<td><span class='day-label'>" + Utils.fmtDate(year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0")) + " <span class='day-name'>" + DAYS[di] + "</span></span></td>";
          var key = cls + "|" + d;
          if (entered && !_editing[key]) {
            return "<tr class='" + rowCls + " locked' data-cls='" + cls + "' data-day='" + d + "'>" + date +
              "<td>" + _esc(ent.start && ent.start !== "--" ? ent.start : "—") + "</td>" +
              "<td>" + _esc(ent.chapter && ent.chapter !== "-- None --" ? ent.chapter : "—") + "</td>" +
              "<td>" + _esc(ent.end && ent.end !== "--" ? ent.end : "—") + "</td>" +
              "<td class='c'>" + (h ? Hourly.hm(h) : "—") + "</td>" +
              "<td class='muted'>" + _esc(ent.notes || "") + "</td>" +
              "<td class='edit-cell'>" + Utils.hoverEdit("Syllabus.unlock('" + cls + "'," + d + ")", "Change this day") + "</td></tr>";
          }
          var sel = function (opts, cur, field, c2) {
            return "<select class='syllabus-input " + c2 + "' data-field='" + field + "'>" + opts.map(function (o) {
              return "<option" + (o === cur ? " selected" : "") + ">" + _esc(o) + "</option>"; }).join("") + "</select>";
          };
          return "<tr class='" + rowCls + (_editing[key] ? " editing" : "") + "' data-cls='" + cls + "' data-day='" + d + "'>" + date +
            "<td>" + sel(TIMES, ent.start || "--", "start", "time-input") + "</td>" +
            "<td>" + sel(chapters, ent.chapter || "-- None --", "chapter", "chapter-input") + "</td>" +
            "<td>" + sel(TIMES, ent.end || "--", "end", "time-input") + "</td>" +
            "<td class='c syl-hrs'>" + (h ? Hourly.hm(h) : "") + "</td>" +
            "<td><input class='syllabus-input' data-field='notes' placeholder='Notes...' value='" + _esc(ent.notes || "") + "'></td>" +
            "<td class='edit-cell'>" + (_editing[key] ?
              "<button type='button' class='btn btn-secondary btn-sm' onclick='Syllabus.lock(\"" + cls + "\"," + d + ")'>Done</button> " +
              "<button type='button' class='btn btn-danger btn-sm' onclick='Syllabus.clearDay(\"" + cls + "\"," + d + ")'>Clear</button>" : "") +
            "</td></tr>";
        }).join("");
        days += wd; hrs += wh;
        var wkey = cls + "|w" + wi;
        var label = "Week " + (wi + 1) + " <span class='muted' style='font-weight:500'>" + Utils.fmtDate(year + "-" + String(month).padStart(2, "0") + "-" + String(w[0]).padStart(2, "0")) + (w.length > 1 ? " – " + Utils.fmtDate(year + "-" + String(month).padStart(2, "0") + "-" + String(w[w.length - 1]).padStart(2, "0")) : "") + "</span>";
        var meta = wd ? wd + " day" + (wd === 1 ? "" : "s") + " &middot; " + Hourly.hm(wh) + " hrs" +
                        (chs.length ? " &middot; <span class='syl-chs'>" + _esc(chs.join(", ")) + "</span>" : "")
                      : "no classes yet";
        return "<details class='section syl-week'" + (_open[wkey] ? " open" : "") + " ontoggle='Syllabus.toggle(\"" + wkey + "\", this)'>" +
          "<summary><span class='section-title'>" + label + "</span><span class='section-meta'>&middot; " + meta + "</span>" +
          (thisMonth && w.indexOf(now.getDate()) >= 0 ? "<span class='chip chip-gold' style='margin-left:6px'>This week</span>" : "") +
          "<span class='show-pill' aria-hidden='true'></span></summary>" +
          "<div class='section-body' style='padding:0'><div style='overflow-x:auto'><table class='syllabus-table'><thead><tr>" +
          "<th style='width:110px'>Date</th><th style='width:120px'>Start time</th><th>Chapter / Topic</th><th style='width:120px'>End time</th>" +
          "<th class='c' style='width:60px'>Hours</th><th style='width:160px'>Notes</th><th style='width:120px'></th></tr></thead><tbody>" + rows +
          "</tbody></table></div></div></details>";
      }).join("");
      return "<div class='month-sum'><b>" + c[1] + " &middot; " + MONTHS[month - 1] + " " + year + "</b> &middot; " +
        days + " class day" + (days === 1 ? "" : "s") + " &middot; " + Hourly.hm(hrs) + " hrs</div>" +
        "<div class='syl-class syl-weeks'>" + weekHtml + "</div>";
    }).join("");
    _wire();
  }

  function _wire() {
    var wrap = Utils.el("syllabus-table-wrap");
    wrap.querySelectorAll("tr[data-day] .syllabus-input").forEach(function (el) {
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", _onChange);
    });
    // An empty day locks once something is entered and you move to another row
    wrap.querySelectorAll("tr[data-day]:not(.locked)").forEach(function (tr) {
      tr.addEventListener("focusout", function (e) {
        if (e.relatedTarget && tr.contains(e.relatedTarget)) return;
        var cls = tr.dataset.cls, d = tr.dataset.day;
        if (_editing[cls + "|" + d]) return;            // being edited: stays open until Done
        var ent = _store(cls, _ym)[d];
        if (!_isEntered(ent)) return;
        var to = e.relatedTarget, tr2 = to && to.closest && to.closest("tr[data-day]");
        var back = tr2 ? { cls: tr2.dataset.cls, day: tr2.dataset.day, field: to.dataset.field } : null;
        render();
        if (back) {                                     // keep the cursor where it was going
          var el = Utils.el("syllabus-table-wrap").querySelector("tr[data-cls='" + back.cls + "'][data-day='" + back.day + "'] [data-field='" + back.field + "']");
          if (el) el.focus();
        }
      });
    });
  }

  function _onChange() {
    var tr = this.closest("tr"), cls = tr.dataset.cls, day = String(tr.dataset.day), field = this.dataset.field;
    var D = Data.get(), k = cls + "|" + _ym;
    if (!D.syllabus) D.syllabus = {};
    if (!D.syllabus[k]) D.syllabus[k] = {};
    if (!D.syllabus[k][day]) D.syllabus[k][day] = {};
    D.syllabus[k][day][field] = this.value;
    Data.save();
    var ent = D.syllabus[k][day], h = _hours(ent);
    tr.querySelector(".syl-hrs").textContent = h ? Hourly.hm(h) : "";
    var wk = tr.classList.contains("weekend");
    tr.classList.remove("syl-entered", "syl-empty", "weekend-entered");
    if (wk) { if (_isEntered(ent)) tr.classList.add("weekend-entered"); }
    else tr.classList.add(_isEntered(ent) ? "syl-entered" : "syl-empty");
  }

  function unlock(cls, d) { _editing[cls + "|" + d] = true; render(); }
  function lock(cls, d) { delete _editing[cls + "|" + d]; render(); }
  function clearDay(cls, d) {
    Dialog.confirm("Clear " + Utils.fmtDate(_ym + "-" + String(d).padStart(2, "0")) + " for " + Utils.grade(cls) + "? Its times, chapter and notes will be removed.",
                   { okText: "Clear", danger: true }).then(function (ok) {
      if (!ok) return;
      var D = Data.get(), k = cls + "|" + _ym;
      if (D.syllabus && D.syllabus[k]) { delete D.syllabus[k][String(d)]; delete D.syllabus[k][d]; }
      delete _editing[cls + "|" + d];
      Data.save(); render();
    });
  }

  return { init: init, setClass: setClass, step: step, toggle: toggle, render: render,
           unlock: unlock, lock: lock, clearDay: clearDay };
})();
