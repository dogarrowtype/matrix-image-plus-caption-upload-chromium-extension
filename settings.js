'use strict';

const homeserverEl  = document.getElementById('homeserver');
const accessTokenEl = document.getElementById('access-token');
const toggleTokenBtn = document.getElementById('toggle-token');
const saveBtn       = document.getElementById('save-btn');
const clearBtn      = document.getElementById('clear-btn');
const statusEl      = document.getElementById('status');

// ── Load saved values ─────────────────────────────────────────────────────────

chrome.storage.local.get(['homeserver', 'accessToken'], (data) => {
  if (data.homeserver)  homeserverEl.value  = data.homeserver;
  if (data.accessToken) accessTokenEl.value = data.accessToken;
});

// ── Toggle token visibility ───────────────────────────────────────────────────

toggleTokenBtn.addEventListener('click', () => {
  const isPassword = accessTokenEl.type === 'password';
  accessTokenEl.type = isPassword ? 'text' : 'password';
  toggleTokenBtn.title = isPassword ? 'Hide token' : 'Show token';
});

// ── Save ──────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const homeserver  = homeserverEl.value.trim().replace(/\/$/, '');
  const accessToken = accessTokenEl.value.trim();

  if (!homeserver) return setStatus('err', 'Homeserver URL is required.');
  if (!homeserver.startsWith('https://') && !homeserver.startsWith('http://')) {
    return setStatus('err', 'Homeserver URL must start with https://');
  }
  if (!accessToken) return setStatus('err', 'Access token is required.');

  chrome.storage.local.set({ homeserver, accessToken }, () => {
    setStatus('ok', '✓ Saved');
    setTimeout(() => setStatus('', ''), 3000);
  });
});

// ── Clear all ─────────────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  if (!confirm('Clear all stored credentials and history?')) return;
  chrome.storage.local.clear(() => {
    homeserverEl.value  = '';
    accessTokenEl.value = '';
    setStatus('ok', '✓ Cleared');
    setTimeout(() => setStatus('', ''), 3000);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(type, msg) {
  statusEl.textContent = msg;
  statusEl.className = type;
}
