// ================================================================
//  JS_App — Dashboard, Setup, and application bootstrap (init)
//  This file runs last, after all modules are defined.
// ================================================================

// ----------------------------------------------------------------
//  Dashboard
// ----------------------------------------------------------------
var Dashboard = (function () {

  function render() {
    var D = Data.get();

    // ---- Stat cards ----
    var active = D.students.filter(Utils.isActive);
    // count people, not records (someone can have a group and an hourly record)
    var cnt = function (f) { var m = {}; active.filter(f).forEach(function (s) { m[Utils.fullName(s)] = 1; }); return Object.keys(m).length; };
    var hr = Hourly.hourlyIn, p1 = function (s) { return Utils.clsOf(s) === "Grade XI"; }, p2 = function (s) { return Utils.clsOf(s) === "Grade XII"; };
    var split = function (f) { return cnt(function (s) { return f(s) && !hr(s); }) + " regular \u00b7 " + cnt(function (s) { return f(s) && hr(s); }) + " hourly"; };
    Utils.el("stat-students").textContent = active.length;
    Utils.el("stat-students-sub").textContent = split(function () { return true; });
    Utils.el("stat-p1").textContent = cnt(p1);
    Utils.el("stat-p1-sub").textContent = split(p1);
    Utils.el("stat-p2").textContent = cnt(p2);
    Utils.el("stat-p2-sub").textContent = split(p2);
    Utils.el("stat-hr").textContent = cnt(hr);
    Utils.el("stat-p1-mini").textContent = cnt(p1);
    Utils.el("stat-p2-mini").textContent = cnt(p2);
    Utils.el("stat-hr-sub").textContent = "Plus 1: " + cnt(function (s) { return hr(s) && p1(s); }) + " \u00b7 Plus 2: " + cnt(function (s) { return hr(s) && p2(s); });

    // Group fees (this academic year) + hourly payments
    var rev = 0, owed = 0, owedCount = 0;
    var byName = {};
    D.students.forEach(function (s) { byName[Utils.fullName(s)] = s; });
    // fees of this year's students only (March/April are shared with the next year)
    var rc = Utils.rosterCls(), feeMonths = acadEntryMonths();
    Object.keys(D.paygrid || {}).forEach(function (sk) {
      if (feeMonths.indexOf(sk.split("|")[2]) < 0) return;
      Object.keys(D.paygrid[sk]).forEach(function (nm) {
        var mo = sk.split("|")[2].slice(5);           // March/April are shared by two years:
        if ((mo === "03" || mo === "04") && rc[nm] !== sk.split("|")[1]) return;   // count this year's students only
        var r = D.paygrid[sk][nm];
        if (r.status === "Paid") rev += Number(r.amount) || 0;
        if (r.status === "Pending" || r.status === "Overdue") {
          owed += Number(r.amount) || Number((byName[nm] || {}).monthlyFee) || 0; owedCount++;
        }
      });
    });
    var H = Hourly.totals();
    rev += H.paid; owed += H.balance;
    Utils.el("stat-revenue").textContent = "\u20b9" + rev.toLocaleString("en-IN");
    Utils.el("stat-pending").textContent = "\u20b9" + Math.round(owed).toLocaleString("en-IN");
    Utils.el("stat-pending-sub").textContent = owed > 0 ? "" : "all paid";
    Utils.el("stat-hourly").textContent = Hourly.hm(H.hours);

    // ---- Grade hours & days tiles ----
    _renderGradeStats(D, "Grade XI",  "stat-xi-hours",  "stat-xi-days");
    _renderGradeStats(D, "Grade XII", "stat-xii-hours", "stat-xii-days");

    // ---- Charts ----
    // Size the charts to fill the screen: teaching hours ~60%, income ~40%
    // of the height left below the tiles (within sensible limits).
    var grid = document.querySelector("#page-dashboard .grid2");
    var foot = document.querySelector(".app-footer");
    var avail = window.innerHeight - (grid ? grid.getBoundingClientRect().top + window.scrollY : 300) -
                (foot ? foot.offsetHeight : 40) - 8 - 10 - 26;
    var PANEL = 46;                                   // panel heading + padding
    var teachH = Math.max(220, Math.round(avail * 0.6) - PANEL);
    var incomeH = Math.max(170, Math.min(340, avail - (teachH + PANEL) - PANEL));
    var n1 = _renderSyllabusChart(D, "Grade XI",  "syllabus-chart-xi",  "syllabus-empty-xi",  "syl-total-xi", 0, true);
    var n2 = _renderSyllabusChart(D, "Grade XII", "syllabus-chart-xii", "syllabus-empty-xii", "syl-total-xii", 0, true);
    var rowH = Math.max(19, Math.min(32, Math.floor((teachH - 30) / Math.max(n1, n2, 1))));
    _renderSyllabusChart(D, "Grade XI",  "syllabus-chart-xi",  "syllabus-empty-xi",  "syl-total-xi", rowH);
    _renderSyllabusChart(D, "Grade XII", "syllabus-chart-xii", "syllabus-empty-xii", "syl-total-xii", rowH);
    // income takes whatever height the teaching charts left
    incomeH = Math.max(170, Math.min(340, avail - (Math.max(n1, n2, 1) * rowH + 30) - 2 * PANEL));
    _renderRevenueChart(D, incomeH);

  }

  // ----------------------------------------------------------------
  //  Helper: parse "02:00 PM" or "14:00" → decimal hours
  // ----------------------------------------------------------------
  function _parseTime(t) {
    if (!t || t === "--") return null;
    var m24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1], 10) + parseInt(m24[2], 10) / 60;
    var m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m12) return null;
    var h = parseInt(m12[1], 10), mn = parseInt(m12[2], 10);
    var period = m12[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h + mn / 60;
  }

  // ----------------------------------------------------------------
  //  Grade stats — total hours and days from syllabus
  // ----------------------------------------------------------------
  function _renderGradeStats(D, grade, hoursId, daysId) {
    var totalHrs  = 0;
    var totalDays = 0;

    if (D.syllabus) {
      Object.keys(D.syllabus).forEach(function (sk) {
        if (sk.split("|")[0] !== grade || ACYR.indexOf(sk.split("|")[1]) < 0) return;
        var monthData = D.syllabus[sk];
        Object.keys(monthData).forEach(function (day) {
          var entry = monthData[day];
          if (!entry.chapter) return;          // a class day needs a chapter (as in the charts)
          var start = _parseTime(entry.start);
          var end   = _parseTime(entry.end);
          if (start === null || end === null) return;
          var hrs = end - start;
          if (hrs > 0) {
            totalHrs  += hrs;
            totalDays += 1;
          }
        });
      });
    }

    var hEl = Utils.el(hoursId);
    var dEl = Utils.el(daysId);
    if (hEl) hEl.textContent = _hm(totalHrs);
    if (dEl) dEl.textContent = totalDays;
  }

  // ----------------------------------------------------------------
  //  Revenue bar chart (vertical)
  // ----------------------------------------------------------------
  function _chartFont() {
    return document.documentElement.classList.contains("font-courier") ? "'Courier New', Courier, monospace" : "'Segoe UI', Roboto, Arial, sans-serif";
  }

  // Read a colour from the current theme (so charts follow light/dark).
  function _css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // 17.5 hours → "17:30"
  function _hm(h) {
    var m = Math.round(h * 60);
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  }

  // 2500 → "2.5", 12000 → "12"
  function _k(v) { var k = v / 1000; return k < 10 && k % 1 ? k.toFixed(1) : k.toFixed(0); }

  function _renderRevenueChart(D, height) {
    var canvas  = Utils.el("revenue-chart");
    var empty   = Utils.el("chart-empty");
    var totalEl = Utils.el("chart-total");
    if (!canvas) return;

    var monthlyRev = {};
    ACYR.forEach(function (ym) { monthlyRev[ym] = 0; });

    // This year's students' fees; an earlier year's own March/April entries (after
    // February) are added to February so the total matches the year's records.
    var rc = Utils.rosterCls(), lastYm = ACYR[ACYR.length - 1];
    if (D.paygrid) {
      Object.keys(D.paygrid).forEach(function (sk) {
        var ym = sk.split("|")[2];
        if (acadEntryMonths().indexOf(ym) < 0) return;
        var bucket = monthlyRev.hasOwnProperty(ym) ? ym : lastYm;
        Object.keys(D.paygrid[sk]).forEach(function (nm) {
          var r = D.paygrid[sk][nm];
          var mo = ym.slice(5), mine = !(mo === "03" || mo === "04") || rc[nm] === sk.split("|")[1];
          if (mine && r.status === "Paid") monthlyRev[bucket] += Number(r.amount) || 0;
        });
      });
    }
    // Hourly payments count in the month they pay for
    var hi = Hourly.totals().income;
    Object.keys(hi).forEach(function (ym) { if (monthlyRev.hasOwnProperty(ym)) monthlyRev[ym] += hi[ym]; });

    // Show full academic year March 2026 → April 2027
    var labels = ACYR.slice();
    var values = labels.map(function (ym) { return monthlyRev[ym]; });
    var total  = values.reduce(function (s, v) { return s + v; }, 0);
    var hasData = values.some(function (v) { return v > 0; });

    if (!hasData) {
      canvas.style.display = "none"; empty.style.display = ""; totalEl.textContent = ""; return;
    }
    canvas.style.display = ""; empty.style.display = "none";
    totalEl.textContent = "Total: \u20b9" + total.toLocaleString("en-IN");

    var dpr = window.devicePixelRatio || 1;
    var W = canvas.parentElement.clientWidth - 32, H = height || 160;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);

    var BASE = _rgb(_css("--income")), COL_GRID = _css("--border");
    var COL_TEXT = _css("--text3"), COL_LABEL = _css("--text2"), COL_VALUE = _css("--text");
    var PAD_L = 56, PAD_R = 22, PAD_T = 20, PAD_B = 32;
    var chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;
    var n = labels.length, slot = chartW / n;
    var barGap = Math.max(6, Math.floor(slot * 0.26));
    var barW   = Math.max(6, Math.floor(slot - barGap));
    // 3D: each bar has a top and a right side, drawn up and to the right
    var DX = Math.max(4, Math.min(10, Math.round(barW * 0.22))), DY = Math.round(DX * 0.7);

    var maxVal = Math.max.apply(null, values) || 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    var niceMax = Math.ceil(maxVal / magnitude) * magnitude;
    var yTicks = 4, yStep = niceMax / yTicks;

    ctx.clearRect(0, 0, W, H);
    var floorY = PAD_T + chartH;

    // Back wall grid (shifted by the depth) and the floor
    for (var t = 0; t <= yTicks; t++) {
      var yVal = yStep * t;
      var yPx  = floorY - (yVal / niceMax) * chartH;
      ctx.strokeStyle = COL_GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD_L, yPx); ctx.lineTo(PAD_L + DX, yPx - DY); ctx.lineTo(PAD_L + chartW + DX, yPx - DY); ctx.stroke();
      ctx.fillStyle = COL_TEXT; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.font = "12px " + _chartFont();
      var lbl = yVal >= 100000 ? "₹" + (yVal / 100000).toFixed(1) + "L"
              : yVal >= 1000   ? "₹" + _k(yVal) + "k" : "₹" + yVal;
      ctx.fillText(lbl, PAD_L - 6, yPx);
    }
    ctx.fillStyle = "rgba(" + BASE.join(",") + ",0.08)";
    ctx.beginPath(); ctx.moveTo(PAD_L, floorY); ctx.lineTo(PAD_L + DX, floorY - DY);
    ctx.lineTo(PAD_L + chartW + DX, floorY - DY); ctx.lineTo(PAD_L + chartW, floorY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COL_GRID; ctx.beginPath(); ctx.moveTo(PAD_L, floorY); ctx.lineTo(PAD_L + chartW, floorY); ctx.stroke();

    var front = _shade(BASE, 0), top = _shade(BASE, 0.35), side = _shade(BASE, -0.35);
    labels.forEach(function (ym, idx) {
      var val = values[idx], barH = (val / niceMax) * chartH;
      var x = PAD_L + idx * slot + barGap / 2 - DX / 2;
      var y = floorY - barH;
      if (barH > 0) {
        // front face with a soft vertical gradient
        var g = ctx.createLinearGradient(0, y, 0, floorY);
        g.addColorStop(0, _shade(BASE, 0.12)); g.addColorStop(1, _shade(BASE, -0.12));
        ctx.fillStyle = g; ctx.fillRect(x, y, barW, barH);
        // right side
        ctx.fillStyle = side;
        ctx.beginPath(); ctx.moveTo(x + barW, y); ctx.lineTo(x + barW + DX, y - DY);
        ctx.lineTo(x + barW + DX, floorY - DY); ctx.lineTo(x + barW, floorY); ctx.closePath(); ctx.fill();
        // top
        ctx.fillStyle = top;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + DX, y - DY);
        ctx.lineTo(x + barW + DX, y - DY); ctx.lineTo(x + barW, y); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = COL_GRID; ctx.fillRect(x, floorY - 2, barW, 2);
      }
      if (val > 0) {
        ctx.fillStyle = COL_VALUE; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        var vlbl = val >= 100000 ? "₹" + (val / 100000).toFixed(2) + "L" : "₹" + val.toLocaleString("en-IN");
        ctx.font = "bold 11.5px " + _chartFont();
        if (ctx.measureText(vlbl).width > slot + 6) vlbl = val >= 1000 ? "₹" + _k(val) + "k" : vlbl;
        ctx.fillText(vlbl, x + (barW + DX) / 2, y - DY - 2);
      }
      var p = ym.split("-");
      var mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(p[1]) - 1];
      var cx = x + barW / 2;
      ctx.fillStyle = COL_LABEL; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = "12px " + _chartFont();
      ctx.fillText(mo, cx, floorY + 5);
      if (p[1] === "01" || idx === 0) {
        ctx.fillStyle = COL_TEXT; ctx.font = "bold 11px " + _chartFont();
        ctx.fillText("'" + p[0].slice(2), cx, floorY + 18);
      }
    });
  }

  // "#34a853" or "rgb(52,168,83)" → [52,168,83]
  function _rgb(c) {
    c = String(c || "").trim();
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var v = parseInt(m[1], 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
    m = /(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);
    return m ? [+m[1], +m[2], +m[3]] : [52, 168, 83];
  }
  // Lighter (f > 0) or darker (f < 0) version of a colour
  function _shade(rgb, f) {
    return "rgb(" + rgb.map(function (v) {
      return Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f));
    }).join(",") + ")";
  }

  // ----------------------------------------------------------------
  //  Syllabus horizontal bar chart — one grade at a time
  //  grade    : "Grade XI" or "Grade XII"
  //  canvasId : element id of the <canvas>
  //  emptyId  : element id of the empty-state <div>
  //  totalId  : element id of the total hours <span>
  // ----------------------------------------------------------------
  function _renderSyllabusChart(D, grade, canvasId, emptyId, totalId, rowH, countOnly) {
    var canvas  = Utils.el(canvasId);
    var empty   = Utils.el(emptyId);
    var totalEl = Utils.el(totalId);
    if (!canvas) return;

    // Get chapter list from Settings (editable by admin, grade-specific)
    // Exclude the "-- None --" placeholder at index 0
    var allChapters = Settings.chapters(grade).slice(1);
    // Teaching chapters = all except Test/Exam and Holiday/No Class
    var SKIP = ["Test / Exam", "Holiday / No Class"];
    var CHAPTER_KEYS = allChapters.filter(function(ch) { return SKIP.indexOf(ch) === -1; });

    // Auto-generate short labels: prefix with chapter number
    var SHORT_LABELS = {};
    var labelNum = 1;
    CHAPTER_KEYS.forEach(function (ch) {
      if (/^Revision/.test(ch)) {
        SHORT_LABELS[ch] = "00 " + ch;
      } else {
        SHORT_LABELS[ch] = String(labelNum < 10 ? "0" + labelNum : labelNum) + " " + ch;
        labelNum++;
      }
    });

    // Accumulate hours for this grade only
    var hoursMap = {};
    CHAPTER_KEYS.forEach(function (k) { hoursMap[k] = 0; });

    if (D.syllabus) {
      Object.keys(D.syllabus).forEach(function (sk) {
        var skGrade = sk.split("|")[0];
        if (skGrade !== grade || ACYR.indexOf(sk.split("|")[1]) < 0) return;
        var monthData = D.syllabus[sk];
        Object.keys(monthData).forEach(function (day) {
          var entry   = monthData[day];
          var chapter = entry.chapter || "";
          if (!hoursMap.hasOwnProperty(chapter)) return;
          var start = _parseTime(entry.start);
          var end   = _parseTime(entry.end);
          if (start === null || end === null) return;
          var hrs = end - start;
          if (hrs > 0) hoursMap[chapter] += hrs;
        });
      });
    }

    // Only show chapters that have hours, keep original order
    var activeKeys = CHAPTER_KEYS.filter(function (k) { return hoursMap[k] > 0; });
    var totalHrs   = CHAPTER_KEYS.reduce(function (s, k) { return s + hoursMap[k]; }, 0);

    if (countOnly) return activeKeys.length;
    if (activeKeys.length === 0) {
      canvas.style.display = "none"; empty.style.display = ""; totalEl.textContent = ""; return 0;
    }
    canvas.style.display = ""; empty.style.display = "none";
    totalEl.textContent = "Total: " + _hm(totalHrs);

    // ---- Drawing ----
    var dpr    = window.devicePixelRatio || 1;
    var ROW_H  = rowH || 19;
    var PAD_L  = 210;   // space for chapter labels
    var PAD_R  = 52;    // space for value labels
    var PAD_T  = 6;
    var PAD_B  = 24;
    var n      = activeKeys.length;
    var W      = canvas.parentElement.clientWidth - 24;
    var H      = PAD_T + n * ROW_H + PAD_B;

    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Make room for the longest chapter label (up to 45% of the width).
    ctx.font = "13px " + _chartFont();
    var widest = 0;
    activeKeys.forEach(function (k) { widest = Math.max(widest, ctx.measureText(SHORT_LABELS[k] || k).width); });
    PAD_L = Math.min(Math.ceil(widest) + 18, Math.floor(W * 0.55));

    var COL_GRID  = _css("--border");
    var COL_TEXT  = _css("--text3");
    var COL_LABEL = _css("--text2");
    var COL_VALUE = _css("--text");
    // Plus 1 red, Plus 2 orange.
    var GRADE_COL = (grade === "Grade XI") ? _css("--plus1") : _css("--plus2");
    var COL_REV   = GRADE_COL;


    var chartW = W - PAD_L - PAD_R;
    var maxHrs = Math.max.apply(null, activeKeys.map(function (k) { return hoursMap[k]; })) || 1;
    // Round the axis up to whole hours that split evenly into 4 steps.
    var niceMax = maxHrs <= 2 ? Math.ceil(maxHrs / 0.5) * 0.5 : Math.ceil(maxHrs / 4) * 4;
    if (niceMax === 0) niceMax = 1;

    // X-axis grid + labels
    var xTicks = chartW < 260 ? 2 : 4;          // fewer labels on a narrow chart
    var xStep  = niceMax / xTicks;
    for (var t = 0; t <= xTicks; t++) {
      var xVal = xStep * t;
      var xPx  = PAD_L + (xVal / niceMax) * chartW;
      ctx.strokeStyle = COL_GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xPx, PAD_T); ctx.lineTo(xPx, PAD_T + n * ROW_H); ctx.stroke();
      ctx.fillStyle = COL_TEXT; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = "12px "+_chartFont()+"";
      ctx.fillText(_hm(xVal), xPx, PAD_T + n * ROW_H + 6);
    }

    // Baseline
    ctx.strokeStyle = COL_GRID; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T + n * ROW_H);
    ctx.lineTo(PAD_L + chartW, PAD_T + n * ROW_H);
    ctx.stroke();

    // Bars + labels
    activeKeys.forEach(function (chapter, idx) {
      var hrs  = hoursMap[chapter];
      var barH = ROW_H * 0.66;
      var y    = PAD_T + idx * ROW_H + (ROW_H - barH) / 2;
      var barW = (hrs / niceMax) * chartW;
      var isRev = /^Revision/.test(chapter);
      ctx.fillStyle = isRev ? COL_REV : GRADE_COL;

      var r = Math.min(4, barH / 2, barW || 0);
      if (barW > 0) {
        ctx.beginPath();
        ctx.moveTo(PAD_L, y + r);
        ctx.quadraticCurveTo(PAD_L, y, PAD_L + r, y);
        ctx.lineTo(PAD_L + barW - r, y);
        ctx.quadraticCurveTo(PAD_L + barW, y, PAD_L + barW, y + r);
        ctx.lineTo(PAD_L + barW, y + barH - r);
        ctx.quadraticCurveTo(PAD_L + barW, y + barH, PAD_L + barW - r, y + barH);
        ctx.lineTo(PAD_L, y + barH);
        ctx.closePath();
        ctx.fill();
      }

      // Chapter label
      var shortLabel = SHORT_LABELS[chapter] || chapter;
      ctx.fillStyle = isRev ? COL_REV : COL_LABEL;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.font = (ROW_H >= 24 ? "14px " : "13px ") + _chartFont();
      // Shorten with "…" if the label still doesn't fit
      var room = PAD_L - 14;
      if (ctx.measureText(shortLabel).width > room) {
        while (shortLabel.length > 4 && ctx.measureText(shortLabel + "\u2026").width > room) shortLabel = shortLabel.slice(0, -1);
        shortLabel = shortLabel.trim() + "\u2026";
      }
      ctx.fillText(shortLabel, PAD_L - 10, y + barH / 2);

      // Hours value
      ctx.fillStyle = COL_VALUE; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = "13px "+_chartFont()+"";
      ctx.font = (ROW_H >= 24 ? "600 14px " : "600 13px ") + _chartFont();
      ctx.fillText(_hm(hrs), PAD_L + barW + 6, y + barH / 2);
    });
  }

  return { render: render };
})();


