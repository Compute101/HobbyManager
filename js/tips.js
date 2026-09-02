// tips.js — semi-intelligent "hint of the day" system, inspired by the old
// Windows lightbulb tips. Each tip's condition checks for a feature going
// unused (or a situation where it would help) so people who already lean on
// a feature stop getting nagged about it — the tip simply stops matching.

import { appData, saveData, getActiveModels, getMothballedModels, getAllModelTypes, modelThreshold, GAME_SYSTEMS, getRoadmapLists, getCampaignSprints, getModelDateAdded, resolveGameSystemId, unstartedCount, greyBrigadeCount } from './data.js';
import { BADGES, oldestPileModel } from './badges.js';
import { getBurndownWindow } from './charts.js';
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
    id: 'sprints',
    icon: '📋',
    text: "Not sure what to paint next? Build a Sprint (Sprints tab) to line up your next few projects — add start/end dates for a capacity check against your pace.",
    condition: ctx => ctx.sprintEntryCount === 0 && ctx.unfinishedCount >= 4
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
    id: 'mothball',
    icon: '🧊',
    text: "Got something you'll realistically never get round to? Mothball it (🧊 on its card in the Model Pool). It stays in your collection with its progress intact, but goes inert — no logging, and it stops counting toward your pile, Grey Brigade and rectitude. Unmothball it whenever you change your mind.",
    condition: ctx => ctx.mothballedCount === 0 && ctx.oldestPileAgeDays >= 365
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
  {
    id: 'sprint_capacity',
    icon: '⏱️',
    text: "Give a Sprint start and end dates to get a capacity check — it'll flag whether you're on track, tight, or overcommitted for your painting pace.",
    condition: ctx => ctx.sprintCount >= 1 && ctx.datedSprintCount === 0
  },
  {
    id: 'campaign_sprint',
    icon: '🔗',
    text: "Turn a Roadmap campaign's remaining work into a Sprint — hit \"Plan Sprint\" on its card for a batch sized to your pace and dated toward its deadline.",
    condition: ctx => ctx.campaignNeedsSprintPlan
  },
  {
    id: 'bounty',
    icon: '🎯',
    text: "Something has been sitting on the sprue a very long time — put a Bounty on it from the Dashboard, name your own reward, and collect when it's finished.",
    condition: ctx => !ctx.hasBounty && ctx.hallOfFameCount === 0 && ctx.oldestPileAgeDays >= 90
  },
  {
    id: 'badges',
    icon: '🏅',
    text: `There are ${BADGES.length} badges waiting on the Dashboard — First Blood for your first finished model, Sprue Slayer for clearing the Grey Brigade, and more. They unlock on their own as you paint.`,
    condition: ctx => ctx.badgeCount === 0 && ctx.hasAnyProgress
  },
  {
    id: 'wishlist',
    icon: '🌟',
    text: "Requisitions filling up with things you haven't picked a month for? Park them on the Wishlist tab instead — no month, no budget commitment — then \"Move to Requisitions\" when you're ready to plan one.",
    condition: ctx => ctx.wishlistCount === 0 && ctx.unplannedQueueCount >= 3
  },
  {
    id: 'projections',
    icon: '🔮',
    text: "Tempted by a whole new army? Import the list into the Projections tab (Quartermaster's Office) to tick off what you already own, price the rest, and get a buy/skip verdict before you spend a penny.",
    condition: ctx => ctx.projectionCount === 0 && (ctx.purchaseQueueCount >= 1 || ctx.wishlistCount >= 1)
  },
  {
    id: 'projection_bundles',
    icon: '📦',
    text: "Picking up part of a projection as a box deal? Bundle those units together on it — the box price replaces their individual costs in the verdict, and the working shows what the deal saves you.",
    condition: ctx => ctx.projectionNeedsBundle
  },
  {
    id: 'projection_system',
    icon: '🛡️',
    text: "Set a game system on a projection so it's judged against that system's own backlog and prices — without one, every system's pile is lumped into the verdict together.",
    condition: ctx => ctx.systemlessProjectionCount > 0 && ctx.pileSystemCount > 1
  },
  {
    id: 'model_worth',
    icon: '💷',
    text: "Fill in Worth (£) on a model's entry — priced models are what the Quartermaster's Office weighs the pile against, and they set the £-per-hobby-point benchmark that Projections score value on.",
    condition: ctx => ctx.pricedModelCount === 0 && ctx.modelCount >= 8
  },
  {
    id: 'burndown_window',
    icon: '📉',
    text: "A quiet month at the desk drags a 30-day pace reading toward zero — switch the pile burndown to its 3-month window on the Dashboard for a steadier estimate.",
    condition: ctx => ctx.burndownWindowDays !== 90 && ctx.quarterSessionCount >= 4 && ctx.recentSessionCount <= 1
  },
  {
    id: 'historical_activity',
    icon: '🕰️',
    text: "Backfilling models you painted before you started tracking? Leave the session time blank — historical entries count as a starting baseline rather than recent activity, so a big catch-up won't inflate your pace.",
    condition: ctx => ctx.historicalSessionCount === 0 && ctx.sessionCount >= 3 && ctx.modelCount >= 10
  },
];

