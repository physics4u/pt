// ================================================================
//  JS_Utils — Shared helpers used by all modules
//  el(), closeModal(), setSyncStatus(), flash(), curYm(), nav
// ================================================================

var Utils = (function () {

  // ---- DOM shorthand ----
  function el(id) { return document.getElementById(id); }

  // ---- Modal ----
  function closeModal(id) { el(id).classList.remove("open"); }
  function openModal(id)  { el(id).classList.add("open");    }

  // ---- Flash button ----
  function flash(btn) {
    var orig = btn.textContent;
    btn.textContent = "Saved!";
    btn.style.background = "var(--accent3)";
    btn.style.color = "#0a0b0a";
    setTimeout(function () {
      btn.textContent = orig;
      btn.style.background = "";
      btn.style.color = "";
    }, 1500);
  }

  // ---- Sync status indicator in sidebar footer ----
  // Sync status: silent when all is well. Only shows "Saving…" briefly
  // and problems that need attention.
  function setSyncStatus(state, detail) {
    var e = el("sync-status"); if (!e) return;
    var map = {
      saving:       {text:"Saving\u2026",             color:"var(--text3)"},
      error:        {text:"\u26a0 Not saved",          color:"var(--danger)"},
      unconfigured: {text:"\u26a0 Not connected",      color:"var(--danger)"}
    };
    var info = map[state];
    if (!info) { e.textContent = ""; e.style.display = "none"; return; }
    e.style.display = "";
    e.textContent = info.text + (detail ? ": " + detail : "");
    e.style.color = info.color;
    if (state === "error") console.error("PT sync error:", detail || "unknown");
  }

  // ---- Current YYYY-MM ----
  function curYm() { return ptToday().ym; }
  // Today as "YYYY-MM-DD" in PT's time zone (for date boxes)
  function todayIso() { return ptToday().iso; }
  // ---- Dates: always "01 Jan 2026" ----
  var MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  // "2026-01-01", a Date, or "" → "01 Jan 2026" (or "" / the original text if it isn't a date)
  function fmtDate(v) {
    if (v === null || v === undefined || v === "") return "";
    var y, m, d;
    if (v instanceof Date) { if (isNaN(v)) return ""; y = v.getFullYear(); m = v.getMonth(); d = v.getDate(); }
    else {
      var x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
      if (!x) return String(v);
      y = +x[1]; m = +x[2] - 1; d = +x[3];
    }
    return String(d).padStart(2, "0") + " " + MON3[m] + " " + y;
  }
  // Short weekday for a date: "Mon"
  function weekday(v) {
    var x = v instanceof Date ? v : new Date(String(v).slice(0, 10) + "T00:00:00");
    return isNaN(x) ? "" : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][x.getDay()];
  }
  // A date-time in PT's time zone: "09 Nov 2026 16:45"
  function dateTime(d) {
    d = d instanceof Date ? d : new Date(d);
    if (isNaN(d)) return "";
    var p = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: PT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return fmtDate(p.year + "-" + p.month + "-" + p.day) + " " + (p.hour === "24" ? "00" : p.hour) + ":" + p.minute;
  }

  // ---- A student's class in the academic year shown ----
  // Imported years record it in yearCls ("2025-03:Grade XI;2026-03:Grade XII").
  // The current year always uses the class on the student's record.
  function clsOf(s) {
    if (!s) return "";
    if (isCurrentAcad() || !s.yearCls) return s.cls || "";
    var m = new RegExp("(?:^|;)" + ACYR[0] + ":([^;]+)").exec(String(s.yearCls));
    return m ? m[1] : "";
  }

  // ---- Active students ----
  // Current academic year: status is not Inactive and the end date hasn't passed.
  // An earlier year: the student was there that year (in its records) and did
  // not leave partway through it (no end date before the year ended).
  function isActive(s) {
    if (!s) return false;
    if (isCurrentAcad()) {
      if (!inYear(s) || s.status === "Inactive") return false;
      return !(s.endDate && s.endDate < todayIso());
    }
    if (!inYear(s)) return false;
    return !(s.endDate && s.endDate < acadLastDay());
  }
  // Status to show for the year on screen
  function statusIn(s) {
    if (isCurrentAcad()) return s.status || "Active";
    return isActive(s) ? "Active" : "Inactive";
  }
  // Was the student with PT at all in the academic year shown?
  function inYear(s) {
    if (isCurrentAcad()) {
      // enrolled this year (recorded when imported or added/saved). Nothing
      // carries over: a new academic year starts with no students.
      if (new RegExp("(?:^|;)" + defaultAcadStart() + ":").test(String(s.yearCls || ""))) return true;
      if (s.yearCls) return false;                   // enrolled only in other years
      return true;                                   // no year recorded: from before PT kept years, i.e. this year
    }
    var first = acadFirstDay(), last = acadLastDay();
    if (s.yearCls) return !!clsOf(s);                 // imported: listed in that year's records or not
    if (s.startDate && s.startDate <= last && (!s.endDate || s.endDate >= first)) return true;
    var D = Data.get(), name = fullName(s);
    var inMonths = function (obj, prefix) {
      return ACYR.some(function (ym) {
        var g = (obj || {})[prefix + "|" + clsOf(s) + "|" + ym] || {}, r = g[name];
        return r && Object.keys(r).some(function (k) { return r[k] && r[k] !== "--"; });
      });
    };
    if (inMonths(D.attsheets, "attsheet")) return true;
    if ((D.paygrid ? inMonths(D.paygrid, "paygrid") : false)) {
      // a paygrid row may just hold the default fee; count it only with a status
      if (ACYR.some(function (ym) { var r = ((D.paygrid["paygrid|" + clsOf(s) + "|" + ym]) || {})[name]; return r && r.status; })) return true;
    }
    var inYear = function (d) { return d && d >= first && d <= last; };
    if ((D.sessions || []).some(function (x) { return x.student === name && inYear(x.date); })) return true;
    if ((D.hourpay || []).some(function (x) { return x.student === name && inYear(x.date); })) return true;
    return (D.scores || []).some(function (x) { return x.student === name && inYear(x.date); });
  }

  // ---- "Show inactive students" — one switch shared by every page ----
  var _showAll = false;
  function showAll() { return _showAll; }
  function setShowAll(on) {
    _showAll = !!on;
    document.querySelectorAll(".show-all-toggle input").forEach(function (i) { i.checked = _showAll; });
    if (currentPage === "students") Students.render();
    else if (currentPage === "attsheet") Attendance.render();
    else if (currentPage === "payments") Payments.render();
    else if (currentPage === "scores") Scores.render();
  }
  // The checkbox shown on each page's toolbar
  function showAllBox() {
    return "<label class='check show-all-toggle'><input type='checkbox'" + (_showAll ? " checked" : "") +
           " onchange='Utils.setShowAll(this.checked)'> Show inactive students</label>";
  }
  // Names of the students in the year on screen
  function rosterNames() { var m = {}; Data.allStudents().forEach(function (s) { m[fullName(s)] = true; }); return m; }
  // Name → class in the year on screen. In March/April (shared by two years) an
  // entry for "Plus 2" belongs to the year in which that student was Plus 2.
  function rosterCls() { var m = {}; Data.allStudents().forEach(function (s) { var c = clsOf(s); if (c) m[fullName(s)] = c; }); return m; }
  function shown(s) { return _showAll || isActive(s); }
  function openYear() { showPage("settings"); var d = el("sec-acad"); if (d) { d.open = true; d.scrollIntoView({block: "center"}); } }

  // ---- Grade label: data says "Grade XI", people see "Plus 1" ----
  function grade(cls) { return cls === "Grade XI" ? "Plus 1" : cls === "Grade XII" ? "Plus 2" : (cls || ""); }

  // ---- A student's name that opens their profile ----
  function _attr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function studentLink(name) {
    return "<a class=\"stu-link\" data-student=\"" + _attr(name) + "\" title=\"Open profile\">" + _attr(name) + "</a>";
  }
  // A small ✏ that only shows when the row is hovered (always on touch screens)
  function hoverEdit(onclick, title) {
    return "<button type=\"button\" class=\"row-edit\" title=\"" + _attr(title || "Edit") + "\" onclick=\"" + _attr(onclick) + "\">&#9998;</button>";
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".stu-link");
    if (a) { e.preventDefault(); Profile.byName(a.getAttribute("data-student")); }
  });

  // ---- Full name helper ----
  function fullName(s) { return [s.fname, s.lname].filter(function (x) { return x; }).join(" "); }

  return { el: el, closeModal: closeModal, openModal: openModal,
           flash: flash, setSyncStatus: setSyncStatus, curYm: curYm, todayIso: todayIso, dateTime: dateTime,
           fmtDate: fmtDate, weekday: weekday,
           isActive: isActive, inYear: inYear, rosterNames: rosterNames, rosterCls: rosterCls, statusIn: statusIn, clsOf: clsOf, showAll: showAll, openYear: openYear, setShowAll: setShowAll, showAllBox: showAllBox, shown: shown,
           fullName: fullName, grade: grade,
           studentLink: studentLink, hoverEdit: hoverEdit };
})();


