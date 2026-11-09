// ================================================================
//  payments.js — Payments page (view only)
//  Four collapsible sections: Plus 1, Plus 2, Hourly (Plus 1),
//  Hourly (Plus 2). Group sections show the full-year month grid;
//  hourly sections show hours, billed, paid and balance.
//  Fees are recorded on the student's profile (click the name).
// ================================================================

var Payments = (function () {
  var MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var PILL = { "Paid": "pp-paid", "Pending": "pp-pending", "Overdue": "pp-overdue" };

  var _open = {};          // which sections are open; all collapsed when the page is opened from the menu
  var _duesOnly = false;   // "Only students with dues"

  // Opening Payments from the menu: every section collapsed
  function init() { _open = {}; render(); }
  // Open one class's section (used by links into Payments)
  function setClass(cls) { _open[cls] = true; render(); }
  function toggle(key, el) { _open[key] = el.open; }
  function duesOnly(on) { _duesOnly = !!on; render(); }

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function _rec(cls, ym, s) {
    var D = Data.get(), name = Utils.fullName(s), sk = "paygrid|" + cls + "|" + ym;
    if (!D.paygrid) D.paygrid = {};
    var g = D.paygrid[sk] || {};
    return g[name] || { status: "", amount: s.monthlyFee || "", notes: "", paydate: "" };
  }
  function _dueMonths(s) {
    return ACYR.filter(function (ym) { var st = _rec(Utils.clsOf(s), ym, s).status; return st === "Pending" || st === "Overdue"; }).length;
  }

  function _section(key, title, meta, body) {
    return "<details class='section tests-section pay-section'" + (_open[key] ? " open" : "") +
      " ontoggle='Payments.toggle(\"" + key + "\", this)'><summary><span class='section-title'>" + title +
      "</span><span class='section-meta'>&middot; " + meta + "</span><span class='show-pill' aria-hidden='true'></span></summary>" +
      "<div class='section-body' style='padding:0'><div style='overflow-x:auto'>" + body + "</div></div></details>";
  }
  function _count(n, all, dues) {
    if (_duesOnly) return "<span style='color:" + (n ? "var(--danger)" : "var(--text3)") + "'>" + n + " with dues</span> <span class='muted'>(of " + all + ")</span>";
    return n + " student" + (n === 1 ? "" : "s") + (dues ? " &middot; <span style='color:var(--danger)'>" + dues + " with dues</span>" : "") +
      (n !== all ? " <span class='muted'>(of " + all + ")</span>" : "");
  }

  // ---------- group classes: month grid ----------
  function _groupSection(cls) {
    var all = Data.allStudents().filter(function (s) { return Utils.clsOf(s) === cls && Hourly.inGroup(s) && Utils.shown(s); });
    var withDues = all.filter(function (s) { return _dueMonths(s) > 0; });
    var list = _duesOnly ? withDues : all;
    var key = cls, title = Utils.grade(cls);
    if (!list.length) {
      return _section(key, title, _count(0, all.length, 0),
        "<div class='empty' style='padding:20px'><div class='empty-text'>" +
        (_duesOnly && all.length ? "No dues in " + title + "." : "No group-class students in " + title + ".") + "</div></div>");
    }
    var totals = {}; ACYR.forEach(function (ym) { totals[ym] = { paid: 0, pending: 0, overdue: 0 }; });
    var head = "<tr><th class='num sticky0'>#</th><th class='sticky1'>Student <span class='yr' style='display:inline'>(₹ paid)</span></th>" +
      ACYR.map(function (ym) {
        var p = ym.split("-");
        var first = ym === ACYR[0] || p[1] === "01";
        return "<th class='c mo'>" + MONTH_SHORT[Number(p[1]) - 1] + (first ? "<span class='yr'>'" + p[0].slice(2) + "</span>" : "") + "</th>";
      }).join("") +
      "<th class='c' style='color:var(--accent3)'>Paid</th><th class='c' style='color:var(--danger)'>Due</th></tr>";
    var body = list.map(function (s, i) {
      var paid = 0, due = 0;
      var cells = ACYR.map(function (ym) {
        var rec = _rec(cls, ym, s), st = rec.status || "";
        if (st === "Paid") { paid++; totals[ym].paid++; }
        if (st === "Pending") { due++; totals[ym].pending++; }
        if (st === "Overdue") { due++; totals[ym].overdue++; }
        var tip = [];
        if (st === "Paid" && rec.amount) tip.push("Paid ₹" + Number(rec.amount).toLocaleString("en-IN"));
        if (rec.paydate) tip.push("on " + rec.paydate);
        if (rec.notes) tip.push(rec.notes);
        var txt = st === "Paid" ? (rec.amount ? Number(rec.amount).toLocaleString("en-IN") : "Paid") : (st || "—");
        return "<td class='c'" + (tip.length ? " title='" + _esc(tip.join(" · ")) + "'" : "") + "><span class='pay-pill " +
          (PILL[st] || "pp-none") + "'>" + txt + "</span></td>";
      }).join("");
      return "<tr><td class='num sticky0'>" + (i + 1) + "</td><td class='sticky1 nm'>" + Utils.studentLink(Utils.fullName(s)) + "</td>" + cells +
        "<td class='c' style='font-weight:600;color:var(--accent3)'>" + paid + "/" + ACYR.length + "</td>" +
        "<td class='c' style='font-weight:600;color:" + (due ? "var(--danger)" : "var(--text3)") + "'>" + due + "</td></tr>";
    }).join("");
    var foot = "<tr class='pay-summary-row'><td colspan='2' class='sticky0'>Monthly total</td>" +
      ACYR.map(function (ym) {
        var t = totals[ym], l = [];
        if (t.paid) l.push("<span style='color:var(--accent3)'>" + t.paid + "&#10003;</span>");
        if (t.pending) l.push("<span style='color:var(--accent2)'>" + t.pending + "~</span>");
        if (t.overdue) l.push("<span style='color:var(--danger)'>" + t.overdue + "!</span>");
        return "<td class='c'>" + (l.join(" ") || "<span class='muted'>—</span>") + "</td>";
      }).join("") + "<td></td><td></td></tr>";
    return _section(key, title, _count(list.length, all.length, withDues.length),
      "<table class='pay-table pay-grid'><thead>" + head + "</thead><tbody>" + body + foot + "</tbody></table>");
  }

  // ---------- hourly students ----------
  function _hourlySection(cls) {
    var all = Data.allStudents().filter(function (s) { return Hourly.isHourly(s) && Utils.clsOf(s) === cls && Utils.shown(s); });
    var acc = all.map(function (s) { return { s: s, a: Hourly.account(Utils.fullName(s)) }; });
    var withDues = acc.filter(function (x) { return x.a.balance > 0.5; });
    var list = _duesOnly ? withDues : acc;
    var key = "one|" + cls, title = "Hourly (" + Utils.grade(cls) + ")";
    var money = function (v) { return "₹" + Math.round(v || 0).toLocaleString("en-IN"); };
    var body = list.length ?
      "<table class='hourly-table'><thead><tr><th class='num'>#</th><th>Student</th><th>Rate</th><th>Hours</th><th>Billed</th><th>Paid</th><th>Balance</th></tr></thead><tbody>" +
        list.map(function (x, i) {
          var s = x.s, a = x.a;
          return "<tr><td class='num'>" + (i + 1) + "</td><td><b>" + Utils.studentLink(Utils.fullName(s)) + "</b></td>" +
            "<td>" + (s.hourlyRate ? money(s.hourlyRate) + "/hr" : "—") + "</td>" +
            "<td>" + Hourly.hm(a.hours) + "</td><td>" + money(a.billed) + "</td><td>" + money(a.paid) + "</td>" +
            "<td>" + (a.balance > 0.5 ? "<span class='chip chip-red'>" + money(a.balance) + " due</span>" : "<span class='chip chip-green'>Settled</span>") + "</td></tr>";
        }).join("") + "</tbody></table>" +
        "<div class='sheet-hint muted'>Billed by the hour; payments are applied to the oldest months first.</div>"
      : "<div class='empty' style='padding:20px'><div class='empty-text'>" +
        (_duesOnly && all.length ? "No dues in " + title + "." : "No hourly students in " + Utils.grade(cls) + ".") + "</div></div>";
    return _section(key, title, _count(list.length, all.length, withDues.length), body);
  }

  function render() {
    var wrap = Utils.el("payments-wrap");
    if (!wrap) return;
    var chk = Utils.el("pay-dues"); if (chk) chk.checked = _duesOnly;
    wrap.innerHTML = _groupSection("Grade XI") + _groupSection("Grade XII") +
                     _hourlySection("Grade XI") + _hourlySection("Grade XII");
  }

  return { init: init, setClass: setClass, toggle: toggle, duesOnly: duesOnly, render: render };
})();
