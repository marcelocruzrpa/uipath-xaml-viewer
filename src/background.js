/**
 * UiPath XAML Viewer — Service worker for dynamic GHE host registration.
 *
 * Reads the list of known GitHub Enterprise hosts from `ghe_hosts` in storage
 * and registers content scripts dynamically so the extension works on
 * non-github.com instances. Host registration is independent of whether a
 * token has been saved — public GHE instances work without configuration.
 */

// MUST match manifest.json content_scripts.js — update both together
const CONTENT_JS = [
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
  'src/content.js',
];
const CONTENT_CSS = ['src/styles.css'];

async function getGheHosts() {
  const result = await chrome.storage.local.get('ghe_hosts');
  const hosts = result.ghe_hosts;
  if (!Array.isArray(hosts)) return [];
  return hosts.filter((h) => typeof h === 'string' && h !== 'github.com');
}

async function updateGheContentScripts() {
  const hosts = await getGheHosts();

  // Clean up stale registrations for hosts no longer in the list
  let registered = [];
  try {
    registered = await chrome.scripting.getRegisteredContentScripts();
  } catch (_e) { /* may not be available */ }

  const activeIds = new Set(hosts.map((h) => `uxv-ghe-${h}`));
  for (const script of registered) {
    if (script.id.startsWith('uxv-ghe-') && !activeIds.has(script.id)) {
      try { await chrome.scripting.unregisterContentScripts({ ids: [script.id] }); } catch (_e) { /* already gone */ }
    }
  }

  // Register each host individually so one failure doesn't block others
  for (const host of hosts) {
    const id = `uxv-ghe-${host}`;
    const pattern = `*://${host}/*`;

    try {
      const granted = await chrome.permissions.contains({ origins: [pattern] });
      if (!granted) {
        console.info(`[UXV] Host permission needed for ${pattern}. Grant via extension options.`);
        continue;
      }
    } catch (_e) {
      continue;
    }

    try { await chrome.scripting.unregisterContentScripts({ ids: [id] }); } catch (_e) { /* may not exist yet */ }

    try {
      await chrome.scripting.registerContentScripts([{
        id,
        matches: [pattern],
        js: CONTENT_JS,
        css: CONTENT_CSS,
        runAt: 'document_idle',
      }]);
      console.info('[UXV] Registered GHE content scripts for:', host);
    } catch (e) {
      console.warn(`[UXV] Failed to register content scripts for ${host}:`, e.message);
    }
  }
}

// Re-register when storage changes (host list or legacy token keys)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.ghe_hosts) updateGheContentScripts();
});

// Register on install/update
chrome.runtime.onInstalled.addListener(() => updateGheContentScripts());

// Register on service worker startup
updateGheContentScripts();
