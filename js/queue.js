// queue.js — painting queues

import {
  appData, saveData, uid, modelThreshold, modelPoints
} from './data.js';
import { showModal, closeModal, toast, thresholdBadge, progressBar } from './ui.js';
import { showLogProgress } from './models.js';

// --- Data helpers ---

export function createQueue(name) {
  if (!appData.queues) appData.queues = {};
  const id = uid();
  appData.queues[id] = { id, name, entries: [] };
  // entries: [{ id, modelId, note }]
  saveData();
  return id;
}

export function deleteQueue(id) {
  if (!appData.queues) return;
  delete appData.queues[id];
  saveData();
}

export function renameQueue(id, name) {
  if (!appData.queues?.[id]) return;
  appData.queues[id].name = name;
  saveData();
}

export function addToQueue(queueId, modelId, note = '') {
  const queue = appData.queues?.[queueId];
  if (!queue) return;
  // Don't add finished models
  const model = appData.models[modelId];
  if (!model) return;
  if (modelThreshold(model) === 'finished') {
    toast('Finished models cannot be added to the queue', 'error');
    return;
  }
  // Allow duplicates across queues but not within same queue
  if (queue.entries.some(e => e.modelId === modelId)) {
    toast('Model already in this queue', 'error');
    return;
  }
  queue.entries.push({ id: uid(), modelId, note });
  saveData();
}

export function removeFromQueue(queueId, entryId) {
  const queue = appData.queues?.[queueId];
  if (!queue) return;
  queue.entries = queue.entries.filter(e => e.id !== entryId);
  saveData();
}

export function moveEntry(queueId, entryId, direction) {
  const queue = appData.queues?.[queueId];
  if (!queue) return;
  const idx = queue.entries.findIndex(e => e.id === entryId);
  if (idx === -1) return;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= queue.entries.length) return;
  [queue.entries[idx], queue.entries[newIdx]] = [queue.entries[newIdx], queue.entries[idx]];
  saveData();
}

export function updateEntryNote(queueId, entryId, note) {
  const queue = appData.queues?.[queueId];
  if (!queue) return;
  const entry = queue.entries.find(e => e.id === entryId);
  if (entry) { entry.note = note; saveData(); }
}

// Auto-remove finished models from all queues
export function pruneFinishedFromQueues() {
  if (!appData.queues) return;
  let pruned = false;
  Object.values(appData.queues).forEach(queue => {
    const before = queue.entries.length;
    queue.entries = queue.entries.filter(e => {
      const model = appData.models[e.modelId];
      return model && modelThreshold(model) !== 'finished';
    });
    if (queue.entries.length !== before) pruned = true;
  });
  if (pruned) saveData();
}

// --- Render ---

let activeQueueId = null;

