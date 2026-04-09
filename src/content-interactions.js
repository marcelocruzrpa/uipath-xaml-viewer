/**
 * UiPath XAML Viewer — User interaction handlers module.
 * Pan-zoom, collapse, inspector, search, keyboard, context menu, bookmarks, etc.
 */
(() => {
  const UXV = window.UXV;
  const state = UXV.state;
  const htmlEscape = UXV.htmlEscape;
  const findById = UXV.findById;
  const byDataId = UXV.byDataId;
  const parsePageUrl = UXV.parsePageUrl;
  const CANVAS_PADDING = UXV.CANVAS_PADDING;

  // Search functions from content-search.js module
  const findMatches = window.UiPathSearch.findMatches;
  const expandAncestors = window.UiPathSearch.expandAncestors;

  function resolveWorkflowPath(workflowFileName, currentDir) {
    const normalized = workflowFileName.replace(/\\/g, '/');
    // UiPath paths starting with .. or . are relative to the current file's directory.
    // All other paths are relative to the project root.
    const isRelative = normalized.startsWith('../') || normalized.startsWith('./');
    const segments = isRelative ? currentDir.split('/').filter(Boolean) : [];
    const parts = normalized.split('/');

    for (const part of parts) {
      if (part === '..') {
        segments.pop();
      } else if (part !== '.') {
        segments.push(part);
      }
    }
    return segments.join('/');
  }

  function setupInteractions(viewer, priorState) {
    if (state.panZoomCtrl) state.panZoomCtrl.ac.abort();
    const canvas = viewer.querySelector(state.viewMode === 'flowchart' ? '#uxv-flowchart-canvas' : '#uxv-canvas');
    const wrap = viewer.querySelector(state.viewMode === 'flowchart' ? '#uxv-flowchart-wrap' : '#uxv-canvas-wrap');
    const zoomLabel = viewer.querySelector('#uxv-zoom-label');

    try {
      state.panZoomCtrl = window.UiPathRenderer.setupPanZoom(wrap, canvas, {
        scale: priorState?.scale,
        tx: priorState?.tx || 0,
        ty: priorState?.ty || 0,
        fitScale: 0.9,
        onZoom: (s) => { if (zoomLabel) zoomLabel.textContent = Math.round(s * 100) + '%'; },
        onViewChange: (viewState) => updateMinimap(viewer, viewState),
      });
      viewer.querySelector('#uxv-zoom-in')?.addEventListener('click', state.panZoomCtrl.zoomIn);
      viewer.querySelector('#uxv-zoom-out')?.addEventListener('click', state.panZoomCtrl.zoomOut);
      viewer.querySelector('#uxv-zoom-fit')?.addEventListener('click', state.panZoomCtrl.fitToView);
      if (!priorState) requestAnimationFrame(() => requestAnimationFrame(() => state.panZoomCtrl.fitToView()));
    } catch (err) {
      console.error('[UXV] Pan-zoom setup failed:', err);
      state.panZoomCtrl = null;
    }

    viewer.querySelector('#uxv-diagram-toggle')?.addEventListener('click', () => {
      state.viewMode = 'diagram';
      UXV.viewer.renderViewer();
    });
    viewer.querySelector('#uxv-view-toggle')?.addEventListener('click', () => {
      state.viewMode = 'outline';
      UXV.viewer.renderViewer();
    });
    viewer.querySelector('#uxv-flowchart-toggle')?.addEventListener('click', () => {
      state.viewMode = 'flowchart';
      UXV.viewer.renderViewer();
    });
    viewer.querySelector('#uxv-theme-toggle')?.addEventListener('click', () => {
      const isDark = window.UiPathRenderer.isDarkMode();
      state.themeOverride = isDark ? 'light' : 'dark';
      UXV.viewer.renderViewer();
    });
    viewer.querySelector('#uxv-help-btn')?.addEventListener('click', () => toggleShortcutHelp(viewer));
    viewer.querySelector('#uxv-collapse-all')?.addEventListener('click', () => { UXV.viewer.setAll(state.currentParsed.tree, true); UXV.viewer.saveCollapseState(state.currentParsed.tree); UXV.viewer.renderViewer(); });
    viewer.querySelector('#uxv-expand-all')?.addEventListener('click', () => { UXV.viewer.setAll(state.currentParsed.tree, false); UXV.viewer.saveCollapseState(state.currentParsed.tree); UXV.viewer.renderViewer(); });
    const exportBtn = viewer.querySelector('#uxv-export-btn');
    const exportDropdown = viewer.querySelector('#uxv-export-dropdown');
    if (exportBtn && exportDropdown) {
      exportBtn.addEventListener('click', (e) => { e.stopPropagation(); exportDropdown.classList.toggle('uxv-show'); });
      exportDropdown.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('click', () => exportDropdown.classList.remove('uxv-show'), { signal: state.viewerAc.signal });
    }
    viewer.querySelector('#uxv-export-svg')?.addEventListener('click', () => { UXV.viewer.exportSvg(); exportDropdown?.classList.remove('uxv-show'); });
    viewer.querySelector('#uxv-export-png')?.addEventListener('click', () => { UXV.viewer.exportPng(); exportDropdown?.classList.remove('uxv-show'); });
    viewer.querySelector('#uxv-export-print')?.addEventListener('click', () => { UXV.viewer.exportPrint(); exportDropdown?.classList.remove('uxv-show'); });
    viewer.querySelector('#uxv-compare-branch')?.addEventListener('click', () => UXV.viewer.showBranchCompare(viewer));
  }

  function setupCollapse(viewer) {
    viewer.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-toggle]');
      if (!toggle) return;
      const group = toggle.closest('.uxv-container,.uxv-collapsed');
      if (!group) return;
      const node = findById(state.currentParsed.tree, group.dataset.id);
      if (node && ((node.children && node.children.length > 0) || node.entryNode || node.innerActivity?.children?.length > 0)) {
        node.collapsed = !node.collapsed;
        UXV.viewer.saveCollapseState(state.currentParsed.tree);
        UXV.viewer.renderViewer();
      }
    });
  }

  function setupInspector(viewer) {
    viewer.addEventListener('click', (event) => {
      if (event.target.closest('[data-toggle]')) return;

      const edgeLabel = event.target.closest('.uxv-edge-label');
      if (edgeLabel) {
        const from = edgeLabel.dataset.edgeFrom;
        const to = edgeLabel.dataset.edgeTo;
        const edge = state.currentParsed.tree.stateEdges?.find((e) => e.from === from && e.to === to);
        if (!edge) return;

        viewer.querySelectorAll('.uxv-selected').forEach((el) => el.classList.remove('uxv-selected'));

        let html = '<div class="uxv-panel-section uxv-inspector">';
        html += `<h4>▷ Transition: ${htmlEscape(edge.label || 'Unnamed')}</h4>`;
        if (edge.condition) html += `<div class="uxv-inspector-type">Condition: ${htmlEscape(edge.condition)}</div>`;
        if (edge.trigger) {
          html += `<details class="uxv-inspector-details" open><summary><h4>Trigger: ${htmlEscape(edge.trigger.displayName || edge.trigger.type)}</h4></summary>`;
          if (edge.trigger.properties && Object.keys(edge.trigger.properties).length > 0) {
            html += '<table><tr><th>Property</th><th>Value</th></tr>';
            Object.entries(edge.trigger.properties).forEach(([key, value]) => {
              html += `<tr><td>${htmlEscape(key)}</td><td>${htmlEscape(String(value))}</td></tr>`;
            });
            html += '</table>';
          }
          html += '</details>';
        }
        if (edge.action) {
          html += `<details class="uxv-inspector-details" open><summary><h4>Action: ${htmlEscape(edge.action.displayName || edge.action.type)}</h4></summary>`;
          if (edge.action.properties && Object.keys(edge.action.properties).length > 0) {
            html += '<table><tr><th>Property</th><th>Value</th></tr>';
            Object.entries(edge.action.properties).forEach(([key, value]) => {
              html += `<tr><td>${htmlEscape(key)}</td><td>${htmlEscape(String(value))}</td></tr>`;
            });
            html += '</table>';
          }
          html += '</details>';
        }
        html += '</div>';

        const panel = viewer.querySelector('#uxv-panel');
        if (panel) {
          panel.querySelector('.uxv-inspector')?.remove();
          panel.insertAdjacentHTML('afterbegin', html);
        }
        return;
      }

      const nodeEl = event.target.closest('.uxv-node');
      if (!nodeEl) return;
      const found = findById(state.currentParsed.tree, nodeEl.dataset.id);
      if (!found) return;

      viewer.querySelectorAll('.uxv-selected').forEach((el) => el.classList.remove('uxv-selected'));
      nodeEl.classList.add('uxv-selected');
      history.replaceState(null, '', UXV.viewer.buildViewHash(nodeEl.dataset.id, state.panZoomCtrl?.getState()));

      const type = found.type || found.activityType || found.flowType || 'Activity';
      const category = found.category ? ` (${found.category})` : '';
      let html = '<div class="uxv-panel-section uxv-inspector">';
      html += `<h4>▷ ${htmlEscape(found.displayName || 'Activity')}</h4>`;
      html += `<div class="uxv-inspector-type">${htmlEscape(type)}${htmlEscape(category)}</div>`;

      if (found.properties && Object.keys(found.properties).length > 0) {
        const screenshotKeys = new Set(['ImageBase64', 'InformativeScreenshot']);
        const visibleProps = Object.entries(found.properties).filter(([k]) => !screenshotKeys.has(k));
        if (visibleProps.length > 0) {
          html += `<details class="uxv-inspector-details" open><summary><h4>Properties (${visibleProps.length})</h4></summary>`;
          html += '<table><tr><th>Property</th><th>Value</th></tr>';
          visibleProps.forEach(([key, value]) => {
            html += `<tr><td>${htmlEscape(key)}</td><td>${htmlEscape(String(value))}</td></tr>`;
          });
          html += '</table></details>';
        }
      }

      if (found.variables && found.variables.length > 0) {
        html += `<details class="uxv-inspector-details" open><summary><h4>Scoped Variables (${found.variables.length})</h4></summary>`;
        html += '<table><tr><th>Name</th><th>Type</th></tr>';
        found.variables.forEach((variable) => {
          html += `<tr><td>${htmlEscape(variable.name)}</td><td class="uxv-type">${htmlEscape(variable.type)}</td></tr>`;
        });
        html += '</table></details>';
      }

      if (found.annotation) {
        html += `<div class="uxv-inspector-annotation">${htmlEscape(found.annotation)}</div>`;
      }

      if (found.screenshot) {
        html += `<details class="uxv-inspector-details" open><summary><h4>Screenshot</h4></summary>`;
        html += `<img class="uxv-inspector-screenshot" src="data:image/png;base64,${found.screenshot}" alt="UI Screenshot" loading="lazy" />`;
        html += `</details>`;
      }

      const selectorVal = found.properties?.Selector || found.properties?.selector || found.properties?.['Target.Selector'];
      if (selectorVal) {
        html += `<details class="uxv-inspector-details"><summary><h4>Selector</h4></summary>`;
        html += `<pre class="uxv-selector-preview">${htmlEscape(selectorVal)}</pre>`;
        html += `</details>`;
      }

      html += '</div>';

      const panel = viewer.querySelector('#uxv-panel');
      if (panel) {
        panel.querySelector('.uxv-inspector')?.remove();
        panel.insertAdjacentHTML('afterbegin', html);
        panel.scrollTop = 0;
        panel.querySelectorAll('.uxv-inspector table td:nth-child(2)').forEach((td) => {
          td.style.cursor = 'pointer';
          td.title = 'Click to copy';
          td.addEventListener('click', () => {
            navigator.clipboard?.writeText(td.textContent).then(() => {
              const orig = td.style.background;
              td.style.background = '#d4edda';
              setTimeout(() => { td.style.background = orig; }, 400);
            });
          });
        });
      }
    });
  }

  const BREADCRUMB_KEY = 'uxv_breadcrumb';

  function getBreadcrumbs() {
    try { return JSON.parse(sessionStorage.getItem(BREADCRUMB_KEY)) || []; } catch (_e) { return []; }
  }

  function setBreadcrumbs(crumbs) {
    try { sessionStorage.setItem(BREADCRUMB_KEY, JSON.stringify(crumbs.slice(-10))); } catch (_e) { /* quota */ }
  }

  function renderBreadcrumbs(viewer) {
    const crumbs = getBreadcrumbs();
    const existing = viewer.querySelector('.uxv-breadcrumbs');
    if (existing) existing.remove();
    if (crumbs.length === 0) return;

    const current = location.pathname;
    const relevant = [];
    for (const c of crumbs) {
      if (c.url === current) break;
      relevant.push(c);
    }
    if (relevant.length === 0) return;

    const nav = document.createElement('div');
    nav.className = 'uxv-breadcrumbs';
    nav.innerHTML = relevant.map((c) =>
      `<a href="${htmlEscape(c.url)}" class="uxv-breadcrumb-link" title="${htmlEscape(c.url)}">${htmlEscape(c.name)}</a>`
    ).join('<span class="uxv-breadcrumb-sep">›</span>') +
    `<span class="uxv-breadcrumb-sep">›</span><span class="uxv-breadcrumb-current">${htmlEscape(state.currentParsed.name || 'Workflow')}</span>`;

    const header = viewer.querySelector('.uxv-header');
    if (header) header.appendChild(nav);
  }

  function setupInvokeNavigation(viewer) {
    renderBreadcrumbs(viewer);

    viewer.addEventListener('dblclick', (event) => {
      const nodeEl = event.target.closest('.uxv-node');
      if (!nodeEl) return;
      const found = findById(state.currentParsed.tree, nodeEl.dataset.id);
      if (!found) return;
      if (found.type !== 'InvokeWorkflowFile' && found.activityType !== 'InvokeWorkflowFile') return;
      const workflowFile = found.properties?.WorkflowFileName;
      if (!workflowFile) return;

      const ctx = parsePageUrl();
      if (!ctx) return;

      const crumbs = getBreadcrumbs();
      crumbs.push({ name: state.currentParsed.name || 'Workflow', url: location.pathname });
      setBreadcrumbs(crumbs);

      const resolvedPath = resolveWorkflowPath(workflowFile, ctx.dir);
      const target = (UXV.platform.buildFileUrl?.(ctx, resolvedPath) || `/${ctx.owner}/${ctx.repo}/blob/${ctx.ref}/${resolvedPath}`) + '#uxv-auto';
      window.open(target, '_blank');
    });
  }

  function getInvokeCache(key) {
    try { return sessionStorage.getItem('uxv_inv_' + key); } catch { return null; }
  }
  function setInvokeCache(key, html) {
    try { sessionStorage.setItem('uxv_inv_' + key, html || ''); } catch { /* quota */ }
  }

  function setupInvokePreview(viewer) {
    let tooltip = null;
    let hideTimer = null;
    let currentHover = null;

    function show(el, html) {
      clearTimeout(hideTimer);
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'uxv-invoke-preview';
        viewer.appendChild(tooltip);
      }
      tooltip.innerHTML = html;
      const rect = el.getBoundingClientRect();
      const vRect = viewer.getBoundingClientRect();
      tooltip.style.left = (rect.right - vRect.left + 8) + 'px';
      tooltip.style.top = (rect.top - vRect.top) + 'px';
      tooltip.style.display = 'block';
    }

    function hide() {
      hideTimer = setTimeout(() => { if (tooltip) tooltip.style.display = 'none'; currentHover = null; }, 300);
    }

    viewer.addEventListener('mouseover', async (e) => {
      const nodeEl = e.target.closest('[data-id]');
      if (!nodeEl || !state.currentParsed) return;
      const found = findById(state.currentParsed.tree, nodeEl.dataset.id);
      if (!found) return;
      if (found.type !== 'InvokeWorkflowFile' && found.activityType !== 'InvokeWorkflowFile') return;
      const workflowFile = found.properties?.WorkflowFileName;
      if (!workflowFile) return;
      if (currentHover === nodeEl.dataset.id) return;
      currentHover = nodeEl.dataset.id;

      const ctx = parsePageUrl();
      if (!ctx) return;
      const dir = ctx.filePath.split('/').slice(0, -1).join('/');
      const resolved = resolveWorkflowPath(workflowFile, dir);
      const cacheKey = `${ctx.owner}/${ctx.repo}/${ctx.ref}/${resolved}`;

      const cached = getInvokeCache(cacheKey);
      if (cached !== null) {
        if (cached) show(nodeEl, cached);
        return;
      }

      const xaml = ctx.repo
        ? await window.UiPathFetch.fetchFileAtRef(ctx.owner, ctx.repo, ctx.ref, resolved)
        : await window.UiPathFetch.fetchFileAtRefGitLab(ctx.owner, ctx.ref, resolved);
      if (!xaml) { setInvokeCache(cacheKey, ''); return; }
      const parsed = window.UiPathParser.parse(xaml);
      if (parsed.error) { setInvokeCache(cacheKey, ''); return; }

      let previewHtml = `<strong>${htmlEscape(parsed.name || workflowFile)}</strong>`;
      previewHtml += ` <span class="uxv-badge">${htmlEscape(parsed.tree.type)}</span>`;
      if (parsed.arguments?.length > 0) {
        previewHtml += '<div class="uxv-invoke-args">';
        parsed.arguments.forEach((a) => { previewHtml += `<div>${htmlEscape(a.direction)} ${htmlEscape(a.name)} (${htmlEscape(a.type)})</div>`; });
        previewHtml += '</div>';
      }
      setInvokeCache(cacheKey, previewHtml);
      if (currentHover === nodeEl.dataset.id) show(nodeEl, previewHtml);
    });

    viewer.addEventListener('mouseout', (e) => {
      if (e.target.closest('[data-id]')) hide();
    });
  }

  function setupContextMenu(viewer) {
    viewer.addEventListener('contextmenu', (event) => {
      const nodeEl = event.target.closest('.uxv-node, .uxv-collapsed');
      if (!nodeEl) return;
      event.preventDefault();
      const found = findById(state.currentParsed.tree, nodeEl.dataset.id);
      if (!found) return;

      viewer.querySelector('.uxv-context-menu')?.remove();

      const items = [];
      const isInvoke = found.type === 'InvokeWorkflowFile' || found.activityType === 'InvokeWorkflowFile';
      if (isInvoke && found.properties?.WorkflowFileName) {
        items.push({ label: 'Open referenced workflow', icon: '→', action: () => {
          const ctx = parsePageUrl();
          if (!ctx) return;
          const crumbs = getBreadcrumbs();
          crumbs.push({ name: state.currentParsed.name || 'Workflow', url: location.pathname });
          setBreadcrumbs(crumbs);
          const resolvedPath = resolveWorkflowPath(found.properties.WorkflowFileName, ctx.dir);
          window.open(UXV.platform.buildFileUrl?.(ctx, resolvedPath) || `/${ctx.owner}/${ctx.repo}/blob/${ctx.ref}/${resolvedPath}`, '_blank');
        }});
      }
      items.push({ label: 'Copy activity name', icon: '⊡', action: () => {
        navigator.clipboard.writeText(found.displayName || found.type || '');
      }});
      items.push({ label: 'Copy permalink', icon: '#', action: () => {
        const url = location.origin + location.pathname + location.search + UXV.viewer.buildViewHash(nodeEl.dataset.id, state.panZoomCtrl?.getState());
        navigator.clipboard.writeText(url);
      }});
      const props = found.properties || {};
      if (Object.keys(props).length > 0) {
        items.push({ label: 'Copy properties as JSON', icon: '{}', action: () => {
          navigator.clipboard.writeText(JSON.stringify(props, null, 2));
        }});
      }

      const menu = document.createElement('div');
      menu.className = 'uxv-context-menu';
      menu.innerHTML = items.map((item) =>
        `<button class="uxv-context-item">${htmlEscape(item.icon)} ${htmlEscape(item.label)}</button>`
      ).join('');

      const rect = viewer.getBoundingClientRect();
      viewer.appendChild(menu);
      const menuW = menu.offsetWidth || 180;
      const menuH = menu.offsetHeight || 120;
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      menu.style.left = Math.min(rawX, rect.width - menuW - 4) + 'px';
      menu.style.top = Math.min(rawY, rect.height - menuH - 4) + 'px';

      menu.querySelectorAll('.uxv-context-item').forEach((btn, i) => {
        btn.addEventListener('click', () => { items[i].action(); menu.remove(); });
      });

      const dismiss = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', dismiss, true); } };
      setTimeout(() => document.addEventListener('click', dismiss, true), 0);
    });
  }

  function setupSearch(viewer) {
    const input = viewer.querySelector('#uxv-search');
    const countLabel = viewer.querySelector('#uxv-search-count');
    if (!input) return;

    let matches = [];
    let currentIndex = -1;

    function clearHighlights() {
      viewer.querySelectorAll('.uxv-search-match').forEach((el) => el.classList.remove('uxv-search-match'));
    }

    function applyHighlights() {
      clearHighlights();
      matches.forEach((match) => byDataId(viewer, match.id)?.classList.add('uxv-search-match'));
    }

    function scrollToMatch(index) {
      if (index < 0 || index >= matches.length || !state.panZoomCtrl) return;
      const target = byDataId(viewer, matches[index].id);
      if (!target || typeof target.getBBox !== 'function') return;
      const box = target.getBBox();
      state.panZoomCtrl.centerOn(box.x + box.width / 2 + CANVAS_PADDING, box.y + box.height / 2 + CANVAS_PADDING);
    }

    function doSearch() {
      const query = input.value.trim();
      if (!query) {
        clearHighlights();
        matches = [];
        currentIndex = -1;
        countLabel.textContent = '';
        return;
      }

      matches = findMatches(state.currentParsed.tree, query);
      currentIndex = matches.length > 0 ? 0 : -1;
      countLabel.textContent = matches.length === 0 ? 'No matches' : `1/${matches.length}`;
      let needsRerender = false;
      matches.forEach((match) => { if (expandAncestors(state.currentParsed.tree, match.id)) needsRerender = true; });
      if (needsRerender) {
        state.pendingSearchQuery = query;
        UXV.viewer.renderViewer();
        return;
      }
      applyHighlights();
      if (currentIndex >= 0) scrollToMatch(currentIndex);
    }

    let searchTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 150);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        input.value = '';
        state.pendingSearchQuery = '';
        doSearch();
        input.blur();
        return;
      }
      if (event.key === 'Enter' && matches.length > 0) {
        event.preventDefault();
        currentIndex = event.shiftKey
          ? (currentIndex - 1 + matches.length) % matches.length
          : (currentIndex + 1) % matches.length;
        countLabel.textContent = `${currentIndex + 1}/${matches.length}`;
        scrollToMatch(currentIndex);
      }
    });

    if (state.pendingSearchQuery) {
      input.value = state.pendingSearchQuery;
      state.pendingSearchQuery = '';
      doSearch();
      input.focus();
    }
  }

  function setupKeyboard(viewer) {
    document.addEventListener('keydown', (event) => {
      if (!state.isViewing || !state.panZoomCtrl) return;
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (event.key === 'Escape' && !isInput) {
        event.preventDefault();
        UXV.viewer.toggleViewer();
        return;
      }

      if (isInput) return;

      // Ctrl+K or Ctrl+F to focus search (/ is intercepted by GitHub)
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'f')) {
        event.preventDefault();
        event.stopPropagation();
        viewer.querySelector('#uxv-search')?.focus();
        return;
      }

      switch (event.key) {
        case '/':
          event.preventDefault();
          event.stopPropagation();
          viewer.querySelector('#uxv-search')?.focus();
          break;
        case '+':
        case '=':
          event.preventDefault();
          state.panZoomCtrl.zoomIn();
          break;
        case '-':
          event.preventDefault();
          state.panZoomCtrl.zoomOut();
          break;
        case '0':
          event.preventDefault();
          state.panZoomCtrl.fitToView();
          break;
        case 'ArrowUp':
          event.preventDefault();
          state.panZoomCtrl.pan(0, 50);
          break;
        case 'ArrowDown':
          event.preventDefault();
          state.panZoomCtrl.pan(0, -50);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          state.panZoomCtrl.pan(50, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          state.panZoomCtrl.pan(-50, 0);
          break;
        case '?':
          event.preventDefault();
          toggleShortcutHelp(viewer);
          break;
        case 'n':
        case 'p':
          event.preventDefault();
          navigateActivity(viewer, event.key === 'n' ? 1 : -1);
          break;
        case 'b': {
          const sel = viewer.querySelector('.uxv-selected');
          if (sel?.dataset.id && viewer._addBookmark) {
            event.preventDefault();
            viewer._addBookmark(sel.dataset.id);
          }
          break;
        }
        case 'Enter': {
          const selected = viewer.querySelector('.uxv-selected');
          if (selected) {
            const toggle = selected.querySelector('[data-toggle]');
            if (toggle) { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
          }
          break;
        }
      }
    }, { signal: state.viewerAc?.signal });
  }

  function navigateActivity(viewer, direction) {
    const svg = viewer.querySelector('svg');
    if (!svg) return;
    const nodes = Array.from(svg.querySelectorAll('[data-id]'));
    if (!nodes.length) return;
    const current = viewer.querySelector('.uxv-selected');
    const currentIdx = current ? nodes.indexOf(current) : -1;
    const nextIdx = direction > 0
      ? Math.min(currentIdx + 1, nodes.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx === currentIdx && currentIdx >= 0) return;
    nodes[nextIdx].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function toggleShortcutHelp(viewer) {
    const existing = viewer.querySelector('.uxv-shortcut-overlay');
    if (existing) { existing.remove(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'uxv-shortcut-overlay';
    overlay.innerHTML = `<div class="uxv-shortcut-dialog">
      <div class="uxv-shortcut-header"><strong>Keyboard Shortcuts</strong><button class="uxv-shortcut-close" title="Close">&times;</button></div>
      <table class="uxv-shortcut-table">
        <tr><td><kbd>/</kbd> or <kbd>Ctrl+K</kbd></td><td>Search activities</td></tr>
        <tr><td><kbd>Enter</kbd> / <kbd>Shift+Enter</kbd></td><td>Next / previous match</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Close viewer or search</td></tr>
        <tr><td><kbd>+</kbd> / <kbd>-</kbd></td><td>Zoom in / out</td></tr>
        <tr><td><kbd>0</kbd></td><td>Fit to view</td></tr>
        <tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Pan diagram</td></tr>
        <tr><td><kbd>n</kbd> / <kbd>p</kbd></td><td>Next / previous activity</td></tr>
        <tr><td><kbd>Enter</kbd></td><td>Expand / collapse selected</td></tr>
        <tr><td><kbd>b</kbd></td><td>Bookmark selected activity</td></tr>
        <tr><td><kbd>?</kbd></td><td>Toggle this help</td></tr>
      </table>
      <div class="uxv-shortcut-tip">Double-click <em>InvokeWorkflowFile</em> to navigate &bull; Click variable name to highlight references &bull; ☀ toggles dark mode</div>
    </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.uxv-shortcut-close')) overlay.remove();
    });
    viewer.appendChild(overlay);
  }

  function setupPanelResize(viewer) {
    const resizer = viewer.querySelector('#uxv-panel-resizer');
    const panel = viewer.querySelector('#uxv-panel');
    if (!resizer || !panel) return;

    let startX, startW, dragAc;
    function onMouseMove(e) {
      const dx = startX - e.clientX;
      panel.style.width = Math.max(180, startW + dx) + 'px';
    }
    function onMouseUp() {
      resizer.classList.remove('uxv-resizing');
      if (dragAc) { dragAc.abort(); dragAc = null; }
    }
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = panel.offsetWidth;
      resizer.classList.add('uxv-resizing');
      if (dragAc) dragAc.abort();
      dragAc = new AbortController();
      document.addEventListener('mousemove', onMouseMove, { signal: dragAc.signal });
      document.addEventListener('mouseup', onMouseUp, { signal: dragAc.signal });
    });
    if (state.viewerAc) state.viewerAc.signal.addEventListener('abort', () => { if (dragAc) dragAc.abort(); });
  }

  function setupMinimap(viewer) {
    const svg = viewer.querySelector('#uxv-canvas svg');
    const content = viewer.querySelector('#uxv-minimap-content');
    if (!svg || !content) return;

    const clone = svg.cloneNode(true);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.removeAttribute('role');
    clone.removeAttribute('aria-label');
    content.appendChild(clone);

    const minimap = viewer.querySelector('#uxv-minimap');
    const closeBtn = viewer.querySelector('#uxv-minimap-close');
    const restoreBtn = viewer.querySelector('#uxv-minimap-restore');

    const hidden = sessionStorage.getItem('uxv_minimap_hidden') === 'true';
    if (hidden) {
      minimap.style.display = 'none';
      restoreBtn.style.display = '';
    } else {
      restoreBtn.style.display = 'none';
    }

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      minimap.style.display = 'none';
      restoreBtn.style.display = '';
      sessionStorage.setItem('uxv_minimap_hidden', 'true');
    });

    restoreBtn.addEventListener('click', () => {
      minimap.style.display = '';
      restoreBtn.style.display = 'none';
      sessionStorage.setItem('uxv_minimap_hidden', 'false');
    });

    minimap.addEventListener('click', (e) => {
      if (e.target === closeBtn) return;
      if (!state.panZoomCtrl) return;
      const svgW = parseFloat(svg.getAttribute('width')) || 800;
      const svgH = parseFloat(svg.getAttribute('height')) || 600;
      const rect = minimap.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / rect.width * svgW;
      const clickY = (e.clientY - rect.top) / rect.height * svgH;
      state.panZoomCtrl.centerOn(clickX, clickY);
    });
  }

  function updateMinimap(viewer, viewState) {
    const vp = viewer.querySelector('#uxv-minimap-viewport');
    const svg = viewer.querySelector('#uxv-canvas svg');
    const wrap = viewer.querySelector('#uxv-canvas-wrap');
    if (!vp || !svg || !wrap) return;

    const svgW = parseFloat(svg.getAttribute('width')) || 800;
    const svgH = parseFloat(svg.getAttribute('height')) || 600;
    const wrapRect = wrap.getBoundingClientRect();

    const vpLeft = (-viewState.tx / viewState.scale) / svgW * 100;
    const vpTop = (-viewState.ty / viewState.scale) / svgH * 100;
    const vpWidth = (wrapRect.width / viewState.scale) / svgW * 100;
    const vpHeight = (wrapRect.height / viewState.scale) / svgH * 100;

    vp.style.left = Math.max(0, vpLeft) + '%';
    vp.style.top = Math.max(0, vpTop) + '%';
    vp.style.width = Math.min(100, vpWidth) + '%';
    vp.style.height = Math.min(100, vpHeight) + '%';
  }

  function setupScreenshotPreview(viewer) {
    let tooltip = null;
    let hideTimer = null;

    function show(el, screenshot) {
      clearTimeout(hideTimer);
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'uxv-screenshot-tooltip';
        viewer.appendChild(tooltip);
      }
      tooltip.innerHTML = `<img src="data:image/png;base64,${screenshot}" alt="Screenshot preview" />`;
      const rect = el.getBoundingClientRect();
      const vRect = viewer.getBoundingClientRect();
      tooltip.style.left = (rect.right - vRect.left + 8) + 'px';
      tooltip.style.top = (rect.top - vRect.top) + 'px';
      tooltip.style.display = 'block';
    }

    function hide() {
      hideTimer = setTimeout(() => { if (tooltip) tooltip.style.display = 'none'; }, 200);
    }

    viewer.addEventListener('mouseover', (e) => {
      const nodeEl = e.target.closest('[data-id]');
      if (!nodeEl || !state.currentParsed) return;
      const found = findById(state.currentParsed.tree, nodeEl.dataset.id);
      if (found?.screenshot) show(nodeEl, found.screenshot);
    });

    viewer.addEventListener('mouseout', (e) => {
      const nodeEl = e.target.closest('[data-id]');
      if (nodeEl) hide();
    });
  }

  function setupVariableHighlight(viewer) {
    const panel = viewer.querySelector('#uxv-panel');
    if (!panel) return;
    panel.addEventListener('click', (e) => {
      const varCell = e.target.closest('[data-varname]');
      if (!varCell || !state.currentParsed) return;
      const varName = varCell.dataset.varname;
      const svg = viewer.querySelector('svg');
      if (!svg) return;

      svg.querySelectorAll('.uxv-var-highlight').forEach((el) => el.classList.remove('uxv-var-highlight'));

      const refs = [];
      function findRefs(node) {
        if (!node) return;
        const props = JSON.stringify(node.properties || {});
        if (props.includes(varName)) refs.push(node.id);
        (node.children || []).forEach(findRefs);
        (node.flowNodes || []).forEach((fn) => { findRefs(fn); if (fn.innerActivity) findRefs(fn.innerActivity); });
        (node.stateNodes || []).forEach((sn) => { findRefs(sn); if (sn.entryNode) findRefs(sn.entryNode); });
      }
      findRefs(state.currentParsed.tree);

      refs.forEach((id) => {
        const el = byDataId(svg, id);
        if (el) el.classList.add('uxv-var-highlight');
      });

      if (refs.length > 0 && state.panZoomCtrl) {
        const first = byDataId(svg, refs[0]);
        if (first && typeof first.getBBox === 'function') {
          const box = first.getBBox();
          state.panZoomCtrl.centerOn(box.x + box.width / 2 + CANVAS_PADDING, box.y + box.height / 2 + CANVAS_PADDING);
        }
      }

      if (varCell.classList.contains('uxv-var-active')) {
        svg.querySelectorAll('.uxv-var-highlight').forEach((el) => el.classList.remove('uxv-var-highlight'));
        panel.querySelectorAll('.uxv-var-active').forEach((el) => el.classList.remove('uxv-var-active'));
      } else {
        panel.querySelectorAll('.uxv-var-active').forEach((el) => el.classList.remove('uxv-var-active'));
        varCell.classList.add('uxv-var-active');
      }
    });
  }

  function bookmarkKey() { return 'uxv_pins_' + location.pathname; }

  function getBookmarks() {
    try { return JSON.parse(sessionStorage.getItem(bookmarkKey())) || []; } catch { return []; }
  }

  function setBookmarks(pins) {
    try { sessionStorage.setItem(bookmarkKey(), JSON.stringify(pins.slice(-20))); } catch { /* quota */ }
  }

  function toggleBookmark(nodeId) {
    const pins = getBookmarks();
    const idx = pins.indexOf(nodeId);
    if (idx >= 0) pins.splice(idx, 1);
    else pins.push(nodeId);
    setBookmarks(pins);
    return pins;
  }

  function setupBookmarks(viewer) {
    const panel = viewer.querySelector('#uxv-panel');
    if (!panel) return;

    function renderBookmarkList() {
      panel.querySelector('.uxv-bookmarks')?.remove();
      const pins = getBookmarks();
      if (pins.length === 0) return;
      let html = '<details class="uxv-panel-section uxv-bookmarks" open><summary><h4>Bookmarks (' + pins.length + ')</h4></summary><div class="uxv-bookmark-list">';
      pins.forEach((id) => {
        const node = findById(state.currentParsed?.tree, id);
        const name = node ? htmlEscape(node.displayName || node.type) : htmlEscape(id);
        html += `<div class="uxv-bookmark-item" data-pin-id="${htmlEscape(id)}"><span class="uxv-bookmark-name">${name}</span><button class="uxv-bookmark-remove" title="Remove">×</button></div>`;
      });
      html += '</div></details>';
      panel.insertAdjacentHTML('afterbegin', html);

      panel.querySelectorAll('.uxv-bookmark-item').forEach((item) => {
        item.querySelector('.uxv-bookmark-name')?.addEventListener('click', () => {
          const id = item.dataset.pinId;
          const svg = viewer.querySelector('svg');
          const el = svg && byDataId(svg, id);
          if (el && state.panZoomCtrl && typeof el.getBBox === 'function') {
            const box = el.getBBox();
            state.panZoomCtrl.centerOn(box.x + box.width / 2 + CANVAS_PADDING, box.y + box.height / 2 + CANVAS_PADDING);
            viewer.querySelectorAll('.uxv-selected').forEach((s) => s.classList.remove('uxv-selected'));
            el.classList.add('uxv-selected');
          }
        });
        item.querySelector('.uxv-bookmark-remove')?.addEventListener('click', () => {
          toggleBookmark(item.dataset.pinId);
          renderBookmarkList();
        });
      });
    }

    renderBookmarkList();

    viewer._addBookmark = (nodeId) => {
      toggleBookmark(nodeId);
      renderBookmarkList();
    };
  }

  function setupOutlineFilter(viewer) {
    const input = viewer.querySelector('#uxv-outline-filter');
    const content = viewer.querySelector('#uxv-outline-content');
    if (!input || !content) return;
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const query = input.value.trim().toLowerCase();
        content.querySelectorAll('.uxv-ol-row').forEach((row) => {
          if (!query) { row.style.display = ''; return; }
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
      }, 100);
    });
  }

  // Expose on UXV namespace
  UXV.interactions = {
    setupInteractions,
    setupCollapse,
    setupInspector,
    setupSearch,
    setupKeyboard,
    navigateActivity,
    toggleShortcutHelp,
    setupContextMenu,
    setupInvokeNavigation,
    setupInvokePreview,
    renderBreadcrumbs,
    getBreadcrumbs,
    setBreadcrumbs,
    resolveWorkflowPath,
    setupPanelResize,
    setupMinimap,
    updateMinimap,
    setupScreenshotPreview,
    setupVariableHighlight,
    setupBookmarks,
    setupOutlineFilter,
  };
})();
