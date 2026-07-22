// quartermaster.js — Quartermaster's Office: purchase planning, valuation, and budget tracking

import {
  appData, saveData, uid, unstartedCount, createModel, updateModel, GAME_SYSTEMS
} from './data.js';
import { resolveGameSystemId } from './dashboard.js';
import { toast, today } from './ui.js';

// --- Data helpers ---

export function createPurchaseItem({ name, gameSystemId = null, worth = 0, reason = '', plannedMonth = '', collectionId = null }) {
  const id = uid();
  appData.purchaseQueue[id] = {
    id, name, gameSystemId, worth, reason, plannedMonth, collectionId,
    status: 'queued', promotedModelId: null
  };
  saveData();
  return id;
}

export function updatePurchaseItem(id, fields) {
  if (!appData.purchaseQueue[id]) return;
  Object.assign(appData.purchaseQueue[id], fields);
  saveData();
}

export function deletePurchaseItem(id) {
  delete appData.purchaseQueue[id];
  saveData();
}

// Converts a queued requisition into a real model: stamps its planned worth
// and today's date, then keeps the requisition (marked 'purchased') so it
// still shows up in the spend timeline.
export function promoteToModel(id) {
  const item = appData.purchaseQueue[id];
  if (!item) return null;
  const modelId = createModel({ name: item.name, gameSystemId: item.gameSystemId, quantity: 1, worth: item.worth });
  updateModel(modelId, { purchaseDate: today() });
  updatePurchaseItem(id, { status: 'purchased', promotedModelId: modelId });
  return modelId;
}

// --- Calculations ---

function pileModels(gameSystemId = null) {
  return Object.values(appData.models).filter(m => {
    if (unstartedCount(m) <= 0) return false;
    if (gameSystemId && resolveGameSystemId(m) !== gameSystemId) return false;
    return true;
  });
}

export function pileCount(gameSystemId = null) {
  return pileModels(gameSystemId).reduce((sum, m) => sum + unstartedCount(m), 0);
}

export function pileWorth(gameSystemId = null) {
  return pileModels(gameSystemId).reduce((sum, m) => sum + (m.worth || 0), 0);
}

export function backlogScoreMonths(gameSystemId = null) {
  const budget = appData.config.monthlyBudgetGBP || 0;
  if (!budget) return null;
  return pileWorth(gameSystemId) / budget;
}

// Linear "budget headroom" score: 100% with an empty pile, 0% when the pile
// exactly equals a month of budget, unbounded (and increasingly negative)
// beyond that. Not a reciprocal — deliberately allows negative rectitude.
export function rectitudePct(gameSystemId = null) {
  const budget = appData.config.monthlyBudgetGBP || 0;
  if (!budget) return null;
  return Math.min(100, (budget - pileWorth(gameSystemId)) / budget * 100);
}

export function costToFinish(collectionId) {
  return Object.values(appData.purchaseQueue)
    .filter(item => item.status === 'queued' && item.collectionId === collectionId)
    .reduce((sum, item) => sum + (item.worth || 0), 0);
}

// Single timeline merging actual past spend (promoted items, grouped by the
// model's purchaseDate) with planned future spend (queued items, grouped by
// plannedMonth) — serves both the budget calendar and the monthly report.
export function monthlySpendTimeline() {
  const months = {};
  const ensure = m => months[m] || (months[m] = { month: m, actualSpend: 0, plannedSpend: 0 });
  Object.values(appData.purchaseQueue).forEach(item => {
    if (item.status === 'purchased') {
      const model = item.promotedModelId ? appData.models[item.promotedModelId] : null;
      const month = (model?.purchaseDate || '').slice(0, 7);
      if (month) ensure(month).actualSpend += item.worth || 0;
    } else if (item.plannedMonth) {
      ensure(item.plannedMonth).plannedSpend += item.worth || 0;
    }
  });
  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

function rectClass(pct) {
  if (pct === null) return '';
  return pct >= 0 ? 'qm-rect-positive' : 'qm-rect-negative';
}

function fmtPct(pct) {
  return pct === null ? '—' : `${Math.round(pct)}%`;
}

// --- Render ---

let activeSection = 'overview';

export function renderQuartermaster(container) {
  container.innerHTML = `
    <div class="queue-layout">
      <div class="queue-tabs-bar">
        <div class="queue-tab-list">
          <button class="queue-tab-btn ${activeSection === 'overview' ? 'active' : ''}" data-qm-section="overview">Overview</button>
          <button class="queue-tab-btn ${activeSection === 'requisitions' ? 'active' : ''}" data-qm-section="requisitions">Requisitions</button>
          <button class="queue-tab-btn ${activeSection === 'ledger' ? 'active' : ''}" data-qm-section="ledger">Ledger</button>
        </div>
      </div>
      <div class="queue-body" id="qmBody"></div>
    </div>
  `;

  container.querySelectorAll('[data-qm-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSection = btn.dataset.qmSection;
      renderQuartermaster(container);
    });
  });

  const body = container.querySelector('#qmBody');
  if (activeSection === 'overview') renderQMOverview(body);
  else if (activeSection === 'requisitions') renderRequisitions(body, container);
  else renderLedger(body);
}

