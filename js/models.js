// models.js — global model pool UI

import {
  appData, createModel, updateModel, deleteModel,
  logProgress, logSession, modelPoints, modelThreshold, stageCap, uid, saveData,
  getAllModelTypes, saveCustomModelType, deleteCustomModelType,
  saveModelTypeOverride, resetModelTypeOverride, BUILTIN_MODEL_TYPES, TYPE_GROUPS,
  createFolder, updateFolder, deleteFolder, getAllFolders
} from './data.js';
import { showModal, closeModal, toast, progressBar, thresholdBadge, stageRow, today, createDateInput, getDateValue, createTimeInput } from './ui.js';
import { getTerm } from './theme.js';
import { compressImageToBase64, IMAGE_SIZE_PRESETS } from './imageUtils.js';

// Select mode state for mass move
let _selectMode = false;
let _selectedIds = new Set();

// Lazy import to avoid circular dependency
async function pruneSprints() {
  try {
    const { pruneFinishedFromSprints } = await import('./sprint.js');
    pruneFinishedFromSprints();
  } catch(e) { /* sprint module not loaded yet */ }
}

// --- Render the model pool section with folders ---

export function renderModelPool(containerId = 'modelPool') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const allModels = Object.values(appData.models);
  const folders = getAllFolders();

  if (!allModels.length && !folders.length) {
    container.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-title">👋 Welcome to Hobby Manager!</div>
        <p class="onboarding-desc">Track your miniature painting progress from sprue to finished model.</p>
        <div class="onboarding-steps">
          <div class="onboarding-step">
            <span class="step-num">1</span>
            <div>
              <b>Add your models</b>
              <p>Tap <b>+</b> above to add models to your collection. Choose a type — Infantry, Cavalry, Behemoth — and set how many you have.</p>
            </div>
          </div>
          <div class="onboarding-step">
            <span class="step-num">2</span>
            <div>
              <b>Build an army list</b>
              <p>Head to the <b>🛡️ Armies</b> tab to create a game system and army list, then pull your models in from this pool.</p>
            </div>
          </div>
          <div class="onboarding-step">
            <span class="step-num">3</span>
            <div>
              <b>Log your sessions</b>
              <p>Hit <b>📝 Log</b> on any model card to record which painting stages you've completed. Progress shows on the Dashboard.</p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary onboarding-cta" id="onboardingAddBtn">+ Add your first model</button>
      </div>`;
    container.querySelector('#onboardingAddBtn').addEventListener('click', () => showModelForm());
    return;
  }

  // Group models by folder
  const byFolder = {};
  const unfiled = [];
  allModels.forEach(m => {
    if (m.folderId && appData.folders[m.folderId]) {
      if (!byFolder[m.folderId]) byFolder[m.folderId] = [];
      byFolder[m.folderId].push(m);
    } else {
      unfiled.push(m);
    }
  });

  const hasLists = Object.keys(appData.lists || {}).length > 0;
  let html = '';

  // Render each folder
  folders.forEach(folder => {
    const models = byFolder[folder.id] || [];
    const collapsed = folder.collapsed;
    html += `
      <div class="folder-section" data-folder-id="${folder.id}">
        <div class="folder-header">
          <button class="folder-toggle" data-toggle-folder="${folder.id}">
            <span class="folder-chevron">${collapsed ? '▶' : '▼'}</span>
            <span class="folder-icon">📁</span>
            <span class="folder-name">${folder.name}</span>
            <span class="folder-count">${models.length}</span>
          </button>
          <div class="folder-actions">
            <button class="btn btn-xs btn-primary" data-add-in-folder="${folder.id}">+</button>
            <button class="btn btn-xs" data-rename-folder="${folder.id}">✏️</button>
            <button class="btn btn-xs btn-danger" data-delete-folder="${folder.id}">🗑️</button>
          </div>
        </div>
        ${collapsed ? '' : `
          <div class="folder-models">
            ${models.length ? `<div class="model-grid">${models.map(modelCard).join('')}</div>` : `<p class="folder-empty">No models in this folder.</p>`}
          </div>
        `}
      </div>
    `;
  });

  // Unfiled models
  if (unfiled.length > 0) {
    html += `
      <div class="folder-section folder-unfiled">
        <div class="folder-header">
          <div class="folder-toggle">
            <span class="folder-icon">📂</span>
            <span class="folder-name">Unfiled</span>
            <span class="folder-count">${unfiled.length}</span>
          </div>
        </div>
        <div class="folder-models">
          <div class="model-grid">${unfiled.map(modelCard).join('')}</div>
        </div>
      </div>
    `;
  }

  if (!html) {
    html = `<div class="empty-state"><p>No models yet. Use the + button to add one.</p></div>`;
  }

  if (!hasLists) {
    html = `<div class="army-nudge">
      <span class="army-nudge-icon">🛡️</span>
      <div class="army-nudge-body">
        <b>Organise into army lists</b>
        <span>Head to the Armies tab to group these models into a project and track progress toward a deadline.</span>
      </div>
      <button class="btn btn-sm btn-primary" id="nudgeArmiesBtn">Armies →</button>
    </div>` + html;
  }

  // Select-mode controls (only when there are models)
  if (allModels.length) {
    const selCount = _selectedIds.size;
    const controlsHtml = `
      <div class="pool-select-controls">
        <button class="btn btn-sm${_selectMode ? ' btn-primary' : ''}" id="poolSelectToggle">
          ${_selectMode ? `☑ Selecting${selCount ? ` (${selCount})` : ''}` : '☐ Select'}
        </button>
        ${_selectMode ? `
          <button class="btn btn-xs" id="poolSelectAll">All</button>
          <button class="btn btn-xs" id="poolSelectNone">None</button>
        ` : ''}
      </div>
      ${_selectMode && selCount > 0 ? `
        <div class="mass-move-bar">
          <span class="mass-move-label">Move ${selCount} to:</span>
          <select class="form-input mass-move-select" id="massMoveFolder">
            <option value="">— Unfiled —</option>
            ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-primary" id="massMoveApply">Move</button>
        </div>
      ` : ''}
    `;
    html = controlsHtml + html;
  }

  container.innerHTML = html;

  container.querySelector('#nudgeArmiesBtn')?.addEventListener('click', () => {
    document.querySelector('.nav-tab[data-tab="collections"]')?.click();
  });

  // Select mode controls
  container.querySelector('#poolSelectToggle')?.addEventListener('click', () => {
    _selectMode = !_selectMode;
    if (!_selectMode) _selectedIds.clear();
    renderModelPool(containerId);
  });

  container.querySelector('#poolSelectAll')?.addEventListener('click', () => {
    allModels.forEach(m => _selectedIds.add(m.id));
    renderModelPool(containerId);
  });

  container.querySelector('#poolSelectNone')?.addEventListener('click', () => {
    _selectedIds.clear();
    renderModelPool(containerId);
  });

  container.querySelector('#massMoveApply')?.addEventListener('click', () => {
    const folderId = container.querySelector('#massMoveFolder').value || null;
    const count = _selectedIds.size;
    _selectedIds.forEach(id => updateModel(id, { folderId }));
    _selectMode = false;
    _selectedIds.clear();
    const dest = folderId ? (appData.folders[folderId]?.name || 'folder') : 'Unfiled';
    toast(`Moved ${count} model${count !== 1 ? 's' : ''} to ${dest}`, 'success');
    renderModelPool(containerId);
  });

  container.querySelectorAll('[data-model-select]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.modelSelect;
      if (_selectedIds.has(id)) _selectedIds.delete(id);
      else _selectedIds.add(id);
      renderModelPool(containerId);
    });
  });

  // Folder toggle collapse
  container.querySelectorAll('[data-toggle-folder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.toggleFolder;
      updateFolder(fid, { collapsed: !appData.folders[fid].collapsed });
      renderModelPool(containerId);
    });
  });

  // Add model inside folder
  container.querySelectorAll('[data-add-in-folder]').forEach(btn => {
    btn.addEventListener('click', () => showModelForm(null, btn.dataset.addInFolder));
  });

  // Rename folder
  container.querySelectorAll('[data-rename-folder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.renameFolder;
      const folder = appData.folders[fid];
      const name = prompt('Rename folder:', folder.name);
      if (name?.trim()) {
        updateFolder(fid, { name: name.trim() });
        toast('Folder renamed', 'success');
        renderModelPool(containerId);
      }
    });
  });

  // Delete folder
  container.querySelectorAll('[data-delete-folder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.deleteFolder;
      const folder = appData.folders[fid];
      const modelCount = Object.values(appData.models).filter(m => m.folderId === fid).length;
      const msg = modelCount > 0
        ? `Delete folder "${folder.name}"? ${modelCount} model(s) will move to Unfiled.`
        : `Delete folder "${folder.name}"?`;
      if (!confirm(msg)) return;
      deleteFolder(fid);
      toast('Folder deleted', 'info');
      renderModelPool(containerId);
    });
  });

  // Model card interactions
  container.querySelectorAll('[data-model-view]').forEach(el => {
    el.addEventListener('click', () => showModelDetail(el.dataset.modelView));
  });
  container.querySelectorAll('[data-model-edit]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); showModelForm(el.dataset.modelEdit); });
  });
  container.querySelectorAll('[data-model-delete]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); confirmDeleteModel(el.dataset.modelDelete); });
  });
  container.querySelectorAll('[data-model-log]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); showLogProgress(el.dataset.modelLog); });
  });
}

function qtyLabel(model) {
  const hasCrew = (model.stages || appData.config.stages).some(s => s.group === 'crew');
  return hasCrew ? `Qty: ${model.quantity} · Crew: ${model.crewQuantity || 0}` : `Qty: ${model.quantity}`;
}

function modelCard(model) {
  const pts = modelPoints(model);

  if (_selectMode) {
    const checked = _selectedIds.has(model.id);
    return `
      <div class="model-card model-card-selectable${checked ? ' model-card-selected' : ''}" data-model-select="${model.id}">
        <div class="model-select-check">${checked ? '☑' : '☐'}</div>
        <div class="model-card-header">
          <div>
            <div class="model-card-name">${model.name}</div>
            <div class="model-card-qty">${qtyLabel(model)}</div>
          </div>
        </div>
        ${progressBar(pts.pct)}
        <div class="model-card-pts">${pts.pct}% · ${pts.done}/${pts.total} pts</div>
      </div>
    `;
  }

  const thresh = modelThreshold(model);
  const badge = thresholdBadge(thresh);

  return `
    <div class="model-card" data-model-view="${model.id}">
      ${model.image ? `<img class="model-card-thumb" src="${model.image}" alt="">` : ''}
      <div class="model-card-header">
        <div>
          <div class="model-card-name">${model.name}</div>
          <div class="model-card-qty">${qtyLabel(model)}</div>
        </div>
        ${badge}
      </div>
      ${progressBar(pts.pct)}
      <div class="model-card-pts">${pts.pct}% complete <span class="pts-detail">${pts.done}/${pts.total} pts</span></div>
      <div class="model-card-actions">
        <button class="btn btn-sm btn-primary" data-model-log="${model.id}">📝 Log</button>
        <button class="btn btn-sm" data-model-edit="${model.id}">✏️</button>
        <button class="btn btn-sm btn-danger" data-model-delete="${model.id}">🗑️</button>
      </div>
    </div>
  `;
}

// --- Model detail modal ---

export function showModelDetail(modelId) {
  const model = appData.models[modelId];
  if (!model) return;

  const pts = modelPoints(model);
  const thresh = modelThreshold(model);
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];

  const stagesHtml = stages.map(s =>
    stageRow(s, model.progress[s.id], stageCap(s, model), skipped)
  ).join('');

  const content = document.createElement('div');
  content.innerHTML = `
    ${model.image ? `<img class="detail-image" src="${model.image}" alt="${model.name}">` : ''}
    <div class="detail-header">
      <div>
        <div class="detail-qty">${qtyLabel(model)}</div>
        ${model.notes ? `<div class="detail-notes">${model.notes}</div>` : ''}
      </div>
      ${thresholdBadge(thresh)}
    </div>
    ${progressBar(pts.pct)}
    <div class="detail-pts">${pts.done} / ${pts.total} pts (${pts.pct}%)</div>
    <div class="stages-list">${stagesHtml}</div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="detailLogBtn">📝 Log Progress</button>
      <button class="btn" id="detailEditBtn">✏️ Edit</button>
    </div>
  `;

  content.querySelector('#detailLogBtn').addEventListener('click', () => {
    closeModal();
    showLogProgress(modelId);
  });
  content.querySelector('#detailEditBtn').addEventListener('click', () => {
    closeModal();
    showModelForm(modelId);
  });

  showModal({ title: model.name, content, wide: true });
}

// --- Model form (create / edit) ---

function renderTypeOptions(allTypes, selectedId) {
  const builtIn = allTypes.filter(t => t.builtIn);
  const custom = allTypes.filter(t => !t.builtIn);
  const grouped = Object.values(TYPE_GROUPS).flat();
  let html = '';
  for (const [group, ids] of Object.entries(TYPE_GROUPS)) {
    const types = builtIn.filter(t => ids.includes(t.id));
    if (!types.length) continue;
    html += `<optgroup label="${group}">${types.map(t =>
      `<option value="${t.id}" ${selectedId === t.id ? 'selected' : ''}>${t.name}</option>`
    ).join('')}</optgroup>`;
  }
  const ungrouped = builtIn.filter(t => !grouped.includes(t.id));
  if (ungrouped.length) html += ungrouped.map(t =>
    `<option value="${t.id}" ${selectedId === t.id ? 'selected' : ''}>${t.name}</option>`
  ).join('');
  if (custom.length) {
    html += `<optgroup label="Custom ⭐">${custom.map(t =>
      `<option value="${t.id}" ${selectedId === t.id ? 'selected' : ''}>${t.name}</option>`
    ).join('')}</optgroup>`;
  }
  return html;
}

export function showModelForm(editId = null, defaultFolderId = null) {
  editId = editId || null;
  const model = editId ? appData.models[editId] : null;
  const allTypes = getAllModelTypes();
  const defaultTypeId = !editId ? 'infantry' : null;
  const effectiveTypeId = model?.modelTypeId || defaultTypeId;
  const selectedType = effectiveTypeId ? allTypes.find(t => t.id === effectiveTypeId) : null;
  const stages = model?.stages || (selectedType ? selectedType.stages.map(s => ({ ...s })) : appData.config.stages.map(s => ({ ...s })));
  const skipped = model?.skippedStages || [];
  const folders = getAllFolders();
  const currentFolderId = model?.folderId || defaultFolderId || '';
  let currentImage = model?.image || null;
  const hasType = !!selectedType;
  const stagesLabelHtml = hasType
    ? `Using <b>${selectedType.name}</b> stages`
    : `Hobby Stages <span class="form-hint">(edit points or toggle skipped)</span>`;
  const hasCrew = stages.some(s => s.group === 'crew');
  const initialCrewQty = model?.crewQuantity ?? selectedType?.defaultCrewQuantity ?? 3;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input id="mfName" type="text" class="form-input" placeholder="${getTerm('model')} or regiment name" value="${model?.name || ''}">
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Quantity</label>
        <input id="mfQty" type="number" class="form-input" min="1" value="${hasCrew ? 1 : (model?.quantity || 1)}" ${hasCrew ? 'disabled' : ''}>
        <span class="form-hint" id="mfQtyHint" style="${hasCrew ? '' : 'display:none'}">Multi-part entries (crew) are always 1 per entry</span>
      </div>
      <div class="form-group">
        <label>Folder</label>
        <select id="mfFolder" class="form-input">
          <option value="">— Unfiled —</option>
          ${folders.map(f => `<option value="${f.id}" ${currentFolderId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
          <option value="__new__">+ New folder...</option>
        </select>
      </div>
    </div>
    <div class="form-group" id="mfCrewQtyGroup" style="${hasCrew ? '' : 'display:none'}">
      <label>Crew Quantity</label>
      <input id="mfCrewQty" type="number" class="form-input" min="0" value="${initialCrewQty}">
      <span class="form-hint">How many crew this particular model has</span>
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Worth (£, optional)</label>
        <input id="mfWorth" type="number" class="form-input" min="0" step="0.01" value="${model?.worth ?? ''}">
        <span class="form-hint">What it cost you to buy — set once, doesn't rise with painting</span>
      </div>
      <div class="form-group">
        <label>Sentiment (1-5, optional)</label>
        <input id="mfSentiment" type="number" class="form-input" min="1" max="5" value="${model?.sentimentLove ?? ''}">
        <span class="form-hint">How much you'd miss it — not a £ value</span>
      </div>
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <textarea id="mfNotes" class="form-input" rows="2">${model?.notes || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Photo (optional)</label>
      <div class="img-upload-area" id="mfImageArea">
        ${currentImage
          ? `<img class="img-upload-preview" id="mfImagePreview" src="${currentImage}" alt="">`
          : `<div class="img-upload-placeholder" id="mfImagePlaceholder">📷 No photo yet</div>`
        }
      </div>
      <div class="img-upload-actions">
        <button class="btn btn-sm" id="mfImageBtn" type="button">📷 Choose Photo</button>
        <button class="btn btn-sm btn-danger" id="mfImageRemove" type="button" style="${currentImage ? '' : 'display:none'}">✕ Remove</button>
      </div>
      <input type="file" id="mfImageInput" accept="image/*" style="display:none">
      <div class="img-upload-info" id="mfImageInfo"></div>
    </div>
    <div class="form-group">
      <label>Model Type</label>
      <select id="mfTypeSelect" class="form-input">
        <option value="">— Custom / Manual —</option>
        ${renderTypeOptions(allTypes, effectiveTypeId)}
      </select>
      <div class="model-type-manage" id="mfTypeManage"></div>
    </div>
    <div class="form-group">
      <div class="stages-section-header">
        <label id="mfStagesLabel" style="margin:0">${stagesLabelHtml}</label>
        <button class="btn btn-xs" id="mfStagesToggle" type="button" style="${hasType ? '' : 'display:none'}">▶ Customize</button>
      </div>
      <div id="mfStagesBody" style="${hasType ? 'display:none' : ''}">
        <div class="stages-config" id="mfStages">
          ${stages.map(s => stageConfigRow(s, skipped)).join('')}
        </div>
        <div class="stages-actions-row">
          <button class="btn btn-sm" id="mfAddStage" type="button">+ Stage</button>
          <button class="btn btn-sm" id="mfSaveType" type="button" title="Save current stages as a custom type">💾 Save Type</button>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="mfSave">${editId ? 'Update' : 'Add'} ${getTerm('model')}</button>
      <button class="btn" id="mfCancel">Cancel</button>
    </div>
  `;

  // New folder inline creation
  content.querySelector('#mfFolder').addEventListener('change', async e => {
    if (e.target.value === '__new__') {
      const name = prompt('New folder name:');
      if (name?.trim()) {
        const fid = createFolder(name.trim());
        const opt = document.createElement('option');
        opt.value = fid;
        opt.textContent = name.trim();
        opt.selected = true;
        // Insert before the __new__ option
        const newOpt = e.target.querySelector('[value="__new__"]');
        e.target.insertBefore(opt, newOpt);
        e.target.value = fid;
      } else {
        e.target.value = currentFolderId || '';
      }
    }
  });

  // Image upload
  content.querySelector('#mfImageBtn').addEventListener('click', () => {
    content.querySelector('#mfImageInput').click();
  });

  content.querySelector('#mfImageInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const infoEl = content.querySelector('#mfImageInfo');
    infoEl.textContent = 'Compressing…';
    try {
      const preset = IMAGE_SIZE_PRESETS[appData.config.imageSize || 'small'];
      const dataUrl = await compressImageToBase64(file, preset.maxDim, preset.quality);
      currentImage = dataUrl;
      const area = content.querySelector('#mfImageArea');
      area.innerHTML = `<img class="img-upload-preview" id="mfImagePreview" src="${dataUrl}" alt="">`;
      content.querySelector('#mfImageRemove').style.display = '';
      const kb = Math.round(dataUrl.length * 0.75 / 1024);
      infoEl.textContent = `Thumbnail: ~${kb} KB stored`;
    } catch {
      infoEl.textContent = 'Failed to process image.';
    }
    e.target.value = '';
  });

  content.querySelector('#mfImageRemove').addEventListener('click', () => {
    currentImage = null;
    content.querySelector('#mfImageArea').innerHTML = `<div class="img-upload-placeholder" id="mfImagePlaceholder">📷 No photo yet</div>`;
    content.querySelector('#mfImageRemove').style.display = 'none';
    content.querySelector('#mfImageInfo').textContent = '';
  });

  // Preset dropdown
  const typeSelect = content.querySelector('#mfTypeSelect');
  const stagesBody = content.querySelector('#mfStagesBody');
  const stagesLabel = content.querySelector('#mfStagesLabel');
  const stagesToggle = content.querySelector('#mfStagesToggle');

  stagesToggle.addEventListener('click', () => {
    const isHidden = stagesBody.style.display === 'none';
    stagesBody.style.display = isHidden ? '' : 'none';
    stagesToggle.textContent = isHidden ? '▲ Collapse' : '▶ Customize';
  });

  function refreshCrewQtyUI(resetTo) {
    const hasCrewNow = collectStages(content).some(s => s.group === 'crew');
    const qtyInput = content.querySelector('#mfQty');
    const qtyHint = content.querySelector('#mfQtyHint');
    const crewGroup = content.querySelector('#mfCrewQtyGroup');
    const crewInput = content.querySelector('#mfCrewQty');
    if (hasCrewNow) {
      qtyInput.value = 1;
      qtyInput.disabled = true;
      qtyHint.style.display = '';
      crewGroup.style.display = '';
      if (resetTo != null) crewInput.value = resetTo;
    } else {
      qtyInput.disabled = false;
      qtyHint.style.display = 'none';
      crewGroup.style.display = 'none';
    }
  }

  content.querySelector('#mfStages').addEventListener('change', e => {
    if (e.target.classList.contains('stage-cfg-crew-cb')) refreshCrewQtyUI();
  });

  typeSelect.addEventListener('change', () => {
    const typeId = typeSelect.value;
    if (typeId) {
      const preset = allTypes.find(t => t.id === typeId);
      if (!preset) return;
      content.querySelector('#mfStages').innerHTML = preset.stages.map(s => stageConfigRow(s, preset.defaultSkipped || [])).join('');
      stagesLabel.innerHTML = `Using <b>${preset.name}</b> stages`;
      stagesBody.style.display = 'none';
      stagesToggle.textContent = '▶ Customize';
      stagesToggle.style.display = '';
      refreshCrewQtyUI(preset.defaultCrewQuantity ?? 3);
    } else {
      stagesLabel.innerHTML = `Hobby Stages <span class="form-hint">(edit points or toggle skipped)</span>`;
      stagesBody.style.display = '';
      stagesToggle.style.display = 'none';
      refreshCrewQtyUI();
    }
    updateTypeManage(content, typeId, allTypes);
  });

  updateTypeManage(content, effectiveTypeId || '', allTypes);

  content.querySelector('#mfSaveType').addEventListener('click', () => {
    const name = prompt('Name for this custom model type:');
    if (!name?.trim()) return;
    const newStages = collectStages(content);
    if (!newStages.length) { toast('No stages to save', 'error'); return; }
    const newType = { id: uid(), name: name.trim(), builtIn: false, stages: newStages };
    saveCustomModelType(newType);
    toast(`"${name.trim()}" saved as custom type!`, 'success');
    const opt = document.createElement('option');
    opt.value = newType.id;
    opt.textContent = newType.name + ' ⭐';
    opt.selected = true;
    typeSelect.appendChild(opt);
    updateTypeManage(content, newType.id, getAllModelTypes());
  });

  content.querySelector('#mfAddStage').addEventListener('click', () => {
    const s = { id: uid(), name: '', points: 1, phase: 'painting', skippable: true };
    const row = document.createElement('div');
    row.innerHTML = stageConfigRow(s, []);
    content.querySelector('#mfStages').appendChild(row.firstElementChild);
  });

  content.querySelector('#mfStages').addEventListener('click', e => {
    if (e.target.classList.contains('stage-cfg-del')) {
      e.target.closest('.stage-config-row').remove();
      refreshCrewQtyUI();
    }
  });

  content.querySelector('#mfSave').addEventListener('click', () => {
    const name = content.querySelector('#mfName').value.trim();
    const notes = content.querySelector('#mfNotes').value.trim();
    const modelTypeId = typeSelect.value || null;
    let folderId = content.querySelector('#mfFolder').value || null;
    if (folderId === '__new__') folderId = null;
    const worth = parseFloat(content.querySelector('#mfWorth').value);
    const sentimentLove = parseInt(content.querySelector('#mfSentiment').value);

    if (!name) { toast('Please enter a name', 'error'); return; }

    const { stages: newStages, skipped: newSkipped } = collectStagesAndSkipped(content);
    const hasCrewNow = newStages.some(s => s.group === 'crew');
    const quantity = hasCrewNow ? 1 : (parseInt(content.querySelector('#mfQty').value) || 1);
    const crewQuantity = hasCrewNow ? (parseInt(content.querySelector('#mfCrewQty').value) || 0) : null;

    if (editId) {
      updateModel(editId, { name, quantity, notes, modelTypeId, folderId, stages: newStages, skippedStages: newSkipped, image: currentImage, crewQuantity, worth: isNaN(worth) ? null : worth, sentimentLove: isNaN(sentimentLove) ? null : sentimentLove });
      toast('Updated!', 'success');
    } else {
      createModel({ name, quantity, notes, modelTypeId, folderId, stages: newStages, skippedStages: newSkipped, image: currentImage, crewQuantity, worth: isNaN(worth) ? null : worth, sentimentLove: isNaN(sentimentLove) ? null : sentimentLove });
      toast(`${getTerm('model')} added!`, 'success');
    }

    closeModal();
    renderModelPool();
  });

  content.querySelector('#mfCancel').addEventListener('click', () => closeModal());
  showModal({ title: editId ? `Edit ${getTerm('model')}` : `New ${getTerm('model')}`, content, wide: true });
}
function stageConfigRow(s, skipped) {
  const milestoneOptions = [
    { value: '', label: 'None' },
    { value: 'table_ready', label: '⚔️ Table Ready' },
    { value: 'painted',     label: '🎨 Painted' },
    { value: 'finished',    label: '🏆 Finished' },
  ];
  return `
    <div class="stage-config-row" data-sid="${s.id}" data-phase="${s.phase || 'painting'}" data-skippable="${s.skippable ?? true}">
      <input type="text" class="form-input stage-cfg-name" value="${s.name}" placeholder="Stage name">
      <input type="number" class="form-input stage-cfg-pts" value="${s.points || 1}" min="0" max="20" title="Hobby points for this stage (used for weekly goal tracking)">
      <select class="form-input stage-cfg-milestone" title="Milestone this stage completes">
        ${milestoneOptions.map(o => `<option value="${o.value}" ${(s.threshold || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      <label class="stage-cfg-crew" title="Track this stage against crew count instead of quantity">
        <input type="checkbox" class="stage-cfg-crew-cb" ${s.group === 'crew' ? 'checked' : ''}> Crew
      </label>
      <label class="stage-cfg-skip" title="Skip this stage for this regiment">
        <input type="checkbox" class="stage-cfg-skipped" ${skipped.includes(s.id) ? 'checked' : ''}> Skip
      </label>
      <button class="btn btn-xs btn-danger stage-cfg-del">✕</button>
    </div>
  `;
}

function collectStages(content) {
  const stages = [];
  content.querySelectorAll('.stage-config-row').forEach(row => {
    const name = row.querySelector('.stage-cfg-name').value.trim();
    const pts = parseInt(row.querySelector('.stage-cfg-pts').value) || 1;
    const threshold = row.querySelector('.stage-cfg-milestone').value || null;
    const isCrew = row.querySelector('.stage-cfg-crew-cb')?.checked;
    if (name) stages.push({
      id: row.dataset.sid, name, points: pts, threshold,
      phase: row.dataset.phase || 'painting',
      skippable: row.dataset.skippable !== 'false',
      ...(isCrew ? { group: 'crew' } : {})
    });
  });
  return stages;
}

function collectStagesAndSkipped(content) {
  const stages = [];
  const skipped = [];
  content.querySelectorAll('.stage-config-row').forEach(row => {
    const name = row.querySelector('.stage-cfg-name').value.trim();
    const pts = parseInt(row.querySelector('.stage-cfg-pts').value) || 1;
    const threshold = row.querySelector('.stage-cfg-milestone').value || null;
    const skip = row.querySelector('.stage-cfg-skipped').checked;
    const isCrew = row.querySelector('.stage-cfg-crew-cb')?.checked;
    if (name) {
      stages.push({
        id: row.dataset.sid, name, points: pts, threshold,
        phase: row.dataset.phase || 'painting',
        skippable: row.dataset.skippable !== 'false',
        ...(isCrew ? { group: 'crew' } : {})
      });
      if (skip) skipped.push(row.dataset.sid);
    }
  });
  return { stages, skipped };
}

function updateTypeManage(content, typeId, allTypes) {
  const manageEl = content.querySelector('#mfTypeManage');
  if (!manageEl) return;
  const type = allTypes.find(t => t.id === typeId);
  if (!type || type.builtIn) { manageEl.innerHTML = ''; return; }
  manageEl.innerHTML = `
    <div class="type-manage-row">
      <span class="type-manage-name">⭐ Custom: ${type.name}</span>
      <button class="btn btn-xs btn-danger" id="mfDeleteType">Delete type</button>
    </div>
  `;
  manageEl.querySelector('#mfDeleteType').addEventListener('click', () => {
    if (!confirm(`Delete custom type "${type.name}"?`)) return;
    deleteCustomModelType(type.id);
    content.querySelector('#mfTypeSelect').value = '';
    manageEl.innerHTML = '';
    toast('Custom type deleted', 'info');
  });
}

// --- Delete model ---

function confirmDeleteModel(modelId) {
  const model = appData.models[modelId];
  if (!model) return;
  if (!window.confirm(`Delete "${model.name}"? This will also remove it from all army lists.`)) return;
  deleteModel(modelId);
  toast('Deleted', 'info');
  renderModelPool();
}

// --- Log progress modal ---

export function showLogProgress(modelId) {
  const model = appData.models[modelId];
  if (!model) return;

  const stages = (model.stages || appData.config.stages).filter(s => !(model.skippedStages || []).includes(s.id));
  const hasCrew = (model.stages || appData.config.stages).some(s => s.group === 'crew');

  const content = document.createElement('div');

  const qtyLabelText = hasCrew
    ? `(1 model, ${model.crewQuantity || 0} crew)`
    : `(${model.quantity} model${model.quantity > 1 ? 's' : ''})`;

  content.innerHTML = `
    <div class="log-model-name">${model.name} <span class="log-qty">${qtyLabelText}</span></div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Date</label>
        ${createDateInput('lpDate', today())}
      </div>
      <div class="form-group">
        <label>Session time</label>
        <div class="time-range-row">
          ${createTimeInput('lpStartTime')}
          <span class="time-range-arrow">→</span>
          ${createTimeInput('lpEndTime')}
        </div>
        <div class="form-hint log-time-hint" id="lpDurationHint">If left blank, logged as historical activity.</div>
      </div>
    </div>
    <div class="form-group">
      <label>Stages completed</label>
      <div class="log-quick-btns">
        <button class="btn btn-sm btn-primary" id="lpAllDone">✓ All Done</button>
        <button class="btn btn-sm" id="lpReset">✕ Reset All</button>
      </div>
      <div class="log-stages" id="lpStages">
        ${stages.map(s => {
          const cap = stageCap(s, model);
          const prog = model.progress[s.id] || { done: 0 };
          const isDone = cap > 0 && prog.done >= cap;
          const crewTag = s.group === 'crew' ? ' <span class="stage-opt">crew</span>' : '';
          if (cap <= 1) {
            return `
              <label class="log-stage-check ${isDone ? 'is-done' : ''}">
                <input type="checkbox" class="stage-checkbox" id="lp_${s.id}" data-sid="${s.id}" ${isDone ? 'checked' : ''}>
                <span class="log-stage-name">${s.name}${crewTag}</span>
              </label>
            `;
          }
          return `
            <div class="log-stage-row${isDone ? ' stage-done' : ''}">
              <div class="log-stage-name">${s.name}${crewTag}${isDone ? ' <span class="stage-done-badge">✓</span>' : ''}</div>
              <div class="log-stage-input">
                <button class="btn btn-sm qty-dec" data-sid="${s.id}">−</button>
                <input type="number" class="form-input qty-input" id="lp_${s.id}"
                  data-sid="${s.id}" min="0" max="${cap}" value="${prog.done}">
                <button class="btn btn-sm qty-inc" data-sid="${s.id}" data-max="${cap}">+</button>
                <span class="qty-max">/ ${cap}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="lpSave">Save Progress</button>
      <button class="btn" id="lpCancel">Cancel</button>
    </div>
  `;

  // +/- buttons
  content.querySelector('#lpStages').addEventListener('click', e => {
    const sid = e.target.dataset.sid;
    if (!sid) return;
    const input = content.querySelector(`#lp_${sid}`);
    const max = parseInt(e.target.dataset.max || 0);
    if (e.target.classList.contains('qty-inc')) {
      input.value = Math.min(max, parseInt(input.value || 0) + 1);
    }
    if (e.target.classList.contains('qty-dec')) {
      input.value = Math.max(0, parseInt(input.value || 0) - 1);
    }
  });

  // All Done — set every stage to full quantity / tick all checkboxes
  content.querySelector('#lpAllDone').addEventListener('click', () => {
    content.querySelectorAll('.stage-checkbox').forEach(cb => {
      cb.checked = true;
      cb.closest('.log-stage-check').classList.add('is-done');
    });
    content.querySelectorAll('.qty-input').forEach(input => {
      input.value = input.max;
    });
  });

  // Reset All — zero everything out
  content.querySelector('#lpReset').addEventListener('click', () => {
    if (!confirm('Reset all stage progress to zero? This cannot be undone.')) return;
    content.querySelectorAll('.stage-checkbox').forEach(cb => {
      cb.checked = false;
      cb.closest('.log-stage-check').classList.remove('is-done');
    });
    content.querySelectorAll('.qty-input').forEach(input => {
      input.value = 0;
    });
  });

  // Live duration hint update
  const calcDurationFromContent = () => {
    const getT = (id) => {
      const el = content.querySelector(`#${id}`);
      if (!el) return '';
      if (el.tagName === 'INPUT') return el.value;
      const hh = el.querySelector('.time-hh')?.value;
      const mm = el.querySelector('.time-mm')?.value;
      return (hh && mm) ? `${hh}:${mm}` : '';
    };
    const start = getT('lpStartTime');
    const end = getT('lpEndTime');
    if (!start || !end) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins > 0 ? mins : null;
  };

  const updateDurationHint = () => {
    const hint = content.querySelector('#lpDurationHint');
    if (!hint) return;
    const mins = calcDurationFromContent();
    const startEl = content.querySelector('#lpStartTime');
    const endEl = content.querySelector('#lpEndTime');
    const hasStart = startEl?.tagName === 'INPUT' ? startEl.value : startEl?.querySelector('.time-hh')?.value;
    const hasEnd = endEl?.tagName === 'INPUT' ? endEl.value : endEl?.querySelector('.time-hh')?.value;
    if (hasStart && hasEnd) {
      hint.textContent = mins ? `= ${mins} mins` : 'End time must be after start time.';
    } else {
      hint.textContent = 'If left blank, logged as historical activity.';
    }
  };

  content.querySelector('.time-range-row').addEventListener('change', updateDurationHint);

  content.querySelector('#lpSave').addEventListener('click', () => {
    const date = getDateValue('lpDate');
    const duration = calcDurationFromContent();
    if (!duration && !confirm('No time entered — this will be recorded as historical activity with no session time. Log anyway?')) return;

    const modelEntries = [];
    stages.forEach(s => {
      const cap = stageCap(s, model);
      let done;
      if (cap <= 1) {
        const cb = content.querySelector(`#lp_${s.id}`);
        done = cb?.checked ? 1 : 0;
      } else {
        const input = content.querySelector(`#lp_${s.id}`);
        done = Math.min(parseInt(input?.value) || 0, cap);
      }
      const prev = model.progress[s.id]?.done || 0;
      if (done !== prev) modelEntries.push({ modelId, stageId: s.id, qty: done - prev });
      logProgress(modelId, s.id, done, date);
    });

    // Record session for activity log (even if no changes — user may just be reviewing)
    if (modelEntries.length > 0) {
      logSession({ date, duration, notes: '', modelEntries });
    }

    toast('Progress saved!', 'success');
    pruneSprints();
    closeModal();
    renderModelPool();
  });

  content.querySelector('#lpCancel').addEventListener('click', () => closeModal());

  showModal({ title: `Log Progress — ${model.name}`, content });
}

// --- Model type template editor ---

function stageTemplateRow(s) {
  const milestoneOptions = [
    { value: '', label: 'None' },
    { value: 'table_ready', label: '⚔️ Table Ready' },
    { value: 'painted',     label: '🎨 Painted' },
    { value: 'finished',    label: '🏆 Finished' },
  ];
  return `
    <div class="stage-config-row" data-sid="${s.id}" data-phase="${s.phase || 'painting'}" data-skippable="${s.skippable ?? true}">
      <input type="text" class="form-input stage-cfg-name" value="${s.name}" placeholder="Stage name">
      <input type="number" class="form-input stage-cfg-pts" value="${s.points || 1}" min="0" max="20" title="Hobby points for this stage">
      <select class="form-input stage-cfg-milestone" title="Milestone this stage completes">
        ${milestoneOptions.map(o => `<option value="${o.value}" ${(s.threshold || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      <label class="stage-cfg-crew" title="Track this stage against a per-entry crew count instead of quantity">
        <input type="checkbox" class="stage-cfg-crew-cb" ${s.group === 'crew' ? 'checked' : ''}> Crew
      </label>
      <button class="btn btn-xs btn-danger stage-cfg-del" title="Remove stage">✕</button>
    </div>
  `;
}

function collectTemplateStages(container) {
  const stages = [];
  container.querySelectorAll('.stage-config-row').forEach(row => {
    const name = row.querySelector('.stage-cfg-name').value.trim();
    const pts = parseInt(row.querySelector('.stage-cfg-pts').value) || 1;
    const threshold = row.querySelector('.stage-cfg-milestone').value || null;
    const isCrew = row.querySelector('.stage-cfg-crew-cb')?.checked;
    if (name) stages.push({
      id: row.dataset.sid,
      name,
      points: pts,
      threshold,
      phase: row.dataset.phase || 'painting',
      skippable: row.dataset.skippable !== 'false',
      ...(isCrew ? { group: 'crew' } : {})
    });
  });
  return stages;
}

export function showModelTypeEditor(typeId, onSaved) {
  const allTypes = getAllModelTypes();
  const type = allTypes.find(t => t.id === typeId);
  if (!type) return;

  const isOverridden = !!(appData.config.modelTypeOverrides || {})[typeId];
  const defaultType = BUILTIN_MODEL_TYPES.find(t => t.id === typeId);
  const defaultPts = defaultType ? defaultType.stages.reduce((a, s) => a + s.points, 0) : 0;

  const content = document.createElement('div');
  content.innerHTML = `
    <p class="form-hint" style="margin-bottom:1em">
      Changes here set the default stages for all new <b>${type.name}</b> models. Existing models are unaffected.
    </p>
    <div class="stages-section-header" style="margin-bottom:0.5em">
      <span id="metStagesLabel">Stages · <span id="metTotalPts">${type.stages.reduce((a, s) => a + s.points, 0)}</span> total pts</span>
      <button type="button" class="btn btn-sm" id="metAddStage">+ Add Stage</button>
    </div>
    <div id="metStages">
      ${type.stages.map(s => stageTemplateRow(s)).join('')}
    </div>
    <div style="display:flex;gap:0.5em;justify-content:flex-end;margin-top:1em;flex-wrap:wrap">
      ${isOverridden ? `<button class="btn btn-sm btn-danger" id="metReset">↺ Reset to Default (${defaultPts} pts)</button>` : ''}
      <button class="btn btn-sm" id="metCancel">Cancel</button>
      <button class="btn btn-sm btn-primary" id="metSave">Save Template</button>
    </div>
  `;

  const stagesContainer = content.querySelector('#metStages');
  const totalPtsEl = content.querySelector('#metTotalPts');

  function updateTotal() {
    let total = 0;
    stagesContainer.querySelectorAll('.stage-cfg-pts').forEach(input => {
      total += parseInt(input.value) || 0;
    });
    totalPtsEl.textContent = total;
  }

  stagesContainer.addEventListener('input', updateTotal);

  stagesContainer.addEventListener('click', e => {
    if (e.target.classList.contains('stage-cfg-del')) {
      e.target.closest('.stage-config-row').remove();
      updateTotal();
    }
  });

  content.querySelector('#metAddStage').addEventListener('click', () => {
    const s = { id: uid(), name: '', points: 1, phase: 'painting', skippable: true, threshold: null };
    const row = document.createElement('div');
    row.innerHTML = stageTemplateRow(s);
    stagesContainer.appendChild(row.firstElementChild);
    updateTotal();
  });

  content.querySelector('#metCancel').addEventListener('click', () => closeModal());

  content.querySelector('#metSave').addEventListener('click', () => {
    const stages = collectTemplateStages(stagesContainer);
    if (!stages.length) { toast('Add at least one stage', 'error'); return; }
    saveModelTypeOverride(typeId, stages);
    toast(`${type.name} template saved!`, 'success');
    closeModal();
    onSaved?.();
  });

  content.querySelector('#metReset')?.addEventListener('click', () => {
    if (!confirm(`Reset ${type.name} back to factory defaults?`)) return;
    resetModelTypeOverride(typeId);
    toast(`${type.name} reset to defaults`, 'info');
    closeModal();
    onSaved?.();
  });

  showModal({ title: `Edit Template: ${type.name}`, content, wide: true });
}
