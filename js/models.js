// models.js — global model pool UI

import {
  appData, createModel, updateModel, deleteModel,
  logProgress, modelPoints, modelThreshold, uid, saveData,
  getAllModelTypes, saveCustomModelType, deleteCustomModelType
} from './data.js';
import { showModal, closeModal, toast, progressBar, thresholdBadge, stageRow, today, createDateInput, getDateValue } from './ui.js';
import { getTerm } from './theme.js';

// --- Render the model pool section ---

export function renderModelPool(containerId = 'modelPool', filterFn = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const models = Object.values(appData.models).filter(filterFn || (() => true));

  if (!models.length) {
    container.innerHTML = `<div class="empty-state">
      <p>No ${getTerm('model')}s in your collection yet.</p>
      <button class="btn btn-primary" id="addFirstModel">+ Add ${getTerm('model')}</button>
    </div>`;
    document.getElementById('addFirstModel')?.addEventListener('click', () => showModelForm());
    return;
  }

  container.innerHTML = `<div class="model-grid">${models.map(modelCard).join('')}</div>`;

  container.querySelectorAll('[data-model-view]').forEach(el => {
    el.addEventListener('click', () => showModelDetail(el.dataset.modelView));
  });
  container.querySelectorAll('[data-model-edit]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); showModelForm(el.dataset.modelEdit); });
  });
  container.querySelectorAll('[data-model-delete]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteModel(el.dataset.modelDelete); });
  });
  container.querySelectorAll('[data-model-log]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); showLogProgress(el.dataset.modelLog); });
  });
}

function modelCard(model) {
  const pts = modelPoints(model);
  const thresh = modelThreshold(model);
  const badge = thresholdBadge(thresh);

  return `
    <div class="model-card" data-model-view="${model.id}">
      <div class="model-card-header">
        <div>
          <div class="model-card-name">${model.name}</div>
          <div class="model-card-qty">Qty: ${model.quantity}</div>
        </div>
        ${badge}
      </div>
      ${progressBar(pts.pct)}
      <div class="model-card-pts">${pts.done} / ${pts.total} pts (${pts.pct}%)</div>
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
    stageRow(s, model.progress[s.id], model.quantity, skipped)
  ).join('');

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-qty">Quantity: <b>${model.quantity}</b></div>
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

export function showModelForm(editId = null) {
  const model = editId ? appData.models[editId] : null;
  const stages = model?.stages || appData.config.stages.map(s => ({ ...s }));
  const skipped = model?.skippedStages || [];
  const allTypes = getAllModelTypes();

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input id="mfName" type="text" class="form-input" placeholder="${getTerm('model')} or regiment name" value="${model?.name || ''}">
    </div>
    <div class="form-group">
      <label>Quantity</label>
      <input id="mfQty" type="number" class="form-input" min="1" value="${model?.quantity || 1}">
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <textarea id="mfNotes" class="form-input" rows="2">${model?.notes || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Model Type</label>
      <div class="model-type-row">
        <select id="mfTypeSelect" class="form-input">
          <option value="">— Custom / Manual —</option>
          ${allTypes.map(t => `<option value="${t.id}" ${model?.modelTypeId === t.id ? 'selected' : ''}>${t.name}${t.builtIn ? '' : ' ⭐'}</option>`).join('')}
        </select>
        <button class="btn btn-sm" id="mfSaveType" title="Save current stages as a custom type">💾 Save Type</button>
      </div>
      <div class="model-type-manage" id="mfTypeManage"></div>
    </div>
    <div class="form-group">
      <label>Hobby Stages <span class="form-hint">(edit points or toggle skipped)</span></label>
      <div class="stages-config" id="mfStages">
        ${stages.map(s => stageConfigRow(s, skipped)).join('')}
      </div>
      <button class="btn btn-sm" id="mfAddStage">+ Stage</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="mfSave">${editId ? 'Update' : 'Add'} ${getTerm('model')}</button>
      <button class="btn" id="mfCancel">Cancel</button>
    </div>
  `;

  // Preset dropdown — populate stages when type selected
  const typeSelect = content.querySelector('#mfTypeSelect');
  typeSelect.addEventListener('change', () => {
    const typeId = typeSelect.value;
    if (!typeId) return;
    const preset = allTypes.find(t => t.id === typeId);
    if (!preset) return;
    const stagesContainer = content.querySelector('#mfStages');
    stagesContainer.innerHTML = preset.stages.map(s => stageConfigRow(s, [])).join('');
    updateTypeManage(content, typeId, allTypes);
  });

  // Initial manage row
  updateTypeManage(content, model?.modelTypeId || '', allTypes);

  // Save as custom type
  content.querySelector('#mfSaveType').addEventListener('click', () => {
    const name = prompt('Name for this custom model type:');
    if (!name?.trim()) return;
    const newStages = collectStages(content);
    if (!newStages.length) { toast('No stages to save', 'error'); return; }
    const newType = { id: uid(), name: name.trim(), builtIn: false, stages: newStages };
    saveCustomModelType(newType);
    toast(`"${name.trim()}" saved as custom type!`, 'success');
    // Refresh dropdown
    const opt = document.createElement('option');
    opt.value = newType.id;
    opt.textContent = newType.name + ' ⭐';
    opt.selected = true;
    typeSelect.appendChild(opt);
    updateTypeManage(content, newType.id, getAllModelTypes());
  });

  // Add stage
  content.querySelector('#mfAddStage').addEventListener('click', () => {
    const s = { id: uid(), name: '', points: 1, skippable: true };
    const row = document.createElement('div');
    row.innerHTML = stageConfigRow(s, []);
    content.querySelector('#mfStages').appendChild(row.firstElementChild);
  });

  // Delete stage rows
  content.querySelector('#mfStages').addEventListener('click', e => {
    if (e.target.classList.contains('stage-cfg-del')) {
      e.target.closest('.stage-config-row').remove();
    }
  });

  // Save model
  content.querySelector('#mfSave').addEventListener('click', () => {
    const name = content.querySelector('#mfName').value.trim();
    const quantity = parseInt(content.querySelector('#mfQty').value) || 1;
    const notes = content.querySelector('#mfNotes').value.trim();
    const modelTypeId = typeSelect.value || null;

    if (!name) { toast('Please enter a name', 'error'); return; }

    const { stages: newStages, skipped: newSkipped } = collectStagesAndSkipped(content);

    if (editId) {
      updateModel(editId, { name, quantity, notes, modelTypeId, stages: newStages, skippedStages: newSkipped });
      toast('Updated!', 'success');
    } else {
      createModel({ name, quantity, notes, modelTypeId, stages: newStages, skippedStages: newSkipped });
      toast(`${getTerm('model')} added!`, 'success');
    }

    closeModal();
    renderModelPool();
  });

  content.querySelector('#mfCancel').addEventListener('click', () => closeModal());

  showModal({ title: editId ? `Edit ${getTerm('model')}` : `New ${getTerm('model')}`, content, wide: true });
}

