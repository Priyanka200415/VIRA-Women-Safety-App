/* app.js - VIRA front-end (auto-dial-first version)
   - Opens dial pad first
   - Then opens SMS composer with encoded location
   - Keeps all Twilio + local flow intact
*/

const SERVER_URL = 'http://localhost:4000'; // Change to your ngrok HTTPS when testing on phone

const CONTACTS_KEY = 'sg_contacts';
const LOG_KEY = 'sg_incidents';
const CLIENT_KEY = 'sg_client';
const DECOY_KEY = 'sg_decoy_pin';
const EM_KEY = 'sg_emergency_number';
const USER_PHONE_KEY = 'sg_user_phone';

const sosBtn = document.getElementById('sosBtn');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');
const countdownEl = document.getElementById('countdown');
const overlayNotice = document.getElementById('overlayNotice');

const contactInput = document.getElementById('contactInput');
const addContactBtn = document.getElementById('addContactBtn');
const contactsList = document.getElementById('contactsList');

const logList = document.getElementById('logList');
const clearLog = document.getElementById('clearLog');
const exportLog = document.getElementById('exportLog');

const pinInput = document.getElementById('pin');
const pinUnlock = document.getElementById('pinUnlock');

const longpress = document.getElementById('longpress');

const emNumber = document.getElementById('emNumber');
const saveNumber = document.getElementById('saveNumber');

function debug(...args) { console.log('[VIRA]', ...args); }
function setStatus(t) { if (statusEl) statusEl.textContent = 'Status: ' + t; debug('status', t); }
function nowTs() { return Date.now(); }

function getClientId() {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = 'c_' + Date.now() + '_' + Math.floor(Math.random() * 90000);
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

function normalizeNumber(raw, defaultCountry = '+91') {
  if (!raw) return '';
  let s = String(raw).trim();
  if (s.startsWith('+')) return s;
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10) return '+' + digits;
  return defaultCountry + digits;
}

function getContacts() { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); }
function saveContacts(list) { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)); renderContacts(); }
function addContactNumber(raw) {
  const n = normalizeNumber(raw || '');
  if (!n) return alert('Enter a valid number');
  const list = getContacts();
  if (list.includes(n)) return alert('Already added');
  list.push(n);
  saveContacts(list);
}
function removeContactNumber(num) { const list = getContacts().filter(x => x !== num); saveContacts(list); }
function renderContacts() {
  if (!contactsList) return;
  const list = getContacts();
  if (!list.length) {
    contactsList.innerHTML = '<div class="muted">No contacts yet.</div>';
    return;
  }
  contactsList.innerHTML = list.map(n => `
    <div class="contact-pill">
      ${n} <button class="small-x" data-num="${n}" style="background:none;border:none;cursor:pointer">✕</button>
    </div>
  `).join('');
  Array.from(contactsList.querySelectorAll('.small-x')).forEach(b => b.onclick = () => removeContactNumber(b.dataset.num));
}

function addIncidentLocal(obj) {
  const arr = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  arr.unshift(obj);
  localStorage.setItem(LOG_KEY, JSON.stringify(arr));
  renderLog();
}
function renderLog() {
  if (!logList) return;
  const arr = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  if (!arr.length) {
    logList.innerHTML = '<div class="muted">No incidents yet.</div>';
    return;
  }
  logList.innerHTML = arr.map(it => {
    const t = new Date(it.ts).toLocaleString();
    const loc = it.loc && it.loc.lat
      ? ` • <a href="https://maps.google.com/?q=${it.loc.lat},${it.loc.lng}" target="_blank">View on Map</a> (acc ${it.loc.acc ? Math.round(it.loc.acc) + 'm' : ''})`
      : '';
    return `<div class="log-item"><b>${it.trigger}</b>${loc}<div class="time">${t}</div></div>`;
  }).join('');
}

async function getAccuratePosition(maxAttempts = 2) {
  if (!navigator.geolocation)
    return { lat: null, lng: null, acc: null, timestamp: nowTs() };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        })
      );
      const coords = pos.coords || {};
      const acc = coords.accuracy || null;
      if (acc != null && acc > 120 && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 700));
        continue;
      }
      return {
        lat: coords.latitude || null,
        lng: coords.longitude || null,
        acc,
        timestamp: pos.timestamp || nowTs(),
      };
    } catch (e) {
      if (attempt === maxAttempts)
        return { lat: null, lng: null, acc: null, timestamp: nowTs() };
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return { lat: null, lng: null, acc: null, timestamp: nowTs() };
}

