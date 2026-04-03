/**
 * UiPath XAML Visualizer — Export module (SVG, PNG).
 * Extracted from content.js for maintainability.
 */
window.UiPathExport = (() => {

  function sanitizeFilename(name) {
    return (name || 'workflow').replace(/[<>:"/\\|?*]+/g, '-').trim() || 'workflow';
  }

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function prepareSvgForExport(canvas) {
    const svg = canvas.querySelector('svg');
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const width = parseFloat(clone.getAttribute('width')) || 800;
    const height = parseFloat(clone.getAttribute('height')) || 600;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    const dark = window.UiPathRenderer?.isDarkMode?.() || false;
    bg.setAttribute('fill', dark ? '#161B22' : '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      svg { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
      text[font-family*="SF Pro"], text[font-family*="system-ui"] { font-family: "Segoe UI", Helvetica, Arial, sans-serif; }
      text[font-family*="SF Mono"], text[font-family*="Consolas"] { font-family: Consolas, "Courier New", monospace; }
    `;
    clone.insertBefore(style, clone.firstChild);
    return { clone, width, height };
  }

  function exportSvg(canvasSelector, workflowName) {
    const canvas = document.querySelector(canvasSelector);
    if (!canvas) return;
    const prepared = prepareSvgForExport(canvas);
    if (!prepared) return;
    const blob = new Blob([new XMLSerializer().serializeToString(prepared.clone)], { type: 'image/svg+xml;charset=utf-8' });
    downloadFile(blob, sanitizeFilename(workflowName) + '.svg');
  }

  function exportPng(canvasSelector, workflowName) {
    const canvas = document.querySelector(canvasSelector);
    if (!canvas) return;
    const prepared = prepareSvgForExport(canvas);
    if (!prepared) return;

    const img = new Image();
    img.onload = () => {
      const out = document.createElement('canvas');
      const scale = 2;
      out.width = prepared.width * scale;
      out.height = prepared.height * scale;
      const ctx = out.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      out.toBlob((blob) => {
        if (blob) downloadFile(blob, sanitizeFilename(workflowName) + '.png');
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(prepared.clone));
  }

  return { sanitizeFilename, downloadFile, prepareSvgForExport, exportSvg, exportPng };
})();