function renderQMOverview(body) {
  const budget = appData.config.monthlyBudgetGBP || 0;
  const globalRect = rectitudePct();
  const globalWorth = pileWorth();
  const globalCount = pileCount();

  const systemIds = [...new Set(
    Object.values(appData.models)
      .filter(m => unstartedCount(m) > 0)
      .map(m => resolveGameSystemId(m))
      .filter(Boolean)
  )];

  const systemCards = systemIds.map(sysId => {
    const sys = GAME_SYSTEMS[sysId];
    const rect = rectitudePct(sysId);
    const worth = pileWorth(sysId);
    return `
      <div class="dash-card qm-sys-card">
        <span class="sys-tag ${sys?.theme || ''}">${sys?.shortLabel || sysId}</span>
        <div class="qm-rect-figure ${rectClass(rect)}">${fmtPct(rect)}</div>
        <div class="pile-total">£${worth.toFixed(0)} on the pile</div>
      </div>`;
  }).join('');

  const collectionRows = Object.values(appData.collections).map(col => {
    const cost = costToFinish(col.id);
    if (!cost) return '';
    return `<div class="pile-item"><span class="pile-item-name">${col.name}</span><span class="pile-item-qty">£${cost.toFixed(0)} to finish</span></div>`;
  }).filter(Boolean).join('');

  body.innerHTML = `
    <div class="dash-card">
      <h3>Global Rectitude</h3>
      ${budget ? `
        <div class="qm-rect-figure ${rectClass(globalRect)}">${fmtPct(globalRect)}</div>
        <div class="pile-total">£${globalWorth.toFixed(0)} worth across ${globalCount} model${globalCount !== 1 ? 's' : ''} on the pile, vs £${budget.toFixed(0)}/month budget</div>
      ` : `<p class="empty-text">Set a monthly budget in the Ledger to calculate rectitude.</p>`}
    </div>
    ${systemCards ? `<div class="dashboard-grid qm-sys-grid">${systemCards}</div>` : ''}
    ${collectionRows ? `
      <div class="dash-card">
        <h3>Cost to Finish</h3>
        <div class="pile-items">${collectionRows}</div>
      </div>` : ''}
  `;
}

