// collections.js — collections, army lists, and model assignment UI

import {
  appData, createCollection, deleteCollection,
  createList, deleteList, addModelToList, removeModelFromList,
  listStats, saveData, uid, GAME_SYSTEMS
} from './data.js';
import { showModal, closeModal, toast, progressBar, thresholdBadge, createDateInput, getDateValue } from './ui.js';
import { applyTheme, resetTheme, getTerm } from './theme.js';
import { showLogProgress, showModelDetail } from './models.js';

let activeCollectionId = null;
let activeListId = null;

// --- Main collections view ---

export function renderCollections() {
  const container = document.getElementById('collectionsView');
  if (!container) return;

  const collections = Object.values(appData.collections);

  if (!collections.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No game systems yet. Add one to get started.</p>
        <button class="btn btn-primary" id="addFirstCollection">+ Add Game System</button>
      </div>`;
    document.getElementById('addFirstCollection')?.addEventListener('click', showCollectionForm);
    return;
  }

  container.innerHTML = `
    <div class="collections-layout">
      <div class="collections-sidebar" id="collectionsSidebar"></div>
      <div class="collections-main" id="collectionsMain">
        <div class="empty-state"><p>Select a game system or army list.</p></div>
      </div>
    </div>
  `;

  renderCollectionsSidebar();

  if (activeCollectionId) {
    selectCollection(activeCollectionId);
    if (activeListId) selectList(activeListId);
  }
}

function renderCollectionsSidebar() {
  const sidebar = document.getElementById('collectionsSidebar');
  if (!sidebar) return;

  const collections = Object.values(appData.collections);

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <span>Game Systems</span>
      <button class="btn btn-sm btn-primary" id="addCollBtn">+</button>
    </div>
    <div class="sidebar-list">
      ${collections.map(col => {
        const sys = GAME_SYSTEMS[col.gameSystemId];
        const lists = (col.listIds || []).map(lid => appData.lists[lid]).filter(Boolean);
        const isActive = col.id === activeCollectionId;
        return `
          <div class="sidebar-collection ${isActive ? 'active' : ''}" data-col-id="${col.id}">
            <div class="sidebar-col-header">
              <span class="sidebar-col-name">${col.name}</span>
              <span class="sys-tag ${sys?.theme || ''}">${sys?.shortLabel || ''}</span>
              <div class="sidebar-col-actions">
                <button class="btn btn-xs" data-col-edit="${col.id}">✏️</button>
                <button class="btn btn-xs btn-danger" data-col-delete="${col.id}">🗑️</button>
              </div>
            </div>
            ${isActive ? `
              <div class="sidebar-lists">
                ${lists.map(list => `
                  <div class="sidebar-list-item ${list.id === activeListId ? 'active' : ''}" data-list-id="${list.id}">
                    <span>${list.name}</span>
                    <div class="sidebar-col-actions">
                      <button class="btn btn-xs" data-list-edit="${list.id}">✏️</button>
                      <button class="btn btn-xs btn-danger" data-list-delete="${list.id}">🗑️</button>
                    </div>
                  </div>
                `).join('')}
                <button class="btn btn-sm sidebar-add-list" data-col-add-list="${col.id}">+ Army List</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  sidebar.querySelector('#addCollBtn')?.addEventListener('click', showCollectionForm);

  sidebar.querySelectorAll('[data-col-id]').forEach(el => {
    el.querySelector('.sidebar-col-name')?.addEventListener('click', () => selectCollection(el.dataset.colId));
  });
  sidebar.querySelectorAll('[data-col-edit]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); showCollectionForm(el.dataset.colEdit); });
  });
  sidebar.querySelectorAll('[data-col-delete]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); confirmDeleteCollection(el.dataset.colDelete); });
  });
  sidebar.querySelectorAll('[data-list-id]').forEach(el => {
    el.querySelector('span')?.addEventListener('click', () => selectList(el.dataset.listId));
  });
  sidebar.querySelectorAll('[data-list-edit]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); showListForm(null, el.dataset.listEdit); });
  });
  sidebar.querySelectorAll('[data-list-delete]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); confirmDeleteList(el.dataset.listDelete); });
  });
  sidebar.querySelectorAll('[data-col-add-list]').forEach(el => {
    el.addEventListener('click', () => showListForm(el.dataset.colAddList));
  });
}

function selectCollection(colId) {
  activeCollectionId = colId;
  activeListId = null;
  const col = appData.collections[colId];
  if (!col) return;

  applyTheme(col.gameSystemId);
  renderCollectionsSidebar();

  const main = document.getElementById('collectionsMain');
  if (!main) return;

  const lists = (col.listIds || []).map(lid => appData.lists[lid]).filter(Boolean);
  const sys = GAME_SYSTEMS[col.gameSystemId];

  main.innerHTML = `
    <div class="main-header">
      <h2>${col.name}</h2>
      <span class="sys-tag ${sys?.theme || ''}">${sys?.label || ''}</span>
    </div>
    <div class="list-grid">
      ${lists.map(list => {
        const stats = listStats(list);
        return `
          <div class="list-card" data-list-select="${list.id}">
            <div class="list-card-name">${list.name}</div>
            ${progressBar(stats.pct)}
            <div class="list-card-stats">
              <span>⚔️ ${stats.tableReady}/${stats.total}</span>
              <span>🎨 ${stats.painted}/${stats.total}</span>
              <span>🏆 ${stats.finished}/${stats.total}</span>
            </div>
          </div>
        `;
      }).join('')}
      <div class="list-card list-card-add" id="addListCard">
        <div>+ New ${getTerm('army')} List</div>
      </div>
    </div>
  `;

  main.querySelectorAll('[data-list-select]').forEach(el => {
    el.addEventListener('click', () => selectList(el.dataset.listSelect));
  });
  main.querySelector('#addListCard')?.addEventListener('click', () => showListForm(colId));
}

function selectList(listId) {
  activeListId = listId;
  const list = appData.lists[listId];
  if (!list) return;

  renderCollectionsSidebar();

  const main = document.getElementById('collectionsMain');
  if (!main) return;

  const col = appData.collections[list.collectionId];
  const stats = listStats(list);
  const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);

  main.innerHTML = `
    <div class="main-header">
      <button class="btn btn-sm" id="backToCol">← ${col?.name || 'Back'}</button>
      <h2>${list.name}</h2>
      <button class="btn btn-sm" id="shareListBtn" title="Share progress">📤 Share</button>
    </div>
    <div class="list-summary">
      ${progressBar(stats.pct)}
      <div class="threshold-row">
        <span class="thresh-item">⚔️ ${stats.tableReady}/${stats.total} Table Ready</span>
        <span class="thresh-item">🎨 ${stats.painted}/${stats.total} Painted</span>
        <span class="thresh-item">🏆 ${stats.finished}/${stats.total} Finished</span>
      </div>
      <div class="pts-label">${stats.donePts} / ${stats.totalPts} pts (${stats.pct}%)</div>
      <div class="list-deadline-row">
        <label>🎯 Target date (optional)</label>
        ${createDateInput('listDeadlineInput', list.deadline || '')}
        ${list.deadline ? `<button class="btn btn-xs btn-danger" id="clearDeadlineBtn">✕</button>` : ''}
      </div>
    </div>
    <div class="list-models-header">
      <h3>${getTerm('group')}s / ${getTerm('model')}s</h3>
      <button class="btn btn-primary btn-sm" id="addModelToListBtn">+ Add from Pool</button>
    </div>
    <div class="list-models" id="listModels">
      ${models.length ? models.map(m => listModelRow(m, listId)).join('') : `<div class="empty-state"><p>No models in this list yet.</p></div>`}
    </div>
  `;

  main.querySelector('#backToCol')?.addEventListener('click', () => selectCollection(list.collectionId));
  main.querySelector('#addModelToListBtn')?.addEventListener('click', () => showAddModelToList(listId));
  main.querySelector('#shareListBtn')?.addEventListener('click', () => shareList(listId));

  // Deadline save — works for native input and dropdowns
  const deadlineEl = document.getElementById('listDeadlineInput');
  const saveListDeadline = () => {
    const val = getDateValue('listDeadlineInput');
    if (val !== (list.deadline || '')) {
      list.deadline = val || null;
      saveData();
      toast(val ? 'Deadline saved' : 'Deadline cleared', 'success');
      selectList(listId); // re-render to update clear button
    }
  };
  if (deadlineEl) {
    if (deadlineEl.tagName === 'INPUT') {
      deadlineEl.addEventListener('change', saveListDeadline);
    } else {
      deadlineEl.querySelectorAll('select').forEach(s => s.addEventListener('change', saveListDeadline));
    }
  }

  main.querySelector('#clearDeadlineBtn')?.addEventListener('click', () => {
    list.deadline = null;
    saveData();
    toast('Deadline cleared', 'info');
    selectList(listId);
  });

  main.querySelectorAll('[data-model-view]').forEach(el => {
    el.addEventListener('click', () => showModelDetail(el.dataset.modelView));
  });
  main.querySelectorAll('[data-model-log]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); showLogProgress(el.dataset.modelLog); });
  });
  main.querySelectorAll('[data-model-remove]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      removeModelFromList(listId, el.dataset.modelRemove);
      toast('Removed from list', 'info');
      selectList(listId);
    });
  });
}

function listModelRow(model, listId) {
  const { modelPoints, modelThreshold } = window._dataHelpers || {};
  // Import inline since we need it here
  const pts = calcModelPoints(model);
  const thresh = calcModelThreshold(model);

  return `
    <div class="list-model-row" data-model-view="${model.id}">
      <div class="list-model-info">
        <div class="list-model-name">${model.name}</div>
        <div class="list-model-qty">×${model.quantity}</div>
      </div>
      <div class="list-model-prog">
        <div class="prog-bar"><div class="prog-fill" style="width:${pts.pct}%"></div></div>
        <span class="list-model-thresh">${thresholdBadge(thresh)}</span>
      </div>
      <div class="list-model-actions">
        <button class="btn btn-sm btn-primary" data-model-log="${model.id}">📝</button>
        <button class="btn btn-sm btn-danger" data-model-remove="${model.id}">✕</button>
      </div>
    </div>
  `;
}

// Inline helpers to avoid circular imports in some environments
function calcModelPoints(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  let total = 0, done = 0;
  stages.forEach(s => {
    if (skipped.includes(s.id)) return;
    total += (s.points || 1) * model.quantity;
    const prog = model.progress[s.id] || { done: 0 };
    done += Math.min(prog.done, model.quantity) * (s.points || 1);
  });
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

function calcModelThreshold(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const activeStages = stages.filter(s => !skipped.includes(s.id));

  const hasThresholds = stages.some(s => s.threshold);
  if (!hasThresholds) {
    const allDone = activeStages.length > 0 &&
      activeStages.every(s => (model.progress[s.id]?.done || 0) >= model.quantity);
    return allDone ? 'finished' : null;
  }

  for (const thresh of ['finished', 'painted', 'table_ready']) {
    const threshStageIdx = stages.findIndex(s => s.threshold === thresh);
    if (threshStageIdx === -1) continue;
    const allDone = stages.slice(0, threshStageIdx + 1).every(s => {
      if (skipped.includes(s.id)) return true;
      return (model.progress[s.id]?.done || 0) >= model.quantity;
    });
    if (allDone) return thresh;
  }
  return null;
}

// --- Add models from pool to list ---

function showAddModelToList(listId) {
  const list = appData.lists[listId];
  if (!list) return;

  const allModels = Object.values(appData.models);
  const already = list.modelIds || [];

  const content = document.createElement('div');
  content.innerHTML = `
    <p>Select models from your pool to add to this list:</p>
    <div class="pool-picker" id="poolPicker">
      ${allModels.map(m => `
        <label class="pool-pick-item ${already.includes(m.id) ? 'already-in' : ''}">
          <input type="checkbox" value="${m.id}" ${already.includes(m.id) ? 'checked disabled' : ''}>
          <span class="pool-pick-name">${m.name}</span>
          <span class="pool-pick-qty">×${m.quantity}</span>
        </label>
      `).join('') || '<p>No models in pool yet.</p>'}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="poolPickSave">Add Selected</button>
      <button class="btn" id="poolPickCancel">Cancel</button>
    </div>
  `;

  content.querySelector('#poolPickSave')?.addEventListener('click', () => {
    content.querySelectorAll('#poolPicker input:checked:not(:disabled)').forEach(cb => {
      addModelToList(listId, cb.value);
    });
    toast('Models added to list!', 'success');
    closeModal();
    selectList(listId);
  });

  content.querySelector('#poolPickCancel')?.addEventListener('click', () => closeModal());

  showModal({ title: `Add ${getTerm('model')}s to List`, content, wide: true });
}

// --- Collection form ---

function showCollectionForm(editId = null) {
  editId = editId || null;
  const col = editId ? appData.collections[editId] : null;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input id="cfName" class="form-input" type="text" placeholder="e.g. Warhammer Old World" value="${col?.name || ''}">
    </div>
    <div class="form-group">
      <label>Game System</label>
      <select id="cfSys" class="form-input">
        ${Object.values(GAME_SYSTEMS).map(s =>
          `<option value="${s.id}" ${col?.gameSystemId === s.id ? 'selected' : ''}>${s.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="cfSave">${editId ? 'Update' : 'Create'}</button>
      <button class="btn" id="cfCancel">Cancel</button>
    </div>
  `;

  content.querySelector('#cfSave').addEventListener('click', () => {
    try {
      const name = content.querySelector('#cfName').value.trim();
      if (!name) { toast('Please enter a name', 'error'); return; }
      createCollection({ name, gameSystemId: 'old_world' });
      closeModal();
      renderCollections();
    } catch(e) {
      alert('Error: ' + e.message);
    }
});

  content.querySelector('#cfCancel').addEventListener('click', () => closeModal());
  showModal({ title: editId ? 'Edit Game System' : 'New Game System', content });
}

function confirmDeleteCollection(id) {
  const col = appData.collections[id];
  if (!col) return;
  if (!window.confirm(`Delete "${col.name}" and all its army lists?`)) return;
  deleteCollection(id);
  activeCollectionId = null;
  activeListId = null;
  resetTheme();
  toast('Deleted', 'info');
  renderCollections();
}

// --- List form ---

function showListForm(collectionId = null, editId = null) {
  const list = editId ? appData.lists[editId] : null;
  const colId = collectionId || list?.collectionId;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label>${getTerm('army')} List Name</label>
      <input id="lfName" class="form-input" type="text" placeholder="e.g. High Elves — Tournament List" value="${list?.name || ''}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="lfSave">${editId ? 'Update' : 'Create'}</button>
      <button class="btn" id="lfCancel">Cancel</button>
    </div>
  `;

  content.querySelector('#lfSave').addEventListener('click', () => {
    const name = content.querySelector('#lfName').value.trim();
    if (!name) { toast('Please enter a name', 'error'); return; }

    if (editId) {
      Object.assign(appData.lists[editId], { name });
      saveData();
      toast('Updated!', 'success');
    } else {
      createList({ name, collectionId: colId });
      toast('List created!', 'success');
    }
    closeModal();
    setTimeout(() => renderCollections(), 50);
    if (activeCollectionId) selectCollection(activeCollectionId);
  });

  content.querySelector('#lfCancel').addEventListener('click', () => closeModal());
  showModal({ title: editId ? `Edit ${getTerm('army')} List` : `New ${getTerm('army')} List`, content });
}

function confirmDeleteList(id) {
  const list = appData.lists[id];
  if (!list) return;
  if (!window.confirm(`Delete list "${list.name}"? Models in your pool won't be affected.`)) return;
  const colId = list.collectionId;
  deleteList(id);
  if (activeListId === id) activeListId = null;
  toast('List deleted', 'info');
  renderCollections();
  if (colId) selectCollection(colId);
}

// --- Share list as text ---

function shareList(listId) {
  const list = appData.lists[listId];
  if (!list) return;

  const col = appData.collections[list.collectionId];
  const sys = col ? GAME_SYSTEMS[col.gameSystemId] : null;
  const stats = listStats(list);
  const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);

  const threshLabel = (thresh) => {
    if (thresh === 'finished')    return '🏆 Finished';
    if (thresh === 'painted')     return '🎨 Painted';
    if (thresh === 'table_ready') return '⚔️ Table Ready';
    return '🔧 In Progress';
  };

  const bar = (pct) => {
    const filled = Math.round(pct / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
  };

  // Regiment breakdown — one line each
  const regimentLines = models.map(m => {
    const thresh = calcModelThreshold(m);
    const pts = calcModelPoints(m);
    const label = threshLabel(thresh);
    const extra = thresh === null ? ` (${pts.pct}%)` : '';
    return `• ${m.name} ×${m.quantity} — ${label}${extra}`;
  }).join('\n');

  // Deadline line
  let deadlineLine = '';
  if (list.deadline) {
    const days = Math.ceil((new Date(list.deadline) - new Date()) / 86400000);
    const ptsLeft = stats.totalPts - stats.donePts;
    const pace = days > 0 ? (ptsLeft / days).toFixed(1) : null;
    const daysStr = days < 0
      ? `${Math.abs(days)} days overdue`
      : days === 0 ? 'due today'
      : `${days} days to go`;
    const paceStr = pace ? ` · ${pace} pts/day needed` : '';
    const d = new Date(list.deadline + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    deadlineLine = `\n📅 Target: ${dateStr} · ${daysStr}${paceStr}`;
  }

  const sysLine = sys ? ` (${sys.shortLabel})` : '';

  const text = [
    `⚔️ ${list.name}${sysLine}`,
    `${'━'.repeat(Math.min(list.name.length + sysLine.length + 2, 32))}`,
    ``,
    `📊 Progress: ${bar(stats.pct)}`,
    `   ${stats.donePts}/${stats.totalPts} hobby points`,
    ``,
    `⚔️ Table Ready: ${stats.tableReady}/${stats.total}`,
    `🎨 Painted:     ${stats.painted}/${stats.total}`,
    `🏆 Finished:    ${stats.finished}/${stats.total}`,
    ``,
    `📋 Regiments:`,
    regimentLines || '  (none)',
    deadlineLine,
  ].filter(l => l !== undefined).join('\n').trim();

  // Try native share sheet first (mobile), fall back to clipboard
  if (navigator.share) {
    navigator.share({ title: list.name, text })
      .catch(() => {}); // user cancelled — no error needed
  } else {
    navigator.clipboard.writeText(text)
      .then(() => toast('Copied to clipboard!', 'success'))
      .catch(() => {
        // Last resort — show in a modal they can copy manually
        showShareFallback(text);
      });
  }
}

function showShareFallback(text) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:0.75em">
      Copy the text below and paste it into WhatsApp or any messenger:
    </p>
    <textarea class="form-input share-text-area" readonly rows="16">${text}</textarea>
    <div class="modal-actions">
      <button class="btn btn-primary" id="shareCopyBtn">📋 Copy</button>
      <button class="btn" id="shareCloseBtn">Close</button>
    </div>
  `;
  content.querySelector('#shareCopyBtn').addEventListener('click', () => {
    content.querySelector('.share-text-area').select();
    document.execCommand('copy');
    toast('Copied!', 'success');
  });
  content.querySelector('#shareCloseBtn').addEventListener('click', () => closeModal());
  showModal({ title: '📤 Share Progress', content, wide: true });
}
