// ================================================================
//  JS_Syllabus — Monthly Planner (chapter/time per day)
// ================================================================

var Syllabus = (function () {
  var _cls = "Grade XI";

  function init() {
    var sel  = Utils.el("syllabus-month");
    var ym   = Utils.curYm();
    var opts = Array.from(sel.options).map(function (o) { return o.value; });
    sel.value = opts.includes(ym) ? ym : "2026-03";
    setClass(_cls);
  }

  function setClass(cls) {
    _cls = cls;
    var sel = Utils.el("syl-grade");
    if (sel) sel.value = cls;
    render();
  }

  function render() {
    var ym  = Utils.el("syllabus-month").value; if (!ym) return;
    var sk  = _cls + "|" + ym;
    var lbl = Utils.el("syl-class-label");
    if (lbl) lbl.textContent = _cls + " \u2014 " + (ACYR_LBL[ym] || ym);
    _buildTable(sk, ym, Utils.el("syllabus-table-wrap"));
  }

  // ---- Decide if a day entry counts as "entered" ----
  function _isEntered(ent) {
    var hasChapter = ent.chapter && ent.chapter !== "-- None --";
    var hasStart   = ent.start   && ent.start   !== "--";
    var hasEnd     = ent.end     && ent.end     !== "--";
    return hasChapter || hasStart || hasEnd;
  }

  // ---- Apply / refresh the row class based on current entry state ----
  // Weekend rows ONLY get the "weekend" class — never syl-entered.
  // This guarantees orange always wins with zero CSS conflict.
  // Weekday rows get syl-entered (green) or syl-empty (muted).
  function _applyRowClass(row, ent, isWeekend) {
    row.classList.remove("syl-entered", "syl-empty", "weekend", "weekend-entered");
    if (isWeekend) {
      // Weekend: always orange regardless of whether data is entered
      row.classList.add("weekend");
      if (_isEntered(ent)) row.classList.add("weekend-entered");
    } else {
      // Weekday: green if entered, muted if empty
      row.classList.add(_isEntered(ent) ? "syl-entered" : "syl-empty");
    }
  }

  function _buildTable(storageKey, ym, wrapEl) {
    var parts = ym.split("-"); var year = Number(parts[0]); var month = Number(parts[1]);
    var dim   = new Date(year, month, 0).getDate();
    var D     = Data.get();
    if (!D.syllabus)              D.syllabus              = {};
    if (!D.syllabus[storageKey])  D.syllabus[storageKey]  = {};
    var saved = D.syllabus[storageKey];

    var table = document.createElement("table"); table.className = "syllabus-table";
    var thead = table.createTHead(); var hr = thead.insertRow();
    var cols   = ["Date", "Start Time", "Chapter / Topic", "End Time", "Notes"];
    var widths = ["100px", "110px", "", "110px", "130px"];
    cols.forEach(function (c, i) {
      var th = document.createElement("th"); th.textContent = c;
      if (widths[i]) th.style.width = widths[i]; hr.appendChild(th);
    });

    var tbody = table.createTBody();
    for (var d = 1; d <= dim; d++) {
      var di  = new Date(year, month - 1, d).getDay();
      var wk  = di === 0 || di === 6;
      // Read entry using both string and number key for compatibility
      var ent = saved[String(d)] || saved[d] || {};
      var row = tbody.insertRow();
      row.id  = "syl-row-" + d;
      _applyRowClass(row, ent, wk);

      // Date label
      var dc = row.insertCell();
      var sp = document.createElement("span"); sp.className = "day-label";
      sp.textContent = String(d).padStart(2, "0") + " " + MONTHS[month - 1].slice(0, 3) + " ";
      var daySpan = document.createElement("span"); daySpan.className = "day-name";
      daySpan.textContent = DAYS[di];
      sp.appendChild(daySpan); dc.appendChild(sp);

      // Start time
      var stc   = row.insertCell();
      var stSel = _makeSelect(TIMES, ent.start || "--", storageKey, d, "start");
      stSel.classList.add("time-input"); stc.appendChild(stSel);

      // Chapter
      var chc   = row.insertCell();
      var chSel = _makeSelect(Settings.chapters(_cls), ent.chapter || "-- None --", storageKey, d, "chapter");
      chSel.classList.add("chapter-input"); chc.appendChild(chSel);

      // End time
      var etc   = row.insertCell();
      var etSel = _makeSelect(TIMES, ent.end || "--", storageKey, d, "end");
      etSel.classList.add("time-input"); etc.appendChild(etSel);

      // Notes
      var nc  = row.insertCell();
      var inp = document.createElement("input"); inp.type = "text"; inp.className = "syllabus-input";
      inp.placeholder = "Notes..."; inp.value = ent.notes || "";
      inp.dataset.key = storageKey; inp.dataset.day = String(d); inp.dataset.field = "notes";
      inp.style.width = "100%";
      inp.addEventListener("input", _onChange);
      nc.appendChild(inp);
    }
    wrapEl.innerHTML = "";
    wrapEl.appendChild(table);
  }

  function _makeSelect(options, current, key, day, field) {
    var sel = document.createElement("select"); sel.className = "syllabus-input";
    sel.dataset.key = key; sel.dataset.day = String(day); sel.dataset.field = field;
    options.forEach(function (o) {
      var opt = document.createElement("option"); opt.value = o; opt.textContent = o;
      if (o === current) opt.selected = true; sel.appendChild(opt);
    });
    sel.addEventListener("change", _onChange);
    return sel;
  }

  function _onChange() {
    var D     = Data.get();
    var k     = this.dataset.key;
    var day   = String(this.dataset.day);
    var field = this.dataset.field;

    if (!D.syllabus)          D.syllabus          = {};
    if (!D.syllabus[k])       D.syllabus[k]       = {};
    if (!D.syllabus[k][day])  D.syllabus[k][day]  = {};
    D.syllabus[k][day][field] = this.value;
    Data.save();

    // Refresh the row colour immediately
    var row = document.getElementById("syl-row-" + day);
    if (row) {
      var ent = D.syllabus[k][day] || {};
      var isWeekend = row.classList.contains("weekend");
      _applyRowClass(row, ent, isWeekend);
    }
  }

  function save() {
    Data.save();
    Data.log("Saved Monthly Planner for " + _cls + " \u2014 " + (ACYR_LBL[Utils.el("syllabus-month").value] || ""));
  }

  return { init: init, setClass: setClass, render: render, save: save };
})();