// ================================================================
//  Navigation — page routing and topbar
// ================================================================

var currentPage = "dashboard";

var PAGE_CFG = {
  dashboard: {title:"Dashboard",        sub:"", btn:null},
  students:  {title:"Students",         sub:"Everyone enrolled, with contact details and status", btn:"+ Add student", action:function(){ Students.openModal(); }},
  classes:   {title:"Class schedule",   sub:"Weekly classes by grade", btn:"+ Add class",   action:function(){ Classes.openModal(); }},
  attsheet:  {title:"Attendance",       sub:"Mark present or absent for each class day", btn:null},
  syllabus:  {title:"Monthly planner",  sub:"Chapter and timing for each day of the month", btn:null},
  payments:  {title:"Payments",         sub:"Monthly fees by student", btn:null},
  scores:    {title:"Scores",           sub:"Class tests and each student's marks", btn:"+ Add test", action:function(){ Scores.openModal(); }},
  profile:   {title:"Student profile",  sub:"", btn:null},
  help:      {title:"Help",             sub:"About PT and the user guide", btn:null},
  settings:  {title:"Settings",         sub:"Users, chapter lists, academic year, storage, backups and appearance", btn:null}
};

function showPage(id) {
  document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
  document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });

  var pg = Utils.el("page-" + id);
  if (pg) pg.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(function (n) {
    if (n.getAttribute("data-page") === id) n.classList.add("active");
  });

  currentPage = id;
  var cfg = PAGE_CFG[id] || {title:id, btn:null};
  Utils.el("page-title").textContent = cfg.title;
  Utils.el("page-sub").textContent   = cfg.sub || "";

  var btn = Utils.el("topbar-action");
  if (cfg.btn) { btn.textContent = cfg.btn; btn.style.display = ""; }
  else { btn.style.display = "none"; }

  // Page-specific init
  if      (id === "dashboard") Dashboard.render();
  else if (id === "students")  Students.show();
  else if (id === "classes")   Classes.render();
  else if (id === "attsheet")  Attendance.init();
  else if (id === "syllabus")  Syllabus.init();
  else if (id === "payments")  Payments.init();
  else if (id === "scores")    Scores.show();
  else if (id === "settings")  { SettingsPage.init(); Users.load(); StoragePage.load(); }
  else if (id === "help")      Help.init();
}

