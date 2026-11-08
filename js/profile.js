// ================================================================
//  JS_Profile — Student profile page
//  Includes: info panel, fee history table, scores, att summary
// ================================================================

var Profile = (function () {
  var _STATUS_CYCLE = {"":"Pending","Pending":"Paid","Paid":"Overdue","Overdue":""};

  function view(idx) {
    var D = Data.get();
    var s = D.students[idx]; if (!s) return;
    var name = Utils.fullName(s);

    var div = Utils.el("profile-content");
    div.innerHTML = "";

    // ---- Header ----
    var hdr = document.createElement("div"); hdr.className = "profile-header";
    var initials = (s.fname[0] || "") + (s.lname[0] || "");
    hdr.innerHTML =
      "<div class='profile-avatar'>" + initials + "</div>" +
      "<div>" +
        "<div class='profile-name'>" + name + "</div>" +
        "<div style='font-size:13px;color:var(--text3)'>" + Utils.grade(s.cls) + " &bull; " + (s.school || "") + "</div>" +
        "<div class='profile-meta'>" +
          "<span>&#128222; " + (s.phone || "\u2014") + "</span>" +
          "<span>&#9993; " + (s.email || "\u2014") + "</span>" +
          "<span>Batch: " + (s.batch || "Regular") + "</span>" +
          "<span>Status: <b>" + s.status + "</b></span>" +
        "</div>" +
      "</div>" +
      "<div style='margin-left:auto'>" +
        "<button class='btn btn-secondary' onclick='showPage(\"students\")' style='font-size:12px'>&#8592; Back</button>" +
      "</div>";
    div.appendChild(hdr);

    // ---- Info + Att grid ----
    var grid = document.createElement("div"); grid.className = "profile-grid";

    // Left: details
    var detSec = document.createElement("div"); detSec.className = "profile-section";
    detSec.innerHTML = "<div class='profile-section-title'>Student Details</div>" +
      _detailRow("Parent", s.parent) +
      _detailRow("Parent Phone", s.phone) +
      _detailRow("Student Phone", s.studentPhone) +
      _detailRow("Email", s.email) +
      _detailRow("Address", s.address) +
      _detailRow("Country", s.country) +
      (Hourly.isHourly(s) ? _detailRow("Rate per hour", s.hourlyRate ? "\u20b9" + s.hourlyRate : "\u2014") +
                            _detailRow("Group classes", s.groupToo === "yes" ? "Also attends" : "No") : "") +
      (Hourly.inGroup(s) ? _detailRow("Monthly Fee", s.monthlyFee ? "\u20b9" + s.monthlyFee : "\u2014") : "") +
      _detailRow("Start Date",  s.startDate  || "\u2014") +
      _detailRow("End Date",    s.endDate    || "\u2014") +
      _detailRow("Notes", s.notes);

    // Right: attendance summary
    var attSec = document.createElement("div"); attSec.className = "profile-section";
    attSec.innerHTML = "<div class='profile-section-title'>Attendance Summary</div>";
    var attBody = document.createElement("div"); attBody.style.padding = "12px 20px";
    var D2 = Data.get();
    ACYR.forEach(function (ym) {
      var sk    = "attsheet|" + s.cls + "|" + ym;
      var sheet = (D2.attsheets || {})[sk] || {};
      var rec   = Object.assign({}, sheet[name] || {});
      // One-to-one sessions count as present days
      if (Hourly.isHourly(s)) Hourly.sessionDays(name, ym).forEach(function (d) { rec[d] = "P"; });
      var vals  = Object.values(rec);
      var P     = vals.filter(function (v) { return v === "P"; }).length;
      var A     = vals.filter(function (v) { return v === "A"; }).length;
      if (P + A === 0) return;
      var block = document.createElement("div"); block.className = "att-month-block";
      block.innerHTML = "<div class='att-month-title'>" + (ACYR_LBL[ym] || ym) + " &mdash; P: " + P + " A: " + A + "</div>";
      var dots = document.createElement("div"); dots.className = "att-dots";
      Object.keys(rec).sort(function(a,b){return Number(a)-Number(b);}).forEach(function (d) {
        var dot = document.createElement("div"); dot.className = "att-dot " + (rec[d] === "P" ? "p" : "a");
        dot.textContent = d; dots.appendChild(dot);
      });
      block.appendChild(dots); attBody.appendChild(block);
    });
    if (!attBody.hasChildNodes()) attBody.innerHTML = "<div style='color:var(--text3);font-size:13px'>No attendance recorded yet.</div>";
    attSec.appendChild(attBody);

    grid.appendChild(detSec); grid.appendChild(attSec); div.appendChild(grid);

    // ---- Hourly students: fees, sessions and payments ----
    if (Hourly.isHourly(s)) Hourly.renderProfile(div, idx);

    // ---- Fee history table (group classes) ----
    var feeSec = document.createElement("div"); feeSec.className = "profile-full";
    feeSec.style.marginBottom = "24px";
    var feeHeader = document.createElement("div"); feeHeader.className = "profile-section-title";
    feeHeader.style.cssText = "padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between";
    feeHeader.innerHTML = "<span>" + (Hourly.isHourly(s) ? "Group class fees" : "Fee history") + " (" + ACYR_LBL[ACYR[0]].split(" ")[1] + "\u2013" + String(Number(ACYR_LBL[ACYR[0]].split(" ")[1]) + 1).slice(2) + ")</span>" +
      "<div style='display:flex;align-items:center;gap:8px'>" +
        "<label style='font-size:11px;color:var(--text3);text-transform:none;letter-spacing:0'>Monthly Fee</label>" +
        "<input id='prof-fee-input' type='number' value='" + (s.monthlyFee || "") + "' placeholder='0'" +
          "style='width:90px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;outline:none'>" +
        "<button class='btn btn-primary' style='padding:5px 12px;font-size:12px' onclick='Profile.setFee(" + idx + ")'>Set Fee</button>" +
      "</div>";
    feeSec.appendChild(feeHeader);

    var feeWrap = document.createElement("div"); feeWrap.style.overflowX = "auto";
    var feeTable = document.createElement("table"); feeTable.className = "pay-table";
    feeTable.style.cssText = "margin:0";
    var ft = feeTable.createTHead(); var fhr = ft.insertRow();
    ["Month","Amount (\u20b9)","Status","Payment Date","Notes"].forEach(function(h){
      var th = document.createElement("th"); th.textContent = h; fhr.appendChild(th);
    });
    var ftb = feeTable.createTBody();
    var paidCount = 0, pendingCount = 0, overdueCount = 0;
    ACYR.forEach(function (ym) {
      var sk  = "paygrid|" + s.cls + "|" + ym;
      var D3  = Data.get();
      if (!D3.paygrid)      D3.paygrid      = {};
      if (!D3.paygrid[sk])  D3.paygrid[sk]  = {};
      if (!D3.paygrid[sk][name]) D3.paygrid[sk][name] = {status:"", amount:"", notes:"", paydate:""};
      var rec = D3.paygrid[sk][name];
      if (rec.status === "Paid")    paidCount++;
      if (rec.status === "Pending") pendingCount++;
      if (rec.status === "Overdue") overdueCount++;

      var row = ftb.insertRow();
      // Month
      var mc = row.insertCell(); mc.style.cssText = "font-weight:500;color:var(--text)"; mc.textContent = ACYR_LBL[ym] || ym;
      // Amount
      var ac = row.insertCell();
      var ai = document.createElement("input"); ai.type = "number"; ai.className = "pay-amount-input";
      ai.value = rec.amount || s.monthlyFee || ""; ai.placeholder = "0";
      ai.dataset.sk = sk; ai.dataset.name = name; ai.dataset.field = "amount";
      ai.addEventListener("input", _feeChange); ac.appendChild(ai);
      // Status
      var sc2 = row.insertCell();
      var sbtn = document.createElement("button");
      var STATUS_CLASS = {"":"status-none","Pending":"status-pending","Paid":"status-paid","Overdue":"status-overdue"};
      sbtn.className = "pay-btn " + (STATUS_CLASS[rec.status] || "status-none");
      sbtn.textContent = rec.status || "\u2014 Unset \u2014";
      sbtn.dataset.sk = sk; sbtn.dataset.name = name;
      sbtn.onclick = function () { _cycleStatus(this); };
      sc2.appendChild(sbtn);
      // Paydate
      var dc = row.insertCell();
      var di = document.createElement("input"); di.type = "date"; di.className = "pay-amount-input"; di.style.width = "140px";
      di.value = rec.paydate || "";
      di.dataset.sk = sk; di.dataset.name = name; di.dataset.field = "paydate";
      di.addEventListener("change", _feeChange); dc.appendChild(di);
      // Notes
      var nc = row.insertCell();
      var ni = document.createElement("input"); ni.type = "text";
      ni.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;width:100%;outline:none";
      ni.value = rec.notes || ""; ni.placeholder = "Notes...";
      ni.dataset.sk = sk; ni.dataset.name = name; ni.dataset.field = "notes";
      ni.addEventListener("input", _feeChange); nc.appendChild(ni);
    });
    // Summary row
    var sr = ftb.insertRow();
    sr.innerHTML = "<td colspan='2' style='font-weight:600;color:var(--text2)'>Summary</td>" +
      "<td><span style='color:var(--accent3)'>Paid: " + paidCount + "</span> &nbsp; " +
          "<span style='color:var(--accent2)'>Pending: " + pendingCount + "</span> &nbsp; " +
          "<span style='color:var(--danger)'>Overdue: " + overdueCount + "</span></td>" +
      "<td></td><td></td>";

    feeWrap.appendChild(feeTable); feeSec.appendChild(feeWrap);
    if (Hourly.inGroup(s)) div.appendChild(feeSec);

    // ---- Report card (test marks) ----
    Scores.ensure();
    var scores = (Data.get().scores || []).filter(function (sc) { return sc.student === name; })
                   .sort(function (a, b) { return String(a.date).localeCompare(b.date); });
    var scSec = document.createElement("div"); scSec.className = "profile-full";
    var pcts = scores.filter(function (r) { return Number(r.total) > 0; }).map(function (r) { return Number(r.score) / Number(r.total) * 100; });
    var avg = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : null;
    var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); };
    scSec.innerHTML = "<div class='profile-section-title hourly-head'><span>Report card</span>" +
      (avg === null ? "" : "<span>Average <b style='color:var(--accent);font-size:18px'>" + avg + "%</b></span>") + "</div>" +
      (scores.length ? "<table class='tests-table'><thead><tr><th>Test #</th><th>Date</th><th>Portions</th><th class='c'>Marks</th><th class='c'>Out of</th><th class='c'>%</th></tr></thead><tbody>" +
        scores.map(function (r) {
          var p = Number(r.total) > 0 ? Math.round(Number(r.score) / Number(r.total) * 100) : null;
          var col = p === null ? "" : p >= 75 ? "var(--accent3)" : p >= 50 ? "var(--accent2)" : "var(--danger)";
          var d = r.date ? new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", {day: "2-digit", month: "short"}) : "\u2014";
          return "<tr><td>" + esc(r.remarks || "Test") + (r.type === "One-to-one test" ? " <span class='muted small'>one-to-one</span>" : "") + "</td><td>" + d +
            "</td><td>" + esc(r.title) + "</td><td class='c'><b>" + esc(r.score) + "</b></td><td class='c'>" + esc(r.total) +
            "</td><td class='c' style='color:" + col + ";font-weight:700'>" + (p === null ? "\u2014" : p + "%") + "</td></tr>";
        }).join("") + "</tbody></table>"
      : "<div class='empty' style='padding:24px'><div class='empty-text'>No test marks yet.</div></div>");
    div.appendChild(scSec);

    // Switch to profile page
    document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
    document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
    Utils.el("page-profile").classList.add("active");
    Utils.el("page-title").textContent = name + " \u2014 Profile";
    Utils.el("page-sub").textContent = Utils.grade(s.cls) + (Hourly.isHourly(s) ? " \u00b7 hourly student" : "");
    Utils.el("topbar-action").style.display = "none";
    currentPage = "profile";
  }

  function setFee(idx) {
    var D = Data.get();
    var fee = Utils.el("prof-fee-input").value.trim();
    D.students[idx].monthlyFee = fee;
    Data.log("Updated monthly fee for <b>" + Utils.fullName(D.students[idx]) + "</b> to \u20b9" + fee);
    Data.save();
  }

  function _feeChange() {
    var D = Data.get();
    var sk = this.dataset.sk; var name = this.dataset.name; var field = this.dataset.field;
    if (!D.paygrid)       D.paygrid       = {};
    if (!D.paygrid[sk])   D.paygrid[sk]   = {};
    if (!D.paygrid[sk][name]) D.paygrid[sk][name] = {status:"", amount:"", notes:"", paydate:""};
    D.paygrid[sk][name][field] = this.value;
    Data.save();
  }

  function _cycleStatus(btn) {
    var D = Data.get();
    var sk = btn.dataset.sk; var name = btn.dataset.name;
    if (!D.paygrid)       D.paygrid       = {};
    if (!D.paygrid[sk])   D.paygrid[sk]   = {};
    if (!D.paygrid[sk][name]) D.paygrid[sk][name] = {status:"", amount:"", notes:"", paydate:""};
    var cur  = D.paygrid[sk][name].status || "";
    var next = _STATUS_CYCLE[cur] !== undefined ? _STATUS_CYCLE[cur] : "";
    D.paygrid[sk][name].status = next;
    Data.save();
    var STATUS_CLASS = {"":"status-none","Pending":"status-pending","Paid":"status-paid","Overdue":"status-overdue"};
    btn.className   = "pay-btn " + (STATUS_CLASS[next] || "status-none");
    btn.textContent = next || "\u2014 Unset \u2014";
  }

  function _detailRow(label, value) {
    return "<div class='profile-detail-row'>" +
      "<div class='profile-detail-label'>" + label + "</div>" +
      "<div class='profile-detail-value'>" + (value || "\u2014") + "</div>" +
    "</div>";
  }

  return { view: view, setFee: setFee };
})();
