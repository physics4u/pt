// ================================================================
//  storage.js — Settings → Storage (admins): how much of PT's
//  10,000,000-cell allowance is in use, by area, with a progress bar.
// ================================================================
var StoragePage = (function () {
  var fmt = function (n) { return Number(n || 0).toLocaleString("en-US"); };

  function _pct(cells, limit) {
    var p = cells / limit * 100;
    return p < 0.1 && cells > 0 ? "<0.1" : p < 10 ? p.toFixed(1) : Math.round(p).toString();
  }

  function _level(p) { return p >= 90 ? "bad" : p >= 70 ? "warn" : "ok"; }

  function render(r) {
    var p = r.cells / r.limit * 100, pctText = _pct(r.cells, r.limit) + "%";
    Utils.el("storage-meta").textContent = "\u00b7 " + pctText + " used";
    ["storage-bar", "storage-mini"].forEach(function (id) {
      var b = Utils.el(id);
      b.style.width = Math.max(p, r.cells ? 0.6 : 0) + "%";
      b.className = "lvl-" + _level(p);
    });
    Utils.el("storage-text").innerHTML = "<b>" + fmt(r.cells) + "</b> of " + fmt(r.limit) +
      " cells used (" + pctText + ") &middot; " + fmt(r.limit - r.cells) + " free";
    Utils.el("storage-tbody").innerHTML = (r.parts || []).map(function (x, i) {
      var share = r.cells ? Math.round(x.cells / r.cells * 100) : 0;
      return "<tr><td class='num'>" + (i + 1) + "</td><td>" + x.name + "</td><td>" + fmt(x.cells) + "</td>" +
             "<td><span class='share'><span style='width:" + share + "%'></span></span> " + share + "%</td></tr>";
    }).join("");
  }

  function load() {
    if (!Data.isAdmin()) return;
    Data.api("usage").then(function (r) {
      if (!r.ok) { Utils.el("storage-text").textContent = r.error || "Could not check storage."; return; }
      render(r);
    });
  }

  function compact(btn) {
    btn.disabled = true; btn.textContent = "Freeing up\u2026";
    Data.api("compact").then(function (r) {
      btn.disabled = false; btn.textContent = "Free up space";
      if (!r.ok) { Dialog.alert(r.error || "Could not free up space."); return; }
      render(r);
      Dialog.alert(r.freed > 0 ? "Freed " + fmt(r.freed) + " cells of unused space." : "There was no unused space to free.");
      if (r.freed > 0) { Data.log("Freed " + fmt(r.freed) + " cells of storage"); Data.save(); }
    });
  }

  return { load: load, compact: compact };
})();
