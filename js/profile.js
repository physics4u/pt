// ================================================================
//  profile.js — Student profile page
//
//  Every part of the profile is a collapsible section (Student details
//  starts open, the rest closed; a summary is shown on each heading).
//  Saved entries are locked: hover a row (or the fee / rate) and press
//  ✏ to change it. Delete / Clear is offered only while editing.
// ================================================================

var Profile = (function () {
  var _idx = -1;          // student shown
  var _open = {};         // which sections are open
  var _edit = null;       // what is being edited: {kind, id}
  var DEFAULT_OPEN = { details: true };

  function _esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function money(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function yearLabel() {
    var y = Number(ACYR_LBL[ACYR[0]].split(" ")[1]);
    return y + "–" + String(y + 1).slice(2);
  }

  // ---------- section helper (also used by hourly.js) ----------
  // actions: HTML shown on the heading (buttons stop the heading from toggling)
  // Sections parents receive: they carry an identification strip and a Share button.
  var SHARE = { att: "Attendance", fees: "Fees", hfees: "Hourly fees", report: "Report card" };

  function sec(key, title, meta, body, actions, cls) {
    var open = key in _open ? _open[key] : !!DEFAULT_OPEN[key];
    if (SHARE[key]) {
      body = _idStrip(String(title).replace(/<[^>]+>/g, "")) + body;
      actions = (actions || "") + "<button type='button' class='btn btn-secondary btn-sm pf-share' title='Make a picture to send' " +
        "onclick='Profile.share(\"" + key + "\", this)'>&#128247; Share</button>";
    }
    return "<details class='section pf-sec" + (cls ? " " + cls : "") + "' data-key='" + key + "'" + (open ? " open" : "") +
      " ontoggle='Profile.toggle(\"" + key + "\", this)'><summary><span class='section-title'>" + title + "</span>" +
      (meta ? "<span class='section-meta'>&middot; " + meta + "</span>" : "") +
      (actions ? "<span class='pf-actions' onclick='event.preventDefault()'>" + actions + "</span>" : "") +
      "<span class='show-pill' aria-hidden='true'></span></summary><div class='pf-body'>" + body + "</div></details>";
  }
  // Logo, student, class, academic year and today's date (for screenshots)
  function _idStrip(what) {
    var s = Data.get().students[_idx]; if (!s) return "";
    var cls = Utils.grade(Utils.clsOf(s) || s.cls) + (Hourly.isHourly(s) ? " \u00b7 Hourly" : "");
    var today = Utils.fmtDate(ptToday().date);
    return "<div class='pf-idstrip'><img src='logo.png' alt=''><div class='pf-id-main'><div class='pf-id-name'>" + _esc(Utils.fullName(s)) +
      "</div><div class='pf-id-sub'>" + _esc(cls) + " &middot; Academic year " + acadLabel() + "</div></div>" +
      "<div class='pf-id-right'><div class='pf-id-what'>" + _esc(what) + "</div><div class='pf-id-date'>" + today +
      "</div><div class='pf-id-org'>PT &middot; Physics Tuition</div></div></div>";
  }

  // Turn a section (with its strip) into a PNG: share it on a phone, download it on a computer.
  var _h2c = null;
  function _loadH2C() {
    if (window.html2canvas) return Promise.resolve();
    if (_h2c) return _h2c;
    _h2c = new Promise(function (ok, no) {
      var sc = document.createElement("script");
      sc.src = "js/vendor/html2canvas.min.js";
      sc.onload = function () { ok(); }; sc.onerror = function () { _h2c = null; no(); };
      document.head.appendChild(sc);
    });
    return _h2c;
  }
  function share(key, btn) {
    var d = document.querySelector(".pf-sec[data-key='" + key + "']"); if (!d) return;
    d.open = true; _open[key] = true;
    var body = d.querySelector(".pf-body"), s = Data.get().students[_idx];
    var file = Utils.fullName(s) + " - " + SHARE[key] + " - " + acadLabel().replace("\u2013", "-") + ".png";
    btn.disabled = true; var label = btn.innerHTML; btn.textContent = "Preparing\u2026";
    var held = [];
    var restore = function () { held.forEach(function (h) { h[0].setAttribute("ontoggle", h[1]); }); held = []; };
    var done = function () { restore(); btn.disabled = false; btn.innerHTML = label; };
    _loadH2C().then(function () {
      body.classList.add("pf-capturing");
      // the picture is made from a copy of the page: keep the copy's sections quiet
      held = []; document.querySelectorAll("[ontoggle]").forEach(function (e) { held.push([e, e.getAttribute("ontoggle")]); e.removeAttribute("ontoggle"); });
      var bg = getComputedStyle(document.body).backgroundColor;
      return window.html2canvas(body, { backgroundColor: bg, scale: 2, useCORS: true, logging: false,
        onclone: function (doc) { doc.querySelectorAll("[ontoggle]").forEach(function (e) { e.removeAttribute("ontoggle"); }); } });
    }).then(function (canvas) {
      body.classList.remove("pf-capturing"); restore();
      canvas.toBlob(function (blob) {
        var f = null;
        try { f = new File([blob], file, { type: "image/png" }); } catch (e) { f = null; }
        if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
          navigator.share({ files: [f], title: file.replace(/\.png$/, "") }).catch(function () {}).then(done);
        } else {
          var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          done();
        }
      }, "image/png");
    }).catch(function () {
      body.classList.remove("pf-capturing"); done();
      Dialog.alert("The picture couldn't be made. You can still take a screenshot: the section shows the student, class and date at the top.");
    });
  }

  function toggle(key, el) { _open[key] = el.open; }
  function openSec(key) { _open[key] = true; }
  function editing(kind, id) { return !!_edit && _edit.kind === kind && (id === undefined || _edit.id === id); }
  function edit(kind, id, secKey) { _edit = { kind: kind, id: id }; if (secKey) _open[secKey] = true; refresh(); }
  function editId() { return _edit ? _edit.id : null; }
  function cancel() { _edit = null; refresh(); }
  function done() { _edit = null; }
  function refresh() { view(_idx, true); }

  // A locked value with a ✏ that shows on hover (rate per hour, monthly fee)
  function lockedValue(label, valueHtml, kind, inputHtml, saveCall) {
    if (editing(kind)) {
      return "<span class='pf-lock editing'><label>" + label + "</label>" + inputHtml +
        "<button class='btn btn-primary btn-sm' onclick='" + saveCall + "'>Save</button>" +
        "<button class='btn btn-secondary btn-sm' onclick='Profile.cancel()'>Cancel</button></span>";
    }
    return "<span class='pf-lock'><span class='muted'>" + label + "</span> <b>" + valueHtml + "</b>" +
      "<button type='button' class='row-edit' title='Change' onclick='Profile.edit(\"" + kind + "\")'>&#9998;</button></span>";
  }

  // ---------- page ----------
  function view(idx, keep) {
    var D = Data.get();
    var s = D.students[idx]; if (!s) return;
    if (!keep || idx !== _idx) { _open = {}; _edit = null; }
    _idx = idx;
    var name = Utils.fullName(s);
    var div = Utils.el("profile-content");
    var scrollY = window.scrollY;

    // ---- Header ----
    var initials = ((s.fname || "")[0] || "") + ((s.lname || "")[0] || "");
    var html =
      "<div class='profile-header'>" +
        "<div class='profile-avatar'>" + _esc(initials) + "</div>" +
        "<div>" +
          "<div class='profile-name'>" + _esc(name) + "</div>" +
          "<div style='font-size:13px;color:var(--text3)'>" + Utils.grade(Utils.clsOf(s) || s.cls) + (s.school ? " &bull; " + _esc(s.school) : "") + "</div>" +
          "<div class='profile-meta'>" +
            "<span>&#128222; " + _esc(s.phone || "—") + "</span>" +
            "<span>&#9993; " + _esc(s.email || "—") + "</span>" +
            "<span>Batch: " + _esc(s.batch || "Regular") + "</span>" +
            "<span>Status: <b>" + _esc(Utils.statusIn(s)) + "</b>" + (isCurrentAcad() ? "" : " in " + acadLabel() + " <span class='muted'>(now " + _esc(s.status) + ")</span>") + "</span>" +
          "</div>" +
        "</div>" +
        "<div style='margin-left:auto'><button class='btn btn-secondary' onclick='showPage(\"students\")' style='font-size:12px'>&#8592; Back</button></div>" +
      "</div>";

    // ---- Details + attendance ----
    var details =
      _detailRow("Parent", s.parent) + _detailRow("Parent Phone", s.phone) + _detailRow("Student Phone", s.studentPhone) +
      _detailRow("Email", s.email) + _detailRow("Address", s.address) + _detailRow("Country", s.country) +
      (Hourly.isHourly(s) ? _detailRow("Rate per hour", s.hourlyRate ? money(s.hourlyRate) : "") +
                            _detailRow("Group classes", s.groupToo === "yes" ? "Also attends" : "No") : "") +
      (Hourly.inGroup(s) ? _detailRow("Monthly Fee", s.monthlyFee ? money(s.monthlyFee) : "") : "") +
      _detailRow("Start Date", Utils.fmtDate(s.startDate)) + _detailRow("End Date", Utils.fmtDate(s.endDate)) + _detailRow("Notes", s.notes);
    var att = _attendance(s, name);
    html += "<div class='profile-grid'>" +
      sec("details", "Student details", "", details,
          "<button type='button' class='row-edit' title='Edit student' onclick='Students.openModal(" + idx + ")'>&#9998;</button>", "pf-hover") +
      sec("att", "Attendance", att.meta, att.html) +
    "</div>";
    div.innerHTML = html;

    // ---- Hourly: fees, sessions, payments ----
    // A student can have a group record and an hourly record (same name):
    // either profile shows both parts for the year on screen.
    var hasSessions = (Data.get().sessions || []).some(function (x) { return x.student === name && ACYR.indexOf(String(x.date).slice(0, 7)) >= 0; });
    var hasFees = ACYR.some(function (ym) { return (((Data.get().paygrid || {})["paygrid|" + (Utils.clsOf(s) || s.cls) + "|" + ym]) || {})[name]; });
    if (Hourly.isHourly(s) || hasSessions) div.insertAdjacentHTML("beforeend", Hourly.profileHtml(idx));

    // ---- Group class fees ----
    if (Hourly.inGroup(s) || hasFees) div.insertAdjacentHTML("beforeend", _feesHtml(s, idx, name));

    // ---- Report card ----
    div.insertAdjacentHTML("beforeend", _reportHtml(name));

    // Switch to profile page
    if (!keep || currentPage !== "profile") {
      document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      Utils.el("page-profile").classList.add("active");
      Utils.el("page-title").textContent = name + " — Profile";
      Utils.el("page-sub").textContent = Utils.grade(Utils.clsOf(s) || s.cls) + (Hourly.isHourly(s) ? " · hourly student" : "");
      Utils.el("topbar-action").style.display = "none";
      currentPage = "profile";
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, scrollY);
    }
    var f = div.querySelector(".pf-focus"); if (f) f.focus();
  }

  // ---------- attendance: one compact line per month ----------
  function _attendance(s, name) {
    var D = Data.get(), tp = 0, ta = 0;
    var rows = ACYR.map(function (ym) {
      var sheet = (D.attsheets || {})["attsheet|" + (Utils.clsOf(s) || s.cls) + "|" + ym] || {};
      var rec = Object.assign({}, sheet[name] || {});
      if (Hourly.isHourly(s)) Hourly.sessionDays(name, ym).forEach(function (d) { rec[d] = "P"; });
      var days = Object.keys(rec).filter(function (d) { return rec[d] === "P" || rec[d] === "A"; })
                   .sort(function (a, b) { return Number(a) - Number(b); });
      if (!days.length) return "";
      var P = days.filter(function (d) { return rec[d] === "P"; }).length, A = days.length - P;
      tp += P; ta += A;
      return "<div class='att-row'><div class='att-row-label'><b>" + (ACYR_LBL[ym] || ym).replace(/^(\w{3})\w* \d{2}(\d{2})$/, "$1 '$2") + "</b>" +
        "<span><span class='p'>P " + P + "</span> <span class='a'>A " + A + "</span></span></div><div class='att-dots'>" +
        days.map(function (d) { return "<span class='att-dot " + (rec[d] === "P" ? "p" : "a") + "'>" + d + "</span>"; }).join("") +
        "</div></div>";
    }).join("");
    var pct = tp + ta ? Math.round(tp / (tp + ta) * 100) : null;
    return {
      meta: tp + ta ? "P " + tp + " &middot; A " + ta + " &middot; " + pct + "%" : "",
      html: rows || "<div class='muted' style='padding:12px 16px'>No attendance recorded yet.</div>"
    };
  }

  // ---------- group class fees: rows locked, ✏ to change ----------
  var STATUS_CHIP = { "Paid": "chip-green", "Pending": "chip-gold", "Overdue": "chip-red" };
  function _rec(s, ym, name) {
    var g = ((Data.get().paygrid || {})["paygrid|" + (Utils.clsOf(s) || s.cls) + "|" + ym] || {})[name];
    return g || { status: "", amount: "", notes: "", paydate: "" };
  }
  function _feesHtml(s, idx, name) {
    var paid = 0, pending = 0, overdue = 0;
    var rows = ACYR.map(function (ym, i) {
      var rec = _rec(s, ym, name), st = rec.status || "";
      if (st === "Paid") paid++; if (st === "Pending") pending++; if (st === "Overdue") overdue++;
      var amt = rec.amount || s.monthlyFee || "";
      if (editing("fee", ym)) {
        var opt = function (v, l) { return "<option value='" + v + "'" + (st === v ? " selected" : "") + ">" + l + "</option>"; };
        return "<tr class='editing'><td class='num'>" + (i + 1) + "</td><td>" + ACYR_LBL[ym] + "</td>" +
          "<td><input id='pf-amt' class='pf-focus' type='number' min='0' value='" + _esc(amt) + "' style='width:100px'></td>" +
          "<td><select id='pf-st'>" + opt("", "— Unset —") + opt("Pending", "Pending") + opt("Paid", "Paid") + opt("Overdue", "Overdue") + "</select></td>" +
          "<td><input id='pf-date' type='date' value='" + _esc(rec.paydate || "") + "'></td>" +
          "<td><input id='pf-notes' value='" + _esc(rec.notes || "") + "' placeholder='Notes'></td>" +
          "<td class='pf-row-actions'><button class='btn btn-primary btn-sm' onclick='Profile.saveFee(\"" + ym + "\")'>Save</button>" +
            "<button class='btn btn-secondary btn-sm' onclick='Profile.cancel()'>Cancel</button>" +
            (st || rec.paydate || rec.notes ? "<button class='btn btn-danger btn-sm' onclick='Profile.clearFee(\"" + ym + "\")'>Clear month</button>" : "") +
          "</td></tr>";
      }
      return "<tr><td class='num'>" + (i + 1) + "</td><td>" + ACYR_LBL[ym] + "</td>" +
        "<td>" + (amt ? money(amt) : "—") + "</td>" +
        "<td>" + (st ? "<span class='chip " + STATUS_CHIP[st] + "'>" + st + "</span>" : "<span class='muted'>—</span>") + "</td>" +
        "<td>" + _esc(Utils.fmtDate(rec.paydate)) + "</td><td>" + _esc(rec.notes || "") + "</td>" +
        "<td class='edit-cell'>" + Utils.hoverEdit("Profile.edit(\"fee\",\"" + ym + "\",\"fees\")", "Change this month") + "</td></tr>";
    }).join("");
    var feeLock = lockedValue("Monthly fee", s.monthlyFee ? money(s.monthlyFee) : "—", "mfee",
      "<input id='pf-mfee' class='pf-focus' type='number' min='0' value='" + _esc(s.monthlyFee || "") + "' placeholder='0'>",
      "Profile.setFee(" + idx + ")");
    var meta = "<span style='color:var(--accent3)'>" + paid + " paid</span>" +
      (pending ? " &middot; <span style='color:var(--accent2)'>" + pending + " pending</span>" : "") +
      (overdue ? " &middot; <span style='color:var(--danger)'>" + overdue + " overdue</span>" : "");
    return sec("fees", (Hourly.isHourly(s) ? "Group class fees " : "Fees ") + yearLabel(), meta,
      "<div style='overflow-x:auto'><table class='tests-table pf-table'><thead><tr><th class='num'>#</th><th>Month</th><th>Amount</th><th>Status</th>" +
      "<th>Payment date</th><th>Notes</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div>",
      feeLock, "pf-full pf-hover");
  }

  function setFee(idx) {
    var D = Data.get(), fee = Utils.el("pf-mfee").value.trim();
    D.students[idx].monthlyFee = fee;
    Data.log("Updated monthly fee for <b>" + _esc(Utils.fullName(D.students[idx])) + "</b> to ₹" + fee);
    Data.save(); done(); refresh();
  }
  function _grid(ym) {
    var D = Data.get(), s = D.students[_idx], name = Utils.fullName(s), sk = "paygrid|" + (Utils.clsOf(s) || s.cls) + "|" + ym;
    if (!D.paygrid) D.paygrid = {};
    if (!D.paygrid[sk]) D.paygrid[sk] = {};
    if (!D.paygrid[sk][name]) D.paygrid[sk][name] = { status: "", amount: "", notes: "", paydate: "" };
    return D.paygrid[sk][name];
  }
  function saveFee(ym) {
    var r = _grid(ym);
    r.amount = Utils.el("pf-amt").value.trim(); r.status = Utils.el("pf-st").value;
    r.paydate = Utils.el("pf-date").value; r.notes = Utils.el("pf-notes").value.trim();
    if (r.status === "Paid" && !r.paydate) r.paydate = Utils.todayIso();
    Data.save(); done(); refresh();
  }
  function clearFee(ym) {
    Dialog.confirm("Clear " + ACYR_LBL[ym] + "? Its status, payment date and notes will be removed.", { okText: "Clear", danger: true }).then(function (ok) {
      if (!ok) return;
      var r = _grid(ym); r.status = ""; r.paydate = ""; r.notes = "";
      Data.save(); done(); refresh();
    });
  }

  // ---------- report card ----------
  function _reportHtml(name) {
    Scores.ensure();
    var scores = (Data.get().scores || []).filter(function (sc) { return sc.student === name; })
                   .sort(function (a, b) { return String(a.date).localeCompare(b.date); });
    var pcts = scores.filter(function (r) { return Number(r.total) > 0; }).map(function (r) { return Number(r.score) / Number(r.total) * 100; });
    var avg = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : null;
    var body = scores.length ?
      "<table class='tests-table'><thead><tr><th class='num'>#</th><th>Test #</th><th>Date</th><th>Portions</th><th class='c'>Marks</th><th class='c'>Out of</th><th class='c'>%</th></tr></thead><tbody>" +
      scores.map(function (r, i) {
        var p = Number(r.total) > 0 ? Math.round(Number(r.score) / Number(r.total) * 100) : null;
        var col = p === null ? "" : p >= 75 ? "var(--accent3)" : p >= 50 ? "var(--accent2)" : "var(--danger)";
        var d = r.date ? Utils.fmtDate(r.date) : "—";
        return "<tr><td class='num'>" + (i + 1) + "</td><td>" + _esc(r.remarks || "Test") + (r.type === "One-to-one test" ? " <span class='muted small'>one-to-one</span>" : "") + "</td><td>" + d +
          "</td><td>" + _esc(r.title) + "</td><td class='c'><b>" + _esc(r.score) + "</b></td><td class='c'>" + _esc(r.total) +
          "</td><td class='c' style='color:" + col + ";font-weight:700'>" + (p === null ? "—" : p + "%") + "</td></tr>";
      }).join("") + "</tbody></table>"
      : "<div class='muted' style='padding:16px'>No test marks yet.</div>";
    return sec("report", "Report card", scores.length ? scores.length + " test" + (scores.length === 1 ? "" : "s") +
      (avg === null ? "" : " &middot; average <b style='color:var(--accent)'>" + avg + "%</b>") : "", body, "", "pf-full");
  }

  function _detailRow(label, value) {
    return "<div class='profile-detail-row'><div class='profile-detail-label'>" + label + "</div>" +
      "<div class='profile-detail-value'>" + (value ? _esc(value).replace(/^&#8377;|^₹/, "₹") : "—") + "</div></div>";
  }

  function byName(name) {
    // the same name can be in PT once per year: open the one in the year on screen
    var all = Data.get().students, i = all.findIndex(function (s) { return Utils.fullName(s) === name && Utils.inYear(s); });
    if (i < 0) i = all.findIndex(function (s) { return Utils.fullName(s) === name; });
    if (i >= 0) view(i); else Dialog.alert("There is no student called “" + name + "” any more.");
  }

  return { view: view, byName: byName, setFee: setFee, saveFee: saveFee, clearFee: clearFee,
           sec: sec, toggle: toggle, openSec: openSec, edit: edit, editing: editing, editId: editId, cancel: cancel, done: done,
           refresh: refresh, share: share, lockedValue: lockedValue, money: money, yearLabel: yearLabel };
})();