function stageConfigRow(s, skipped) {
  return `
    <div class="stage-config-row" data-sid="${s.id}">
      <input type="text" class="form-input stage-cfg-name" value="${s.name}" placeholder="Stage name">
      <input type="number" class="form-input stage-cfg-pts" value="${s.points || 1}" min="0" max="20" title="Points">
      <label class="stage-cfg-skip" title="Skippable">
        <input type="checkbox" class="stage-cfg-skippable" ${s.skippable ? 'checked' : ''}> Opt
      </label>
      <label class="stage-cfg-skip" title="Skip for this regiment">
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
    const skippable = row.querySelector('.stage-cfg-skippable').checked;
    if (name) stages.push({ id: row.dataset.sid, name, points: pts, skippable });
  });
  return stages;
}

function collectStagesAndSkipped(content) {
  const stages = [];
  const skipped = [];
  content.querySelectorAll('.stage-config-row').forEach(row => {
    const name = row.querySelector('.stage-cfg-name').value.trim();
    const pts = parseInt(row.querySelector('.stage-cfg-pts').value) || 1;
    const skippable = row.querySelector('.stage-cfg-skippable').checked;
    const skip = row.querySelector('.stage-cfg-skipped').checked;
    if (name) {
      stages.push({ id: row.dataset.sid, name, points: pts, skippable });
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

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="log-model-name">${model.name} <span class="log-qty">(${model.quantity} models)</span></div>
    <div class="form-group">
      <label>Date</label>
      ${createDateInput('lpDate', today())}
    </div>
    <div class="form-group">
      <label>Stages completed</label>
      <div class="log-stages" id="lpStages">
        ${stages.map(s => {
          const prog = model.progress[s.id] || { done: 0 };
          return `
            <div class="log-stage-row">
              <div class="log-stage-name">${s.name} <span class="log-stage-pts">(${s.points}pts each)</span></div>
              <div class="log-stage-input">
                <button class="btn btn-sm qty-dec" data-sid="${s.id}">−</button>
                <input type="number" class="form-input qty-input" id="lp_${s.id}" 
                  data-sid="${s.id}" min="0" max="${model.quantity}" value="${prog.done}">
                <button class="btn btn-sm qty-inc" data-sid="${s.id}" data-max="${model.quantity}">+</button>
                <span class="qty-max">/ ${model.quantity}</span>
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
    const max = parseInt(e.target.dataset.max || model.quantity);
    if (e.target.classList.contains('qty-inc')) {
      input.value = Math.min(max, parseInt(input.value || 0) + 1);
    }
    if (e.target.classList.contains('qty-dec')) {
      input.value = Math.max(0, parseInt(input.value || 0) - 1);
    }
  });

  content.querySelector('#lpSave').addEventListener('click', () => {
    const date = getDateValue('lpDate');
    stages.forEach(s => {
      const input = content.querySelector(`#lp_${s.id}`);
      if (input) {
        const done = Math.min(parseInt(input.value) || 0, model.quantity);
        logProgress(modelId, s.id, done, date);
      }
    });
    toast('Progress saved!', 'success');
    closeModal();
    renderModelPool();
  });

  content.querySelector('#lpCancel').addEventListener('click', () => closeModal());

  showModal({ title: `Log Progress — ${model.name}`, content });
}
