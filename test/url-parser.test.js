/**
 * Tests for the shared parseGitHubUrl, getApiBase, and getRawBase utilities.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

require('../src/utils.js');
const { parseGitHubUrl, getApiBase, getRawBase, looksLikeXaml } = window.UiPathUtils;

/* ------------------------------------------------------------------ */
/*  getApiBase / getRawBase                                           */
/* ------------------------------------------------------------------ */

describe('getApiBase', () => {
  it('returns api.github.com for github.com', () => {
    expect(getApiBase('github.com')).toBe('https://api.github.com');
  });

  it('returns /api/v3 for GHE hosts', () => {
    expect(getApiBase('github.mycompany.com')).toBe('https://github.mycompany.com/api/v3');
  });
});

describe('getRawBase', () => {
  it('returns raw.githubusercontent.com for github.com', () => {
    expect(getRawBase('github.com')).toBe('https://raw.githubusercontent.com');
  });

  it('returns hostname for GHE hosts', () => {
    expect(getRawBase('github.mycompany.com')).toBe('https://github.mycompany.com');
  });
});

/* ------------------------------------------------------------------ */
/*  looksLikeXaml                                                     */
/* ------------------------------------------------------------------ */

describe('looksLikeXaml', () => {
  it('returns true for UiPath XAML with Activity root', () => {
    expect(looksLikeXaml('<Activity xmlns="http://schemas.uipath.com">')).toBe(true);
  });

  it('returns true for XAML with Sequence root', () => {
    expect(looksLikeXaml('<Sequence DisplayName="Main">')).toBe(true);
  });

  it('returns false for plain HTML', () => {
    expect(looksLikeXaml('<html><body>Hello</body></html>')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(looksLikeXaml(null)).toBeFalsy();
    expect(looksLikeXaml(undefined)).toBeFalsy();
    expect(looksLikeXaml('')).toBeFalsy();
  });
});

/* ------------------------------------------------------------------ */
/*  parseGitHubUrl                                                    */
/* ------------------------------------------------------------------ */

describe('parseGitHubUrl', () => {
  let origPathname;

  function setPathname(path) {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: path, hostname: 'github.com' },
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    origPathname = window.location.pathname;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Restore
    try {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, pathname: origPathname },
        writable: true,
        configurable: true,
      });
    } catch (e) { /* ok */ }
    document.body.innerHTML = '';
  });

  it('returns null for non-blob/tree/blame URLs', () => {
    setPathname('/owner/repo/issues/42');
    expect(parseGitHubUrl()).toBeNull();
  });

  it('parses simple ref from URL fallback (no DOM payload)', () => {
    setPathname('/owner/repo/blob/main/src/file.xaml');
    const ctx = parseGitHubUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.owner).toBe('owner');
    expect(ctx.repo).toBe('repo');
    expect(ctx.view).toBe('blob');
    expect(ctx.ref).toBe('main');
    expect(ctx.filePath).toBe('src/file.xaml');
    expect(ctx.dir).toBe('src');
  });

  it('parses tree view', () => {
    setPathname('/owner/repo/tree/develop/src/folder');
    const ctx = parseGitHubUrl();
    expect(ctx.view).toBe('tree');
    expect(ctx.ref).toBe('develop');
    expect(ctx.filePath).toBe('src/folder');
  });

  it('parses blame view', () => {
    setPathname('/owner/repo/blame/v1.0/src/file.xaml');
    const ctx = parseGitHubUrl();
    expect(ctx.view).toBe('blame');
    expect(ctx.ref).toBe('v1.0');
  });

  it('handles file at root (no dir)', () => {
    setPathname('/owner/repo/blob/main/file.xaml');
    const ctx = parseGitHubUrl();
    expect(ctx.filePath).toBe('file.xaml');
    expect(ctx.dir).toBe('');
  });

  it('resolves slash-containing ref from embedded JSON payload', () => {
    setPathname('/owner/repo/blob/feature/foo/src/workflow.xaml');

    // Inject the embedded JSON payload as GitHub does
    const reactApp = document.createElement('react-app');
    reactApp.setAttribute('app-name', 'code-view');
    const script = document.createElement('script');
    script.setAttribute('data-target', 'react-app.embeddedData');
    script.setAttribute('type', 'application/json');
    script.textContent = JSON.stringify({
      payload: {
        codeViewBlobLayoutRoute: {
          refInfo: { name: 'feature/foo', refType: 'branch', currentOid: 'abc123' },
          path: 'src/workflow.xaml',
        },
        codeViewLayoutRoute: {
          refInfo: { name: 'feature/foo', currentOid: 'abc123' },
          path: 'src/workflow.xaml',
          repo: { defaultBranch: 'main', ownerLogin: 'owner', name: 'repo' },
        },
      },
    });
    reactApp.appendChild(script);
    document.body.appendChild(reactApp);

    const ctx = parseGitHubUrl();
    expect(ctx.ref).toBe('feature/foo');
    expect(ctx.filePath).toBe('src/workflow.xaml');
    expect(ctx.dir).toBe('src');
    expect(ctx.owner).toBe('owner');
    expect(ctx.repo).toBe('repo');
  });

  it('resolves deeply nested slash ref from payload', () => {
    setPathname('/org/repo/blob/release/2024/q1/hotfix/Main.xaml');

    const reactApp = document.createElement('react-app');
    reactApp.setAttribute('app-name', 'code-view');
    const script = document.createElement('script');
    script.setAttribute('data-target', 'react-app.embeddedData');
    script.setAttribute('type', 'application/json');
    script.textContent = JSON.stringify({
      payload: {
        codeViewBlobLayoutRoute: {
          refInfo: { name: 'release/2024/q1/hotfix', refType: 'branch' },
          path: 'Main.xaml',
        },
        codeViewLayoutRoute: {
          refInfo: { name: 'release/2024/q1/hotfix' },
          path: 'Main.xaml',
        },
      },
    });
    reactApp.appendChild(script);
    document.body.appendChild(reactApp);

    const ctx = parseGitHubUrl();
    expect(ctx.ref).toBe('release/2024/q1/hotfix');
    expect(ctx.filePath).toBe('Main.xaml');
    expect(ctx.dir).toBe('');
  });

  it('falls back to branch selector button when JSON is absent', () => {
    setPathname('/owner/repo/blob/feature/bar/deep/path/file.xaml');

    const btn = document.createElement('button');
    btn.id = 'ref-picker-repos-header-ref-selector';
    btn.textContent = '  feature/bar  ';
    document.body.appendChild(btn);

    const ctx = parseGitHubUrl();
    expect(ctx.ref).toBe('feature/bar');
    expect(ctx.filePath).toBe('deep/path/file.xaml');
    expect(ctx.dir).toBe('deep/path');
  });

  it('falls to simple regex when no DOM aids are present', () => {
    setPathname('/owner/repo/blob/feature/bar/file.xaml');
    // No DOM payload, no branch selector button
    const ctx = parseGitHubUrl();
    // Regex fallback can only capture first segment
    expect(ctx.ref).toBe('feature');
    expect(ctx.filePath).toBe('bar/file.xaml');
  });

  it('handles tag refs from payload', () => {
    setPathname('/owner/repo/blob/v2.0.0/src/Main.xaml');

    const reactApp = document.createElement('react-app');
    reactApp.setAttribute('app-name', 'code-view');
    const script = document.createElement('script');
    script.setAttribute('data-target', 'react-app.embeddedData');
    script.setAttribute('type', 'application/json');
    script.textContent = JSON.stringify({
      payload: {
        codeViewBlobLayoutRoute: {
          refInfo: { name: 'v2.0.0', refType: 'tag', currentOid: 'def456' },
          path: 'src/Main.xaml',
        },
        codeViewLayoutRoute: {
          refInfo: { name: 'v2.0.0' },
          path: 'src/Main.xaml',
        },
      },
    });
    reactApp.appendChild(script);
    document.body.appendChild(reactApp);

    const ctx = parseGitHubUrl();
    expect(ctx.ref).toBe('v2.0.0');
  });

  it('handles percent-encoded paths gracefully', () => {
    setPathname('/owner/repo/blob/main/path%20with%20spaces/file.xaml');
    const ctx = parseGitHubUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.ref).toBe('main');
  });
});

