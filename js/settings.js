// ================================================================
//  JS_Settings — Settings page logic
//  Handles load, save, reset for editable chapter lists
// ================================================================

var SettingsPage = (function () {

  function init() {
    _about();
    var me = Data.me();
    Utils.el("acct-hint").textContent = me ? (me.name || me.username) + " \u00b7 " + (me.role === "admin" ? "Admin" : "User") : "";
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

  // Version information for both halves of PT.
  function _about() {
    var sv = Data.serverVersion();
    Utils.el("about-hint").textContent = "Version " + PT_VERSION;
    var rows = [
      ["Website version", PT_VERSION + (PT_BUILD !== "dev" ? "  (build " + PT_BUILD + ")" : "")],
      ["Server version",  sv || "\u2014"],
      ["Data",            "Google Sheet \u201cPT\u201d in the Physics Tuition folder"],
      ["Changes",         "See CHANGELOG.md in the pt-code repository"]
    ];
    var html = "<table>" + rows.map(function (r) {
      return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>";
    }).join("") + "</table>";
    if (sv && sv !== PT_VERSION) {
      html += "<div class='about-warn'>\u26a0 The website and server versions differ. " +
              "Paste the latest Code.gs into Apps Script and redeploy.</div>";
    }
    Utils.el("about-body").innerHTML = html;
  }

  function saveAcad() {
    var v = Utils.el("settings-acad").value;
    Settings.set("acadStart", v);
    setAcademicYear(v);
    Utils.el("year-chip").textContent = ACYR[0].slice(0, 4) + "\u2013" + String(Number(ACYR[0].slice(0, 4)) + 1).slice(2);
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
    btn.style.color = "#0a0b0a";
    setTimeout(function () {
      btn.textContent = orig;
      btn.style.background = "";
      btn.style.color = "";
    }, 1500);
    Data.log("Updated chapter list for <b>" + grade + "</b>");
  }

  function reset(grade) {
    Dialog.confirm("Reset " + grade + " chapters to the default list? Your custom list will be lost.", {okText:"Reset", danger:true}).then(function (ok) {
      if (!ok) return;
      Settings.reset(grade);
      var id = grade === "Grade XI" ? "settings-xi" : "settings-xii";
      Utils.el(id).value = Settings.getRaw(grade);
      Data.log("Reset chapter list for <b>" + grade + "</b> to default");
    });
  }

  return { init: init, save: save, reset: reset, saveAcad: saveAcad, backup: backup };
})();