// ================================================================
//  Academic year shown — defaults to the current one each time PT
//  opens; Settings → Academic year switches it for this visit.
//  Everything that depends on the year is refreshed here.
// ================================================================
var _viewYear = null;     // null = the current academic year
function applyAcademicYear(start) {
  _viewYear = start && start !== defaultAcadStart() ? start : null;
  setAcademicYear(_viewYear || defaultAcadStart());
  var yc = Utils.el("year-chip");
  if (yc) {
    yc.textContent = acadLabel() + (isCurrentAcad() ? "" : " \u00b7 earlier year");
    yc.classList.toggle("past", !isCurrentAcad());
    yc.title = isCurrentAcad() ? "Academic year (change in Settings)" : "You are viewing an earlier academic year. Click to change.";
  }
  document.querySelectorAll(".acad-label").forEach(function (e) { e.textContent = "Academic year " + acadLabel(); });
  ["attsheet-month", "syllabus-month"].forEach(function (id) {
    var sel = Utils.el(id); if (!sel) return;
    var keep = sel.value;                              // keep the chosen month if it's in this year
    sel.innerHTML = ACYR.map(function (ym) { return "<option value='" + ym + "'>" + ACYR_LBL[ym] + "</option>"; }).join("");
    if (keep && ACYR.indexOf(keep) >= 0) sel.value = keep;
  });
}
function viewYear() { return _viewYear || defaultAcadStart(); }