function renderRequisitions(body, container) {
  const items = Object.values(appData.purchaseQueue)
    .filter(i => i.status === 'queued')
    .sort((a, b) => (a.plannedMonth || '9999').localeCompare(b.plannedMonth || '9999'));

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Requisitions</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm btn-primary" id="qmAddItemBtn">+ Add</button>
      </div>
    </div>
    ${items.length === 0 ? `
      <div class="empty-state">
        <p>No future purchases queued.</p>
        <p style="font-size:0.85em;color:var(--text-muted)">Add what you're planning to buy next.</p>
      </div>
    ` : `
      <div class="queue-entries">
        ${items.map(item => requisitionCard(item)).join('')}
      </div>
    `}
  `;

  body.querySelector('#qmAddItemBtn')?.addEventListener('click', () => renderRequisitionForm(body, container, null));

  body.querySelectorAll('[data-qm-edit]').forEach(btn => {
    btn.addEventListener('click', () => renderRequisitionForm(body, container, btn.dataset.qmEdit));
  });
  body.querySelectorAll('[data-qm-promote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = appData.purchaseQueue[btn.dataset.qmPromote];
      if (!item || !confirm(`Promote "${item.name}" to a real model? This adds it to your pile.`)) return;
      promoteToModel(item.id);
      toast(`${item.name} promoted to your model pool!`, 'success');
      renderRequisitions(body, container);
    });
  });
  body.querySelectorAll('[data-qm-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this requisition?')) return;
      deletePurchaseItem(btn.dataset.qmDelete);
      renderRequisitions(body, container);
    });
  });
}

function requisitionCard(item) {
  const sys = item.gameSystemId ? GAME_SYSTEMS[item.gameSystemId] : null;
  return `
    <div class="queue-entry" data-item-id="${item.id}">
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <div class="queue-entry-name">${item.name}</div>
          <div class="queue-entry-qty">£${(item.worth || 0).toFixed(0)}</div>
          ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
        </div>
        ${item.reason ? `<div class="queue-entry-note">📌 ${item.reason}</div>` : ''}
        ${item.plannedMonth ? `<div class="queue-entry-note">🗓️ ${item.plannedMonth}</div>` : ''}
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-primary" data-qm-promote="${item.id}">✅ Promote</button>
          <button class="btn btn-sm" data-qm-edit="${item.id}">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" data-qm-delete="${item.id}">✕</button>
        </div>
      </div>
    </div>
  `;
}

// Add/edit form for a requisition, rendered inline in the office body (NOT
// a nested showModal — this app's modal system only tracks one overlay at a
// time, so opening a second modal on top of the office would silently close
// it). Shows a live "what would promoting this do to the pile / rectitude"
// preview as the worth field changes — nothing is written to appData until Save.
function renderRequisitionForm(body, container, editId) {
  const item = editId ? appData.purchaseQueue[editId] : null;
  const collections = Object.values(appData.collections);

  const currentWorth = pileWorth();
  const budget = appData.config.monthlyBudgetGBP || 0;

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">${editId ? 'Edit' : 'New'} Requisition</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm" id="qmFormBack">← Back</button>
      </div>
    </div>
    <div class="form-group">
      <label>Name</label>
      <input id="qmName" type="text" class="form-input" placeholder="What are you planning to buy?" value="${item?.name || ''}">
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Worth (£)</label>
        <input id="qmWorth" type="number" class="form-input" min="0" step="0.01" value="${item?.worth ?? ''}">
      </div>
      <div class="form-group">
        <label>Game System</label>
        <select id="qmGameSystem" class="form-input">
          <option value="">— None —</option>
          ${Object.values(GAME_SYSTEMS).map(s => `<option value="${s.id}" ${item?.gameSystemId === s.id ? 'selected' : ''}>${s.shortLabel}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Planned Month</label>
        <input id="qmMonth" type="month" class="form-input" value="${item?.plannedMonth || ''}">
      </div>
      <div class="form-group">
        <label>Army (optional)</label>
        <select id="qmCollection" class="form-input">
          <option value="">— None —</option>
          ${collections.map(c => `<option value="${c.id}" ${item?.collectionId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Reason (optional)</label>
      <textarea id="qmReason" class="form-input" rows="2">${item?.reason || ''}</textarea>
    </div>
    <div class="pile-total" id="qmDeltaPreview"></div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="qmSave">${editId ? 'Update' : 'Add'} Requisition</button>
      <button class="btn" id="qmCancel">Cancel</button>
    </div>
  `;

  const worthInput = body.querySelector('#qmWorth');
  const deltaEl = body.querySelector('#qmDeltaPreview');

  function updateDelta() {
    const draftWorth = parseFloat(worthInput.value) || 0;
    const newWorth = currentWorth + draftWorth;
    if (!budget) {
      deltaEl.textContent = 'Set a monthly budget in the Ledger to see rectitude impact.';
      return;
    }
    const newRect = Math.min(100, (budget - newWorth) / budget * 100);
    deltaEl.innerHTML = `If promoted: pile worth £${currentWorth.toFixed(0)} → £${newWorth.toFixed(0)}. Rectitude ${fmtPct(rectitudePct())} → <span class="${rectClass(newRect)}">${fmtPct(newRect)}</span>`;
  }
  worthInput.addEventListener('input', updateDelta);
  updateDelta();

  if (budget && rectitudePct() < 0) {
    toast('Your pile already exceeds a month of budget — plan carefully.', 'warning');
  }

  body.querySelector('#qmFormBack').addEventListener('click', () => renderRequisitions(body, container));
  body.querySelector('#qmCancel').addEventListener('click', () => renderRequisitions(body, container));

  body.querySelector('#qmSave').addEventListener('click', () => {
    const name = body.querySelector('#qmName').value.trim();
    if (!name) { toast('Please enter a name', 'error'); return; }
    const fields = {
      name,
      worth: parseFloat(body.querySelector('#qmWorth').value) || 0,
      gameSystemId: body.querySelector('#qmGameSystem').value || null,
      plannedMonth: body.querySelector('#qmMonth').value || '',
      collectionId: body.querySelector('#qmCollection').value || null,
      reason: body.querySelector('#qmReason').value.trim()
    };
    if (editId) updatePurchaseItem(editId, fields);
    else createPurchaseItem(fields);
    renderRequisitions(body, container);
  });
}

function renderLedger(body) {
  const budget = appData.config.monthlyBudgetGBP || 0;
  const timeline = monthlySpendTimeline();

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Ledger</h2>
    </div>
    <div class="form-group">
      <label>Monthly Budget (£)</label>
      <input id="qmBudgetInput" type="number" class="form-input" min="0" step="0.01" value="${budget || ''}" style="max-width:200px">
    </div>
    ${timeline.length === 0 ? `
      <div class="empty-state">
        <p>No spend history or planned purchases yet.</p>
      </div>
    ` : `
      <div class="pile-items">
        ${timeline.map(m => `
          <div class="pile-item">
            <span class="pile-item-name">${m.month}</span>
            <span class="pile-item-qty">${m.actualSpend ? `£${m.actualSpend.toFixed(0)} spent` : ''}${m.actualSpend && m.plannedSpend ? ' · ' : ''}${m.plannedSpend ? `£${m.plannedSpend.toFixed(0)} planned` : ''}</span>
          </div>
        `).join('')}
      </div>
    `}
  `;

  body.querySelector('#qmBudgetInput').addEventListener('change', e => {
    appData.config.monthlyBudgetGBP = parseFloat(e.target.value) || 0;
    saveData();
    toast('Budget updated', 'success');
  });
}
