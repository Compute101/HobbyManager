// quartermaster.js — Quartermaster's Office: purchase planning, valuation, and budget tracking

import {
  appData, saveData, uid, unstartedCount, createModel, updateModel, GAME_SYSTEMS,
  resolveGameSystemId, greyBrigadeCount, modelPoints, getModelType, singleModelPoints,
  getAllModelTypes
} from './data.js';
import { toast, today, formatDate } from './ui.js';
import { parseOwbList } from './owb-import.js';
import { parseW40kList } from './w40k-import.js';

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

// --- Wishlist ---
// Deliberately outside the requisition/budget system: no plannedMonth, no
// worth requirement, no rectitude impact. Just "things I fancy", for
// yourself or as gift ideas for someone else. When you're ready to actually
// plan one, move it into Requisitions.

export function createWishlistItem({ name, gameSystemId = null, worth = 0, forWhom = '', collectionId = null, itemType = 'model', note = '' }) {
  const id = uid();
  appData.wishlist[id] = { id, name, gameSystemId, worth, forWhom, collectionId, itemType, note, dateAdded: today() };
  saveData();
  return id;
}

export function updateWishlistItem(id, fields) {
  if (!appData.wishlist[id]) return;
  Object.assign(appData.wishlist[id], fields);
  saveData();
}

export function deleteWishlistItem(id) {
  delete appData.wishlist[id];
  saveData();
}

