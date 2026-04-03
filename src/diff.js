/**
 * UiPath XAML Diff Visualizer v2
 * Uses the GitHub REST API for SHA resolution and authenticated file fetching.
 */
window.UiPathDiff = (() => {

  const DIFF_BTN_CLASS = 'uxv-diff-btn';
  const DIFF_VIEWER_CLASS = 'uxv-diff-viewer';
  const getApiBase = window.UiPathUtils.getApiBase;
  const getRawBase = window.UiPathUtils.getRawBase;

  const apiGet = window.UiPathFetch.apiGet;
  const fetchFileAtRef = window.UiPathFetch.fetchFileAtRef;

  function apiBase() { return getApiBase(); }
  const diffCtrls = new Map();

  const esc = window.UiPathUtils.esc;
  const escHtml = window.UiPathUtils.escHtml;

  function sortObject(obj) {
    return Object.fromEntries(Object.entries(obj || {}).sort(([a], [b]) => a.localeCompare(b)));
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  function edgeSignatureList(edges) {
    return (edges || [])
      .map((edge) => `${edge.from || ''}|${edge.label || ''}|${edge.to || ''}`)
      .sort();
  }

  function treeSnapshot(node) {
    if (!node) return null;
    return {
      type: node.type || node.flowType || '',
      displayName: node.displayName || '',
      category: node.category || '',
      annotation: node.annotation || '',
      properties: sortObject(node.properties || {}),
      variables: (node.variables || []).map((variable) => `${variable.name}:${variable.type}:${variable.default || ''}`).sort(),
      children: (node.children || []).map(treeSnapshot),
      flowNodes: (node.flowNodes || []).map(graphSnapshot),
      flowEdges: edgeSignatureList(node.flowEdges || []),
      stateNodes: (node.stateNodes || []).map(graphSnapshot),
      stateEdges: edgeSignatureList(node.stateEdges || []),
    };
  }

  function graphSnapshot(node) {
    if (!node) return null;
    return {
      id: node.id || '',
      flowType: node.flowType || '',
      activityType: node.activityType || '',
      displayName: node.displayName || '',
      category: node.category || '',
      annotation: node.annotation || '',
      isFinal: !!node.isFinal,
      condition: node.condition || '',
      expression: node.expression || '',
      properties: sortObject(node.properties || {}),
      innerActivity: treeSnapshot(node.innerActivity || null),
      entryNode: treeSnapshot(node.entryNode || null),
    };
  }

  async function getParentSha(owner, repo, sha) {
    const data = await apiGet(`${apiBase()}/repos/${owner}/${repo}/commits/${sha}`);
    if (!data) throw new Error(`Commit ${sha.slice(0, 7)} not found`);
    return data.parents && data.parents.length > 0 ? data.parents[0].sha : null;
  }

  async function getPrRefs(owner, repo, prNumber) {
    const data = await apiGet(`${apiBase()}/repos/${owner}/${repo}/pulls/${prNumber}`);
    if (!data) throw new Error(`PR #${prNumber} not found`);
    return {
      base: data.base.sha,
      head: data.head.sha,
      baseRef: data.base.ref,
      headRef: data.head.ref,
    };
  }

  function isDiffPage() {
    const path = location.pathname;
    return /\/commit\//.test(path)
      || /\/pull\/\d+\/(files|commits?)/.test(path)
      || /\/compare\//.test(path);
  }

  function getOwnerRepo() {
    const match = location.pathname.match(/^\/([^/]+)\/([^/]+)/);
    return match ? { owner: match[1], repo: match[2] } : null;
  }

  async function resolveRefs() {
    const path = location.pathname;
    const ownerRepo = getOwnerRepo();
    if (!ownerRepo) return null;

    const { owner, repo } = ownerRepo;
    const commitMatch = path.match(/\/commit\/([a-f0-9]{7,40})/);
    if (commitMatch) {
      const head = commitMatch[1];
      const base = await getParentSha(owner, repo, head);
      return { owner, repo, base, head };
    }

    const prMatch = path.match(/\/pull\/(\d+)/);
    if (prMatch) {
      const refs = await getPrRefs(owner, repo, parseInt(prMatch[1], 10));
      return { owner, repo, base: refs.base, head: refs.head };
    }

    const compareMatch = path.match(/\/compare\/(.+?)(?:\.{2,3})(.+)/);
    if (compareMatch) {
      return { owner, repo, base: compareMatch[1], head: compareMatch[2] };
    }

    return null;
  }

  function findXamlDiffBlocks() {
    const blocks = [];
    const fileEls = document.querySelectorAll('[data-tagsearch-path], .file, [data-file-type=".xaml"], copilot-diff-entry');

    for (const el of fileEls) {
      const path = el.getAttribute('data-tagsearch-path')
        || el.querySelector('.file-header [title]')?.getAttribute('title')
        || el.querySelector('[data-path]')?.getAttribute('data-path')
        || el.querySelector('.file-info a')?.textContent?.trim()
        || '';

      if (!path.endsWith('.xaml')) continue;
      if (el.querySelector('.' + DIFF_BTN_CLASS)) continue;

      let oldPath = null;

      // GitHub sets data-old-path on renamed files
      oldPath = el.getAttribute('data-old-path')
        || el.querySelector('[data-old-path]')?.getAttribute('data-old-path')
        || null;

      // Fallback: parse "old → new" from header text
      if (!oldPath) {
        const headerText = el.querySelector('.file-header .file-info, .file-header [title]')?.textContent || '';
        const arrowMatch = headerText.match(/(.+\.xaml)\s*→\s*/);
        if (arrowMatch) oldPath = arrowMatch[1].trim();
      }

      blocks.push({ el, path, oldPath: oldPath || null });
    }

    return blocks;
  }

  function cloneNodeShallow(node) {
    if (!node) return null;
    return {
      ...node,
      properties: { ...(node.properties || {}) },
      variables: (node.variables || []).map((variable) => ({ ...variable })),
      children: [],
      flowNodes: node.flowNodes ? [] : undefined,
      flowEdges: node.flowEdges ? [...node.flowEdges] : undefined,
      stateNodes: node.stateNodes ? [] : undefined,
      stateEdges: node.stateEdges ? [...node.stateEdges] : undefined,
      entryNode: node.entryNode || null,
    };
  }

  function annotateAll(node, status) {
    const clone = cloneNodeShallow(node);
    clone._diffStatus = status;
    if (node.children) clone.children = node.children.map((child) => annotateAll(child, status));
    if (node.flowNodes) clone.flowNodes = node.flowNodes.map((child) => annotateAll(child, status));
    if (node.stateNodes) clone.stateNodes = node.stateNodes.map((child) => annotateAll(child, status));
    if (node.entryNode) clone.entryNode = annotateAll(node.entryNode, status);
    return clone;
  }

  function propertiesChanged(oldNode, newNode) {
    return !deepEqual(sortObject(oldNode.properties || {}), sortObject(newNode.properties || {}));
  }

  function variablesChanged(oldNode, newNode) {
    const left = (oldNode.variables || []).map((variable) => `${variable.name}:${variable.type}:${variable.default || ''}`).sort();
    const right = (newNode.variables || []).map((variable) => `${variable.name}:${variable.type}:${variable.default || ''}`).sort();
    return left.join('|') !== right.join('|');
  }

  function nodeKey(node) {
    return `${node.type || ''}::${node.displayName || ''}`;
  }

  function graphNodeKey(node) {
    if (node.flowType) return `${node.flowType}::${node.activityType || ''}::${node.displayName || ''}`;
    return `${node.isFinal ? 'final' : 'state'}::${node.displayName || ''}`;
  }

  function hasStableId(node) {
    return node.id && !/^[a-z]+_auto_\d+$/.test(node.id);
  }

  // O(m*n) space required for backtracking to recover matched index pairs.
  function computeLCS(oldKeys, newKeys) {
    const m = oldKeys.length;
    const n = newKeys.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = oldKeys[i - 1] === newKeys[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const pairs = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (oldKeys[i - 1] === newKeys[j - 1]) {
        pairs.push([i - 1, j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    return pairs.reverse();
  }

  function diffTrees(oldTree, newTree) {
    if (!oldTree && !newTree) return null;
    if (!oldTree) return annotateAll(newTree, 'added');
    if (!newTree) return annotateAll(oldTree, 'removed');

    const node = cloneNodeShallow(newTree);
    node._diffStatus = 'unchanged';

    if (oldTree.type !== newTree.type || oldTree.displayName !== newTree.displayName || oldTree.annotation !== newTree.annotation) {
      node._diffStatus = 'modified';
    }
    if (propertiesChanged(oldTree, newTree) || variablesChanged(oldTree, newTree)) {
      node._diffStatus = 'modified';
    }

    if (newTree.type === 'Flowchart') {
      node.flowNodes = diffGraphNodeLists(oldTree.flowNodes || [], newTree.flowNodes || []);
      node.flowEdges = [...(newTree.flowEdges || [])];
      if (edgeSignatureList(oldTree.flowEdges || []).join('|') !== edgeSignatureList(newTree.flowEdges || []).join('|')) {
        node._diffStatus = 'modified';
      }
      return node;
    }

    if (newTree.type === 'StateMachine') {
      node.stateNodes = diffGraphNodeLists(oldTree.stateNodes || [], newTree.stateNodes || []);
      node.stateEdges = [...(newTree.stateEdges || [])];
      if (edgeSignatureList(oldTree.stateEdges || []).join('|') !== edgeSignatureList(newTree.stateEdges || []).join('|')
        || (oldTree.initialStateId || '') !== (newTree.initialStateId || '')) {
        node._diffStatus = 'modified';
      }
      return node;
    }

    node.children = diffChildLists(oldTree.children || [], newTree.children || []);
    return node;
  }

  function diffChildLists(oldList, newList) {
    const result = [];
    const oldUsed = new Set();
    const pairMap = new Map();

    // Phase 1: match by stable ID (position-independent)
    const oldIdIndex = new Map();
    oldList.forEach((node, i) => { if (hasStableId(node)) oldIdIndex.set(node.id, i); });

    for (let ni = 0; ni < newList.length; ni++) {
      if (hasStableId(newList[ni]) && oldIdIndex.has(newList[ni].id)) {
        const oi = oldIdIndex.get(newList[ni].id);
        if (!oldUsed.has(oi)) {
          pairMap.set(ni, oi);
          oldUsed.add(oi);
        }
      }
    }

    // Phase 2: LCS for remaining unmatched nodes
    const remainOld = [];
    const remainNew = [];
    for (let i = 0; i < oldList.length; i++) { if (!oldUsed.has(i)) remainOld.push(i); }
    for (let i = 0; i < newList.length; i++) { if (!pairMap.has(i)) remainNew.push(i); }

    if (remainOld.length > 0 && remainNew.length > 0) {
      const roKeys = remainOld.map((i) => nodeKey(oldList[i]));
      const rnKeys = remainNew.map((i) => nodeKey(newList[i]));
      const lcsPairs = computeLCS(roKeys, rnKeys);
      for (const [roi, rni] of lcsPairs) {
        pairMap.set(remainNew[rni], remainOld[roi]);
        oldUsed.add(remainOld[roi]);
      }
    }

    // Build result
    for (let ni = 0; ni < newList.length; ni++) {
      if (pairMap.has(ni)) {
        const oi = pairMap.get(ni);
        const diffed = diffTrees(oldList[oi], newList[ni]);
        if (nodeKey(oldList[oi]) !== nodeKey(newList[ni]) && diffed) diffed._diffStatus = 'modified';
        result.push(diffed);
      } else {
        result.push(annotateAll(newList[ni], 'added'));
      }
    }

    for (let oi = 0; oi < oldList.length; oi++) {
      if (!oldUsed.has(oi)) result.push(annotateAll(oldList[oi], 'removed'));
    }

    return result;
  }

  function diffGraphNodeLists(oldList, newList) {
    const result = [];
    const oldUsed = new Set();
    const pairMap = new Map();

    // Phase 1: match by stable ID (position-independent)
    const oldIdIndex = new Map();
    oldList.forEach((node, i) => { if (hasStableId(node)) oldIdIndex.set(node.id, i); });

    for (let ni = 0; ni < newList.length; ni++) {
      if (hasStableId(newList[ni]) && oldIdIndex.has(newList[ni].id)) {
        const oi = oldIdIndex.get(newList[ni].id);
        if (!oldUsed.has(oi)) {
          pairMap.set(ni, oi);
          oldUsed.add(oi);
        }
      }
    }

    // Phase 2: LCS for remaining unmatched nodes
    const remainOld = [];
    const remainNew = [];
    for (let i = 0; i < oldList.length; i++) { if (!oldUsed.has(i)) remainOld.push(i); }
    for (let i = 0; i < newList.length; i++) { if (!pairMap.has(i)) remainNew.push(i); }

    if (remainOld.length > 0 && remainNew.length > 0) {
      const roKeys = remainOld.map((i) => graphNodeKey(oldList[i]));
      const rnKeys = remainNew.map((i) => graphNodeKey(newList[i]));
      const lcsPairs = computeLCS(roKeys, rnKeys);
      for (const [roi, rni] of lcsPairs) {
        pairMap.set(remainNew[rni], remainOld[roi]);
        oldUsed.add(remainOld[roi]);
      }
    }

    // Build result
    for (let ni = 0; ni < newList.length; ni++) {
      if (pairMap.has(ni)) {
        const oi = pairMap.get(ni);
        const merged = cloneNodeShallow(newList[ni]);
        merged._diffStatus = deepEqual(graphSnapshot(oldList[oi]), graphSnapshot(newList[ni]))
          ? 'unchanged'
          : 'modified';
        result.push(merged);
      } else {
        result.push(annotateAll(newList[ni], 'added'));
      }
    }

    for (let oi = 0; oi < oldList.length; oi++) {
      if (!oldUsed.has(oi)) result.push(annotateAll(oldList[oi], 'removed'));
    }

    return result;
  }

  function countChanges(node) {
    let added = 0;
    let removed = 0;
    let modified = 0;

    if (node._diffStatus === 'added') added++;
    else if (node._diffStatus === 'removed') removed++;
    else if (node._diffStatus === 'modified') modified++;

    for (const child of node.children || []) {
      const sub = countChanges(child);
      added += sub.added;
      removed += sub.removed;
      modified += sub.modified;
    }
    for (const child of node.flowNodes || []) {
      const sub = countChanges(child);
      added += sub.added;
      removed += sub.removed;
      modified += sub.modified;
    }
    for (const child of node.stateNodes || []) {
      const sub = countChanges(child);
      added += sub.added;
      removed += sub.removed;
      modified += sub.modified;
      if (child.entryNode) {
        const entrySub = countChanges(child.entryNode);
        added += entrySub.added;
        removed += entrySub.removed;
        modified += entrySub.modified;
      }
    }

    return { added, removed, modified };
  }

  function injectDiffButtons() {
    if (!isDiffPage()) return;

    for (const { el, path, oldPath } of findXamlDiffBlocks()) {
      const header = el.querySelector('.file-header, .js-file-header, [class*="fileHeader"]');
      if (!header) continue;

      const btn = document.createElement('button');
      btn.className = `${DIFF_BTN_CLASS} uxv-btn`;
      btn.innerHTML = diffBtnIcon() + 'Visual Diff';
      btn.title = 'Show visual workflow diff';
      btn.dataset.path = path;

      btn.addEventListener('click', async () => {
        const existing = el.querySelector('.' + DIFF_VIEWER_CLASS);
        if (existing) {
          existing.remove();
          btn.classList.remove('uxv-btn-active');
          btn.innerHTML = diffBtnIcon() + 'Visual Diff';
          return;
        }
        await showDiff(el, btn, path, oldPath);
      });

      const actions = header.querySelector('.file-actions, [class*="fileActions"], .BtnGroup');
      if (actions) actions.prepend(btn);
      else header.appendChild(btn);
    }
  }

  function diffBtnIcon() {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"><path d="M8.75 1.75a.75.75 0 00-1.5 0V5H4a.75.75 0 000 1.5h3.25v3.25a.75.75 0 001.5 0V6.5H12A.75.75 0 0012 5H8.75V1.75zM4 13a.75.75 0 000 1.5h8a.75.75 0 000-1.5H4z"/></svg>';
  }

  function resetDiffBtn(btn) {
    btn.innerHTML = diffBtnIcon() + 'Visual Diff';
    btn.disabled = false;
    btn.classList.remove('uxv-btn-active');
  }

  function buildSummaryHtml({ changes, path, refs, oldExists, newExists, oldParsed, newParsed }) {
    const parts = [];
    if (changes.added > 0) parts.push(`<span class="uxv-diff-added">+${changes.added} added</span>`);
    if (changes.removed > 0) parts.push(`<span class="uxv-diff-removed">-${changes.removed} removed</span>`);
    if (changes.modified > 0) parts.push(`<span class="uxv-diff-modified">~${changes.modified} modified</span>`);
    if (parts.length === 0) parts.push('<span class="uxv-diff-unchanged">No structural changes detected</span>');

    let badgeClass = 'uxv-diff-mod';
    let badgeText = 'MODIFIED';
    if ((oldParsed && oldParsed.error) || (newParsed && newParsed.error)) {
      badgeClass = 'uxv-diff-err';
      badgeText = 'PARSE ERROR';
    } else if (!oldExists && newExists) {
      badgeClass = 'uxv-diff-new';
      badgeText = 'NEW FILE';
    } else if (oldExists && !newExists) {
      badgeClass = 'uxv-diff-del';
      badgeText = 'DELETED';
    }

    const shortRef = (r) => /^[0-9a-f]{7,40}$/i.test(r) ? r.slice(0, 7) : r;
    const refInfo = refs.base && refs.head
      ? `<span class="uxv-diff-refs" title="base: ${esc(refs.base)}&#10;head: ${esc(refs.head)}">${esc(shortRef(refs.base))} -> ${esc(shortRef(refs.head))}</span>`
      : '';

    return `<div class="uxv-diff-summary">
      <span class="uxv-diff-badge ${badgeClass}">${badgeText}</span>
      <span class="uxv-diff-path">${escHtml(path)}</span>
      ${refInfo}
      <span class="uxv-diff-stats">${parts.join(' ')}</span>
      <span class="uxv-diff-legend">
        <span class="uxv-legend-item"><span class="uxv-legend-dot uxv-legend-added"></span>Added</span>
        <span class="uxv-legend-item"><span class="uxv-legend-dot uxv-legend-removed"></span>Removed</span>
        <span class="uxv-legend-item"><span class="uxv-legend-dot uxv-legend-modified"></span>Modified</span>
      </span>
      <button class="uxv-diff-layout-btn" title="Toggle side-by-side / stacked layout">⬍</button>
    </div>`;
  }

  function buildNoticeHtml(message, tone = 'warning') {
    return `<div class="uxv-diff-note uxv-diff-note-${tone}">${escHtml(message)}</div>`;
  }

  function syncPanZoom(ctrlA, ctrlB) {
    let syncing = false;
    const origApplyA = ctrlA.apply;
    const origApplyB = ctrlB.apply;

    ctrlA.apply = (state) => {
      origApplyA(state);
      if (!syncing) { syncing = true; origApplyB(ctrlA.getState()); syncing = false; }
    };
    ctrlB.apply = (state) => {
      origApplyB(state);
      if (!syncing) { syncing = true; origApplyA(ctrlB.getState()); syncing = false; }
    };
  }

  function buildPropertyDiffHtml(oldNode, newNode) {
    if (!oldNode && !newNode) return '';
    const name = (newNode || oldNode).displayName || 'Activity';
    const type = (newNode || oldNode).type || (newNode || oldNode).activityType || '';

    let html = `<div class="uxv-prop-diff">`;
    html += `<div class="uxv-prop-diff-header">${esc(name)} <span style="opacity:0.6">(${esc(type)})</span></div>`;
    html += `<table class="uxv-prop-diff-table"><tr><th>Property</th><th>Base</th><th>Head</th></tr>`;

    const allKeys = new Set([
      ...Object.keys((oldNode?.properties) || {}),
      ...Object.keys((newNode?.properties) || {}),
    ]);

    for (const key of [...allKeys].sort()) {
      const oldVal = oldNode?.properties?.[key] ?? '';
      const newVal = newNode?.properties?.[key] ?? '';
      const changed = String(oldVal) !== String(newVal);
      const cls = changed ? ' class="uxv-prop-changed"' : '';
      html += `<tr${cls}><td>${esc(key)}</td><td>${esc(String(oldVal))}</td><td>${esc(String(newVal))}</td></tr>`;
    }

    html += `</table></div>`;
    return html;
  }

  const findInTree = window.UiPathUtils.findInTree;

  async function showDiff(fileEl, btn, path, oldPath) {
    btn.innerHTML = '<span class="uxv-spinner"></span> Resolving refs...';
    btn.disabled = true;

    try {
      const refs = await resolveRefs();
      if (!refs) {
        throw new Error('Could not determine base/head commits for this page.');
      }

      const { owner, repo, base, head } = refs;
      btn.innerHTML = '<span class="uxv-spinner"></span> Fetching files...';

      const [oldXaml, newXaml] = await Promise.all([
        base ? fetchFileAtRef(owner, repo, base, oldPath || path) : Promise.resolve(null),
        fetchFileAtRef(owner, repo, head, path),
      ]);

      const oldExists = !!oldXaml;
      const newExists = !!newXaml;
      if (!oldExists && !newExists) {
        throw new Error('Could not fetch either version of the file. Configure a GitHub token for private repos or rate-limited sessions.');
      }

      btn.innerHTML = '<span class="uxv-spinner"></span> Analyzing diff...';

      const oldParsed = oldXaml ? window.UiPathParser.parse(oldXaml) : null;
      const newParsed = newXaml ? window.UiPathParser.parse(newXaml) : null;

      let comparisonNotice = '';
      let diffTree = null;

      if (oldParsed?.error && newParsed?.error) {
        comparisonNotice = `Base parse failed: ${oldParsed.error}\nHead parse failed: ${newParsed.error}`;
      } else if (oldParsed?.error || newParsed?.error) {
        comparisonNotice = oldParsed?.error
          ? `Base version could not be parsed, so the visual diff falls back to the head workflow only. ${oldParsed.error}`
          : `Head version could not be parsed, so the visual diff falls back to the base workflow only. ${newParsed.error}`;
        const fallbackTree = newParsed && !newParsed.error ? newParsed.tree : oldParsed && !oldParsed.error ? oldParsed.tree : null;
        diffTree = fallbackTree ? annotateAll(fallbackTree, 'unchanged') : null;
      } else {
        diffTree = diffTrees(oldParsed?.tree, newParsed?.tree);
      }

      const changes = diffTree ? countChanges(diffTree) : { added: 0, removed: 0, modified: 0 };
      const summaryHtml = buildSummaryHtml({ changes, path, refs, oldExists, newExists, oldParsed, newParsed });

      const viewer = document.createElement('div');
      viewer.className = DIFF_VIEWER_CLASS;

      if (!diffTree) {
        viewer.innerHTML = summaryHtml + buildNoticeHtml(comparisonNotice || 'No renderable workflow could be produced from either side of the diff.', 'error');
      } else if (oldParsed && !oldParsed.error && newParsed && !newParsed.error) {
        // --- Side-by-side mode ---
        // Render old tree: mark removed nodes as 'removed', matched nodes get their diff status
        const reverseDiff = diffTrees(newParsed.tree, oldParsed.tree);
        // Swap added/removed for old-side perspective
        function swapStatus(node) {
          if (!node) return;
          if (node._diffStatus === 'added') node._diffStatus = 'removed';
          else if (node._diffStatus === 'removed') node._diffStatus = 'added';
          (node.children || []).forEach(swapStatus);
          (node.flowNodes || []).forEach(swapStatus);
          (node.stateNodes || []).forEach(swapStatus);
          if (node.entryNode) swapStatus(node.entryNode);
        }
        swapStatus(reverseDiff);

        const oldDiffParsed = {
          name: oldParsed.name || 'Workflow',
          tree: reverseDiff,
          arguments: oldParsed.arguments || [],
          designMode: oldParsed.designMode || 'Classic',
        };
        const newDiffParsed = {
          name: newParsed.name || 'Workflow',
          tree: diffTree,
          arguments: newParsed.arguments || [],
          designMode: newParsed.designMode || 'Classic',
        };

        const oldRendered = window.UiPathRenderer.render(oldDiffParsed);
        const newRendered = window.UiPathRenderer.render(newDiffParsed);
        const safeId = path.replace(/[^a-z0-9]/gi, '_');

        viewer.innerHTML = summaryHtml
          + (comparisonNotice ? buildNoticeHtml(comparisonNotice, 'warning') : '')
          + `<div class="uxv-diff-sidebyside">
              <div class="uxv-diff-pane uxv-diff-pane-old">
                <div class="uxv-diff-pane-header">BASE</div>
                <div class="uxv-canvas-wrap" id="uxv-dw-old-${safeId}">
                  <div class="uxv-canvas" id="uxv-dc-old-${safeId}">${typeof oldRendered === 'string' ? oldRendered : oldRendered.svgContent}</div>
                </div>
              </div>
              <div class="uxv-diff-pane uxv-diff-pane-new">
                <div class="uxv-diff-pane-header">HEAD</div>
                <div class="uxv-canvas-wrap" id="uxv-dw-new-${safeId}">
                  <div class="uxv-canvas" id="uxv-dc-new-${safeId}">${typeof newRendered === 'string' ? newRendered : newRendered.svgContent}</div>
                </div>
              </div>
            </div>
            <div class="uxv-prop-diff-panel" id="uxv-prop-diff-${safeId}"></div>`;

        // Setup synced pan/zoom
        const wrapOld = viewer.querySelector(`#uxv-dw-old-${safeId}`);
        const canvasOld = viewer.querySelector(`#uxv-dc-old-${safeId}`);
        const wrapNew = viewer.querySelector(`#uxv-dw-new-${safeId}`);
        const canvasNew = viewer.querySelector(`#uxv-dc-new-${safeId}`);

        if (wrapOld && canvasOld && wrapNew && canvasNew) {
          const ctrlOld = window.UiPathRenderer.setupPanZoom(wrapOld, canvasOld, { fitScale: 0.85 });
          const ctrlNew = window.UiPathRenderer.setupPanZoom(wrapNew, canvasNew, { fitScale: 0.85 });
          syncPanZoom(ctrlOld, ctrlNew);
          diffCtrls.set(`uxv-dw-old-${safeId}`, ctrlOld);
          diffCtrls.set(`uxv-dw-new-${safeId}`, ctrlNew);
          setTimeout(() => { ctrlOld.fitToView(); ctrlNew.fitToView(); }, 200);

          // Layout toggle: side-by-side ↔ stacked
          const layoutBtn = viewer.querySelector('.uxv-diff-layout-btn');
          const sbs = viewer.querySelector('.uxv-diff-sidebyside');
          if (layoutBtn && sbs) {
            layoutBtn.addEventListener('click', () => {
              sbs.classList.toggle('uxv-diff-stacked');
              layoutBtn.textContent = sbs.classList.contains('uxv-diff-stacked') ? '⬌' : '⬍';
              setTimeout(() => { ctrlOld.fitToView(); ctrlNew.fitToView(); }, 100);
            });
          }
        }

        // Cross-pane node click for property diff
        viewer.addEventListener('click', (event) => {
          const nodeEl = event.target.closest('.uxv-node');
          if (!nodeEl) return;
          const nodeId = nodeEl.dataset.id;
          if (!nodeId) return;

          // Highlight in both panes
          viewer.querySelectorAll('.uxv-diff-selected').forEach((el) => el.classList.remove('uxv-diff-selected'));
          viewer.querySelectorAll(`.uxv-node[data-id="${CSS.escape(nodeId)}"]`).forEach((el) => {
            el.classList.add('uxv-diff-selected');
          });

          // Find matched nodes in both original trees
          const oldNode = findInTree(oldParsed.tree, nodeId);
          const newNode = findInTree(newParsed.tree, nodeId);

          const panel = viewer.querySelector(`#uxv-prop-diff-${safeId}`);
          if (panel) {
            panel.innerHTML = buildPropertyDiffHtml(oldNode, newNode);
          }
        });
      } else {
        // --- Single-pane fallback (new file, deleted file, parse errors) ---
        const diffParsed = {
          name: (newParsed && !newParsed.error ? newParsed : oldParsed)?.name || 'Workflow',
          tree: diffTree,
          arguments: (newParsed && !newParsed.error ? newParsed : oldParsed)?.arguments || [],
          designMode: (newParsed && !newParsed.error ? newParsed : oldParsed)?.designMode || 'Classic',
        };
        const rendered = window.UiPathRenderer.render(diffParsed);
        const safeId = path.replace(/[^a-z0-9]/gi, '_');
        viewer.innerHTML = summaryHtml
          + (comparisonNotice ? buildNoticeHtml(comparisonNotice, 'warning') : '')
          + (typeof rendered === 'string'
            ? rendered
            : `<div class="uxv-diff-body">
                <div class="uxv-canvas-wrap" id="uxv-dw-${safeId}">
                  <div class="uxv-canvas" id="uxv-dc-${safeId}">${rendered.svgContent}</div>
                </div>
              </div>`);

        if (typeof rendered !== 'string') {
          setupDiffInteractions(viewer, `uxv-dw-${safeId}`, `uxv-dc-${safeId}`);
        }
      }

      const diffTable = fileEl.querySelector('.js-file-content, [class*="fileContents"], .blob-wrapper, table.diff-table');
      if (diffTable) diffTable.parentElement.insertBefore(viewer, diffTable.nextSibling);
      else fileEl.appendChild(viewer);

      btn.classList.add('uxv-btn-active');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>Hide Visual Diff';
      btn.disabled = false;
    } catch (err) {
      console.error('[UXV Diff]', err);
      const viewer = document.createElement('div');
      viewer.className = DIFF_VIEWER_CLASS;
      viewer.innerHTML = buildNoticeHtml(err.message || 'Unexpected diff error.', 'error');
      fileEl.appendChild(viewer);
      resetDiffBtn(btn);
    }
  }

  function setupDiffInteractions(viewer, wrapId, canvasId) {
    if (diffCtrls.has(wrapId)) diffCtrls.get(wrapId).ac.abort();
    const wrap = viewer.querySelector('#' + wrapId);
    const canvas = viewer.querySelector('#' + canvasId);
    if (!wrap || !canvas) return;
    const ctrl = window.UiPathRenderer.setupPanZoom(wrap, canvas, { fitScale: 0.85 });
    diffCtrls.set(wrapId, ctrl);
    setTimeout(ctrl.fitToView, 200);
  }

  const summaryCache = new Map();

  function clearCache() {
    window.UiPathFetch.clearCache();
    summaryCache.clear();
    summaryQueue.length = 0;
    for (const ctrl of diffCtrls.values()) ctrl.ac.abort();
    diffCtrls.clear();
  }

  const SUMMARY_MAX_CONCURRENT = 3;
  let summaryInFlight = 0;
  const summaryQueue = [];

  function runSummaryQueue() {
    while (summaryInFlight < SUMMARY_MAX_CONCURRENT && summaryQueue.length > 0) {
      const job = summaryQueue.shift();
      summaryInFlight++;
      job().finally(() => { summaryInFlight--; runSummaryQueue(); });
    }
  }

  function enqueueSummary(fn) {
    summaryQueue.push(fn);
    runSummaryQueue();
  }

  function fetchAndInsertSummary(el, refs, path, oldPath) {
    const cacheKey = `${refs.base}:${refs.head}:${path}`;
    if (summaryCache.has(cacheKey)) {
      const cached = summaryCache.get(cacheKey);
      if (cached) insertSummaryBadge(el, cached);
      return;
    }

    const header = el.querySelector('.file-header, [class*="fileHeader"], copilot-diff-entry') || el;
    const loading = document.createElement('span');
    loading.className = 'uxv-diff-inline-summary uxv-diff-inline-loading';
    loading.textContent = '⋯';
    header.appendChild(loading);

    enqueueSummary(async () => {
      try {
        const [oldXaml, newXaml] = await Promise.all([
          fetchFileAtRef(refs.owner, refs.repo, refs.base, oldPath || path),
          fetchFileAtRef(refs.owner, refs.repo, refs.head, path),
        ]);
        loading.remove();
        if (!oldXaml && !newXaml) return;
        const oldParsed = oldXaml ? window.UiPathParser.parse(oldXaml) : null;
        const newParsed = newXaml ? window.UiPathParser.parse(newXaml) : null;
        if ((oldParsed?.error) || (newParsed?.error)) return;

        const diffed = diffTrees(oldParsed?.tree || null, newParsed?.tree || null);
        if (!diffed) return;
        const counts = countChanges(diffed);
        summaryCache.set(cacheKey, counts);
        insertSummaryBadge(el, counts);
      } catch (_e) {
        loading.remove();
        summaryCache.set(cacheKey, null);
      }
    });
  }

  async function injectDiffSummaries() {
    const blocks = findXamlDiffBlocks();
    if (blocks.length === 0) return;

    let refs;
    try { refs = await resolveRefs(); } catch (_e) { return; }
    if (!refs) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const target = entry.target;
        fetchAndInsertSummary(target, refs, target.dataset.uxvPath, target.dataset.uxvOldPath);
      }
    }, { rootMargin: '200px' });

    for (const { el, path, oldPath } of blocks) {
      if (el.querySelector('.uxv-diff-inline-summary')) continue;
      const cacheKey = `${refs.base}:${refs.head}:${path}`;
      if (summaryCache.has(cacheKey)) {
        const cached = summaryCache.get(cacheKey);
        if (cached) insertSummaryBadge(el, cached);
        continue;
      }
      el.dataset.uxvPath = path;
      if (oldPath) el.dataset.uxvOldPath = oldPath;
      observer.observe(el);
    }
  }

  function insertSummaryBadge(el, counts) {
    if (!counts || (counts.added === 0 && counts.modified === 0 && counts.removed === 0)) return;
    const header = el.querySelector('.file-header, [class*="fileHeader"], copilot-diff-entry');
    const target = header || el;
    if (target.querySelector('.uxv-diff-inline-summary')) return;
    const badge = document.createElement('span');
    badge.className = 'uxv-diff-inline-summary';
    const parts = [];
    if (counts.added) parts.push(`<span class="uxv-diff-inline-add">+${counts.added}</span>`);
    if (counts.modified) parts.push(`<span class="uxv-diff-inline-mod">~${counts.modified}</span>`);
    if (counts.removed) parts.push(`<span class="uxv-diff-inline-del">-${counts.removed}</span>`);
    badge.innerHTML = parts.join(' ');
    badge.title = `XAML: ${counts.added} added, ${counts.modified} modified, ${counts.removed} removed`;
    target.appendChild(badge);
  }

  return { isDiffPage, injectDiffButtons, injectDiffSummaries, clearCache, diffTrees, countChanges,
    _test: { diffTrees, diffChildLists, diffGraphNodeLists, countChanges, nodeKey, graphNodeKey,
      treeSnapshot, graphSnapshot, computeLCS, hasStableId, getApiBase, getRawBase } };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.UiPathDiff;
}
