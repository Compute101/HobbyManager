// ui.js — modal, toasts, shared UI utilities

// --- Modal ---

let modalStack = [];

export function showModal({ title, content, wide = false, onClose = null }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';

  const box = document.createElement('div');
  box.className = 'modal-box' + (wide ? ' modal-wide' : '');

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `<h2 class="modal-title">${title}</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = () => closeModal(onClose);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';

  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.appendChild(content);
  }

  box.appendChild(header);
  box.appendChild(body);
  overlay.appendChild(box);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(onClose);
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Trap focus
  const firstInput = box.querySelector('input, select, textarea, button');
  if (firstInput) firstInput.focus();
}

export function closeModal(callback) {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }
  if (typeof callback === 'function') callback();
}

// --- Fireworks ---
// A short celebratory burst, e.g. for viewing a completed campaign or
// closing out a bounty. Self-contained canvas overlay, no dependencies.

const FIREWORK_COLORS = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ff9e40'];

export function fireworks({ duration = 2200, bursts = 4 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fireworks-overlay';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let particles = [];
  const addBurst = (x, y) => {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const count = 44 + Math.floor(Math.random() * 24);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
      const speed = 2 + Math.random() * 3.5;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, decay: 0.012 + Math.random() * 0.01, color, size: 2 + Math.random() * 2
      });
    }
  };

  const burstTimings = Array.from({ length: bursts }, (_, i) => i * (duration / (bursts + 1)));
  const timers = burstTimings.map(t => setTimeout(() => {
    addBurst(canvas.width * (0.2 + Math.random() * 0.6), canvas.height * (0.15 + Math.random() * 0.35));
  }, t));

  const start = performance.now();
  let raf;
  const frame = now => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    particles = particles.filter(p => p.life > 0);
    ctx.globalAlpha = 1;

    if (now - start < duration + 800 || particles.length) {
      raf = requestAnimationFrame(frame);
    } else {
      timers.forEach(clearTimeout);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(frame);
}

// --- Toast ---

export function toast(message, type = 'info', duration = 2800) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toastContainer';
  el.className = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// --- Confirm dialog ---

export function confirm(message) {
  return window.confirm(message);
}

export function showConfirm({ message, confirmLabel = 'Delete', onConfirm }) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="margin:0 0 1.25em">${message}</p>
    <div class="modal-actions">
      <button class="btn btn-danger" id="confirmYes">${confirmLabel}</button>
      <button class="btn" id="confirmNo">Cancel</button>
    </div>
  `;
  content.querySelector('#confirmYes').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
  content.querySelector('#confirmNo').addEventListener('click', () => closeModal());
  showModal({ title: 'Are you sure?', content });
}

// --- Progress bar ---

export function progressBar(pct, colorVar = '--accent') {
  return `<div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:var(${colorVar})"></div></div>`;
}

// --- Threshold badge ---

export function thresholdBadge(threshold) {
  const map = {
    table_ready:  { icon: '⚔️', label: 'Table Ready',  cls: 'badge-table' },
    painted:      { icon: '🎨', label: 'Painted',       cls: 'badge-painted' },
    finished:     { icon: '🏆', label: 'Finished',      cls: 'badge-finished' },
    null:         { icon: '🔧', label: 'In Progress',   cls: 'badge-wip' },
    not_started:  { icon: '💀', label: 'Not Started',   cls: 'badge-not-started' },
  };
  const info = map[threshold] || map[null];
  return `<span class="badge ${info.cls}">${info.icon} ${info.label}</span>`;
}

// --- Stage phase label ---
export function phaseLabel(phase) {
  return { assembly: 'Assembly', painting: 'Painting', basing: 'Basing' }[phase] || phase;
}

// --- Date helpers ---
const _userLocale = navigator.language;
const _userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today() {
  return localDateStr(new Date());
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

// dateStr is a local YYYY-MM-DD string; parse at local noon to stay in the correct day.
export function formatDate(dateStr, options) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString(_userLocale, { timeZone: _userTz, ...options });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const deadline = new Date(y, m - 1, d);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - todayMidnight) / 86400000);
}

