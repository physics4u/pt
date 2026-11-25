// ================================================================
//  JS_Settings — Settings page logic
//  Handles load, save, reset for editable chapter lists
// ================================================================

var SettingsPage = (function () {

  function init() {
    var me = Data.me();
    _renderChapters("Grade XI");
    _renderChapters("Grade XII");
    _editing("Grade XI", false);
    _editing("Grade XII", false);
    _renderYear();
    _renderTz();
    _renderCal();
    _renderSite();
    if (window.Progress) { Progress.meta(); var pg = Utils.el("sec-progress"); if (pg && pg.open) Progress.render(); }
  }

  // ---- Academic year: which year PT shows (this visit only) ----
  function _years() {
    // From the earliest year with any records to next year
    var D = Data.get(), min = defaultAcadStart().slice(0, 4) * 1;
    var see = function (ym) { if (/^\d{4}-\d{2}/.test(ym || "")) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); min = Math.min(min, m >= 3 ? y : y - 1); } };
    ["attsheets", "syllabus", "paygrid"].forEach(function (k) {
      Object.keys(D[k] || {}).forEach(function (key) { see(key.split("|").pop()); });
    });
    (D.sessions || []).concat(D.hourpay || [], D.scores || []).forEach(function (x) { see(x.date); });
    D.students.forEach(function (s) { see(s.startDate); });
    _dataFrom = min;
    var out = [], max = defaultAcadStart().slice(0, 4) * 1 + 1;
    min = Math.min(min, max - 7);                 // always offer the last few years
    for (var y = max; y >= min; y--) out.push(y + "-03");
    return out;
  }
  var _dataFrom = 0;   // first year that has records
  function _renderYear() {
    var cur = defaultAcadStart(), shown = viewYear();
    Utils.el("acad-meta").innerHTML = "\u00b7 " + acadLabel() + (isCurrentAcad() ? " (current)" : " <span class='chip chip-gold'>earlier year</span>");
    Utils.el("settings-acad").innerHTML = _years().map(function (o) {
      return "<option value='" + o + "'" + (o === shown ? " selected" : "") + ">" + acadLabel(o) +
             " \u2014 March " + o.slice(0, 4) + " to April " + (Number(o.slice(0, 4)) + 1) + (o === cur ? " (current)" : Number(o.slice(0, 4)) < _dataFrom ? " \u00b7 no records yet" : "") + "</option>";
    }).join("");
    Utils.el("acad-back").style.display = isCurrentAcad() ? "none" : "";
  }
  function saveAcad(v) {
    v = v || Utils.el("settings-acad").value;
    applyAcademicYear(v);
    _renderYear();
  }

  // ---- Region: time zone (shared by everyone) ----
  var ZONES = [
    ["Asia/Kolkata", "India (IST, UTC+5:30)"], ["Asia/Dubai", "UAE (UTC+4)"], ["Asia/Muscat", "Oman (UTC+4)"],
    ["Asia/Qatar", "Qatar (UTC+3)"], ["Asia/Riyadh", "Saudi Arabia (UTC+3)"], ["Asia/Singapore", "Singapore (UTC+8)"],
    ["Europe/London", "UK (London)"], ["America/New_York", "US Eastern (New York)"], ["America/Chicago", "US Central (Chicago)"],
    ["America/Los_Angeles", "US Pacific (California)"], ["Australia/Sydney", "Australia (Sydney)"], ["UTC", "UTC"]
  ];
  function _renderTz() {
    var cur = PT_TZ;
    var list = ZONES.some(function (z) { return z[0] === cur; }) ? ZONES : ZONES.concat([[cur, cur]]);
    Utils.el("settings-tz").innerHTML = list.map(function (z) {
      return "<option value='" + z[0] + "'" + (z[0] === cur ? " selected" : "") + ">" + z[1] + "</option>"; }).join("");
    var label = (list.filter(function (z) { return z[0] === cur; })[0] || [cur, cur])[1];
    Utils.el("tz-meta").textContent = "\u00b7 " + label.replace(/ \(.*\)$/, "");
    Utils.el("tz-now").textContent = "Now in PT: " + Utils.dateTime(new Date());
  }
  function saveTz() {
    var v = Utils.el("settings-tz").value;
    Settings.set("tz", v);
    setTimeZone(v);
    Data.log("Set the time zone to <b>" + v + "</b>");
    applyAcademicYear(viewYear() === defaultAcadStart() ? null : viewYear());
    _renderTz(); _renderYear();
    var td = Utils.el("today-date");
    if (td) td.textContent = Utils.fmtDate(ptToday().date);
  }

  // ---- Public website: the tutor's photo (kept in PT, shown only when switched on) ----
  function _renderSite() {
    var box = Utils.el("site-photo-box"); if (!box) return;
    var pic = Settings.get("sitePhoto") || "", on = Settings.get("siteShowPhoto") === true && !!pic;
    box.innerHTML = pic ? "<img src='" + pic + "' alt='Tutor photo'>" : "<span>No photo</span>";
    Utils.el("site-photo-on").checked = on;
    Utils.el("site-photo-on").disabled = !pic;
    Utils.el("site-photo-del").style.display = pic ? "" : "none";
    Utils.el("site-meta").textContent = "\u00b7 " + (!pic ? "no photo" : on ? "photo shown" : "photo hidden");
  }
  function setSitePhoto(on) {
    if (on && !Settings.get("sitePhoto")) { Dialog.alert("Upload a photo first."); _renderSite(); return; }
    Settings.set("siteShowPhoto", !!on);
    Data.log((on ? "Showed" : "Hid") + " the tutor's photo on the website");
    _renderSite();
  }
  // Square, centred, 320 x 320, small enough to keep with PT's settings
  function uploadSitePhoto(input) {
    var f = input.files && input.files[0]; input.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { Dialog.alert("Please choose a picture (JPEG or PNG)."); return; }
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var side = Math.min(im.width, im.height), sx = (im.width - side) / 2;
        var sy = Math.min(Math.max(0, (im.height - side) / 2 - side * 0.08), im.height - side);
        var c = document.createElement("canvas"); c.width = c.height = 320;
        c.getContext("2d").drawImage(im, sx, sy, side, side, 0, 0, 320, 320);
        var q = 0.86, url = c.toDataURL("image/jpeg", q);
        while (url.length > 40000 && q > 0.4) { q -= 0.08; url = c.toDataURL("image/jpeg", q); }
        Settings.set("sitePhoto", url);
        Data.log("Uploaded the tutor's photo for the website");
        _renderSite();
      };
      im.onerror = function () { Dialog.alert("That picture couldn't be read. Please try a JPEG or PNG."); };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  }
  function removeSitePhoto() {
    Dialog.confirm("Remove the tutor's photo from PT? The website will show no photo.", { okText: "Remove", danger: true }).then(function (ok) {
      if (!ok) return;
      var st = Data.get().settings; st.sitePhoto = ""; st.siteShowPhoto = false; Data.save();
      Data.log("Removed the tutor's photo");
      _renderSite();
    });
  }

  // ---- Google Calendar ----
  function _renderCal() {
    var on = Settings.get("calOn") === "yes", t = Settings.get("calTutor") || "";
    Utils.el("cal-on").checked = on;
    Utils.el("cal-tutor").value = t;
    Utils.el("cal-meta").textContent = "\u00b7 " + (on ? "on" + (t ? ", inviting " + t : "") : "off");
  }
  function saveCal() {
    var on = Utils.el("cal-on").checked, t = Utils.el("cal-tutor").value.trim();
    if (t && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) { Dialog.alert("Please enter a valid email address."); return; }
    Settings.set("calOn", on ? "yes" : "");
    Settings.set("calTutor", t);
    Data.log("Google Calendar " + (on ? "turned on" : "turned off") + (t ? " (tutor " + t + ")" : ""));
    _renderCal();
    var out = Utils.el("cal-result");
    out.className = "import-msg ok";
    out.innerHTML = "<b>&#10004; Saved.</b> " + (on ? "New and changed classes now go to Google Calendar. Press <b>Add all classes now</b> to add the existing ones." : "Classes are no longer added to Google Calendar.");
  }

  function backup(btn) {
    btn.disabled = true; btn.textContent = "Backing up\u2026";
    Data.backup().then(function (r) {
      btn.disabled = false;
      btn.textContent = r.ok ? "\u2714 Backed up" : "\u26a0 Failed";
      if (!r.ok) Dialog.alert("Backup failed: " + (r.error || "unknown error"));
      else Data.log("Made a backup (<b>" + r.name + "</b>)");
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

  return { init: init, edit: edit, cancel: cancel, save: save, useStandard: useStandard, saveAcad: saveAcad, saveTz: saveTz, saveCal: saveCal, backup: backup,
           setSitePhoto: setSitePhoto, uploadSitePhoto: uploadSitePhoto, removeSitePhoto: removeSitePhoto };
})();
