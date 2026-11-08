// ================================================================
//  JS_Settings — Settings page logic
//  Handles load, save, reset for editable chapter lists
// ================================================================

var SettingsPage = (function () {

  function init() {
    _about();
    var me = Data.me();
    _renderChapters("Grade XI");
    _renderChapters("Grade XII");
    _editing("Grade XI", false);
    _editing("Grade XII", false);
    Utils.el("acad-meta").textContent = "\u00b7 " + (ACYR_LBL[ACYR[0]] || "") + " \u2192 " + (ACYR_LBL[ACYR[ACYR.length - 1]] || "");
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

  // Version information for both halves of PT.
  function _about() {
    var sv = Data.serverVersion();
    Utils.el("about-hint").textContent = "\u00b7 version " + PT_VERSION;
    var rows = [
      ["Website",  "Version " + PT_VERSION],
      ["Server",   sv ? "Version " + sv : "\u2014"],
      ["Data",     "Google Sheet \u201cPT\u201d in the Physics Tuition folder"],
      ["Changes",  "CHANGELOG.md in the pt-code repository"]
    ];
    Utils.el("about-body").innerHTML = "<table>" + rows.map(function (r) {
      return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>";
    }).join("") + "</table>" +
      "<div class='section-note' style='margin:10px 0 0'>&copy; PT &middot; Physics Tuition. " +
      "Versions are the release date and that day's release number.</div>";
  }

  function saveAcad() {
    var v = Utils.el("settings-acad").value;
    Settings.set("acadStart", v);
    setAcademicYear(v);
    Utils.el("year-chip").textContent = ACYR[0].slice(0, 4) + "\u2013" + String(Number(ACYR[0].slice(0, 4)) + 1).slice(2);
    Utils.el("acad-meta").textContent = "\u00b7 " + ACYR_LBL[ACYR[0]] + " \u2192 " + ACYR_LBL[ACYR[ACYR.length - 1]];
    Data.log("Set academic year to <b>" + (ACYR_LBL[ACYR[0]] || v) + "</b>");
  }

  function backup(btn) {
    btn.disabled = true; btn.textContent = "Backing up\u2026";
    Data.backup().then(function (r) {
      btn.disabled = false;
      btn.textContent = r.ok ? "\u2714 Backed up" : "\u26a0 Failed";
      if (!r.ok) Dialog.alert("Backup failed: " + (r.error || "unknown error"));
      else Data.log("Backed up the sheet (<b>" + r.name + "</b>)");
      setTimeout(function () { btn.textContent = "\u27f3 Back up now"; }, 4000);
    });
  }

  // ---- Chapter lists: compact view, Edit opens a text box ----
  function _k(grade) { return grade === "Grade XI" ? "xi" : "xii"; }

  function _esc(t) { return String(t).replace(/[&<>]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }

  function _renderChapters(grade) {
    var k = _k(grade), list = Settings.chapters(grade).slice(1);   // drop "-- None --"
    Utils.el("chap-list-" + k).innerHTML = list.map(function (c) { return "<li>" + _esc(c) + "</li>"; }).join("");
    Utils.el("chap-count-" + k).textContent = list.length + " chapters";
    var xi = Settings.chapters("Grade XI").length - 1, xii = Settings.chapters("Grade XII").length - 1;
    Utils.el("chap-meta").textContent = "\u00b7 Plus 1: " + xi + " \u00b7 Plus 2: " + xii;
  }

  function _editing(grade, on) {
    var k = _k(grade);
    Utils.el("chap-list-" + k).style.display   = on ? "none" : "";
    Utils.el("chap-editor-" + k).style.display = on ? "" : "none";
    Utils.el("chap-edit-" + k).style.display   = on ? "none" : "";
  }

  function edit(grade) {
    Utils.el("settings-" + _k(grade)).value = Settings.getRaw(grade);
    _editing(grade, true);
    Utils.el("settings-" + _k(grade)).focus();
  }

  function cancel(grade) { _editing(grade, false); }

  function save(grade) {
    var txt = Utils.el("settings-" + _k(grade)).value;
    if (!txt.trim()) { Dialog.alert("The chapter list can't be empty."); return; }
    Settings.save(grade, txt);
    Data.log("Updated chapter list for <b>" + grade + "</b>");
    _renderChapters(grade);
    _editing(grade, false);
  }

  // Fills the box with the built-in list; nothing changes until Save.
  function useStandard(grade) {
    var std = grade === "Grade XI" ? DEFAULT_CHAPTERS_XI : DEFAULT_CHAPTERS_XII;
    Utils.el("settings-" + _k(grade)).value = std.join("\n");
  }

  return { init: init, edit: edit, cancel: cancel, save: save, useStandard: useStandard, saveAcad: saveAcad, backup: backup };
})();
