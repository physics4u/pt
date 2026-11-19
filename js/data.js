// ================================================================
//  data.js — Application data layer
//  Owns: D (the data object), sync with the PT server through
//  its API, and a localStorage cache for fast start-up.
//  Other modules READ from D and call Data.save() to persist.
//
//  Safety rules:
//   • Nothing is ever written to the server until a load from the
//     server has succeeded in this session (so a failed load can
//     never overwrite real data with an empty or cached copy).
//   • Only the parts of D that changed since the last sync are sent.
// ================================================================

var Data = (function () {

  var KEYS = ["students","classes","scores","activity",
              "attendance","attsheets","syllabus","paygrid","settings",
              "sessions","hourpay","tests"];

  var D = {
    students: [], classes: [], scores: [], activity: [],
    attendance: {}, attsheets: {}, syllabus: {}, paygrid: {}, settings: {},
    sessions: [], hourpay: [], tests: []
  };

  var CACHE_KEY = "pt_cache_v1";
  var TOKEN_KEY = "pt_token";
  var ME_KEY    = "pt_me";

  var _me = null;            // {username, name, role} of whoever is signed in
  var _serverVersion = "";

  var _synced    = {};     // key → JSON string last confirmed by the server
  var _loaded    = false;  // true once a server load succeeded
  var _saveTimer = null;
  var _saving    = false;
  var _failed    = false;  // last save failed → warn before leaving

  function get()          { return D; }
  function _url()         { return (window.PT_CONFIG && PT_CONFIG.apiUrl) || ""; }
  function isConfigured() { return /^https:\/\/script\.google\.com\/.+\/exec$/.test(_url()); }

  // ---- Safe localStorage (private windows can throw) ----
  function _lsGet(k)    { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function _lsDel(k)    { try { localStorage.removeItem(k); } catch (e) {} }

  // ----------------------------------------------------------------
  //  INIT — show cached data instantly, then refresh from the server
  // ----------------------------------------------------------------
  function init() {
    _loadFromCache();
    _afterApply();
    if (!isConfigured()) {
      Utils.setSyncStatus("unconfigured");
      return;
    }
    try { _me = JSON.parse(_lsGet(ME_KEY) || "null"); } catch (e) { _me = null; }
    _lsDel("pt_passcode");                      // from the old passcode-only version
    if (!_lsGet(TOKEN_KEY)) { Login.show(); return; }
    _showMe();
    _loadFromServer(1);
  }

  function login(username, password) {
    return _call("login", undefined, { username: username, password: password, withData: true }).then(function (resp) {
      if (!resp.ok) return resp;
      _lsSet(TOKEN_KEY, resp.token);
      _setMe(resp.me);
      _serverVersion = resp.version || "";
      if (resp.data) _loaded_(resp);        // the data came with the sign-in reply
      else _loadFromServer(1);              // an older server: fetch it separately
      return resp;
    });
  }

  function logout() {
    _loaded = false;                 // skip the "unsaved changes" browser prompt
    _lsDel(TOKEN_KEY);
    _lsDel(ME_KEY);
    _lsDel(CACHE_KEY);
    location.reload();
  }

  function _setMe(me) {
    _me = me || null;
    _lsSet(ME_KEY, JSON.stringify(_me));
    _showMe();
  }

  // Header chip + role class (body.role-user hides admin-only parts)
  function _showMe() {
    var chip = document.getElementById("user-chip");
    document.body.classList.toggle("role-user", !!_me && _me.role !== "admin");
    if (!chip) return;
    if (!_me) { chip.style.display = "none"; return; }
    var initials = String(_me.name || _me.username).split(/\s+/).map(function (w) { return w.charAt(0); })
                     .join("").slice(0, 2).toUpperCase();
    document.getElementById("user-avatar").textContent = initials;
    document.getElementById("user-name").textContent   = _me.name || _me.username;
    document.getElementById("user-role").textContent   = _me.role === "admin" ? "Admin" : "User";
    chip.style.display = "";
  }

  function me()            { return _me; }
  function isAdmin()       { return !!_me && _me.role === "admin"; }
  function serverVersion() { return _serverVersion; }

  // ----------------------------------------------------------------
  //  API call — POST with a text/plain body (no CORS preflight)
  // ----------------------------------------------------------------
  function _call(action, data, extra, keepalive) {
    var req = { action: action, token: _lsGet(TOKEN_KEY) || "", data: data };
    if (extra) Object.keys(extra).forEach(function (k) { if (k !== "_wait") req[k] = extra[k]; });
    var body = JSON.stringify(req);
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var wait = (extra && extra._wait) || 45000;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, wait);
    return fetch(_url(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      redirect: "follow",
      keepalive: !!keepalive && body.length < 60000,   // let a last save finish as the page closes
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
  function _loadFromServer() {
    Utils.setSyncStatus("loading");
    _callWithRetry("load").then(function (resp) {
      if (resp.ok && resp.data) {
        _loaded_(resp);
      } else if (resp.error === "unauthorized") {
        _lsDel(TOKEN_KEY);
        Login.show("Your session has ended \u2014 please sign in again.");
        Utils.setSyncStatus("error", "not signed in");
      } else {
        Utils.setSyncStatus("error", (resp.error || "no response") + " — showing cached copy, changes NOT saved");
      }
    });
  }

  var _lastLoad = 0;
  function _loaded_(resp) {
    _lastLoad = Date.now();
    if (resp.me) _setMe(resp.me);
    _serverVersion = resp.version || _serverVersion;
    _apply(resp.data);
    KEYS.forEach(function (k) { _synced[k] = JSON.stringify(D[k]); });
    _loaded = true;
    _lsSet(CACHE_KEY, JSON.stringify(D));
    Login.hide();
    Utils.setSyncStatus("loaded");
    _afterApply(true);
  }

  function reload() { _loadFromServer(); }

  // Coming back to PT (another tab, phone unlocked) after a while: fetch
  // what other devices changed. Not while something is being typed or a
  // form is open, and not with a change still waiting to be saved.
  function _busyTyping() {
    var a = document.activeElement;
    return !!(document.querySelector(".modal-overlay.open") || document.querySelector(".hourly-form") ||
              (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type !== "checkbox"));
  }
  function freshen(force) {
    if (!_loaded || _saving || _saveTimer || hasUnsaved() || _busyTyping()) return false;
    if (!force && Date.now() - _lastLoad < 120000) return false;
    _loadFromServer(); return true;
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") freshen(); });
  window.addEventListener("focus", function () { freshen(); });

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
    D.sessions   = d.sessions   || [];
    D.hourpay    = d.hourpay    || [];
    D.tests      = d.tests      || [];

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
    setTimeZone(D.settings && D.settings.tz);
    var today = ptToday().iso;
    D.students.forEach(function (s) {
      if (s.endDate && s.endDate <= today) { s.status = "Inactive"; return; }
      if (!s.status) s.status = "Active";
    });
  }

  // fresh: newer data arrived while a page is on screen — redraw that page as
  // the user left it (open sections, chosen month) instead of starting it over
  function _afterApply(fresh) {
    setTimeZone(D.settings && D.settings.tz);
    applyAcademicYear(viewYear());
    var td = document.getElementById("today-date");
    if (td) td.textContent = Utils.fmtDate(ptToday().date);
    if (fresh && typeof refreshPage === "function") refreshPage();
    else if (typeof currentPage !== "undefined" && typeof showPage === "function") showPage(currentPage);
    else Dashboard.render();
  }

  // ----------------------------------------------------------------
  //  SAVE — debounced; sends only the keys that changed
  // ----------------------------------------------------------------
  function save() {
    _lsSet(CACHE_KEY, JSON.stringify(D));
    if (!_loaded) {
      Utils.setSyncStatus("error", "offline \u2014 this change has not been saved");
      return;
    }
    Utils.setSyncStatus("pending");
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_flush, 800);
  }

  // ----------------------------------------------------------------
  //  What changed since the last save, as a patch the server applies
  //  to its CURRENT data (so another device's changes are never lost).
  // ----------------------------------------------------------------
  var ID_KEYS = { sessions: true, hourpay: true, tests: true };
  // Lists whose positions other pages rely on stay as they are on this
  // screen; the others take in what other devices added straight away.
  var TAKE_MERGED = { sessions: true, hourpay: true, tests: true, activity: true,
                      attendance: true, attsheets: true, syllabus: true, paygrid: true, settings: true };
  function _j(v) { return JSON.stringify(v); }
  // Students, classes, scores: take the merged list only when it is this
  // screen's list with rows added at the end (positions unchanged).
  function _sameStart(mine, merged) {
    if (!Array.isArray(mine) || !Array.isArray(merged) || merged.length < mine.length) return false;
    return mine.every(function (r, i) {
      return Object.keys(r).every(function (f) { return String(r[f] == null ? "" : r[f]) === String(merged[i][f] == null ? "" : merged[i][f]); });
    });
  }
  function _plain(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function _objDiff(a, b, path, out) {
    Object.keys(b).forEach(function (k) {
      var p = path.concat(k);
      if (_plain(a[k]) && _plain(b[k])) _objDiff(a[k], b[k], p, out);
      else if (!(k in a) || _j(a[k]) !== _j(b[k])) out.push({ p: p, v: b[k] });
    });
    Object.keys(a).forEach(function (k) { if (!(k in b)) out.push({ p: path.concat(k), d: 1 }); });
    return out;
  }
  function _unmatched(xs, ys) {        // rows of xs with no identical row in ys (counting repeats)
    var left = {};
    ys.forEach(function (y) { var j = _j(y); left[j] = (left[j] || 0) + 1; });
    return xs.filter(function (x) { var j = _j(x); if (left[j]) { left[j]--; return false; } return true; });
  }
  function _diff(k, before, now) {
    if (k === "activity") return { add: _unmatched(now || [], before || []) };
    if (Array.isArray(now)) {
      before = Array.isArray(before) ? before : [];
      if (ID_KEYS[k]) {
        var was = {}, set = [], ids = {};
        before.forEach(function (r) { was[r.id] = _j(r); });
        now.forEach(function (r) { ids[r.id] = true; if (was[r.id] !== _j(r)) set.push(r); });
        return { set: set, del: before.filter(function (r) { return !ids[r.id]; }).map(function (r) { return r.id; }) };
      }
      var ops = [];
      if (before.length === now.length) {
        now.forEach(function (r, i) { if (_j(r) !== _j(before[i])) ops.push({ old: before[i], "new": r }); });
      } else {
        _unmatched(before, now).forEach(function (r) { ops.push({ old: r }); });
        _unmatched(now, before).forEach(function (r) { ops.push({ "new": r }); });
      }
      return { ops: ops };
    }
    return { paths: _objDiff(_plain(before) ? before : {}, _plain(now) ? now : {}, [], []) };
  }

  function _flush(leaving) {
    _saveTimer = null;
    if (_saving && !leaving) { _saveTimer = setTimeout(_flush, 1000); return; }
    var patch = {}, snap = {}, n = 0;
    KEYS.forEach(function (k) {
      var j = _j(D[k]);
      if (j === _synced[k]) return;
      var before; try { before = JSON.parse(_synced[k] || "null"); } catch (e) { before = null; }
      patch[k] = _diff(k, before, D[k]); snap[k] = j; n++;
    });
    if (!n) { Utils.setSyncStatus("saved"); return; }

    _saving = true;
    Utils.setSyncStatus("saving");
    (leaving ? _call("patch", patch, null, true) : _callWithRetry("patch", patch)).then(function (resp) {
      _saving = false;
      _failed = !resp.ok;
      if (resp.ok) {
        Object.keys(snap).forEach(function (k) {
          var merged = resp.data && resp.data[k];
          // Nothing more changed here while saving: take the merged copy,
          // which includes what other devices added.
          if (merged !== undefined && _j(D[k]) === snap[k] && (TAKE_MERGED[k] || _sameStart(D[k], merged))) { D[k] = merged; _synced[k] = _j(merged); }
          else _synced[k] = snap[k];
        });
        _lsSet(CACHE_KEY, _j(D));
        Utils.setSyncStatus("saved");
      } else if (resp.error === "unauthorized") {
        _lsDel(TOKEN_KEY);
        Login.show("Your session has ended \u2014 sign in again to keep saving.");
      } else {
        Utils.setSyncStatus("error", resp.error || "save failed");
      }
    });
  }

  function hasUnsaved() {
    return _loaded && KEYS.some(function (k) { return JSON.stringify(D[k]) !== _synced[k]; });
  }

  // Leaving the page: send any waiting change straight away instead of
  // asking. The browser's own "leave page?" box (which PT can't style)
  // only appears if the last save failed, e.g. while offline.
  function _leaving() { if (_loaded && _saveTimer) { clearTimeout(_saveTimer); _flush(true); } }
  window.addEventListener("pagehide", _leaving);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") _leaving(); });
  window.addEventListener("beforeunload", function (e) {
    _leaving();
    if (_failed && hasUnsaved()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---- Activity log ----
  function _time() { return Utils.dateTime(new Date()); }

  function log(txt) {
    if (_me) txt += " \u2014 " + (_me.name || _me.username);
    D.activity.unshift({ text: txt, time: _time() });
    if (D.activity.length > 50) D.activity.length = 50;
  }

  // Students of the academic year on screen (every page lists these)
  function allStudents() {
    return D.students.filter(function (s) { return Utils.inYear(s); }).sort(function (a, b) {
      var ca = a.cls || "", cb = b.cls || "";
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.fname + " " + a.lname).localeCompare(b.fname + " " + b.lname);
    });
  }

  function backup() { return _call("backup"); }

  // Generic call for other modules (Users etc.)
  function api(action, data, waitMs) { return _call(action, data, waitMs ? { _wait: waitMs } : null); }

  return {
    get: get, isConfigured: isConfigured,
    init: init, login: login, logout: logout, api: api,
    me: me, isAdmin: isAdmin, serverVersion: serverVersion,
    save: save, reload: reload, log: log, backup: backup,
    allStudents: allStudents, hasUnsaved: hasUnsaved, freshen: freshen
  };
})();

// ================================================================
//  Login — passcode overlay
// ================================================================
var Login = (function () {
  // Busy: the fields give way to a spinner while PT signs in and opens
  function _busy(on, text, sub) {
    var o = document.getElementById("login-overlay");
    o.classList.toggle("busy", !!on);
    if (text) document.getElementById("login-wait-text").textContent = text;
    document.getElementById("login-wait-sub").textContent = sub || "";
    o.querySelectorAll(".login-fields input, .login-fields button").forEach(function (x) { x.disabled = !!on; });
  }
  function show(msg) {
    var o = document.getElementById("login-overlay");
    _busy(false);
    o.classList.add("open");
    var pw = document.getElementById("login-pass"); if (pw._ptHide) pw._ptHide();   // start with the password hidden
    document.getElementById("login-msg").textContent = msg || "";
    setTimeout(function () {
      var u = document.getElementById("login-user");
      (u.value ? document.getElementById("login-pass") : u).focus();
    }, 50);
  }
  function hide() { var o = document.getElementById("login-overlay"); o.classList.remove("open"); _busy(false); }
  function submit(e) {
    if (e) e.preventDefault();
    var u = document.getElementById("login-user").value.trim();
    var p = document.getElementById("login-pass").value;
    var msg = document.getElementById("login-msg");
    if (!u || !p) { msg.textContent = "Enter your username and password."; return false; }
    msg.textContent = "";
    _busy(true, "Signing in\u2026", "Checking your details and opening PT");
    var pw = document.getElementById("login-pass");
    Data.login(u, p).then(function (resp) {
      if (!resp.ok) {
        _busy(false);
        msg.textContent = resp.error === "unauthorized" || /Unknown action/.test(resp.error || "")
          ? "PT is being updated. Please try again in a minute."
          : /^network error|^timeout/.test(resp.error || "") ? "PT couldn't be reached. Check the internet connection and try again."
          : (resp.error || "Could not sign in");
        pw.focus(); pw.select();
      } else {
        pw.value = ""; if (pw._ptHide) pw._ptHide();
        // still open only if the data is being fetched separately
        if (document.getElementById("login-overlay").classList.contains("open"))
          _busy(true, "Opening PT\u2026", "Loading students, classes and payments");
      }
    }, function () {
      _busy(false); msg.textContent = "PT couldn't be reached. Check the internet connection and try again.";
    });
    return false;
  }
  return { show: show, hide: hide, submit: submit };
})();
