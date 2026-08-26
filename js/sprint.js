// sprint.js — sprint planning (formerly "queues"): manually-ordered work
// lists that can optionally be time-boxed with a capacity check against pace.

import {
  appData, saveData, uid, modelThreshold, modelPoints, getRoadmapLists,
  splitModelPoints, splitModelThreshold, splitModelDoneCount, isMothballed
} from './data.js';
import { showModal, closeModal, toast, thresholdBadge, progressBar, createDateInput, getDateValue, formatDate, today, addDays } from './ui.js';
import { showLogProgress } from './models.js';
import { paceRate } from './charts.js';

// --- Data helpers ---

export function createSprint(name) {
  if (!appData.sprints) appData.sprints = {};
  const id = uid();
  appData.sprints[id] = { id, name, startDate: null, endDate: null, entries: [] };
  // entries: [{ id, modelId, note }]
  saveData();
  return id;
}

export function deleteSprint(id) {
  if (!appData.sprints) return;
  delete appData.sprints[id];
  saveData();
}

export function renameSprint(id, name) {
  if (!appData.sprints?.[id]) return;
  appData.sprints[id].name = name;
  saveData();
}

export function setSprintDates(id, startDate, endDate) {
  if (!appData.sprints?.[id]) return;
  appData.sprints[id].startDate = startDate || null;
  appData.sprints[id].endDate = endDate || null;
  saveData();
}

// chunkSize lets a manual add commit just part of a multi-model regiment
// (e.g. 5 of a 20-strong unit) rather than always the whole thing — same
// chunk concept campaign sprint planning uses, just picked by hand here.
export function addToSprint(sprintId, modelId, note = '', chunkSize = null, chunkOffset = 0) {
  const sprint = appData.sprints?.[sprintId];
  if (!sprint) return;
  // Don't add finished models
  const model = appData.models[modelId];
  if (!model) return;
  if (modelThreshold(model) === 'finished') {
    toast('Finished models cannot be added to a sprint', 'error');
    return;
  }
  // Allow duplicates across sprints, and multiple chunks of the same model
  // within one sprint — only block a second *whole*-model entry, which would
  // be a plain redundant duplicate.
  if (chunkSize == null && sprint.entries.some(e => e.modelId === modelId && e.chunkSize == null)) {
    toast('Model already in this sprint', 'error');
    return;
  }
  sprint.entries.push({ id: uid(), modelId, note, chunkSize, chunkOffset: chunkSize != null ? chunkOffset : null });
  saveData();
}

// Resizes an existing entry's chunk after the fact (e.g. "actually make that
// 8 of the 20, not 5"). Sizing up to the model's full quantity turns it back
// into a plain whole-model entry.
export function setSprintEntryChunk(sprintId, entryId, size) {
  const sprint = appData.sprints?.[sprintId];
  if (!sprint) return;
  const entry = sprint.entries.find(e => e.id === entryId);
  if (!entry) return;
  const model = appData.models[entry.modelId];
  if (!model) return;
  const clamped = Math.max(1, Math.min(model.quantity, Math.round(size) || 1));
  entry.chunkSize = clamped < model.quantity ? clamped : null;
  entry.chunkOffset = entry.chunkSize != null ? (entry.chunkOffset || 0) : null;
  saveData();
}

// Adds model chunks to a sprint — either a whole model, or (for a multi-model
// regiment) just a quantity slice of one, e.g. 4 of a 20-strong unit — using
// the same offset/size split math as the Army List "split unit" feature, so a
// big regiment can be spread across several sprints instead of overloading
// one. Used by Roadmap campaign planning rather than the manual "+ Add"
// picker, which always adds whole models. Returns the number of entries added.
export function addChunksToSprint(sprintId, chunks) {
  const sprint = appData.sprints?.[sprintId];
  if (!sprint) return 0;
  let added = 0;
  chunks.forEach(({ modelId, size, offset }) => {
    const model = appData.models[modelId];
    if (!model) return;
    sprint.entries.push({ id: uid(), modelId, note: '', chunkSize: size, chunkOffset: offset || 0 });
    added++;
  });
  if (added) saveData();
  return added;
}

