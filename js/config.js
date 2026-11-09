// ================================================================
//  JS_Config — Global constants
//  MONTHS, DAYS, TIMES are fixed. ACYR is computed.
//  Chapter lists are editable via the Settings page and stored
//  with the rest of PT's data. Use Settings.chapters("Grade XI") etc. to
//  get the live list anywhere in the app.
// ================================================================

var MONTHS = ["January","February","March","April","May","June",
              "July","August","September","October","November","December"];

var DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ----------------------------------------------------------------
//  Academic year — 14 months starting in March (e.g. Mar 2026 → Apr 2027).
//  Computed from today's date unless Settings → "Academic year start"
//  overrides it. ACYR / ACYR_LBL are updated IN PLACE so every module
//  that already holds a reference sees the new months.
// ----------------------------------------------------------------
var ACYR = [];
var ACYR_LBL = {};

// ----------------------------------------------------------------
//  Time zone — PT works out "today" in this zone (Settings → Region).
//  Default India.
// ----------------------------------------------------------------
var PT_TZ = "Asia/Kolkata";
function setTimeZone(tz) {
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); PT_TZ = tz || "Asia/Kolkata"; }
  catch (e) { PT_TZ = "Asia/Kolkata"; }
}
// Today in PT's time zone: {y, m, d, ym:"2026-11", iso:"2026-11-09", date: Date at local midnight of that day}
function ptToday() {
  var parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: PT_TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).forEach(function (x) { parts[x.type] = x.value; });
  var y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  return { y: y, m: m, d: d, ym: y + "-" + parts.month, iso: y + "-" + parts.month + "-" + parts.day, date: new Date(y, m - 1, d) };
}

function defaultAcadStart() {
  var t = ptToday();
  return (t.m >= 3 ? t.y : t.y - 1) + "-03";
}
// "2026–27" for the academic year shown (or for a start like "2025-03")
function acadLabel(start) {
  var y = Number((start || ACYR[0]).slice(0, 4));
  return y + "\u2013" + String(y + 1).slice(2);
}
// Months whose fees, attendance and marks can belong to the year shown: an
// earlier year also owns its students' entries in the March and April after it
// (those months are shared with the next year; names tell them apart).
function acadEntryMonths() {
  var m = ACYR.slice();
  if (m.length === 12) {
    var last = m[m.length - 1].split("-"), y = +last[0], mo = +last[1];
    for (var i = 0; i < 2; i++) { mo++; if (mo > 12) { mo = 1; y++; } m.push(y + "-" + String(mo).padStart(2, "0")); }
  }
  return m;
}
function acadEntryLastDay() {
  var m = acadEntryMonths(), last = m[m.length - 1], p = last.split("-");
  return last + "-" + String(new Date(+p[0], +p[1], 0).getDate()).padStart(2, "0");
}
function isCurrentAcad() { return ACYR[0] === defaultAcadStart(); }
// First and last day of the academic year shown, "YYYY-MM-DD"
function acadFirstDay() { return ACYR[0] + "-01"; }
function acadLastDay() {
  var last = ACYR[ACYR.length - 1], p = last.split("-");
  return last + "-" + String(new Date(Number(p[0]), Number(p[1]), 0).getDate()).padStart(2, "0");
}

function setAcademicYear(startYm) {
  var m = /^(\d{4})-(\d{2})$/.exec(startYm || "") || /^(\d{4})-(\d{2})$/.exec(defaultAcadStart());
  var y = Number(m[1]), mo = Number(m[2]);
  ACYR.length = 0;
  Object.keys(ACYR_LBL).forEach(function (k) { delete ACYR_LBL[k]; });
  // The current year shows 14 months (March to the following April). An
  // earlier year shows March to February: its last March and April are the
  // first months of the next year, and are counted there.
  var n = (y + "-" + String(mo).padStart(2, "0")) < defaultAcadStart() ? 12 : 14;
  for (var i = 0; i < n; i++) {
    var ym = y + "-" + String(mo).padStart(2, "0");
    ACYR.push(ym);
    ACYR_LBL[ym] = MONTHS[mo - 1] + " " + y;
    mo++; if (mo > 12) { mo = 1; y++; }
  }
}
setAcademicYear();

