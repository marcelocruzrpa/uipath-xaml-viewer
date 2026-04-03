/**
 * UiPath XAML Visualizer — Viewer lifecycle and rendering module.
 * Handles viewer toggle, rendering, outline, export, hash navigation, and branch compare.
 */
(() => {
  const UXV = window.UXV;
  const state = UXV.state;
  const htmlEscape = UXV.htmlEscape;
  const findById = UXV.findById;
  const byDataId = UXV.byDataId;
  const parseGitHubUrl = UXV.parseGitHubUrl;
  const BUTTON_ID = UXV.BUTTON_ID;
  const VIEWER_ID = UXV.VIEWER_ID;
  const CANVAS_PADDING = UXV.CANVAS_PADDING;

  // Search functions from content-search.js module
  const expandAncestors = window.UiPathSearch.expandAncestors;

  function resetBtn(btn) {
    if (!btn) return;
    btn.innerHTML = UXV.github.svgIcon('chart') + ' Visualize XAML';
    btn.disabled = false;
    btn.classList.remove('uxv-btn-active');
  }

  function cleanupViewerState() {
    document.getElementById(VIEWER_ID)?.remove();
    UXV.github.showCode(true);
    if (state.panZoomCtrl) {
      state.panZoomCtrl.ac.abort();
      state.panZoomCtrl = null;
    }
    if (state.viewerAc) {
      state.viewerAc.abort();
      state.viewerAc = null;
    }
    state.isViewing = false;
    state.currentParsed = null;
    state.pendingSearchQuery = '';
    state.themeOverride = null;
    if (location.hash.startsWith('#uxv-')) history.replaceState(null, '', location.pathname + location.search);
  }

  function parseViewHash(hash) {
    if (!hash || !hash.startsWith('#uxv-')) return null;
    const raw = hash.slice(5);
    const parts = raw.split(';');
    const nodeId = decodeURIComponent(parts[0]);
    const params = {};
    for (let i = 1; i < parts.length; i++) {
      const [k, v] = parts[i].split('=');
      if (k && v !== undefined) params[k] = v;
    }
    return { nodeId: nodeId || null, zoom: parseFloat(params.z) || null, tx: parseFloat(params.x) || null, ty: parseFloat(params.y) || null };
  }

  function buildViewHash(nodeId, pzState) {
    let hash = '#uxv-' + (nodeId ? encodeURIComponent(nodeId) : '');
    if (pzState) {
      hash += `;z=${pzState.scale.toFixed(3)};x=${Math.round(pzState.tx)};y=${Math.round(pzState.ty)}`;
    }
    return hash;
  }

  function navigateToHash() {
    const parsed = parseViewHash(location.hash);
    if (!parsed || !state.currentParsed || !state.panZoomCtrl) return;

    if (parsed.zoom && parsed.tx !== null && parsed.ty !== null) {
      state.panZoomCtrl.apply({ scale: parsed.zoom, tx: parsed.tx, ty: parsed.ty });
    }

    if (!parsed.nodeId) return;
    const node = findById(state.currentParsed.tree, parsed.nodeId);
    if (!node) return;
    if (expandAncestors(state.currentParsed.tree, parsed.nodeId)) {
      renderViewer();
    }
    const viewer = document.getElementById(VIEWER_ID);
    if (!viewer) return;
    const el = byDataId(viewer, parsed.nodeId);
    if (!el) return;
    viewer.querySelectorAll('.uxv-selected').forEach((s) => s.classList.remove('uxv-selected'));
    el.classList.add('uxv-selected');
    el.classList.add('uxv-search-match');
    if (!parsed.zoom && typeof el.getBBox === 'function' && state.panZoomCtrl) {
      const box = el.getBBox();
      state.panZoomCtrl.centerOn(box.x + box.width / 2 + CANVAS_PADDING, box.y + box.height / 2 + CANVAS_PADDING);
    }
  }

  function renderMessageViewer(title, message, tone = 'error') {
    document.getElementById(VIEWER_ID)?.remove();
    const viewer = document.createElement('div');
    viewer.id = VIEWER_ID;
    viewer.innerHTML = `
      <div class="uxv-header">
        <div class="uxv-title"><span class="uxv-logo">◈</span><strong>${htmlEscape(title)}</strong></div>
      </div>
      <div class="uxv-status uxv-status-${tone}">
        <strong>${htmlEscape(title)}</strong>
        <div>${htmlEscape(message)}</div>
      </div>`;
    const codeEl = UXV.github.findCode();
    const parent = codeEl?.parentElement || document.querySelector('main');
    if (parent) {
      if (codeEl) codeEl.parentElement.insertBefore(viewer, codeEl.nextSibling);
      else parent.appendChild(viewer);
    }
    return viewer;
  }

  function detectTemplate(parsed) {
    const tree = parsed.tree;
    if (tree.type === 'StateMachine') {
      const names = (tree.stateNodes || []).map((s) => (s.displayName || '').toLowerCase());
      if (names.some((n) => n.includes('init')) && names.some((n) => n.includes('transaction'))) return 'REFramework';
    }
    const str = JSON.stringify(parsed).toLowerCase();
    if (str.includes('addqueueitem')) return 'Dispatcher';
    if (str.includes('gettransactionitem') || str.includes('settransactionstatus')) return 'Performer';
    return null;
  }

  function collapseStorageKey() {
    return 'uxv_collapse_' + location.pathname;
  }

  function saveCollapseState(tree) {
    const map = {};
    function walk(node) {
      if (!node) return;
      if (node.collapsed) map[node.id] = true;
      (node.children || []).forEach(walk);
      (node.flowNodes || []).forEach((fn) => { walk(fn); walk(fn.innerActivity); });
      (node.stateNodes || []).forEach((sn) => { walk(sn); walk(sn.entryNode); });
    }
    walk(tree);
    try { sessionStorage.setItem(collapseStorageKey(), JSON.stringify(map)); } catch (_e) { /* quota */ }
  }

  function restoreCollapseState(tree) {
    let map;
    try { map = JSON.parse(sessionStorage.getItem(collapseStorageKey())); } catch (_e) { return; }
    if (!map) return;
    function walk(node) {
      if (!node) return;
      if (map[node.id]) node.collapsed = true;
      (node.children || []).forEach(walk);
      (node.flowNodes || []).forEach((fn) => { walk(fn); walk(fn.innerActivity); });
      (node.stateNodes || []).forEach((sn) => { walk(sn); walk(sn.entryNode); });
    }
    walk(tree);
  }

  function collectCollapseMap(tree) {
    const map = {};
    function walk(node) {
      if (!node) return;
      if (node.collapsed) map[node.id] = true;
      (node.children || []).forEach(walk);
      (node.flowNodes || []).forEach((fn) => { if (fn.collapsed) map[fn.id] = true; walk(fn.innerActivity); });
      (node.stateNodes || []).forEach((sn) => { if (sn.collapsed) map[sn.id] = true; walk(sn.entryNode); });
    }
    walk(tree);
    return map;
  }

  function restoreCollapseMap(tree, map) {
    function walk(node) {
      if (!node) return;
      node.collapsed = !!map[node.id];
      (node.children || []).forEach(walk);
      (node.flowNodes || []).forEach((fn) => { fn.collapsed = !!map[fn.id]; walk(fn.innerActivity); });
      (node.stateNodes || []).forEach((sn) => { sn.collapsed = !!map[sn.id]; walk(sn.entryNode); });
    }
    walk(tree);
  }

  function setAll(node, collapsed) {
    if (node.children && node.children.length > 0 && !node.type.startsWith('§')) node.collapsed = collapsed;
    (node.children || []).forEach((child) => setAll(child, collapsed));
    for (const sn of node.stateNodes || []) {
      if (sn.entryNode) {
        sn.collapsed = collapsed;
        setAll(sn.entryNode, collapsed);
      }
    }
  }

  function renderOutlineHtml(tree) {
    const COLORS = window.UiPathRenderer.COLORS;
    let lineNum = 0;
    function inlineProps(node) {
      const parts = [];
      const p = node.properties || {};
      if (p.WorkflowFileName) parts.push(p.WorkflowFileName);
      if (p.Application) parts.push(p.Application);
      if (p.Url) parts.push(p.Url);
      if (p['Target.Selector']) parts.push(p['Target.Selector']);
      if (p['Target.Application']) parts.push(p['Target.Application']);
      if (p.Selector) parts.push(p.Selector);
      if (p.Message) parts.push(p.Message);
      if (p.Value) parts.push(p.Value);
      if (p.Condition) parts.push(p.Condition);
      if (p.Expression) parts.push(p.Expression);
      if (p.Level) parts.push(p.Level);
      if (p.DataTable) parts.push(p.DataTable);
      return parts;
    }
    function renderNode(node, depth) {
      if (!node || (node.type || '').startsWith('§')) return '';
      lineNum++;
      const color = COLORS[node.category] || COLORS.default;
      const props = inlineProps(node);
      const propsHtml = props.map((v) => `<span class="uxv-ol-prop">${htmlEscape(String(v).slice(0, 80))}</span>`).join(' ');
      const hasChildren = (node.children?.length > 0) || (node.flowNodes?.length > 0) || (node.stateNodes?.length > 0);
      let html = `<div class="uxv-ol-row" data-id="${node.id}" data-category="${node.category}" style="--depth:${depth}">`;
      html += `<span class="uxv-ol-num">${lineNum}</span>`;
      html += `<span class="uxv-ol-indent">`;
      for (let i = 0; i < depth; i++) html += `<span class="uxv-ol-pipe"></span>`;
      html += `</span>`;
      html += `<span class="uxv-ol-tag" style="background:${color.bg};color:${color.text};border-color:${color.border}">${htmlEscape(node.displayName)}</span>`;
      if (propsHtml) html += ` ${propsHtml}`;
      html += `</div>`;
      if (hasChildren && !node.collapsed) {
        (node.children || []).forEach((c) => { html += renderNode(c, depth + 1); });
        (node.flowNodes || []).forEach((fn) => {
          html += renderNode(fn, depth + 1);
          if (fn.innerActivity) html += renderNode(fn.innerActivity, depth + 2);
        });
        (node.stateNodes || []).forEach((sn) => {
          html += renderNode(sn, depth + 1);
          if (sn.entryNode) html += renderNode(sn.entryNode, depth + 2);
        });
      }
      return html;
    }
    return `<div class="uxv-outline">${renderNode(tree, 0)}</div>`;
  }

  function exportSvg() { window.UiPathExport.exportSvg('#uxv-canvas', state.currentParsed?.name); }
  function exportPng() { window.UiPathExport.exportPng('#uxv-canvas', state.currentParsed?.name); }

  function exportPrint() {
    const parsed = state.currentParsed;
    if (!parsed) return;

    const svgPrepared = window.UiPathExport.prepareSvgForExport(document.querySelector('#uxv-canvas'));
    const svgHtml = svgPrepared ? new XMLSerializer().serializeToString(svgPrepared.clone) : '';

    const savedTree = JSON.stringify(collectCollapseMap(parsed.tree));
    setAll(parsed.tree, false);
    const outlineHtml = renderOutlineHtml(parsed.tree);
    restoreCollapseMap(parsed.tree, JSON.parse(savedTree));

    const COLORS = window.UiPathRenderer.COLORS;

    let argsHtml = '';
    if (parsed.arguments?.length > 0) {
      argsHtml = `<h2>Arguments (${parsed.arguments.length})</h2><table><tr><th>Direction</th><th>Name</th><th>Type</th></tr>`;
      parsed.arguments.forEach((a) => { argsHtml += `<tr><td>${htmlEscape(a.direction)}</td><td>${htmlEscape(a.name)}</td><td>${htmlEscape(a.type)}</td></tr>`; });
      argsHtml += '</table>';
    }

    const allVars = [];
    function collectVars(node, scope) {
      if (node.variables) node.variables.forEach((v) => allVars.push({ ...v, scope: scope || node.displayName }));
      (node.children || []).forEach((c) => collectVars(c, c.displayName));
      (node.flowNodes || []).forEach((fn) => { if (fn.innerActivity) collectVars(fn.innerActivity, fn.displayName); });
      (node.stateNodes || []).forEach((sn) => { if (sn.entryNode) collectVars(sn.entryNode, sn.displayName); });
    }
    collectVars(parsed.tree, parsed.tree.displayName);
    let varsHtml = '';
    if (allVars.length > 0) {
      varsHtml = `<h2>Variables (${allVars.length})</h2><table><tr><th>Name</th><th>Type</th><th>Scope</th></tr>`;
      allVars.forEach((v) => { varsHtml += `<tr><td>${htmlEscape(v.name)}</td><td>${htmlEscape(v.type)}</td><td title="${htmlEscape(v.scope)}">${htmlEscape(v.scope)}</td></tr>`; });
      varsHtml += '</table>';
    }

    let summaryHtml = '<h2>Activity Summary</h2><table><tr><th>Category</th><th>Count</th></tr>';
    const cats = new Map();
    function countCats(node) {
      if (!node) return;
      if (node.type && !node.type.startsWith('§')) cats.set(node.category || 'default', (cats.get(node.category || 'default') || 0) + 1);
      (node.children || []).forEach(countCats);
      (node.flowNodes || []).forEach((fn) => { cats.set(fn.category || 'default', (cats.get(fn.category || 'default') || 0) + 1); if (fn.innerActivity) countCats(fn.innerActivity); });
      (node.stateNodes || []).forEach((sn) => { cats.set(sn.category || 'default', (cats.get(sn.category || 'default') || 0) + 1); if (sn.entryNode) countCats(sn.entryNode); });
    }
    countCats(parsed.tree);
    [...cats.entries()].sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      const c = COLORS[cat] || COLORS.default;
      summaryHtml += `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c.border};margin-right:6px;vertical-align:middle"></span>${htmlEscape(cat)}</td><td>${count}</td></tr>`;
    });
    summaryHtml += `</table>`;

    const ctx = parseGitHubUrl();
    const filePath = ctx ? ctx.filePath : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${htmlEscape(parsed.name || 'Workflow')} - UiPath Workflow</title>
<style>
  @page { margin: 1.2cm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #24292f; max-width: 1000px; margin: 0 auto; padding: 16px; font-size: 12px; }
  h1 { font-size: 18px; margin-bottom: 2px; }
  h2 { font-size: 13px; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #d1d5da; page-break-after: avoid; }
  .meta { color: #656d76; font-size: 11px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; page-break-inside: avoid; }
  th, td { padding: 3px 6px; text-align: left; border: 1px solid #d1d5da; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) td { background: #f9fafb; }
  .diagram { margin: 8px 0; page-break-inside: avoid; text-align: center; }
  .diagram svg { max-width: 100%; height: auto; }
  .two-col { display: flex; gap: 16px; }
  .two-col > div { flex: 1; min-width: 0; }
  .uxv-outline { font-family: "SF Mono", Consolas, monospace; font-size: 10px; line-height: 1.5; }
  .uxv-ol-row { white-space: nowrap; page-break-inside: avoid; }
  .uxv-ol-num { display: inline-block; width: 24px; color: #656d76; text-align: right; margin-right: 6px; }
  .uxv-ol-pipe { display: inline-block; width: 14px; border-left: 1px solid #d1d5da; margin-left: 3px; }
  .uxv-ol-tag { display: inline-block; padding: 0 4px; border-radius: 2px; font-size: 10px; border: 1px solid; }
  .uxv-ol-prop { color: #656d76; font-size: 9px; margin-left: 3px; }
  .footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #d1d5da; font-size: 9px; color: #656d76; }
</style>
</head><body>
<h1>${htmlEscape(parsed.name || 'Workflow')}</h1>
<p class="meta">${htmlEscape(parsed.tree.type)}${filePath ? ' | ' + htmlEscape(filePath) : ''}</p>
${argsHtml}
<div class="two-col"><div>${varsHtml}</div><div>${summaryHtml}</div></div>
<h2>Workflow Diagram</h2>
<div class="diagram">${svgHtml}</div>
<h2>Activity Outline</h2>
${outlineHtml}
<div class="footer">Generated by UiPath XAML Visualizer for GitHub</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;width:1000px;height:800px;border:none';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
      setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 1000);
      }, 500);
    }
  }

  async function showBranchCompare(viewer) {
    const ctx = parseGitHubUrl();
    if (!ctx) return;
    const branch = prompt('Enter branch name to compare against (e.g. main, develop):');
    if (!branch || !branch.trim()) return;
    const branchRef = branch.trim();

    const canvas = viewer.querySelector('#uxv-canvas');
    if (!canvas) return;
    canvas.innerHTML = '<div class="uxv-status-info" style="padding:20px;text-align:center"><span class="uxv-spinner"></span> Fetching branch version...</div>';

    try {
      const otherXaml = await window.UiPathFetch.fetchFileAtRef(ctx.owner, ctx.repo, branchRef, ctx.filePath);
      if (!otherXaml) { canvas.innerHTML = '<div class="uxv-status-error" style="padding:20px">Could not fetch file from branch "' + htmlEscape(branchRef) + '".</div>'; return; }
      const otherParsed = window.UiPathParser.parse(otherXaml);
      if (otherParsed.error) { canvas.innerHTML = '<div class="uxv-status-error" style="padding:20px">' + htmlEscape(otherParsed.error) + '</div>'; return; }

      const diffResult = window.UiPathDiff.diffTrees(otherParsed.tree, state.currentParsed.tree);
      if (!diffResult) { canvas.innerHTML = '<div class="uxv-status-info" style="padding:20px">No differences found.</div>'; return; }

      const counts = window.UiPathDiff.countChanges(diffResult);

      // Render both sides for side-by-side diff
      const baseRendered = window.UiPathRenderer.render({ ...otherParsed, name: branchRef });
      const headRendered = window.UiPathRenderer.render({ ...state.currentParsed, tree: diffResult });

      canvas.innerHTML = `<div style="padding:8px 12px;font-size:12px;background:var(--bgColor-muted,#f6f8fa);border-bottom:1px solid var(--borderColor-default,#d1d5da)">
        Comparing <strong>${htmlEscape(branchRef)}</strong> (base) vs <strong>${htmlEscape(ctx.ref)}</strong> (current):
        <span style="color:#2DA44E;font-weight:600">+${counts.added}</span>
        <span style="color:#BF8700;font-weight:600">~${counts.modified}</span>
        <span style="color:#CF222E;font-weight:600">-${counts.removed}</span>
      </div>
      <div class="uxv-diff-side-by-side">
        <div class="uxv-diff-pane">
          <div class="uxv-diff-pane-label">${htmlEscape(branchRef)} (base)</div>
          <div class="uxv-diff-pane-content">${baseRendered.svgContent}</div>
        </div>
        <div class="uxv-diff-pane">
          <div class="uxv-diff-pane-label">${htmlEscape(ctx.ref)} (current)</div>
          <div class="uxv-diff-pane-content">${headRendered.svgContent}</div>
        </div>
      </div>`;
    } catch (err) {
      canvas.innerHTML = '<div class="uxv-status-error" style="padding:20px">' + htmlEscape(err.message || 'Compare failed.') + '</div>';
    }
  }

  function renderViewer() {
    const previous = document.getElementById(VIEWER_ID);
    let priorState = null;
    if (previous && state.panZoomCtrl) priorState = state.panZoomCtrl.getState();
    if (!state.themeOverride) state.themeOverride = previous?.getAttribute('data-uxv-theme') || null;
    previous?.remove();
    if (state.viewerAc) state.viewerAc.abort();
    state.viewerAc = new AbortController();

    const viewer = document.createElement('div');
    viewer.id = VIEWER_ID;
    viewer.setAttribute('tabindex', '0');
    if (state.themeOverride) viewer.setAttribute('data-uxv-theme', state.themeOverride);
    document.body.appendChild(viewer);

    const rendered = window.UiPathRenderer.render(state.currentParsed);
    if (typeof rendered === 'string') {
      viewer.remove();
      renderMessageViewer('UiPath XAML Visualizer', rendered, 'warning');
      return;
    }
    viewer.innerHTML = `
      <div class="uxv-header">
        <div class="uxv-title">
          <span class="uxv-logo">◈</span>
          <strong>${htmlEscape(state.currentParsed.name || 'Workflow')}</strong>
          <span class="uxv-badge">${htmlEscape(state.currentParsed.tree.type)}</span>
          ${(() => { const t = detectTemplate(state.currentParsed); return t ? `<span class="uxv-badge uxv-badge-template">${htmlEscape(t)}</span>` : ''; })()}
        </div>
        <div class="uxv-toolbar">
          <button class="uxv-tool-btn uxv-tool-label${state.viewMode === 'diagram' ? ' uxv-tool-active' : ''}" id="uxv-diagram-toggle" title="Diagram view — nested tree layout">Diagram</button>
          <button class="uxv-tool-btn uxv-tool-label${state.viewMode === 'outline' ? ' uxv-tool-active' : ''}" id="uxv-view-toggle" title="Outline view — compact text list">Outline</button>
          <button class="uxv-tool-btn uxv-tool-label${state.viewMode === 'flowchart' ? ' uxv-tool-active' : ''}" id="uxv-flowchart-toggle" title="Flowchart view — graph layout with edges">Graph</button>
          <span class="uxv-toolbar-sep">|</span>
          <button class="uxv-tool-btn uxv-tool-label" id="uxv-collapse-all" title="Collapse all containers">Collapse</button>
          <button class="uxv-tool-btn uxv-tool-label" id="uxv-expand-all" title="Expand all containers">Expand</button>
          <span class="uxv-toolbar-sep">|</span>
          <input type="text" id="uxv-search" class="uxv-search-input" placeholder="Search activities..." autocomplete="off" />
          <span class="uxv-search-count" id="uxv-search-count"></span>
          <span class="uxv-toolbar-sep">|</span>
          <button class="uxv-tool-btn" id="uxv-zoom-in" title="Zoom in">+</button>
          <button class="uxv-tool-btn" id="uxv-zoom-out" title="Zoom out">-</button>
          <button class="uxv-tool-btn" id="uxv-zoom-fit" title="Fit to view">⊡</button>
          <span class="uxv-zoom-label" id="uxv-zoom-label">100%</span>
          <span class="uxv-toolbar-sep">|</span>
          <div class="uxv-export-wrap" id="uxv-export-wrap">
            <button class="uxv-tool-btn uxv-export-btn" id="uxv-export-btn" title="Export">Export ▾</button>
            <div class="uxv-export-dropdown" id="uxv-export-dropdown">
              <button class="uxv-export-item" id="uxv-export-svg">SVG</button>
              <button class="uxv-export-item" id="uxv-export-png">PNG</button>
              <button class="uxv-export-item" id="uxv-export-print">PDF</button>
            </div>
          </div>
          <span class="uxv-toolbar-sep">|</span>
          <button class="uxv-tool-btn" id="uxv-theme-toggle" title="Toggle dark/light mode">${window.UiPathRenderer.isDarkMode() ? '☀' : '☾'}</button>
          <button class="uxv-tool-btn" id="uxv-help-btn" title="Keyboard shortcuts (?)">?</button>
          <button class="uxv-tool-btn uxv-export-btn" id="uxv-compare-branch" title="Compare with another branch">Compare</button>
        </div>
      </div>
      <div class="uxv-body">
        <div class="uxv-canvas-wrap" id="uxv-canvas-wrap" style="${state.viewMode !== 'diagram' ? 'display:none' : ''}">
          <div class="uxv-canvas" id="uxv-canvas">${rendered.svgContent}</div>
          <div class="uxv-minimap" id="uxv-minimap">
            <button class="uxv-minimap-close" id="uxv-minimap-close" title="Hide minimap">&times;</button>
            <div class="uxv-minimap-content" id="uxv-minimap-content"></div>
            <div class="uxv-minimap-viewport" id="uxv-minimap-viewport"></div>
          </div>
          <button class="uxv-minimap-restore" id="uxv-minimap-restore" title="Show minimap">Map</button>
        </div>
        <div class="uxv-canvas-wrap" id="uxv-flowchart-wrap" style="${state.viewMode !== 'flowchart' ? 'display:none' : ''}">
          <div class="uxv-canvas" id="uxv-flowchart-canvas">${state.viewMode === 'flowchart' ? (window.UiPathRenderer.renderSequenceFlowchart(state.currentParsed)?.svgContent || '') : ''}</div>
        </div>
        <div class="uxv-outline-wrap" id="uxv-outline-wrap" style="${state.viewMode === 'outline' ? '' : 'display:none'}">
          <input type="text" id="uxv-outline-filter" class="uxv-outline-filter" placeholder="Filter activities..." autocomplete="off" />
          <div id="uxv-outline-content">${renderOutlineHtml(state.currentParsed.tree)}</div>
        </div>
        <div class="uxv-panel-resizer" id="uxv-panel-resizer"></div><div class="uxv-panel" id="uxv-panel">${rendered.panelHtml}</div>
      </div>`;

    const codeEl = UXV.github.findCode();
    const parent = codeEl?.parentElement || document.querySelector('main');
    if (parent) {
      if (codeEl) codeEl.parentElement.insertBefore(viewer, codeEl.nextSibling);
      else parent.appendChild(viewer);
    }

    UXV.interactions.setupInteractions(viewer, priorState);
    UXV.interactions.setupCollapse(viewer);
    UXV.interactions.setupInspector(viewer);
    UXV.interactions.setupInvokeNavigation(viewer);
    UXV.interactions.setupInvokePreview(viewer);
    UXV.interactions.setupContextMenu(viewer);
    UXV.interactions.setupSearch(viewer);
    UXV.interactions.setupKeyboard(viewer);
    UXV.interactions.setupPanelResize(viewer);
    UXV.interactions.setupMinimap(viewer);
    UXV.interactions.setupScreenshotPreview(viewer);
    UXV.interactions.setupVariableHighlight(viewer);
    UXV.interactions.setupBookmarks(viewer);
    UXV.interactions.setupOutlineFilter(viewer);
  }

  async function toggleViewer() {
    if (state.isToggling) return;
    const btn = document.getElementById(BUTTON_ID);
    if (state.isViewing) {
      state.userClosed = true;
      cleanupViewerState();
      resetBtn(btn);
      if (btn) btn.focus();
      return;
    }

    state.isToggling = true;
    if (btn) {
      btn.innerHTML = '<span class="uxv-spinner"></span> Loading...';
      btn.disabled = true;
    }

    try {
      const xaml = await UXV.github.fetchXaml();
      if (!xaml) {
        renderMessageViewer('UiPath XAML Visualizer', 'Could not retrieve XAML from this GitHub view. The page layout may have changed or the raw file is unavailable.');
        resetBtn(btn);
        return;
      }

      if (btn) btn.innerHTML = '<span class="uxv-spinner"></span> Parsing...';
      await new Promise((r) => setTimeout(r, 0));

      state.currentParsed = window.UiPathParser.parse(xaml);
      if (state.currentParsed.error) {
        renderMessageViewer('UiPath XAML Visualizer', state.currentParsed.error);
        resetBtn(btn);
        return;
      }
      restoreCollapseState(state.currentParsed.tree);

      if (btn) btn.innerHTML = '<span class="uxv-spinner"></span> Rendering...';
      await new Promise((r) => setTimeout(r, 0));

      renderViewer();
      UXV.github.showCode(false);
      if (btn) {
        btn.innerHTML = UXV.github.svgIcon('code') + ' Show Code';
        btn.disabled = false;
        btn.classList.add('uxv-btn-active');
      }
      state.isViewing = true;
      const viewerEl = document.getElementById(VIEWER_ID);
      if (viewerEl) {
        const header = viewerEl.querySelector('.uxv-header');
        (header || viewerEl).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const searchInput = viewerEl.querySelector('#uxv-search');
        if (searchInput) setTimeout(() => searchInput.focus(), 300);
      }
      navigateToHash();
    } catch (err) {
      console.error('[UXV]', err);
      renderMessageViewer('UiPath XAML Visualizer', err.message || 'Unexpected viewer error.');
      resetBtn(btn);
    } finally {
      state.isToggling = false;
    }
  }

  // Expose on UXV namespace
  UXV.viewer = {
    toggleViewer,
    renderViewer,
    renderMessageViewer,
    detectTemplate,
    resetBtn,
    cleanupViewerState,
    renderOutlineHtml,
    exportPrint,
    exportSvg,
    exportPng,
    showBranchCompare,
    parseViewHash,
    buildViewHash,
    navigateToHash,
    collectCollapseMap,
    restoreCollapseMap,
    setAll,
    collapseStorageKey,
    saveCollapseState,
    restoreCollapseState,
  };
})();
