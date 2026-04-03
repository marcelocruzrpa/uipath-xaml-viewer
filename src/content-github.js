/**
 * UiPath XAML Visualizer — GitHub integration module.
 * Handles GitHub page detection, XAML fetching, button injection, and page observation.
 */
(() => {
  const UXV = window.UXV;
  const state = UXV.state;

  function isGitHubPage() {
    return document.querySelector('meta[name="github-enterprise-version"]')
      || document.querySelector('meta[name="hostname"][content*="github"]')
      || document.querySelector('.Header-link[href="https://github.com/"]')
      || document.querySelector('[data-pjax-container]')
      || location.hostname === 'github.com';
  }

  function isXamlFilePage() {
    return /\.xaml$/i.test(location.pathname) && /\/(blob|blame)\//.test(location.pathname);
  }

  function looksLikeXaml(text) {
    return text
      && typeof text === 'string'
      && text.trim().startsWith('<')
      && /(<Activity |<Sequence |<Flowchart |<StateMachine |xmlns.*uipath|xmlns.*xaml\/activities)/i.test(text.trim());
  }

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

  function findRawLink() {
    return document.querySelector('a[data-testid="raw-button"], a[href*="/raw/"]');
  }

  function buildRawUrl() {
    const match = location.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)/);
    if (!match) return null;
    const [, owner, repo, rest] = match;
    return `${location.origin}/${owner}/${repo}/raw/${rest}`;
  }

  async function fetchXamlOnce() {
    const rawLink = findRawLink();
    if (rawLink?.href) {
      const rawText = await tryFetch(rawLink.href);
      if (rawText) return rawText;
    }

    const rawUrl = buildRawUrl();
    if (rawUrl && rawUrl !== rawLink?.href) {
      const rawText = await tryFetch(rawUrl);
      if (rawText) return rawText;
    }

    for (const selector of ['.react-code-lines .react-file-line', '.react-code-text', '.blob-code-inner', 'pre.notranslate']) {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        const text = Array.from(els).map((el) => el.textContent).join('\n');
        if (looksLikeXaml(text)) return text;
      }
    }

    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      try {
        const blob = findBlob(JSON.parse(script.textContent));
        if (blob && looksLikeXaml(blob)) return blob;
      } catch (_e) {
        // Ignore unrelated JSON blobs.
      }
    }

    return null;
  }

  async function fetchXaml() {
    const result = await fetchXamlOnce();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 500));
    return fetchXamlOnce();
  }

  function findBlob(obj, depth = 0) {
    if (depth > 8 || !obj) return null;
    if (typeof obj === 'string' && obj.length > 50 && looksLikeXaml(obj)) return obj;
    if (typeof obj !== 'object') return null;

    for (const key of ['rawLines', 'text', 'blob', 'rawBlob', 'content', 'body', 'source']) {
      if (!obj[key]) continue;
      if (Array.isArray(obj[key])) {
        const joined = obj[key].join('\n');
        if (looksLikeXaml(joined)) return joined;
      } else if (typeof obj[key] === 'string' && looksLikeXaml(obj[key])) {
        return obj[key];
      }
    }

    for (const value of (Array.isArray(obj) ? obj : Object.values(obj))) {
      const found = findBlob(value, depth + 1);
      if (found) return found;
    }

    return null;
  }

  function findToolbar() {
    for (const selector of [
      '.react-blob-header-edit-and-raw-actions',
      '.react-blob-header-right-side-actions',
      '[class*="BlobContent"] [class*="headerActions"]',
      '.file-actions',
      '.Box-header .d-flex',
    ]) {
      const toolbar = document.querySelector(selector);
      if (toolbar) return toolbar;
    }
    const rawLink = findRawLink();
    return rawLink ? rawLink.closest('div,ul,nav,span') : null;
  }

  function findCode() {
    for (const selector of [
      '[class*="react-code-file-contents"]',
      '[data-testid="code-viewer"]',
      '.react-code-lines',
      '.js-file-line-container',
      '.blob-wrapper',
    ]) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findOverlays() {
    const found = [];
    const seen = new Set();
    for (const sel of [
      '#read-only-cursor-text-area',
      'textarea[class*="cursor"]',
      'textarea[class*="read-only"]',
      '[data-testid*="cursor-text"]',
      '.react-blob-print-hide textarea',
    ]) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!seen.has(el)) { seen.add(el); found.push(el); }
      });
    }
    return found;
  }

  function suppressOverlay(el) {
    if (el.dataset.uxvSuppressed) return;
    el.dataset.uxvSuppressed = '1';
    el.style.pointerEvents = 'none';
    state.suppressedOverlays.push(el);
  }

  function showCode(show) {
    if (show) {
      if (state.hiddenCodeEl) {
        state.hiddenCodeEl.style.display = '';
        state.hiddenCodeEl.style.height = '';
        state.hiddenCodeEl.style.overflow = '';
        state.hiddenCodeEl.style.minHeight = '';
        state.hiddenCodeEl.style.padding = '';
        state.hiddenCodeEl.style.margin = '';
        state.hiddenCodeEl = null;
      }
      if (state.hiddenCodeParent) {
        state.hiddenCodeParent.style.minHeight = '';
        state.hiddenCodeParent = null;
      }
      for (const el of state.suppressedOverlays) {
        el.style.pointerEvents = '';
        delete el.dataset.uxvSuppressed;
      }
      state.suppressedOverlays = [];
      if (state.overlayObserver) { state.overlayObserver.disconnect(); state.overlayObserver = null; }
      return;
    }

    const codeEl = findCode();
    if (!codeEl) return;
    state.hiddenCodeEl = codeEl;
    state.hiddenCodeEl.style.display = 'none';
    state.hiddenCodeEl.style.height = '0';
    state.hiddenCodeEl.style.overflow = 'hidden';
    state.hiddenCodeEl.style.minHeight = '0';
    state.hiddenCodeEl.style.padding = '0';
    state.hiddenCodeEl.style.margin = '0';
    if (state.hiddenCodeEl.parentElement) {
      state.hiddenCodeParent = state.hiddenCodeEl.parentElement;
      state.hiddenCodeParent.style.minHeight = '0';
    }
    findOverlays().forEach(suppressOverlay);

    if (!state.overlayObserver) {
      const watchTarget = codeEl.parentElement || document.body;
      state.overlayObserver = new MutationObserver(() => {
        if (!state.isViewing) return;
        findOverlays().forEach(suppressOverlay);
      });
      state.overlayObserver.observe(watchTarget, { childList: true, subtree: true });
    }
  }

  function svgIcon(type) {
    if (type === 'chart') {
      return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"><path d="M1.5 1.75V13.5h13.75a.75.75 0 010 1.5H.75a.75.75 0 01-.75-.75V1.75a.75.75 0 011.5 0zm14.28 2.53l-5.25 5.25a.75.75 0 01-1.06 0L7 7.06 3.28 10.78a.75.75 0 01-1.06-1.06l4.25-4.25a.75.75 0 011.06 0L10 7.94l4.72-4.72a.75.75 0 011.06 1.06z"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"><path d="M4.72 3.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06L5.78 10.78a.75.75 0 01-1.06-1.06L7.44 7 4.72 4.28a.75.75 0 010-1.06zm5.25 0a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L12.69 7 9.97 4.28a.75.75 0 010-1.06z"/></svg>';
  }

  function injectButton() {
    if (document.getElementById(UXV.BUTTON_ID)) return;
    const toolbar = findToolbar();

    const btn = document.createElement('button');
    btn.id = UXV.BUTTON_ID;
    btn.className = toolbar ? 'uxv-btn' : 'uxv-btn uxv-btn-floating';
    btn.innerHTML = svgIcon('chart') + ' Visualize XAML';
    btn.title = 'Visualize UiPath workflow';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'Visualize UiPath XAML workflow');
    btn.addEventListener('click', (e) => { e.stopPropagation(); UXV.viewer.toggleViewer(); });

    if (toolbar) {
      toolbar.prepend(btn);
    } else {
      document.body.appendChild(btn);
    }
  }

  /**
   * Wait for an element matching `selector` to appear in the DOM.
   * Resolves immediately if already present, otherwise observes mutations.
   */
  function waitForElement(selector, timeout = 5000) {
    const existing = document.querySelector(selector);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); clearTimeout(timer); resolve(el); }
      });
      const timer = setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  function checkPage() {
    if (location.href !== state.lastUrl) {
      state.lastUrl = location.href;
      state.userClosed = false;
      UXV.viewer.cleanupViewerState();
      window.UiPathDiff?.clearCache();
    }

    if (isXamlFilePage()) {
      waitForElement('.react-blob-header-edit-and-raw-actions, .react-blob-header-right-side-actions, .file-actions, [data-testid="raw-button"]').then(() => {
        injectButton();
        if (!state.isViewing && !state.userClosed && document.getElementById(UXV.BUTTON_ID)) {
          chrome.storage.local.get('uxv_auto_visualize', (result) => {
            if (result.uxv_auto_visualize !== false) {
              UXV.viewer.toggleViewer();
            }
          });
        }
      });
    }
    if (window.UiPathDiff?.isDiffPage()) {
      waitForElement('[data-tagsearch-tag="filename"], .file-header, .js-file-header').then(() => {
        window.UiPathDiff.injectDiffButtons();
        window.UiPathDiff.injectDiffSummaries();
      });
    }
  }

  function startObserver() {
    checkPage();
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      const isOwnMutation = mutations.every((m) => {
        const target = m.target;
        return target.id === UXV.VIEWER_ID || target.closest?.('#' + UXV.VIEWER_ID);
      });
      if (isOwnMutation) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkPage, 200);
    });
    const observeTarget = document.querySelector('main, [data-pjax-container], #js-repo-pjax-container') || document.body;
    observer.observe(observeTarget, { childList: true, subtree: true });
    window.addEventListener('popstate', () => setTimeout(checkPage, 500));
    document.addEventListener('turbo:load', () => setTimeout(checkPage, 500));
    document.addEventListener('turbo:render', () => setTimeout(checkPage, 500));
  }

  // Expose on UXV namespace
  UXV.github = {
    isGitHubPage,
    isXamlFilePage,
    looksLikeXaml,
    tryFetch,
    fetchXaml,
    fetchXamlOnce,
    findBlob,
    findRawLink,
    buildRawUrl,
    findToolbar,
    findCode,
    findOverlays,
    suppressOverlay,
    showCode,
    injectButton,
    svgIcon,
    checkPage,
    startObserver,
  };
})();