var TIMES = [
  "--","06:00 AM","06:30 AM","07:00 AM","07:30 AM","08:00 AM","08:30 AM",
  "09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM","01:00 PM","01:30 PM","02:00 PM","02:30 PM",
  "03:00 PM","03:30 PM","04:00 PM","04:30 PM","05:00 PM","05:30 PM",
  "06:00 PM","06:30 PM","07:00 PM","07:30 PM","08:00 PM","08:30 PM",
  "09:00 PM","09:30 PM","10:00 PM"
];

// ----------------------------------------------------------------
//  Default chapter lists per grade (editable via Settings page)
//  Format: one chapter per line in the textarea.
//  "-- None --" is always prepended automatically at runtime.
// ----------------------------------------------------------------
var DEFAULT_CHAPTERS_XI = [
  "Units & Measurement",
  "Motion in a Straight Line",
  "Motion in a Plane",
  "Laws of Motion",
  "Work, Energy & Power",
  "Systems of Particles & Rotational Motion",
  "Gravitation",
  "Mechanical Properties of Solids",
  "Mechanical Properties of Fluids",
  "Thermal Properties of Matter",
  "Thermodynamics",
  "Kinetic Theory",
  "Oscillations",
  "Waves",
  "Revision / Practice",
  "Test / Exam",
  "Holiday / No Class"
];

var DEFAULT_CHAPTERS_XII = [
  "Electric Charges & Fields",
  "Electrostatic Potential & Capacitance",
  "Current Electricity",
  "Moving Charges & Magnetism",
  "Magnetism & Matter",
  "Electromagnetic Induction",
  "Alternating Current",
  "Electromagnetic Waves",
  "Ray Optics & Optical Instruments",
  "Wave Optics",
  "Dual Nature of Radiation & Matter",
  "Atoms",
  "Nuclei",
  "Semiconductor Electronics",
  "Revision / Practice",
  "Test / Exam",
  "Holiday / No Class"
];

// ----------------------------------------------------------------
//  Settings — runtime access to chapter lists.
//  Admin edits are saved to localStorage and survive reloads.
//  Call Settings.chapters("Grade XI") or Settings.chapters("Grade XII")
//  to get ["-- None --", "Chapter 1", ...] ready for a <select>.
// ----------------------------------------------------------------
var Settings = (function () {
  var KEYS = { "Grade XI": "chapters_xi", "Grade XII": "chapters_xii" };
  var DEFAULTS = { "Grade XI": DEFAULT_CHAPTERS_XI, "Grade XII": DEFAULT_CHAPTERS_XII };

  // Settings are stored with the rest of PT's data (shared by all devices).
  function _store() {
    var D = (typeof Data !== "undefined") ? Data.get() : null;
    if (D && !D.settings) D.settings = {};
    return D ? D.settings : {};
  }

  function chapters(grade) {
    var raw = _store()[KEYS[grade]];
    var list = typeof raw === "string" ? _parse(raw) : (DEFAULTS[grade] || []);
    return ["-- None --"].concat(list);
  }

  function getRaw(grade) {
    var raw = _store()[KEYS[grade]];
    return typeof raw === "string" ? raw : (DEFAULTS[grade] || []).join("\n");
  }

  function save(grade, text) {
    if (!KEYS[grade]) return;
    _store()[KEYS[grade]] = text.trim();
    Data.save();
  }

  function reset(grade) {
    if (!KEYS[grade]) return;
    delete _store()[KEYS[grade]];
    Data.save();
  }

  function get(key)       { return _store()[key]; }
  function set(key, val)  { _store()[key] = val; Data.save(); }

  function _parse(text) {
    return text.split("\n").map(function (l) { return l.trim(); })
               .filter(function (l) { return l.length > 0; });
  }

  return { chapters: chapters, getRaw: getRaw, save: save, reset: reset, get: get, set: set };
})();

// Legacy alias (Grade XI defaults) — kept for any old references.
var CHAPTERS = ["-- None --"].concat(DEFAULT_CHAPTERS_XI);
