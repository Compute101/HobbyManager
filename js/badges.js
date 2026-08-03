// badges.js — pile-clearing gamification: bounties, the Hall of Fame, and badges
//
// A "bounty" is a self-defined reward for finishing the oldest thing in the
// pile: you pick the reward (a treat, a kit, bragging rights), the app just
// holds you to it and makes the payoff feel like an event when it lands.

import {
  appData, saveData, uid, globalStats, getAllModels, unstartedCount, modelThreshold,
  modelPoints, greyBrigadeCount, getModelDateAdded,
  setBounty, clearBounty, addHallOfFameEntry, recordBadgeEarned
} from './data.js';
import { toast, showModal, closeModal, formatDate, fireworks, progressBar } from './ui.js';

// --- Badge definitions ---

export const BADGES = [
  {
    id: 'first_blood',
    icon: '🩸',
    name: 'First Blood',
    desc: 'Finish your very first model.',
    check: () => globalStats().finished >= 1
  },
  {
    id: 'century_club',
    icon: '💯',
    name: 'Century Club',
    desc: 'Finish 100 models.',
    check: () => globalStats().finished >= 100
  },
  {
    id: 'zero_shame',
    icon: '✨',
    name: 'Zero Shame',
    desc: 'Empty the Pile of Potential — nothing left on the sprue.',
    check: () => {
      const models = getAllModels();
      return models.length > 0 && models.every(m => unstartedCount(m) === 0);
    }
  },
  {
    id: 'sprue_slayer',
    icon: '🩶',
    name: 'Sprue Slayer',
    desc: 'Clear the Grey Brigade — nothing left assembled-but-unpainted.',
    check: () => {
      const models = getAllModels();
      const anyEverAssembled = models.some(m => modelThreshold(m) !== 'not_started');
      return anyEverAssembled && models.every(m => greyBrigadeCount(m) === 0);
    }
  },
  {
    id: 'bounty_hunter',
    icon: '🎯',
    name: 'Bounty Hunter',
    desc: 'Complete your first bounty.',
    check: () => (appData.hallOfFame || []).length >= 1
  },
  {
    id: 'bounty_hunter_5',
    icon: '🏹',
    name: 'Veteran Bounty Hunter',
    desc: 'Complete 5 bounties.',
    check: () => (appData.hallOfFame || []).length >= 5
  },
  {
    id: 'ancient_slain',
    icon: '🥇',
    name: 'Ancient Slain',
    desc: 'Complete a bounty on something a year or older.',
    check: () => (appData.hallOfFame || []).some(h => h.ageDays >= 365)
  }
];

function bountyTier(ageDays) {
  if (ageDays >= 365) return { tier: 'gold', icon: '🥇' };
  if (ageDays >= 180) return { tier: 'silver', icon: '🥈' };
  return { tier: 'bronze', icon: '🥉' };
}

// The oldest model still sitting on the sprue — the default bounty target.
export function oldestPileModel() {
  const candidates = getAllModels()
    .map(m => ({ model: m, added: getModelDateAdded(m) }))
    .filter(e => unstartedCount(e.model) > 0);
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const at = a.added ? a.added.getTime() : Infinity;
    const bt = b.added ? b.added.getTime() : Infinity;
    return at - bt;
  });
  return candidates[0].model;
}

function ageDaysOf(model) {
  const added = getModelDateAdded(model);
  return added ? Math.floor((Date.now() - added.getTime()) / 86400000) : 0;
}

// --- Gamification checks, run after every data change ---

let _checking = false;

export function checkGamification({ silent = false } = {}) {
  if (_checking) return;
  _checking = true;
  try {
    checkBountyCompletion(silent);
    checkBadges(silent);
  } finally {
    _checking = false;
  }
}

function checkBountyCompletion(silent) {
  const bounty = appData.bounty;
  if (!bounty) return;
  const model = appData.models[bounty.modelId];
  if (!model) { clearBounty(); return; }
  if (modelThreshold(model) !== 'finished') return;

  const ageDays = ageDaysOf(model);
  const tier = bountyTier(ageDays);
  addHallOfFameEntry({
    id: uid(),
    modelName: model.name,
    ageDays,
    dateCompleted: new Date().toISOString().slice(0, 10),
    reward: bounty.reward,
    tier: tier.tier
  });
  clearBounty();

  if (!silent) {
    fireworks();
    toast(`${tier.icon} Bounty complete! ${model.name} is finished — go claim: ${bounty.reward}`, 'success', 5500);
  }
}

function checkBadges(silent) {
  if (!appData.badges) appData.badges = {};
  BADGES.forEach(b => {
    if (appData.badges[b.id]) return;
    if (b.check()) {
      recordBadgeEarned(b.id);
      if (!silent) toast(`🎖️ Badge earned: ${b.name}`, 'success', 4500);
    }
  });
}

