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

// --- Progress bar ---

export function progressBar(pct, colorVar = '--accent') {
  return `<div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:var(${colorVar})"></div></div>`;
}

// --- Threshold badge ---

export function thresholdBadge(threshold) {
  const map = {
    table_ready: { icon: '⚔️', label: 'Table Ready', cls: 'badge-table' },
    painted:     { icon: '🎨', label: 'Painted',     cls: 'badge-painted' },
    finished:    { icon: '🏆', label: 'Finished',    cls: 'badge-finished' },
    null:        { icon: '🔧', label: 'In Progress', cls: 'badge-wip' },
  };
  const info = map[threshold] || map[null];
  return `<span class="badge ${info.cls}">${info.icon} ${info.label}</span>`;
}

// --- Stage phase label ---
export function phaseLabel(phase) {
  return { assembly: 'Assembly', painting: 'Painting', basing: 'Basing' }[phase] || phase;
}

// --- Date helpers ---
export function today() {
  return new Date().toISOString().split('T')[0];
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
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
