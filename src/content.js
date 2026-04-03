/**
 * UiPath XAML Visualizer — Orchestrator entry point.
 *
 * Modules are loaded in order via manifest.json:
 *   content-state.js → content-github.js → content-viewer.js → content-interactions.js → content.js
 *
 * Each module registers itself on the shared window.UXV namespace.
 * This file simply guards against non-GitHub pages and starts the page observer.
 */
(() => {
  if (!window.UXV?.github?.isGitHubPage()) return;
  window.UXV.github.startObserver();
})();
