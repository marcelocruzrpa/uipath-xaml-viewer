/**
 * UiPath XAML Visualizer — Shared state and constants.
 * All modules communicate via the window.UXV namespace.
 */
window.UXV = (() => {
  const BUTTON_ID = 'uxv-visualize-btn';
  const VIEWER_ID = 'uxv-viewer-container';
  const CANVAS_PADDING = 20;

  const state = {
    isViewing: false,
    currentParsed: null,
    panZoomCtrl: null,
    pendingSearchQuery: '',
    viewMode: 'diagram',
    hiddenCodeEl: null,
    hiddenCodeParent: null,
    suppressedOverlays: [],
    overlayObserver: null,
    lastUrl: location.href,
    viewerAc: null,
    isToggling: false,
    userClosed: false,
    themeOverride: null,
  };

  const htmlEscape = window.UiPathUtils.escHtml;
  const parseGitHubUrl = window.UiPathUtils.parseGitHubUrl;
  const findById = window.UiPathUtils.findInTree;

  function byDataId(root, id) {
    return root.querySelector(`[data-id="${CSS.escape(id)}"]`);
  }

  function allByDataId(root, id) {
    return root.querySelectorAll(`[data-id="${CSS.escape(id)}"]`);
  }

  return {
    BUTTON_ID,
    VIEWER_ID,
    CANVAS_PADDING,
    state,
    htmlEscape,
    parseGitHubUrl,
    findById,
    byDataId,
    allByDataId,
    // Cross-module function references (set by other modules during init)
    github: {},
    viewer: {},
    interactions: {},
  };
})();