function buildContext() {
  // Mothballed models are shelved — they shouldn't trigger nudges about work
  // the user has explicitly decided not to do.
  const models = getActiveModels();
  const folders = appData.folders || {};
  const sprints = Object.values(appData.sprints || {});
  const lists = Object.values(appData.lists || {});
  const collections = Object.values(appData.collections || {});

  const sprintEntryCount = sprints.reduce((sum, s) => sum + (s.entries?.length || 0), 0);
  const datedSprintCount = sprints.filter(s => s.startDate && s.endDate).length;
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
  const roadmapLists = getRoadmapLists();
  const roadmapListCount = roadmapLists.length;
  // A campaign "needs" sprint planning once it still has unfinished models
  // but hasn't had a single Sprint spun off it yet via Roadmap's "Plan Sprint".
  const campaignNeedsSprintPlan = roadmapLists.some(l => {
    const hasUnfinished = (l.modelIds || []).some(id => {
      const m = appData.models[id];
      return m && modelThreshold(m) !== 'finished';
    });
    return hasUnfinished && getCampaignSprints(l).length === 0;
  });

  // --- Quartermaster: wishlist, requisitions, projections ---
  const wishlistCount = Object.keys(appData.wishlist || {}).length;
  const queued = Object.values(appData.purchaseQueue || {}).filter(i => i.status !== 'purchased');
  // Queued requisitions with no month against them are really wishes that
  // ended up in the planning queue — exactly what the Wishlist tab is for.
  const unplannedQueueCount = queued.filter(i => !i.plannedMonth).length;
  const projections = Object.values(appData.projections || {});
  // A projection with several unowned units and no bundles is the case box
  // deals exist for — one price for the set instead of unit by unit.
  const projectionNeedsBundle = projections.some(p =>
    (p.units || []).filter(u => !u.owned).length >= 3 && (p.bundles || []).length === 0
  );
  const systemlessProjectionCount = projections.filter(p => !p.gameSystemId).length;
  // How many game systems the pile spans — an unscoped projection is only
  // misleading once there's more than one backlog being averaged together.
  const pileSystemCount = new Set(
    models
      .filter(m => unstartedCount(m) > 0 || greyBrigadeCount(m) > 0)
      .map(m => resolveGameSystemId(m))
      .filter(Boolean)
  ).size;
  const pricedModelCount = models.filter(m => m.worth > 0).length;

  // --- Gamification ---
  const oldestOnPile = oldestPileModel();
  const oldestAdded = oldestOnPile ? getModelDateAdded(oldestOnPile) : null;
  const oldestPileAgeDays = oldestAdded
    ? Math.floor((Date.now() - oldestAdded.getTime()) / 86400000)
    : 0;

  // --- Activity pace ---
  const sessions = appData.sessions || [];
  // Historical entries carry no duration: backfilled work with no real date,
  // which the burndown treats as baseline rather than recent activity.
  const historicalSessionCount = sessions.filter(s => !s.duration).length;
  const datedSessions = sessions.filter(s => s.duration && s.date);
  const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const last30 = daysAgo(30), last90 = daysAgo(90);
  const recentSessionCount = datedSessions.filter(s => s.date >= last30).length;
  const quarterSessionCount = datedSessions.filter(s => s.date >= last90).length;

  return {
    modelCount: models.length,
    mothballedCount: getMothballedModels().length,
    folderCount: Object.keys(folders).length,
    sprintEntryCount,
    sprintCount: sprints.length,
    datedSprintCount,
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
    campaignNeedsSprintPlan,
    wishlistCount,
    unplannedQueueCount,
    projectionCount: projections.length,
    projectionNeedsBundle,
    systemlessProjectionCount,
    pileSystemCount,
    pricedModelCount,
    hasBounty: !!appData.bounty,
    hallOfFameCount: (appData.hallOfFame || []).length,
    badgeCount: Object.keys(appData.badges || {}).length,
    oldestPileAgeDays,
    historicalSessionCount,
    recentSessionCount,
    quarterSessionCount,
    burndownWindowDays: getBurndownWindow(),
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
