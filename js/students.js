// ================================================================
//  JS_Students — Students page and modal
//  Owns: render, openModal, save, delete
// ================================================================

var Students = (function () {
  var _editIdx = -1;

  function render() {
    var D    = Data.get();
    var q    = (Utils.el("student-search").value || "").toLowerCase();
    var cf   = Utils.el("student-filter").value;
    var bf   = Utils.el("student-batch-filter").value;
    var sf   = Utils.el("student-status-filter").value;
    var list = Data.allStudents().filter(function (s) {
      return Utils.fullName(s).toLowerCase().includes(q) &&
             (!cf || s.cls === cf) &&
             (!bf || (s.batch || "Regular") === bf) &&
             (!sf || s.status === sf);
    });

    var tbody = Utils.el("students-tbody");
    var empty = Utils.el("students-empty");

    if (list.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";

    tbody.innerHTML = list.map(function (s) {
      var i   = D.students.indexOf(s);
      var sc  = s.status === "Active" ? "green" : s.status === "Trial" ? "orange" : "red";
      var bc  = (s.batch || "Regular") === "Hourly" ? "orange" : "green";
      return "<tr>" +
        "<td>" + Utils.fullName(s) + "</td>" +
        "<td>" + (s.school || "\u2014") + "</td>" +
        "<td>" + (s.cls    || "\u2014") + "</td>" +
        "<td><span class='badge badge-" + bc + "'>" + (s.batch || "Regular") + "</span></td>" +
        "<td>" + (s.phone  || "\u2014") + "</td>" +
        "<td><span class='badge badge-" + sc + "'>" + s.status + "</span></td>" +
        "<td style='white-space:nowrap'>" +
          "<button class='btn btn-primary'   style='padding:4px 10px;font-size:11px' onclick='Profile.view(" + i + ")'>View</button> " +
          "<button class='btn btn-secondary' style='padding:4px 10px;font-size:11px' onclick='Students.openModal(" + i + ")'>Edit</button> " +
          "<button class='btn btn-danger'    style='padding:4px 10px;font-size:11px' onclick='Students.del(" + i + ")'>Del</button>" +
        "</td></tr>";
    }).join("");
  }

  function openModal(idx) {
    _editIdx = (idx !== undefined) ? idx : -1;
    var s = _editIdx >= 0 ? Data.get().students[_editIdx] : null;
    Utils.el("modal-student-title").textContent = _editIdx >= 0 ? "Edit Student" : "Add Student";
    Utils.el("s-fname").value         = s ? s.fname        : "";
    Utils.el("s-lname").value         = s ? s.lname        : "";
    Utils.el("s-school").value        = s ? (s.school      || "") : "";
    Utils.el("s-parent").value        = s ? (s.parent      || "") : "";
    Utils.el("s-class").value         = s ? (s.cls         || "") : "";
    Utils.el("s-batch").value         = s ? (s.batch       || "Regular") : "Regular";
    Utils.el("s-phone").value         = s ? (s.phone       || "") : "";
    Utils.el("s-student-phone").value = s ? (s.studentPhone|| "") : "";
    Utils.el("s-email").value         = s ? (s.email       || "") : "";
    Utils.el("s-address").value       = s ? (s.address     || "") : "";
    Utils.el("s-country").value       = s ? (s.country     || "") : "";
    Utils.el("s-monthly-fee").value   = s ? (s.monthlyFee  || "") : "";
    Utils.el("s-notes").value         = s ? (s.notes       || "") : "";
    Utils.el("s-status").value        = s ? s.status        : "Active";
    Utils.el("s-start-date").value    = s ? (s.startDate    || "") : "";
    Utils.el("s-end-date").value      = s ? (s.endDate      || "") : "";
    Utils.openModal("modal-student");
  }

  function save() {
    var fname = Utils.el("s-fname").value.trim();
    var lname = Utils.el("s-lname").value.trim();
    if (!fname) { Dialog.alert("Please enter the first name."); return; }

    var student = {
      fname: fname,
      lname: lname,
      school:       Utils.el("s-school").value,
      parent:       Utils.el("s-parent").value,
      cls:          Utils.el("s-class").value,
      batch:        Utils.el("s-batch").value,
      phone:        Utils.el("s-phone").value,
      studentPhone: Utils.el("s-student-phone").value,
      email:        Utils.el("s-email").value,
      address:      Utils.el("s-address").value,
      country:      Utils.el("s-country").value,
      monthlyFee:   Utils.el("s-monthly-fee").value,
      notes:        Utils.el("s-notes").value,
      status:       Utils.el("s-status").value,
      startDate:    Utils.el("s-start-date").value,
      endDate:      Utils.el("s-end-date").value
    };

    // Auto-derive status from endDate (mirrors _apply logic in JS_Data):
    //   • Trial is always honoured — set manually, never overridden
    //   • endDate empty           → Active
    //   • endDate today or past   → Inactive
    //   • endDate future          → keep Active
    if (student.status !== "Trial") {
      if (student.endDate) {
        var endDt   = new Date(student.endDate); endDt.setHours(0,0,0,0);
        var todayDt = new Date(); todayDt.setHours(0,0,0,0);
        student.status = (endDt <= todayDt) ? "Inactive" : "Active";
      } else {
        student.status = "Active";
      }
    }

    var D = Data.get();
    if (_editIdx >= 0) {
      D.students[_editIdx] = student;
      Data.log("Updated student <b>" + fname + " " + lname + "</b>");
    } else {
      D.students.push(student);
      Data.log("Added student <b>" + fname + " " + lname + "</b>");
    }
    Data.save();
    Utils.closeModal("modal-student");
    render();
  }

  function del(i) {
    Dialog.confirm("Delete " + Utils.fullName(Data.get().students[i]) + "? Their earlier attendance and payment records are kept.", {okText:"Delete", danger:true}).then(function (ok) {
      if (!ok) return;
      var D = Data.get();
      var n = Utils.fullName(D.students[i]);
      D.students.splice(i, 1);
      Data.log("Removed student <b>" + n + "</b>");
      Data.save();
      render();
    });
  }

  return { render: render, openModal: openModal, save: save, del: del };
})();
