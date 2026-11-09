// ================================================================
//  scores.js — Scores: class tests and mark sheets.
//
//  A test belongs to a class (Plus 1 / Plus 2) — or, for hourly
//  students, to one student ("one-to-one test"). It has a number
//  ("Test 3"), date, portions and marks out of. Each student's mark is
//  a row in D.scores linked to the test by `test` (the row also keeps
//  date/portions/out-of so the profile report card can show it).
//
//  Page:  list of tests per class  →  ✏ Marks  →  mark sheet
// ================================================================
var Scores = (function () {
  var _view = null;        // id of the test whose mark sheet is open
  var _editTest = null;    // id of the test being edited in the form

  // ---------- data ----------
  function _id() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function _num(t) { var m = /(\d+)/.exec(t.num || ""); return m ? Number(m[1]) : 0; }
  function _byStudent() {
    // the same name can be in PT once per year: the year on screen wins
    var m = {}; Data.get().students.forEach(function (s) { m[Utils.fullName(s)] = s; });
    Data.allStudents().forEach(function (s) { m[Utils.fullName(s)] = s; });
    return m;
  }

  // Organise older score rows (one row per student, no test list) into tests:
  // rows with the same class, test name, date, portions and out-of are one
  // test. A test taken only by hourly students is a one-to-one test.
  function ensure() {
    var D = Data.get();
    if (!D.tests) D.tests = [];
    if (!D.scores) D.scores = [];
    var loose = D.scores.filter(function (r) { return !r.test || !D.tests.some(function (t) { return t.id === r.test; }); });
    if (!loose.length) return;
    var who = _byStudent(), groups = {}, order = [];
    loose.forEach(function (r) {
      var k = [r.cls, r.remarks || r.title, r.date, r.title, r.total].join("|");
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });
    order.forEach(function (k) {
      var rows = groups[k], first = rows[0];
      var oneToOne = rows.every(function (r) { var s = who[r.student]; return s && Hourly.isHourly(s); });
      (oneToOne ? rows.map(function (r) { return [r]; }) : [rows]).forEach(function (set) {
        var t = { id: _id(), cls: first.cls, num: first.remarks || "Test", date: first.date, title: first.title,
                  total: String(first.total || ""), kind: oneToOne ? "one" : "class", student: oneToOne ? set[0].student : "" };
        D.tests.push(t);
        set.forEach(function (r) { r.test = t.id; r.type = oneToOne ? "One-to-one test" : "Test"; });
      });
    });
    Data.save();
  }

  function testOf(id) { return Data.get().tests.filter(function (t) { return t.id === id; })[0]; }
  function marksOf(id) { return Data.get().scores.filter(function (r) { return r.test === id; }); }

  function stats(t) {
    var rows = marksOf(t.id), total = Number(t.total) || 0;
    if (!rows.length || !total) return { taken: rows.length, avg: null, top: null };
    var sum = 0, top = 0;
    rows.forEach(function (r) { var v = Number(r.score) || 0; sum += v; top = Math.max(top, v); });
    return { taken: rows.length, avg: sum / rows.length / total * 100, top: top };
  }

  function fmtDate(d) {
    if (!d) return "—";
    var x = new Date(d + "T00:00:00");
    return isNaN(x) ? d : x.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }
  function pctTxt(v) { return v === null || isNaN(v) ? "—" : Math.round(v) + "%"; }
  function mk(v) { return v === null ? "—" : (Math.round(v * 100) / 100).toString(); }

  // ---------- list view ----------
  // Opening Scores from the menu: list view, every section collapsed.
  function show() { _view = null; _open = {}; render(); }
  // "← All tests" from a mark sheet keeps the sections as they were.
  function back() { _view = null; render(); }
  function showInactive(on) { Utils.setShowAll(on); }

  // Which sections are open (kept while moving around PT)
  var _open = {};               // all sections start collapsed when Scores is opened
  function toggle(key, el) { _open[key] = el.open; }

  function render() {
    ensure();
    var box = Utils.el("scores-view");
    if (_view && testOf(_view)) { box.innerHTML = _sheetHtml(testOf(_view)); _wireSheet(); return; }
    _view = null;
    Utils.el("page-title").textContent = "Scores";
    var D = Data.get();

    var section = function (key, title, tests, head, row) {
      return "<details class='section tests-section'" + (_open[key] ? " open" : "") +
        " ontoggle='Scores.toggle(\"" + key + "\", this)'><summary><span class='section-title'>" + title +
        "</span><span class='section-meta'>&middot; " + tests.length + " test" + (tests.length === 1 ? "" : "s") +
        "</span><span class='show-pill' aria-hidden='true'></span></summary><div class='section-body' style='padding:0'>" +
        "<div style='overflow-x:auto'><table class='tests-table'><thead><tr>" + head + "</tr></thead><tbody>" +
        (tests.length ? tests.map(function (t, i) { return row(t, i); }).join("") : "<tr><td colspan='10' class='muted'>No tests yet. Use <b>+ Add test</b>.</td></tr>") +
        "</tbody></table></div></div></details>";
    };
    var marksBtn = function (t) {
      return "<td class='c'><button class='btn btn-secondary btn-sm' onclick='Scores.open(\"" + t.id + "\")'>&#9998; Marks</button></td>";
    };

    var classHead = "<th class='num'>#</th><th>Test #</th><th>Date</th><th class='portions'>Portions</th><th class='c'>Out of</th><th class='c'>Average</th>" +
                    "<th class='c'>Top</th><th class='c'>Took</th><th></th>";
    var classRow = function (t, i) {
      var st = stats(t);
      return "<tr><td class='num'>" + (i + 1) + "</td><td><b>" + _esc(t.num) + "</b></td><td>" + fmtDate(t.date) + "</td><td>" + _esc(t.title) + "</td>" +
        "<td class='c'>" + _esc(t.total) + "</td><td class='c'>" + pctTxt(st.avg) + "</td><td class='c'>" + mk(st.top) + "</td>" +
        "<td class='c muted'>" + st.taken + "</td>" + marksBtn(t) + "</tr>";
    };
    var oneHead = "<th class='num'>#</th><th>Student</th><th>Test #</th><th>Date</th><th class='portions'>Portions</th><th class='c'>Marks</th><th class='c'>%</th><th></th>";
    var oneRow = function (t, i) {
      var r = marksOf(t.id)[0], total = Number(t.total) || 0;
      return "<tr><td class='num'>" + (i + 1) + "</td><td><b>" + Utils.studentLink(t.student) + "</b></td><td>" + _esc(t.num) + "</td><td>" + fmtDate(t.date) + "</td><td>" + _esc(t.title) + "</td>" +
        "<td class='c'>" + (r ? mk(Number(r.score)) + " / " + _esc(t.total) : "\u2014") + "</td>" +
        "<td class='c'>" + (r && total ? Math.round(Number(r.score) / total * 100) + "%" : "\u2014") + "</td>" + marksBtn(t) + "</tr>";
    };
    var classTests = function (cls) {
      return D.tests.filter(function (t) { return t.kind !== "one" && t.cls === cls && _inYear(t); })
        .sort(function (a, b) { return _num(a) - _num(b) || String(a.date).localeCompare(b.date); });
    };
    var oneTests = function (cls) {
      return D.tests.filter(function (t) { return t.kind === "one" && t.cls === cls && _inYear(t); })
        .sort(function (a, b) { return String(a.student).localeCompare(b.student) || String(a.date).localeCompare(b.date); });
    };
    box.innerHTML =
      section("Grade XI", "Plus 1", classTests("Grade XI"), classHead, classRow) +
      section("Grade XII", "Plus 2", classTests("Grade XII"), classHead, classRow) +
      section("one|Grade XI", "Hourly (Plus 1)", oneTests("Grade XI"), oneHead, oneRow) +
      section("one|Grade XII", "Hourly (Plus 2)", oneTests("Grade XII"), oneHead, oneRow);
  }

  // ---------- mark sheet ----------
  function open(id) { _view = id; _detailsEdit = false; render(); window.scrollTo(0, 0); }
  // Test details are locked until ✏ is pressed; Delete appears only then.
  var _detailsEdit = false;
  function editDetails(on) { _detailsEdit = !!on; render(); if (on && Utils.el("te-num")) Utils.el("te-num").focus(); }

  // Everyone in the class (active or not), plus anyone already marked.
  function _students(t) {
    if (t.kind === "one") return [t.student];
    var names = {}, order = Data.allStudents().map(Utils.fullName);
    Data.allStudents().forEach(function (s) {
      if (Utils.clsOf(s) === t.cls && Hourly.inGroup(s)) names[Utils.fullName(s)] = true;
    });
    marksOf(t.id).forEach(function (r) { names[r.student] = true; });
    if (!Utils.showAll()) Object.keys(names).forEach(function (n) { if (!_isActive(n)) delete names[n]; });
    return Object.keys(names).sort(function (a, b) {
      var i = order.indexOf(a), j = order.indexOf(b);
      return (i < 0 ? 1e6 : i) - (j < 0 ? 1e6 : j) || a.localeCompare(b);
    });
  }

  function _hiddenNote(t) {
    if (t.kind === "one") return "";
    var n = 0;
    Data.allStudents().forEach(function (s) {
      if (Utils.clsOf(s) === t.cls && Hourly.inGroup(s) && !_isActive(Utils.fullName(s))) n++;
    });
    return n ? " <span class='muted'>(" + n + " hidden)</span>" : "";
  }

  function _isActive(name) { return Utils.isActive(_byStudent()[name]); }
  // Tests dated in the academic year shown (undated tests show in every year)
  function _inYear(t) { return !t.date || (t.date >= acadFirstDay() && t.date <= acadLastDay()); }

  function _headerHtml(t) {
    var s = stats(t), listed = _students(t), n = listed.length;
    var took = marksOf(t.id).filter(function (r) { return listed.indexOf(r.student) >= 0; }).length;
    return "<div class='sheet-stat'><span>Marks out of</span><b>" + _esc(t.total || "—") + "</b></div>" +
      "<div class='sheet-stat'><span>" + (t.kind === "one" ? "Marks" : "Class top") + "</span><b>" + mk(s.top) + "</b></div>" +
      "<div class='sheet-stat'><span>Average</span><b>" + pctTxt(s.avg) + "</b></div>" +
      "<div class='sheet-stat'><span>Took the test</span><b>" + took + " of " + n + "</b></div>";
  }

  function _sheetHtml(t) {
    Utils.el("page-title").textContent = Utils.grade(t.cls) + " · " + (t.num || "Test");
    var byName = {}; marksOf(t.id).forEach(function (r) { byName[r.student] = r; });
    var total = Number(t.total) || 0;
    // Once a test has marks, every row is locked: a blank row means the student
    // didn't take it. Edit (on hover) opens a row. A new test starts open for typing.
    var started = marksOf(t.id).length > 0;
    var rows = _students(t).map(function (name, i) {
      var r = byName[name], v = r ? r.score : "", lock = !!r || !_isActive(name) || started;
      return "<tr" + (lock ? " class='locked'" : "") + "><td class='num'>" + (i + 1) + "</td><td>" + Utils.studentLink(name) +
        (_isActive(name) ? "" : " <span class='muted small'>inactive</span>") + "</td>" +
        "<td class='c'><input class='mark-in' type='number' step='0.5' min='0' data-name='" + _esc(name) + "' value='" + _esc(v) +
          "' placeholder='---'" + (lock ? " readonly tabindex='-1'" : "") + "></td>" +
        "<td class='c mark-pct'>" + (r && total ? Math.round(Number(v) / total * 100) + "%" : "---") + "</td>" +
        "<td class='c edit-cell'>" + (lock ? "<button type='button' class='row-edit' title='Change this mark' onclick='Scores.unlock(this)'>&#9998; Edit</button>" : "") + "</td></tr>";
    }).join("");
    var dis = _detailsEdit ? "" : " disabled";
    var chapters = Settings.chapters(t.cls).slice(1).map(function (c) { return "<option value='" + _esc(c) + "'>"; }).join("");
    return "<div class='sheet-head panel'>" +
        "<div class='sheet-title'><button class='btn btn-secondary btn-sm' onclick='Scores.back()'>&#8592; All tests</button>" +
        "<div><div class='sheet-name'>" + Utils.grade(t.cls) + " · " + _esc(t.num) + (t.kind === "one" ? " · " + _esc(t.student) : "") + "</div>" +
        "<div class='muted'>Portions: <b style='color:var(--text)'>" + _esc(t.title || "—") + "</b> · " + fmtDate(t.date) + "</div></div></div>" +
        "<div class='sheet-stats' id='sheet-stats'>" + _headerHtml(t) + "</div></div>" +
      "<div class='sheet-body'>" +
        "<div class='panel'><div class='panel-header'><span class='panel-title'>Students' mark sheet</span><label class='check inactive-toggle show-all-toggle'><input type='checkbox' onchange='Utils.setShowAll(this.checked)'" + (Utils.showAll() ? " checked" : "") + "> Show inactive students" + (Utils.showAll() ? "" : _hiddenNote(t)) + "</label></div>" +
          "<div class='sheet-hint muted'>Marks save automatically. Hover a row and press <b>Edit</b> to change a mark or add one later.</div>" +
          "<table class='tests-table mark-table'><thead><tr><th class='num'>#</th><th>Name of student</th><th class='c'>Marks obtained</th><th class='c'>Marks (%)</th><th></th></tr></thead>" +
          "<tbody>" + (rows || "<tr><td colspan='5' class='muted'>No students in this class.</td></tr>") + "</tbody></table></div>" +
        "<div class='panel sheet-edit" + (_detailsEdit ? " editing" : " locked") + "'><div class='panel-header'><span class='panel-title'>Test details" +
          (_detailsEdit ? "" : " <button type='button' class='row-edit' title='Edit test details' onclick='Scores.editDetails(true)'>&#9998;</button>") + "</span>" +
          (_detailsEdit ? "<button type='button' class='btn btn-secondary btn-sm' onclick='Scores.editDetails(false)'>Done</button>" : "") + "</div><div style='padding:12px 16px'>" +
          "<div class='form-row'><label>Test #</label><input id='te-num' value='" + _esc(t.num) + "'" + dis + "></div>" +
          "<div class='form-row'><label>Date</label><input id='te-date' type='date' value='" + _esc(t.date) + "'" + dis + "></div>" +
          "<div class='form-row'><label>Portions</label><input id='te-title' list='te-chapters' value='" + _esc(t.title) + "'" + dis + "><datalist id='te-chapters'>" + chapters + "</datalist></div>" +
          "<div class='form-row'><label>Marks out of</label><input id='te-total' type='number' min='1' value='" + _esc(t.total) + "'" + dis + "></div>" +
          (_detailsEdit ? "<div class='danger-zone'><button type='button' class='btn btn-danger btn-sm' onclick='Scores.delTest(\"" + t.id + "\")'>Delete this test</button></div>" : "") +
        "</div></div>" +
      "</div>";
  }

  function _wireSheet() {
    var t = testOf(_view);
    document.querySelectorAll(".mark-in").forEach(function (inp) {
      inp.addEventListener("change", function () { setMark(t.id, inp.dataset.name, inp.value, inp); });
      inp.addEventListener("blur", function () { if (inp.value !== "" || !_isActive(inp.dataset.name)) _lock(inp); });
      inp.addEventListener("keydown", function (e) {           // Enter → next student still to mark
        if (e.key !== "Enter") return;
        e.preventDefault();
        var all = Array.prototype.slice.call(document.querySelectorAll(".mark-in")), i = all.indexOf(inp);
        var next = all.slice(i + 1).filter(function (x) { return !x.readOnly; })[0];
        inp.blur();
        if (next) next.focus();
      });
    });
    ["te-num", "te-date", "te-title", "te-total"].forEach(function (id) {
      Utils.el(id).addEventListener("change", function () { _saveDetails(t.id); });
    });
  }

  // A row with a mark is locked; its Edit button (shown on hover) unlocks it.
  function _lock(inp) {
    var tr = inp.closest("tr");
    inp.readOnly = true; inp.tabIndex = -1; tr.classList.add("locked"); tr.classList.remove("editing");
    var cell = tr.querySelector(".edit-cell");
    if (cell && !cell.querySelector(".row-edit"))
      cell.innerHTML = "<button type='button' class='row-edit' title='Change this mark' onclick='Scores.unlock(this)'>&#9998; Edit</button>";
  }
  function unlock(btn) {
    var tr = btn.closest("tr"), inp = tr.querySelector(".mark-in");
    inp.readOnly = false; inp.tabIndex = 0; tr.classList.remove("locked"); tr.classList.add("editing");
    inp.focus(); inp.select();
  }

  function setMark(id, name, value, inp) {
    var t = testOf(id), D = Data.get(), total = Number(t.total) || 0;
    var rows = D.scores, idx = -1;
    rows.forEach(function (r, i) { if (r.test === id && r.student === name) idx = i; });
    value = String(value).trim();
    if (value === "") { if (idx >= 0) rows.splice(idx, 1); }
    else {
      var v = Number(value);
      if (isNaN(v) || v < 0 || (total && v > total)) {
        Dialog.alert("Marks for " + name + " must be between 0 and " + (total || "the marks out of") + ".");
        inp.value = idx >= 0 ? rows[idx].score : ""; return;
      }
      var row = { student: name, cls: t.cls, type: t.kind === "one" ? "One-to-one test" : "Test", date: t.date,
                  title: t.title, score: v, total: total, remarks: t.num, test: id };
      if (idx >= 0) rows[idx] = row; else rows.push(row);
    }
    Data.save();
    if (value !== "" || !_isActive(name)) _lock(inp); else { var ec = inp.closest("tr").querySelector(".edit-cell"); if (ec) ec.innerHTML = ""; inp.closest("tr").classList.remove("locked", "editing"); }
    var cell = inp.closest("tr").querySelector(".mark-pct");
    cell.textContent = value !== "" && total ? Math.round(Number(value) / total * 100) + "%" : "---";
    Utils.el("sheet-stats").innerHTML = _headerHtml(t);
  }

  function _saveDetails(id) {
    var t = testOf(id);
    var total = Utils.el("te-total").value.trim();
    var max = 0; marksOf(id).forEach(function (r) { max = Math.max(max, Number(r.score) || 0); });
    if (total !== "" && Number(total) < max) {
      Dialog.alert("Marks out of can't be less than a mark already entered (" + max + ").");
      Utils.el("te-total").value = t.total; return;
    }
    t.num = Utils.el("te-num").value.trim() || t.num;
    t.date = Utils.el("te-date").value; t.title = Utils.el("te-title").value.trim(); t.total = total;
    marksOf(id).forEach(function (r) { r.date = t.date; r.title = t.title; r.total = Number(t.total) || r.total; r.remarks = t.num; });
    Data.save();
    var keep = document.activeElement && document.activeElement.id;
    render();
    if (keep && Utils.el(keep)) Utils.el(keep).focus();
  }

  function delTest(id) {
    var t = testOf(id), n = marksOf(id).length;
    Dialog.confirm("Delete " + Utils.grade(t.cls) + " " + t.num + (t.title ? " (" + t.title + ")" : "") + "?" +
                   (n ? " Its " + n + " marks will be deleted too." : ""), { okText: "Delete", danger: true }).then(function (ok) {
      if (!ok) return;
      var D = Data.get();
      D.tests = D.tests.filter(function (x) { return x.id !== id; });
      D.scores = D.scores.filter(function (r) { return r.test !== id; });
      Data.log("Deleted " + Utils.grade(t.cls) + " <b>" + _esc(t.num) + "</b>");
      Data.save(); show();
    });
  }

  // ---------- add a test ----------
  function openModal() {
    ensure();
    var cls = Utils.el("tm-class").value || "Grade XI";
    _fillModal(cls);
    Utils.el("tm-date").value = Utils.todayIso();
    Utils.el("tm-title").value = ""; Utils.el("tm-total").value = "";
    Utils.openModal("modal-test");
  }
  function _nextNum(cls, student) {
    var n = 0;
    Data.get().tests.forEach(function (t) {
      if (_inYear(t) && t.cls === cls && (student ? t.student === student : t.kind !== "one")) n = Math.max(n, _num(t));
    });
    return "Test " + (n + 1);
  }
  function _fillModal(cls) {
    var hourly = Data.allStudents().filter(function (s) { return Utils.clsOf(s) === cls && Hourly.isHourly(s) && Utils.isActive(s); });
    var who = Utils.el("tm-who");
    who.innerHTML = "<option value=''>The whole class</option>" + hourly.map(function (s) {
      var n = Utils.fullName(s); return "<option value='" + _esc(n) + "'>One-to-one: " + _esc(n) + "</option>"; }).join("");
    Utils.el("tm-num").value = _nextNum(cls, "");
    Utils.el("tm-chapters").innerHTML = Settings.chapters(cls).slice(1).map(function (c) { return "<option value='" + _esc(c) + "'>"; }).join("");
  }
  function modalClass() { _fillModal(Utils.el("tm-class").value); }
  function modalWho() { Utils.el("tm-num").value = _nextNum(Utils.el("tm-class").value, Utils.el("tm-who").value); }

  function saveTest() {
    var cls = Utils.el("tm-class").value, who = Utils.el("tm-who").value;
    var t = { id: _id(), cls: cls, num: Utils.el("tm-num").value.trim() || _nextNum(cls, who), date: Utils.el("tm-date").value,
              title: Utils.el("tm-title").value.trim(), total: Utils.el("tm-total").value.trim(),
              kind: who ? "one" : "class", student: who };
    if (!(Number(t.total) > 0)) { Dialog.alert("Enter the marks the test is out of."); return; }
    Data.get().tests.push(t);
    Data.log("Added " + Utils.grade(cls) + " <b>" + _esc(t.num) + "</b>" + (t.title ? " — " + _esc(t.title) : ""));
    Data.save();
    Utils.closeModal("modal-test");
    showPage("scores");
    open(t.id);
  }

  return { render: render, show: show, back: back, showInactive: showInactive, open: open, editDetails: editDetails, toggle: toggle, unlock: unlock, openModal: openModal, saveTest: saveTest,
           modalClass: modalClass, modalWho: modalWho, delTest: delTest, ensure: ensure };
})();