// --- Rendering ---

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderBountySection() {
  const bounty = appData.bounty;

  if (bounty) {
    const model = appData.models[bounty.modelId];
    if (!model) { clearBounty(); return renderBountySection(); }
    const ageDays = ageDaysOf(model);
    const pts = modelPoints(model);
    return `
      <div class="dash-card dash-bounty">
        <h3>🎯 Bounty Board</h3>
        <div class="bounty-active">
          <div class="bounty-model-name">${escAttr(model.name)}</div>
          <div class="bounty-model-age">${ageDays} day${ageDays !== 1 ? 's' : ''} old</div>
          ${progressBar(pts.pct)}
          <div class="bounty-reward"><span class="bounty-reward-label">Reward:</span> ${escAttr(bounty.reward)}</div>
          <button class="btn btn-sm btn-danger" id="abandonBountyBtn">Abandon Bounty</button>
        </div>
      </div>`;
  }

  const target = oldestPileModel();
  return `
    <div class="dash-card dash-bounty">
      <h3>🎯 Bounty Board</h3>
      ${target
        ? `<p class="empty-text">Set a bounty on the oldest thing in your pile — pick your own reward, and finish it to collect.</p>
           <button class="btn btn-sm btn-primary" id="setBountyBtn">🎯 Set a Bounty</button>`
        : `<p class="empty-text">Nothing on the pile to put a bounty on. Impressive!</p>`}
    </div>`;
}

export function wireBountySection(container, onChange) {
  container.querySelector('#setBountyBtn')?.addEventListener('click', () => {
    const target = oldestPileModel();
    if (!target) return;
    showSetBountyModal(target, onChange);
  });
  container.querySelector('#abandonBountyBtn')?.addEventListener('click', () => {
    clearBounty();
    toast('Bounty abandoned', 'info');
    onChange?.();
  });
}

function showSetBountyModal(model, onChange) {
  const ageDays = ageDaysOf(model);
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size:0.9em;color:var(--text-muted);margin-bottom:0.75em">
      Oldest thing on your pile — <b>${escAttr(model.name)}</b>, ${ageDays} day${ageDays !== 1 ? 's' : ''} old.
      Finish it (reach 🏆 Finished) to collect.
    </p>
    <label>What's the reward?</label>
    <input type="text" class="form-input" id="bountyRewardInput" placeholder="e.g. a new brush, that kit I've been eyeing…" maxlength="120">
    <div class="modal-actions">
      <button class="btn btn-primary" id="bountySaveBtn">Set Bounty</button>
      <button class="btn" id="bountyCancelBtn">Cancel</button>
    </div>
  `;
  content.querySelector('#bountySaveBtn').addEventListener('click', () => {
    const reward = content.querySelector('#bountyRewardInput').value.trim();
    if (!reward) { toast('Enter a reward first', 'error'); return; }
    setBounty(model.id, reward);
    closeModal();
    toast('Bounty set — go clear it!', 'success');
    onChange?.();
  });
  content.querySelector('#bountyCancelBtn').addEventListener('click', () => closeModal());
  showModal({ title: '🎯 Set a Bounty', content });
}

export function renderHallOfFameSection() {
  const entries = appData.hallOfFame || [];
  return `
    <div class="dash-card dash-hall-of-fame">
      <h3>🏛️ Hall of Fame</h3>
      ${entries.length ? `
        <div class="hof-list">
          ${entries.map(e => {
            const tierIcon = { gold: '🥇', silver: '🥈', bronze: '🥉' }[e.tier] || '🏅';
            return `
              <div class="hof-item">
                <span class="hof-tier">${tierIcon}</span>
                <div class="hof-item-body">
                  <div class="hof-item-name">${escAttr(e.modelName)}</div>
                  <div class="hof-item-meta">${e.ageDays} day${e.ageDays !== 1 ? 's' : ''} old · finished ${formatDate(e.dateCompleted, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div class="hof-item-reward">🎁 ${escAttr(e.reward)}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      ` : `<p class="empty-text">No bounties completed yet — set one on the Bounty Board above.</p>`}
    </div>`;
}

export function renderBadgesSection() {
  const earned = appData.badges || {};
  return `
    <div class="dash-card dash-badges">
      <h3>🎖️ Badges</h3>
      <div class="badge-grid">
        ${BADGES.map(b => {
          const dateEarned = earned[b.id];
          return `
            <div class="badge-tile ${dateEarned ? 'badge-tile-earned' : 'badge-tile-locked'}" title="${escAttr(b.desc)}">
              <div class="badge-tile-icon">${b.icon}</div>
              <div class="badge-tile-name">${b.name}</div>
              ${dateEarned
                ? `<div class="badge-tile-date">${formatDate(dateEarned, { day: 'numeric', month: 'short', year: 'numeric' })}</div>`
                : `<div class="badge-tile-desc">${escAttr(b.desc)}</div>`}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}
