const tokenInput = document.getElementById('token');
const hostInput = document.getElementById('host');
const statusEl = document.getElementById('status');
const rateInfo = document.getElementById('rate-info');
const autoVizCheckbox = document.getElementById('auto-visualize');
const gheHostList = document.getElementById('ghe-host-list');

function tokenKey() {
  const host = hostInput.value.trim() || 'github.com';
  return host === 'github.com' ? 'github_token' : `github_token_${host}`;
}

chrome.storage.local.get([tokenKey(), 'uxv_auto_visualize'], (result) => {
  if (result[tokenKey()]) tokenInput.value = result[tokenKey()];
  autoVizCheckbox.checked = !!result.uxv_auto_visualize;
});

autoVizCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ uxv_auto_visualize: autoVizCheckbox.checked });
});

// Reload token when host field changes
hostInput.addEventListener('change', () => {
  chrome.storage.local.get(tokenKey(), (result) => {
    tokenInput.value = result[tokenKey()] || '';
    rateInfo.style.display = 'none';
    statusEl.className = 'status';
  });
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
}

function validateToken(token) {
  return token.startsWith('ghp_')
    || token.startsWith('github_pat_')
    || token.startsWith('gho_')
    || token.startsWith('ghu_');
}

/**
 * Add a hostname to the ghe_hosts list in storage (if not already present).
 */
function addGheHost(host) {
  return new Promise((resolve) => {
    chrome.storage.local.get('ghe_hosts', (result) => {
      const hosts = Array.isArray(result.ghe_hosts) ? result.ghe_hosts : [];
      if (!hosts.includes(host)) {
        hosts.push(host);
        chrome.storage.local.set({ ghe_hosts: hosts }, resolve);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Remove a hostname from the ghe_hosts list in storage.
 */
function removeGheHost(host) {
  return new Promise((resolve) => {
    chrome.storage.local.get('ghe_hosts', (result) => {
      const hosts = Array.isArray(result.ghe_hosts) ? result.ghe_hosts : [];
      const filtered = hosts.filter((h) => h !== host);
      chrome.storage.local.set({ ghe_hosts: filtered }, resolve);
    });
  });
}

/**
 * Render the list of registered GHE hosts in the UI.
 */
function renderGheHostList() {
  chrome.storage.local.get('ghe_hosts', (result) => {
    const hosts = (Array.isArray(result.ghe_hosts) ? result.ghe_hosts : [])
      .filter((h) => h !== 'github.com');
    if (!gheHostList) return;
    if (hosts.length === 0) {
      gheHostList.innerHTML = '<span style="color:#656d76;font-size:12px">No GitHub Enterprise hosts registered.</span>';
      return;
    }
    gheHostList.innerHTML = '';
    for (const host of hosts) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0';
      const code = document.createElement('code');
      code.style.flex = '1';
      code.textContent = host;
      const btn = document.createElement('button');
      btn.className = 'btn-danger ghe-remove-btn';
      btn.dataset.host = host;
      btn.style.cssText = 'padding:2px 8px;font-size:11px';
      btn.textContent = 'Remove';
      row.appendChild(code);
      row.appendChild(btn);
      gheHostList.appendChild(row);
    }

    gheHostList.querySelectorAll('.ghe-remove-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await removeGheHost(btn.dataset.host);
        renderGheHostList();
        showStatus(`Host "${btn.dataset.host}" removed. Reload its tabs to apply.`, 'info');
      });
    });
  });
}

// Render host list on page load
renderGheHostList();

// --- Add Host button ---
const addHostBtn = document.getElementById('add-host');
if (addHostBtn) {
  addHostBtn.addEventListener('click', () => {
    const host = hostInput.value.trim();
    if (!host || host === 'github.com') {
      showStatus('Enter a GitHub Enterprise hostname to register (not github.com).', 'error');
      return;
    }

    chrome.permissions.request({ origins: [`*://${host}/*`] }, async (granted) => {
      if (!granted) {
        showStatus('Host permission denied. The extension cannot run on ' + host + ' without it.', 'error');
        return;
      }
      await addGheHost(host);
      renderGheHostList();
      showStatus(`Host "${host}" registered. The extension will now activate on ${host}. Token is optional.`, 'success');
    });
  });
}

document.getElementById('save').addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showStatus('Token is empty.', 'error');
    return;
  }
  if (!validateToken(token)) {
    showStatus('Token should look like a GitHub token (for example ghp_ or github_pat_).', 'error');
    return;
  }
  const host = hostInput.value.trim() || 'github.com';

  // For GHE hosts, ensure host is registered and permission is granted
  if (host !== 'github.com') {
    chrome.permissions.request({ origins: [`*://${host}/*`] }, async (granted) => {
      if (!granted) {
        showStatus('Host permission denied. The extension cannot run on ' + host + ' without it.', 'error');
        return;
      }
      await addGheHost(host);
      renderGheHostList();
      chrome.storage.local.set({ [tokenKey()]: token }, () => {
        showStatus('Token saved and host registered. Reload ' + host + ' tabs to apply.', 'success');
      });
    });
  } else {
    chrome.storage.local.set({ [tokenKey()]: token }, () => {
      showStatus('Token saved locally. Reload GitHub tabs to apply.', 'success');
    });
  }
});

