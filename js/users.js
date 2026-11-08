// ================================================================
//  users.js — Settings → Users (admins) and My account (everyone).
//  Users live in the "Users" tab of the PT sheet; passwords are
//  hashed on the server and never sent back to the browser.
// ================================================================
var Users = (function () {
  var _list = [];
  var _editing = null;   // username being edited, or null when adding

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function load() {
    showMe();
    if (!Data.isAdmin()) return;
    Data.api("listUsers").then(function (r) {
      if (!r.ok) { _render("<tr><td colspan='6' style='color:var(--danger)'>" + _esc(r.error) + "</td></tr>"); return; }
      _list = r.users || [];
      render();
    });
  }

  function _render(html) { Utils.el("users-tbody").innerHTML = html; }

  function render() {
    var me = Data.me() || {};
    if (!_list.length) {
      _render("<tr><td colspan='6' style='color:var(--text3)'>No users yet. You are signed in with the built-in " +
              "<b>admin</b> account. Add yourself as an admin below, then everyone else.</td></tr>");
      return;
    }
    _render(_list.map(function (u) {
      var self = u.username === me.username;
      return "<tr>" +
        "<td>" + _esc(u.name) + (self ? " <span class='badge badge-blue'>you</span>" : "") + "</td>" +
        "<td>" + _esc(u.username) + "</td>" +
        "<td><span class='badge " + (u.role === "admin" ? "badge-orange'>Admin" : "badge-blue'>User") + "</span></td>" +
        "<td><span class='badge " + (u.active ? "badge-green'>Active" : "badge-red'>Disabled") + "</span></td>" +
        "<td>" + _esc(u.created) + "</td>" +
        "<td style='white-space:nowrap;text-align:right'>" +
          "<button class='btn btn-secondary btn-sm' onclick=\"Users.edit('" + _esc(u.username) + "')\">Edit</button> " +
          (self ? "" : "<button class='btn btn-danger btn-sm' onclick=\"Users.del('" + _esc(u.username) + "')\">Delete</button>") +
        "</td></tr>";
    }).join(""));
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
    Utils.el("user-form-title").textContent = "Edit " + u.name;
    Utils.el("u-submit").textContent = "Save changes";
    Utils.el("u-cancel").style.display = "";
    Utils.el("u-name").focus();
  }

  function resetForm() {
    _editing = null;
    Utils.el("user-form").reset();
    Utils.el("u-username").disabled = false;
    Utils.el("u-active").checked = true;
    Utils.el("u-password").placeholder = "At least 6 characters";
    Utils.el("u-password-label").textContent = "Password";
    Utils.el("user-form-title").textContent = "Add a user";
    Utils.el("u-submit").textContent = "Add user";
    Utils.el("u-cancel").style.display = "none";
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
      resetForm();
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
        if (_editing === username) resetForm();
        load();
      });
    });
  }

  function togglePw(show) {
    var f = Utils.el("pw-form");
    if (show === undefined) show = f.style.display === "none";
    f.style.display = show ? "" : "none";
    if (show) Utils.el("pw-old").focus(); else f.reset();
  }

  // "Signed in as" row at the top of the section
  function showMe() {
    var me = Data.me() || {};
    var nm = me.name || me.username || "";
    Utils.el("me-avatar").textContent = nm.split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    Utils.el("me-name").textContent = nm;
    Utils.el("acct-hint").textContent = (me.role === "admin" ? "Admin" : "User") + " \u00b7 signed in as " + (me.username || "");
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

  return { load: load, togglePw: togglePw, edit: edit, del: del, submit: submit, resetForm: resetForm, changePassword: changePassword };
})();
