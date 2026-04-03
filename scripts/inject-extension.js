/**
 * Playwright helper: inject the UXV extension into the current GitHub page.
 * Usage: browser_run_code with filename pointing to this file.
 */
const fs = require('fs');
const path = require('path');

const basePath = path.resolve(__dirname, '..');

module.exports = async (page) => {
  // Step 1: Mock chrome APIs
  await page.evaluate(() => {
    if (window.UXV) return;
    window.chrome = {
      storage: {
        local: {
          get(keys, cb) {
            const r = {};
            if (typeof keys === 'string') r[keys] = undefined;
            else if (Array.isArray(keys)) keys.forEach(k => { r[k] = undefined; });
            else if (keys && typeof keys === 'object') Object.keys(keys).forEach(k => { r[k] = keys[k]; });
            if (cb) setTimeout(() => cb(r), 0);
            return Promise.resolve(r);
          },
          set(obj, cb) { if (cb) setTimeout(cb, 0); return Promise.resolve(); }
        },
        sync: {
          get(keys, cb) {
            const r = {};
            if (typeof keys === 'string') r[keys] = undefined;
            else if (Array.isArray(keys)) keys.forEach(k => { r[k] = undefined; });
            if (cb) setTimeout(() => cb(r), 0);
            return Promise.resolve(r);
          },
          set(obj, cb) { if (cb) setTimeout(cb, 0); return Promise.resolve(); }
        },
        onChanged: { addListener() {} }
      },
      runtime: {
        getURL(p) { return p; },
        id: 'uxv-mock',
        onMessage: { addListener() {} },
        sendMessage() { return Promise.resolve(); }
      },
      permissions: {
        contains(perms, cb) { if (cb) setTimeout(() => cb(true), 0); return Promise.resolve(true); }
      }
    };
  });

  // Step 2: Inject CSS
  const css = fs.readFileSync(path.join(basePath, 'src/styles.css'), 'utf8');
  await page.evaluate((cssText) => {
    const s = document.createElement('style');
    s.textContent = cssText;
    (document.head || document.documentElement).appendChild(s);
  }, css);

  // Step 3: Inject scripts in manifest order
  const scripts = [
    'lib/dagre.min.js',
    'src/utils.js',
    'src/content-fetch.js',
    'src/parser.js',
    'src/renderer.js',
    'src/diff.js',
    'src/content-export.js',
    'src/content-search.js',
    'src/content-state.js',
    'src/content-github.js',
    'src/content-viewer.js',
    'src/content-interactions.js',
    'src/content.js'
  ];

  for (const s of scripts) {
    const content = fs.readFileSync(path.join(basePath, s), 'utf8');
    await page.evaluate(content);
  }

  // Step 4: Wait for viewer
  try {
    await page.waitForSelector('#uxv-viewer-container', { timeout: 20000 });
    await page.waitForTimeout(3000);
    return 'SUCCESS';
  } catch (_e) {
    const btn = await page.$('#uxv-visualize-btn');
    if (btn) {
      await btn.click();
      await page.waitForSelector('#uxv-viewer-container', { timeout: 15000 });
      await page.waitForTimeout(3000);
      return 'SUCCESS (manual click)';
    }
    const info = await page.evaluate(() => ({
      uxv: !!window.UXV,
      parser: !!window.UiPathParser,
      isXaml: window.UXV?.github?.isXamlFilePage?.(),
      isGH: window.UXV?.github?.isGitHubPage?.(),
      btn: !!document.getElementById('uxv-visualize-btn'),
      viewer: !!document.getElementById('uxv-viewer-container')
    }));
    return 'FAILED: ' + JSON.stringify(info);
  }
};
