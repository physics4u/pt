// ================================================================
//  JS_Classes — Classes page and modal
// ================================================================

var Classes = (function () {
  var _editIdx = -1;

  function render() {
    var D     = Data.get();
    var tbody = Utils.el("classes-tbody");
    var empty = Utils.el("classes-empty");

    if (D.classes.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";

    // Active students per level (Plus 1 / Plus 2)
    var cnt = {};
    Data.allStudents().forEach(function (s) {
      var c = Utils.clsOf(s); if (c && Utils.isActive(s)) cnt[c] = (cnt[c] || 0) + 1;
    });
    var calOn = Settings.get("calOn") === "yes";

    tbody.innerHTML = D.classes.map(function (c, i) {
      return "<tr><td class='num'>" + (i + 1) + "</td>" +
        "<td>" + c.name + "</td>" +
        "<td>" + (c.repeat === "once" ? "Once &middot; " + _date(c.date) : c.day) + "</td>" +
        "<td>" + c.start + " \u2013 " + c.end + "</td>" +
        "<td><span class='badge badge-blue'>" + Utils.grade(c.level) + "</span></td>" +
        "<td>" + (c.tutor || "\u2014") + "</td>" +
        "<td><span class='badge badge-green'>" + (cnt[c.level] || 0) + ((cnt[c.level] || 0) === 1 ? " student" : " students") + "</span></td>" +
        "<td>" + (c.room || "\u2014") + (calOn ? (c.eventId ? " <span title='In Google Calendar'>&#128197;</span>" : " <span class='muted' title='Not in Google Calendar yet'>&#9888;</span>") : "") + "</td>" +
        "<td class='edit-cell'>" + Utils.hoverEdit("Classes.openModal(" + i + ")", "Edit class") + "</td></tr>";
    }).join("");
  }

  function openModal(idx) {
    _editIdx = (idx !== undefined) ? idx : -1;
    Utils.el("modal-class-delete").style.display = _editIdx >= 0 ? "" : "none";
    var c = _editIdx >= 0 ? Data.get().classes[_editIdx] : null;
    Utils.el("modal-class-title").textContent = _editIdx >= 0 ? "Edit Class" : "Add Class";
    Utils.el("c-name").value  = c ? c.name  : "";
    Utils.el("c-day").value   = c ? c.day   : "Monday";
    Utils.el("c-level").value = c ? c.level : "Grade XI";
    Utils.el("c-start").value = c ? c.start : "14:00";
    Utils.el("c-end").value   = c ? c.end   : "16:00";
    Utils.el("c-tutor").value = c ? (c.tutor || "") : "";
    Utils.el("c-room").value  = c ? (c.room  || "") : "";
    Utils.el("c-fee").value   = c ? (c.fee   || "") : "";
    Utils.el("c-repeat").value = c && c.repeat === "once" ? "once" : "weekly";
    Utils.el("c-date").value  = c ? (c.date || "") : "";
    toggleRepeat();
    var on = Settings.get("calOn") === "yes", tutor = Settings.get("calTutor") || "";
    Utils.el("c-cal-note").innerHTML = on
      ? "&#128197; Saved classes go to Google Calendar" + (tutor ? " and " + _esc(tutor) + " gets an invitation" : "") + ", with a reminder 30 minutes before."
      : "";
    Utils.openModal("modal-class");
  }

  function save() {
    var name = Utils.el("c-name").value.trim();
    if (!name) { Dialog.alert("Please enter a class name."); return; }

    var cls = {
      name:  name,
      day:   Utils.el("c-day").value,
      level: Utils.el("c-level").value,
      start: Utils.el("c-start").value,
      end:   Utils.el("c-end").value,
      tutor: Utils.el("c-tutor").value,
      room:  Utils.el("c-room").value,
      fee:   Utils.el("c-fee").value,
      repeat: Utils.el("c-repeat").value,
      date:  Utils.el("c-repeat").value === "once" ? Utils.el("c-date").value : "",
      eventId: _editIdx >= 0 ? (Data.get().classes[_editIdx].eventId || "") : ""
    };
    if (cls.repeat === "once") {
      if (!cls.date) { Dialog.alert("Choose the date of the class."); return; }
      cls.day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(cls.date + "T00:00:00").getDay()];
    }

    var D = Data.get();
    if (_editIdx >= 0) {
      D.classes[_editIdx] = cls;
      Data.log("Updated class <b>" + name + "</b>");
    } else {
      D.classes.push(cls);
      Data.log("Added class <b>" + name + "</b>");
    }
    Data.save();
    Utils.closeModal("modal-class");
    render();
    _toCalendar(cls);
  }

  // Add / update the class in Google Calendar (when it's turned on)
  function _toCalendar(cls) {
    if (Settings.get("calOn") !== "yes") return;
    Data.api("calendarSync", { cls: cls }).then(function (r) {
      if (!r.ok) { Dialog.alert("The class is saved in PT, but Google Calendar wasn't updated: " + (r.error || "please try again.")); return; }
      if (r.eventId && r.eventId !== cls.eventId) { cls.eventId = r.eventId; Data.save(); render(); }
    });
  }
  function toggleRepeat() {
    var once = Utils.el("c-repeat").value === "once";
    Utils.el("c-date-row").style.display = once ? "" : "none";
    Utils.el("c-day-row").style.display = once ? "none" : "";
  }
  function _esc(s) { return String(s).replace(/[&<>]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
  function _date(d) {
    if (!d) return "?";
    var x = new Date(d + "T00:00:00");
    return isNaN(x) ? d : x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  // Settings → Google Calendar: put every class in the calendar
  function syncAll(btn) {
    var D = Data.get();
    btn.disabled = true; btn.textContent = "Adding\u2026";
    // give a just-changed setting a moment to reach the server first
    new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () {
      return Data.api("calendarAll", { classes: D.classes }, 300000);
    }).then(function (r) {
      btn.disabled = false; btn.textContent = "Add all classes now";
      var out = Utils.el("cal-result");
      if (!r.ok) { out.className = "import-msg err"; out.innerHTML = "&#9888; " + (r.error || "Google Calendar wasn't updated."); return; }
      (r.eventIds || []).forEach(function (id, i) { if (D.classes[i] && id) D.classes[i].eventId = id; });
      Data.log("Added the classes to Google Calendar");
      Data.save();
      out.className = "import-msg ok";
      out.innerHTML = "<b>&#10004; Done.</b> " + r.count + (r.count === 1 ? " class is" : " classes are") + " in the \u201cPT Classes\u201d Google Calendar.";
    });
  }

  function del(i, done) {
    Dialog.confirm("Delete the class \u201c" + Data.get().classes[i].name + "\u201d?", {okText:"Delete", danger:true}).then(function (ok) {
      if (!ok) return;
      var D = Data.get();
      var n = D.classes[i].name, ev = D.classes[i].eventId;
      D.classes.splice(i, 1);
      if (ev) Data.api("calendarDelete", { eventId: ev }).then(function (r) {
        if (!r.ok) Dialog.alert("The class is deleted in PT, but it is still in Google Calendar: " + (r.error || ""));
      });
      Data.log("Removed class <b>" + n + "</b>");
      Data.save();
      render();
      if (done) done();
    });
  }

  function delCurrent() {
    if (_editIdx < 0) return;
    del(_editIdx, function () { Utils.closeModal("modal-class"); });
  }

  return { render: render, openModal: openModal, save: save, del: del, delCurrent: delCurrent,
           toggleRepeat: toggleRepeat, syncAll: syncAll };
})();
