// Google Drive sync module
//
// To enable: set GOOGLE_CLIENT_ID to your OAuth 2.0 Client ID from Google Cloud Console.
//   1. Go to https://console.cloud.google.com
//   2. Create a project, enable the Google Drive API
//   3. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
//   4. Add your app's URL to "Authorised JavaScript origins"
//   5. Paste the Client ID below

export const GOOGLE_CLIENT_ID = '535720062304-uiq2vkli62jg5fgm02khj62471a5463l.apps.googleusercontent.com';

const SCOPES    = 'https://www.googleapis.com/auth/drive.appdata openid email';
const FILE_NAME = 'hobbymanager_data.json';
const MIME      = 'application/json';

const LS_CONNECTED = 'hobbymanager_gdrive_connected';
const LS_EMAIL     = 'hobbymanager_gdrive_email';
const LS_LAST_SYNC = 'hobbymanager_gdrive_last_sync';

let _tokenClient = null;
let _token       = null;
let _fileId      = null;

export function isConfigured()   { return !!GOOGLE_CLIENT_ID; }
export function isConnected()    { return !!_token; }
export function wasConnected()   { return !!localStorage.getItem(LS_CONNECTED); }
export function getSavedEmail()  { return localStorage.getItem(LS_EMAIL) || ''; }
export function getLastSyncTime(){ return localStorage.getItem(LS_LAST_SYNC) || null; }

export async function init() {
  if (!GOOGLE_CLIENT_ID) return false;
  await _loadScript('https://accounts.google.com/gsi/client');
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  });
  return true;
}

// Opens OAuth popup. Resolves with the user's email address.
export function connect() {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) { reject(new Error('Call init() first')); return; }
    _tokenClient.callback = async res => {
      if (res.error) { reject(new Error(res.error)); return; }
      _token = res.access_token;
      try {
        const info = await _get('https://www.googleapis.com/oauth2/v3/userinfo');
        localStorage.setItem(LS_CONNECTED, '1');
        localStorage.setItem(LS_EMAIL, info.email || '');
        resolve(info.email || '');
      } catch {
        localStorage.setItem(LS_CONNECTED, '1');
        resolve('');
      }
    };
    // Empty prompt string: skips consent screen if already granted
    _tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function disconnect() {
  if (_token) { google.accounts.oauth2.revoke(_token, () => {}); _token = null; }
  _fileId = null;
  localStorage.removeItem(LS_CONNECTED);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_LAST_SYNC);
}

// Returns { data, modifiedTime } if a Drive file exists, or null if not.
export async function loadFromDrive() {
  if (!_token) throw new Error('Not connected');
  const file = await _findFile();
  if (!file) return null;
  _fileId = file.id;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${_fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );
  _check401(res);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return { data: await res.json(), modifiedTime: file.modifiedTime };
}

export async function saveToDrive(data) {
  if (!_token) return false;
  const body = JSON.stringify(data);

  if (!_fileId) {
    const file = await _findFile();
    if (file) _fileId = file.id;
  }

  if (_fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${_fileId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${_token}`, 'Content-Type': MIME }, body }
    );
    _check401(res);
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  } else {
    const meta = { name: FILE_NAME, parents: ['appDataFolder'] };
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    fd.append('file',     new Blob([body],                 { type: MIME }));
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: `Bearer ${_token}` }, body: fd }
    );
    _check401(res);
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    const result = await res.json();
    _fileId = result.id;
  }

  localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
  return true;
}

async function _findFile() {
  const res = await _get(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id%2CmodifiedTime)`
  );
  return res.files?.[0] || null;
}

async function _get(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${_token}` } });
  _check401(res);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function _check401(res) {
  if (res.status === 401) { _token = null; throw new Error('Token expired'); }
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}
