/**
 * UiPath XAML Viewer — Shared utilities.
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

  /**
   * Return the GitLab API v4 base URL for a given hostname.
   */
  function getGitLabApiBase(hostname) {
    if (!hostname) hostname = location.hostname;
    return `https://${hostname}/api/v4`;
  }

  /**
   * Check whether a string looks like UiPath XAML content.
   */
  function looksLikeXaml(text) {
    return text
      && typeof text === 'string'
      && text.trim().startsWith('<')
      && /(<Activity |<Sequence |<Flowchart |<StateMachine |xmlns.*uipath|xmlns.*xaml\/activities)/i.test(text.trim());
  }

  /**
   * Fetch a URL and return the body text if it looks like XAML, else null.
   */
  async function tryFetch(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const text = await response.text();
      return looksLikeXaml(text) ? text : null;
    } catch (e) {
      console.warn('[UXV] Fetch failed for', url, e.message);
      return null;
    }
  }

  /**
   * Parse the current GitLab page URL into { owner, repo, view, ref, filePath, dir }.
   * GitLab URLs use /-/ as separator: /group/subgroup/project/-/blob/branch/path/file
   * owner contains the full project path (may include subgroups).
   */
  function parseGitLabUrl() {
    const match = location.pathname.match(/^\/(.+?)\/-\/(blob|tree|blame)\/(.+)/);
    if (!match) return null;
    const [, projectPath, view, rest] = match;

    // Try to read ref from GitLab's data-ref attribute
    const dataRef = document.querySelector('[data-ref]')?.getAttribute('data-ref');
    if (dataRef && rest.startsWith(dataRef + '/')) {
      const filePath = rest.slice(dataRef.length + 1);
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      return { owner: projectPath, repo: '', view, ref: dataRef, filePath, dir };
    }

    // Fallback: first segment as ref
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      return { owner: projectPath, repo: '', view, ref: rest, filePath: '', dir: '' };
    }
    const ref = rest.substring(0, slashIdx);
    const filePath = rest.substring(slashIdx + 1);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    return { owner: projectPath, repo: '', view, ref, filePath, dir };
  }

  return { esc, escHtml, findInTree, getApiBase, getRawBase, getGitLabApiBase, parseGitHubUrl, parseGitLabUrl, looksLikeXaml, tryFetch };
})();