// Setup module removed — connection is automatic via hardcoded URL in JS_Data


// ================================================================
//  THEME — light / dark toggle, persisted in localStorage
// ================================================================
var Theme = (function () {

  function init() {
    var saved = localStorage.getItem("physicshub_theme") || "dark";
    _apply(saved, false);
  }

  function toggle() {
    var current = document.documentElement.getAttribute("data-theme") || "dark";
    _apply(current === "dark" ? "light" : "dark", true);
  }

  function _apply(theme, save) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    // Settings → Appearance
    var d = Utils.el("theme-dark"), l = Utils.el("theme-light"), m = Utils.el("theme-meta");
    if (d) { d.classList.toggle("on", theme !== "light"); d.setAttribute("aria-checked", theme !== "light"); }
    if (l) { l.classList.toggle("on", theme === "light"); l.setAttribute("aria-checked", theme === "light"); }
    _meta();
    if (save) {
      try { localStorage.setItem("physicshub_theme", theme); } catch (e) {}
      if (currentPage === "dashboard") Dashboard.render();   // redraw charts in new colours
    }
  }

  function set(theme) { _apply(theme === "light" ? "light" : "dark", true); }

  // "· Dark · Modern" in the Appearance header
  function _meta() {
    var el = Utils.el("theme-meta"); if (!el) return;
    var light = document.documentElement.getAttribute("data-theme") === "light";
    var courier = document.documentElement.classList.contains("font-courier");
    el.textContent = "\u00b7 " + (light ? "Light" : "Dark") + " \u00b7 " + (courier ? "Courier New" : "Modern");
  }

  // Font: Modern (default) or Courier New, remembered on this device.
  function _font() { try { return localStorage.getItem("pt_font") || "modern"; } catch (e) { return "modern"; } }
  function setFont(f, quiet) {
    f = f === "courier" ? "courier" : "modern";
    document.documentElement.classList.toggle("font-courier", f === "courier");
    var m = Utils.el("font-modern"), c = Utils.el("font-courier");
    if (m) m.classList.toggle("on", f === "modern");
    if (c) c.classList.toggle("on", f === "courier");
    _meta();
    if (!quiet) {
      try { localStorage.setItem("pt_font", f); } catch (e) {}
      if (currentPage === "dashboard") Dashboard.render();
    }
  }

  return { init: init, toggle: toggle, set: set, setFont: setFont, font: _font };
})();

// ================================================================
//  BOOTSTRAP
// ================================================================
(function init() {
  Utils.el("today-date").textContent = Utils.fmtDate(ptToday().date);

  document.querySelectorAll(".modal-overlay:not(.login-overlay)").forEach(function (m) {
    m.addEventListener("click", function (e) {
      if (e.target === m) m.classList.remove("open");
    });
  });

  var _rz = null;
  window.addEventListener("resize", function () {
    clearTimeout(_rz);
    _rz = setTimeout(function () {
      if (document.getElementById("page-dashboard").classList.contains("active")) Dashboard.render();
    }, 120);
  });

  Utils.el("app-version").textContent = "Version " + PT_VERSION;
  Theme.init();
  Theme.setFont(Theme.font(), true);
  Data.init();
})();
