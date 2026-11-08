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
    var nowDate = new Date(); nowDate.setHours(0,0,0,0);
    Utils.el("stat-students").textContent = D.students.filter(function (s) {
      if (s.status !== "Active") return false;
      if (s.endDate) {
        var end = new Date(s.endDate); end.setHours(0,0,0,0);
        if (end < nowDate) return false;
      }
      return true;
    }).length;
    Utils.el("stat-classes").textContent  = D.classes.length;

    var rev = 0, pending = 0;
    if (D.paygrid) {
      Object.values(D.paygrid).forEach(function (month) {
        Object.values(month).forEach(function (r) {
          if (r.status === "Paid")    rev += Number(r.amount) || 0;
          if (r.status === "Pending" || r.status === "Overdue") pending++;
        });
      });
    }
    Utils.el("stat-revenue").textContent = "\u20b9" + rev.toLocaleString("en-IN");
    Utils.el("stat-pending").textContent = pending;

    // ---- Grade hours & days tiles ----
    _renderGradeStats(D, "Grade XI",  "stat-xi-hours",  "stat-xi-days");
    _renderGradeStats(D, "Grade XII", "stat-xii-hours", "stat-xii-days");

    // ---- Charts ----
    _renderRevenueChart(D);
    _renderSyllabusChart(D, "Grade XI",  "syllabus-chart-xi",  "syllabus-empty-xi",  "syl-total-xi");
    _renderSyllabusChart(D, "Grade XII", "syllabus-chart-xii", "syllabus-empty-xii", "syl-total-xii");

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
        if (sk.split("|")[0] !== grade) return;
        var monthData = D.syllabus[sk];
        Object.keys(monthData).forEach(function (day) {
          var entry = monthData[day];
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
  // Read a colour from the current theme (so charts follow light/dark).
  function _css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // 17.5 hours → "17:30" (same style as the tuition sheet)
  function _hm(h) {
    var m = Math.round(h * 60);
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  }

  // 2500 → "2.5", 12000 → "12"
  function _k(v) { var k = v / 1000; return k < 10 && k % 1 ? k.toFixed(1) : k.toFixed(0); }

  function _renderRevenueChart(D) {
    var canvas  = Utils.el("revenue-chart");
    var empty   = Utils.el("chart-empty");
    var totalEl = Utils.el("chart-total");
    if (!canvas) return;

    var monthlyRev = {};
    ACYR.forEach(function (ym) { monthlyRev[ym] = 0; });

    if (D.paygrid) {
      Object.keys(D.paygrid).forEach(function (sk) {
        var parts = sk.split("|"), ym = parts[2];
        if (!ym || !monthlyRev.hasOwnProperty(ym)) return;
        Object.values(D.paygrid[sk]).forEach(function (r) {
          if (r.status === "Paid") monthlyRev[ym] += Number(r.amount) || 0;
        });
      });
    }

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
    var W = canvas.parentElement.clientWidth - 48, H = 190;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);

    var COL_BAR = _css("--income"), COL_HOV = _css("--income"), COL_GRID = _css("--border");
    var COL_TEXT = _css("--text3"), COL_LABEL = _css("--text2"), COL_VALUE = _css("--text");
    // Taller bottom padding: two-line X labels (month + year separator)
    var PAD_L = 64, PAD_R = 16, PAD_T = 18, PAD_B = 40;
    var chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;

    var maxVal = Math.max.apply(null, values) || 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    var niceMax = Math.ceil(maxVal / magnitude) * magnitude;
    var yTicks = 5, yStep = niceMax / yTicks;

    ctx.clearRect(0, 0, W, H);

    for (var t = 0; t <= yTicks; t++) {
      var yVal = yStep * t;
      var yPx  = PAD_T + chartH - (yVal / niceMax) * chartH;
      ctx.strokeStyle = COL_GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD_L, yPx); ctx.lineTo(PAD_L + chartW, yPx); ctx.stroke();
      ctx.fillStyle = COL_TEXT; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.font = "11px 'Segoe UI', Roboto, Arial, sans-serif";
      var lbl = yVal >= 100000 ? "\u20b9" + (yVal/100000).toFixed(1) + "L"
              : yVal >= 1000   ? "\u20b9" + _k(yVal) + "k" : "\u20b9" + yVal;
      ctx.fillText(lbl, PAD_L - 8, yPx);
    }

    var n = labels.length;
    var barGap = Math.max(4, Math.floor(chartW / n * 0.18));
    var barW   = Math.floor((chartW / n) - barGap);
    var maxIdx = values.indexOf(Math.max.apply(null, values));

    labels.forEach(function (ym, idx) {
      var val = values[idx], barH = (val / niceMax) * chartH;
      var x = PAD_L + idx * (chartW / n) + barGap / 2;
      var y = PAD_T + chartH - barH;
      var isMax = idx === maxIdx && val > 0;
      ctx.fillStyle = isMax ? COL_HOV : COL_BAR;
      var r = Math.min(4, barW / 2, barH || 0);
      if (barH > 0) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, y + barH); ctx.lineTo(x, y + barH);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = COL_GRID; ctx.fillRect(x, PAD_T + chartH - 2, barW, 2);
      }
      if (val > 0) {
        ctx.fillStyle = COL_VALUE;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.font = "bold 11px 'Segoe UI', Roboto, Arial, sans-serif";
        var vlbl = "\u20b9" + val.toLocaleString("en-IN");
        ctx.fillText(vlbl, x + barW / 2, y - 3);
      }
      // X-axis: month abbreviation on first row, year on second row at Jan boundaries
      var p = ym.split("-");
      var mo = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(p[1]) - 1];
      var yr = p[0].slice(2);
      var cx = x + barW / 2;
      var yBase = PAD_T + chartH + 6;
      ctx.fillStyle = COL_LABEL; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = "10px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(mo, cx, yBase);
      // Draw year label below the month row at Jan of each year and at first bar
      if (p[1] === "01" || idx === 0) {
        ctx.fillStyle = COL_TEXT;
        ctx.font = "bold 10px 'Segoe UI', Roboto, Arial, sans-serif";
        ctx.fillText("'" + yr, cx, yBase + 14);
      }
    });
    ctx.strokeStyle = COL_GRID; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T + chartH); ctx.lineTo(PAD_L + chartW, PAD_T + chartH); ctx.stroke();
  }

  // ----------------------------------------------------------------
  //  Syllabus horizontal bar chart — one grade at a time
  //  grade    : "Grade XI" or "Grade XII"
  //  canvasId : element id of the <canvas>
  //  emptyId  : element id of the empty-state <div>
  //  totalId  : element id of the total hours <span>
  // ----------------------------------------------------------------
  function _renderSyllabusChart(D, grade, canvasId, emptyId, totalId) {
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
      if (ch === "Revision / Practice") {
        SHORT_LABELS[ch] = "00 Revision / Practice";
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
        if (skGrade !== grade) return;
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

    if (activeKeys.length === 0) {
      canvas.style.display = "none"; empty.style.display = ""; totalEl.textContent = ""; return;
    }
    canvas.style.display = ""; empty.style.display = "none";
    totalEl.textContent = "Total: " + _hm(totalHrs);

    // ---- Drawing ----
    var dpr    = window.devicePixelRatio || 1;
    var ROW_H  = 24;
    var PAD_L  = 176;   // space for chapter labels
    var PAD_R  = 52;    // space for value labels
    var PAD_T  = 12;
    var PAD_B  = 32;
    var n      = activeKeys.length;
    var W      = canvas.parentElement.clientWidth - 40;
    var H      = PAD_T + n * ROW_H + PAD_B;

    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    var COL_GRID  = _css("--border");
    var COL_TEXT  = _css("--text3");
    var COL_LABEL = _css("--text2");
    var COL_VALUE = _css("--text");
    // Same colours as the tuition sheet: Plus 1 red, Plus 2 orange.
    var GRADE_COL = (grade === "Grade XI") ? _css("--plus1") : _css("--plus2");
    var COL_REV   = GRADE_COL;


    var chartW = W - PAD_L - PAD_R;
    var maxHrs = Math.max.apply(null, activeKeys.map(function (k) { return hoursMap[k]; })) || 1;
    var niceMax = Math.ceil(maxHrs / 0.5) * 0.5;
    if (niceMax === 0) niceMax = 1;

    // X-axis grid + labels
    var xTicks = 4;
    var xStep  = niceMax / xTicks;
    for (var t = 0; t <= xTicks; t++) {
      var xVal = xStep * t;
      var xPx  = PAD_L + (xVal / niceMax) * chartW;
      ctx.strokeStyle = COL_GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xPx, PAD_T); ctx.lineTo(xPx, PAD_T + n * ROW_H); ctx.stroke();
      ctx.fillStyle = COL_TEXT; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = "10px 'Segoe UI', Roboto, Arial, sans-serif";
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
      var barH = ROW_H * 0.55;
      var y    = PAD_T + idx * ROW_H + (ROW_H - barH) / 2;
      var barW = (hrs / niceMax) * chartW;
      var isRev = chapter === "Revision / Practice";
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
      ctx.font = "11px Arial, sans-serif";
      ctx.fillText(shortLabel, PAD_L - 10, y + barH / 2);

      // Hours value
      ctx.fillStyle = COL_VALUE; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = "11px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.font = "600 12px 'Segoe UI', Roboto, Arial, sans-serif";
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
    // Update toggle UI
    var track  = Utils.el("toggle-track");
    var icon   = Utils.el("theme-icon");
    var label  = Utils.el("theme-label");
    if (track)  track.className  = "toggle-track" + (theme === "light" ? " on" : "");
    if (icon)   icon.textContent  = theme === "light" ? "☀" : "☽"; // ☀ / ☽
    if (label)  label.textContent = theme === "light" ? "Dark Mode" : "Light Mode";
    if (save) {
      try { localStorage.setItem("physicshub_theme", theme); } catch (e) {}
      if (currentPage === "dashboard") Dashboard.render();   // redraw charts in new colours
    }
  }

  return { init: init, toggle: toggle };
})();

// ================================================================
//  BOOTSTRAP
// ================================================================
(function init() {
  Utils.el("today-date").textContent = new Date().toLocaleDateString("en-GB", {
    weekday:"short", day:"2-digit", month:"short", year:"numeric"
  });

  document.querySelectorAll(".modal-overlay:not(.login-overlay)").forEach(function (m) {
    m.addEventListener("click", function (e) {
      if (e.target === m) m.classList.remove("open");
    });
  });

  window.addEventListener("resize", function () {
    if (document.getElementById("page-dashboard").classList.contains("active")) {
      Dashboard.render();
    }
  });

  Theme.init();
  Data.init();
})();