async function postJson(path, body, timeout = 10000) {
  try {
    const res = await fetch(SERVER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    debug('Network error', err && err.message);
    throw err;
  }
}

function openSmsComposer(numbers, message) {
  const recipients = (numbers || []).join(',');
  const bodyEncoded = encodeURIComponent(message || '');
  const uri = `sms:${recipients}?&body=${bodyEncoded}`;
  debug('Opening SMS URI:', uri);
  window.location.href = uri;
}

function openDialer(emergencyNumber) {
  if (!emergencyNumber) return debug('No emergency number saved');
  const normalized = normalizeNumber(emergencyNumber);
  if (!normalized) return debug('Invalid emergency number');
  const uri = `tel:${normalized}`;
  debug('Opening dialer:', uri);
  window.location.href = uri;
}

/* 🚨 Modified triggerFullAlert() — opens dial pad first, then SMS */
async function triggerFullAlert({ clientId, contacts = [], message = null, emergencyNumber = null } = {}) {
  setStatus('Triggering alert...');
  const pos = await getAccuratePosition(2);
  const loc = { lat: pos.lat, lng: pos.lng, acc: pos.acc };
  const normalizedContacts = (Array.isArray(contacts) ? contacts : []).map(n => normalizeNumber(n)).filter(Boolean);
  addIncidentLocal({ trigger: 'sos_full (initiated)', ts: nowTs(), loc, contacts: normalizedContacts });

  const mapsLink = (loc.lat && loc.lng) ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : 'Location unavailable';
  const defaultMsg = `I need help. My location: ${mapsLink} (accuracy ${loc.acc ? Math.round(loc.acc) + 'm' : 'unknown'})`;
  const finalMsg = message || defaultMsg;

  try {
    postJson('/api/alert-full', {
      clientId: clientId || getClientId(),
      incident: { trigger: 'sos', ts: nowTs(), loc },
      contacts: normalizedContacts,
      message: finalMsg,
      userNumber: emergencyNumber || null,
    }).then(resp => debug('/api/alert-full response', resp))
      .catch(err => debug('/api/alert-full failed', err && err.message));
  } catch (err) {
    debug('Failed to post to server', err && err.message);
  }

  // 🔹 First open dialer
  if (emergencyNumber) {
    try { openDialer(emergencyNumber); } catch (e) { debug('openDialer failed', e && e.message); }
  } else {
    debug('No emergency number saved');
  }

  // 🔹 Then open SMS composer after 800ms
  if (normalizedContacts.length) {
    try {
      setTimeout(() => {
        try { openSmsComposer(normalizedContacts, finalMsg); }
        catch (e) { debug('openSmsComposer failed', e && e.message); }
      }, 800);
    } catch (e) {
      debug('scheduling sms failed', e && e.message);
    }
  } else {
    debug('No contacts to message');
  }

  setStatus('Alert flow complete (dialer + SMS opened)');
  return { success: true };
}

async function startSosFlow(triggerType = 'manual') {
  setStatus('Preparing SOS...');
  if (!overlay) return alert('Overlay not found');
  overlay.style.display = 'flex';
  overlayNotice.textContent = '';
  let cancelled = false;
  let t = 5;
  if (countdownEl) countdownEl.textContent = t;
  const ci = setInterval(() => {
    t--;
    if (countdownEl) countdownEl.textContent = t;
    if (t <= 0) { clearInterval(ci); modalConfirm(); }
  }, 1000);

  cancelBtn.onclick = () => {
    cancelled = true;
    clearInterval(ci);
    overlay.style.display = 'none';
    setStatus('Cancelled');
    addIncidentLocal({ trigger: triggerType + ' (cancelled)', ts: nowTs() });
  };
  confirmBtn.onclick = () => { clearInterval(ci); overlay.style.display = 'none'; modalConfirm(); };

  async function modalConfirm() {
    if (cancelled) return;
    setStatus('Sending & saving SOS...');
    const contacts = getContacts();
    let em = localStorage.getItem(EM_KEY) || null;
    if (!em) {
      em = prompt('Enter emergency number to auto-dial (with country code):', '');
      if (em) localStorage.setItem(EM_KEY, normalizeNumber(em));
    }
    const pos = await getAccuratePosition(2);
    const maps = (pos.lat && pos.lng) ? `https://maps.google.com/?q=${pos.lat},${pos.lng}` : 'Location unavailable';
    const defaultMsg = `I need help. My location: ${maps} (accuracy ${pos.acc ? Math.round(pos.acc) + 'm' : 'unknown'})`;
    const customMsg = prompt('Message to send to contacts (leave empty to use default):', defaultMsg) || defaultMsg;

    await triggerFullAlert({ clientId: getClientId(), contacts, message: customMsg, emergencyNumber: em });
    setTimeout(() => setStatus('Ready'), 3000);
  }
}

/* Event bindings */
if (sosBtn) sosBtn.addEventListener('click', () => startSosFlow('manual'));
if (addContactBtn) addContactBtn.addEventListener('click', () => { addContactNumber(contactInput.value); contactInput.value = ''; });
if (clearLog) clearLog.addEventListener('click', () => { if (confirm('Clear log?')) { localStorage.removeItem(LOG_KEY); renderLog(); } });
if (exportLog) exportLog.addEventListener('click', () => {
  const data = localStorage.getItem(LOG_KEY) || '[]';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'incidents.json';
  a.click();
});
if (pinUnlock) pinUnlock.addEventListener('click', () => {
  const v = (pinInput && pinInput.value || '').trim();
  const dec = localStorage.getItem(DECOY_KEY) || '0000';
  if (v === dec) startSosFlow('decoy_pin'); else setStatus('Normal unlock (demo)');
  if (pinInput) pinInput.value = '';
});
if (longpress) {
  let timer = null;
  const start = () => { timer = setTimeout(() => startSosFlow('longpress'), 3500); };
  const stop = () => { if (timer) clearTimeout(timer); };
  longpress.addEventListener('mousedown', start);
  longpress.addEventListener('mouseup', stop);
  longpress.addEventListener('mouseleave', stop);
  longpress.addEventListener('touchstart', start);
  longpress.addEventListener('touchend', stop);
}

if (saveNumber)
  saveNumber.addEventListener('click', () => {
    if (emNumber && emNumber.value.trim()) {
      localStorage.setItem(EM_KEY, normalizeNumber(emNumber.value));
      alert('Emergency number saved');
    } else alert('Enter number');
  });

(function loadSavedNumber() {
  const v = localStorage.getItem(EM_KEY) || '';
  if (emNumber) emNumber.value = v;
})();

renderContacts();
renderLog();
setStatus('Ready');
debug('VIRA front-end ready. SERVER_URL=', SERVER_URL);
window.vira = { normalizeNumber, triggerFullAlert, getContacts, openDialer };
