// ================================================================
//  JS_Settings — Settings page logic
//  Handles load, save, reset for editable chapter lists
// ================================================================

var SettingsPage = (function () {

  function init() {
    Utils.el("settings-xi").value  = Settings.getRaw("Grade XI");
    Utils.el("settings-xii").value = Settings.getRaw("Grade XII");
    var sel = Utils.el("settings-acad");
    var cur = Settings.get("acadStart") || defaultAcadStart();
    var y0  = Number(defaultAcadStart().slice(0, 4));
    var opts = [];
    for (var y = y0 - 3; y <= y0 + 1; y++) opts.push(y + "-03");
    if (opts.indexOf(cur) === -1) opts.push(cur);
    sel.innerHTML = opts.map(function (o) {
      return "<option value='" + o + "'" + (o === cur ? " selected" : "") + ">" +
             "March " + o.slice(0, 4) + " \u2192 April " + (Number(o.slice(0, 4)) + 1) + "</option>";
    }).join("");
  }

  function saveAcad() {
    var v = Utils.el("settings-acad").value;
    Settings.set("acadStart", v);
    setAcademicYear(v);
    Data.log("Set academic year to <b>" + (ACYR_LBL[ACYR[0]] || v) + "</b>");
  }

  function backup(btn) {
    btn.disabled = true; btn.textContent = "Backing up\u2026";
    Data.backup().then(function (r) {
      btn.disabled = false;
      btn.textContent = r.ok ? "\u2714 " + r.name : "Backup failed: " + (r.error || "");
      setTimeout(function () { btn.textContent = "Back up sheet now"; }, 4000);
    });
  }

  function save(grade) {
    var id  = grade === "Grade XI" ? "settings-xi" : "settings-xii";
    var txt = Utils.el(id).value;
    Settings.save(grade, txt);
    var btn = (window.event && window.event.target) || document.activeElement;
    var orig = btn.textContent;
    btn.textContent = "Saved!";
    btn.style.background = "var(--accent3)";
    btn.style.color = "#0d0f14";
    setTimeout(function () {
      btn.textContent = orig;
      btn.style.background = "";
      btn.style.color = "";
    }, 1500);
    Data.log("Updated chapter list for <b>" + grade + "</b>");
  }

  function reset(grade) {
    if (!confirm("Reset " + grade + " chapters to default? Your custom list will be lost.")) return;
    Settings.reset(grade);
    // Reload textarea
    var id = grade === "Grade XI" ? "settings-xi" : "settings-xii";
    Utils.el(id).value = Settings.getRaw(grade);
    Data.log("Reset chapter list for <b>" + grade + "</b> to default");
  }

  return { init: init, save: save, reset: reset, saveAcad: saveAcad, backup: backup };
})();