export function renderQueues() {
  const container = document.getElementById('queuesView');
  if (!container) return;

  if (!appData.queues) appData.queues = {};
  pruneFinishedFromQueues();

  const queues = Object.values(appData.queues);

  // Set active queue to first if not set
  if (!activeQueueId || !appData.queues[activeQueueId]) {
    activeQueueId = queues[0]?.id || null;
  }

  container.innerHTML = `
    <div class="queue-layout">
      <div class="queue-tabs-bar">
        <div class="queue-tab-list" id="queueTabList">
          ${queues.map(q => `
            <button class="queue-tab-btn ${q.id === activeQueueId ? 'active' : ''}" data-queue-id="${q.id}">
              ${q.name}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-sm btn-primary" id="newQueueBtn">+ Queue</button>
      </div>
      <div class="queue-body" id="queueBody">
        ${activeQueueId ? renderQueueBody(activeQueueId) : `
          <div class="empty-state">
            <p>No queues yet.</p>
            <p style="font-size:0.85em;color:var(--text-muted)">Create a queue to start planning your painting.</p>
          </div>
        `}
      </div>
    </div>
  `;

  // Queue tab switching
  container.querySelectorAll('[data-queue-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeQueueId = btn.dataset.queueId;
      renderQueues();
    });
  });

  // New queue
  container.querySelector('#newQueueBtn')?.addEventListener('click', () => {
    const name = prompt('Queue name:');
    if (name?.trim()) {
      activeQueueId = createQueue(name.trim());
      renderQueues();
    }
  });

  // Wire up queue body events
  wireQueueBody(container);
}

function renderQueueBody(queueId) {
  const queue = appData.queues[queueId];
  if (!queue) return '';

  const entries = queue.entries;

  return `
    <div class="queue-header">
      <h2 class="queue-name">${queue.name}</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm btn-primary" id="addToQueueBtn">+ Add</button>
        <button class="btn btn-sm" id="renameQueueBtn">✏️</button>
        <button class="btn btn-sm btn-danger" id="deleteQueueBtn">🗑️</button>
      </div>
    </div>
    ${entries.length === 0 ? `
      <div class="empty-state">
        <p>Queue is empty.</p>
        <p style="font-size:0.85em;color:var(--text-muted)">Add models to plan your next painting session.</p>
      </div>
    ` : `
      <div class="queue-entries">
        ${entries.map((entry, idx) => queueEntryCard(entry, idx, entries.length, queueId)).join('')}
      </div>
    `}
  `;
}

function queueEntryCard(entry, idx, total, queueId) {
  const model = appData.models[entry.modelId];
  if (!model) return '';

  const pts = modelPoints(model);
  const thresh = modelThreshold(model);
  const isFirst = idx === 0;

  return `
    <div class="queue-entry ${isFirst ? 'queue-entry-next' : ''}" data-entry-id="${entry.id}" data-queue-id="${queueId}">
      ${isFirst ? '<div class="queue-up-next-label">⭐ Up Next</div>' : ''}
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <div class="queue-entry-name">${model.name}</div>
          <div class="queue-entry-qty">×${model.quantity}</div>
          ${thresholdBadge(thresh)}
        </div>
        ${progressBar(pts.pct)}
        ${entry.note ? `<div class="queue-entry-note">📌 ${entry.note}</div>` : ''}
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-primary" data-log-model="${entry.modelId}">📝 Log</button>
          <button class="btn btn-sm" data-edit-note="${entry.id}">📌 Note</button>
          <div class="queue-move-btns">
            <button class="btn btn-sm" data-move-up="${entry.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn btn-sm" data-move-down="${entry.id}" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
          </div>
          <button class="btn btn-sm btn-danger" data-remove-entry="${entry.id}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function wireQueueBody(container) {
  // Add to queue
  container.querySelector('#addToQueueBtn')?.addEventListener('click', () => {
    showAddToQueue(activeQueueId);
  });

  // Rename queue
  container.querySelector('#renameQueueBtn')?.addEventListener('click', () => {
    const queue = appData.queues[activeQueueId];
    const name = prompt('Rename queue:', queue.name);
    if (name?.trim()) {
      renameQueue(activeQueueId, name.trim());
      renderQueues();
    }
  });

  // Delete queue
  container.querySelector('#deleteQueueBtn')?.addEventListener('click', () => {
    const queue = appData.queues[activeQueueId];
    if (!confirm(`Delete queue "${queue.name}"?`)) return;
    deleteQueue(activeQueueId);
    activeQueueId = null;
    renderQueues();
  });

  // Log progress
  container.querySelectorAll('[data-log-model]').forEach(btn => {
    btn.addEventListener('click', () => {
      showLogProgress(btn.dataset.logModel);
    });
  });

  // Move up/down
  container.querySelectorAll('[data-move-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      moveEntry(activeQueueId, btn.dataset.moveUp, 'up');
      renderQueues();
    });
  });
  container.querySelectorAll('[data-move-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      moveEntry(activeQueueId, btn.dataset.moveDown, 'down');
      renderQueues();
    });
  });

  // Remove from queue
  container.querySelectorAll('[data-remove-entry]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove from queue?')) return;
      removeFromQueue(activeQueueId, btn.dataset.removeEntry);
      renderQueues();
    });
  });

  // Edit note
  container.querySelectorAll('[data-edit-note]').forEach(btn => {
    btn.addEventListener('click', () => {
      const entryId = btn.dataset.editNote;
      const queue = appData.queues[activeQueueId];
      const entry = queue?.entries.find(e => e.id === entryId);
      const note = prompt('Note for this model (leave blank to clear):', entry?.note || '');
      if (note !== null) {
        updateEntryNote(activeQueueId, entryId, note.trim());
        renderQueues();
      }
    });
  });
}