// Copies a wishlist entry into the requisitions queue (no plannedMonth set —
// that's the user's next step, on the Requisitions tab) and removes it from
// the wishlist. The "for" note is folded into the reason so it isn't lost.
export function moveWishlistToRequisitions(id) {
  const item = appData.wishlist[id];
  if (!item) return null;
  const reason = [item.forWhom ? `For ${item.forWhom}` : '', item.note].filter(Boolean).join(' — ');
  const newId = createPurchaseItem({
    name: item.name,
    gameSystemId: item.gameSystemId,
    worth: item.worth,
    reason,
    plannedMonth: '',
    collectionId: item.collectionId,
    itemType: item.itemType
  });
  deleteWishlistItem(id);
  return newId;
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

// --- Army Projections ---
// A projection is a hypothetical army list under evaluation: paste one in,
// tick off what you already own, price what's left, rate it, and get a
// cost-benefit verdict. Unlike a real import, this never creates models or
// touches the pile — it's purely for deciding whether to buy at all.

function normalizeProjectionUnit(u) {
  return {
    id: uid(),
    name: u.name,
    quantity: u.quantity || 1,
    modelTypeId: u.modelTypeId || null,
    owned: !!u.owned,
    worth: u.worth || 0
  };
}

export function createProjection({ name, gameSystemId = null, units = [] }) {
  const id = uid();
  appData.projections[id] = {
    id, name, gameSystemId,
    units: units.map(normalizeProjectionUnit),
    // Box deals (e.g. Combat Patrols) — a bundle bundles ≥2 units under one
    // discounted price, which replaces those units' individual worths in
    // the cost total. id -> { id, name, price, unitIds }
    bundles: [],
    ratings: { personal: 3, thematic: 3, power: 3 },
    notes: '',
    dateCreated: today()
  };
  saveData();
  return id;
}

export function updateProjection(id, fields) {
  if (!appData.projections[id]) return;
  Object.assign(appData.projections[id], fields);
  saveData();
}

export function deleteProjection(id) {
  delete appData.projections[id];
  saveData();
}

export function addProjectionUnit(projId, fields) {
  const proj = appData.projections[projId];
  if (!proj) return null;
  const unit = normalizeProjectionUnit(fields);
  proj.units.push(unit);
  saveData();
  return unit.id;
}

export function updateProjectionUnit(projId, unitId, fields) {
  const unit = appData.projections[projId]?.units.find(u => u.id === unitId);
  if (!unit) return;
  Object.assign(unit, fields);
  saveData();
}

export function deleteProjectionUnit(projId, unitId) {
  const proj = appData.projections[projId];
  if (!proj) return;
  proj.units = proj.units.filter(u => u.id !== unitId);
  // Drop the unit from whichever bundle held it; a bundle left with nothing
  // in it no longer means anything, so it goes too.
  (proj.bundles || []).forEach(b => { b.unitIds = b.unitIds.filter(id => id !== unitId); });
  proj.bundles = (proj.bundles || []).filter(b => b.unitIds.length > 0);
  saveData();
}

export function addProjectionBundle(projId, { name, price = 0, unitIds = [] }) {
  const proj = appData.projections[projId];
  if (!proj) return null;
  if (!proj.bundles) proj.bundles = [];
  const id = uid();
  proj.bundles.push({ id, name, price, unitIds: [...unitIds] });
  saveData();
  return id;
}

export function updateProjectionBundle(projId, bundleId, fields) {
  const bundle = appData.projections[projId]?.bundles?.find(b => b.id === bundleId);
  if (!bundle) return;
  Object.assign(bundle, fields);
  saveData();
}

export function deleteProjectionBundle(projId, bundleId) {
  const proj = appData.projections[projId];
  if (!proj) return;
  proj.bundles = (proj.bundles || []).filter(b => b.id !== bundleId);
  saveData();
}

// Hobby points one copy of this unit's model type is worth, times quantity —
// mirrors singleModelPoints() but works off a projection's lightweight unit
// stub rather than a real pooled model.
export function unitHobbyPoints(unit) {
  const type = unit.modelTypeId ? getModelType(unit.modelTypeId) : null;
  const perModel = singleModelPoints({ stages: type?.stages || null, skippedStages: [] });
  return perModel * (unit.quantity || 1);
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

// Hobby points still up for grabs from the pile — the undone portion of
// each pile model's total, weighted the same way pileWorth() weights £:
// full weight on the sprue, half weight for Grey Brigade. Used as a
// projection's own real-world "£ per hobby point" benchmark.
export function pileHobbyPoints(gameSystemId = null) {
  return pileModels(gameSystemId).reduce((sum, m) => {
    const pts = modelPoints(m);
    const remaining = Math.max(0, pts.total - pts.done);
    if (unstartedCount(m) > 0) return sum + remaining;
    if (greyBrigadeCount(m) > 0) return sum + remaining * 0.5;
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

// £ per hobby point assumed when there's no pile history yet to benchmark
// a projection's value against.
const FALLBACK_COST_PER_POINT = 5;

// Cost-benefit analysis for a projection: prices and points only count the
// unowned units (what you'd actually be buying), benchmarked against what
// your own pile currently costs you per hobby point. Every number used in
// the verdict is also returned in workingLines, in the order it's applied,
// so the verdict can always show its working.
//
// Bundles (box deals like a Combat Patrol) replace their members' individual
// worths with one price for the set. A bundle counts toward cost as soon as
// any of its units are unowned — buying the box is assumed to be how you'd
// get them, even if you already happen to own another item from it.
export function projectionAnalysis(projection) {
  const units = projection.units || [];
  const bundles = projection.bundles || [];
  const unowned = units.filter(u => !u.owned);
  const unownedIds = new Set(unowned.map(u => u.id));

  const bundledUnitIds = new Set(bundles.flatMap(b => b.unitIds));
  const activeBundles = bundles.filter(b => b.unitIds.some(id => unownedIds.has(id)));
  const bundleCost = activeBundles.reduce((sum, b) => sum + (b.price || 0), 0);
  const unbundledCost = unowned
    .filter(u => !bundledUnitIds.has(u.id))
    .reduce((sum, u) => sum + (u.worth || 0), 0);
  const totalCost = unbundledCost + bundleCost;

  // What the bundled units would have cost bought individually, vs. what the
  // bundle(s) actually charge — only meaningful once those units are priced.
  const bundleIndividualTotal = activeBundles.reduce((sum, b) => {
    return sum + b.unitIds.reduce((s, id) => s + (units.find(u => u.id === id)?.worth || 0), 0);
  }, 0);
  const bundleSavings = bundleIndividualTotal - bundleCost;

  const hobbyPointsAdded = unowned.reduce((sum, u) => sum + unitHobbyPoints(u), 0);
  const costPerPoint = hobbyPointsAdded > 0 ? totalCost / hobbyPointsAdded : null;

  const ratings = projection.ratings || { personal: 0, thematic: 0, power: 0 };
  const avgRating = (ratings.personal + ratings.thematic + ratings.power) / 3;
  const ratingScore10 = avgRating * 2;

  const baseWorth = pileWorth(projection.gameSystemId);
  const basePoints = pileHobbyPoints(projection.gameSystemId);
  const baselineCostPerPoint = basePoints > 0 ? baseWorth / basePoints : null;
  const referenceCostPerPoint = baselineCostPerPoint ?? FALLBACK_COST_PER_POINT;

  // Only score value once the unowned items are actually priced — £0 just
  // means "not priced yet" (the default on import), not "free", so it must
  // not read as a maximal-value acquisition.
  let valueScore10 = null;
  if (costPerPoint !== null && totalCost > 0) {
    valueScore10 = Math.max(0, Math.min(10, 5 * (referenceCostPerPoint / costPerPoint)));
  }

  const nothingToBuy = units.length > 0 && unowned.length === 0;

  let finalScore = null, verdict, verdictLabel, verdictIcon;
  if (nothingToBuy) {
    verdict = 'owned'; verdictLabel = 'Nothing to buy'; verdictIcon = '✅';
  } else {
    finalScore = valueScore10 !== null ? (ratingScore10 * 0.5 + valueScore10 * 0.5) : ratingScore10;
    if (finalScore >= 7)        { verdict = 'buy';      verdictLabel = 'Buy it';      verdictIcon = '✅'; }
    else if (finalScore >= 4.5) { verdict = 'consider';  verdictLabel = 'Consider it'; verdictIcon = '🤔'; }
    else                        { verdict = 'skip';      verdictLabel = 'Skip it';     verdictIcon = '🚫'; }
  }

  const workingLines = [];
  if (!nothingToBuy) {
    const ratingSum = ratings.personal + ratings.thematic + ratings.power;
    workingLines.push(
      `Ratings: Personal ${ratings.personal}/5 + Thematic ${ratings.thematic}/5 + Power ${ratings.power}/5 = ${ratingSum}/15 → average ${avgRating.toFixed(1)}/5 → rating score ${ratingScore10.toFixed(1)}/10`
    );
    if (activeBundles.length > 0) {
      const bundleNames = activeBundles.map(b => b.name).join(', ');
      const savingsNote = bundleIndividualTotal === 0
        ? ' (price the bundled units individually to see the saving)'
        : bundleSavings > 0
          ? `, saving £${bundleSavings.toFixed(0)} vs £${bundleIndividualTotal.toFixed(0)} bought separately`
          : bundleSavings < 0
            ? `, £${Math.abs(bundleSavings).toFixed(0)} more than buying those units separately`
            : ', same total as buying those units separately';
      workingLines.push(`Bundled: ${bundleNames} — £${bundleCost.toFixed(0)} for the set${savingsNote}`);
    }
    if (valueScore10 !== null) {
      workingLines.push(
        `Cost: £${totalCost.toFixed(0)} for ${unowned.length} unowned item${unowned.length !== 1 ? 's' : ''} adding ${hobbyPointsAdded} hobby points → £${costPerPoint.toFixed(2)}/point`
      );
      workingLines.push(
        baselineCostPerPoint
          ? `Your pile currently costs £${baselineCostPerPoint.toFixed(2)}/point on average, so this scores ${valueScore10.toFixed(1)}/10 for value`
          : `No pile history to benchmark against yet, so value is scored against a flat £${FALLBACK_COST_PER_POINT.toFixed(2)}/point reference: ${valueScore10.toFixed(1)}/10`
      );
      workingLines.push(
        `Combined score: (rating ${ratingScore10.toFixed(1)} + value ${valueScore10.toFixed(1)}) ÷ 2 = ${finalScore.toFixed(1)}/10 → ${verdictLabel}`
      );
    } else {
      workingLines.push('No priced unowned items yet — value can\'t be scored, so the verdict is rating-only.');
      workingLines.push(`Combined score: rating only = ${finalScore.toFixed(1)}/10 → ${verdictLabel}`);
    }
  }

  let budgetWarning = null;
  const budget = appData.config.monthlyBudgetGBP || 0;
  if (budget && totalCost > 0) {
    const remain = budgetRemaining();
    if (totalCost > remain.remaining) {
      budgetWarning = `⚠️ £${totalCost.toFixed(0)} exceeds your remaining ${remain.period === 'annual' ? "year's" : "month's"} budget of £${Math.max(0, remain.remaining).toFixed(0)}.`;
    }
  }

  return {
    totalCost, hobbyPointsAdded, costPerPoint,
    unownedCount: unowned.length, ownedCount: units.length - unowned.length,
    activeBundles, bundleCost, bundleSavings,
    ratings, avgRating, ratingScore10, baselineCostPerPoint, valueScore10, finalScore,
    verdict, verdictLabel, verdictIcon, workingLines, budgetWarning, nothingToBuy
  };
}

function verdictClass(verdict) {
  return {
    buy: 'qm-verdict-buy', consider: 'qm-verdict-consider',
    skip: 'qm-verdict-skip', owned: 'qm-verdict-owned'
  }[verdict] || '';
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
let activeProjectionId = null;

export function renderQuartermaster(container) {
  container.innerHTML = `
    <div class="queue-layout">
      <div class="queue-tabs-bar">
        <div class="queue-tab-list">
          <button class="queue-tab-btn ${activeSection === 'overview' ? 'active' : ''}" data-qm-section="overview">Overview</button>
          <button class="queue-tab-btn ${activeSection === 'wishlist' ? 'active' : ''}" data-qm-section="wishlist">Wishlist</button>
          <button class="queue-tab-btn ${activeSection === 'projections' ? 'active' : ''}" data-qm-section="projections">Projections</button>
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
  else if (activeSection === 'wishlist') renderWishlist(body, container);
  else if (activeSection === 'projections') renderProjectionsTab(body, container);
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

// The Wishlist tab: pure, unplanned "things I fancy" — no month, no budget
// math, nothing else to fill in but a name. Deliberately the lightest-weight
// form in the office.
function renderWishlist(body, container) {
  const items = Object.values(appData.wishlist)
    .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Wishlist</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm btn-primary" id="qmAddWishBtn">+ Add</button>
      </div>
    </div>
    ${items.length === 0 ? `
      <div class="empty-state">
        <p>Nothing on the wishlist yet.</p>
        <p style="font-size:0.85em;color:var(--text-muted)">Jot down anything you fancy — for yourself or as a gift idea for someone else. No commitment, no month, no budget math.</p>
      </div>
    ` : `
      <div class="queue-entries">
        ${items.map(item => wishlistCard(item)).join('')}
      </div>
    `}
  `;

  body.querySelector('#qmAddWishBtn')?.addEventListener('click', () => renderWishlistForm(body, container, null));

  body.querySelectorAll('[data-wish-edit]').forEach(btn => {
    btn.addEventListener('click', () => renderWishlistForm(body, container, btn.dataset.wishEdit));
  });
  body.querySelectorAll('[data-wish-move]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = appData.wishlist[btn.dataset.wishMove];
      if (!item) return;
      if (!confirm(`Move "${item.name}" to Requisitions? You'll be able to give it a planned month there.`)) return;
      moveWishlistToRequisitions(item.id);
      toast(`${item.name} moved to Requisitions.`, 'success');
      renderWishlist(body, container);
    });
  });
  body.querySelectorAll('[data-wish-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this from your wishlist?')) return;
      deleteWishlistItem(btn.dataset.wishDelete);
      renderWishlist(body, container);
    });
  });
}

