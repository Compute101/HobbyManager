// tips.js — semi-intelligent "hint of the day" system, inspired by the old
// Windows lightbulb tips. Each tip's condition checks for a feature going
// unused (or a situation where it would help) so people who already lean on
// a feature stop getting nagged about it — the tip simply stops matching.

import { appData, saveData, getAllModels, getAllModelTypes, modelThreshold, GAME_SYSTEMS, getRoadmapLists } from './data.js';
import { isConfigured, wasConnected } from './gdrive.js';
import { showModal, today } from './ui.js';

// --- Tip definitions ---
// condition(ctx) returns true when the tip is relevant right now.
const TIP_DEFINITIONS = [
  {
    id: 'folders',
    icon: '📁',
    text: "Your model pool is growing — group related models into folders (Model Pool tab) to keep things tidy.",
    condition: ctx => ctx.folderCount === 0 && ctx.modelCount >= 8
  },
  {
    id: 'queue',
    icon: '📋',
    text: "Not sure what to paint next? Build a Painting Queue to line up your next few projects.",
    condition: ctx => ctx.queueEntryCount === 0 && ctx.unfinishedCount >= 4
  },
  {
    id: 'weekly_goal',
    icon: '🎯',
    text: "Set a weekly hobby-time goal in Settings to track your momentum week to week.",
    condition: ctx => appData.config.weeklyGoal === 0 && ctx.sessionCount >= 3
  },
  {
    id: 'deadlines',
    icon: '⏳',
    text: "Add a deadline to an army list to get a burndown chart estimating whether you're on pace.",
    condition: ctx => ctx.listsWithDeadline === 0 && ctx.listsWithModels > 0
  },
  {
    id: 'budget',
    icon: '💰',
    text: "Set a monthly budget in Settings to track spending against your purchase queue in the Quartermaster's Office.",
    condition: ctx => appData.config.monthlyBudgetGBP === 0 && ctx.purchaseQueueCount >= 3
  },
  {
    id: 'gdrive_backup',
    icon: '☁️',
    text: "Back up your collection automatically — connect Google Drive from Settings.",
    condition: ctx => isConfigured() && !wasConnected() && ctx.modelCount >= 5
  },
  {
    id: 'custom_model_type',
    icon: '🧩',
    text: "Got a unit that doesn't fit the built-in types? Create a Custom Model Type in Settings for precise stage tracking.",
    condition: ctx => (appData.config.modelTypes || []).length === 0 && ctx.modelCount >= 12
  },
  {
    id: 'quartermaster',
    icon: '🎖️',
    text: "Log planned purchases in the Quartermaster's Office to track your pile of potential before it becomes a pile of shame.",
    condition: ctx => ctx.purchaseQueueCount === 0 && ctx.modelCount >= 10
  },
  {
    id: 'skippable_stages',
    icon: '⏭️',
    text: "Stages marked optional (like Layer or Highlight) can be skipped per-model if you're speed painting — toggle them from a model's stage list.",
    condition: ctx => !ctx.usesSkippedStages && ctx.modelCount >= 5
  },
  {
    id: 'theme_match',
    icon: '🎨',
    text: "Switch to a themed look matching your primary game system — try it in Settings.",
    condition: ctx => appData.config.activeTheme === 'theme-default' && ctx.nonCustomCollectionCount > 0
  },
  {
    id: 'list_splits',
    icon: '✂️',
    text: "Only taking some models from a big unit into this list? Use list splits to divide a unit's models across lists.",
    condition: ctx => !ctx.usesListSplits && ctx.hasLargeUnitInList
  },
  {
    id: 'log_sessions',
    icon: '🕒',
    text: "Log a painting session in the Activity tab to track hours invested and watch your stats build up.",
    condition: ctx => ctx.sessionCount === 0 && ctx.hasAnyProgress
  },
  {
    id: 'photos',
    icon: '📷',
    text: "Add a photo to a model's entry to visually track your collection at a glance.",
    condition: ctx => ctx.modelCount >= 5 && !ctx.hasAnyImage
  },
  {
    id: 'roadmap',
    icon: '🗺️',
    text: "Pool feeling overwhelming? Mark an army list as active on the Roadmap tab — its models rise to the top of the Model Pool, and everything else settles into the Backlog.",
    condition: ctx => ctx.roadmapListCount === 0 && ctx.listsWithModels >= 1 && ctx.modelCount >= 8
  },
];

