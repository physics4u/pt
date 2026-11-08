// ================================================================
//  JS_Payments — Read-only full-year payment matrix
//  Rows = students, Columns = all 14 months (Mar 2026 – Apr 2027)
//  Each cell shows a coloured status pill.
//  Editing is done exclusively on the Student Profile page.
// ================================================================

var Payments = (function () {
  var _cls = "Grade XII";

  // Short month labels for column headers
  var MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Colour map for status
  var STATUS_COL = {
    "Paid":    { bg:"rgba(91,248,184,0.15)", border:"var(--accent3)", text:"var(--accent3)" },
    "Pending": { bg:"rgba(248,160,91,0.15)", border:"var(--accent2)", text:"var(--accent2)" },
    "Overdue": { bg:"rgba(248,91,110,0.15)", border:"var(--danger)",  text:"var(--danger)"  },
    "":        { bg:"transparent",           border:"var(--border)",  text:"var(--text3)"   }
  };

  // ----------------------------------------------------------------
  function init() {
    var D = Data.get();
    var hasXII = D.students.some(function (s) { return s.cls === "Grade XII"; });
    var hasXI  = D.students.some(function (s) { return s.cls === "Grade XI";  });
    if (hasXII) _cls = "Grade XII";
    else if (hasXI) _cls = "Grade XI";
    setClass(_cls);
  }

  function setClass(cls) {
    _cls = cls;
    var sel = Utils.el("pay-grade");
    if (sel) sel.value = cls;
    render();
  }

  // ----------------------------------------------------------------
  //  render — builds the full-year matrix (read-only)
  // ----------------------------------------------------------------
  function render() {
    var D       = Data.get();
    var sf       = (Utils.el("pay-status") || {}).value || "";
    var students = Data.allStudents().filter(function (s) {
      return s.cls === _cls && Hourly.inGroup(s) && (!sf || s.status === sf);
    });
    var wrap    = Utils.el("payments-wrap");

    if (students.length === 0) {
      wrap.innerHTML = "<div class='empty'><div class='empty-text'>No group-class students in " + _cls + ".</div></div>" +
                       Hourly.renderPaymentsTable(_cls);
      return;
    }

    // Pre-load all paygrid data for this class
    if (!D.paygrid) D.paygrid = {};

    // ---- Build table ----
    var tbl = document.createElement("table");
    tbl.className = "pay-table";
    tbl.style.cssText = "min-width:100%;border-collapse:collapse;font-size:12px";

    // ---- Header row ----
    var thead = tbl.createTHead();
    var hr    = thead.insertRow();

    // Fixed columns: #, Name, View
    function th(txt, css) {
      var t = document.createElement("th");
      t.textContent = txt;
      if (css) t.style.cssText = css;
      return t;
    }
    hr.appendChild(th("#",       "width:36px;text-align:center;position:sticky;left:0;z-index:4;background:var(--surface2)"));
    hr.appendChild(th("Student", "min-width:140px;position:sticky;left:36px;z-index:4;background:var(--surface2)"));

    // One column per month
    ACYR.forEach(function (ym) {
      var parts = ym.split("-");
      var mo    = MONTH_SHORT[Number(parts[1]) - 1];
      var yr    = parts[0].slice(2);
      var t = document.createElement("th");
      t.style.cssText  = "min-width:72px;text-align:center;white-space:nowrap";
      t.innerHTML = mo + "<br><span style='font-size:9px;color:var(--text3);font-weight:400'>'" + yr + "</span>";
      hr.appendChild(t);
    });

    // Summary + View columns
    hr.appendChild(th("Paid",    "width:48px;text-align:center;color:var(--accent3)"));
    hr.appendChild(th("Due",     "width:48px;text-align:center;color:var(--danger)"));
    hr.appendChild(th("View",    "width:56px;text-align:center"));

    // ---- Body rows ----
    var tbody = tbl.createTBody();
    var totals = {}; // totals per month: {ym: {paid,pending,overdue}}
    ACYR.forEach(function (ym) { totals[ym] = {paid:0, pending:0, overdue:0}; });

    students.forEach(function (s, si) {
      var name = Utils.fullName(s);
      var idx  = Data.get().students.indexOf(s);
      var row  = tbody.insertRow();

      // # cell
      var nc = row.insertCell();
      nc.style.cssText = "text-align:center;color:var(--text3);font-size:11px;position:sticky;left:0;background:var(--surface);z-index:1";
      nc.textContent = si + 1;

      // Name cell
      var nmc = row.insertCell();
      nmc.style.cssText = "font-weight:500;color:var(--text);position:sticky;left:36px;background:var(--surface);z-index:1;white-space:nowrap";
      nmc.textContent = name;

      var paidCount = 0, dueCount = 0;

      // Month cells
      ACYR.forEach(function (ym) {
        var sk  = "paygrid|" + _cls + "|" + ym;
        if (!D.paygrid[sk])         D.paygrid[sk]         = {};
        if (!D.paygrid[sk][name])   D.paygrid[sk][name]   = {status:"", amount:s.monthlyFee||"", notes:"", paydate:""};
        var rec    = D.paygrid[sk][name];
        var status = rec.status || "";
        var col    = STATUS_COL[status] || STATUS_COL[""];

        // Count
        if (status === "Paid")                      { paidCount++; totals[ym].paid++; }
        if (status === "Pending")                   { dueCount++;  totals[ym].pending++; }
        if (status === "Overdue")                   { dueCount++;  totals[ym].overdue++; }

        var mc = row.insertCell();
        mc.style.cssText = "text-align:center;padding:6px 4px";

        // Pill
        var pill = document.createElement("div");
        pill.style.cssText =
          "display:inline-block;padding:3px 0;border-radius:20px;border:1px solid " + col.border + ";" +
          "background:" + col.bg + ";color:" + col.text + ";" +
          "font-size:10px;font-family:inherit;font-weight:600;" +
          "min-width:60px;text-align:center;line-height:1.6";

        if (status === "") {
          pill.textContent = "\u2014";
          pill.style.color = "var(--text3)";
        } else {
          pill.textContent = status;
          // Show amount below status if paid
          if (status === "Paid" && rec.amount) {
            pill.innerHTML = status + "<br><span style='font-size:9px;font-weight:400'>\u20b9" + Number(rec.amount).toLocaleString("en-IN") + "</span>";
          }
        }
        mc.appendChild(pill);

        // Tooltip: paydate and notes on hover
        var title = [];
        if (rec.paydate) title.push("Paid on: " + rec.paydate);
        if (rec.notes)   title.push(rec.notes);
        if (title.length) mc.title = title.join(" | ");
      });

      // Paid count cell
      var pc = row.insertCell();
      pc.style.cssText = "text-align:center;font-weight:600;color:var(--accent3);font-family:inherit;font-size:12px";
      pc.textContent = paidCount + "/" + ACYR.length;

      // Due count cell
      var dc = row.insertCell();
      dc.style.cssText = "text-align:center;font-weight:600;font-family:inherit;font-size:12px";
      dc.style.color   = dueCount > 0 ? "var(--danger)" : "var(--text3)";
      dc.textContent   = dueCount;

      // View button — goes to student profile
      var vc  = row.insertCell();
      vc.style.cssText = "text-align:center";
      var vbtn = document.createElement("button");
      vbtn.className   = "btn btn-secondary";
      vbtn.style.cssText = "padding:3px 10px;font-size:11px";
      vbtn.textContent = "View";
      vbtn.onclick     = (function(i){ return function(){ Profile.view(i); }; })(idx);
      vc.appendChild(vbtn);
    });

    // ---- Summary footer row ----
    var sfr = tbody.insertRow();
    sfr.className = "pay-summary-row";

    var s1 = sfr.insertCell(); s1.colSpan = 2;
    s1.style.cssText = "position:sticky;left:0;background:var(--surface2);color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:1px;font-family:inherit";
    s1.textContent = "Monthly Total";

    ACYR.forEach(function (ym) {
      var t  = totals[ym];
      var sc = sfr.insertCell();
      sc.style.cssText = "text-align:center;padding:6px 4px;font-size:10px;font-family:inherit;line-height:1.7";
      var lines = [];
      if (t.paid)    lines.push("<span style='color:var(--accent3)'>" + t.paid + "&#10003;</span>");
      if (t.pending) lines.push("<span style='color:var(--accent2)'>" + t.pending + "~</span>");
      if (t.overdue) lines.push("<span style='color:var(--danger)'>"  + t.overdue + "!</span>");
      if (!lines.length) lines.push("<span style='color:var(--text3)'>—</span>");
      sc.innerHTML = lines.join(" ");
    });

    // Empty cells for Paid/Due/View columns in footer
    sfr.insertCell(); sfr.insertCell(); sfr.insertCell();

    wrap.innerHTML = "";
    wrap.appendChild(tbl);
    wrap.insertAdjacentHTML("beforeend", Hourly.renderPaymentsTable(_cls));
  }

  return { init: init, setClass: setClass, render: render };
})();