document.getElementById('test').addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showStatus('Enter a token first.', 'error');
    return;
  }

  const host = hostInput.value.trim() || 'github.com';
  const apiUrl = host === 'github.com'
    ? 'https://api.github.com/user'
    : `https://${host}/api/v3/user`;

  showStatus('Testing...', 'info');
  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      showStatus(`Authenticated as ${data.login}.`, 'success');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const limit = response.headers.get('X-RateLimit-Limit');
      if (remaining && limit) {
        document.getElementById('rate-remaining').textContent = remaining;
        document.getElementById('rate-limit').textContent = limit;
        rateInfo.style.display = 'block';
      }
    } else if (response.status === 401) {
      showStatus('Invalid token: authentication failed.', 'error');
    } else {
      showStatus(`GitHub returned ${response.status}: ${response.statusText}`, 'error');
    }
  } catch (e) {
    showStatus('Network error: ' + e.message, 'error');
  }
});

document.getElementById('clear').addEventListener('click', () => {
  chrome.storage.local.remove(tokenKey(), () => {
    tokenInput.value = '';
    rateInfo.style.display = 'none';
    showStatus('Token cleared.', 'success');
  });
});

// ===== Platform toggle =====
const platformGithubBtn = document.getElementById('platform-github');
const platformGitlabBtn = document.getElementById('platform-gitlab');
const githubSection = document.getElementById('github-section');
const gitlabSection = document.getElementById('gitlab-section');

platformGithubBtn.addEventListener('click', () => {
  githubSection.style.display = '';
  gitlabSection.style.display = 'none';
  platformGithubBtn.className = 'btn-primary';
  platformGitlabBtn.className = 'btn-secondary';
});

platformGitlabBtn.addEventListener('click', () => {
  githubSection.style.display = 'none';
  gitlabSection.style.display = '';
  platformGithubBtn.className = 'btn-secondary';
  platformGitlabBtn.className = 'btn-primary';
  renderGitLabHostList();
  loadGitLabToken();
});

// ===== GitLab token management =====
const glTokenInput = document.getElementById('gl-token');
const glHostInput = document.getElementById('gl-host');
const glStatusEl = document.getElementById('gl-status');
const gitlabHostListEl = document.getElementById('gitlab-host-list');

function glTokenKey() {
  const host = glHostInput.value.trim() || 'gitlab.com';
  return host === 'gitlab.com' ? 'gitlab_token' : `gitlab_token_${host}`;
}

function loadGitLabToken() {
  chrome.storage.local.get(glTokenKey(), (result) => {
    glTokenInput.value = result[glTokenKey()] || '';
    glStatusEl.className = 'status';
  });
}

function showGlStatus(message, type) {
  glStatusEl.textContent = message;
  glStatusEl.className = 'status ' + type;
}

glHostInput.addEventListener('change', loadGitLabToken);

function addGitLabHost(host) {
  return new Promise((resolve) => {
    chrome.storage.local.get('gitlab_hosts', (result) => {
      const hosts = Array.isArray(result.gitlab_hosts) ? result.gitlab_hosts : [];
      if (!hosts.includes(host)) {
        hosts.push(host);
        chrome.storage.local.set({ gitlab_hosts: hosts }, resolve);
      } else {
        resolve();
      }
    });
  });
}

function removeGitLabHost(host) {
  return new Promise((resolve) => {
    chrome.storage.local.get('gitlab_hosts', (result) => {
      const hosts = Array.isArray(result.gitlab_hosts) ? result.gitlab_hosts : [];
      const filtered = hosts.filter((h) => h !== host);
      chrome.storage.local.set({ gitlab_hosts: filtered }, resolve);
    });
  });
}

