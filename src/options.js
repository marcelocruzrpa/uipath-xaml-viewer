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
