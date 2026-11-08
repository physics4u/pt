// ================================================================
//  JS_Classes — Classes page and modal
// ================================================================

var Classes = (function () {
  var _editIdx = -1;

  function render() {
    var D     = Data.get();
    var tbody = Utils.el("classes-tbody");
    var empty = Utils.el("classes-empty");

    if (D.classes.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";

    // Count students per class
    var cnt = {};
    Data.allStudents().forEach(function (s) {
      if (s.cls) cnt[s.cls] = (cnt[s.cls] || 0) + 1;
    });

    tbody.innerHTML = D.classes.map(function (c, i) {
      return "<tr><td class='num'>" + (i + 1) + "</td>" +
        "<td>" + c.name + "</td>" +
        "<td>" + c.day  + "</td>" +
        "<td>" + c.start + " \u2013 " + c.end + "</td>" +
        "<td><span class='badge badge-blue'>" + Utils.grade(c.level) + "</span></td>" +
        "<td>" + (c.tutor || "\u2014") + "</td>" +
        "<td><span class='badge badge-green'>" + (cnt[c.name] || 0) + " students</span></td>" +
        "<td>" + (c.room || "\u2014") + "</td>" +
        "<td class='edit-cell'>" + Utils.hoverEdit("Classes.openModal(" + i + ")", "Edit class") + "</td></tr>";
    }).join("");
  }

  function openModal(idx) {
    _editIdx = (idx !== undefined) ? idx : -1;
    Utils.el("modal-class-delete").style.display = _editIdx >= 0 ? "" : "none";
    var c = _editIdx >= 0 ? Data.get().classes[_editIdx] : null;
    Utils.el("modal-class-title").textContent = _editIdx >= 0 ? "Edit Class" : "Add Class";
    Utils.el("c-name").value  = c ? c.name  : "";
    Utils.el("c-day").value   = c ? c.day   : "Monday";
    Utils.el("c-level").value = c ? c.level : "Grade XI";
    Utils.el("c-start").value = c ? c.start : "14:00";
    Utils.el("c-end").value   = c ? c.end   : "16:00";
    Utils.el("c-tutor").value = c ? (c.tutor || "") : "";
    Utils.el("c-room").value  = c ? (c.room  || "") : "";
    Utils.el("c-fee").value   = c ? (c.fee   || "") : "";
    Utils.openModal("modal-class");
  }

  function save() {
    var name = Utils.el("c-name").value.trim();
    if (!name) { Dialog.alert("Please enter a class name."); return; }

    var cls = {
      name:  name,
      day:   Utils.el("c-day").value,
      level: Utils.el("c-level").value,
      start: Utils.el("c-start").value,
      end:   Utils.el("c-end").value,
      tutor: Utils.el("c-tutor").value,
      room:  Utils.el("c-room").value,
      fee:   Utils.el("c-fee").value
    };

    var D = Data.get();
    if (_editIdx >= 0) {
      D.classes[_editIdx] = cls;
      Data.log("Updated class <b>" + name + "</b>");
    } else {
      D.classes.push(cls);
      Data.log("Added class <b>" + name + "</b>");
    }
    Data.save();
    Utils.closeModal("modal-class");
    render();
  }

  function del(i, done) {
    Dialog.confirm("Delete the class \u201c" + Data.get().classes[i].name + "\u201d?", {okText:"Delete", danger:true}).then(function (ok) {
      if (!ok) return;
      var D = Data.get();
      var n = D.classes[i].name;
      D.classes.splice(i, 1);
      Data.log("Removed class <b>" + n + "</b>");
      Data.save();
      render();
      if (done) done();
    });
  }

  function delCurrent() {
    if (_editIdx < 0) return;
    del(_editIdx, function () { Utils.closeModal("modal-class"); });
  }

  return { render: render, openModal: openModal, save: save, del: del, delCurrent: delCurrent };
})();
