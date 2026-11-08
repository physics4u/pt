// ================================================================
//  JS_Attendance — Monthly attendance grid (P / A cycling)
// ================================================================

var Attendance = (function () {
  var _cls = "Grade XI";

  function init() {
    var sel  = Utils.el("attsheet-month");
    var ym   = Utils.curYm();
    var opts = Array.from(sel.options).map(function (o) { return o.value; });
    sel.value = opts.includes(ym) ? ym : "2026-03";
    setClass(_cls);
  }

  function setClass(cls) {
    _cls = cls;
    var sel = Utils.el("as-grade");
    if (sel) sel.value = cls;
    render();
  }

  function render() {
    var ym = Utils.el("attsheet-month").value; if (!ym) return;
    var parts = ym.split("-"); var year = Number(parts[0]); var month = Number(parts[1]);
    var dim   = new Date(year, month, 0).getDate();
    var mn    = MONTHS[month - 1];

    var lbl = Utils.el("as-class-label");
    if (lbl) lbl.textContent = _cls + " \u2014 " + mn + " " + year;

    var sf       = (Utils.el("as-status") || {}).value || "";
    var students = Data.allStudents().filter(function (s) {
      return s.cls === _cls && (!sf || s.status === sf);
    });
    var wrap     = Utils.el("attsheet-wrap");

    if (students.length === 0) {
      wrap.innerHTML = "<div class='empty'><div class='empty-text'>No students in " + _cls + ".</div></div>";
      return;
    }

    var D  = Data.get();
    var sk = "attsheet|" + _cls + "|" + ym;
    if (!D.attsheets)    D.attsheets    = {};
    if (!D.attsheets[sk]) D.attsheets[sk] = {};
    var sheet = D.attsheets[sk];
    var tP = [], tA = [];
    for (var ii = 0; ii <= dim; ii++) { tP.push(0); tA.push(0); }

    // Build table
    var table  = document.createElement("table"); table.className = "as-table";
    var thead  = table.createTHead(); var hr = thead.insertRow();

    function mth(tx, cl, st) {
      var t = document.createElement("th");
      if (cl) t.className = cl; if (st) t.style.cssText = st; if (tx) t.textContent = tx; return t;
    }
    hr.appendChild(mth("#",    "num-col",  "position:sticky;left:0;z-index:3"));
    hr.appendChild(mth("Name", "name-col", ""));
    for (var d = 1; d <= dim; d++) {
      var di = new Date(year, month - 1, d).getDay();
      var wk = di === 0 || di === 6;
      var th = document.createElement("th");
      th.className = "num-col" + (wk ? " weekend-col" : "");
      th.title = d + " " + mn + " " + year + " (" + DAYS[di] + ")";
      var sp = document.createElement("span");
      sp.style.cssText = "font-weight:400;color:var(--text3);font-size:9px";
      sp.textContent = DAYS[di].slice(0, 2);
      th.textContent = d; th.appendChild(document.createElement("br")); th.appendChild(sp);
      hr.appendChild(th);
    }
    hr.appendChild(mth("P", "num-col", "background:var(--surface2);color:var(--accent3)"));
    hr.appendChild(mth("A", "num-col", "background:var(--surface2);color:var(--danger)"));
    hr.appendChild(mth("%", "num-col", "background:var(--surface2);color:var(--accent2)"));

    var tbody = table.createTBody();
    students.forEach(function (s, si) {
      var name = Utils.fullName(s);
      if (!sheet[name]) sheet[name] = {};
      var pc = 0, ac = 0;
      var row = tbody.insertRow();
      // # cell
      var nc = row.insertCell(); nc.className = "num-col";
      nc.style.cssText = "position:sticky;left:0;background:var(--surface);color:var(--text3);font-size:11px";
      nc.textContent = si + 1;
      // Name cell
      var nmc = row.insertCell(); nmc.className = "name-col"; nmc.textContent = name;
      // Day cells
      for (var d = 1; d <= dim; d++) {
        var di2  = new Date(year, month - 1, d).getDay();
        var wknd = di2 === 0 || di2 === 6;
        var val  = sheet[name][d] || "";
        if (val === "P") { pc++; tP[d]++; }
        if (val === "A") { ac++; tA[d]++; }
        var cell = row.insertCell(); if (wknd) cell.className = "weekend-col";
        var btn  = document.createElement("button");
        btn.className = "as-btn-p" + (val === "P" ? " active-p" : val === "A" ? " active-a" : "");
        btn.dataset.key = sk; btn.dataset.student = name; btn.dataset.day = d;
        btn.textContent = val || "--";
        btn.onclick = function () { _toggle(this); };
        cell.appendChild(btn);
      }
      // Summary
      var tot    = pc + ac;
      var pct    = tot > 0 ? Math.round(pc / tot * 100) : null;
      var pctCol = pct === null ? "var(--text3)" : pct >= 75 ? "var(--accent3)" : pct >= 50 ? "var(--accent2)" : "var(--danger)";
      var cP = row.insertCell(); cP.className = "summary"; cP.style.color = "var(--accent3)"; cP.textContent = pc;
      var cA = row.insertCell(); cA.className = "summary"; cA.style.color = "var(--danger)";  cA.textContent = ac;
      var cPct = row.insertCell(); cPct.className = "summary"; cPct.style.color = pctCol;
      cPct.textContent = pct !== null ? pct + "%" : "--";
    });

    // Total row
    var sr  = tbody.insertRow(); sr.className = "as-summary-row";
    var sn  = sr.insertCell(); sn.style.cssText = "position:sticky;left:0;background:var(--surface2)";
    var snm = sr.insertCell(); snm.className = "name-col";
    snm.style.cssText = "background:var(--surface2);color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:1px";
    snm.textContent = "Total Present";
    for (var d2 = 1; d2 <= dim; d2++) {
      var sc2 = sr.insertCell(); sc2.style.color = "var(--accent3)"; sc2.style.fontSize = "11px";
      sc2.textContent = tP[d2] || "--";
    }
    sr.insertCell(); sr.insertCell(); sr.insertCell();

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  function _toggle(btn) {
    var D       = Data.get();
    var key     = btn.dataset.key;
    var student = btn.dataset.student;
    var day     = Number(btn.dataset.day);
    if (!D.attsheets)        D.attsheets        = {};
    if (!D.attsheets[key])   D.attsheets[key]   = {};
    if (!D.attsheets[key][student]) D.attsheets[key][student] = {};
    var cur  = D.attsheets[key][student][day] || "";
    var next = cur === "" ? "P" : cur === "P" ? "A" : "";
    D.attsheets[key][student][day] = next;
    render(); // re-render to keep totals accurate
  }

  function save() {
    Data.save();
    Utils.flash(Utils.el("btn-save-attsheet"));
    Data.log("Saved Attendance Sheet for <b>" + _cls + "</b> \u2014 " + (ACYR_LBL[Utils.el("attsheet-month").value] || ""));
  }

  return { init: init, setClass: setClass, render: render, save: save };
})();
