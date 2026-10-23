// Userscript manager command for opening the current page or right-clicked link.
(function (root, apiScope) {
  "use strict";

  var manager = apiScope.GM;
  var legacyCommand = apiScope.GM_registerMenuCommand;
  var registerCommand =
    typeof legacyCommand === "function"
      ? legacyCommand.bind(apiScope)
      : manager && typeof manager.registerMenuCommand === "function"
        ? manager.registerMenuCommand.bind(manager)
        : null;
  var detectors = root.RalgrumDetectors;

  if (!registerCommand || !detectors) {
    return;
  }

  var rightClickedUrl = "";
  var rightClickedAt = 0;

  root.document.addEventListener(
    "contextmenu",
    function (event) {
      var target = event.target;
      if (target && target.nodeType !== 1) {
        target = target.parentElement;
      }
      var link = target && target.closest ? target.closest("a[href]") : null;
      var href = link ? link.href : "";
      rightClickedUrl = detectors.detectFromUrl(href) ? href : "";
      rightClickedAt = Date.now();
    },
    true,
  );

  registerCommand("Open in ralgruM", function () {
    var useRightClickedLink =
      rightClickedUrl && Date.now() - rightClickedAt < 15000;
    var sourceUrl = useRightClickedLink ? rightClickedUrl : root.location.href;
    rightClickedUrl = "";

    var entity = detectors.detectFromUrl(sourceUrl);
    var appUrl = detectors.buildRalgrumUrl(entity);
    if (appUrl) {
      root.location.href = appUrl;
    }
  });
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof globalThis !== "undefined" ? globalThis : window,
);
