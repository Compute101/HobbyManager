// roadmap.js — roadmap tab: pick which army lists are active "campaigns"
// vs. everything else sitting quietly in the backlog

import {
  appData, GAME_SYSTEMS, listStats, modelPoints, modelThreshold,
  getRoadmapLists, addListToRoadmap, removeListFromRoadmap, moveRoadmapList
} from './data.js';
import { toast, progressBar, thresholdBadge, formatDate, daysUntil } from './ui.js';
import { selectCollection, selectList } from './collections.js';
import { showModelDetail } from './models.js';

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
      <div class="roadmap-campaign-actions">
        <div class="roadmap-move-btns">
          <button class="btn btn-sm" data-roadmap-up="${list.id}" title="Move up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-sm" data-roadmap-down="${list.id}" title="Move down" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
        </div>
        <button class="btn btn-sm" data-roadmap-open="${list.id}">🛡️ Open</button>
        <button class="btn btn-sm btn-danger" data-roadmap-remove="${list.id}">Remove</button>
      </div>
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
