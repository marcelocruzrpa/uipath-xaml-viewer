/**
 * UiPath XAML Visualizer — Shared authenticated fetch module.
 * Provides token-aware GitHub API access for all content scripts.
 */
window.UiPathFetch = (() => {

  const getApiBase = window.UiPathUtils.getApiBase;
  const getRawBase = window.UiPathUtils.getRawBase;

  const CACHE_MAX = 200;
  const cache = new Map();

  function cacheSet(key, value) {
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(key, value);
  }

  function decodeBase64Utf8(base64) {
    const binary = atob((base64 || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  async function getToken() {
    try {
      const host = location.hostname;
      const result = await chrome.storage.local.get([`github_token_${host}`, 'github_token']);
      return result[`github_token_${host}`] || result.github_token || null;
    } catch (_e) {
      return null;
    }
  }

  function apiBase() { return getApiBase(); }

  async function apiGet(url) {
    if (cache.has(url)) return cache.get(url);

    const token = await getToken();
    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
      const reset = response.headers.get('X-RateLimit-Reset');
      const mins = reset ? Math.ceil((parseInt(reset, 10) * 1000 - Date.now()) / 60000) : '?';
      throw new Error(`GitHub API rate limit exceeded. Resets in ~${mins} min. Configure a token in extension options to raise the limit.`);
    }

    if (!response.ok) {
      if (response.status === 404) {
        cacheSet(url, null);
        return null;
      }
      throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    cacheSet(url, data);
    return data;
  }

  async function fetchText(url, useAuth = false) {
    const headers = {};
    if (useAuth) {
      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok ? response.text() : null;
    } catch (_e) {
      clearTimeout(timeoutId);
      return null;
    }
  }

  async function fetchFileAtRef(owner, repo, ref, path) {
    if (!ref) return null;

    const encodedPath = path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const contentsUrl = `${apiBase()}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;

    try {
      const data = await apiGet(contentsUrl);
      if (!data) return null;

      if (data.content && data.encoding === 'base64') {
        return decodeBase64Utf8(data.content);
      }

      if (data.sha) {
        const blob = await apiGet(`${apiBase()}/repos/${owner}/${repo}/git/blobs/${data.sha}`);
        if (blob?.content && blob.encoding === 'base64') {
          return decodeBase64Utf8(blob.content);
        }
      }

      if (data.download_url) {
        const downloaded = await fetchText(data.download_url, true);
        if (downloaded) return downloaded;
      }
    } catch (e) {
      if (e.message.includes('rate limit')) throw e;
      console.warn('[UXV] Contents API failed for', path, '@', ref, ':', e.message);
    }

    const rawBase = getRawBase();
    const rawUrl = location.hostname === 'github.com'
      ? `${rawBase}/${owner}/${repo}/${ref}/${path}`
      : `${rawBase}/${owner}/${repo}/raw/${ref}/${path}`;
    return fetchText(rawUrl, true);
  }

  function clearCache() { cache.clear(); }

  return { getToken, apiGet, fetchText, fetchFileAtRef, decodeBase64Utf8, clearCache };
})();
