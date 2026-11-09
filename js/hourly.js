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

  // A payment noted "For October 2026" pays for that month.
  function _forMonth(p) {
    var m = /\bfor\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i.exec(p.notes || "");
    if (!m) return null;
    var i = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(m[1].toLowerCase());
    return m[2] + "-" + String(i + 1).padStart(2, "0");
  }

  // Bills by month for the academic year shown. Payments are worked out over
  // the student's whole history: a payment marked "For <month>" pays that
  // month; the rest go to the oldest unpaid months first. So a payment made
  // in April for February counts towards February's year, not April's.
  function account(name) {
    var fee = {};                                     // every month with sessions
    sessionsOf(name).forEach(function (x) {
      var ym = String(x.date).slice(0, 7), h = sessionHours(x);
      var f = fee[ym] = fee[ym] || { hours: 0, fee: 0, count: 0 };
      f.hours += h; f.count++; f.fee += h * Number(x.rate || 0);
    });
    var all = Object.keys(fee).sort(), paidTo = {}, pool = 0, lastPay = null;
    paymentsOf(name).forEach(function (p) {
      var amt = Number(p.amount || 0), fm = _forMonth(p);
      if (fm && fee[fm]) paidTo[fm] = (paidTo[fm] || 0) + amt; else pool += amt;
      lastPay = p;
    });
    all.forEach(function (ym) {                       // over-payment for a month joins the pool
      if ((paidTo[ym] || 0) > fee[ym].fee) { pool += paidTo[ym] - fee[ym].fee; paidTo[ym] = fee[ym].fee; }
    });
    all.forEach(function (ym) {
      var need = fee[ym].fee - (paidTo[ym] || 0), take = Math.min(pool, Math.max(0, need));
      paidTo[ym] = (paidTo[ym] || 0) + take; pool -= take;
    });
    var months = {}, billed = 0, hours = 0, paid = 0;
    ACYR.forEach(function (ym) {
      var f = fee[ym] || { hours: 0, fee: 0, count: 0 }, pd = paidTo[ym] || 0;
      months[ym] = { hours: f.hours, fee: f.fee, count: f.count, paid: pd,
                     status: f.fee <= 0 ? "" : pd >= f.fee - 0.5 ? "Paid" : pd > 0 ? "Part-paid" : "Due" };
      billed += f.fee; hours += f.hours; paid += pd;
    });
    // Money paid in advance shows in the year it was received.
    var credit = lastPay && ACYR.indexOf(String(lastPay.date).slice(0, 7)) >= 0 ? Math.max(0, pool) : 0;
    return { months: months, hours: hours, billed: billed, paid: paid + credit,
             balance: billed - paid, credit: credit };
  }

  // Hourly in the academic year shown: this year, an hourly student; in an
  // earlier year, anyone who had one-to-one sessions that year.
  function hourlyIn(s) {
    if (s.yearCls || isCurrentAcad()) return isHourly(s) && Utils.inYear(s);   // each year has its own hourly records
    var n = Utils.fullName(s);
    return sessionsOf(n).some(function (x) { return ACYR.indexOf(String(x.date).slice(0, 7)) >= 0; });
  }

  // Dashboard / payments page helpers
  function totals() {
    var t = { hours: 0, billed: 0, paid: 0, balance: 0, income: {} };
    ACYR.forEach(function (ym) { t.income[ym] = 0; });
    var seen = {};                                   // one account per person
    Data.get().students.filter(hourlyIn).forEach(function (s) {
      var name = Utils.fullName(s); if (seen[name]) return; seen[name] = true;
      var a = account(name);
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
  function _editId() { return Profile.editId(); }

  function profileHtml(idx) {
    var s = Data.get().students[idx], name = Utils.fullName(s), a = account(name);
    var P = Profile;

    // ---- Hourly fees by month (rate locked, ✏ to change) ----
    var rows = ACYR.filter(function (ym) { var m = a.months[ym]; return m.count || m.paid; }).map(function (ym, i) {
      var m = a.months[ym];
      var cls = {"Paid":"chip-green","Part-paid":"chip-gold","Due":"chip-red"}[m.status] || "";
      return "<tr><td class='num'>" + (i + 1) + "</td><td>" + ACYR_LBL[ym] + "</td><td>" + m.count + "</td><td>" + hm(m.hours) + "</td><td>" + money(m.fee) +
             "</td><td>" + money(m.paid) + "</td><td>" + (m.status ? "<span class='chip " + cls + "'>" + m.status + "</span>" : "") + "</td></tr>";
    }).join("");
    var rate = P.lockedValue("Rate per hour", s.hourlyRate ? money(s.hourlyRate) : "not set", "rate",
      "<input id='hr-rate' class='pf-focus' type='number' min='0' value='" + esc(s.hourlyRate || "") + "' placeholder='e.g. 800'>",
      "Hourly.setRate(" + idx + ")");
    var due = a.balance > 0.5;
    var html = P.sec("hfees", "Hourly fees " + P.yearLabel(),
      hm(a.hours) + " hrs &middot; " + (due ? "<span style='color:var(--danger)'>" + money(a.balance) + " due</span>"
                                            : "<span style='color:var(--accent3)'>" + (a.credit > 0.5 ? money(a.credit) + " in credit" : "settled") + "</span>"),
      "<div class='hourly-sum'>" +
        "<div><span>Hours</span><b>" + hm(a.hours) + "</b></div>" +
        "<div><span>Billed</span><b>" + money(a.billed) + "</b></div>" +
        "<div><span>Paid</span><b>" + money(a.paid) + "</b></div>" +
        "<div class='" + (due ? "due" : "ok") + "'><span>" + (due ? "Balance due" : a.credit > 0.5 ? "In credit" : "Balance") +
          "</span><b>" + money(due ? a.balance : a.credit) + "</b></div>" +
      "</div>" +
      "<table class='hourly-table'><thead><tr><th class='num'>#</th><th>Month</th><th>Sessions</th><th>Hours</th><th>Fee</th><th>Paid</th><th>Status</th></tr></thead>" +
      "<tbody>" + (rows || "<tr><td colspan='7' class='muted'>No sessions yet this year.</td></tr>") + "</tbody></table>",
      rate, "pf-full pf-hover");

    // ---- Sessions ----
    var ses = sessionsOf(name).slice().reverse();
    var eSes = P.editing("ses") ? ses.filter(function (x) { return x.id === _editId(); })[0] : null;
    var adding = P.editing("ses", "new");
    var chOpts = function (cur) {
      return Settings.chapters(Utils.clsOf(s) || s.cls || "Grade XI").map(function (c) {
        var v = c === "-- None --" ? "" : c;
        return "<option value='" + esc(v) + "'" + (v === (cur || "") ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
    };
    var tOpts = function (cur) {
      return TIMES.filter(function (t) { return t !== "--"; }).map(function (t) { return "<option" + (t === cur ? " selected" : "") + ">" + t + "</option>"; }).join("");
    };
    var sesForm = (adding || eSes) ?
      "<form class='hourly-form' onsubmit='return Hourly.saveSession(event," + idx + ")'>" +
        "<div class='hf-grid'>" +
          "<div class='form-row'><label>Date</label><input id='ses-date' class='pf-focus' type='date' required value='" + (eSes ? esc(eSes.date) : Utils.todayIso()) + "'></div>" +
          "<div class='form-row'><label>Start</label><select id='ses-start'>" + tOpts(eSes && eSes.start) + "</select></div>" +
          "<div class='form-row'><label>End</label><select id='ses-end'>" + tOpts(eSes && eSes.end) + "</select></div>" +
          "<div class='form-row hf-wide'><label>Chapter</label><select id='ses-chapter'>" + chOpts(eSes && eSes.chapter) + "</select></div>" +
          "<div class='form-row hf-wide'><label>Notes</label><input id='ses-notes' placeholder='Topics covered' value='" + esc(eSes ? eSes.notes || "" : "") + "'></div>" +
        "</div>" +
        "<div class='user-form-actions'>" +
          (eSes ? "<button type='button' class='btn btn-danger btn-sm' style='margin-right:auto' onclick='Hourly.delSession(" + idx + ",\"" + esc(eSes.id) + "\")'>Delete this session</button>"
                : "<span class='muted' style='margin-right:auto'>Billed at " + (s.hourlyRate ? money(s.hourlyRate) + "/hr" : "the student's rate") + "</span>") +
          "<button type='button' class='btn btn-secondary btn-sm' onclick='Profile.cancel()'>Cancel</button>" +
          "<button type='submit' class='btn btn-primary btn-sm'>" + (eSes ? "Save changes" : "Add session") + "</button></div>" +
      "</form>" : "";
    var sesBody = sesForm +
      "<div class='hourly-list'><table class='hourly-table'><thead><tr><th class='num'>#</th><th>Date</th><th>Time</th><th>Hours</th><th>Chapter</th><th></th></tr></thead><tbody>" +
      (ses.length ? ses.map(function (x, i) {
        var d = new Date(x.date + "T00:00:00");
        return "<tr" + (eSes && eSes.id === x.id ? " class='editing'" : "") + " title='" + esc(x.notes || "") + "'><td class='num'>" + (ses.length - i) + "</td><td>" + d.toLocaleDateString("en-GB", {day:"2-digit", month:"short"}) +
          " <span class='muted'>" + d.toLocaleDateString("en-GB", {weekday:"short"}) + "</span></td>" +
          "<td>" + esc(x.start) + "–" + esc(x.end) + "</td><td>" + hm(sessionHours(x)) + "</td>" +
          "<td>" + esc(x.chapter || "—") + (x.notes ? "<div class='muted small'>" + esc(x.notes) + "</div>" : "") + "</td>" +
          "<td class='edit-cell'>" + Utils.hoverEdit("Profile.edit(\"ses\",\"" + x.id + "\",\"ses\")", "Change this session") + "</td></tr>";
      }).join("") : "<tr><td colspan='6' class='muted'>No sessions yet. Use + Add session.</td></tr>") +
      "</tbody></table></div>";

    // ---- Payments received ----
    var pays = paymentsOf(name).slice().reverse();
    var ePay = P.editing("pay") ? pays.filter(function (x) { return x.id === _editId(); })[0] : null;
    var addingPay = P.editing("pay", "new");
    var payForm = (addingPay || ePay) ?
      "<form class='hourly-form' onsubmit='return Hourly.savePayment(event," + idx + ")'>" +
        "<div class='hf-grid'>" +
          "<div class='form-row'><label>Date</label><input id='pay-date' class='pf-focus' type='date' required value='" + (ePay ? esc(ePay.date) : Utils.todayIso()) + "'></div>" +
          "<div class='form-row'><label>Amount (₹)</label><input id='pay-amount' type='number' min='1' required value='" + (ePay ? esc(ePay.amount) : a.balance > 0 ? Math.round(a.balance) : "") + "'></div>" +
          "<div class='form-row hf-wide'><label>Notes</label><input id='pay-notes' placeholder='e.g. bank transfer, cash' value='" + esc(ePay ? ePay.notes || "" : "") + "'></div>" +
        "</div>" +
        "<div class='user-form-actions'>" +
          (ePay ? "<button type='button' class='btn btn-danger btn-sm' style='margin-right:auto' onclick='Hourly.delPayment(" + idx + ",\"" + esc(ePay.id) + "\")'>Delete this payment</button>" : "") +
          "<button type='button' class='btn btn-secondary btn-sm' onclick='Profile.cancel()'>Cancel</button>" +
          "<button type='submit' class='btn btn-primary btn-sm'>" + (ePay ? "Save changes" : "Add payment") + "</button></div>" +
      "</form>" : "";
    var payBody = payForm +
      "<div class='hourly-list'><table class='hourly-table'><thead><tr><th class='num'>#</th><th>Date</th><th>Amount</th><th>Notes</th><th></th></tr></thead><tbody>" +
      (pays.length ? pays.map(function (p, i) {
        return "<tr" + (ePay && ePay.id === p.id ? " class='editing'" : "") + "><td class='num'>" + (pays.length - i) + "</td><td>" + new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) + "</td>" +
          "<td>" + money(p.amount) + "</td><td>" + esc(p.notes || "") + "</td>" +
          "<td class='edit-cell'>" + Utils.hoverEdit("Profile.edit(\"pay\",\"" + p.id + "\",\"pay\")", "Change this payment") + "</td></tr>";
      }).join("") : "<tr><td colspan='5' class='muted'>No payments yet.</td></tr>") +
      "</tbody></table></div>";
    var paid = pays.reduce(function (t, p) { return t + (Number(p.amount) || 0); }, 0);

    return html +
      P.sec("ses", "Sessions", ses.length + " &middot; " + hm(a.hours) + " hrs", sesBody,
            "<button type='button' class='btn btn-secondary btn-sm' onclick='Profile.edit(\"ses\",\"new\",\"ses\")'>+ Add session</button>") +
      P.sec("pay", "Payments received", pays.length + " &middot; " + money(paid), payBody,
            "<button type='button' class='btn btn-secondary btn-sm' onclick='Profile.edit(\"pay\",\"new\",\"pay\")'>+ Add payment</button>");
  }

  // ---------- actions ----------
  function _id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function _refresh() { Profile.done(); Profile.refresh(); }

  function setRate(idx) {
    var s = Data.get().students[idx], v = Utils.el("hr-rate").value.trim();
    s.hourlyRate = v;
    Data.log("Set hourly rate for <b>" + esc(Utils.fullName(s)) + "</b> to ₹" + v);
    Data.save(); _refresh();
  }

  // Add a session, or save changes to the one being edited
  function saveSession(e, idx) {
    if (e) e.preventDefault();
    var s = Data.get().students[idx], id = _editId();
    var old = id !== "new" ? _D().sessions.filter(function (x) { return x.id === id; })[0] : null;
    var x = { id: old ? old.id : _id(), student: Utils.fullName(s), date: Utils.el("ses-date").value,
              start: Utils.el("ses-start").value, end: Utils.el("ses-end").value,
              chapter: Utils.el("ses-chapter").value, notes: Utils.el("ses-notes").value.trim(),
              rate: old ? old.rate : s.hourlyRate || "" };
    if (!sessionHours(x)) { Dialog.alert("The end time must be after the start time."); return false; }
    if (!x.rate) { Dialog.alert("Set the student's rate per hour first (Hourly fees, ✎ next to the rate)."); return false; }
    if (old) Object.assign(old, x); else _D().sessions.push(x);
    Data.log((old ? "Changed" : "Added") + " a " + hm(sessionHours(x)) + " session for <b>" + esc(x.student) + "</b> (" + x.date + ")");
    Data.save(); _refresh();
    return false;
  }

  function delSession(idx, id) {
    Dialog.confirm("Delete this session? Its hours will be removed from the bill.", {okText: "Delete", danger: true}).then(function (ok) {
      if (!ok) return;
      var D = _D(); D.sessions = D.sessions.filter(function (x) { return x.id !== id; });
      Data.log("Deleted a session for <b>" + esc(Utils.fullName(D.students[idx])) + "</b>");
      Data.save(); _refresh();
    });
  }

  function savePayment(e, idx) {
    if (e) e.preventDefault();
    var s = Data.get().students[idx], id = _editId();
    var old = id !== "new" ? _D().hourpay.filter(function (x) { return x.id === id; })[0] : null;
    var p = { id: old ? old.id : _id(), student: Utils.fullName(s), date: Utils.el("pay-date").value,
              amount: Utils.el("pay-amount").value, notes: Utils.el("pay-notes").value.trim() };
    if (!(Number(p.amount) > 0)) { Dialog.alert("Enter the amount received."); return false; }
    if (old) Object.assign(old, p); else _D().hourpay.push(p);
    Data.log((old ? "Changed a payment of " : "Recorded ") + money(p.amount) + " from <b>" + esc(p.student) + "</b>");
    Data.save(); _refresh();
    return false;
  }

  function delPayment(idx, id) {
    Dialog.confirm("Delete this payment?", {okText: "Delete", danger: true}).then(function (ok) {
      if (!ok) return;
      var D = _D(); D.hourpay = D.hourpay.filter(function (x) { return x.id !== id; });
      Data.log("Deleted a payment for <b>" + esc(Utils.fullName(D.students[idx])) + "</b>");
      Data.save(); _refresh();
    });
  }

  return { parseTime: parseTime, hm: hm, isHourly: isHourly, inGroup: inGroup, sessionHours: sessionHours,
           account: account, totals: totals, hourlyIn: hourlyIn, sessionDays: sessionDays, profileHtml: profileHtml,
           setRate: setRate, saveSession: saveSession, delSession: delSession, savePayment: savePayment, delPayment: delPayment };
})();
