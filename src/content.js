/**
 * UiPath XAML Viewer — Orchestrator entry point.
 *
 * Modules are loaded in order via manifest.json:
 *   content-state.js → content-github.js → content-gitlab.js → content-viewer.js → content-interactions.js → content.js
 *
 * Each module registers itself on the shared window.UXV namespace.
 * This file detects the active platform and starts the page observer.
 */
(() => {
  const UXV = window.UXV;
  if (UXV?.github?.isGitHubPage()) {
    UXV.platform = UXV.github;
  } else if (UXV?.gitlab?.isGitLabPage()) {
    UXV.platform = UXV.gitlab;
  }
  if (!UXV?.platform) return;
  UXV.platform.startObserver();
})();
