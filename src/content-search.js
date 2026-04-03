/**
 * UiPath XAML Visualizer — Search module.
 * Pure search functions extracted from content.js for maintainability.
 */
window.UiPathSearch = (() => {

  function findMatches(root, query) {
    const matches = [];
    const needle = query.toLowerCase();

    function visit(node) {
      if (!node) return;
      const type = (node.type || node.activityType || node.flowType || '').toLowerCase();
      const displayName = (node.displayName || '').toLowerCase();
      if (!((node.type || '').startsWith('§')) && (displayName.includes(needle) || type.includes(needle))) {
        matches.push(node);
      }
      (node.children || []).forEach(visit);
      (node.flowNodes || []).forEach((fn) => {
        visit(fn);
        if (fn.innerActivity) visit(fn.innerActivity);
      });
      (node.stateNodes || []).forEach((sn) => {
        visit(sn);
        if (sn.entryNode) visit(sn.entryNode);
      });
    }

    visit(root);
    return matches;
  }

  function expandAncestors(root, targetId) {
    let changed = false;
    function walk(node) {
      if (!node) return false;
      if (node.id === targetId) return true;
      for (const child of node.children || []) {
        if (walk(child)) {
          if (node.collapsed) { node.collapsed = false; changed = true; }
          return true;
        }
      }
      for (const fn of node.flowNodes || []) {
        if (fn.id === targetId) return true;
        if (fn.innerActivity && walk(fn.innerActivity)) return true;
      }
      for (const sn of node.stateNodes || []) {
        if (sn.id === targetId) return true;
        if (sn.entryNode && walk(sn.entryNode)) {
          if (sn.collapsed) { sn.collapsed = false; changed = true; }
          return true;
        }
      }
      return false;
    }
    walk(root);
    return changed;
  }

  return { findMatches, expandAncestors };
})();