// --- Smart date input ---
// On mobile: native <input type="date"> (works great)
// On desktop: three dropdowns (day / month / year)

const isMobile = () => window.matchMedia('(pointer: coarse)').matches;

export function createDateInput(id, value = '') {
  // value expected as YYYY-MM-DD or ''
  const parts = value ? value.split('-') : [];
  const y = parts[0] || '';
  const m = parts[1] || '';
  const d = parts[2] || '';

  if (isMobile()) {
    return `<input type="date" id="${id}" class="form-input" value="${value}">`;
  }

  const days = Array.from({length: 31}, (_, i) => i + 1);
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 6}, (_, i) => currentYear + i);

  return `
    <div class="date-dropdowns" id="${id}">
      <select class="form-input date-dd">
        <option value="">Day</option>
        ${days.map(n => `<option value="${String(n).padStart(2,'0')}" ${d === String(n).padStart(2,'0') ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      <select class="form-input date-mm">
        <option value="">Month</option>
        ${months.map((name, i) => {
          const val = String(i+1).padStart(2,'0');
          return `<option value="${val}" ${m === val ? 'selected' : ''}>${name}</option>`;
        }).join('')}
      </select>
      <select class="form-input date-yy">
        <option value="">Year</option>
        ${years.map(yr => `<option value="${yr}" ${y === String(yr) ? 'selected' : ''}>${yr}</option>`).join('')}
      </select>
    </div>
  `;
}

export function getDateValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  // Native input
  if (el.tagName === 'INPUT') return el.value;
  // Dropdowns
  const dd = el.querySelector('.date-dd')?.value;
  const mm = el.querySelector('.date-mm')?.value;
  const yy = el.querySelector('.date-yy')?.value;
  if (!dd || !mm || !yy) return '';
  return `${yy}-${mm}-${dd}`;
}

// --- Smart time input ---
// On mobile: native <input type="time"> (gives scroll wheels on iOS)
// On desktop: hour + minute dropdowns in 5-min increments

export function createTimeInput(id, value = '') {
  const [h = '', m = ''] = value ? value.split(':') : [];

  if (isMobile()) {
    return `<input type="time" id="${id}" class="form-input" value="${value}">`;
  }

  const hours = Array.from({length: 24}, (_, i) => i);
  const minutes = Array.from({length: 12}, (_, i) => i * 5);

  return `
    <div class="time-dropdowns" id="${id}">
      <select class="form-input time-hh">
        <option value="">HH</option>
        ${hours.map(n => {
          const val = String(n).padStart(2, '0');
          return `<option value="${val}" ${h === val ? 'selected' : ''}>${val}</option>`;
        }).join('')}
      </select>
      <span class="time-sep">:</span>
      <select class="form-input time-mm">
        <option value="">MM</option>
        ${minutes.map(n => {
          const val = String(n).padStart(2, '0');
          return `<option value="${val}" ${m === val ? 'selected' : ''}>${val}</option>`;
        }).join('')}
      </select>
    </div>
  `;
}

export function getTimeValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.tagName === 'INPUT') return el.value;
  const hh = el.querySelector('.time-hh')?.value;
  const mm = el.querySelector('.time-mm')?.value;
  if (!hh || !mm) return '';
  return `${hh}:${mm}`;
}

// --- Render a stage progress row ---
export function stageRow(stage, prog, quantity, skipped) {
  const done = prog?.done || 0;
  const pct = quantity ? Math.round(done / quantity * 100) : 0;
  const isSkipped = skipped.includes(stage.id);
  return `
    <div class="stage-row ${isSkipped ? 'stage-skipped' : ''}" data-stage-id="${stage.id}">
      <div class="stage-row-info">
        <span class="stage-name">${stage.name}</span>
        ${stage.skippable ? `<span class="stage-opt">${isSkipped ? 'skipped' : 'optional'}</span>` : ''}
        <span class="stage-count">${isSkipped ? '—' : `${done}/${quantity}`}</span>
      </div>
      ${isSkipped ? '' : progressBar(pct)}
    </div>
  `;
}
