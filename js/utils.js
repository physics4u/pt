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
  function fullName(s) { return s.fname + " " + s.lname; }

  return { el: el, closeModal: closeModal, openModal: openModal,
           flash: flash, setSyncStatus: setSyncStatus, curYm: curYm, fullName: fullName };
})();


// ================================================================
//  Navigation — page routing and topbar
// ================================================================

var currentPage = "dashboard";

var PAGE_CFG = {
  dashboard: {title:"Dashboard",        btn:null},
  students:  {title:"Students",         btn:"+ Add Student", action:function(){ Students.openModal(); }},
  classes:   {title:"Class Schedule",   btn:"+ Add Class",   action:function(){ Classes.openModal(); }},
  attsheet:  {title:"Attendance Sheet", btn:null},
  syllabus:  {title:"Monthly Planner",  btn:null},
  payments:  {title:"Payments",         btn:null},
  scores:    {title:"Scores & Grades",  btn:"+ Add Score",   action:function(){ Scores.openModal(); }},
  profile:   {title:"Student Profile",  btn:null},
  settings:  {title:"Settings", btn:null}
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
  else if (id === "settings")  SettingsPage.init();
}

function topbarAction() {
  var cfg = PAGE_CFG[currentPage];
  if (cfg && cfg.action) cfg.action();
}