function renderGitLabHostList() {
  chrome.storage.local.get('gitlab_hosts', (result) => {
    const hosts = (Array.isArray(result.gitlab_hosts) ? result.gitlab_hosts : [])
      .filter((h) => h !== 'gitlab.com');
    if (!gitlabHostListEl) return;
    if (hosts.length === 0) {
      gitlabHostListEl.textContent = 'No self-hosted GitLab instances registered.';
      gitlabHostListEl.style.cssText = 'color:#656d76;font-size:12px;margin-bottom:16px;padding:8px;background:#fff;border:1px solid #d1d5da;border-radius:6px';
      return;
    }
    gitlabHostListEl.textContent = '';
    for (const host of hosts) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0';
      const code = document.createElement('code');
      code.style.flex = '1';
      code.textContent = host;
      const btn = document.createElement('button');
      btn.className = 'btn-danger gl-remove-btn';
      btn.dataset.host = host;
      btn.style.cssText = 'padding:2px 8px;font-size:11px';
      btn.textContent = 'Remove';
      btn.addEventListener('click', async () => {
        await removeGitLabHost(host);
        renderGitLabHostList();
        showGlStatus(`Host "${host}" removed. Reload its tabs to apply.`, 'info');
      });
      row.appendChild(code);
      row.appendChild(btn);
      gitlabHostListEl.appendChild(row);
    }
  });
}

renderGitLabHostList();

const addGlHostBtn = document.getElementById('add-gl-host');
if (addGlHostBtn) {
  addGlHostBtn.addEventListener('click', () => {
    const host = glHostInput.value.trim();
    if (!host || host === 'gitlab.com') {
      showGlStatus('Enter a self-hosted GitLab hostname to register (not gitlab.com).', 'error');
      return;
    }

    chrome.permissions.request({ origins: [`*://${host}/*`] }, async (granted) => {
      if (!granted) {
        showGlStatus('Host permission denied. The extension cannot run on ' + host + ' without it.', 'error');
        return;
      }
      await addGitLabHost(host);
      renderGitLabHostList();
      showGlStatus(`Host "${host}" registered. The extension will now activate on ${host}.`, 'success');
    });
  });
}

function validateGitLabToken(token) {
  return token.startsWith('glpat-');
}

document.getElementById('gl-save').addEventListener('click', () => {
  const token = glTokenInput.value.trim();
  if (!token) {
    showGlStatus('Token is empty.', 'error');
    return;
  }
  if (!validateGitLabToken(token)) {
    showGlStatus('Token should look like a GitLab personal access token (e.g. glpat-...).', 'error');
    return;
  }
  const host = glHostInput.value.trim() || 'gitlab.com';

  if (host !== 'gitlab.com') {
    chrome.permissions.request({ origins: [`*://${host}/*`] }, async (granted) => {
      if (!granted) {
        showGlStatus('Host permission denied. The extension cannot run on ' + host + ' without it.', 'error');
        return;
      }
      await addGitLabHost(host);
      renderGitLabHostList();
      chrome.storage.local.set({ [glTokenKey()]: token }, () => {
        showGlStatus('Token saved and host registered. Reload ' + host + ' tabs to apply.', 'success');
      });
    });
  } else {
    chrome.storage.local.set({ [glTokenKey()]: token }, () => {
      showGlStatus('Token saved locally. Reload GitLab tabs to apply.', 'success');
    });
  }
});

document.getElementById('gl-test').addEventListener('click', async () => {
  const token = glTokenInput.value.trim();
  if (!token) {
    showGlStatus('Enter a token first.', 'error');
    return;
  }

  const host = glHostInput.value.trim() || 'gitlab.com';
  const apiUrl = `https://${host}/api/v4/user`;

  showGlStatus('Testing...', 'info');
  try {
    const response = await fetch(apiUrl, {
      headers: { 'Private-Token': token },
    });

    if (response.ok) {
      const data = await response.json();
      showGlStatus(`Authenticated as ${data.username}.`, 'success');
    } else if (response.status === 401) {
      showGlStatus('Invalid token: authentication failed.', 'error');
    } else {
      showGlStatus(`GitLab returned ${response.status}: ${response.statusText}`, 'error');
    }
  } catch (e) {
    showGlStatus('Network error: ' + e.message, 'error');
  }
});

document.getElementById('gl-clear').addEventListener('click', () => {
  chrome.storage.local.remove(glTokenKey(), () => {
    glTokenInput.value = '';
    showGlStatus('Token cleared.', 'success');
  });
});
