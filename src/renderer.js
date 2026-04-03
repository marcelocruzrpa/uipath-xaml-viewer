/**
 * UiPath Workflow Renderer v2
 * Renders sequential trees, flowcharts, and state machines.
 */
window.UiPathRenderer = (() => {

  const COLORS_LIGHT = {
    control: { bg: '#E8F0FE', border: '#4285F4', text: '#1A3B6B', icon: '⊞' },
    decision: { bg: '#FFF3E0', border: '#F09800', text: '#6B3A00', icon: '◇' },
    loop: { bg: '#E0F7FA', border: '#00ACC1', text: '#004D5A', icon: '↻' },
    error: { bg: '#FCE4EC', border: '#E53935', text: '#6B1A1A', icon: '⚠' },
    data: { bg: '#F3E5F5', border: '#8E24AA', text: '#4A0E5C', icon: '⊜' },
    ui: { bg: '#E8F5E9', border: '#43A047', text: '#1B4D1E', icon: '⊡' },
    scope: { bg: '#C8E6C9', border: '#2E7D32', text: '#1B4D1E', icon: '⊞' },
    invoke: { bg: '#FFF8E1', border: '#F9A825', text: '#6B5400', icon: '→' },
    browser: { bg: '#E3F2FD', border: '#1E88E5', text: '#0D3B66', icon: '⊙' },
    excel: { bg: '#E8F5E9', border: '#2E7D32', text: '#1B4D1E', icon: '▦' },
    mail: { bg: '#FFF3E0', border: '#EF6C00', text: '#6B3A00', icon: '✉' },
    file: { bg: '#EFEBE9', border: '#795548', text: '#3E2723', icon: '⊟' },
    dialog: { bg: '#F3E5F5', border: '#7B1FA2', text: '#4A0E5C', icon: '⊡' },
    comment: { bg: '#F5F5F5', border: '#9E9E9E', text: '#616161', icon: '#' },
    sap: { bg: '#E3F2FD', border: '#0D47A1', text: '#0D3B66', icon: '⊞' },
    orchestrator: { bg: '#EDE7F6', border: '#5E35B1', text: '#311B92', icon: '☁' },
    docai: { bg: '#FFF9C4', border: '#F9A825', text: '#6B5400', icon: '⊡' },
    integration: { bg: '#E0F2F1', border: '#00897B', text: '#004D40', icon: '⊙' },
    misc: { bg: '#F5F5F5', border: '#757575', text: '#424242', icon: '⊘' },
    label: { bg: 'transparent', border: '#B0BEC5', text: '#546E7A', icon: '' },
    default: { bg: '#FAFAFA', border: '#BDBDBD', text: '#424242', icon: '⊙' },
  };

  const COLORS_DARK = {
    control: { bg: '#1A2744', border: '#6EA8FE', text: '#A4C8FF', icon: '⊞' },
    decision: { bg: '#3A2A10', border: '#FFB74D', text: '#FFD699', icon: '◇' },
    loop: { bg: '#0A2E33', border: '#4DD0E1', text: '#80DEEA', icon: '↻' },
    error: { bg: '#3A1520', border: '#EF5350', text: '#EF9A9A', icon: '⚠' },
    data: { bg: '#2A1538', border: '#BA68C8', text: '#CE93D8', icon: '⊜' },
    ui: { bg: '#13301A', border: '#66BB6A', text: '#A5D6A7', icon: '⊡' },
    scope: { bg: '#1A3520', border: '#4CAF50', text: '#A5D6A7', icon: '⊞' },
    invoke: { bg: '#332A0A', border: '#FFCA28', text: '#FFE082', icon: '→' },
    browser: { bg: '#0D2137', border: '#42A5F5', text: '#90CAF9', icon: '⊙' },
    excel: { bg: '#13301A', border: '#4CAF50', text: '#A5D6A7', icon: '▦' },
    mail: { bg: '#3A2A10', border: '#FFA726', text: '#FFCC80', icon: '✉' },
    file: { bg: '#2A2018', border: '#8D6E63', text: '#BCAAA4', icon: '⊟' },
    dialog: { bg: '#2A1538', border: '#AB47BC', text: '#CE93D8', icon: '⊡' },
    comment: { bg: '#262626', border: '#9E9E9E', text: '#BDBDBD', icon: '#' },
    sap: { bg: '#0D2137', border: '#1E88E5', text: '#90CAF9', icon: '⊞' },
    orchestrator: { bg: '#1A1040', border: '#7E57C2', text: '#B39DDB', icon: '☁' },
    docai: { bg: '#332A0A', border: '#FFCA28', text: '#FFE082', icon: '⊡' },
    integration: { bg: '#0A2E2A', border: '#26A69A', text: '#80CBC4', icon: '⊙' },
    misc: { bg: '#262626', border: '#9E9E9E', text: '#BDBDBD', icon: '⊘' },
    label: { bg: 'transparent', border: '#546E7A', text: '#90A4AE', icon: '' },
    default: { bg: '#1E1E1E', border: '#757575', text: '#BDBDBD', icon: '⊙' },
  };

  function isDarkMode() {
    const override = document.getElementById('uxv-viewer-container')?.getAttribute('data-uxv-theme');
    if (override === 'dark') return true;
    if (override === 'light') return false;
    const html = document.documentElement;
    const mode = html.getAttribute('data-color-mode');
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    const theme = html.getAttribute('data-dark-theme') || html.getAttribute('data-color-theme');
    if (theme && (theme.includes('dark') || theme.includes('dimmed'))) return true;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  }

  let COLORS = COLORS_LIGHT;

  const THEME_LIGHT = {
    canvasBg: '#F5F8FC', canvasBorder: '#CBD5E1',
    titleText: '#1E3A5F',
    stateBg: '#EBF2FC', stateBorder: '#3B7DD8', stateText: '#1E3A5F',
    finalBg: '#FFF0F0', finalBorder: '#C62828', finalText: '#8A1C28',
    edgeStroke: '#90A4AE', connectorStroke: '#90A4AE',
    edgeLabelBg: 'white', edgeLabelBorder: '#E0E7EF',
    edgeLabelText: '#546E7A', edgeLabelMuted: '#78909C',
    edgeTrue: '#43A047', edgeFalse: '#E53935', edgeDefault: '#607D8B',
    initFill: '#37474F', initStroke: '#263238',
  };

  const THEME_DARK = {
    canvasBg: '#161B22', canvasBorder: '#30363D',
    titleText: '#C9D1D9',
    stateBg: '#1A2744', stateBorder: '#6EA8FE', stateText: '#C9D1D9',
    finalBg: '#3A1520', finalBorder: '#EF5350', finalText: '#EF9A9A',
    edgeStroke: '#546E7A', connectorStroke: '#546E7A',
    edgeLabelBg: '#21262D', edgeLabelBorder: '#30363D',
    edgeLabelText: '#8B949E', edgeLabelMuted: '#8B949E',
    edgeTrue: '#3FB950', edgeFalse: '#F85149', edgeDefault: '#8B949E',
    initFill: '#8B949E', initStroke: '#C9D1D9',
  };

  let THEME = THEME_LIGHT;

  const LAYOUT = {
    nodeW: 300,
    nodeH: 48,
    vGap: 8,
    containerPadTop: 40,
    containerPadBottom: 12,
    containerPadX: 14,
    collapsedH: 44,
    labelH: 26,
    cornerR: 8,
  };
  const { nodeW: NODE_W, nodeH: NODE_H, vGap: V_GAP, containerPadTop: CONTAINER_PAD_TOP,
    containerPadBottom: CONTAINER_PAD_BOTTOM, containerPadX: CONTAINER_PAD_X,
    collapsedH: COLLAPSED_H, labelH: LABEL_H, cornerR: CORNER_R } = LAYOUT;

  function truncate(value, max = 40) {
    if (!value) return '';
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  const esc = window.UiPathUtils.esc;

  function diffColor(status) {
    if (status === 'added') return '#2DA44E';
    if (status === 'removed') return '#CF222E';
    if (status === 'modified') return '#BF8700';
    return null;
  }

  function annotationIcon(x, y, annotation) {
    if (!annotation) return '';
    return `<text x="${x}" y="${y}" font-size="12" fill="#F9A825" style="cursor:help"><title>${esc(annotation)}</title>&#128221;</text>`;
  }

  function layoutNode(node) {
    const isLabel = node.type.startsWith('§');
    const hasChildren = node.children && node.children.length > 0;
    if (node.collapsed && hasChildren) {
      return { ...node, w: NODE_W, h: COLLAPSED_H, isLeaf: false, children: node.children.map(layoutNode) };
    }
    if (!hasChildren) return { ...node, w: NODE_W, h: NODE_H, isLeaf: true };

    const laidOutChildren = node.children.map(layoutNode);
    const childWidth = Math.max(...laidOutChildren.map((child) => child.w));
    const childHeight = laidOutChildren.reduce((sum, child) => sum + child.h, 0) + (laidOutChildren.length - 1) * V_GAP;
    const width = Math.max(NODE_W, childWidth + CONTAINER_PAD_X * 2);
    const topPad = isLabel ? LABEL_H + 6 : CONTAINER_PAD_TOP;
    return { ...node, w: width, h: topPad + childHeight + CONTAINER_PAD_BOTTOM, isLeaf: false, children: laidOutChildren };
  }

  function renderNode(node, x, y, parentW) {
    const color = COLORS[node.category] || COLORS.default;
    const isLabel = node.type.startsWith('§');
    const cx = x + (parentW ? (parentW - node.w) / 2 : 0);
    const accent = diffColor(node._diffStatus);
    let svg = '';

    if (node.collapsed && !node.isLeaf) {
      svg += `<g class="uxv-node uxv-collapsed" data-id="${node.id}" data-type="${esc(node.type)}" data-category="${node.category}" role="group" aria-label="${esc(node.displayName)}" aria-expanded="false">`;
      svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="${COLLAPSED_H}" rx="${CORNER_R}" fill="${color.bg}" stroke="${accent || color.border}" stroke-width="${accent ? 2.4 : 2}" class="uxv-rect" stroke-dasharray="6,3" data-toggle="true" style="cursor:pointer"/>`;
      if (accent) svg += `<rect x="${cx}" y="${y}" width="4" height="${COLLAPSED_H}" rx="2" fill="${accent}"/>`;
      svg += `<text x="${cx + 12}" y="${y + COLLAPSED_H / 2 + 5}" font-size="14" fill="${color.border}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer">▶</text>`;
      svg += `<text x="${cx + 30}" y="${y + COLLAPSED_H / 2 + 1}" font-size="13" fill="${color.text}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="600" dominant-baseline="middle">${esc(truncate(node.displayName, 30))}</text>`;
      if (node.displayName.length > 30) svg += `<title>${esc(node.displayName)}</title>`;
      svg += annotationIcon(cx + node.w - 52, y + 25, node.annotation);
      svg += `</g>`;
      return svg;
    }

    if (node.isLeaf) {
      svg += `<g class="uxv-node${accent ? ` uxv-diff-${node._diffStatus}` : ''}" data-id="${node.id}" data-type="${esc(node.type)}" data-category="${node.category}" role="treeitem" aria-label="${esc(node.displayName)} (${esc(node.type)})">`;
      svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="${node.h}" rx="${CORNER_R}" fill="${color.bg}" stroke="${accent || color.border}" stroke-width="${accent ? 2.2 : 1.5}" class="uxv-rect"/>`;
      if (accent) {
        svg += `<rect x="${cx}" y="${y}" width="4" height="${node.h}" rx="2" fill="${accent}"/>`;
        svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="${node.h}" rx="${CORNER_R}" fill="${accent}" opacity="0.06"/>`;
      }
      if (node._diffStatus === 'removed') {
        svg += `<line x1="${cx + 10}" y1="${y + node.h / 2}" x2="${cx + node.w - 10}" y2="${y + node.h / 2}" stroke="#CF222E" stroke-width="1.5" opacity="0.3"/>`;
      }
      svg += `<text x="${cx + 12}" y="${y + node.h / 2 + 5}" font-size="15" fill="${color.border}" font-family="monospace">${color.icon}</text>`;
      svg += `<text x="${cx + 32}" y="${y + node.h / 2 + 1}" font-size="13" fill="${color.text}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="500" dominant-baseline="middle"${node._diffStatus === 'removed' ? ' text-decoration="line-through" opacity="0.6"' : ''}>${esc(truncate(node.displayName, 36))}</text>`;
      svg += `<text x="${cx + node.w - 10}" y="${y + node.h / 2 + 1}" font-size="10" fill="${color.border}" font-family="'SF Mono',Consolas,monospace" text-anchor="end" dominant-baseline="middle" opacity="0.6">${esc(truncate(node.type, 22))}</text>`;
      if (node.annotation) svg += `<title>${esc(node.annotation)}</title>`;
      else if ((node.type === 'InvokeWorkflowFile' || node.activityType === 'InvokeWorkflowFile') && node.properties?.WorkflowFileName) {
        svg += `<title>Double-click to open: ${esc(node.properties.WorkflowFileName)}</title>`;
      } else if (node.displayName.length > 36) {
        svg += `<title>${esc(node.displayName)}</title>`;
      }
      svg += annotationIcon(cx + node.w - 16, y + 14, node.annotation);
      svg += `</g>`;
      return svg;
    }

    svg += `<g class="uxv-container${accent ? ` uxv-diff-${node._diffStatus}` : ''}" data-id="${node.id}" data-type="${esc(node.type)}" role="group" aria-label="${esc(node.displayName)}" aria-expanded="true">`;
    if (isLabel) {
      svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="${node.h}" rx="4" fill="none" stroke="${accent || color.border}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
      svg += `<text x="${cx + 10}" y="${y + 16}" font-size="11" fill="${color.text}" font-family="'SF Mono',Consolas,monospace" font-weight="600" opacity="0.8">${esc(node.displayName)}</text>`;
    } else {
      if (accent) svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="${node.h}" rx="${CORNER_R}" fill="${accent}" opacity="0.04"/>`;
      svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="${node.h}" rx="${CORNER_R}" fill="${color.bg}" stroke="${accent || color.border}" stroke-width="2" opacity="0.3"/>`;
      if (accent) svg += `<rect x="${cx}" y="${y}" width="4" height="34" rx="2" fill="${accent}"/>`;
      svg += `<rect x="${cx}" y="${y}" width="${node.w}" height="34" rx="${CORNER_R}" fill="${color.border}" opacity="0.1" data-toggle="true" style="cursor:pointer"/>`;
      svg += `<text x="${cx + 12}" y="${y + 22}" font-size="13" fill="${color.border}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer">▼</text>`;
      svg += `<text x="${cx + 28}" y="${y + 22}" font-size="13" fill="${color.text}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="700">${color.icon} ${esc(truncate(node.displayName, 34))}</text>`;
      if (node.displayName.length > 34 && !node.variables?.length) svg += `<title>${esc(node.displayName)}</title>`;
      if (node.variables && node.variables.length > 0) {
        const badgeX = cx + node.w - 14;
        svg += `<circle cx="${badgeX}" cy="${y + 18}" r="10" fill="${color.border}" opacity="0.15"/>`;
        svg += `<text x="${badgeX}" y="${y + 22}" font-size="10" fill="${color.text}" text-anchor="middle" font-family="monospace" font-weight="700">${node.variables.length}</text>`;
        svg += `<title>Variables: ${node.variables.map((variable) => variable.name).join(', ')}</title>`;
      }
    }

    const topPad = isLabel ? LABEL_H + 6 : CONTAINER_PAD_TOP;
    let currentY = y + topPad;
    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index];
      svg += renderNode(child, cx + CONTAINER_PAD_X, currentY, node.w - CONTAINER_PAD_X * 2);
      if (index < node.children.length - 1) {
        const lineX = cx + node.w / 2;
        svg += `<line x1="${lineX}" y1="${currentY + child.h}" x2="${lineX}" y2="${currentY + child.h + V_GAP}" stroke="${THEME.connectorStroke}" stroke-width="1.5" marker-end="url(#arrowhead)"/>`;
      }
      currentY += child.h + V_GAP;
    }
    svg += `</g>`;
    return svg;
  }

  function renderFlowchart(fcNode) {
    const nodes = fcNode.flowNodes || [];
    const edges = fcNode.flowEdges || [];
    if (nodes.length === 0) return { svg: '', w: NODE_W, h: 80 };

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 70, edgesep: 35, marginx: 40, marginy: 40 });
    graph.setDefaultEdgeLabel(() => ({}));

    const flowW = 280;
    const flowH = 50;
    const decisionW = 200;
    const decisionH = 60;

    const flowHeaderH = 36;
    const flowPadX = 14;
    const flowPadBottom = 12;

    nodes.forEach((node) => {
      const isDecision = node.flowType === 'FlowDecision' || node.flowType === 'FlowSwitch';
      let nodeW = isDecision ? decisionW : flowW;
      let nodeH = isDecision ? decisionH : flowH;
      let laidOutInner = null;

      if (!isDecision && !node.collapsed && node.innerActivity?.children?.length > 0) {
        laidOutInner = layoutNode(node.innerActivity);
        nodeW = Math.max(nodeW, laidOutInner.w + flowPadX * 2);
        nodeH = flowHeaderH + laidOutInner.h + flowPadBottom;
      }

      graph.setNode(node.id, { width: nodeW, height: nodeH, flowNode: node, laidOutInner });
    });
    edges.forEach((edge) => graph.setEdge(edge.from, edge.to, { label: edge.label || '' }));
    dagre.layout(graph);

    const graphW = graph.graph().width || 400;
    const graphH = graph.graph().height || 300;
    const totalW = graphW + 80;
    const totalH = graphH + 80;
    const accent = diffColor(fcNode._diffStatus);
    let svg = '';

    svg += `<rect x="0" y="0" width="${totalW}" height="${totalH}" rx="12" fill="${THEME.canvasBg}" stroke="${accent || THEME.canvasBorder}" stroke-width="${accent ? 2.5 : 1.5}"/>`;
    if (accent) svg += `<rect x="0" y="0" width="4" height="34" rx="2" fill="${accent}"/>`;
    svg += `<text x="20" y="26" font-size="15" fill="${THEME.titleText}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="700">◈ ${esc(truncate(fcNode.displayName, 44))}</text>`;

    const offsetY = 40;
    graph.edges().forEach((edgeRef) => {
      const edge = graph.edge(edgeRef);
      const points = edge.points || [];
      if (points.length < 2) return;
      let path = `M${points[0].x + 40},${points[0].y + offsetY}`;
      if (points.length === 2) {
        path += ` L${points[1].x + 40},${points[1].y + offsetY}`;
      } else {
        for (let i = 1; i < points.length - 1; i++) {
          const cpX = points[i].x + 40;
          const cpY = points[i].y + offsetY;
          const nextX = (points[i].x + points[i + 1].x) / 2 + 40;
          const nextY = (points[i].y + points[i + 1].y) / 2 + offsetY;
          path += ` Q${cpX},${cpY} ${nextX},${nextY}`;
        }
        const last = points[points.length - 1];
        path += ` L${last.x + 40},${last.y + offsetY}`;
      }
      const isTrue = edge.label === 'True';
      const isFalse = edge.label === 'False';
      const edgeColor = isTrue ? THEME.edgeTrue : isFalse ? THEME.edgeFalse : THEME.edgeDefault;
      svg += `<path d="${path}" fill="none" stroke="${edgeColor}" stroke-width="1.8" marker-end="url(#ah-${isTrue ? 't' : isFalse ? 'f' : 'd'})"/>`;
      if (edge.label) {
        const mid = Math.floor(points.length / 2);
        const labelX = points[mid].x + 40;
        const labelY = points[mid].y + offsetY;
        const labelW = Math.max(40, edge.label.length * 7 + 16);
        svg += `<rect x="${labelX - labelW / 2}" y="${labelY - 10}" width="${labelW}" height="18" rx="4" fill="${THEME.edgeLabelBg}" stroke="${THEME.edgeLabelBorder}" stroke-width="0.5"/>`;
        svg += `<text x="${labelX}" y="${labelY + 3}" font-size="11" fill="${edgeColor}" text-anchor="middle" font-family="'SF Pro Text',system-ui,sans-serif" font-weight="600">${esc(edge.label)}</text>`;
      }
    });

    graph.nodes().forEach((nodeId) => {
      const graphNode = graph.node(nodeId);
      if (!graphNode?.flowNode) return;
      const node = graphNode.flowNode;
      const cx = graphNode.x + 40;
      const cy = graphNode.y + offsetY;
      const halfW = graphNode.width / 2;
      const halfH = graphNode.height / 2;
      const accentColor = diffColor(node._diffStatus);

      if (node.flowType === 'FlowDecision' || node.flowType === 'FlowSwitch') {
        const color = COLORS.decision;
        svg += `<g class="uxv-node${accentColor ? ` uxv-diff-${node._diffStatus}` : ''}" data-id="${node.id}" data-type="${esc(node.flowType)}" data-category="${node.category}" role="treeitem" aria-label="${esc(node.displayName)} (${esc(node.flowType)})">`;
        svg += `<polygon points="${cx},${cy - halfH} ${cx + halfW},${cy} ${cx},${cy + halfH} ${cx - halfW},${cy}" fill="${color.bg}" stroke="${accentColor || color.border}" stroke-width="${accentColor ? 2.6 : 2}"/>`;
        if (accentColor) svg += `<polygon points="${cx},${cy - halfH} ${cx + halfW},${cy} ${cx},${cy + halfH} ${cx - halfW},${cy}" fill="${accentColor}" opacity="0.06"/>`;
        svg += `<text x="${cx}" y="${cy + 4}" font-size="11" fill="${color.text}" text-anchor="middle" font-family="'SF Pro Text',system-ui,sans-serif" font-weight="600">${esc(truncate(node.displayName, 22))}</text>`;
        if (node.condition) svg += `<title>${esc(node.condition)}</title>`;
        svg += `</g>`;
      } else if (graphNode.laidOutInner) {
        // Expanded FlowStep — show inner activity tree
        const color = COLORS[node.category] || COLORS.default;
        const x0 = cx - halfW;
        const y0 = cy - halfH;
        const w = graphNode.width;
        const h = graphNode.height;
        svg += `<g class="uxv-container" data-id="${node.id}" data-type="${esc(node.activityType || node.flowType)}" data-category="${node.category}" role="group" aria-label="${esc(node.displayName)}" aria-expanded="true">`;
        if (accentColor) svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${CORNER_R}" fill="${accentColor}" opacity="0.04"/>`;
        svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${CORNER_R}" fill="${color.bg}" stroke="${accentColor || color.border}" stroke-width="2" opacity="0.3"/>`;
        if (accentColor) svg += `<rect x="${x0}" y="${y0}" width="4" height="${flowHeaderH}" rx="2" fill="${accentColor}"/>`;
        svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${flowHeaderH}" rx="${CORNER_R}" fill="${color.border}" opacity="0.1" data-toggle="true" style="cursor:pointer"/>`;
        svg += `<text x="${x0 + 12}" y="${y0 + 22}" font-size="13" fill="${color.border}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer">▼</text>`;
        svg += `<text x="${x0 + 28}" y="${y0 + 22}" font-size="12" fill="${color.text}" font-family="'SF Pro Text',system-ui,sans-serif" font-weight="700">${color.icon} ${esc(truncate(node.displayName, 30))}</text>`;
        if (node.displayName.length > 30) svg += `<title>${esc(node.displayName)}</title>`;
        svg += annotationIcon(x0 + w - 14, y0 + 14, node.annotation);
        const innerX = x0 + flowPadX;
        const innerY = y0 + flowHeaderH;
        const innerW = w - flowPadX * 2;
        svg += renderNode(graphNode.laidOutInner, innerX, innerY, innerW);
        svg += `</g>`;
      } else if (node.innerActivity?.children?.length > 0 && node.collapsed) {
        // Collapsed FlowStep with expandable inner activity
        const color = COLORS[node.category] || COLORS.default;
        svg += `<g class="uxv-node uxv-collapsed" data-id="${node.id}" data-type="${esc(node.activityType || node.flowType)}" data-category="${node.category}" role="group" aria-label="${esc(node.displayName)}" aria-expanded="false">`;
        svg += `<rect x="${cx - halfW}" y="${cy - halfH}" width="${graphNode.width}" height="${graphNode.height}" rx="${CORNER_R}" fill="${color.bg}" stroke="${accentColor || color.border}" stroke-width="${accentColor ? 2.2 : 1.5}" stroke-dasharray="6,3" data-toggle="true" style="cursor:pointer"/>`;
        if (accentColor) svg += `<rect x="${cx - halfW}" y="${cy - halfH}" width="4" height="${graphNode.height}" rx="2" fill="${accentColor}"/>`;
        svg += `<text x="${cx - halfW + 12}" y="${cy + 1}" font-size="13" fill="${color.border}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer" dominant-baseline="middle">▶</text>`;
        svg += `<text x="${cx - halfW + 28}" y="${cy + 1}" font-size="12" fill="${color.text}" font-family="'SF Pro Text',system-ui,sans-serif" font-weight="600" dominant-baseline="middle">${esc(truncate(node.displayName, 22))}</text>`;
        if (node.displayName.length > 22) svg += `<title>${esc(node.displayName)}</title>`;
        svg += annotationIcon(cx + halfW - 14, cy - halfH + 14, node.annotation);
        svg += `</g>`;
      } else {
        // Leaf FlowStep (no expandable children)
        const color = COLORS[node.category] || COLORS.default;
        svg += `<g class="uxv-node${accentColor ? ` uxv-diff-${node._diffStatus}` : ''}" data-id="${node.id}" data-type="${esc(node.activityType || node.flowType)}" data-category="${node.category}" role="treeitem" aria-label="${esc(node.displayName)} (${esc(node.activityType || node.flowType)})">`;
        svg += `<rect x="${cx - halfW}" y="${cy - halfH}" width="${graphNode.width}" height="${graphNode.height}" rx="${CORNER_R}" fill="${color.bg}" stroke="${accentColor || color.border}" stroke-width="${accentColor ? 2.2 : 1.5}" class="uxv-rect"/>`;
        if (accentColor) {
          svg += `<rect x="${cx - halfW}" y="${cy - halfH}" width="4" height="${graphNode.height}" rx="2" fill="${accentColor}"/>`;
          svg += `<rect x="${cx - halfW}" y="${cy - halfH}" width="${graphNode.width}" height="${graphNode.height}" rx="${CORNER_R}" fill="${accentColor}" opacity="0.06"/>`;
        }
        svg += `<text x="${cx - halfW + 12}" y="${cy + 1}" font-size="14" fill="${color.border}" font-family="monospace" dominant-baseline="middle">${color.icon}</text>`;
        svg += `<text x="${cx - halfW + 30}" y="${cy + 1}" font-size="12" fill="${color.text}" font-family="'SF Pro Text',system-ui,sans-serif" font-weight="500" dominant-baseline="middle">${esc(truncate(node.displayName, 28))}</text>`;
        if ((node.activityType === 'InvokeWorkflowFile') && node.properties?.WorkflowFileName) {
          svg += `<title>Double-click to open: ${esc(node.properties.WorkflowFileName)}</title>`;
        } else if (node.displayName.length > 28) {
          svg += `<title>${esc(node.displayName)}</title>`;
        }
        svg += annotationIcon(cx + halfW - 14, cy - halfH + 14, node.annotation);
        svg += `</g>`;
      }
    });

    return { svg, w: totalW, h: totalH };
  }

  function renderStateMachine(smNode) {
    const nodes = smNode.stateNodes || [];
    const edges = smNode.stateEdges || [];
    if (nodes.length === 0) return { svg: '', w: NODE_W, h: 80 };

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 90, edgesep: 40, marginx: 50, marginy: 50 });
    graph.setDefaultEdgeLabel(() => ({}));

    const stateW = 300;
    const stateH = 60;
    const stateHeaderH = 40;
    const statePadX = 14;
    const statePadBottom = 12;
    const initR = 16;
    const initId = '__sm_init__';
    const rx = 14;
    graph.setNode(initId, { width: initR * 2, height: initR * 2 + 30, isInit: true });

    // Two-pass: measure states (expanded ones include entry content)
    nodes.forEach((node) => {
      const nameLen = (node.displayName || '').length;
      let nodeW = Math.max(stateW, nameLen * 9 + 40);
      let nodeH = stateH;
      let laidOutEntry = null;

      if (!node.collapsed && node.entryNode) {
        laidOutEntry = layoutNode(node.entryNode);
        nodeW = Math.max(nodeW, laidOutEntry.w + statePadX * 2);
        nodeH = stateHeaderH + laidOutEntry.h + statePadBottom;
      }

      graph.setNode(node.id, { width: nodeW, height: nodeH, stateNode: node, laidOutEntry });
    });
    if (smNode.initialStateId) graph.setEdge(initId, smNode.initialStateId, { label: '' });
    const edgeLookup = new Map();
    edges.forEach((edge) => {
      graph.setEdge(edge.from, edge.to, { label: edge.label || '' });
      edgeLookup.set(`${edge.from}\0${edge.to}`, edge);
    });
    dagre.layout(graph);

    const graphW = graph.graph().width || 400;
    const graphH = graph.graph().height || 300;
    const pad = 50;
    const totalW = graphW + pad * 2;
    const totalH = graphH + pad + 44;
    const accent = diffColor(smNode._diffStatus);
    let svg = '';

    // Container
    svg += `<rect x="0" y="0" width="${totalW}" height="${totalH}" rx="12" fill="${THEME.canvasBg}" stroke="${accent || THEME.canvasBorder}" stroke-width="${accent ? 2.5 : 1.5}"/>`;
    if (accent) svg += `<rect x="0" y="0" width="4" height="34" rx="2" fill="${accent}"/>`;
    svg += `<text x="20" y="28" font-size="15" fill="${THEME.titleText}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="700">&#9670; ${esc(truncate(smNode.displayName, 44))}</text>`;

    const offsetY = 44;

    // Edges (render before nodes so nodes sit on top)
    graph.edges().forEach((edgeRef) => {
      const dagreEdge = graph.edge(edgeRef);
      const srcEdge = edgeLookup.get(`${edgeRef.v}\0${edgeRef.w}`);
      const points = dagreEdge.points || [];
      if (points.length < 2) return;
      let path = `M${points[0].x + pad},${points[0].y + offsetY}`;
      if (points.length === 2) {
        path += ` L${points[1].x + pad},${points[1].y + offsetY}`;
      } else {
        for (let i = 1; i < points.length - 1; i++) {
          const cpX = points[i].x + pad;
          const cpY = points[i].y + offsetY;
          const nextX = (points[i].x + points[i + 1].x) / 2 + pad;
          const nextY = (points[i].y + points[i + 1].y) / 2 + offsetY;
          path += ` Q${cpX},${cpY} ${nextX},${nextY}`;
        }
        const last = points[points.length - 1];
        path += ` L${last.x + pad},${last.y + offsetY}`;
      }
      svg += `<path d="${path}" fill="none" stroke="${THEME.edgeStroke}" stroke-width="1.6" marker-end="url(#ah-sm)"/>`;
      const edgeLabel = dagreEdge.label || '';
      const trigger = srcEdge?.trigger;
      const action = srcEdge?.action;
      const annotation = srcEdge?.annotation;
      const edgeFrom = srcEdge?.from || edgeRef.v;
      const edgeTo = srcEdge?.to || edgeRef.w;
      if (edgeLabel || trigger || action) {
        const mid = Math.floor(points.length / 2);
        const labelX = points[mid].x + pad;
        const labelY = points[mid].y + offsetY;

        const lines = [];
        if (trigger) lines.push({ text: `[${esc(truncate(trigger.displayName || trigger.type, 24))}]`, style: `font-style:italic;fill:${THEME.edgeLabelMuted}`, size: 10 });
        if (edgeLabel) lines.push({ text: esc(truncate(edgeLabel, 30)), style: `fill:${THEME.edgeLabelText};font-weight:600`, size: 11 });
        if (action) lines.push({ text: `[${esc(truncate(action.displayName || action.type, 24))}]`, style: `font-style:italic;fill:${THEME.edgeLabelMuted}`, size: 10 });

        const lineHeight = 16;
        const totalH = lines.length * lineHeight + 8;
        const maxTextLen = Math.max(...lines.map((l) => l.text.length));
        const labelW = Math.max(60, maxTextLen * 7 + 24);
        const topY = labelY - totalH / 2;

        svg += `<g class="uxv-edge-label" data-edge-from="${edgeFrom}" data-edge-to="${edgeTo}">`;
        svg += `<rect x="${labelX - labelW / 2}" y="${topY}" width="${labelW}" height="${totalH}" rx="4" fill="${THEME.edgeLabelBg}" stroke="${THEME.edgeLabelBorder}" stroke-width="0.5"/>`;

        lines.forEach((line, i) => {
          const ty = topY + 12 + i * lineHeight;
          svg += `<text x="${labelX}" y="${ty}" font-size="${line.size}" style="${line.style}" text-anchor="middle" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif">${line.text}</text>`;
        });

        if (annotation) {
          const noteX = labelX + labelW / 2 - 6;
          const noteY = topY - 4;
          svg += `<text x="${noteX}" y="${noteY}" font-size="11" fill="#F9A825" title="${esc(annotation)}">&#128221;</text>`;
        }

        const titleParts = [];
        if (annotation) titleParts.push(`Note: ${annotation}`);
        if (trigger) titleParts.push(`Trigger: ${trigger.displayName || trigger.type}`);
        if (edgeLabel) titleParts.push(`Condition: ${edgeLabel}`);
        if (action) titleParts.push(`Action: ${action.displayName || action.type}`);
        if (titleParts.length) svg += `<title>${esc(titleParts.join('\n'))}</title>`;

        svg += `</g>`;
      }
    });

    // Nodes
    graph.nodes().forEach((nodeId) => {
      const graphNode = graph.node(nodeId);
      if (!graphNode) return;
      const cx = graphNode.x + pad;
      const cy = graphNode.y + offsetY;

      if (graphNode.isInit) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${initR}" fill="${THEME.initFill}" stroke="${THEME.initStroke}" stroke-width="2.5"/>`;
        svg += `<line x1="${cx}" y1="${cy + initR}" x2="${cx}" y2="${cy + initR + 20}" stroke="${THEME.initFill}" stroke-width="2" marker-end="url(#ah-sm)"/>`;
        return;
      }

      const node = graphNode.stateNode;
      if (!node) return;
      const halfW = graphNode.width / 2;
      const halfH = graphNode.height / 2;
      const accentColor = diffColor(node._diffStatus);
      const x0 = cx - halfW;
      const y0 = cy - halfH;
      const w = graphNode.width;
      const h = graphNode.height;
      const hasEntry = !!node.entryNode;
      const isExpanded = hasEntry && !node.collapsed;

      if (node.isFinal && !isExpanded) {
        // Final state (collapsed or no entry)
        const cls = hasEntry ? 'uxv-collapsed' : 'uxv-node';
        svg += `<g class="${cls}${accentColor ? ` uxv-diff-${node._diffStatus}` : ''}" data-id="${node.id}" data-type="FinalState" data-category="${node.category}" role="treeitem" aria-label="${esc(node.displayName)} (FinalState)"${hasEntry ? ' aria-expanded="false"' : ''}>`;
        svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${rx}" fill="${THEME.finalBg}" stroke="${accentColor || THEME.finalBorder}" stroke-width="${accentColor ? 3.4 : 2.5}"${hasEntry ? ' data-toggle="true" style="cursor:pointer"' : ''}/>`;
        if (accentColor) svg += `<rect x="${x0}" y="${y0}" width="4" height="${h}" rx="2" fill="${accentColor}"/>`;
        svg += `<rect x="${x0 + 4}" y="${y0 + 4}" width="${w - 8}" height="${h - 8}" rx="${rx - 3}" fill="none" stroke="${accentColor || THEME.finalBorder}" stroke-width="1.2"/>`;
        if (hasEntry) {
          svg += `<text x="${x0 + 14}" y="${cy + 5}" font-size="14" fill="${THEME.finalBorder}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer">▶</text>`;
          svg += `<text x="${x0 + 32}" y="${cy + 5}" font-size="14" fill="${THEME.finalText}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="600">${esc(truncate(node.displayName, 26))}</text>`;
        } else {
          svg += `<text x="${cx}" y="${cy + 5}" font-size="14" fill="${THEME.finalText}" text-anchor="middle" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="600">${esc(truncate(node.displayName, 30))}</text>`;
        }
        if (node.annotation) svg += `<title>${esc(node.annotation)}</title>`;
        else if (node.displayName.length > 26) svg += `<title>${esc(node.displayName)}</title>`;
        svg += annotationIcon(x0 + w - 14, y0 + 14, node.annotation);
        svg += `</g>`;
      } else if (isExpanded) {
        // Expanded state (regular or final) — show entry content
        const isFinal = node.isFinal;
        const bgFill = isFinal ? THEME.finalBg : THEME.stateBg;
        const borderColor = accentColor || (isFinal ? THEME.finalBorder : THEME.stateBorder);
        const textColor = isFinal ? THEME.finalText : THEME.stateText;
        const headerFill = isFinal ? THEME.finalBorder : THEME.stateBorder;

        svg += `<g class="uxv-container" data-id="${node.id}" data-type="${isFinal ? 'FinalState' : 'State'}" data-category="${node.category}" role="group" aria-label="${esc(node.displayName)}" aria-expanded="true">`;
        svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${rx}" fill="${bgFill}" stroke="${borderColor}" stroke-width="${accentColor ? 3 : 2.2}" opacity="0.3"/>`;
        if (accentColor) svg += `<rect x="${x0}" y="${y0}" width="4" height="${stateHeaderH}" rx="2" fill="${accentColor}"/>`;
        // Header bar
        svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${stateHeaderH}" rx="${rx}" fill="${headerFill}" opacity="0.1" data-toggle="true" style="cursor:pointer"/>`;
        svg += `<text x="${x0 + 12}" y="${y0 + 25}" font-size="13" fill="${headerFill}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer">▼</text>`;
        svg += `<text x="${x0 + 28}" y="${y0 + 25}" font-size="13" fill="${textColor}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="700">${esc(truncate(node.displayName, 34))}</text>`;
        if (node.annotation) svg += `<title>${esc(node.annotation)}</title>`;
        else if (node.displayName.length > 34) svg += `<title>${esc(node.displayName)}</title>`;
        svg += annotationIcon(x0 + w - 14, y0 + 14, node.annotation);
        // Entry content
        if (graphNode.laidOutEntry) {
          const entryX = x0 + statePadX;
          const entryY = y0 + stateHeaderH;
          const innerW = w - statePadX * 2;
          svg += renderNode(graphNode.laidOutEntry, entryX, entryY, innerW);
        }
        svg += `</g>`;
      } else {
        // Regular state (collapsed or no entry)
        const cls = hasEntry ? 'uxv-collapsed' : 'uxv-node';
        svg += `<g class="${cls}${accentColor ? ` uxv-diff-${node._diffStatus}` : ''}" data-id="${node.id}" data-type="State" data-category="${node.category}" role="treeitem" aria-label="${esc(node.displayName)} (State)"${hasEntry ? ' aria-expanded="false"' : ''}>`;
        svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${rx}" fill="${THEME.stateBg}" stroke="${accentColor || THEME.stateBorder}" stroke-width="${accentColor ? 3 : 2.2}"${hasEntry ? ' data-toggle="true" style="cursor:pointer"' : ''}/>`;
        if (accentColor) {
          svg += `<rect x="${x0}" y="${y0}" width="4" height="${h}" rx="2" fill="${accentColor}"/>`;
          svg += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${rx}" fill="${accentColor}" opacity="0.06"/>`;
        }
        if (hasEntry) {
          svg += `<text x="${x0 + 14}" y="${cy + 5}" font-size="14" fill="${THEME.stateBorder}" font-family="monospace" class="uxv-toggle-icon" data-toggle="true" style="cursor:pointer">▶</text>`;
          svg += `<text x="${x0 + 32}" y="${cy + 5}" font-size="14" fill="${THEME.stateText}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="600">${esc(truncate(node.displayName, 26))}</text>`;
        } else {
          svg += `<text x="${cx}" y="${cy + 5}" font-size="14" fill="${THEME.stateText}" text-anchor="middle" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="600">${esc(truncate(node.displayName, 30))}</text>`;
        }
        if (node.annotation) svg += `<title>${esc(node.annotation)}</title>`;
        else if (node.displayName.length > 26) svg += `<title>${esc(node.displayName)}</title>`;
        svg += annotationIcon(x0 + w - 14, y0 + 14, node.annotation);
        svg += `</g>`;
      }
    });

    return { svg, w: totalW, h: totalH };
  }

  const LARGE_WORKFLOW_THRESHOLD = 150;

  function countNodes(node) {
    if (!node) return 0;
    let count = 1;
    for (const child of node.children || []) count += countNodes(child);
    for (const fn of node.flowNodes || []) { count++; if (fn.innerActivity) count += countNodes(fn.innerActivity); }
    for (const sn of node.stateNodes || []) { count++; if (sn.entryNode) count += countNodes(sn.entryNode); }
    return count;
  }

  function autoCollapseDeep(node, depth, maxDepth) {
    if (!node) return;
    if (depth >= maxDepth && (node.children?.length > 0 || node.stateNodes?.length > 0)) {
      node.collapsed = true;
    }
    for (const child of node.children || []) autoCollapseDeep(child, depth + 1, maxDepth);
    for (const fn of node.flowNodes || []) { if (fn.innerActivity) autoCollapseDeep(fn.innerActivity, depth + 1, maxDepth); }
    for (const sn of node.stateNodes || []) { if (sn.entryNode) autoCollapseDeep(sn.entryNode, depth + 1, maxDepth); }
  }

  function render(parsed) {
    const dark = isDarkMode();
    COLORS = dark ? COLORS_DARK : COLORS_LIGHT;
    THEME = dark ? THEME_DARK : THEME_LIGHT;
    if (parsed.error) return `<div class="uxv-error">${esc(parsed.error)}</div>`;

    // Auto-collapse deep containers on large workflows to avoid rendering timeouts
    const nodeCount = countNodes(parsed.tree);
    if (nodeCount > LARGE_WORKFLOW_THRESHOLD) {
      autoCollapseDeep(parsed.tree, 0, 2);
    }

    let bodySvg = '';
    let totalW = 0;
    let totalH = 0;

    if (parsed.tree.type === 'StateMachine') {
      const rendered = renderStateMachine(parsed.tree);
      bodySvg = rendered.svg;
      totalW = rendered.w + 40;
      totalH = rendered.h + 40;
    } else if (parsed.tree.type === 'Flowchart') {
      const rendered = renderFlowchart(parsed.tree);
      bodySvg = rendered.svg;
      totalW = rendered.w + 40;
      totalH = rendered.h + 40;
    } else {
      const laidOut = layoutNode(parsed.tree);
      totalW = laidOut.w + 40;
      totalH = laidOut.h + 40;
      bodySvg = renderNode(laidOut, 20, 20, null);
    }

    let panelHtml = '';

    if (parsed.arguments?.length > 0) {
      panelHtml += `<details class="uxv-panel-section" open><summary><h4>Arguments (${parsed.arguments.length})</h4></summary><table><tr><th>Dir</th><th>Name</th><th>Type</th></tr>`;
      parsed.arguments.forEach((arg) => {
        panelHtml += `<tr><td class="uxv-dir uxv-dir-${arg.direction.toLowerCase().replace('/', '')}" title="${esc(arg.direction)}">${esc(arg.direction)}</td><td class="uxv-cell-ellipsis" title="${esc(arg.name)}">${esc(arg.name)}</td><td class="uxv-type uxv-cell-ellipsis" title="${esc(arg.type)}">${esc(arg.type)}</td></tr>`;
      });
      panelHtml += `</table></details>`;
    }

    const allVariables = [];
    function collectVariables(node, scope) {
      if (node.variables) node.variables.forEach((variable) => allVariables.push({ ...variable, scope: scope || node.displayName }));
      (node.children || []).forEach((child) => collectVariables(child, child.displayName));
      (node.flowNodes || []).forEach((fn) => {
        if (fn.innerActivity) collectVariables(fn.innerActivity, fn.displayName);
      });
      (node.stateNodes || []).forEach((sn) => {
        if (sn.entryNode) collectVariables(sn.entryNode, sn.displayName);
      });
    }
    collectVariables(parsed.tree, parsed.tree.displayName);
    if (allVariables.length > 0) {
      const hasDefaults = allVariables.some((variable) => variable.default);
      panelHtml += `<details class="uxv-panel-section" open><summary><h4>Variables (${allVariables.length})</h4></summary><table><tr><th>Name</th><th>Type</th>${hasDefaults ? '<th>Default</th>' : ''}<th>Scope</th></tr>`;
      allVariables.forEach((variable) => {
        panelHtml += `<tr><td class="uxv-varname" data-varname="${esc(variable.name)}" title="Click to highlight references" style="cursor:pointer">${esc(variable.name)}</td><td class="uxv-type uxv-cell-ellipsis" title="${esc(variable.type)}">${esc(variable.type)}</td>${hasDefaults ? `<td class="uxv-type uxv-cell-ellipsis" title="${esc(variable.default || '')}">${esc(variable.default || '')}</td>` : ''}<td class="uxv-scope uxv-cell-ellipsis" title="${esc(variable.scope)}">${esc(variable.scope)}</td></tr>`;
      });
      panelHtml += `</table></details>`;
    }


    const defs = `<defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${THEME.edgeDefault}"/></marker>
      <marker id="ah-d" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${THEME.edgeDefault}"/></marker>
      <marker id="ah-t" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${THEME.edgeTrue}"/></marker>
      <marker id="ah-f" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${THEME.edgeFalse}"/></marker>
      <marker id="ah-sm" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${THEME.edgeDefault}"/></marker>
    </defs>`;

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" class="uxv-svg" role="img" aria-label="UiPath workflow diagram">${defs}${bodySvg}</svg>`;
    return { svgContent, panelHtml, totalW, totalH, tree: parsed.tree, parsed };
  }

  function setupPanZoom(wrap, canvas, opts = {}) {
    const ac = new AbortController();
    const signal = { signal: ac.signal };
    let scale = opts.scale || 1;
    let tx = opts.tx || 0;
    let ty = opts.ty || 0;
    let panning = false;
    let startX = 0;
    let startY = 0;

    function apply(nextState) {
      if (nextState) {
        if (typeof nextState.scale === 'number') scale = nextState.scale;
        if (typeof nextState.tx === 'number') tx = nextState.tx;
        if (typeof nextState.ty === 'number') ty = nextState.ty;
      }
      canvas.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
      if (opts.onZoom) opts.onZoom(scale);
      if (opts.onViewChange) opts.onViewChange({ scale, tx, ty });
    }

    if (opts.scale) apply();

    wrap.addEventListener('wheel', (event) => {
      event.preventDefault();
      scale = Math.max(0.1, Math.min(4, scale * (event.deltaY > 0 ? 0.9 : 1.1)));
      apply();
    }, { passive: false, signal: ac.signal });

    wrap.style.touchAction = 'none';

    let hasMoved = false;
    wrap.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      panning = true;
      hasMoved = false;
      startX = event.clientX - tx;
      startY = event.clientY - ty;
      wrap.style.cursor = 'grabbing';
    }, signal);

    wrap.addEventListener('pointermove', (event) => {
      if (!panning) return;
      if (!hasMoved) {
        hasMoved = true;
        wrap.setPointerCapture(event.pointerId);
      }
      tx = event.clientX - startX;
      ty = event.clientY - startY;
      apply();
    }, signal);

    wrap.addEventListener('pointerup', (event) => {
      panning = false;
      wrap.style.cursor = 'grab';
      if (hasMoved) wrap.releasePointerCapture(event.pointerId);
      hasMoved = false;
    }, signal);

    wrap.addEventListener('pointercancel', (_event) => {
      panning = false;
      wrap.style.cursor = 'grab';
      hasMoved = false;
    }, signal);

    // Pinch-to-zoom via touch events
    let lastTouchDist = 0;
    wrap.addEventListener('touchstart', (event) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);
      }
    }, { passive: false, signal: ac.signal });

    wrap.addEventListener('touchmove', (event) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastTouchDist > 0) {
          scale = Math.max(0.1, Math.min(4, scale * (dist / lastTouchDist)));
          apply();
        }
        lastTouchDist = dist;
      }
    }, { passive: false, signal: ac.signal });

    wrap.addEventListener('touchend', () => { lastTouchDist = 0; }, signal);

    function smoothApply() {
      canvas.style.transition = 'transform 0.2s ease-out';
      apply();
      setTimeout(() => { canvas.style.transition = ''; }, 220);
    }

    function zoomIn() {
      scale = Math.min(scale * 1.25, 4);
      smoothApply();
    }

    function zoomOut() {
      scale = Math.max(scale * 0.8, 0.1);
      smoothApply();
    }

    function fitToView() {
      const svg = canvas.querySelector('svg');
      if (!svg) return;
      const wrapRect = wrap.getBoundingClientRect();
      const svgW = parseFloat(svg.getAttribute('width')) || 800;
      const svgH = parseFloat(svg.getAttribute('height')) || 600;
      scale = Math.min(wrapRect.width / svgW, wrapRect.height / svgH, 1) * (opts.fitScale || 0.9);
      tx = Math.max((wrapRect.width - svgW * scale) / 2, 0);
      ty = Math.max((wrapRect.height - svgH * scale) / 2, 0);
      smoothApply();
    }

    function getState() {
      return { scale, tx, ty };
    }

    function pan(dx, dy) {
      tx += dx;
      ty += dy;
      apply();
    }

    function centerOn(x, y) {
      const wrapRect = wrap.getBoundingClientRect();
      tx = wrapRect.width / 2 - x * scale;
      ty = wrapRect.height / 2 - y * scale;
      apply();
    }

    return { ac, zoomIn, zoomOut, fitToView, getState, apply, pan, centerOn };
  }

  function renderSequenceFlowchart(parsed) {
    COLORS = isDarkMode() ? COLORS_DARK : COLORS_LIGHT;
    const THEME = isDarkMode() ? THEME_DARK : THEME_LIGHT;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 50, edgesep: 30, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    const nodeMap = new Map();
    let counter = 0;

    function addNode(node, w, h) {
      const id = node.id || `sfc_${counter++}`;
      g.setNode(id, { width: w, height: h });
      nodeMap.set(id, node);
      return id;
    }

    const DECISION_TYPES = new Set(['If', 'Switch', 'FlowDecision', 'FlowSwitch']);
    const CONTAINER_TYPES = new Set(['TryCatch', 'ForEach', 'ParallelForEach', 'While', 'DoWhile', 'ForEachRow', 'RetryScope']);

    // Convert sequential tree to graph nodes+edges, returns { entryId, exitIds }
    function processChain(children) {
      const filtered = (children || []).filter((c) => !c.type?.startsWith('§'));
      let prevExitIds = null;
      let firstEntry = null;
      for (const child of filtered) {
        const r = processNode(child);
        if (!r.entryId) continue;
        if (!firstEntry) firstEntry = r.entryId;
        if (prevExitIds) prevExitIds.forEach((eid) => g.setEdge(eid, r.entryId));
        prevExitIds = r.exitIds;
      }
      return { entryId: firstEntry, exitIds: prevExitIds || [] };
    }

    function processNode(node) {
      if (!node) return { entryId: null, exitIds: [] };

      // Sequence container: flatten children
      if (node.type === 'Sequence' && node.children?.length) {
        return processChain(node.children);
      }

      // If/Switch: diamond with branches
      if (DECISION_TYPES.has(node.type)) {
        const id = addNode({ ...node, _decision: true }, 200, 60);
        const thenChild = node.children?.find((c) => c.displayName?.startsWith('§Then'));
        const elseChild = node.children?.find((c) => c.displayName?.startsWith('§Else'));
        const mergeId = addNode({ id: node.id + '_merge', displayName: '', type: '__merge__', category: 'default' }, 20, 20);

        if (thenChild?.children?.length) {
          const r = processChain(thenChild.children);
          if (r.entryId) {
            g.setEdge(id, r.entryId, { label: 'True' });
            r.exitIds.forEach((eid) => g.setEdge(eid, mergeId));
          } else {
            g.setEdge(id, mergeId, { label: 'True' });
          }
        } else {
          g.setEdge(id, mergeId, { label: 'True' });
        }
        if (elseChild?.children?.length) {
          const r = processChain(elseChild.children);
          if (r.entryId) {
            g.setEdge(id, r.entryId, { label: 'False' });
            r.exitIds.forEach((eid) => g.setEdge(eid, mergeId));
          } else {
            g.setEdge(id, mergeId, { label: 'False' });
          }
        } else {
          g.setEdge(id, mergeId, { label: 'False' });
        }
        return { entryId: id, exitIds: [mergeId] };
      }

      // StateMachine: render states as nodes with transition edges
      if (node.type === 'StateMachine' && node.stateNodes?.length) {
        const stateIds = new Map();
        node.stateNodes.forEach((sn) => {
          const id = addNode(sn, 280, 50);
          stateIds.set(sn.id, id);
        });
        (node.stateEdges || []).forEach((edge) => {
          const fromId = stateIds.get(edge.from);
          const toId = stateIds.get(edge.to);
          if (fromId && toId) g.setEdge(fromId, toId, { label: edge.label || '' });
        });
        const initialId = stateIds.get(node.initialStateId) || stateIds.values().next().value;
        const finalIds = node.stateNodes.filter((sn) => sn.isFinal).map((sn) => stateIds.get(sn.id));
        return { entryId: initialId, exitIds: finalIds.length ? finalIds : [initialId] };
      }

      // Flowchart: pass through existing nodes
      if (node.type === 'Flowchart' && node.flowNodes?.length) {
        const flowIds = new Map();
        node.flowNodes.forEach((fn) => {
          const isDecision = fn.flowType === 'FlowDecision' || fn.flowType === 'FlowSwitch';
          const id = addNode({ ...fn, _decision: isDecision }, isDecision ? 200 : 280, isDecision ? 60 : 50);
          flowIds.set(fn.id, id);
        });
        (node.flowEdges || []).forEach((edge) => {
          const fromId = flowIds.get(edge.from);
          const toId = flowIds.get(edge.to);
          if (fromId && toId) g.setEdge(fromId, toId, { label: edge.label || '' });
        });
        const startNode = node.startNode ? flowIds.get(node.startNode.id) : flowIds.values().next().value;
        return { entryId: startNode, exitIds: [startNode] };
      }

      // Container types: show as single box (don't recurse)
      if (CONTAINER_TYPES.has(node.type)) {
        const id = addNode(node, 280, 50);
        return { entryId: id, exitIds: [id] };
      }

      // Leaf activity
      const id = addNode(node, 280, 50);
      return { entryId: id, exitIds: [id] };
    }

    const startId = addNode({ id: '__start__', displayName: 'Start', type: '__terminal__', category: 'default' }, 40, 40);
    const endId = addNode({ id: '__end__', displayName: 'End', type: '__terminal__', category: 'default' }, 40, 40);

    const result = processNode(parsed.tree);
    if (result.entryId) {
      g.setEdge(startId, result.entryId);
      result.exitIds.forEach((eid) => g.setEdge(eid, endId));
    } else {
      g.setEdge(startId, endId);
    }

    dagre.layout(g);

    const graphW = g.graph().width || 400;
    const graphH = g.graph().height || 300;
    const CORNER_R = 8;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${graphW}" height="${graphH}" style="background:${THEME.canvasBg}">`;
    svg += `<defs><marker id="sfc-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${THEME.edgeStroke}"/></marker></defs>`;

    // Render edges
    g.edges().forEach((e) => {
      const edge = g.edge(e);
      const points = edge.points || [];
      if (points.length < 2) return;
      const label = edge.label;
      const edgeColor = label === 'True' ? THEME.edgeTrue : label === 'False' ? THEME.edgeFalse : THEME.edgeStroke;
      let d = `M${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) d += ` L${points[i].x},${points[i].y}`;
      svg += `<path d="${d}" fill="none" stroke="${edgeColor}" stroke-width="1.5" marker-end="url(#sfc-arrow)"/>`;
      if (label) {
        const mid = points[Math.floor(points.length / 2)];
        svg += `<text x="${mid.x + 6}" y="${mid.y - 4}" font-size="10" fill="${edgeColor}" font-family="'SF Pro Text',system-ui,sans-serif" font-weight="600">${esc(label)}</text>`;
      }
    });

    // Render nodes
    g.nodes().forEach((id) => {
      const gn = g.node(id);
      const node = nodeMap.get(id);
      if (!node) return;
      const cx = gn.x;
      const cy = gn.y;
      const hw = gn.width / 2;
      const hh = gn.height / 2;

      if (node.type === '__terminal__') {
        svg += `<circle cx="${cx}" cy="${cy}" r="16" fill="${THEME.initFill}" stroke="${THEME.initStroke}" stroke-width="2"/>`;
        if (node.displayName === 'End') {
          svg += `<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="${THEME.initStroke}" stroke-width="1.5"/>`;
        }
        return;
      }

      if (node.type === '__merge__') {
        svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="${THEME.edgeStroke}" opacity="0.5"/>`;
        return;
      }

      const color = COLORS[node.category] || COLORS.default;
      if (node._decision) {
        // Diamond for If/Switch
        const dColor = COLORS.decision;
        svg += `<g data-id="${node.id}" data-type="${esc(node.type)}" data-category="decision" role="treeitem" aria-label="${esc(node.displayName)} (${esc(node.type)})">`;
        svg += `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}" fill="${dColor.bg}" stroke="${dColor.border}" stroke-width="2"/>`;
        svg += `<text x="${cx}" y="${cy + 4}" font-size="12" fill="${dColor.text}" text-anchor="middle" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="600">${esc(truncate(node.displayName, 20))}</text>`;
        if (node.displayName?.length > 20) svg += `<title>${esc(node.displayName)}</title>`;
        svg += `</g>`;
        return;
      }

      svg += `<g data-id="${node.id}" data-type="${esc(node.type)}" data-category="${node.category}" role="treeitem" aria-label="${esc(node.displayName)} (${esc(node.type)})">`;
      svg += `<rect x="${cx - hw}" y="${cy - hh}" width="${gn.width}" height="${gn.height}" rx="${CORNER_R}" fill="${color.bg}" stroke="${color.border}" stroke-width="1.5" class="uxv-rect"/>`;
      svg += `<text x="${cx - hw + 12}" y="${cy + 4}" font-size="14" fill="${color.border}" font-family="monospace">${color.icon}</text>`;
      svg += `<text x="${cx - hw + 30}" y="${cy + 4}" font-size="12" fill="${color.text}" font-family="'SF Pro Text',Segoe UI,system-ui,sans-serif" font-weight="500">${esc(truncate(node.displayName, 30))}</text>`;
      if (node.displayName?.length > 30) svg += `<title>${esc(node.displayName)}</title>`;
      svg += `</g>`;
    });

    svg += '</svg>';

    return { svgContent: svg, totalW: graphW, totalH: graphH };
  }

  return { render, renderSequenceFlowchart, get COLORS() { return COLORS; }, setupPanZoom, isDarkMode };
})();