function wishlistCard(item) {
  const sys = item.gameSystemId ? GAME_SYSTEMS[item.gameSystemId] : null;
  const type = PURCHASE_ITEM_TYPES[item.itemType] || PURCHASE_ITEM_TYPES.model;
  return `
    <div class="queue-entry" data-item-id="${item.id}">
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <div class="queue-entry-name">${item.name}</div>
          ${item.worth ? `<div class="queue-entry-qty">~£${item.worth.toFixed(0)}</div>` : ''}
          ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
          ${!type.addsToPile ? `<span class="sys-tag theme-default">${type.label}</span>` : ''}
        </div>
        ${item.forWhom ? `<div class="queue-entry-note">🎁 For ${item.forWhom}</div>` : ''}
        ${item.note ? `<div class="queue-entry-note">📌 ${item.note}</div>` : ''}
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-primary" data-wish-move="${item.id}">➡️ Move to Requisitions</button>
          <button class="btn btn-sm" data-wish-edit="${item.id}">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" data-wish-delete="${item.id}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function renderWishlistForm(body, container, editId) {
  const item = editId ? appData.wishlist[editId] : null;
  const collections = Object.values(appData.collections);

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">${editId ? 'Edit' : 'New'} Wishlist Item</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm" id="qmWishFormBack">← Back</button>
      </div>
    </div>
    <div class="form-group">
      <label>Name</label>
      <input id="wishName" type="text" class="form-input" placeholder="What do you fancy?" value="${item?.name || ''}">
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Estimated Worth (£, optional)</label>
        <input id="wishWorth" type="number" class="form-input" min="0" step="0.01" value="${item?.worth ?? ''}">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="wishItemType" class="form-input">
          ${Object.values(PURCHASE_ITEM_TYPES).map(t => `<option value="${t.id}" ${(item?.itemType || 'model') === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Game System</label>
        <select id="wishGameSystem" class="form-input">
          <option value="">— None —</option>
          ${Object.values(GAME_SYSTEMS).map(s => `<option value="${s.id}" ${item?.gameSystemId === s.id ? 'selected' : ''}>${s.shortLabel}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>For (optional)</label>
        <input id="wishForWhom" type="text" class="form-input" placeholder="Yourself" value="${item?.forWhom || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Army (optional)</label>
      <select id="wishCollection" class="form-input">
        <option value="">— None —</option>
        ${collections.map(c => `<option value="${c.id}" ${item?.collectionId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Note (optional)</label>
      <textarea id="wishNote" class="form-input" rows="2">${item?.note || ''}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="wishSave">${editId ? 'Update' : 'Add'} to Wishlist</button>
      <button class="btn" id="wishCancel">Cancel</button>
    </div>
  `;

  body.querySelector('#qmWishFormBack').addEventListener('click', () => renderWishlist(body, container));
  body.querySelector('#wishCancel').addEventListener('click', () => renderWishlist(body, container));

  body.querySelector('#wishSave').addEventListener('click', () => {
    const name = body.querySelector('#wishName').value.trim();
    if (!name) { toast('Please enter a name', 'error'); return; }
    const fields = {
      name,
      worth: parseFloat(body.querySelector('#wishWorth').value) || 0,
      itemType: body.querySelector('#wishItemType').value || 'model',
      gameSystemId: body.querySelector('#wishGameSystem').value || null,
      forWhom: body.querySelector('#wishForWhom').value.trim(),
      collectionId: body.querySelector('#wishCollection').value || null,
      note: body.querySelector('#wishNote').value.trim()
    };
    if (editId) updateWishlistItem(editId, fields);
    else createWishlistItem(fields);
    renderWishlist(body, container);
  });
}

// --- Projections tab ---
// Two views sharing the tab body: a list of projections, and a detail view
// for whichever one is open (tracked by activeProjectionId, module-level so
// it survives re-renders triggered by other tabs' clicks).

function renderProjectionsTab(body, container) {
  if (activeProjectionId && appData.projections[activeProjectionId]) {
    renderProjectionDetail(body, container, activeProjectionId);
  } else {
    activeProjectionId = null;
    renderProjectionsList(body, container);
  }
}

function renderProjectionsList(body, container) {
  const projections = Object.values(appData.projections)
    .sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Projections</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm btn-primary" id="qmProjImportBtn">📋 Import List</button>
        <button class="btn btn-sm" id="qmProjBlankBtn">+ Blank</button>
      </div>
    </div>
    ${projections.length === 0 ? `
      <div class="empty-state">
        <p>No projections yet.</p>
        <p style="font-size:0.85em;color:var(--text-muted)">Import an army list to check off what you already own, price the rest, and get a buy/skip verdict before you spend a penny.</p>
      </div>
    ` : `
      <div class="queue-entries">
        ${projections.map(p => projectionCard(p)).join('')}
      </div>
    `}
  `;

  body.querySelector('#qmProjImportBtn').addEventListener('click', () => renderProjectionImportForm(body, container));
  body.querySelector('#qmProjBlankBtn').addEventListener('click', () => {
    const name = prompt('Projection name:');
    if (!name?.trim()) return;
    activeProjectionId = createProjection({ name: name.trim() });
    renderProjectionsTab(body, container);
  });

  body.querySelectorAll('[data-proj-open]').forEach(el => {
    el.addEventListener('click', () => {
      activeProjectionId = el.dataset.projOpen;
      renderProjectionsTab(body, container);
    });
  });
  body.querySelectorAll('[data-proj-delete]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const proj = appData.projections[btn.dataset.projDelete];
      if (!proj || !confirm(`Delete projection "${proj.name}"?`)) return;
      deleteProjection(proj.id);
      renderProjectionsList(body, container);
    });
  });
}

function projectionCard(p) {
  const sys = p.gameSystemId ? GAME_SYSTEMS[p.gameSystemId] : null;
  const a = p.units.length ? projectionAnalysis(p) : null;
  return `
    <div class="queue-entry qm-proj-card" data-proj-open="${p.id}">
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <div class="queue-entry-name">${p.name}</div>
          ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
          ${a ? `<span class="qm-verdict-pill ${verdictClass(a.verdict)}">${a.verdictIcon} ${a.verdictLabel}</span>` : ''}
        </div>
        ${a && !a.nothingToBuy ? `<div class="queue-entry-note">£${a.totalCost.toFixed(0)} to acquire · ${a.hobbyPointsAdded} hobby pts added${a.costPerPoint !== null ? ` · £${a.costPerPoint.toFixed(2)}/pt` : ''}</div>` : ''}
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-danger" data-proj-delete="${p.id}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function ratingRow(field, label, value) {
  return `
    <div class="qm-rating-row" data-rating-field="${field}">
      <span class="qm-rating-label">${label}</span>
      <span class="qm-rating-stars">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="qm-star-btn ${n <= value ? 'filled' : ''}" data-star="${n}">★</button>`).join('')}
      </span>
      <span class="qm-rating-value">${value}/5</span>
    </div>
  `;
}

function projectionUnitRow(u, proj) {
  const pts = unitHobbyPoints(u);
  const bundle = (proj.bundles || []).find(b => b.unitIds.includes(u.id));
  const types = getAllModelTypes();
  return `
    <div class="queue-entry ${u.owned ? 'qm-unit-owned' : ''}" data-unit-id="${u.id}">
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <label class="qm-owned-check">
            <input type="checkbox" data-unit-owned="${u.id}" ${u.owned ? 'checked' : ''}> Owned
          </label>
          <span class="queue-entry-name">${u.name} <span class="queue-entry-qty">×${u.quantity}</span></span>
          <select class="form-input qm-unit-type" data-unit-type="${u.id}">
            <option value="">— Generic —</option>
            ${types.map(t => `<option value="${t.id}" ${u.modelTypeId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
          ${bundle ? `<span class="qm-bundle-tag">🎁 ${bundle.name}</span>` : ''}
        </div>
        <div class="queue-entry-note">
          ${u.owned
            ? `Already secured — not counted in cost or points added.`
            : `£<input type="number" class="form-input qm-unit-worth" data-unit-worth="${u.id}" min="0" step="0.01" value="${u.worth || 0}"> for ${pts} hobby pt${pts !== 1 ? 's' : ''}${bundle ? ` <em>— individual price, for bundle savings only; ${bundle.name}'s own price is what counts</em>` : ''}`
          }
        </div>
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-danger" data-unit-delete="${u.id}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function projectionBundleRow(proj, bundle) {
  const members = bundle.unitIds.map(id => proj.units.find(u => u.id === id)).filter(Boolean);
  const individualTotal = members.reduce((sum, u) => sum + (u.worth || 0), 0);
  const savings = individualTotal - (bundle.price || 0);
  return `
    <div class="queue-entry" data-bundle-id="${bundle.id}">
      <div class="queue-entry-main">
        <div class="queue-entry-info">
          <span class="queue-entry-name">🎁 ${bundle.name}</span>
          <span class="queue-entry-qty">£<input type="number" class="form-input qm-unit-worth" data-bundle-price="${bundle.id}" min="0" step="0.01" value="${bundle.price || 0}"></span>
        </div>
        <div class="queue-entry-note">${members.map(m => `${m.name} ×${m.quantity}`).join(', ') || '(no units assigned)'}</div>
        ${individualTotal > 0 ? `
          <div class="queue-entry-note">
            ${savings > 0 ? `💰 Saves £${savings.toFixed(0)} vs £${individualTotal.toFixed(0)} bought separately`
              : savings < 0 ? `⚠️ £${Math.abs(savings).toFixed(0)} more than buying those units separately`
              : 'Same total as buying those units separately'}
          </div>
        ` : ''}
        <div class="queue-entry-actions">
          <button class="btn btn-sm btn-danger" data-bundle-delete="${bundle.id}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function renderProjectionAnalysisBlock(body, proj) {
  const el = body.querySelector('#qmProjAnalysis');
  if (!el) return;
  if (!proj.units.length) {
    el.innerHTML = `<p class="empty-text">Add units to see a cost-benefit analysis.</p>`;
    return;
  }
  const a = projectionAnalysis(proj);
  el.innerHTML = `
    <div class="dash-card">
      <h3>Cost-Benefit Analysis</h3>
      ${a.nothingToBuy ? `
        <p class="empty-text">You already own everything on this list — nothing left to weigh up.</p>
      ` : `
        <div class="qm-verdict-banner ${verdictClass(a.verdict)}">
          <span class="qm-verdict-icon">${a.verdictIcon}</span>
          <span class="qm-verdict-text">${a.verdictLabel}</span>
          <span class="qm-verdict-score">${a.finalScore.toFixed(1)}/10</span>
        </div>
        <div class="pile-items">
          <div class="pile-item"><span class="pile-item-name">Cost to acquire</span><span class="pile-item-qty">£${a.totalCost.toFixed(0)}</span></div>
          <div class="pile-item"><span class="pile-item-name">Hobby points added</span><span class="pile-item-qty">${a.hobbyPointsAdded}</span></div>
          ${a.costPerPoint !== null ? `<div class="pile-item"><span class="pile-item-name">Cost per hobby point</span><span class="pile-item-qty">£${a.costPerPoint.toFixed(2)}</span></div>` : ''}
          ${a.activeBundles.length > 0 && a.bundleSavings !== 0 ? `<div class="pile-item"><span class="pile-item-name">Bundle savings</span><span class="pile-item-qty">${a.bundleSavings > 0 ? `£${a.bundleSavings.toFixed(0)} saved` : `£${Math.abs(a.bundleSavings).toFixed(0)} more`}</span></div>` : ''}
        </div>
        ${a.budgetWarning ? `<p class="form-hint" style="color:var(--danger)">${a.budgetWarning}</p>` : ''}
        <div class="qm-working">
          <div class="qm-working-title">Show your working</div>
          <ul class="qm-working-list">
            ${a.workingLines.map(l => `<li>${l}</li>`).join('')}
          </ul>
        </div>
      `}
    </div>
  `;
}

function renderProjectionDetail(body, container, projId) {
  const proj = appData.projections[projId];
  if (!proj) { activeProjectionId = null; renderProjectionsList(body, container); return; }

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">${proj.name}</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm" id="qmProjBack">← Back</button>
        <button class="btn btn-sm" id="qmProjShareBtn">📤 Share</button>
        <button class="btn btn-sm btn-danger" id="qmProjDeleteBtn">✕ Delete</button>
      </div>
    </div>
    <div class="form-row-two">
      <div class="form-group">
        <label>Name</label>
        <input id="qmProjName" type="text" class="form-input" value="${proj.name}">
      </div>
      <div class="form-group">
        <label>Game System</label>
        <select id="qmProjSystem" class="form-input">
          <option value="">— None —</option>
          ${Object.values(GAME_SYSTEMS).map(s => `<option value="${s.id}" ${proj.gameSystemId === s.id ? 'selected' : ''}>${s.shortLabel}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="queue-header" style="margin-top:1em">
      <h2 class="queue-name" style="font-size:1em">Units</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm btn-primary" id="qmProjAddUnitBtn">+ Add Item</button>
      </div>
    </div>
    ${proj.units.length === 0 ? `
      <div class="empty-state">
        <p>No units yet — add items manually, or import a list from the Projections tab.</p>
      </div>
    ` : `
      <div class="queue-entries">
        ${proj.units.map(u => projectionUnitRow(u, proj)).join('')}
      </div>
    `}
    <div id="qmProjAddUnitForm"></div>

    <div class="queue-header" style="margin-top:1em">
      <h2 class="queue-name" style="font-size:1em">Bundles</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm" id="qmProjAddBundleBtn">+ Add Bundle</button>
      </div>
    </div>
    <p class="form-hint">Group units bought together at a box-set price — a Combat Patrol, for example — instead of paying for them one by one.</p>
    ${(proj.bundles || []).length === 0 ? '' : `
      <div class="queue-entries">
        ${proj.bundles.map(b => projectionBundleRow(proj, b)).join('')}
      </div>
    `}
    <div id="qmProjAddBundleForm"></div>

    <div class="dash-card" style="margin-top:1em">
      <h3>Ratings</h3>
      ${ratingRow('personal', 'Personal', proj.ratings?.personal || 0)}
      ${ratingRow('thematic', 'Thematic', proj.ratings?.thematic || 0)}
      ${ratingRow('power', 'Power', proj.ratings?.power || 0)}
    </div>

    <div class="form-group" style="margin-top:0.75em">
      <label>Notes (optional)</label>
      <textarea id="qmProjNotes" class="form-input" rows="2">${proj.notes || ''}</textarea>
    </div>

    <div id="qmProjAnalysis" style="margin-top:1em"></div>
  `;

  renderProjectionAnalysisBlock(body, proj);

  body.querySelector('#qmProjBack').addEventListener('click', () => {
    activeProjectionId = null;
    renderProjectionsList(body, container);
  });
  body.querySelector('#qmProjDeleteBtn').addEventListener('click', () => {
    if (!confirm(`Delete projection "${proj.name}"?`)) return;
    deleteProjection(proj.id);
    activeProjectionId = null;
    renderProjectionsList(body, container);
  });
  body.querySelector('#qmProjShareBtn').addEventListener('click', () => shareProjection(body, container, proj));

  body.querySelector('#qmProjName').addEventListener('change', e => {
    updateProjection(proj.id, { name: e.target.value.trim() || proj.name });
    renderProjectionDetail(body, container, proj.id);
  });
  body.querySelector('#qmProjSystem').addEventListener('change', e => {
    updateProjection(proj.id, { gameSystemId: e.target.value || null });
    renderProjectionDetail(body, container, proj.id);
  });
  body.querySelector('#qmProjNotes').addEventListener('change', e => {
    updateProjection(proj.id, { notes: e.target.value });
  });

  body.querySelectorAll('[data-unit-owned]').forEach(cb => {
    cb.addEventListener('change', e => {
      updateProjectionUnit(proj.id, cb.dataset.unitOwned, { owned: e.target.checked });
      renderProjectionDetail(body, container, proj.id);
    });
  });
  body.querySelectorAll('[data-unit-worth]').forEach(inp => {
    inp.addEventListener('input', e => {
      updateProjectionUnit(proj.id, inp.dataset.unitWorth, { worth: parseFloat(e.target.value) || 0 });
      renderProjectionAnalysisBlock(body, appData.projections[proj.id]);
    });
  });
  body.querySelectorAll('[data-unit-type]').forEach(sel => {
    sel.addEventListener('change', e => {
      updateProjectionUnit(proj.id, sel.dataset.unitType, { modelTypeId: e.target.value || null });
      renderProjectionDetail(body, container, proj.id);
    });
  });
  body.querySelectorAll('[data-unit-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteProjectionUnit(proj.id, btn.dataset.unitDelete);
      renderProjectionDetail(body, container, proj.id);
    });
  });

  body.querySelector('#qmProjAddUnitBtn').addEventListener('click', () => renderProjectionAddUnitForm(body, container, proj.id));

  body.querySelectorAll('[data-bundle-price]').forEach(inp => {
    inp.addEventListener('input', e => {
      updateProjectionBundle(proj.id, inp.dataset.bundlePrice, { price: parseFloat(e.target.value) || 0 });
      renderProjectionAnalysisBlock(body, appData.projections[proj.id]);
    });
  });
  body.querySelectorAll('[data-bundle-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteProjectionBundle(proj.id, btn.dataset.bundleDelete);
      renderProjectionDetail(body, container, proj.id);
    });
  });
  body.querySelector('#qmProjAddBundleBtn').addEventListener('click', () => renderProjectionAddBundleForm(body, container, proj.id));

  body.querySelectorAll('.qm-star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.closest('[data-rating-field]').dataset.ratingField;
      const ratings = { ...(proj.ratings || {}), [field]: parseInt(btn.dataset.star, 10) };
      updateProjection(proj.id, { ratings });
      renderProjectionDetail(body, container, proj.id);
    });
  });
}

// Inline "add item" mini-form, appended below the unit list rather than
// swapping the whole body — keeps the rest of the projection in view while
// adding several manual items in a row.
function renderProjectionAddUnitForm(body, container, projId) {
  const formEl = body.querySelector('#qmProjAddUnitForm');
  const types = getAllModelTypes();
  formEl.innerHTML = `
    <div class="dash-card" style="margin-top:0.5em">
      <div class="form-group">
        <label>Name</label>
        <input id="qmUnitName" type="text" class="form-input" placeholder="Unit name">
      </div>
      <div class="form-row-two">
        <div class="form-group">
          <label>Quantity</label>
          <input id="qmUnitQty" type="number" class="form-input" min="1" step="1" value="1">
        </div>
        <div class="form-group">
          <label>Model Type</label>
          <select id="qmUnitType" class="form-input">
            <option value="">— Generic —</option>
            ${types.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-two">
        <div class="form-group">
          <label>Already owned?</label>
          <select id="qmUnitOwned" class="form-input">
            <option value="0">No — need to buy</option>
            <option value="1">Yes — already have it</option>
          </select>
        </div>
        <div class="form-group">
          <label>Worth (£)</label>
          <input id="qmUnitWorth" type="number" class="form-input" min="0" step="0.01" value="0">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="qmUnitAddSave">Add</button>
        <button class="btn" id="qmUnitAddCancel">Cancel</button>
      </div>
    </div>
  `;
  formEl.querySelector('#qmUnitAddCancel').addEventListener('click', () => { formEl.innerHTML = ''; });
  formEl.querySelector('#qmUnitAddSave').addEventListener('click', () => {
    const name = formEl.querySelector('#qmUnitName').value.trim();
    if (!name) { toast('Please enter a name', 'error'); return; }
    addProjectionUnit(projId, {
      name,
      quantity: parseInt(formEl.querySelector('#qmUnitQty').value, 10) || 1,
      modelTypeId: formEl.querySelector('#qmUnitType').value || null,
      owned: formEl.querySelector('#qmUnitOwned').value === '1',
      worth: parseFloat(formEl.querySelector('#qmUnitWorth').value) || 0
    });
    renderProjectionDetail(body, container, projId);
  });
}

// Inline "add bundle" mini-form — pick ≥2 units not already in another
// bundle and give the set a single box price. Appended below the bundle
// list, same pattern as the add-item form above.
function renderProjectionAddBundleForm(body, container, projId) {
  const proj = appData.projections[projId];
  const formEl = body.querySelector('#qmProjAddBundleForm');
  const bundledIds = new Set((proj.bundles || []).flatMap(b => b.unitIds));
  const available = proj.units.filter(u => !bundledIds.has(u.id));

  formEl.innerHTML = `
    <div class="dash-card" style="margin-top:0.5em">
      <div class="form-group">
        <label>Bundle Name</label>
        <input id="qmBundleName" type="text" class="form-input" placeholder="e.g. Combat Patrol">
      </div>
      <div class="form-group">
        <label>Bundle Price (£)</label>
        <input id="qmBundlePrice" type="number" class="form-input" min="0" step="0.01" value="0">
      </div>
      <div class="form-group">
        <label>Units in this bundle</label>
        ${available.length === 0 ? `<p class="empty-text">Every unit is already in a bundle.</p>` : `
          <div class="qm-bundle-picker">
            ${available.map(u => `
              <label class="qm-owned-check">
                <input type="checkbox" class="qm-bundle-unit-cb" value="${u.id}"> ${u.name} ×${u.quantity}${u.owned ? ' (owned)' : ''}
              </label>
            `).join('')}
          </div>
        `}
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="qmBundleAddSave">Add Bundle</button>
        <button class="btn" id="qmBundleAddCancel">Cancel</button>
      </div>
    </div>
  `;
  formEl.querySelector('#qmBundleAddCancel').addEventListener('click', () => { formEl.innerHTML = ''; });
  formEl.querySelector('#qmBundleAddSave')?.addEventListener('click', () => {
    const name = formEl.querySelector('#qmBundleName').value.trim();
    if (!name) { toast('Please name the bundle', 'error'); return; }
    const unitIds = [...formEl.querySelectorAll('.qm-bundle-unit-cb:checked')].map(cb => cb.value);
    if (unitIds.length < 2) { toast('Pick at least 2 units to bundle together', 'error'); return; }
    addProjectionBundle(projId, {
      name,
      price: parseFloat(formEl.querySelector('#qmBundlePrice').value) || 0,
      unitIds
    });
    renderProjectionDetail(body, container, projId);
  });
}

const PROJECTION_IMPORT_FORMATS = {
  owb: {
    label: 'Old World Builder',
    placeholder: `===\nClan Eshin [748 pts]\nWarhammer: The Old World, Skaven...\n===\n\n++ Characters [166 pts] ++\n\nSkaven Chieftain [51 pts]\n...`,
    parse: parseOwbList
  },
  w40k: {
    label: 'Warhammer 40,000',
    placeholder: `Niddos (1500 points)\n\nTyranids\nStrike Force (2000 points)\nInvasion Fleet\n\nCHARACTERS\n\nNeurotyrant (125 points)\n  • 1x Neurotyrant claws and lashes\n\nBATTLELINE\n\nHormagaunts (65 points)\n  • 10x Hormagaunt`,
    parse: parseW40kList
  }
};

function autoDetectProjectionFormat(text) {
  if (/created with [""]old world builder[""]/i.test(text) || /old-world-builder\.com/i.test(text)) return 'owb';
  if (/exported with app version:/i.test(text)) return 'w40k';
  if (/^===/.test(text.trim()) || /\[\d+\s*pts?\]/.test(text)) return 'owb';
  if (/\(\d+\s*points?\)/i.test(text)) return 'w40k';
  return null;
}

// Rendered inline in the office body, not a nested showModal — the office
// itself is already inside one modal, and this app's modal system only
// tracks a single overlay at a time.
function renderProjectionImportForm(body, container) {
  let currentFormat = 'owb';

  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Import Army List</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm" id="qmProjImportBack">← Back</button>
      </div>
    </div>
    <p class="form-hint" style="margin-bottom:0.75em">Paste an army list to build a projection. Nothing is added to your pile — this is purely for evaluating a potential purchase.</p>
    <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:0.9em">
      <button type="button" class="import-fmt-btn" data-fmt="owb" style="flex:1;padding:0.45em 0.5em;font-size:0.82em;font-weight:600;border:none;cursor:pointer;transition:background 0.15s,color 0.15s">Old World Builder</button>
      <button type="button" class="import-fmt-btn" data-fmt="w40k" style="flex:1;padding:0.45em 0.5em;font-size:0.82em;font-weight:600;border:none;cursor:pointer;transition:background 0.15s,color 0.15s;border-left:1px solid var(--border)">Warhammer 40,000</button>
    </div>
    <textarea id="qmProjImportArea" class="form-input" rows="10" style="font-family:monospace;font-size:0.8em"></textarea>
    <div id="qmProjImportPreview" style="margin-top:0.75em;display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="qmProjImportDoBtn">Create Projection</button>
      <button class="btn" id="qmProjImportCancelBtn">Cancel</button>
    </div>
  `;

  const textarea = body.querySelector('#qmProjImportArea');
  const preview = body.querySelector('#qmProjImportPreview');

  function applyFormat(fmt) {
    currentFormat = fmt;
    const fmtData = PROJECTION_IMPORT_FORMATS[fmt];
    textarea.placeholder = fmtData.placeholder;
    body.querySelectorAll('.import-fmt-btn').forEach(btn => {
      const active = btn.dataset.fmt === fmt;
      btn.style.background = active ? 'var(--accent)' : 'transparent';
      btn.style.color = active ? '#fff' : 'var(--text)';
    });
    updatePreview();
  }

  function updatePreview() {
    const text = textarea.value.trim();
    if (!text) { preview.style.display = 'none'; return; }
    try {
      const { armyName, gameSystemId, units } = PROJECTION_IMPORT_FORMATS[currentFormat].parse(text);
      if (!units.length) { preview.style.display = 'none'; return; }
      const sys = GAME_SYSTEMS[gameSystemId];
      preview.innerHTML = `
        <div style="font-size:0.82em;color:var(--text-muted)">
          Preview — <strong style="color:var(--text)">${armyName}</strong>
          &nbsp;<span class="sys-tag ${sys?.theme || ''}">${sys?.shortLabel || gameSystemId}</span>
          &nbsp;· ${units.length} unit${units.length !== 1 ? 's' : ''}
        </div>
      `;
      preview.style.display = '';
    } catch {
      preview.style.display = 'none';
    }
  }

  body.querySelectorAll('.import-fmt-btn').forEach(btn => btn.addEventListener('click', () => applyFormat(btn.dataset.fmt)));
  textarea.addEventListener('input', () => {
    const detected = autoDetectProjectionFormat(textarea.value);
    if (detected && detected !== currentFormat) applyFormat(detected);
    else updatePreview();
  });

  body.querySelector('#qmProjImportBack').addEventListener('click', () => renderProjectionsList(body, container));
  body.querySelector('#qmProjImportCancelBtn').addEventListener('click', () => renderProjectionsList(body, container));

  body.querySelector('#qmProjImportDoBtn').addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) { toast('Paste an army list first', 'error'); return; }
    const { armyName, gameSystemId, units } = PROJECTION_IMPORT_FORMATS[currentFormat].parse(text);
    if (!units.length) { toast('No units found — check the list format and selected format type', 'error'); return; }
    const projId = createProjection({
      name: armyName,
      gameSystemId,
      units: units.map(u => ({ name: u.name, quantity: u.quantity, modelTypeId: u.modelTypeId, owned: false, worth: 0 }))
    });
    toast(`Projection "${armyName}" created — ${units.length} unit${units.length !== 1 ? 's' : ''}`, 'success');
    activeProjectionId = projId;
    renderProjectionsTab(body, container);
  });

  applyFormat('owb');
}

// Shares via the OS share sheet or clipboard where available; the fallback
// is an inline read-only view (not a nested showModal — see note above).
function shareProjection(body, container, proj) {
  const text = buildProjectionShareText(proj);
  if (navigator.share) {
    navigator.share({ title: proj.name, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text)
      .then(() => toast('Copied to clipboard!', 'success'))
      .catch(() => renderProjectionShareFallback(body, container, proj, text));
  }
}

function buildProjectionShareText(proj) {
  const sys = proj.gameSystemId ? GAME_SYSTEMS[proj.gameSystemId] : null;
  const a = proj.units.length ? projectionAnalysis(proj) : null;

  const unitLines = proj.units.map(u => {
    const pts = unitHobbyPoints(u);
    const bundle = (proj.bundles || []).find(b => b.unitIds.includes(u.id));
    const bundleTag = bundle ? ` [🎁 ${bundle.name}]` : '';
    return u.owned
      ? `✅ ${u.name} ×${u.quantity} — already owned`
      : `⬜ ${u.name} ×${u.quantity}${bundleTag} — £${(u.worth || 0).toFixed(0)}, ${pts} pt${pts !== 1 ? 's' : ''}`;
  }).join('\n');

  const lines = [
    `🎖️ Projection: ${proj.name}${sys ? ` (${sys.shortLabel})` : ''}`,
    `${'━'.repeat(Math.min(proj.name.length + 14, 32))}`,
    ``,
    `📋 Units:`,
    unitLines || '  (none)',
  ];

  if (a && !a.nothingToBuy) {
    lines.push(
      ``,
      `💰 Cost to acquire: £${a.totalCost.toFixed(0)}`,
      `⭐ Hobby points added: ${a.hobbyPointsAdded}`,
      a.costPerPoint !== null ? `📐 £${a.costPerPoint.toFixed(2)}/hobby point` : undefined,
      ``,
      `❤️ Personal ${a.ratings.personal}/5 · 🎭 Thematic ${a.ratings.thematic}/5 · ⚔️ Power ${a.ratings.power}/5`,
      ``,
      `${a.verdictIcon} Verdict: ${a.verdictLabel} (${a.finalScore.toFixed(1)}/10)`,
      ``,
      `Working:`,
      ...a.workingLines.map(l => `• ${l}`)
    );
  } else if (a?.nothingToBuy) {
    lines.push(``, `✅ Already own everything on this list.`);
  }
  if (proj.notes) lines.push(``, `📝 ${proj.notes}`);

  return lines.filter(l => l !== undefined).join('\n').trim();
}

function renderProjectionShareFallback(body, container, proj, text) {
  body.innerHTML = `
    <div class="queue-header">
      <h2 class="queue-name">Share Projection</h2>
      <div class="queue-header-actions">
        <button class="btn btn-sm" id="qmProjShareBack">← Back</button>
      </div>
    </div>
    <p class="form-hint" style="margin-bottom:0.75em">Copy the text below and share it however you like:</p>
    <textarea class="form-input share-text-area" readonly rows="18">${text}</textarea>
    <div class="modal-actions">
      <button class="btn btn-primary" id="qmProjShareCopyBtn">📋 Copy</button>
    </div>
  `;
  body.querySelector('#qmProjShareCopyBtn').addEventListener('click', () => {
    body.querySelector('.share-text-area').select();
    document.execCommand('copy');
    toast('Copied!', 'success');
  });
  body.querySelector('#qmProjShareBack').addEventListener('click', () => renderProjectionDetail(body, container, proj.id));
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
