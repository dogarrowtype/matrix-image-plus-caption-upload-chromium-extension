'use strict';

let selectedFile = null;
let homeserver = '';
let accessToken = '';

const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const dropPlaceholder = document.getElementById('drop-placeholder');
const preview         = document.getElementById('preview');
const fileInfo        = document.getElementById('file-info');
const fileName        = document.getElementById('file-name');
const clearBtn        = document.getElementById('clear-btn');
const captionEl       = document.getElementById('caption');
const roomIdEl        = document.getElementById('room-id');
const sendBtn         = document.getElementById('send-btn');
const progressRow     = document.getElementById('progress-row');
const progressFill    = document.getElementById('progress-bar-fill');
const progressLabel   = document.getElementById('progress-label');
const speedLabel      = document.getElementById('speed-label');
const statusEl        = document.getElementById('status');
const configWarning   = document.getElementById('config-warning');

// ── Init ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get(['homeserver', 'accessToken', 'lastRoomId'], (data) => {
  homeserver   = (data.homeserver   || '').replace(/\/$/, '');
  accessToken  =  data.accessToken  || '';
  roomIdEl.value = data.lastRoomId || '';

  if (!homeserver || !accessToken) {
    configWarning.classList.remove('hidden');
    sendBtn.disabled = true;
  }
});

// ── Drop zone ─────────────────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) setFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

document.addEventListener('paste', (e) => {
  for (const item of e.clipboardData.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      setFile(item.getAsFile());
      break;
    }
  }
});

clearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearFile();
});

function setFile(file) {
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.classList.remove('hidden');
  dropPlaceholder.classList.add('hidden');
  fileName.textContent = file.name;
  fileInfo.classList.remove('hidden');
  fileInput.value = '';
  clearStatus();
}

function clearFile() {
  selectedFile = null;
  preview.src = '';
  preview.classList.add('hidden');
  dropPlaceholder.classList.remove('hidden');
  fileInfo.classList.add('hidden');
  fileName.textContent = '';
  clearStatus();
}

// ── Send ──────────────────────────────────────────────────────────────────────

sendBtn.addEventListener('click', async () => {
  if (!selectedFile) return setStatus('err', 'Select an image first.');
  if (!captionEl.value.trim()) return setStatus('err', 'Caption is required.');
  if (!roomIdEl.value.trim()) return setStatus('err', 'Room ID is required.');

  const roomId  = roomIdEl.value.trim();
  const caption = captionEl.value.trim();

  chrome.storage.local.set({ lastRoomId: roomId });

  sendBtn.disabled = true;
  clearStatus();

  try {
    // Encryption check before doing any upload work
    setStatus('', 'Checking room…');
    const encrypted = await isRoomEncrypted(roomId);
    if (encrypted === 'abort') {
      setStatus('err', 'Cancelled.');
      sendBtn.disabled = false;
      return;
    }
    if (encrypted === true) {
      setStatus('err', '✗ Room is encrypted — this extension only sends plaintext. Use a Matrix client instead.');
      sendBtn.disabled = false;
      return;
    }

    const dims = await getImageDimensions(selectedFile);

    // Upload
    progressRow.classList.remove('hidden');
    setStatus('', 'Uploading…');
    const uploadRes = await uploadWithProgress(selectedFile, ({ loaded, total, bytesPerSec }) => {
      const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
      progressFill.style.width = pct + '%';
      progressLabel.textContent = pct + '%';
      speedLabel.textContent = formatSpeed(bytesPerSec);
    });
    progressRow.classList.add('hidden');

    const mxcUrl = uploadRes.content_uri;

    // Send
    setStatus('', 'Sending…');
    const txnId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const sendUrl = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`;

    const body = {
      msgtype:  'm.image',
      body:     caption,
      url:      mxcUrl,
      filename: selectedFile.name,
      info: {
        mimetype: selectedFile.type,
        size:     selectedFile.size,
        w:        dims.w,
        h:        dims.h,
      },
    };

    const res = await fetch(sendUrl, {
      method:  'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text}`);
    }

    setStatus('ok', '✓ Sent!');
    setTimeout(() => {
      clearFile();
      captionEl.value = '';
      clearStatus();
      sendBtn.disabled = false;
    }, 2000);

  } catch (err) {
    progressRow.classList.add('hidden');
    progressFill.style.width = '0%';
    setStatus('err', '✗ ' + err.message);
    sendBtn.disabled = false;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function isRoomEncrypted(roomId) {
  const url = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption`;
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (res.ok) return true;   // encryption state event exists
    if (res.status === 404) return false;  // no encryption state event
    // 403 = not in room / no permission — warn but don't block
    if (res.status === 403) {
      const proceed = confirm(
        '⚠ Could not read room state (403 Forbidden).\n\n' +
        'You may not be a member of this room, or the room ID may be wrong.\n\n' +
        'Try sending anyway?'
      );
      return proceed ? false : 'abort';
    }
    return false; // unexpected status — optimistically proceed
  } catch {
    return false; // network error — optimistically proceed
  }
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = URL.createObjectURL(file);
  });
}

function uploadWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = (Date.now() - startTime) / 1000;
      const bytesPerSec = elapsed > 0 ? e.loaded / elapsed : 0;
      onProgress({ loaded: e.loaded, total: e.total, bytesPerSec });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Upload: invalid JSON response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.open('POST', `${homeserver}/_matrix/media/v3/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

function formatSpeed(bps) {
  if (bps <= 0) return '';
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(1) + ' KB/s';
  return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
}

function setStatus(type, msg) {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.className = '';
}
