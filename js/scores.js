// ================================================================
//  JS_Scores — Scores & Grades page and modal
// ================================================================

var Scores = (function () {
  var _editIdx = -1;

  function render() {
    var D   = Data.get();
    var q   = (Utils.el("score-search").value || "").toLowerCase();
    var cf  = Utils.el("score-class-filter").value;
    var tf  = Utils.el("score-type-filter").value;

    var list = D.scores.filter(function (sc) {
      return (Utils.fullName({fname: sc.student.split(" ")[0] || "", lname: ""}) || sc.student || "").toLowerCase().includes(q) ||
             (sc.title || "").toLowerCase().includes(q) ||
             (sc.student || "").toLowerCase().includes(q);
    }).filter(function (sc) {
      return (!cf || sc.cls === cf) && (!tf || sc.type === tf);
    }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

    var container = Utils.el("scores-list");

    if (list.length === 0) {
      container.innerHTML = "<div class='empty'><div class='empty-icon'>&#128221;</div><div class='empty-text'>No scores yet. Click \"+ Add Score\" to get started.</div></div>";
      return;
    }

    container.innerHTML = list.map(function (sc) {
      var i   = D.scores.indexOf(sc);
      var pct = Math.round(sc.score / sc.total * 100);
      var col = pct >= 75 ? "var(--accent3)" : pct >= 50 ? "var(--accent2)" : "var(--danger)";
      var bg  = pct >= 75 ? "rgba(91,248,184,0.1)" : pct >= 50 ? "rgba(248,160,91,0.1)" : "rgba(248,91,110,0.1)";
      var tc  = sc.type === "Exam" ? "badge-red" : sc.type === "Test" ? "badge-orange" : sc.type === "Quiz" ? "badge-blue" : "badge-green";
      return "<div class='report-card'>" +
        "<div class='report-card-header'>" +
          "<div style='flex:1'>" +
            "<div style='display:flex;align-items:center;gap:8px;margin-bottom:4px'>" +
              "<span class='report-card-title'>" + sc.title + "</span>" +
              "<span class='badge " + tc + "'>" + sc.type + "</span>" +
            "</div>" +
            "<div style='font-size:12px;color:var(--text3)'>" + sc.student + " &bull; " + Utils.grade(sc.cls) + " &bull; " + sc.date + "</div>" +
            (sc.remarks ? "<div style='font-size:12px;color:var(--text2);margin-top:4px'>" + sc.remarks + "</div>" : "") +
          "</div>" +
          "<div style='display:flex;align-items:center;gap:12px'>" +
            "<div>" +
              "<div style='min-width:140px'><div class='progress-bar' style='height:6px'><div class='progress-fill' style='width:" + pct + "%;background:" + col + "'></div></div></div>" +
              "<div style='text-align:right;font-size:11px;color:" + col + ";margin-top:2px'>" + sc.score + "/" + sc.total + "</div>" +
            "</div>" +
            "<div class='score-circle' style='color:" + col + ";border-color:" + col + ";background:" + bg + "'>" + pct + "%</div>" +
            "<div style='display:flex;gap:4px'>" +
              "<button class='btn btn-secondary' style='padding:4px 10px;font-size:11px' onclick='Scores.openModal(" + i + ")'>Edit</button>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";
    }).join("");
  }

  function openModal(idx) {
    _editIdx = (idx !== undefined) ? idx : -1;
    Utils.el("modal-score-delete").style.display = _editIdx >= 0 ? "" : "none";
    var sc = _editIdx >= 0 ? Data.get().scores[_editIdx] : null;
    Utils.el("modal-score-title").textContent = _editIdx >= 0 ? "Edit Score" : "Add Score";

    // Populate student dropdown
    var sel = Utils.el("sc-student");
    sel.innerHTML = "<option value=''>Select student...</option>";
    Data.allStudents().forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = Utils.fullName(s); opt.textContent = Utils.fullName(s);
      if (sc && sc.student === opt.value) opt.selected = true;
      sel.appendChild(opt);
    });

    Utils.el("sc-type").value   = sc ? (sc.type  || "Test") : "Test";
    Utils.el("sc-date").value   = sc ? sc.date  : new Date().toISOString().slice(0, 10);
    Utils.el("sc-title").value  = sc ? sc.title : "";
    Utils.el("sc-score").value  = sc ? sc.score : "";
    Utils.el("sc-total").value  = sc ? sc.total : "100";
    Utils.el("sc-remarks").value = sc ? (sc.remarks || "") : "";
    Utils.openModal("modal-score");
  }

  function save() {
    var student = Utils.el("sc-student").value;
    if (!student) { Dialog.alert("Please select a student."); return; }
    var score = {
      student: student,
      cls:     (Data.allStudents().find(function (s) { return Utils.fullName(s) === student; }) || {}).cls || "",
      type:    Utils.el("sc-type").value,
      date:    Utils.el("sc-date").value,
      title:   Utils.el("sc-title").value,
      score:   Number(Utils.el("sc-score").value) || 0,
      total:   Number(Utils.el("sc-total").value) || 100,
      remarks: Utils.el("sc-remarks").value
    };
    var D = Data.get();
    if (_editIdx >= 0) {
      D.scores[_editIdx] = score;
      Data.log("Updated score for <b>" + student + "</b>");
    } else {
      D.scores.push(score);
      var pct = Math.round(score.score / score.total * 100);
      Data.log("Added " + score.type + " for <b>" + student + "</b> \u2014 " + pct + "%");
    }
    Data.save();
    Utils.closeModal("modal-score");
    render();
  }

  function del(i, done) {
    Dialog.confirm("Delete this score?", {okText:"Delete", danger:true}).then(function (ok) {
      if (!ok) return;
      var D = Data.get();
      D.scores.splice(i, 1);
      Data.save();
      render();
      if (done) done();
    });
  }

  function delCurrent() {
    if (_editIdx < 0) return;
    del(_editIdx, function () { Utils.closeModal("modal-score"); });
  }

  return { render: render, openModal: openModal, save: save, del: del, delCurrent: delCurrent };
})();
