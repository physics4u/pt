// ================================================================
//  help.js — Help page: About PT and the user guide.
// ================================================================
var Help = (function () {

  function init() {
    _about();
    Utils.el("help-version").textContent = "Version " + PT_VERSION;
  }

  // Version information.
  function _about() {
    Utils.el("about-hint").textContent = "\u00b7 version " + PT_VERSION;
    var rows = [
      ["Version",  PT_VERSION],
      ["Made in",  "San Jose, California"],
      ["Data",     "Stored securely in PT\u2019s online database"]
    ];
    Utils.el("about-body").innerHTML = "<table>" + rows.map(function (r) {
      return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>";
    }).join("") + "</table>" +
      "<div class='section-note' style='margin:10px 0 0'>" +
      "The version is the release date and that day's release number (India time).</div>";
  }


  // Search: open the sections that mention the words, hide the rest.
  function search(q) {
    var words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll("#page-help details.help").forEach(function (d) {
      var text = d.textContent.toLowerCase();
      var hit = words.every(function (w) { return text.indexOf(w) >= 0; });
      d.style.display = hit ? "" : "none";
      d.open = words.length ? hit : d.id === "help-about";
    });
  }

  return { init: init, search: search };
})();
