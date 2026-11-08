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
      out.innerHTML = "Found the " + year.replace("-", "\u2013") + " records" +
        (r.slim ? " and prepared them for import" : " with <b>" + r.tabs + "</b> sections") +
        ". Nothing in PT has been changed yet.";
      Data.log("Checked the " + year + " records for import");
      Data.save();
    });
  }
  return { check: check };
})();
