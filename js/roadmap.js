// roadmap.js — roadmap tab: pick which army lists are active "campaigns"
// vs. everything else sitting quietly in the backlog

import {
  appData, GAME_SYSTEMS, listStats, modelPoints, modelThreshold,
  getRoadmapLists, addListToRoadmap, removeListFromRoadmap, moveRoadmapList,
  addCampaignSprint, getCampaignSprints
} from './data.js';
import { toast, progressBar, thresholdBadge, formatDate, daysUntil, today, addDays } from './ui.js';
import { selectCollection, selectList } from './collections.js';
import { showModelDetail } from './models.js';
import { showListBurndown } from './dashboard.js';
import { projectedFinishDate, paceRate } from './charts.js';
import { createSprint, addManyToSprint, setSprintDates, focusSprint, sprintCapacityStats } from './sprint.js';

// Default length for a campaign's auto-planned sprints — short and time-boxed,
// same idea as a software sprint, rather than one sprint spanning the whole
// campaign with every remaining model dumped into it.
const SPRINT_SPAN_DAYS = 14;

// List ids whose finished models are currently expanded (collapsed by default).
const _showFinishedFor = new Set();

export function renderRoadmap(containerId = 'roadmapView') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const allLists = Object.values(appData.lists);

  if (!allLists.length) {
    container.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-title">🗺️ Roadmap</div>
        <p class="onboarding-desc">The Roadmap is where you flag which army lists are active right now. Everything else settles quietly into the Model Pool's backlog, so it stops feeling overwhelming.</p>
        <div class="onboarding-steps">
          <div class="onboarding-step">
            <span class="step-num">1</span>
            <div>
              <b>Create an Army List</b>
              <p>Head to the Armies tab and set up a game system + list first.</p>
            </div>
          </div>
          <div class="onboarding-step">
            <span class="step-num">2</span>
            <div>
              <b>Add it to the Roadmap</b>
              <p>Come back here and mark it active to track its remaining work right here.</p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary onboarding-cta" id="roadmapGoArmies">🛡️ Go to Armies</button>
      </div>`;
    container.querySelector('#roadmapGoArmies')?.addEventListener('click', () => {
      document.querySelector('.nav-tab[data-tab="collections"]')?.click();
    });
    return;
  }

  const roadmapLists = getRoadmapLists();
  const availableLists = allLists.filter(l => !l.onRoadmap);

  container.innerHTML = `
    <div class="panel-header">
      <h2>🗺️ Roadmap</h2>
    </div>
    <p class="roadmap-intro">Campaigns below are your active, in-focus work — everything else can wait.</p>
    ${roadmapLists.length ? `
      <div class="roadmap-campaigns">
        ${roadmapLists.map((list, idx) => campaignCard(list, idx, roadmapLists.length)).join('')}
      </div>
    ` : `
      <div class="empty-state">
        <p>No campaigns on your roadmap yet.</p>
        <p style="font-size:0.85em;color:var(--text-muted)">Add an army list below to mark it active.</p>
      </div>
    `}
    <div class="roadmap-add-section">
      <h3>Add to Roadmap</h3>
      ${availableLists.length ? `
        <div class="roadmap-available-list">
          ${availableLists.map(availableListRow).join('')}
        </div>
      ` : `<p class="form-hint">All your army lists are already on the roadmap.</p>`}
    </div>
  `;

  container.querySelectorAll('[data-roadmap-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      moveRoadmapList(btn.dataset.roadmapUp, 'up');
      renderRoadmap(containerId);
    });
  });
  container.querySelectorAll('[data-roadmap-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      moveRoadmapList(btn.dataset.roadmapDown, 'down');
      renderRoadmap(containerId);
    });
  });
  container.querySelectorAll('[data-roadmap-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeListFromRoadmap(btn.dataset.roadmapRemove);
      toast('Moved back to backlog', 'info');
      renderRoadmap(containerId);
    });
  });
  container.querySelectorAll('[data-roadmap-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      addListToRoadmap(btn.dataset.roadmapAdd);
      toast('Added to roadmap!', 'success');
      renderRoadmap(containerId);
    });
  });
  container.querySelectorAll('[data-roadmap-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = appData.lists[btn.dataset.roadmapOpen];
      if (!list) return;
      document.querySelector('.nav-tab[data-tab="collections"]')?.click();
      selectCollection(list.collectionId);
      selectList(list.id);
    });
  });
  container.querySelectorAll('[data-roadmap-finished-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.dataset.roadmapFinishedToggle;
      if (_showFinishedFor.has(listId)) _showFinishedFor.delete(listId);
      else _showFinishedFor.add(listId);
      renderRoadmap(containerId);
    });
  });
  container.querySelectorAll('[data-roadmap-model-view]').forEach(el => {
    el.addEventListener('click', () => showModelDetail(el.dataset.roadmapModelView));
  });
  container.querySelectorAll('[data-roadmap-burndown]').forEach(btn => {
    btn.addEventListener('click', () => showListBurndown(btn.dataset.roadmapBurndown));
  });
  container.querySelectorAll('[data-roadmap-goto-sprint]').forEach(btn => {
    btn.addEventListener('click', () => {
      focusSprint(btn.dataset.roadmapGotoSprint);
      document.querySelector('.nav-tab[data-tab="sprints"]')?.click();
    });
  });
  container.querySelectorAll('[data-roadmap-plan-sprint]').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = appData.lists[btn.dataset.roadmapPlanSprint];
      if (!list) return;

      const campaignSprints = getCampaignSprints(list);
      const alreadyPlanned = new Set(campaignSprints.flatMap(s => s.entries.map(e => e.modelId)));
      const unplanned = (list.modelIds || [])
        .map(id => appData.models[id])
        .filter(m => m && modelThreshold(m) !== 'finished' && !alreadyPlanned.has(m.id));

      if (!unplanned.length) {
        toast('Everything in this campaign is already in a sprint', 'info');
        return;
      }

      // Size the sprint to what actually fits ~2 weeks at your current pace,
      // rather than dumping the whole campaign in — pick models off the top
      // of the list until the next one would blow the budget (but always
      // include at least one, even if it alone exceeds it).
      const rate = paceRate();
      const chosen = [];
      if (rate > 0) {
        const capacityPts = rate * SPRINT_SPAN_DAYS;
        let used = 0;
        for (const m of unplanned) {
          const remaining = modelPoints(m).total - modelPoints(m).done;
          if (chosen.length && used + remaining > capacityPts) break;
          chosen.push(m);
          used += remaining;
        }
      } else {
        chosen.push(unplanned[0]);
      }

      // Sequence after the campaign's latest existing sprint rather than
      // always starting today — otherwise "Plan Next Sprint" just overlaps
      // the one before it instead of queuing up behind it.
      const latestEnd = campaignSprints.reduce((max, s) =>
        (s.endDate && (!max || s.endDate > max)) ? s.endDate : max, null);
      const earliestStart = latestEnd ? addDays(latestEnd, 1) : today();
      const startDate = earliestStart > today() ? earliestStart : today();
      const endDate = addDays(startDate, SPRINT_SPAN_DAYS - 1);

      const sprintNum = campaignSprints.length + 1;
      const sprintId = createSprint(`${list.name} — Sprint ${sprintNum}`);
      addManyToSprint(sprintId, chosen.map(m => m.id));
      setSprintDates(sprintId, startDate, endDate);
      addCampaignSprint(list.id, sprintId);

      toast(rate > 0
        ? `Sprint ${sprintNum} created with ${chosen.length} model${chosen.length !== 1 ? 's' : ''} sized to your pace!`
        : `Sprint ${sprintNum} created — no pace data yet, so just the next model was added.`,
        'success');
      focusSprint(sprintId);
      document.querySelector('.nav-tab[data-tab="sprints"]')?.click();
    });
  });
}

function campaignCard(list, idx, total) {
  const col = appData.collections[list.collectionId];
  const sys = col ? GAME_SYSTEMS[col.gameSystemId] : null;
  const stats = listStats(list);

  let deadlineHtml = '';
  if (list.deadline) {
    const days = daysUntil(list.deadline);
    const dateStr = formatDate(list.deadline, { day: 'numeric', month: 'short', year: 'numeric' });
    const daysStr = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'due today' : `${days} days to go`;
    deadlineHtml = `<span class="roadmap-deadline">🎯 ${dateStr} · ${daysStr}</span>`;
  }

  const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);
  const activeModels = models.filter(m => modelThreshold(m) !== 'finished');
  const finishedModels = models.filter(m => modelThreshold(m) === 'finished');
  const showFinished = _showFinishedFor.has(list.id);

  const remainingPts = stats.totalPts - stats.donePts;
  let paceHtml = '';
  if (stats.total > 0 && remainingPts <= 0) {
    paceHtml = `<span class="roadmap-pace pace-done">✅ Complete</span>`;
  } else if (remainingPts > 0) {
    const proj = projectedFinishDate(remainingPts);
    paceHtml = proj.date
      ? `<span class="roadmap-pace">⏱️ At current pace, finishes ~${formatDate(proj.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>`
      : `<span class="roadmap-pace roadmap-pace-unknown">⏱️ No pace data yet</span>`;
  }

  const campaignSprints = getCampaignSprints(list);
  const plannedIds = new Set(campaignSprints.flatMap(s => s.entries.map(e => e.modelId)));
  const unplannedCount = activeModels.filter(m => !plannedIds.has(m.id)).length;

  const sprintChipsHtml = campaignSprints.length ? `
    <div class="roadmap-campaign-sprints">
      ${campaignSprints.map(s => {
        const cap = sprintCapacityStats(s);
        return `<button class="btn btn-xs roadmap-sprint-chip status-${cap?.status || 'unknown'}" data-roadmap-goto-sprint="${s.id}">📋 ${s.name}</button>`;
      }).join('')}
    </div>
  ` : '';

  return `
    <div class="roadmap-campaign-card" data-list-id="${list.id}">
      <div class="roadmap-campaign-header">
        <span class="roadmap-campaign-name">${list.name}</span>
        ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
        ${deadlineHtml}
      </div>
      ${progressBar(stats.pct)}
      <div class="threshold-row">
        <span class="thresh-item">⚔️ ${stats.tableReady}/${stats.total}</span>
        <span class="thresh-item">🎨 ${stats.painted}/${stats.total}</span>
        <span class="thresh-item">🏆 ${stats.finished}/${stats.total}</span>
      </div>
      ${paceHtml ? `<div class="roadmap-pace-row">${paceHtml}</div>` : ''}
      <div class="roadmap-campaign-actions">
        <div class="roadmap-move-btns">
          <button class="btn btn-sm" data-roadmap-up="${list.id}" title="Move up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-sm" data-roadmap-down="${list.id}" title="Move down" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
        </div>
        <button class="btn btn-sm" data-roadmap-open="${list.id}">🛡️ Open</button>
        <button class="btn btn-sm" data-roadmap-burndown="${list.id}">📈 Burndown</button>
        ${unplannedCount > 0
          ? `<button class="btn btn-sm" data-roadmap-plan-sprint="${list.id}">📋 ${campaignSprints.length ? 'Plan Next Sprint' : 'Plan Sprint'}</button>`
          : ''}
        <button class="btn btn-sm btn-danger" data-roadmap-remove="${list.id}">Remove</button>
      </div>
      ${sprintChipsHtml}
      <div class="roadmap-campaign-models">
        ${activeModels.length
          ? activeModels.map(campaignModelRow).join('')
          : `<p class="folder-empty">Nothing left unfinished in this campaign.</p>`}
        ${finishedModels.length ? `
          <button class="btn btn-sm roadmap-finished-toggle" data-roadmap-finished-toggle="${list.id}">
            ${showFinished ? '▼' : '▶'} 🏆 ${finishedModels.length} finished
          </button>
          ${showFinished ? `<div class="roadmap-finished-list">${finishedModels.map(campaignModelRow).join('')}</div>` : ''}
        ` : ''}
      </div>
    </div>
  `;
}

function campaignModelRow(model) {
  const pts = modelPoints(model);
  const thresh = modelThreshold(model);
  return `
    <div class="roadmap-model-row" data-roadmap-model-view="${model.id}">
      <span class="roadmap-model-name">${model.name} <span class="roadmap-model-qty">×${model.quantity}</span></span>
      ${progressBar(pts.pct)}
      ${thresholdBadge(thresh)}
    </div>
  `;
}

function availableListRow(list) {
  const col = appData.collections[list.collectionId];
  const sys = col ? GAME_SYSTEMS[col.gameSystemId] : null;
  const stats = listStats(list);
  return `
    <div class="roadmap-available-row">
      <span class="roadmap-available-name">${list.name}</span>
      ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
      <span class="roadmap-available-count">${stats.total} model${stats.total !== 1 ? 's' : ''}</span>
      <button class="btn btn-sm btn-primary" data-roadmap-add="${list.id}">+ Add to Roadmap</button>
    </div>
  `;
}