function buildContext() {
  const models = getAllModels();
  const folders = appData.folders || {};
  const queues = appData.queues || {};
  const lists = Object.values(appData.lists || {});
  const collections = Object.values(appData.collections || {});

  const queueEntryCount = Object.values(queues).reduce((sum, q) => sum + (q.entries?.length || 0), 0);
  const unfinishedCount = models.filter(m => modelThreshold(m) !== 'finished').length;
  const listsWithDeadline = lists.filter(l => l.deadline).length;
  const listsWithModels = lists.filter(l => (l.modelIds || []).length > 0).length;
  const usesSkippedStages = models.some(m => (m.skippedStages || []).length > 0);
  const usesListSplits = lists.some(l => Object.keys(l.modelSplits || {}).length > 0);
  const hasLargeUnitInList = lists.some(l =>
    (l.modelIds || []).some(id => (appData.models[id]?.quantity || 0) >= 10)
  );
  const hasAnyProgress = models.some(m => Object.values(m.progress || {}).some(p => (p?.done || 0) > 0));
  const hasAnyImage = models.some(m => !!m.image);
  const nonCustomCollectionCount = collections.filter(c => c.gameSystemId && c.gameSystemId !== 'custom' && GAME_SYSTEMS[c.gameSystemId]).length;
  const roadmapListCount = getRoadmapLists().length;

  return {
    modelCount: models.length,
    folderCount: Object.keys(folders).length,
    queueEntryCount,
    unfinishedCount,
    sessionCount: appData.sessions.length,
    listsWithDeadline,
    listsWithModels,
    purchaseQueueCount: Object.keys(appData.purchaseQueue || {}).length,
    usesSkippedStages,
    usesListSplits,
    hasLargeUnitInList,
    hasAnyProgress,
    hasAnyImage,
    nonCustomCollectionCount,
    roadmapListCount,
  };
}

function isHidden(id) {
  if ((appData.config.tipsDismissed || []).includes(id)) return true;
  const until = appData.config.tipsSnoozed?.[id];
  if (until && until > today()) return true;
  return false;
}

export function getActiveTips() {
  const ctx = buildContext();
  return TIP_DEFINITIONS.filter(t => !isHidden(t.id) && t.condition(ctx));
}

export function hasActiveTips() {
  return getActiveTips().length > 0;
}

export function dismissTip(id) {
  if (!appData.config.tipsDismissed) appData.config.tipsDismissed = [];
  if (!appData.config.tipsDismissed.includes(id)) appData.config.tipsDismissed.push(id);
  saveData();
}

export function snoozeTip(id, days = 14) {
  if (!appData.config.tipsSnoozed) appData.config.tipsSnoozed = {};
  const until = new Date();
  until.setDate(until.getDate() + days);
  appData.config.tipsSnoozed[id] = until.toISOString().slice(0, 10);
  saveData();
}

// --- UI ---

export function refreshTipsBadge() {
  const dot = document.getElementById('tipsDot');
  if (dot) dot.style.display = hasActiveTips() ? 'block' : 'none';
}

export function openTipsModal() {
  const content = document.createElement('div');
  content.id = 'tipsModalBody';
  showModal({ title: '💡 Tips for You', content });
  renderTipsBody(content);
}

function renderTipsBody(container) {
  const tips = getActiveTips();

  if (tips.length === 0) {
    container.innerHTML = `<p class="empty-text">You're on top of things — no new tips right now. Check back as your collection grows.</p>`;
    refreshTipsBadge();
    return;
  }

  container.innerHTML = `
    <div class="tips-list">
      ${tips.map(t => `
        <div class="tip-card" data-tip-id="${t.id}">
          <span class="tip-icon">${t.icon}</span>
          <div class="tip-body">
            <p class="tip-text">${t.text}</p>
            <div class="tip-actions">
              <button class="btn btn-xs" data-tip-snooze="${t.id}">Remind me later</button>
              <button class="btn btn-xs btn-primary" data-tip-dismiss="${t.id}">Got it</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('[data-tip-dismiss]').forEach(btn => {
    btn.addEventListener('click', () => {
      dismissTip(btn.dataset.tipDismiss);
      renderTipsBody(container);
    });
  });
  container.querySelectorAll('[data-tip-snooze]').forEach(btn => {
    btn.addEventListener('click', () => {
      snoozeTip(btn.dataset.tipSnooze);
      renderTipsBody(container);
    });
  });

  refreshTipsBadge();
}
