// ================================================================
//  JS_Students — Students page and modal
//  Owns: render, openModal, save, delete
// ================================================================

var Students = (function () {
  var _editIdx = -1;

  // Four collapsible sections like Payments: Plus 1, Plus 2, Hourly (Plus 1),
  // Hourly (Plus 2). All closed when the page is opened from the menu;
  // a search opens the sections that have a match.
  var _open = {};
  function show() { _open = {}; render(); }
  function toggle(key, el) { _open[key] = el.open; }

  function render() {
    var D    = Data.get();
    var q    = (Utils.el("student-search").value || "").trim().toLowerCase();
    var all  = Data.allStudents();
    // A search looks through everyone in the year, inactive students included
    var list = all.filter(function (s) {
      return q ? Utils.fullName(s).toLowerCase().includes(q) : Utils.shown(s);
    });

    var total = all.length;
    Utils.el("students-count").innerHTML = list.length === total
      ? "<b>" + total + "</b> students"
      : "Showing <b>" + list.length + "</b> of " + total + " students";
    Utils.el("students-empty").style.display = total ? "none" : "";

    var hint = q && !list.length ? _didYouMean(q, all) : "";

    var groups = [
      { key: "Grade XI",      title: "Plus 1",          test: function (s) { return Utils.clsOf(s) === "Grade XI"  && !Hourly.hourlyIn(s); } },
      { key: "Grade XII",     title: "Plus 2",          test: function (s) { return Utils.clsOf(s) === "Grade XII" && !Hourly.hourlyIn(s); } },
      { key: "one|Grade XI",  title: "Hourly (Plus 1)", test: function (s) { return Utils.clsOf(s) === "Grade XI"  && Hourly.hourlyIn(s); } },
      { key: "one|Grade XII", title: "Hourly (Plus 2)", test: function (s) { return Utils.clsOf(s) === "Grade XII" && Hourly.hourlyIn(s); } },
      { key: "none",          title: "No class set",    test: function (s) { var c = Utils.clsOf(s); return c !== "Grade XI" && c !== "Grade XII" && !(s.yearCls && !isCurrentAcad()); } }
    ];
    Utils.el("students-wrap").innerHTML = hint + groups.map(function (g) {
      var inGroup = all.filter(g.test), rows = list.filter(g.test);
      if (!inGroup.length && g.key === "none") return "";
      var active = inGroup.filter(Utils.isActive).length, hidden = inGroup.length - active;
      var isOpen = q ? rows.length > 0 : _open[g.key];
      var meta = Utils.showAll()
        ? inGroup.length + " student" + (inGroup.length === 1 ? "" : "s") + (hidden ? " &middot; " + active + " active" : "")
        : active + " active" + (hidden ? " <span class='muted'>(" + hidden + " inactive hidden)</span>" : "");
      if (q) meta = rows.length + " found &middot; " + meta;
      var hourly = g.key.indexOf("one|") === 0;
      var body = rows.length ?
        "<table><thead><tr><th class='num'>#</th><th>Name</th><th>School</th><th>Contact</th>" +
          (hourly ? "<th>Rate</th>" : "<th>Monthly fee</th>") + "<th>Status</th><th></th></tr></thead><tbody>" +
        rows.map(function (s, n) {
          var i  = D.students.indexOf(s);
          var st = Utils.statusIn(s), sc = st === "Active" ? "green" : st === "Trial" ? "orange" : "red";
          var fee = hourly ? (s.hourlyRate ? "₹" + Number(s.hourlyRate).toLocaleString("en-IN") + "/hr" : "—")
                           : (s.monthlyFee ? "₹" + Number(s.monthlyFee).toLocaleString("en-IN") : "—");
          return "<tr>" +
            "<td class='num'>" + (n + 1) + "</td>" +
            "<td>" + Utils.studentLink(Utils.fullName(s)) +
              (hourly && Hourly.inGroup(s) ? " <span class='muted small'>+ group classes</span>" : "") + "</td>" +
            "<td>" + (s.school || "—") + "</td>" +
            "<td>" + (s.phone  || "—") + "</td>" +
            "<td>" + fee + "</td>" +
            "<td><span class='badge badge-" + sc + "'" + (isCurrentAcad() ? "" : " title='In " + acadLabel() + "'") + ">" + st + "</span></td>" +
            "<td class='edit-cell'>" + Utils.hoverEdit("Students.openModal(" + i + ")", "Edit student") + "</td></tr>";
        }).join("") + "</tbody></table>"
        : "<div class='empty' style='padding:20px'><div class='empty-text'>" + (inGroup.length ? "No matching students." : "No students yet.") + "</div></div>";
      return "<details class='section tests-section stu-section'" + (isOpen ? " open" : "") +
        (q ? "" : " ontoggle='Students.toggle(\"" + g.key + "\", this)'") +
        "><summary><span class='section-title'>" + g.title + "</span><span class='section-meta'>&middot; " + meta +
        "</span><span class='show-pill' aria-hidden='true'></span></summary>" +
        "<div class='section-body' style='padding:0'><div style='overflow-x:auto'>" + body + "</div></div></details>";
    }).join("");
  }

  // "Did you mean …?" for a search with no match (small typos: "Sarema" → Serena)
  function _dist(a, b) {
    var m = a.length, n = b.length, d = [];
    for (var i = 0; i <= m; i++) { d[i] = [i]; }
    for (var j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function _didYouMean(q, all) {
    var best = [], bestD = 99;
    all.forEach(function (s) {
      var name = Utils.fullName(s), words = name.toLowerCase().split(/\s+/).concat([name.toLowerCase()]);
      // closeness of the typed text to any word of the name; a word starting with the
      // same letter wins a tie ("sarema" → Serena rather than Varma)
      var d = Math.min.apply(null, words.map(function (w) {
        return _dist(q, w.slice(0, Math.max(q.length, Math.min(w.length, q.length + 2)))) + (w.charAt(0) === q.charAt(0) ? 0 : 0.5);
      }));
      if (d < bestD) { bestD = d; best = [name]; } else if (d === bestD && best.indexOf(name) < 0) best.push(name);
    });
    var limit = q.length <= 4 ? 1 : 2;
    var msg = "<div class='search-hint'>No student in " + acadLabel() + " matches \u201c" + _esc(q) + "\u201d.";
    if (bestD <= limit + 0.5 && best.length) {
      msg += " Did you mean " + best.slice(0, 3).map(function (n) {
        return "<a class='stu-suggest' onclick='Students.searchFor(" + JSON.stringify(n).replace(/'/g, "&#39;") + ")'>" + _esc(n) + "</a>"; }).join(", ") + "?";
    }
    return msg + "</div>";
  }
  function searchFor(name) { Utils.el("student-search").value = name; render(); }
  function _esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }

  function openModal(idx) {
    _editIdx = (idx !== undefined) ? idx : -1;
    Utils.el("modal-student-delete").style.display = _editIdx >= 0 ? "" : "none";
    var s = _editIdx >= 0 ? Data.get().students[_editIdx] : null;
    Utils.el("modal-student-title").textContent = _editIdx >= 0 ? "Edit Student" : "Add Student";
    Utils.el("s-fname").value         = s ? s.fname        : "";
    Utils.el("s-lname").value         = s ? s.lname        : "";
    Utils.el("s-school").value        = s ? (s.school      || "") : "";
    Utils.el("s-parent").value        = s ? (s.parent      || "") : "";
    Utils.el("s-class").value         = s ? (Utils.clsOf(s) || s.cls || "") : "";
    Utils.el("s-batch").value         = s ? (s.batch       || "Regular") : "Regular";
    Utils.el("s-phone").value         = s ? (s.phone       || "") : "";
    Utils.el("s-student-phone").value = s ? (s.studentPhone|| "") : "";
    Utils.el("s-email").value         = s ? (s.email       || "") : "";
    Utils.el("s-address").value       = s ? (s.address     || "") : "";
    Utils.el("s-country").value       = s ? (s.country     || "") : "";
    Utils.el("s-monthly-fee").value   = s ? (s.monthlyFee  || "") : "";
    Utils.el("s-notes").value         = s ? (s.notes       || "") : "";
    Utils.el("s-status").value        = s ? s.status        : "Active";
    Utils.el("s-start-date").value    = s ? (s.startDate    || "") : "";
    Utils.el("s-end-date").value      = s ? (s.endDate      || "") : "";
    Utils.el("s-hourly-rate").value   = s ? (s.hourlyRate   || "") : "";
    Utils.el("s-group-too").checked   = !!s && s.groupToo === "yes";
    toggleBatch();
    Utils.openModal("modal-student");
  }

  // Hourly students get a rate per hour; the monthly fee only applies
  // to students in the group classes.
  function toggleBatch() {
    var hourly = Utils.el("s-batch").value === "Hourly";
    Utils.el("s-hourly-fields").style.display = hourly ? "" : "none";
    Utils.el("s-fee-row").style.display = !hourly || Utils.el("s-group-too").checked ? "" : "none";
  }

  function save() {
    var fname = Utils.el("s-fname").value.trim();
    var lname = Utils.el("s-lname").value.trim();
    if (!fname) { Dialog.alert("Please enter the first name."); return; }

    var student = {
      fname: fname,
      lname: lname,
      school:       Utils.el("s-school").value,
      parent:       Utils.el("s-parent").value,
      cls:          Utils.el("s-class").value,
      batch:        Utils.el("s-batch").value,
      phone:        Utils.el("s-phone").value,
      studentPhone: Utils.el("s-student-phone").value,
      email:        Utils.el("s-email").value,
      address:      Utils.el("s-address").value,
      country:      Utils.el("s-country").value,
      monthlyFee:   Utils.el("s-monthly-fee").value,
      notes:        Utils.el("s-notes").value,
      status:       Utils.el("s-status").value,
      startDate:    Utils.el("s-start-date").value,
      endDate:      Utils.el("s-end-date").value,
      hourlyRate:   Utils.el("s-batch").value === "Hourly" ? Utils.el("s-hourly-rate").value : "",
      groupToo:     Utils.el("s-batch").value === "Hourly" && Utils.el("s-group-too").checked ? "yes" : ""
    };

    // A past end date always means Inactive; otherwise keep the status chosen.
    if (student.endDate) {
      if (student.endDate <= Utils.todayIso()) student.status = "Inactive";
    }

    var D = Data.get();
    // A student enrolling in a year is always a new record, even if the same
    // name is in PT from an earlier year. Only a second copy in the same year
    // is refused.
    if (_editIdx < 0) {
      var key = function (x) { return (x.fname + " " + x.lname).replace(/\s+/g, " ").trim().toLowerCase(); };
      // (a group record and an hourly record with the same name are allowed)
      var hourly = function (x) { return (x.batch || "Regular") === "Hourly"; };
      if (Data.allStudents().some(function (x) { return key(x) === key(student) && hourly(x) === hourly(student); })) {
        Dialog.alert(fname + " " + lname + " is already " + (hourly(student) ? "an hourly" : "a group-class") + " student in " + acadLabel() + "."); return;
      }
    }
    _commit(student);
  }

  // Save the form into PT. The class is recorded for the academic year on
  // screen (yearCls); a student is only enrolled in the years they're added to.
  function _commit(student) {
    var D = Data.get(), fname = student.fname, lname = student.lname;
    var cur = _editIdx >= 0 ? D.students[_editIdx] : null, yr = ACYR[0];
    var inThisYear = !cur || Utils.inYear(cur);
    var prev = cur ? String(cur.yearCls || "") : "";
    student.yearCls = inThisYear
      ? prev.split(";").filter(function (x) { return x && x.indexOf(yr + ":") !== 0; })
            .concat(student.cls ? [yr + ":" + student.cls] : []).sort().join(";")
      : prev;
    // Looking at an earlier year changes that year's class only, not today's
    if (cur && !isCurrentAcad()) student.cls = cur.cls;

    if (_editIdx >= 0) {
      D.students[_editIdx] = Object.assign({}, D.students[_editIdx], student);   // keep any other fields
      Data.log("Updated student <b>" + fname + " " + lname + "</b>");
    } else {
      D.students.push(student);
      Data.log("Added student <b>" + fname + " " + lname + "</b>");
    }
    Data.save();
    Utils.closeModal("modal-student");
    // Open the section the student is in, so the change is visible
    _open[(student.batch === "Hourly" ? "one|" : "") + (student.cls === "Grade XI" || student.cls === "Grade XII" ? student.cls : "none")] = true;
    render();
    if (currentPage === "profile" && _editIdx >= 0) Profile.refresh();
  }

  function del(i, done) {
    Dialog.confirm("Delete " + Utils.fullName(Data.get().students[i]) + "? Their earlier attendance and payment records are kept.", {okText:"Delete", danger:true}).then(function (ok) {
      if (!ok) return;
      var D = Data.get();
      var n = Utils.fullName(D.students[i]);
      D.students.splice(i, 1);
      Data.log("Removed student <b>" + n + "</b>");
      Data.save();
      render();
      if (done) done();
    });
  }

  function delCurrent() {
    if (_editIdx < 0) return;
    del(_editIdx, function () { Utils.closeModal("modal-student"); if (currentPage === "profile") showPage("students"); });
  }

  return { show: show, toggle: toggle, render: render, searchFor: searchFor, openModal: openModal, save: save, del: del, toggleBatch: toggleBatch, delCurrent: delCurrent };
})();
