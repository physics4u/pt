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
    var m = {}; Data.get().students.forEach(function (s) { m[Utils.fullName(s)] = s; }); return m;
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
  function show() { _view = null; render(); }

  function render() {
    ensure();
    var box = Utils.el("scores-view");
    if (_view && testOf(_view)) { box.innerHTML = _sheetHtml(testOf(_view)); _wireSheet(); return; }
    _view = null;
    Utils.el("page-title").textContent = "Scores";
    var D = Data.get();
    var panel = function (cls) {
      var tests = D.tests.filter(function (t) { return t.kind !== "one" && t.cls === cls; })
        .sort(function (a, b) { return _num(a) - _num(b) || String(a.date).localeCompare(b.date); });
      var rows = tests.map(function (t) {
        var s = stats(t);
        return "<tr><td><b>" + _esc(t.num) + "</b></td><td>" + fmtDate(t.date) + "</td><td>" + _esc(t.title) + "</td>" +
          "<td class='c'>" + _esc(t.total) + "</td><td class='c'>" + pctTxt(s.avg) + "</td><td class='c'>" + mk(s.top) + "</td>" +
          "<td class='c muted'>" + s.taken + "</td>" +
          "<td class='c'><button class='btn btn-secondary btn-sm' onclick='Scores.open(\"" + t.id + "\")'>&#9998; Marks</button></td></tr>";
      }).join("");
      return "<div class='panel tests-panel'><div class='panel-header'><span class='panel-title'>" + Utils.grade(cls) +
        "</span><span class='muted'>" + tests.length + " tests</span></div>" +
        "<div style='overflow-x:auto'><table class='tests-table'><thead><tr><th>Test #</th><th>Date</th><th>Portions</th>" +
        "<th class='c'>Out of</th><th class='c'>Average</th><th class='c'>Top</th><th class='c'>Took</th><th></th></tr></thead><tbody>" +
        (rows || "<tr><td colspan='8' class='muted'>No tests yet. Use <b>+ Add test</b>.</td></tr>") + "</tbody></table></div></div>";
    };
    var ones = D.tests.filter(function (t) { return t.kind === "one"; })
      .sort(function (a, b) { return String(a.student).localeCompare(b.student) || String(a.date).localeCompare(b.date); });
    var oneRows = ones.map(function (t) {
      var r = marksOf(t.id)[0], total = Number(t.total) || 0;
      return "<tr><td><b>" + _esc(t.student) + "</b></td><td>" + _esc(t.num) + "</td><td>" + fmtDate(t.date) + "</td><td>" + _esc(t.title) + "</td>" +
        "<td class='c'>" + (r ? mk(Number(r.score)) + " / " + _esc(t.total) : "—") + "</td>" +
        "<td class='c'>" + (r && total ? Math.round(Number(r.score) / total * 100) + "%" : "—") + "</td>" +
        "<td class='c'><button class='btn btn-secondary btn-sm' onclick='Scores.open(\"" + t.id + "\")'>&#9998; Marks</button></td></tr>";
    }).join("");
    Utils.el("scores-view").innerHTML =
      "<div class='grid2 tests-grid'>" + panel("Grade XI") + panel("Grade XII") + "</div>" +
      "<details class='section' style='margin-top:12px'" + (ones.length ? "" : " hidden") + ">" +
        "<summary><span class='section-title'>One-to-one tests</span><span class='section-meta'>&middot; " + ones.length +
        " tests for hourly students</span><span class='show-pill' aria-hidden='true'></span></summary>" +
        "<div class='section-body' style='padding:0'><table class='tests-table'><thead><tr><th>Student</th><th>Test #</th><th>Date</th><th>Portions</th>" +
        "<th class='c'>Marks</th><th class='c'>%</th><th></th></tr></thead><tbody>" + oneRows + "</tbody></table></div></details>";
  }

  // ---------- mark sheet ----------
  function open(id) { _view = id; render(); window.scrollTo(0, 0); }

  function _students(t) {
    var who = _byStudent(), names = {}, today = new Date(); today.setHours(0, 0, 0, 0);
    if (t.kind === "one") return [t.student];
    Data.allStudents().forEach(function (s) {
      if (s.cls !== t.cls || !Hourly.inGroup(s)) return;
      var active = s.status === "Active" && !(s.endDate && new Date(s.endDate) < today);
      if (active) names[Utils.fullName(s)] = true;
    });
    marksOf(t.id).forEach(function (r) { names[r.student] = true; });   // anyone already marked
    return Object.keys(names).sort(function (a, b) {
      var A = who[a], B = who[b];
      return (A && B ? Data.allStudents().indexOf(A) - Data.allStudents().indexOf(B) : a.localeCompare(b));
    });
  }

  function _headerHtml(t) {
    var s = stats(t), n = _students(t).length;
    return "<div class='sheet-stat'><span>Marks out of</span><b>" + _esc(t.total || "—") + "</b></div>" +
      "<div class='sheet-stat'><span>" + (t.kind === "one" ? "Marks" : "Class top") + "</span><b>" + mk(s.top) + "</b></div>" +
      "<div class='sheet-stat'><span>Average</span><b>" + pctTxt(s.avg) + "</b></div>" +
      "<div class='sheet-stat'><span>Took the test</span><b>" + s.taken + " of " + n + "</b></div>";
  }

  function _sheetHtml(t) {
    Utils.el("page-title").textContent = Utils.grade(t.cls) + " · " + (t.num || "Test");
    var byName = {}; marksOf(t.id).forEach(function (r) { byName[r.student] = r; });
    var total = Number(t.total) || 0;
    var rows = _students(t).map(function (name, i) {
      var r = byName[name], v = r ? r.score : "";
      return "<tr><td class='num'>" + (i + 1) + "</td><td>" + _esc(name) + "</td>" +
        "<td class='c'><input class='mark-in' type='number' step='0.5' min='0' data-name='" + _esc(name) + "' value='" + _esc(v) + "' placeholder='---'></td>" +
        "<td class='c mark-pct'>" + (r && total ? Math.round(Number(v) / total * 100) + "%" : "---") + "</td></tr>";
    }).join("");
    var chapters = Settings.chapters(t.cls).slice(1).map(function (c) { return "<option value='" + _esc(c) + "'>"; }).join("");
    return "<div class='sheet-head panel'>" +
        "<div class='sheet-title'><button class='btn btn-secondary btn-sm' onclick='Scores.show()'>&#8592; All tests</button>" +
        "<div><div class='sheet-name'>" + Utils.grade(t.cls) + " · " + _esc(t.num) + (t.kind === "one" ? " · " + _esc(t.student) : "") + "</div>" +
        "<div class='muted'>Portions: <b style='color:var(--text)'>" + _esc(t.title || "—") + "</b> · " + fmtDate(t.date) + "</div></div></div>" +
        "<div class='sheet-stats' id='sheet-stats'>" + _headerHtml(t) + "</div></div>" +
      "<div class='sheet-body'>" +
        "<div class='panel'><div class='panel-header'><span class='panel-title'>Students' mark sheet</span><span class='muted'>marks save automatically</span></div>" +
          "<table class='tests-table mark-table'><thead><tr><th class='num'>#</th><th>Name of student</th><th class='c'>Marks obtained</th><th class='c'>Marks (%)</th></tr></thead>" +
          "<tbody>" + (rows || "<tr><td colspan='4' class='muted'>No active students in this class.</td></tr>") + "</tbody></table></div>" +
        "<div class='panel sheet-edit'><div class='panel-header'><span class='panel-title'>Test details</span></div><div style='padding:12px 16px'>" +
          "<div class='form-row'><label>Test #</label><input id='te-num' value='" + _esc(t.num) + "'></div>" +
          "<div class='form-row'><label>Date</label><input id='te-date' type='date' value='" + _esc(t.date) + "'></div>" +
          "<div class='form-row'><label>Portions</label><input id='te-title' list='te-chapters' value='" + _esc(t.title) + "'><datalist id='te-chapters'>" + chapters + "</datalist></div>" +
          "<div class='form-row'><label>Marks out of</label><input id='te-total' type='number' min='1' value='" + _esc(t.total) + "'></div>" +
          "<button type='button' class='link-btn danger-link' onclick='Scores.delTest(\"" + t.id + "\")'>Delete this test</button>" +
        "</div></div>" +
      "</div>";
  }

  function _wireSheet() {
    var t = testOf(_view);
    document.querySelectorAll(".mark-in").forEach(function (inp) {
      inp.addEventListener("change", function () { setMark(t.id, inp.dataset.name, inp.value, inp); });
      inp.addEventListener("keydown", function (e) {           // Enter moves down the list
        if (e.key !== "Enter") return;
        e.preventDefault();
        var all = Array.prototype.slice.call(document.querySelectorAll(".mark-in")), i = all.indexOf(inp);
        if (all[i + 1]) all[i + 1].focus(); else inp.blur();
      });
    });
    ["te-num", "te-date", "te-title", "te-total"].forEach(function (id) {
      Utils.el(id).addEventListener("change", function () { _saveDetails(t.id); });
    });
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
    Utils.el("tm-date").value = new Date().toISOString().slice(0, 10);
    Utils.el("tm-title").value = ""; Utils.el("tm-total").value = "";
    Utils.openModal("modal-test");
  }
  function _nextNum(cls, student) {
    var n = 0;
    Data.get().tests.forEach(function (t) {
      if (t.cls === cls && (student ? t.student === student : t.kind !== "one")) n = Math.max(n, _num(t));
    });
    return "Test " + (n + 1);
  }
  function _fillModal(cls) {
    var hourly = Data.allStudents().filter(function (s) { return s.cls === cls && Hourly.isHourly(s) && s.status === "Active"; });
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

  return { render: render, show: show, open: open, openModal: openModal, saveTest: saveTest,
           modalClass: modalClass, modalWho: modalWho, delTest: delTest, ensure: ensure };
})();
