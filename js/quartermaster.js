// quartermaster.js — Quartermaster's Office: purchase planning, valuation, and budget tracking

import {
  appData, saveData, uid, unstartedCount, createModel, updateModel, GAME_SYSTEMS,
  resolveGameSystemId, greyBrigadeCount
} from './data.js';
import { toast, today, formatDate } from './ui.js';

// --- Data helpers ---

// Requisition item types. 'model' promotes into a real model in the pool
// (and so joins the pile / weighs on rectitude). The rest — gifts, codices,
// sundries — are ledger-only: they're real spend for budgeting purposes,
// but promoting them never creates a model, so they never touch the pile
// or compromise rectitude. Promoting one of these just marks it purchased
// and it disappears from the Requisitions list into the Ledger's spend history.
export const PURCHASE_ITEM_TYPES = {
  model: { id: 'model', label: 'Model / Miniature', addsToPile: true },
  gift: { id: 'gift', label: 'Gift', addsToPile: false },
  codex: { id: 'codex', label: 'Codex / Rulebook', addsToPile: false },
  sundry: { id: 'sundry', label: 'Sundry / Supplies', addsToPile: false }
};

export function createPurchaseItem({ name, gameSystemId = null, worth = 0, reason = '', plannedMonth = '', collectionId = null, itemType = 'model' }) {
  const id = uid();
  appData.purchaseQueue[id] = {
    id, name, gameSystemId, worth, reason, plannedMonth, collectionId, itemType,
    status: 'queued', promotedModelId: null, purchaseDate: null
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

// Converts a queued requisition into spent budget. Model-type items become
// a real model (stamped with today's purchase date), which joins the pile.
// Gifts, codices and sundries skip model creation entirely — they're
// stamped purchased with today's date and just drop off the Requisitions
// list, landing only in the Ledger's spend history.
export function promoteToModel(id) {
  const item = appData.purchaseQueue[id];
  if (!item) return null;
  const type = PURCHASE_ITEM_TYPES[item.itemType] || PURCHASE_ITEM_TYPES.model;
  if (!type.addsToPile) {
    updatePurchaseItem(id, { status: 'purchased', purchaseDate: today() });
    return null;
  }
  const modelId = createModel({ name: item.name, gameSystemId: item.gameSystemId, quantity: 1, worth: item.worth });
  updateModel(modelId, { purchaseDate: today() });
  updatePurchaseItem(id, { status: 'purchased', promotedModelId: modelId, purchaseDate: today() });
  return modelId;
}

// --- Calculations ---

function pileModels(gameSystemId = null) {
  return Object.values(appData.models).filter(m => {
    if (unstartedCount(m) <= 0 && greyBrigadeCount(m) <= 0) return false;
    if (gameSystemId && resolveGameSystemId(m) !== gameSystemId) return false;
    return true;
  });
}

export function pileCount(gameSystemId = null) {
  return pileModels(gameSystemId).reduce((sum, m) => sum + unstartedCount(m) + greyBrigadeCount(m), 0);
}

// Grey Brigade models (assembled/primed but not yet painted) weigh on
// rectitude too, just at half the rate of the still-on-the-sprue pile — a
// model only counts once, at the higher of the two weights it qualifies for.
export function pileWorth(gameSystemId = null) {
  return pileModels(gameSystemId).reduce((sum, m) => {
    if (unstartedCount(m) > 0) return sum + (m.worth || 0);
    if (greyBrigadeCount(m) > 0) return sum + (m.worth || 0) * 0.5;
    return sum;
  }, 0);
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
// Each month also keeps the individual items behind it (actualItems /
// plannedItems) so the Ledger can itemize, not just show a monthly total.
export function monthlySpendTimeline() {
  const months = {};
  const ensure = m => months[m] || (months[m] = { month: m, actualSpend: 0, plannedSpend: 0, actualItems: [], plannedItems: [] });
  Object.values(appData.purchaseQueue).forEach(item => {
    if (item.status === 'purchased') {
      const model = item.promotedModelId ? appData.models[item.promotedModelId] : null;
      const month = (item.purchaseDate || model?.purchaseDate || '').slice(0, 7);
      if (month) {
        const entry = ensure(month);
        entry.actualSpend += item.worth || 0;
        entry.actualItems.push(item);
      }
    } else if (item.plannedMonth) {
      const entry = ensure(item.plannedMonth);
      entry.plannedSpend += item.worth || 0;
      entry.plannedItems.push(item);
    }
  });
  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

// Uncommitted headroom left against the budget, scoped to whichever period
// the budget is actually managed in (appData.config.budgetPeriod): this
// calendar month's budget minus this month's spend when managed monthly,
// or this calendar year's budget minus this year's spend when managed
// annually — comparing an annual budget against only one month's spend
// would be meaningless.
export function budgetRemaining() {
  const monthlyBudget = appData.config.monthlyBudgetGBP || 0;
  const period = appData.config.budgetPeriod || 'monthly';
  const timeline = monthlySpendTimeline();

  if (period === 'annual') {
    const year = new Date().getFullYear();
    const yearEntries = timeline.filter(m => m.month.startsWith(`${year}-`));
    const budget = monthlyBudget * 12;
    const spent = yearEntries.reduce((sum, m) => sum + m.actualSpend, 0);
    const planned = yearEntries.reduce((sum, m) => sum + m.plannedSpend, 0);
    return { period, budget, spent, planned, remaining: budget - spent - planned };
  }

  const thisMonth = today().slice(0, 7);
  const entry = timeline.find(m => m.month === thisMonth);
  const spent = entry?.actualSpend || 0;
  const planned = entry?.plannedSpend || 0;
  return { period, budget: monthlyBudget, spent, planned, remaining: monthlyBudget - spent - planned };
}

// All-time actual (purchased) spend, broken down by requisition type —
// how much has gone to models vs. gifts vs. codices vs. sundries.
export function spendByType() {
  const totals = {};
  Object.values(appData.purchaseQueue).forEach(item => {
    if (item.status !== 'purchased') return;
    const t = item.itemType || 'model';
    totals[t] = (totals[t] || 0) + (item.worth || 0);
  });
  return totals;
}

// Actual spend across the given calendar year (defaults to this year).
export function yearToDateSpend(year = new Date().getFullYear()) {
  const prefix = `${year}-`;
  return monthlySpendTimeline()
    .filter(m => m.month.startsWith(prefix))
    .reduce((sum, m) => sum + m.actualSpend, 0);
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
          <button class="queue-tab-btn ${activeSection === 'budget' ? 'active' : ''}" data-qm-section="budget">Budget</button>
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
  else if (activeSection === 'ledger') renderLedger(body);
  else renderBudget(body);
}

function renderQMOverview(body) {
  const budget = appData.config.monthlyBudgetGBP || 0;
  const globalRect = rectitudePct();
  const globalWorth = pileWorth();
  const globalCount = pileCount();

  const systemIds = [...new Set(
    Object.values(appData.models)
      .filter(m => unstartedCount(m) > 0 || greyBrigadeCount(m) > 0)
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
      ` : `<p class="empty-text">Set a monthly budget in the Budget tab to calculate rectitude.</p>`}
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
      if (!item) return;
      const type = PURCHASE_ITEM_TYPES[item.itemType] || PURCHASE_ITEM_TYPES.model;
      const confirmMsg = type.addsToPile
        ? `Promote "${item.name}" to a real model? This adds it to your pile.`
        : `Mark "${item.name}" as purchased? As a ${type.label.toLowerCase()}, it goes on the ledger but won't join your pile or affect rectitude.`;
      if (!confirm(confirmMsg)) return;
      promoteToModel(item.id);
      toast(type.addsToPile ? `${item.name} promoted to your model pool!` : `${item.name} logged as purchased.`, 'success');
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
  const type = PURCHASE_ITEM_TYPES[item.itemType] || PURCHASE_ITEM_TYPES.model;
  return `
    <div class="queue-entry" data-item-id="${item.id}">
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <div class="queue-entry-name">${item.name}</div>
          <div class="queue-entry-qty">£${(item.worth || 0).toFixed(0)}</div>
          ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
          ${!type.addsToPile ? `<span class="sys-tag theme-default">${type.label}</span>` : ''}
        </div>
        ${item.reason ? `<div class="queue-entry-note">📌 ${item.reason}</div>` : ''}
        ${item.plannedMonth ? `<div class="queue-entry-note">🗓️ ${item.plannedMonth}</div>` : ''}
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-primary" data-qm-promote="${item.id}">${type.addsToPile ? '✅ Promote' : '✅ Log Purchase'}</button>
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
        <label>Type</label>
        <select id="qmItemType" class="form-input">
          ${Object.values(PURCHASE_ITEM_TYPES).map(t => `<option value="${t.id}" ${(item?.itemType || 'model') === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Game System</label>
        <select id="qmGameSystem" class="form-input">
          <option value="">— None —</option>
          ${Object.values(GAME_SYSTEMS).map(s => `<option value="${s.id}" ${item?.gameSystemId === s.id ? 'selected' : ''}>${s.shortLabel}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Planned Month</label>
        <input id="qmMonth" type="month" class="form-input" value="${item?.plannedMonth || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Army (optional)</label>
      <select id="qmCollection" class="form-input">
        <option value="">— None —</option>
        ${collections.map(c => `<option value="${c.id}" ${item?.collectionId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <p class="form-hint" id="qmTypeHint"></p>
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
  const typeSelect = body.querySelector('#qmItemType');
  const deltaEl = body.querySelector('#qmDeltaPreview');
  const typeHintEl = body.querySelector('#qmTypeHint');

  function updateDelta() {
    const type = PURCHASE_ITEM_TYPES[typeSelect.value] || PURCHASE_ITEM_TYPES.model;
    if (!type.addsToPile) {
      deltaEl.textContent = '';
      typeHintEl.textContent = `${type.label} items go on the ledger but never join the pile — rectitude is unaffected.`;
      return;
    }
    typeHintEl.textContent = '';
    const draftWorth = parseFloat(worthInput.value) || 0;
    const newWorth = currentWorth + draftWorth;
    if (!budget) {
      deltaEl.textContent = 'Set a monthly budget in the Budget tab to see rectitude impact.';
      return;
    }
    const newRect = Math.min(100, (budget - newWorth) / budget * 100);
    deltaEl.innerHTML = `If promoted: pile worth £${currentWorth.toFixed(0)} → £${newWorth.toFixed(0)}. Rectitude ${fmtPct(rectitudePct())} → <span class="${rectClass(newRect)}">${fmtPct(newRect)}</span>`;
  }
  worthInput.addEventListener('input', updateDelta);
  typeSelect.addEventListener('change', updateDelta);
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
      itemType: body.querySelector('#qmItemType').value || 'model',
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

function monthLabel(month) {
  const [y, mo] = month.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// One line per transaction: a real date for purchased items, "planned" for
// queued items (which only carry a target month, not a day).
function ledgerRow(item, kind) {
  const type = PURCHASE_ITEM_TYPES[item.itemType] || PURCHASE_ITEM_TYPES.model;
  const dateLabel = kind === 'spent' ? formatDate(item.purchaseDate, { day: 'numeric', month: 'short' }) : '—';
  return `
    <div class="ledger-row ${kind === 'planned' ? 'ledger-row-planned' : ''}">
      <span class="ledger-row-date">${dateLabel}</span>
      <span class="ledger-row-name">${item.name}<span class="sys-tag theme-default ledger-row-type">${type.label}</span></span>
      <span class="ledger-row-amount">£${(item.worth || 0).toFixed(0)}${kind === 'planned' ? ' <em>planned</em>' : ''}</span>
    </div>
  `;
}

// A month's worth of transactions, grouped under a plain (non-collapsing)
// header with the month's subtotal — every line item is visible up front,
// not tucked behind a click.
function ledgerMonthGroup(m) {
  const items = [...m.actualItems.map(i => ledgerRow(i, 'spent')), ...m.plannedItems.map(i => ledgerRow(i, 'planned'))];
  return `
    <div class="ledger-month-group">
      <div class="ledger-month-header">
        <span>${monthLabel(m.month)}</span>
        <span>${m.actualSpend ? `£${m.actualSpend.toFixed(0)} spent` : ''}${m.actualSpend && m.plannedSpend ? ' · ' : ''}${m.plannedSpend ? `£${m.plannedSpend.toFixed(0)} planned` : ''}</span>
      </div>
      ${items.join('')}
    </div>
  `;
}

// The Ledger tab is just the transaction record: every purchased/planned
// item, grouped by month, oldest first. Budget settings and the
// remaining/YTD/spend-by-type stats live on the separate Budget tab so
// this stays a quick, dense read rather than a stats dashboard.
function renderLedger(body) {
  const timeline = monthlySpendTimeline();

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Ledger</h2>
    </div>
    ${timeline.length === 0 ? `
      <div class="empty-state">
        <p>No spend history or planned purchases yet.</p>
      </div>
    ` : timeline.map(m => ledgerMonthGroup(m)).join('')}
  `;
}

function renderBudget(body) {
  const monthlyBudget = appData.config.monthlyBudgetGBP || 0;
  const period = appData.config.budgetPeriod || 'monthly';
  const displayAmount = period === 'annual' ? monthlyBudget * 12 : monthlyBudget;
  const remain = budgetRemaining();
  const currentYear = new Date().getFullYear();
  const ytd = yearToDateSpend(currentYear);
  const byType = spendByType();
  const typeRows = Object.values(PURCHASE_ITEM_TYPES)
    .map(t => ({ ...t, total: byType[t.id] || 0 }))
    .filter(t => t.total > 0);

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Budget</h2>
    </div>
    <div class="form-row-two" style="max-width:360px">
      <div class="form-group">
        <label>Budget (£)</label>
        <input id="qmBudgetInput" type="number" class="form-input" min="0" step="0.01" value="${displayAmount || ''}">
      </div>
      <div class="form-group">
        <label>Per</label>
        <select id="qmBudgetPeriod" class="form-input">
          <option value="monthly" ${period === 'monthly' ? 'selected' : ''}>Month</option>
          <option value="annual" ${period === 'annual' ? 'selected' : ''}>Year</option>
        </select>
      </div>
    </div>
    ${monthlyBudget ? `<p class="form-hint">= £${monthlyBudget.toFixed(2)}/month for rectitude</p>` : ''}
    ${monthlyBudget ? `
      <div class="dash-card">
        <h3>Remaining This ${period === 'annual' ? 'Year' : 'Month'}</h3>
        <div class="qm-rect-figure ${rectClass(remain.remaining)}">£${remain.remaining.toFixed(0)}</div>
        <div class="pile-total">£${remain.spent.toFixed(0)} spent${remain.planned ? ` + £${remain.planned.toFixed(0)} planned` : ''} of £${remain.budget.toFixed(0)} budget</div>
      </div>
    ` : ''}
    ${period === 'monthly' ? `
      <div class="dash-card">
        <h3>Year to Date (${currentYear})</h3>
        <div class="pile-total">£${ytd.toFixed(0)} spent${monthlyBudget ? ` vs £${(monthlyBudget * 12).toFixed(0)} annual budget` : ''}</div>
      </div>
    ` : ''}
    ${typeRows.length > 0 ? `
      <div class="dash-card">
        <h3>Spend by Type</h3>
        <div class="pile-items">
          ${typeRows.map(t => `<div class="pile-item"><span class="pile-item-name">${t.label}</span><span class="pile-item-qty">£${t.total.toFixed(0)}</span></div>`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  // Amount changes reinterpret the figure under whichever period is currently
  // selected; switching the period alone just converts the displayed figure
  // (via re-render) without changing the underlying monthly budget.
  body.querySelector('#qmBudgetInput').addEventListener('change', e => {
    const amount = parseFloat(e.target.value) || 0;
    const selectedPeriod = body.querySelector('#qmBudgetPeriod').value;
    appData.config.monthlyBudgetGBP = selectedPeriod === 'annual' ? amount / 12 : amount;
    saveData();
    toast('Budget updated', 'success');
    renderBudget(body);
  });

  body.querySelector('#qmBudgetPeriod').addEventListener('change', e => {
    appData.config.budgetPeriod = e.target.value;
    saveData();
    renderBudget(body);
  });
}
