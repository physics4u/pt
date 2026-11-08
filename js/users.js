// ================================================================
//  users.js — Settings → Users.
//  One table for everyone (including the built-in Owner sign-in).
//  The add/edit form and the password form stay hidden until needed.
//  Users are stored on the PT server; passwords are
//  hashed on the server and never sent back to the browser.
// ================================================================
var Users = (function () {
  var _list = [];
  var _ownerLast = "";

  // "2026-11-08T10:15:00Z" → "08 Nov 2026 15:45" (local time)
  function _when(iso) {
    if (!iso) return "<span style='color:var(--text3)'>never</span>";
    var d = new Date(iso);
    if (isNaN(d)) return _esc(iso);
    return d.toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) + " " +
           d.toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit"});
  }
  var _editing = null;   // username being edited, or null when adding

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function load() {
    var me = Data.me() || {};
    Utils.el("pw-btn").style.display = me.username === "admin" && !_list.some(function (u) { return u.username === "admin"; })
      ? "none" : "";   // the Owner's password is the owner passcode
    if (!Data.isAdmin()) { _list = []; render(); return; }
    Data.api("listUsers").then(function (r) {
      if (!r.ok) {
        Utils.el("users-tbody").innerHTML = "<tr><td colspan='7' style='color:var(--danger)'>" + _esc(r.error) + "</td></tr>";
        return;
      }
      _list = r.users || [];
      _ownerLast = r.ownerLastLogin || "";
      render();
      load.done = true;
    });
  }

  function _roleChips(u) {
    var c = u.owner ? "<span class='chip chip-gold'>Owner</span> " : "";
    return c + (u.role === "admin" ? "<span class='chip chip-gold'>Admin</span>" : "<span class='chip'>User</span>");
  }

  function render() {
    var me = Data.me() || {};
    var rows;
    if (Data.isAdmin()) {
      rows = _list.slice();
      // The built-in Owner sign-in, unless someone created a real "admin" user.
      if (!rows.some(function (u) { return u.username === "admin"; })) {
        rows.unshift({ username: "admin", name: "Owner", role: "admin", active: true, lastLogin: _ownerLast, owner: true });
      }
    } else {
      rows = [{ username: me.username, name: me.name, role: me.role, active: true, lastLogin: "", self: true }];
    }
    Utils.el("users-meta").textContent = Data.isAdmin() ? "· " + rows.length : "· your account";
    Utils.el("users-tbody").innerHTML = rows.map(function (u, n) {
      var self = u.username === me.username;
      var canEdit = Data.isAdmin() && !u.owner;
      return "<tr>" +
        "<td class='num'>" + (n + 1) + "</td>" +
        "<td><b>" + _esc(u.name) + "</b>" + (self ? " <span class='you'>you</span>" : "") + "</td>" +
        "<td>" + _esc(u.username) + "</td>" +
        "<td>" + _roleChips(u) + "</td>" +
        "<td>" + (u.active ? "Yes" : "<span style='color:var(--danger)'>No</span>") + "</td>" +
        "<td>" + (u.self ? "now" : _when(u.lastLogin)) + "</td>" +
        "<td style='white-space:nowrap;text-align:right'>" +
          (canEdit ? "<button class='btn btn-secondary btn-sm' onclick=\"Users.edit('" + _esc(u.username) + "')\">&#9998; Edit</button>" : "") +
        "</td></tr>";
    }).join("");
  }

  function _openSection() { Utils.el("sec-users").open = true; }

  function _showForm(title, submitText) {
    Utils.el("user-form-title").textContent = title;
    Utils.el("u-submit").textContent = submitText;
    Utils.el("user-form").style.display = "";
    togglePw(false);
    Utils.el("u-name").focus();
  }

  // "+ Add user" lives in the section header, so stop it toggling the section.
  function addNew(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    _openSection();
    _editing = null;
    Utils.el("user-form").reset();
    Utils.el("u-username").disabled = false;
    Utils.el("u-active").checked = true;
    Utils.el("u-password").placeholder = "At least 6 characters";
    Utils.el("u-password-label").textContent = "Password";
    _showForm("Add a user", "Add user");
  }

  function edit(username) {
    var u = _list.filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    _editing = username;
    Utils.el("u-name").value = u.name;
    Utils.el("u-username").value = u.username;
    Utils.el("u-username").disabled = true;
    Utils.el("u-role").value = u.role;
    Utils.el("u-active").checked = u.active;
    Utils.el("u-password").value = "";
    Utils.el("u-password").placeholder = "Leave blank to keep the current password";
    Utils.el("u-password-label").textContent = "New password (optional)";
    _showForm("Edit " + u.name, "Save changes");
    _deleteBtn(username);
  }

  // Delete lives inside the edit form, away from the table.
  function _deleteBtn(username) {
    var old = document.getElementById("u-delete"); if (old) old.remove();
    var me = Data.me() || {};
    if (!username || username === me.username) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "u-delete"; b.className = "link-btn danger-link";
    b.textContent = "Delete this user";
    b.onclick = function () { del(username); };
    Utils.el("u-submit").parentNode.insertBefore(b, Utils.el("u-submit").parentNode.children[1]);
  }

  function closeForm() {
    _editing = null;
    Utils.el("user-form").reset();
    Utils.el("user-form").style.display = "none";
    var d = document.getElementById("u-delete"); if (d) d.remove();
  }

  function submit(e) {
    if (e) e.preventDefault();
    var data = {
      name:     Utils.el("u-name").value.trim(),
      username: Utils.el("u-username").value.trim().toLowerCase(),
      role:     Utils.el("u-role").value,
      active:   Utils.el("u-active").checked,
      password: Utils.el("u-password").value
    };
    var btn = Utils.el("u-submit"), label = btn.textContent;
    btn.disabled = true; btn.textContent = "Saving…";
    Data.api(_editing ? "updateUser" : "addUser", data).then(function (r) {
      btn.disabled = false; btn.textContent = label;
      if (!r.ok) { Dialog.alert(r.error || "Could not save the user."); return; }
      Data.log((_editing ? "Updated user <b>" : "Added user <b>") + _esc(data.name) + "</b>");
      Data.save();
      closeForm();
      load();
    });
    return false;
  }

  function del(username) {
    var u = _list.filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    Dialog.confirm("Delete " + u.name + " (" + u.username + ")? They will no longer be able to sign in.",
                   {okText: "Delete", danger: true}).then(function (ok) {
      if (!ok) return;
      Data.api("deleteUser", { username: username }).then(function (r) {
        if (!r.ok) { Dialog.alert(r.error || "Could not delete the user."); return; }
        Data.log("Deleted user <b>" + _esc(u.name) + "</b>");
        Data.save();
        closeForm();
        load();
      });
    });
  }

  function togglePw(show) {
    var f = Utils.el("pw-form");
    if (show === undefined) show = f.style.display === "none";
    f.style.display = show ? "" : "none";
    if (show) { closeForm(); Utils.el("pw-old").focus(); } else f.reset();
  }

  function changePassword(e) {
    if (e) e.preventDefault();
    var oldPw = Utils.el("pw-old").value, newPw = Utils.el("pw-new").value;
    Data.api("changePassword", { oldPassword: oldPw, newPassword: newPw }).then(function (r) {
      if (!r.ok) { Dialog.alert(r.error || "Could not change the password."); return; }
      togglePw(false);
      Dialog.alert("Your password has been changed.");
    });
    return false;
  }

  return { load: load, addNew: addNew, edit: edit, closeForm: closeForm, submit: submit,
           togglePw: togglePw, changePassword: changePassword };
})();
