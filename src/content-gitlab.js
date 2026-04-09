/**
 * UiPath XAML Visualizer — GitLab integration module.
 * Handles GitLab page detection, XAML fetching, button injection, and page observation.
 */
(() => {
  const UXV = window.UXV;
  const state = UXV.state;
  const looksLikeXaml = window.UiPathUtils.looksLikeXaml;
  const tryFetch = window.UiPathUtils.tryFetch;

  function isGitLabPage() {
    return document.querySelector('meta[content="GitLab"]')
      || document.querySelector('body[data-page^="projects:"]')
      || document.querySelector('.navbar-gitlab, .gl-navbar')
      || location.hostname === 'gitlab.com';
  }

  function isXamlFilePage() {
    return /\.xaml$/i.test(location.pathname) && /\/-\/(blob|blame)\//.test(location.pathname);
  }

  function parsePageUrl() {
    return window.UiPathUtils.parseGitLabUrl();
  }

  function buildFileUrl(ctx, filePath) {
    return `/${ctx.owner}/-/blob/${ctx.ref}/${filePath}`;
  }

  function findRawLink() {
    return document.querySelector('a[data-testid="raw-button"], a.btn-raw, a[href*="/-/raw/"]');
  }

  function buildRawUrl() {
    const match = location.pathname.match(/^\/(.+?)\/-\/blob\/(.+)/);
    if (!match) return null;
    const [, projectPath, rest] = match;
    return `${location.origin}/${projectPath}/-/raw/${rest}`;
  }

  async function fetchXamlOnce() {
    // Strategy 1: raw link on page
    const rawLink = findRawLink();
    if (rawLink?.href) {
      const rawText = await tryFetch(rawLink.href);
      if (rawText) return rawText;
    }

    // Strategy 2: constructed raw URL
    const rawUrl = buildRawUrl();
    if (rawUrl && rawUrl !== rawLink?.href) {
      const rawText = await tryFetch(rawUrl);
      if (rawText) return rawText;
    }

    // Strategy 3: DOM scraping
    for (const selector of ['.blob-content code', '.blob-content .line_content', '.blob-content pre', '.file-content code', 'pre.code']) {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        const text = Array.from(els).map((el) => el.textContent).join('\n');
        if (looksLikeXaml(text)) return text;
      }
    }

    // Strategy 4: embedded JSON blobs
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

    for (const key of ['rawLines', 'text', 'blob', 'rawBlob', 'content', 'body', 'source', 'raw_path']) {
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
      '.file-actions',
      '.file-header-content .btn-group',
      '.blob-actions',
      '.file-title-flex-parent .file-actions',
      '.js-blob-header-actions',
    ]) {
      const toolbar = document.querySelector(selector);
      if (toolbar) return toolbar;
    }
    const rawLink = findRawLink();
    return rawLink ? rawLink.closest('div,ul,nav,span') : null;
  }

  function findCode() {
    for (const selector of [
      '.blob-content',
      '.file-content',
      '.blob-viewer',
      '#blob-content-holder',
      '.file-holder .blob-content-holder',
    ]) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findOverlays() {
    // GitLab does not use textarea overlays like GitHub's code viewer
    return [];
  }

  function suppressOverlay(_el) {
    // No-op for GitLab
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
    btn.textContent = '';
    const icon = document.createElement('span');
    icon.innerHTML = svgIcon('chart');
    btn.appendChild(icon.firstChild);
    btn.appendChild(document.createTextNode(' Visualize XAML'));
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
      waitForElement('.file-actions, .blob-actions, .js-blob-header-actions, a.btn-raw, a[href*="/-/raw/"]').then(() => {
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
      waitForElement('.diff-file .file-title-name, .diff-file .file-header-content, .diff-files-holder .file-holder').then(() => {
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
    const observeTarget = document.querySelector('#content-body, .content-wrapper, main') || document.body;
    observer.observe(observeTarget, { childList: true, subtree: true });
    window.addEventListener('popstate', () => setTimeout(checkPage, 500));
    document.addEventListener('turbolinks:load', () => setTimeout(checkPage, 500));
    document.addEventListener('turbo:load', () => setTimeout(checkPage, 500));
  }

  // Expose on UXV namespace
  UXV.gitlab = {
    isGitLabPage,
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
    parsePageUrl,
    buildFileUrl,
  };
})();
