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
  function curYm() {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0");
  }

  // ---- Full name helper ----
  function fullName(s) { return [s.fname, s.lname].filter(function (x) { return x; }).join(" "); }

  return { el: el, closeModal: closeModal, openModal: openModal,
           flash: flash, setSyncStatus: setSyncStatus, curYm: curYm, fullName: fullName };
})();


// ================================================================
//  Navigation — page routing and topbar
// ================================================================

var currentPage = "dashboard";

var PAGE_CFG = {
  dashboard: {title:"Dashboard",        sub:"Students, income and teaching hours for the academic year", btn:null},
  students:  {title:"Students",         sub:"Everyone enrolled, with contact details and status", btn:"+ Add student", action:function(){ Students.openModal(); }},
  classes:   {title:"Class schedule",   sub:"Weekly classes by grade", btn:"+ Add class",   action:function(){ Classes.openModal(); }},
  attsheet:  {title:"Attendance",       sub:"Mark present or absent for each class day", btn:null},
  syllabus:  {title:"Monthly planner",  sub:"Chapter and timing for each day of the month", btn:null},
  payments:  {title:"Payments",         sub:"Monthly fees by student", btn:null},
  scores:    {title:"Scores & grades",  sub:"Tests, quizzes and exams", btn:"+ Add score",   action:function(){ Scores.openModal(); }},
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
  else if (id === "students")  Students.render();
  else if (id === "classes")   Classes.render();
  else if (id === "attsheet")  Attendance.init();
  else if (id === "syllabus")  Syllabus.init();
  else if (id === "payments")  Payments.init();
  else if (id === "scores")    Scores.render();
  else if (id === "settings")  { SettingsPage.init(); Users.load(); StoragePage.load(); }
  else if (id === "help")      Help.init();
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