export function removeFromSprint(sprintId, entryId) {
  const sprint = appData.sprints?.[sprintId];
  if (!sprint) return;
  sprint.entries = sprint.entries.filter(e => e.id !== entryId);
  saveData();
}

export function moveSprintEntry(sprintId, entryId, direction) {
  const sprint = appData.sprints?.[sprintId];
  if (!sprint) return;
  const idx = sprint.entries.findIndex(e => e.id === entryId);
  if (idx === -1) return;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= sprint.entries.length) return;
  [sprint.entries[idx], sprint.entries[newIdx]] = [sprint.entries[newIdx], sprint.entries[idx]];
  saveData();
}

export function updateSprintEntryNote(sprintId, entryId, note) {
  const sprint = appData.sprints?.[sprintId];
  if (!sprint) return;
  const entry = sprint.entries.find(e => e.id === entryId);
  if (entry) { entry.note = note; saveData(); }
}

// Auto-remove finished models from all sprints
export function pruneFinishedFromSprints() {
  if (!appData.sprints) return;
  let pruned = false;
  Object.values(appData.sprints).forEach(sprint => {
    const before = sprint.entries.length;
    sprint.entries = sprint.entries.filter(e => {
      const model = appData.models[e.modelId];
      return model && modelThreshold(model) !== 'finished';
    });
    if (sprint.entries.length !== before) pruned = true;
  });
  if (pruned) saveData();
}

// --- Capacity ---

// An entry is either a whole model, or (for a multi-model regiment) just a
// quantity slice of one — see addChunksToSprint().
function entryPoints(model, entry) {
  return entry.chunkSize != null ? splitModelPoints(model, entry.chunkSize, entry.chunkOffset || 0) : modelPoints(model);
}

function entryThreshold(model, entry) {
  return entry.chunkSize != null ? splitModelThreshold(model, entry.chunkSize, entry.chunkOffset || 0) : modelThreshold(model);
}

function sprintRemainingPoints(sprint) {
  return sprint.entries.reduce((sum, e) => {
    const model = appData.models[e.modelId];
    if (!model) return sum;
    // Mothballed models can't be worked on, so they're not work this sprint
    // has to absorb — leaving one in only holds its place in the order.
    if (isMothballed(model)) return sum;
    const pts = entryPoints(model, e);
    return sum + Math.max(0, pts.total - pts.done);
  }, 0);
}

function daysBetween(startStr, endStr) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  return Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000);
}

// Returns null for undated sprints (they skip capacity checking entirely and
// behave like a plain priority list). Otherwise compares remaining work
// against projected capacity for the sprint's date range.
export function sprintCapacityStats(sprint) {
  if (!sprint.startDate || !sprint.endDate) return null;
  const remainingPts = sprintRemainingPoints(sprint);
  const dayCount = Math.max(1, daysBetween(sprint.startDate, sprint.endDate) + 1);
  const rate = paceRate();
  const hasRate = rate > 0;
  const capacityPts = Math.round(rate * dayCount);

  let status;
  if (!hasRate) status = 'unknown';
  else if (remainingPts <= capacityPts * 0.85) status = 'ok';
  else if (remainingPts <= capacityPts * 1.15) status = 'tight';
  else status = 'over';

  return { remainingPts, capacityPts, dayCount, status, hasRate };
}

// --- Timeline (Gantt-style, hand-rolled HTML/CSS — no charting lib needed) ---