// Redraw the page on screen without resetting it (open sections, month, search stay)
function refreshPage() {
  var p = currentPage;
  if (p === "dashboard") Dashboard.render();
  else if (p === "students") Students.render();
  else if (p === "classes") Classes.render();
  else if (p === "attsheet") Attendance.render();
  else if (p === "syllabus") Syllabus.render();
  else if (p === "payments") Payments.render();
  else if (p === "scores") Scores.render();
  else if (p === "profile") { if (typeof Profile.refresh === "function") Profile.refresh(); }
  else if (p === "settings") SettingsPage.init();
  else if (p === "help") Help.init();
}

function topbarAction() {
  var cfg = PAGE_CFG[currentPage];
  if (cfg && cfg.action) cfg.action();
}

// ================================================================
//  Dialog — PT-styled replacements for alert() / confirm().
//  The browser's own boxes show the website address as the title
//  and ignore the app's colours; these match the dashboard.
//    Dialog.alert("Saved")                       → Promise
//    Dialog.confirm("Delete?", {okText:"Delete", danger:true}) → Promise<bool>
// ================================================================
var Dialog = (function () {
  var _open = null;

  function _build() {
    var o = document.createElement("div");
    o.className = "modal-overlay dialog-overlay";
    o.innerHTML =
      "<div class='modal dialog' role='alertdialog' aria-modal='true' aria-labelledby='dlg-title'>" +
        "<div class='dialog-head'><img src='logo.png' alt=''><span id='dlg-title'>PT &mdash; Physics Tuition</span></div>" +
        "<div class='dialog-msg' id='dlg-msg'></div>" +
        "<div class='dialog-actions'>" +
          "<button class='btn btn-secondary' id='dlg-cancel'>Cancel</button>" +
          "<button class='btn btn-primary' id='dlg-ok'>OK</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(o);
    return o;
  }

  function _show(msg, opts, withCancel) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var o = document.querySelector(".dialog-overlay") || _build();
      var ok = o.querySelector("#dlg-ok"), cancel = o.querySelector("#dlg-cancel");
      o.querySelector("#dlg-msg").textContent = msg;
      ok.textContent = opts.okText || "OK";
      ok.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
      cancel.textContent = opts.cancelText || "Cancel";
      cancel.style.display = withCancel ? "" : "none";
      function done(v) {
        o.classList.remove("open");
        document.removeEventListener("keydown", onKey, true);
        ok.onclick = cancel.onclick = o.onclick = null;
        _open = null;
        resolve(v);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); done(false); }
        else if (e.key === "Enter") { e.preventDefault(); done(true); }
      }
      ok.onclick = function () { done(true); };
      cancel.onclick = function () { done(false); };
      o.onclick = function (e) { if (e.target === o) done(false); };
      document.addEventListener("keydown", onKey, true);
      o.classList.add("open");
      _open = o;
      setTimeout(function () { (withCancel ? cancel : ok).focus(); }, 30);
    });
  }

  function alert(msg, opts)   { return _show(msg, opts, false); }
  function confirm(msg, opts) { return _show(msg, opts, true); }
  return { alert: alert, confirm: confirm };
})();


