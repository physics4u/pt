// ================================================================
//  hourly.js — Hourly (one-to-one) students.
//
//  An hourly student has a rate per hour. Each one-to-one session
//  (date, start, end, chapter, notes) is billed at the rate saved on
//  that session, so changing the rate never alters past bills.
//  Payments are recorded as they arrive (date, amount, notes) and are
//  applied to the oldest unpaid months first, giving each month a
//  status: Paid, Part-paid or Due.
//  Hourly students who also attend group classes ("Also attends group
//  classes") appear in the group attendance, planner and payments too.
// ================================================================
var Hourly = (function () {

  // ---------- helpers shared with other pages ----------
  function parseTime(t) {                       // "04:30 PM" / "16:30" → 16.5
    if (!t || t === "--") return null;
    var m24 = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m24) return Number(m24[1]) + Number(m24[2]) / 60;
    var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t);
    if (!m) return null;
    var h = Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0);
    return h + Number(m[2]) / 60;
  }
  function hm(h) {                              // 1.5 → "1:30"
    var mins = Math.round((h || 0) * 60);
    return Math.floor(mins / 60) + ":" + String(mins % 60).padStart(2, "0");
  }
  function money(n) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function isHourly(s) { return (s.batch || "Regular") === "Hourly"; }
  // In the group classes (attendance sheet, planner, monthly fees)?
  function inGroup(s)  { return !isHourly(s) || s.groupToo === "yes"; }

  function sessionHours(x) {
    var a = parseTime(x.start), b = parseTime(x.end);
    return a === null || b === null || b <= a ? 0 : b - a;
  }

  function _D() {
    var D = Data.get();
    if (!D.sessions) D.sessions = [];
    if (!D.hourpay)  D.hourpay  = [];
    return D;
  }
  function sessionsOf(name) {
    return _D().sessions.filter(function (x) { return x.student === name; })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
  }
  function paymentsOf(name) {
    return _D().hourpay.filter(function (x) { return x.student === name; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  // Bills by month for the academic year, payments applied oldest-first.
  function account(name) {
    var months = {}, billed = 0, hours = 0, paid = 0;
    ACYR.forEach(function (ym) { months[ym] = { hours: 0, fee: 0, count: 0, paid: 0 }; });
    var inYear = function (d) { return months.hasOwnProperty(String(d).slice(0, 7)); };
    sessionsOf(name).forEach(function (x) {
      if (!inYear(x.date)) return;
      var h = sessionHours(x), m = months[x.date.slice(0, 7)];
      m.hours += h; m.count++; m.fee += h * Number(x.rate || 0);
    });
    ACYR.forEach(function (ym) { billed += months[ym].fee; hours += months[ym].hours; });
    paymentsOf(name).forEach(function (p) { if (inYear(p.date)) paid += Number(p.amount || 0); });
    var left = paid;
    ACYR.forEach(function (ym) {
      var m = months[ym], take = Math.min(left, m.fee);
      m.paid = take; left -= take;
      m.status = m.fee <= 0 ? "" : take >= m.fee - 0.5 ? "Paid" : take > 0 ? "Part-paid" : "Due";
    });
    return { months: months, hours: hours, billed: billed, paid: paid,
             balance: billed - paid, credit: Math.max(0, left) };
  }

  // Dashboard / payments page helpers
  function totals() {
    var t = { hours: 0, billed: 0, paid: 0, balance: 0, income: {} };
    ACYR.forEach(function (ym) { t.income[ym] = 0; });
    Data.get().students.filter(isHourly).forEach(function (s) {
      var name = Utils.fullName(s), a = account(name);
      t.hours += a.hours; t.billed += a.billed; t.paid += a.paid; t.balance += Math.max(0, a.balance);
      // Income counts in the month the fees are for (payments applied oldest
      // month first), like the monthly fees of regular students.
      ACYR.forEach(function (ym) { t.income[ym] += a.months[ym].paid; });
      // Anything paid in advance (credit) counts in the month it was received.
      if (a.credit > 0) {
        var last = paymentsOf(name).filter(function (p) { return t.income.hasOwnProperty(String(p.date).slice(0, 7)); }).pop();
        if (last) t.income[String(last.date).slice(0, 7)] += a.credit;
      }
    });
    return t;
  }

  // Dates (YYYY-MM-DD) with a session — attendance for hourly students.
  function sessionDays(name, ym) {
    return sessionsOf(name).filter(function (x) { return x.date.slice(0, 7) === ym; })
      .map(function (x) { return Number(x.date.slice(8, 10)); });
  }

  // ---------- profile sections ----------
  function renderProfile(div, idx) {
    var s = Data.get().students[idx], name = Utils.fullName(s), a = account(name);
    var yr = ACYR_LBL[ACYR[0]].split(" ")[1] + "–" + String(Number(ACYR_LBL[ACYR[0]].split(" ")[1]) + 1).slice(2);

    // Fees by month
    var fee = document.createElement("div"); fee.className = "profile-full hourly-block";
    var rows = ACYR.filter(function (ym) { var m = a.months[ym]; return m.count || m.paid; }).map(function (ym, i) {
      var m = a.months[ym];
      var cls = {"Paid":"chip-green","Part-paid":"chip-gold","Due":"chip-red"}[m.status] || "";
      return "<tr><td class='num'>" + (i + 1) + "</td><td>" + ACYR_LBL[ym] + "</td><td>" + m.count + "</td><td>" + hm(m.hours) + "</td><td>" + money(m.fee) +
             "</td><td>" + money(m.paid) + "</td><td>" + (m.status ? "<span class='chip " + cls + "'>" + m.status + "</span>" : "") + "</td></tr>";
    }).join("");
    fee.innerHTML =
      "<div class='profile-section-title hourly-head'><span>Hourly fees " + yr + "</span>" +
        "<span class='hourly-rate'><label for='hr-rate'>Rate per hour (₹)</label>" +
        "<input id='hr-rate' type='number' min='0' value='" + esc(s.hourlyRate || "") + "' placeholder='e.g. 800'>" +
        "<button class='btn btn-primary btn-sm' onclick='Hourly.setRate(" + idx + ")'>Save rate</button></span></div>" +
      "<div class='hourly-sum'>" +
        "<div><span>Hours</span><b>" + hm(a.hours) + "</b></div>" +
        "<div><span>Billed</span><b>" + money(a.billed) + "</b></div>" +
        "<div><span>Paid</span><b>" + money(a.paid) + "</b></div>" +
        "<div class='" + (a.balance > 0.5 ? "due" : "ok") + "'><span>" + (a.balance > 0.5 ? "Balance due" : a.credit > 0.5 ? "In credit" : "Balance") +
          "</span><b>" + money(a.balance > 0 ? a.balance : a.credit) + "</b></div>" +
      "</div>" +
      "<table class='hourly-table'><thead><tr><th class='num'>#</th><th>Month</th><th>Sessions</th><th>Hours</th><th>Fee</th><th>Paid</th><th>Status</th></tr></thead>" +
      "<tbody>" + (rows || "<tr><td colspan='7' class='muted'>No sessions yet this year.</td></tr>") + "</tbody></table>";
    div.appendChild(fee);

    // Sessions + payments side by side
    var two = document.createElement("div"); two.className = "hourly-two";

    var chOpts = Settings.chapters(s.cls || "Grade XI").map(function (c) {
      return "<option value='" + esc(c === "-- None --" ? "" : c) + "'>" + esc(c) + "</option>"; }).join("");
    var tOpts = TIMES.filter(function (t) { return t !== "--"; }).map(function (t) { return "<option>" + t + "</option>"; }).join("");
    var ses = sessionsOf(name).slice().reverse();
    var sesSec = document.createElement("div"); sesSec.className = "profile-section";
    sesSec.innerHTML =
      "<div class='profile-section-title hourly-head'><span>Sessions <span class='muted'>&middot; " + ses.length + "</span></span>" +
        "<button class='btn btn-secondary btn-sm' onclick='Hourly.toggle(\"ses-form\")'>+ Add session</button></div>" +
      "<form id='ses-form' class='hourly-form' style='display:none' onsubmit='return Hourly.addSession(event," + idx + ")'>" +
        "<div class='hf-grid'>" +
          "<div class='form-row'><label>Date</label><input id='ses-date' type='date' required value='" + new Date().toISOString().slice(0, 10) + "'></div>" +
          "<div class='form-row'><label>Start</label><select id='ses-start'>" + tOpts + "</select></div>" +
          "<div class='form-row'><label>End</label><select id='ses-end'>" + tOpts + "</select></div>" +
          "<div class='form-row hf-wide'><label>Chapter</label><select id='ses-chapter'>" + chOpts + "</select></div>" +
          "<div class='form-row hf-wide'><label>Notes</label><input id='ses-notes' placeholder='Topics covered'></div>" +
        "</div>" +
        "<div class='user-form-actions'><span class='muted' style='margin-right:auto'>Billed at " + (s.hourlyRate ? money(s.hourlyRate) + "/hr" : "the student's rate") + "</span>" +
          "<button type='button' class='btn btn-secondary btn-sm' onclick='Hourly.toggle(\"ses-form\")'>Cancel</button>" +
          "<button type='submit' class='btn btn-primary btn-sm'>Add session</button></div>" +
      "</form>" +
      "<div class='hourly-list'><table class='hourly-table'><thead><tr><th class='num'>#</th><th>Date</th><th>Time</th><th>Hours</th><th>Chapter</th><th></th></tr></thead><tbody>" +
      (ses.length ? ses.map(function (x, i) {
        var d = new Date(x.date + "T00:00:00");
        return "<tr title='" + esc(x.notes || "") + "'><td class='num'>" + (ses.length - i) + "</td><td>" + d.toLocaleDateString("en-GB", {day:"2-digit", month:"short"}) +
          " <span class='muted'>" + d.toLocaleDateString("en-GB", {weekday:"short"}) + "</span></td>" +
          "<td>" + esc(x.start) + "–" + esc(x.end) + "</td><td>" + hm(sessionHours(x)) + "</td>" +
          "<td>" + esc(x.chapter || "—") + (x.notes ? "<div class='muted small'>" + esc(x.notes) + "</div>" : "") + "</td>" +
          "<td><button class='link-btn danger-link' onclick='Hourly.delSession(" + idx + ",\"" + esc(x.id) + "\")'>Delete</button></td></tr>";
      }).join("") : "<tr><td colspan='6' class='muted'>No sessions yet. Use + Add session.</td></tr>") +
      "</tbody></table></div>";

    var pays = paymentsOf(name).slice().reverse();
    var paySec = document.createElement("div"); paySec.className = "profile-section";
    paySec.innerHTML =
      "<div class='profile-section-title hourly-head'><span>Payments received <span class='muted'>&middot; " + pays.length + "</span></span>" +
        "<button class='btn btn-secondary btn-sm' onclick='Hourly.toggle(\"pay-form\")'>+ Add payment</button></div>" +
      "<form id='pay-form' class='hourly-form' style='display:none' onsubmit='return Hourly.addPayment(event," + idx + ")'>" +
        "<div class='hf-grid'>" +
          "<div class='form-row'><label>Date</label><input id='pay-date' type='date' required value='" + new Date().toISOString().slice(0, 10) + "'></div>" +
          "<div class='form-row'><label>Amount (₹)</label><input id='pay-amount' type='number' min='1' required value='" + (a.balance > 0 ? Math.round(a.balance) : "") + "'></div>" +
          "<div class='form-row hf-wide'><label>Notes</label><input id='pay-notes' placeholder='e.g. bank transfer, cash'></div>" +
        "</div>" +
        "<div class='user-form-actions'>" +
          "<button type='button' class='btn btn-secondary btn-sm' onclick='Hourly.toggle(\"pay-form\")'>Cancel</button>" +
          "<button type='submit' class='btn btn-primary btn-sm'>Add payment</button></div>" +
      "</form>" +
      "<div class='hourly-list'><table class='hourly-table'><thead><tr><th class='num'>#</th><th>Date</th><th>Amount</th><th>Notes</th><th></th></tr></thead><tbody>" +
      (pays.length ? pays.map(function (p, i) {
        return "<tr><td class='num'>" + (pays.length - i) + "</td><td>" + new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) + "</td>" +
          "<td>" + money(p.amount) + "</td><td>" + esc(p.notes || "") + "</td>" +
          "<td><button class='link-btn danger-link' onclick='Hourly.delPayment(" + idx + ",\"" + esc(p.id) + "\")'>Delete</button></td></tr>";
      }).join("") : "<tr><td colspan='5' class='muted'>No payments yet.</td></tr>") +
      "</tbody></table></div>";

    two.appendChild(sesSec); two.appendChild(paySec); div.appendChild(two);
  }

  // ---------- actions ----------
  function _id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function _refresh(idx) { Profile.view(idx); }
  function toggle(id) {
    var f = Utils.el(id); f.style.display = f.style.display === "none" ? "" : "none";
  }

  function setRate(idx) {
    var s = Data.get().students[idx], v = Utils.el("hr-rate").value.trim();
    s.hourlyRate = v;
    Data.log("Set hourly rate for <b>" + esc(Utils.fullName(s)) + "</b> to ₹" + v);
    Data.save(); _refresh(idx);
  }

  function addSession(e, idx) {
    if (e) e.preventDefault();
    var s = Data.get().students[idx];
    var x = { id: _id(), student: Utils.fullName(s), date: Utils.el("ses-date").value,
              start: Utils.el("ses-start").value, end: Utils.el("ses-end").value,
              chapter: Utils.el("ses-chapter").value, notes: Utils.el("ses-notes").value.trim(),
              rate: s.hourlyRate || "" };
    if (!sessionHours(x)) { Dialog.alert("The end time must be after the start time."); return false; }
    if (!x.rate) { Dialog.alert("Set the student's rate per hour first (above)."); return false; }
    _D().sessions.push(x);
    Data.log("Added a " + hm(sessionHours(x)) + " session for <b>" + esc(x.student) + "</b> (" + x.date + ")");
    Data.save(); _refresh(idx);
    return false;
  }

  function delSession(idx, id) {
    Dialog.confirm("Delete this session? Its hours will be removed from the bill.", {okText: "Delete", danger: true}).then(function (ok) {
      if (!ok) return;
      var D = _D(); D.sessions = D.sessions.filter(function (x) { return x.id !== id; });
      Data.log("Deleted a session for <b>" + esc(Utils.fullName(D.students[idx])) + "</b>");
      Data.save(); _refresh(idx);
    });
  }

  function addPayment(e, idx) {
    if (e) e.preventDefault();
    var s = Data.get().students[idx];
    var p = { id: _id(), student: Utils.fullName(s), date: Utils.el("pay-date").value,
              amount: Utils.el("pay-amount").value, notes: Utils.el("pay-notes").value.trim() };
    if (!(Number(p.amount) > 0)) { Dialog.alert("Enter the amount received."); return false; }
    _D().hourpay.push(p);
    Data.log("Recorded " + money(p.amount) + " from <b>" + esc(p.student) + "</b>");
    Data.save(); _refresh(idx);
    return false;
  }

  function delPayment(idx, id) {
    Dialog.confirm("Delete this payment?", {okText: "Delete", danger: true}).then(function (ok) {
      if (!ok) return;
      var D = _D(); D.hourpay = D.hourpay.filter(function (x) { return x.id !== id; });
      Data.log("Deleted a payment for <b>" + esc(Utils.fullName(D.students[idx])) + "</b>");
      Data.save(); _refresh(idx);
    });
  }

  // Payments page: one table for the grade's hourly students.
  return { parseTime: parseTime, hm: hm, isHourly: isHourly, inGroup: inGroup, sessionHours: sessionHours,
           account: account, totals: totals, sessionDays: sessionDays, renderProfile: renderProfile,
           toggle: toggle, setRate: setRate,
           addSession: addSession, delSession: delSession, addPayment: addPayment, delPayment: delPayment };
})();
