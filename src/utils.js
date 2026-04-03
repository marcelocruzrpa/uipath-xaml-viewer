/**
 * UiPath XAML Visualizer — Shared utilities.
 * Loaded before parser, renderer, diff, and content scripts.
 */
window.UiPathUtils = (() => {

  /**
   * Escape HTML special characters (regex-based, no DOM needed).
   */
  function esc(value) {
    return !value
      ? ''
      : value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Escape HTML special characters (DOM-based, guaranteed safe).
   */
  function escHtml(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  }

  /**
   * Recursively find a node by id in a parsed workflow tree.
   * Traverses children, flowNodes (with innerActivity), and stateNodes (with entryNode).
   */
  function findInTree(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children || []) {
      const found = findInTree(child, id);
      if (found) return found;
    }
    for (const child of node.flowNodes || []) {
      if (child.id === id) return child;
      if (child.innerActivity) {
        const found = findInTree(child.innerActivity, id);
        if (found) return found;
      }
    }
    for (const child of node.stateNodes || []) {
      if (child.id === id) return child;
      if (child.entryNode) {
        const found = findInTree(child.entryNode, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Return the GitHub API base URL for a given hostname.
   */
  function getApiBase(hostname) {
    if (!hostname) hostname = location.hostname;
    return hostname === 'github.com'
      ? 'https://api.github.com'
      : `https://${hostname}/api/v3`;
  }

  /**
   * Return the raw content base URL for a given hostname.
   */
  function getRawBase(hostname) {
    if (!hostname) hostname = location.hostname;
    return hostname === 'github.com'
      ? 'https://raw.githubusercontent.com'
      : `https://${hostname}`;
  }

  /**
   * Parse the current GitHub page URL into { owner, repo, view, ref, filePath, dir }.
   * Handles refs containing slashes (e.g. feature/foo) by reading the embedded
   * JSON payload that GitHub injects into code-view pages.
   * Falls back to regex when the DOM payload is unavailable.
   */
  function parseGitHubUrl() {
    // Quick check: URL must contain /blob/, /tree/, or /blame/
    const viewMatch = location.pathname.match(/^\/([^/]+)\/([^/]+)\/(blob|tree|blame)\/(.+)/);
    if (!viewMatch) return null;
    const [, owner, repo, view, rest] = viewMatch;

    // Primary: read ref from GitHub's embedded React JSON payload (slash-safe)
    try {
      const script = document.querySelector(
        'react-app[app-name="code-view"] script[data-target="react-app.embeddedData"]'
      );
      if (script) {
        const data = JSON.parse(script.textContent);
        const p = data?.payload;
        const refInfo =
          p?.codeViewBlobLayoutRoute?.refInfo ??
          p?.codeViewLayoutRoute?.refInfo;
        const filePath =
          p?.codeViewBlobLayoutRoute?.path ??
          p?.codeViewLayoutRoute?.path;
        if (refInfo?.name && filePath) {
          const dir = filePath.substring(0, filePath.lastIndexOf('/'));
          return { owner, repo, view, ref: refInfo.name, filePath, dir };
        }
      }
    } catch (_e) {
      // JSON parse failed — fall through to heuristics
    }

    // Secondary: read ref from the branch selector button text
    try {
      const btn = document.getElementById('ref-picker-repos-header-ref-selector');
      if (btn) {
        const ref = btn.textContent.trim();
        if (ref && rest.startsWith(ref + '/')) {
          const filePath = rest.slice(ref.length + 1);
          const dir = filePath.substring(0, filePath.lastIndexOf('/'));
          return { owner, repo, view, ref, filePath, dir };
        }
      }
    } catch (_e) {
      // fall through
    }

    // Fallback: treat the first path segment as the ref (works for simple refs)
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      return { owner, repo, view, ref: rest, filePath: '', dir: '' };
    }
    const ref = rest.substring(0, slashIdx);
    const filePath = rest.substring(slashIdx + 1);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    return { owner, repo, view, ref, filePath, dir };
  }

  return { esc, escHtml, findInTree, getApiBase, getRawBase, parseGitHubUrl };
})();
