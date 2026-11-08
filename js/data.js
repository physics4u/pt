// ================================================================
//  data.js — Application data layer
//  Owns: D (the data object), sync with the PT Google Sheet through
//  the Apps Script API, and a localStorage cache for fast start-up.
//  Other modules READ from D and call Data.save() to persist.
//
//  Safety rules:
//   • Nothing is ever written to the sheet until a load from the
//     sheet has succeeded in this session (so a failed load can
//     never overwrite real data with an empty or cached copy).
//   • Only the parts of D that changed since the last sync are sent.
// ================================================================

var Data = (function () {

  var KEYS = ["students","classes","scores","activity",
              "attendance","attsheets","syllabus","paygrid","settings"];

  var D = {
    students: [], classes: [], scores: [], activity: [],
    attendance: {}, attsheets: {}, syllabus: {}, paygrid: {}, settings: {}
  };

  var CACHE_KEY = "pt_cache_v1";
  var PASS_KEY  = "pt_passcode";

  var _synced    = {};     // key → JSON string last confirmed by the server
  var _loaded    = false;  // true once a server load succeeded
  var _saveTimer = null;
  var _saving    = false;

  function get()          { return D; }
  function _url()         { return (window.PT_CONFIG && PT_CONFIG.apiUrl) || ""; }
  function isConfigured() { return /^https:\/\/script\.google\.com\/.+\/exec$/.test(_url()); }

  // ---- Safe localStorage (private windows can throw) ----
  function _lsGet(k)    { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function _lsDel(k)    { try { localStorage.removeItem(k); } catch (e) {} }

  // ----------------------------------------------------------------
  //  INIT — show cached data instantly, then refresh from the sheet
  // ----------------------------------------------------------------
  function init() {
    _loadFromCache();
    _afterApply();
    if (!isConfigured()) {
      Utils.setSyncStatus("unconfigured", "set apiUrl in js/site-config.js");
      return;
    }
    if (!_lsGet(PASS_KEY)) { Login.show(); return; }
    _loadFromSheets(1);
  }

  function login(passcode) {
    _lsSet(PASS_KEY, passcode);
    _loadFromSheets(1);
  }

  function logout() {
    _lsDel(PASS_KEY);
    _lsDel(CACHE_KEY);
    location.reload();
  }

  // ----------------------------------------------------------------
  //  API call — POST with a text/plain body (no CORS preflight)
  // ----------------------------------------------------------------
  function _call(action, data) {
    var body = JSON.stringify({ action: action, token: _lsGet(PASS_KEY) || "", data: data });
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    return fetch(_url(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      redirect: "follow",
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function (err) {
      clearTimeout(timer);
      return { ok: false, error: err.name === "AbortError" ? "timeout" : "network error (" + err.message + ")" };
    });
  }

  function _callWithRetry(action, data, attempt) {
    attempt = attempt || 1;
    return _call(action, data).then(function (resp) {
      if (resp.ok || resp.error === "unauthorized" || attempt >= 3) return resp;
      return new Promise(function (res) { setTimeout(res, 2000 * attempt); })
        .then(function () { return _callWithRetry(action, data, attempt + 1); });
    });
  }

  // ----------------------------------------------------------------
  //  LOAD
  // ----------------------------------------------------------------
  function _loadFromSheets() {
    Utils.setSyncStatus("loading");
    _callWithRetry("load").then(function (resp) {
      if (resp.ok && resp.data) {
        _apply(resp.data);
        KEYS.forEach(function (k) { _synced[k] = JSON.stringify(D[k]); });
        _loaded = true;
        _lsSet(CACHE_KEY, JSON.stringify(D));
        Login.hide();
        Utils.setSyncStatus("loaded");
        _afterApply();
      } else if (resp.error === "unauthorized") {
        _lsDel(PASS_KEY);
        Login.show("Wrong passcode — please try again.");
        Utils.setSyncStatus("error", "not signed in");
      } else {
        Utils.setSyncStatus("error", (resp.error || "no response") + " — showing cached copy, changes NOT saved");
      }
    });
  }

  function reload() { _loadFromSheets(); }

  function _loadFromCache() {
    var raw = _lsGet(CACHE_KEY);
    if (!raw) return;
    try { _apply(JSON.parse(raw)); } catch (e) {}
  }

  function _apply(d) {
    D.students   = d.students   || [];
    D.classes    = d.classes    || [];
    D.scores     = d.scores     || [];
    D.activity   = d.activity   || [];
    D.attendance = d.attendance || {};
    D.attsheets  = d.attsheets  || {};
    D.syllabus   = d.syllabus   || {};
    D.paygrid    = d.paygrid    || {};
    D.settings   = d.settings   || {};

    D.scores.forEach(function (sc) {
      sc.score = Number(sc.score) || 0;
      sc.total = Number(sc.total) || 100;
    });

    // Tidy names so attendance / payment keys match (e.g. "Nalini  Baburaj ").
    D.students.forEach(function (s) {
      s.fname = String(s.fname || "").replace(/\s+/g, " ").trim();
      s.lname = String(s.lname || "").replace(/\s+/g, " ").trim();
    });

    // Status: a past end date always means Inactive. Otherwise keep the
    // status the tutor chose (Active / Trial / Inactive); blank → Active.
    var today = new Date(); today.setHours(0,0,0,0);
    D.students.forEach(function (s) {
      if (s.endDate) {
        var end = new Date(s.endDate); end.setHours(0,0,0,0);
        if (!isNaN(end) && end <= today) { s.status = "Inactive"; return; }
      }
      if (!s.status) s.status = "Active";
    });
  }

  function _afterApply() {
    setAcademicYear(D.settings && D.settings.acadStart);
    if (typeof currentPage !== "undefined" && typeof showPage === "function") showPage(currentPage);
    else Dashboard.render();
  }

  // ----------------------------------------------------------------
  //  SAVE — debounced; sends only the keys that changed
  // ----------------------------------------------------------------
  function save() {
    _lsSet(CACHE_KEY, JSON.stringify(D));
    if (!_loaded) {
      Utils.setSyncStatus("error", "not connected — this change is NOT saved to the sheet");
      return;
    }
    Utils.setSyncStatus("pending");
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_flush, 1500);
  }

  function _flush() {
    if (_saving) { _saveTimer = setTimeout(_flush, 2000); return; }
    var changed = {}, snap = {}, n = 0;
    KEYS.forEach(function (k) {
      var j = JSON.stringify(D[k]);
      if (j !== _synced[k]) { changed[k] = D[k]; snap[k] = j; n++; }
    });
    if (!n) { Utils.setSyncStatus("saved"); return; }

    _saving = true;
    Utils.setSyncStatus("saving");
    _callWithRetry("save", changed).then(function (resp) {
      _saving = false;
      if (resp.ok) {
        Object.keys(snap).forEach(function (k) { _synced[k] = snap[k]; });
        Utils.setSyncStatus("saved");
      } else if (resp.error === "unauthorized") {
        _lsDel(PASS_KEY);
        Login.show("Session expired — enter the passcode to keep saving.");
      } else {
        Utils.setSyncStatus("error", resp.error || "save failed");
      }
    });
  }

  function hasUnsaved() {
    return _loaded && KEYS.some(function (k) { return JSON.stringify(D[k]) !== _synced[k]; });
  }

  window.addEventListener("beforeunload", function (e) {
    if (hasUnsaved()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---- Activity log ----
  function _time() {
    var n = new Date();
    return n.toLocaleDateString("en-GB", {day:"2-digit", month:"short"}) + " " +
           n.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  }

  function log(txt) {
    D.activity.unshift({ text: txt, time: _time() });
    if (D.activity.length > 50) D.activity.length = 50;
  }

  function allStudents() {
    return D.students.slice().sort(function (a, b) {
      var ca = a.cls || "", cb = b.cls || "";
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.fname + " " + a.lname).localeCompare(b.fname + " " + b.lname);
    });
  }

  function backup() { return _call("backup"); }

  return {
    get: get, isConfigured: isConfigured,
    init: init, login: login, logout: logout,
    save: save, reload: reload, log: log, backup: backup,
    allStudents: allStudents, hasUnsaved: hasUnsaved
  };
})();

// ================================================================
//  Login — passcode overlay
// ================================================================
var Login = (function () {
  function show(msg) {
    var o = document.getElementById("login-overlay");
    o.classList.add("open");
    document.getElementById("login-msg").textContent = msg || "";
    setTimeout(function () { document.getElementById("login-pass").focus(); }, 50);
  }
  function hide() { document.getElementById("login-overlay").classList.remove("open"); }
  function submit(e) {
    if (e) e.preventDefault();
    var p = document.getElementById("login-pass").value.trim();
    if (!p) return false;
    document.getElementById("login-msg").textContent = "Checking…";
    Data.login(p);
    return false;
  }
  return { show: show, hide: hide, submit: submit };
})();