/* ------------------------------------------------------------------ */
/*  getGitLabApiBase                                                  */
/* ------------------------------------------------------------------ */

const { getGitLabApiBase, parseGitLabUrl } = window.UiPathUtils;

describe('getGitLabApiBase', () => {
  it('returns /api/v4 for gitlab.com', () => {
    expect(getGitLabApiBase('gitlab.com')).toBe('https://gitlab.com/api/v4');
  });

  it('returns /api/v4 for self-hosted instances', () => {
    expect(getGitLabApiBase('gitlab.mycompany.com')).toBe('https://gitlab.mycompany.com/api/v4');
  });
});

/* ------------------------------------------------------------------ */
/*  parseGitLabUrl                                                    */
/* ------------------------------------------------------------------ */

describe('parseGitLabUrl', () => {
  function setPathname(path) {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: path, hostname: 'gitlab.com' },
      writable: true,
      configurable: true,
    });
  }

  it('returns null for non-blob GitLab URLs', () => {
    setPathname('/group/project');
    expect(parseGitLabUrl()).toBeNull();
  });

  it('returns null for non-GitLab-style URLs (no /-/)', () => {
    setPathname('/owner/repo/blob/main/file.xaml');
    expect(parseGitLabUrl()).toBeNull();
  });

  it('parses simple project blob URL', () => {
    setPathname('/group/project/-/blob/main/src/Main.xaml');
    const ctx = parseGitLabUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.owner).toBe('group/project');
    expect(ctx.repo).toBe('');
    expect(ctx.view).toBe('blob');
    expect(ctx.ref).toBe('main');
    expect(ctx.filePath).toBe('src/Main.xaml');
    expect(ctx.dir).toBe('src');
  });

  it('parses nested subgroup URL', () => {
    setPathname('/group/subgroup/project/-/blob/develop/workflows/Process.xaml');
    const ctx = parseGitLabUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.owner).toBe('group/subgroup/project');
    expect(ctx.ref).toBe('develop');
    expect(ctx.filePath).toBe('workflows/Process.xaml');
    expect(ctx.dir).toBe('workflows');
  });

  it('parses blame view', () => {
    setPathname('/group/project/-/blame/main/file.xaml');
    const ctx = parseGitLabUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.view).toBe('blame');
  });

  it('parses tree view', () => {
    setPathname('/group/project/-/tree/main/src');
    const ctx = parseGitLabUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.view).toBe('tree');
    expect(ctx.filePath).toBe('src');
  });

  it('handles file at root level (no dir)', () => {
    setPathname('/group/project/-/blob/main/Main.xaml');
    const ctx = parseGitLabUrl();
    expect(ctx).not.toBeNull();
    expect(ctx.filePath).toBe('Main.xaml');
    expect(ctx.dir).toBe('');
  });

  it('reads ref from data-ref attribute when available', () => {
    setPathname('/group/project/-/blob/feature/my-branch/src/Main.xaml');
    const el = document.createElement('div');
    el.setAttribute('data-ref', 'feature/my-branch');
    document.body.appendChild(el);

    const ctx = parseGitLabUrl();
    expect(ctx.ref).toBe('feature/my-branch');
    expect(ctx.filePath).toBe('src/Main.xaml');

    document.body.removeChild(el);
  });
});