// --- Add to queue modal (pool picker) ---

function showAddToQueue(queueId) {
  const queue = appData.queues[queueId];
  if (!queue) return;

  const alreadyInQueue = new Set(queue.entries.map(e => e.modelId));
  const allModels = Object.values(appData.models);
  const folders = Object.values(appData.folders || {}).sort((a, b) => a.name.localeCompare(b.name));
  // Selections persist here so they survive the picker re-rendering on search/folder filter changes
  const selected = new Set();

  const content = document.createElement('div');

  const renderPicker = (filter = '', folderId = '') => {
    const available = allModels.filter(m => {
      if (modelThreshold(m) === 'finished') return false;
      if (alreadyInQueue.has(m.id)) return false;
      const matchName = m.name.toLowerCase().includes(filter.toLowerCase());
      const matchFolder = !folderId || m.folderId === folderId;
      return matchName && matchFolder;
    });

    if (!available.length) return '<p style="color:var(--text-muted);font-size:0.85em;padding:0.5em 0">No available models. Finished models and models already in this queue are excluded.</p>';

    return available.map(m => `
      <label class="pool-pick-item">
        <input type="checkbox" value="${m.id}" ${selected.has(m.id) ? 'checked' : ''}>
        <span class="pool-pick-name">${m.name}</span>
        <span class="pool-pick-qty">×${m.quantity}</span>
        ${m.folderId && appData.folders?.[m.folderId] ? `<span class="pool-pick-folder">📁 ${appData.folders[m.folderId].name}</span>` : ''}
      </label>
    `).join('');
  };

  content.innerHTML = `
    <div class="pool-filter-row">
      <input id="queueSearch" class="form-input" type="text" placeholder="Search models...">
      <select id="queueFolderFilter" class="form-input" style="width:auto;flex:0 1 140px">
        <option value="">All folders</option>
        ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
      </select>
    </div>
    <div class="pool-picker" id="queuePicker">
      ${renderPicker()}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="queuePickSave">Add to Queue</button>
      <button class="btn" id="queuePickCancel">Cancel</button>
    </div>
  `;

  const picker = content.querySelector('#queuePicker');

  const updatePicker = () => {
    picker.innerHTML = renderPicker(
      content.querySelector('#queueSearch').value,
      content.querySelector('#queueFolderFilter').value
    );
  };

  // Delegated listener: the picker's checkboxes get replaced on every filter change,
  // so track checked state in `selected` rather than reading the DOM at save time.
  picker.addEventListener('change', e => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    if (e.target.checked) selected.add(e.target.value);
    else selected.delete(e.target.value);
  });

  content.querySelector('#queueSearch').addEventListener('input', updatePicker);
  content.querySelector('#queueFolderFilter').addEventListener('change', updatePicker);

  content.querySelector('#queuePickSave').addEventListener('click', () => {
    selected.forEach(modelId => addToQueue(queueId, modelId));
    closeModal();
    renderQueues();
  });

  content.querySelector('#queuePickCancel').addEventListener('click', () => closeModal());
  showModal({ title: `Add to "${queue.name}"`, content, wide: true });
}