// ================================================================
//  Date boxes show "01 Jan 2026" whatever the computer's language.
//  Every <input type="date"> is kept (it holds the value as 2026-01-01)
//  but hidden behind a box that shows the PT format and opens the
//  calendar when clicked.
// ================================================================
(function () {
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(HTMLInputElement.prototype, "value", {
    configurable: true,
    get: function () { return desc.get.call(this); },
    set: function (v) { desc.set.call(this, v); if (this._ptSync) this._ptSync(); }
  });

  function enhance(inp) {
    if (inp._ptSync || inp.type !== "date") return;
    var box = document.createElement("span");
    box.className = "pt-datebox";
    inp.parentNode.insertBefore(box, inp);
    box.appendChild(inp);
    var show = document.createElement("span"); show.className = "pt-date-text"; box.appendChild(show);
    var icon = document.createElement("span"); icon.className = "pt-date-icon"; icon.innerHTML = "&#128197;"; box.appendChild(icon);
    var clear = document.createElement("button"); clear.type = "button"; clear.className = "pt-date-clear"; clear.title = "Clear"; clear.innerHTML = "&#215;";
    box.appendChild(clear);
    inp._ptSync = function () {
      var v = desc.get.call(inp);
      show.textContent = v ? Utils.fmtDate(v) : (inp.getAttribute("placeholder") || "Choose a date");
      box.classList.toggle("empty", !v);
      box.classList.toggle("disabled", !!inp.disabled);
      clear.style.display = v && !inp.required && !inp.disabled ? "" : "none";
    };
    inp._ptSync();
    inp.addEventListener("input", inp._ptSync);
    inp.addEventListener("change", inp._ptSync);
    box.addEventListener("click", function (e) {
      if (e.target === clear || inp.disabled) return;
      try { inp.showPicker(); } catch (x) { inp.focus(); inp.click(); }
    });
    clear.addEventListener("click", function (e) {
      e.stopPropagation();
      desc.set.call(inp, ""); inp._ptSync();
      inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  function scan(root) {
    if (root.querySelectorAll) root.querySelectorAll("input[type=date]").forEach(enhance);
    if (root.tagName === "INPUT") enhance(root);
  }
  function start() {
    scan(document);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
        if (m.type === "attributes" && m.target._ptSync) m.target._ptSync();
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();


// ================================================================
//  Password boxes: an eye button shows or hides what was typed.
//  Added to every <input type="password">, including ones added later.
// ================================================================
(function () {
  var EYE = "<svg viewBox='0 0 24 24' width='18' height='18' aria-hidden='true'><path fill='none' stroke='currentColor' stroke-width='2' d='M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z'/><circle cx='12' cy='12' r='3' fill='none' stroke='currentColor' stroke-width='2'/></svg>";
  var EYE_OFF = "<svg viewBox='0 0 24 24' width='18' height='18' aria-hidden='true'><path fill='none' stroke='currentColor' stroke-width='2' d='M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z'/><circle cx='12' cy='12' r='3' fill='none' stroke='currentColor' stroke-width='2'/><path d='M3 3l18 18' stroke='currentColor' stroke-width='2'/></svg>";
  function enhance(inp) {
    if (inp._ptEye || inp.type !== "password") return;
    inp._ptEye = true;
    var wrap = document.createElement("span"); wrap.className = "pt-pwbox";
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "pt-eye"; btn.tabIndex = -1;
    var set = function (show) {
      inp.type = show ? "text" : "password";
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.title = show ? "Hide password" : "Show password";
      btn.setAttribute("aria-label", btn.title);
    };
    set(false);
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });   // keep the cursor in the box
    btn.addEventListener("click", function () { set(inp.type === "password"); inp.focus(); });
    wrap.appendChild(btn);
    // hide it again when the form is sent or the box is cleared
    if (inp.form) inp.form.addEventListener("submit", function () { set(false); });
    inp._ptHide = function () { set(false); };
  }
  function scan(root) {
    if (root.querySelectorAll) root.querySelectorAll("input[type=password]").forEach(enhance);
    if (root.tagName === "INPUT") enhance(root);
  }
  function start() {
    scan(document);
    new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
