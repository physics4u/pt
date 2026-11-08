// ================================================================
//  import.js — Settings → Import data (admins).
//  "Check" reads a year's earlier records and reports what it found;
//  nothing in PT changes.
// ================================================================
var ImportPage = (function () {
  function check(btn) {
    var year = Utils.el("import-year").value, out = Utils.el("import-result");
    btn.disabled = true; btn.textContent = "Checking\u2026 (up to a few minutes)";
    out.textContent = "";
    Data.api("importCheck", { year: year }, 360000).then(function (r) {
      btn.disabled = false; btn.textContent = "Check";
      if (!r.ok) { out.innerHTML = "<span style='color:var(--danger)'>" + (r.error || "Could not check.") + "</span>"; return; }
      if (r.converted) { out.innerHTML = summaryHtml(year, r.summary); return; }
      out.innerHTML = "Found the " + year.replace("-", "\u2013") + " records with <b>" + r.tabs + "</b> sections. " +
        "Nothing in PT has been changed yet.";
      Data.log("Checked the " + year + " records for import");
      Data.save();
    });
  }
  // What the records contain, laid out to compare with the workbook's Home screen.
  function summaryHtml(year, S) {
    var row = function (a, b) { return "<tr><td>" + a + "</td><td><b>" + b + "</b></td></tr>"; };
    var hourly = (S.hourly || []).map(function (h) {
      return "<tr><td>" + h.name + "</td><td>" + h.sessions + "</td><td>" + h.hours + "</td><td>\u20b9" +
        Math.round(h.billed).toLocaleString("en-IN") + "</td><td>\u20b9" + Math.round(h.paid).toLocaleString("en-IN") +
        "</td><td>" + (h.ok ? "<span class='chip chip-green'>matches</span>" : "<span class='chip chip-red'>check</span>") + "</td></tr>";
    }).join("");
    return "<div class='import-sum'><div class='sub-title'>The " + year.replace("-", "\u2013") +
      " records are ready to import. Compare with the workbook's Home screen:</div>" +
      "<table class='guide-table'>" +
        row("Students", S.students + " (" + S.hourlyStudents + " hourly)") +
        row("+1 Hours / Days", S.plus1.hours + " / " + S.plus1.days) +
        row("+2 Hours / Days", S.plus2.hours + " / " + S.plus2.days) +
        row("Hourly hours", S.hourlyHours) +
        row("Fees paid", S.totalPaid + " <span class='muted'>(regular " + S.regularPaid + " + hourly " + S.hourlyPaid + ")</span>") +
        row("Unpaid regular months", S.pendingMonths) +
        row("Hourly sessions / payments", S.sessions + " / " + S.hourlyPayments) +
        row("Test scores", S.scores) + row("Weekly classes", S.classes) +
      "</table>" +
      (hourly ? "<div class='sub-title' style='margin-top:10px'>Hourly students</div><table class='hourly-table'><thead><tr>" +
        "<th>Student</th><th>Sessions</th><th>Hours</th><th>Billed</th><th>Paid</th><th></th></tr></thead><tbody>" + hourly + "</tbody></table>" : "") +
      ((S.notes || []).length ? "<div class='muted' style='margin-top:8px'>" + S.notes.join("<br>") + "</div>" : "") +
      "<div style='margin-top:10px'>Nothing in PT has been changed yet. Press <b>Import</b> to load these records.</div></div>";
  }

  // Replace PT's records (not users) with the prepared year's records.
  function apply(btn) {
    var year = Utils.el("import-year").value, out = Utils.el("import-result"), label = year.replace("-", "\u2013");
    Dialog.confirm("Import the " + label + " records?\n\nThis replaces PT's students, classes, planner, attendance, " +
                   "payments, hourly sessions and scores with the " + label + " records. Users are kept. " +
                   "A full backup is made first.", { okText: "Import", danger: true }).then(function (ok) {
      if (!ok) return;
      btn.disabled = true; btn.textContent = "Importing\u2026";
      out.textContent = "";
      Data.api("importApply", { year: year }, 360000).then(function (r) {
        btn.disabled = false; btn.textContent = "Import";
        if (!r.ok) { out.innerHTML = "<span style='color:var(--danger)'>" + (r.error || "Import failed.") + "</span>"; return; }
        var c = r.counts || {};
        out.innerHTML = "Imported the " + label + " records: <b>" + c.students + "</b> students, <b>" + c.sessions +
          "</b> hourly sessions, <b>" + c.payments + "</b> hourly payments, <b>" + c.scores + "</b> test scores, " +
          c.plannerMonths + " planner months. A backup was made first (" + r.backup + ").";
        Data.reload();
      });
    });
  }

  return { check: check, apply: apply };
})();