// One row per dated sprint plus one row per roadmap campaign with a deadline,
// sorted so the timeline reads chronologically top to bottom.
function timelineRows() {
  const dated = Object.values(appData.sprints || {})
    .filter(s => s.startDate && s.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const deadlineCampaigns = getRoadmapLists()
    .filter(l => l.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  return [
    ...dated.map(sprint => ({ type: 'sprint', sprint })),
    ...deadlineCampaigns.map(list => ({ type: 'deadline', list })),
  ];
}

// First day of every month spanned by [minStr, maxStr], used as axis gridlines.
function monthTicks(minStr, maxStr) {
  const ticks = [];
  let [y, m] = minStr.split('-').map(Number);
  while (true) {
    const boundary = `${y}-${String(m).padStart(2, '0')}-01`;
    if (boundary > maxStr) break;
    if (boundary >= minStr) ticks.push(boundary);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return ticks;
}

function pctForDate(dateStr, rangeMin, totalDays) {
  const offset = daysBetween(rangeMin, dateStr);
  return Math.min(100, Math.max(0, (offset / totalDays) * 100));
}

function timelineRowHtml(row, rangeMin, totalDays, todayStr, guides) {
  const isSprintRow = row.type === 'sprint';
  const label = isSprintRow ? row.sprint.name : `🎯 ${row.list.name}`;

  const guidesHtml = guides.map(g => `<div class="timeline-month-guide" style="left:${pctForDate(g, rangeMin, totalDays)}%"></div>`).join('');
  const todayHtml = `<div class="timeline-today" style="left:${pctForDate(todayStr, rangeMin, totalDays)}%"></div>`;

  let markerHtml;
  if (isSprintRow) {
    const s = row.sprint;
    const cap = sprintCapacityStats(s);
    const leftPct = pctForDate(s.startDate, rangeMin, totalDays);
    const widthPct = Math.max(pctForDate(s.endDate, rangeMin, totalDays) - leftPct, 1.5);
    const tooltip = `${s.name}: ${formatDate(s.startDate, { day: 'numeric', month: 'short' })} → ${formatDate(s.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    markerHtml = `<div class="timeline-bar status-${cap?.status || 'unknown'}" style="left:${leftPct}%;width:${widthPct}%" title="${tooltip}"></div>`;
  } else {
    const l = row.list;
    const leftPct = pctForDate(l.deadline, rangeMin, totalDays);
    const tooltip = `🎯 ${l.name} deadline: ${formatDate(l.deadline, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    markerHtml = `<div class="timeline-diamond" style="left:${leftPct}%" title="${tooltip}"></div>`;
  }

  return `
    <div class="timeline-row">
      <div class="timeline-row-label" title="${label}">${label}</div>
      <div class="timeline-row-track">
        ${guidesHtml}
        ${todayHtml}
        ${markerHtml}
      </div>
    </div>
  `;
}

function renderTimelineCard() {
  const rows = timelineRows();
  if (!rows.length) {
    return `
      <div class="dash-card timeline-card">
        <h3>🗓️ Timeline</h3>
        <p class="timeline-empty">Set dates on a sprint, or a deadline on a Roadmap campaign, to see them plotted here.</p>
      </div>
    `;
  }

  const todayStr = today();
  const allDates = [
    ...rows.flatMap(r => r.type === 'sprint' ? [r.sprint.startDate, r.sprint.endDate] : [r.list.deadline]),
    todayStr
  ].sort();
  const rangeMin = addDays(allDates[0], -3);
  const rangeMax = addDays(allDates[allDates.length - 1], 3);
  const totalDays = Math.max(1, daysBetween(rangeMin, rangeMax));
  const guides = monthTicks(rangeMin, rangeMax);

  return `
    <div class="dash-card timeline-card">
      <h3>🗓️ Timeline</h3>
      <div class="timeline-axis-row">
        <div class="timeline-label-spacer"></div>
        <div class="timeline-axis-track">
          ${guides.map(g => `<span class="timeline-axis-tick" style="left:${pctForDate(g, rangeMin, totalDays)}%">${formatDate(g, { month: 'short' })}</span>`).join('')}
        </div>
      </div>
      ${rows.map(row => timelineRowHtml(row, rangeMin, totalDays, todayStr, guides)).join('')}
    </div>
  `;
}

// --- Render ---

let activeSprintId = null;

// Lets other tabs (e.g. Roadmap's "View Sprint" link) pick which sprint is
// showing before switching to this tab.
export function focusSprint(id) {
  activeSprintId = id;
}

export function renderSprints() {
  const container = document.getElementById('sprintsView');
  if (!container) return;

  if (!appData.sprints) appData.sprints = {};
  pruneFinishedFromSprints();

  const sprints = Object.values(appData.sprints);

  // Set active sprint to first if not set
  if (!activeSprintId || !appData.sprints[activeSprintId]) {
    activeSprintId = sprints[0]?.id || null;
  }

  container.innerHTML = `
    ${renderTimelineCard()}
    <div class="queue-layout">
      <div class="queue-tabs-bar">
        <div class="queue-tab-list" id="sprintTabList">
          ${sprints.map(s => `
            <button class="queue-tab-btn ${s.id === activeSprintId ? 'active' : ''}" data-sprint-id="${s.id}">
              ${s.name}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-sm btn-primary" id="newSprintBtn">+ Sprint</button>
      </div>
      <div class="queue-body" id="sprintBody">
        ${activeSprintId ? renderSprintBody(activeSprintId) : `
          <div class="empty-state">
            <p>No sprints yet.</p>
            <p style="font-size:0.85em;color:var(--text-muted)">Create a sprint to plan your next painting — with dates for a real deadline, or without for a plain priority list.</p>
          </div>
        `}
      </div>
    </div>
  `;

  // Sprint tab switching
  container.querySelectorAll('[data-sprint-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSprintId = btn.dataset.sprintId;
      renderSprints();
    });
  });

  // New sprint
  container.querySelector('#newSprintBtn')?.addEventListener('click', () => {
    showSprintForm(null, id => { activeSprintId = id; renderSprints(); });
  });

  // Wire up sprint body events
  wireSprintBody(container);
}

function renderSprintBody(sprintId) {
  const sprint = appData.sprints[sprintId];
  if (!sprint) return '';

  const entries = sprint.entries;
  const cap = sprintCapacityStats(sprint);

  return `
    <div class="queue-header">
      <div>
        <h2 class="queue-name">${sprint.name}</h2>
        ${sprintMetaHtml(sprint, cap)}
      </div>
      <div class="queue-header-actions">
        <button class="btn btn-sm btn-primary" id="addToSprintBtn">+ Add</button>
        <button class="btn btn-sm" id="editSprintBtn">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" id="deleteSprintBtn">🗑️</button>
      </div>
    </div>
    ${entries.length === 0 ? `
      <div class="empty-state">
        <p>Sprint is empty.</p>
        <p style="font-size:0.85em;color:var(--text-muted)">Add models to plan your next painting session.</p>
      </div>
    ` : `
      <div class="queue-entries">
        ${entries.map((entry, idx) => sprintEntryCard(entry, idx, entries.length, sprintId)).join('')}
      </div>
    `}
  `;
}

function sprintMetaHtml(sprint, cap) {
  if (!sprint.startDate || !sprint.endDate) {
    return `<div class="sprint-meta"><span class="sprint-meta-nodates">No dates — plain priority list</span></div>`;
  }
  const dateStr = `${formatDate(sprint.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(sprint.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (!cap) return `<div class="sprint-meta">🎯 ${dateStr}</div>`;

  const statusInfo = {
    ok:      { label: '✅ On track',        cls: 'status-ok' },
    tight:   { label: '⚠️ Tight',           cls: 'status-tight' },
    over:    { label: '🔥 Overcommitted',   cls: 'status-over' },
    unknown: { label: 'ℹ️ No pace data yet', cls: 'status-unknown' },
  }[cap.status];

  return `
    <div class="sprint-meta">
      🎯 ${dateStr}
      <span class="pace-badge ${statusInfo.cls}">${cap.remainingPts} pts needed${cap.hasRate ? ` · ~${cap.capacityPts} pts capacity` : ''} · ${statusInfo.label}</span>
    </div>
  `;
}

function sprintEntryCard(entry, idx, total, sprintId) {
  const model = appData.models[entry.modelId];
  if (!model) return '';

  const isChunk = entry.chunkSize != null;
  const pts = entryPoints(model, entry);
  const thresh = entryThreshold(model, entry);
  const isFirst = idx === 0;
  // A chunk can bundle in already-finished models for free (chooseChunkSize
  // in roadmap.js counts them as zero remaining work), so the chunk size
  // alone overstates how much painting this sprint actually needs.
  const doneInChunk = isChunk ? splitModelDoneCount(model, entry.chunkSize, entry.chunkOffset || 0) : 0;
  const qtyLabel = isChunk
    ? (doneInChunk > 0
      ? `×${entry.chunkSize - doneInChunk} of ${model.quantity}`
      : `×${entry.chunkSize} of ${model.quantity}`)
    : `×${model.quantity}`;

  const mothballed = isMothballed(model);

  return `
    <div class="queue-entry ${isFirst ? 'queue-entry-next' : ''}${mothballed ? ' queue-entry-mothballed' : ''}" data-entry-id="${entry.id}" data-sprint-id="${sprintId}">
      ${isFirst && !mothballed ? '<div class="queue-up-next-label">⭐ Up Next</div>' : ''}
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <div class="queue-entry-name">${model.name}${isChunk ? ' <span class="split-badge">partial</span>' : ''}</div>
          <div class="queue-entry-qty">${qtyLabel}</div>
          ${mothballed ? '<span class="mothball-badge">🧊 Mothballed</span>' : thresholdBadge(thresh)}
        </div>
        ${progressBar(pts.pct)}
        ${entry.note ? `<div class="queue-entry-note">📌 ${entry.note}</div>` : ''}
        <div class="queue-entry-actions">
          ${mothballed
            ? `<span class="queue-entry-inert">Mothballed — remove it, or unmothball it in the Pool</span>`
            : `<button class="btn btn-sm btn-primary" data-log-model="${entry.modelId}">📝 Log</button>`}
          <button class="btn btn-sm" data-edit-note="${entry.id}">📌 Note</button>
          ${model.quantity > 1 ? `<button class="btn btn-sm" data-edit-qty="${entry.id}" title="Change how many of this regiment are in this sprint">✂️ Qty</button>` : ''}
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

function wireSprintBody(container) {
  // Add to sprint
  container.querySelector('#addToSprintBtn')?.addEventListener('click', () => {
    showAddToSprint(activeSprintId);
  });

  // Edit sprint (name + dates)
  container.querySelector('#editSprintBtn')?.addEventListener('click', () => {
    showSprintForm(activeSprintId, () => renderSprints());
  });

  // Delete sprint
  container.querySelector('#deleteSprintBtn')?.addEventListener('click', () => {
    const sprint = appData.sprints[activeSprintId];
    if (!confirm(`Delete sprint "${sprint.name}"?`)) return;
    deleteSprint(activeSprintId);
    activeSprintId = null;
    renderSprints();
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
      moveSprintEntry(activeSprintId, btn.dataset.moveUp, 'up');
      renderSprints();
    });
  });
  container.querySelectorAll('[data-move-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      moveSprintEntry(activeSprintId, btn.dataset.moveDown, 'down');
      renderSprints();
    });
  });

  // Remove from sprint
  container.querySelectorAll('[data-remove-entry]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove from sprint?')) return;
      removeFromSprint(activeSprintId, btn.dataset.removeEntry);
      renderSprints();
    });
  });

  // Edit note
  container.querySelectorAll('[data-edit-note]').forEach(btn => {
    btn.addEventListener('click', () => {
      const entryId = btn.dataset.editNote;
      const sprint = appData.sprints[activeSprintId];
      const entry = sprint?.entries.find(e => e.id === entryId);
      const note = prompt('Note for this model (leave blank to clear):', entry?.note || '');
      if (note !== null) {
        updateSprintEntryNote(activeSprintId, entryId, note.trim());
        renderSprints();
      }
    });
  });

  // Edit chunk quantity (how many of a multi-model regiment are in this sprint)
  container.querySelectorAll('[data-edit-qty]').forEach(btn => {
    btn.addEventListener('click', () => {
      const entryId = btn.dataset.editQty;
      const sprint = appData.sprints[activeSprintId];
      const entry = sprint?.entries.find(e => e.id === entryId);
      const model = entry && appData.models[entry.modelId];
      if (!model) return;
      const current = entry.chunkSize ?? model.quantity;
      const val = prompt(`How many of "${model.name}" (out of ${model.quantity}) should be in this sprint?`, current);
      if (val === null) return;
      const n = parseInt(val);
      if (!n || n < 1) { toast('Enter a number of at least 1', 'error'); return; }
      setSprintEntryChunk(activeSprintId, entryId, n);
      toast(n < model.quantity ? `Set to ${n} of ${model.quantity}` : 'Set to the whole model', 'success');
      renderSprints();
    });
  });
}

// --- New / edit sprint modal (name + optional date range) ---

function showSprintForm(editId, onSaved) {
  const sprint = editId ? appData.sprints[editId] : null;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label>Sprint name</label>
      <input id="sfName" class="form-input" type="text" placeholder="e.g. Sprint 12, or Someday / Maybe" value="${sprint?.name || ''}">
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Start date (optional)</label>
        ${createDateInput('sfStart', sprint?.startDate || '')}
      </div>
      <div class="form-group">
        <label>End date (optional)</label>
        ${createDateInput('sfEnd', sprint?.endDate || '')}
      </div>
    </div>
    <p class="form-hint">Leave both blank for an undated priority list. Set both for a capacity check against your painting pace.</p>
    <div class="modal-actions">
      <button class="btn btn-primary" id="sfSave">${editId ? 'Update' : 'Create'}</button>
      <button class="btn" id="sfCancel">Cancel</button>
    </div>
  `;

  content.querySelector('#sfSave').addEventListener('click', () => {
    const name = content.querySelector('#sfName').value.trim();
    if (!name) { toast('Please enter a name', 'error'); return; }
    const startDate = getDateValue('sfStart');
    const endDate = getDateValue('sfEnd');
    if ((startDate && !endDate) || (!startDate && endDate)) {
      toast('Set both a start and end date, or leave both blank', 'error');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      toast('End date must be after the start date', 'error');
      return;
    }

    let id = editId;
    if (editId) {
      renameSprint(editId, name);
      setSprintDates(editId, startDate, endDate);
      toast('Sprint updated!', 'success');
    } else {
      id = createSprint(name);
      setSprintDates(id, startDate, endDate);
      toast('Sprint created!', 'success');
    }
    closeModal();
    onSaved?.(id);
  });

  content.querySelector('#sfCancel').addEventListener('click', () => closeModal());
  showModal({ title: editId ? 'Edit Sprint' : 'New Sprint', content });
}

// --- Add to sprint modal (pool picker) ---

function showAddToSprint(sprintId) {
  const sprint = appData.sprints[sprintId];
  if (!sprint) return;

  // A model with a whole-model entry already here is redundant to re-add;
  // one that only has chunk(s) here can still get another chunk added.
  const wholeEntryModelIds = new Set(sprint.entries.filter(e => e.chunkSize == null).map(e => e.modelId));
  const allModels = Object.values(appData.models);
  const folders = Object.values(appData.folders || {}).sort((a, b) => a.name.localeCompare(b.name));
  // Selections/quantities persist here so they survive the picker re-rendering on search/folder filter changes
  const selected = new Set();
  const chosenQty = new Map();

  const content = document.createElement('div');

  const renderPicker = (filter = '', folderId = '') => {
    const available = allModels.filter(m => {
      if (isMothballed(m)) return false;
      if (modelThreshold(m) === 'finished') return false;
      if (wholeEntryModelIds.has(m.id)) return false;
      const matchName = m.name.toLowerCase().includes(filter.toLowerCase());
      const matchFolder = !folderId || m.folderId === folderId;
      return matchName && matchFolder;
    });

    if (!available.length) return '<p style="color:var(--text-muted);font-size:0.85em;padding:0.5em 0">No available models. Finished models, mothballed models and models already in this sprint are excluded.</p>';

    return available.map(m => `
      <label class="pool-pick-item">
        <input type="checkbox" value="${m.id}" ${selected.has(m.id) ? 'checked' : ''}>
        <span class="pool-pick-name">${m.name}</span>
        ${m.quantity > 1
          ? `<input type="number" class="form-input pool-pick-qty-input" data-qty-for="${m.id}" min="1" max="${m.quantity}" value="${chosenQty.get(m.id) ?? m.quantity}" title="How many of this regiment to add">`
          : `<span class="pool-pick-qty">×${m.quantity}</span>`}
        ${m.folderId && appData.folders?.[m.folderId] ? `<span class="pool-pick-folder">📁 ${appData.folders[m.folderId].name}</span>` : ''}
      </label>
    `).join('');
  };

  content.innerHTML = `
    <div class="pool-filter-row">
      <input id="sprintSearch" class="form-input" type="text" placeholder="Search models...">
      <select id="sprintFolderFilter" class="form-input" style="width:auto;flex:0 1 140px">
        <option value="">All folders</option>
        ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
      </select>
    </div>
    <p class="form-hint">Multi-model regiments show a quantity box — lower it to add just part of the unit to this sprint.</p>
    <div class="pool-picker" id="sprintPicker">
      ${renderPicker()}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="sprintPickSave">Add to Sprint</button>
      <button class="btn" id="sprintPickCancel">Cancel</button>
    </div>
  `;

  const picker = content.querySelector('#sprintPicker');

  const updatePicker = () => {
    picker.innerHTML = renderPicker(
      content.querySelector('#sprintSearch').value,
      content.querySelector('#sprintFolderFilter').value
    );
  };

  // Delegated listeners: the picker's inputs get replaced on every filter
  // change, so track checked/qty state in `selected`/`chosenQty` rather than
  // reading the DOM at save time.
  picker.addEventListener('change', e => {
    if (e.target.matches('input[type="checkbox"]')) {
      if (e.target.checked) selected.add(e.target.value);
      else selected.delete(e.target.value);
    }
  });
  picker.addEventListener('input', e => {
    if (!e.target.matches('.pool-pick-qty-input')) return;
    const modelId = e.target.dataset.qtyFor;
    const model = appData.models[modelId];
    const n = Math.max(1, Math.min(model?.quantity || 1, parseInt(e.target.value) || 1));
    chosenQty.set(modelId, n);
  });

  content.querySelector('#sprintSearch').addEventListener('input', updatePicker);
  content.querySelector('#sprintFolderFilter').addEventListener('change', updatePicker);

  content.querySelector('#sprintPickSave').addEventListener('click', () => {
    selected.forEach(modelId => {
      const model = appData.models[modelId];
      const qty = chosenQty.get(modelId);
      const chunkSize = (qty != null && model && qty < model.quantity) ? qty : null;
      addToSprint(sprintId, modelId, '', chunkSize, 0);
    });
    closeModal();
    renderSprints();
  });

  content.querySelector('#sprintPickCancel').addEventListener('click', () => closeModal());
  showModal({ title: `Add to "${sprint.name}"`, content, wide: true });
}
