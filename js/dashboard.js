// dashboard.js — dashboard with pie charts and deadline cards

import { appData, globalStats, listStats, saveData, GAME_SYSTEMS, modelThreshold, unstartedCount, singleModelPoints, getModelType, resolveModelGroup, MODEL_GROUP_ORDER } from './data.js';
import { progressBar, toast, daysUntil, formatDate, localDateStr } from './ui.js';
import { renderCompositionPie, renderCompletionPie, renderBurndown, renderStageBar, renderListCompletionPie, pieModeToggleHtml, wirePieModeToggle, renderPileBurndown, pileBurndownStats } from './charts.js';
import { showModal, closeModal, createDateInput, getDateValue } from './ui.js';

export function renderDashboard() {
  const container = document.getElementById('dashboardView');
  if (!container) return;

  const stats = globalStats();

  // Collect lists with deadlines, sorted soonest first
  const listsWithDeadlines = Object.values(appData.lists)
    .filter(l => l.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  container.innerHTML = `
    <div class="dashboard-grid">

      <!-- Weekly summary -->
      <div class="dash-card dash-weekly">
        <h3>This Week</h3>
        ${renderWeeklySummary()}
      </div>

      <!-- Overall summary -->
      <div class="dash-card dash-summary">
        <h3>Overall Progress</h3>
        ${progressBar(stats.pct)}
        <div class="dash-pct">${stats.pct}%</div>
        <div class="dash-pts">${stats.donePts} / ${stats.totalPts} hobby points</div>
        <div class="thresh-row">
          <div class="thresh-stat">
            <span class="thresh-icon">⚔️</span>
            <span class="thresh-val">${stats.tableReady}</span>
            <span class="thresh-lbl">Table Ready</span>
          </div>
          <div class="thresh-stat">
            <span class="thresh-icon">🎨</span>
            <span class="thresh-val">${stats.painted}</span>
            <span class="thresh-lbl">Painted</span>
          </div>
          <div class="thresh-stat">
            <span class="thresh-icon">🏆</span>
            <span class="thresh-val">${stats.finished}</span>
            <span class="thresh-lbl">Finished</span>
          </div>
        </div>
        <div class="thresh-total">of ${stats.total} total models</div>
      </div>

      <!-- Hobby stats -->
      <div class="dash-card dash-hobby-stats">
        <h3>Hobby Stats</h3>
        ${renderHobbyStats()}
      </div>

      <!-- Completion status pie -->
      <div class="dash-card dash-chart-card">
        <div class="pile-card-header">
          <h3>Completion Status</h3>
          ${pieModeToggleHtml()}
        </div>
        <div class="chart-wrap"><canvas id="completionPie"></canvas></div>
      </div>

      <!-- Collection composition pie -->
      <div class="dash-card dash-chart-card">
        <div class="pile-card-header">
          <h3>Collection by Game System</h3>
          ${pieModeToggleHtml()}
        </div>
        <div class="chart-wrap"><canvas id="compositionPie"></canvas></div>
      </div>

      <!-- Upcoming deadlines -->
      <div class="dash-card dash-deadlines">
        <h3>Upcoming Deadlines</h3>
        ${listsWithDeadlines.length ? `
          <div class="deadline-cards">
            ${listsWithDeadlines.map(list => deadlineCard(list)).join('')}
          </div>
        ` : `
          <p class="empty-text">No deadlines set. Open an army list in the Armies tab to set one.</p>
        `}
      </div>

      <!-- Recent activity -->
      <div class="dash-card dash-recent">
        <h3>Recent Activity</h3>
        ${renderRecentSessions()}
      </div>

      <!-- Army completion breakdown -->
      ${armyCompletionSection()}

      <!-- Pile of Potential -->
      ${pileOfPotentialSection()}

      <!-- Pile burndown -->
      ${pileBurndownSection()}

      <!-- Grey Brigade -->
      ${greyBrigadeSection()}

    </div>
  `;

  // Wire up deadline card buttons
  container.querySelectorAll('[data-burndown-list]').forEach(btn => {
    btn.addEventListener('click', () => showListBurndown(btn.dataset.burndownList));
  });

  // Pile of Potential share button
  document.getElementById('sharePileBtn')?.addEventListener('click', sharePileOfPotential);

  // Grey Brigade share button
  document.getElementById('shareGreyBtn')?.addEventListener('click', shareGreyBrigade);

  // Pictogram figures: click/Enter/Space reveals model name + type
  wirePictoFigs(container);

  // Weekly goal button
  document.getElementById('setWeeklyGoalBtn')?.addEventListener('click', () => {
    const current = appData.config.weeklyGoal || '';
    const val = prompt('Set weekly hobby point goal (0 to disable):', current);
    if (val !== null) {
      appData.config.weeklyGoal = Math.max(0, parseInt(val) || 0);
      saveData();
      renderDashboard();
    }
  });

  // Pie chart weighting toggle (by model count or hobby points)
  wirePieModeToggle(container, () => renderDashboard());

  // Render pie charts
  requestAnimationFrame(() => {
    renderCompletionPie('completionPie');
    renderCompositionPie('compositionPie');
    Object.values(appData.lists).forEach(list => {
      const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);
      renderListCompletionPie(`armyPie_${list.id}`, models);
    });
    renderPileBurndown('pileBurndownChart');
  });
}

// --- Pile burndown ---

function pileBurndownSection() {
  const { pileRemainingPoints, velocity, daysToClear, clearDate } = pileBurndownStats();
  let summary;
  if (!pileRemainingPoints) {
    summary = `<p class="empty-text">Nothing left on the pile to burn down. Impressive!</p>`;
  } else if (!daysToClear) {
    summary = `<p class="empty-text">${pileRemainingPoints} points remain on the pile — log some progress to start projecting a clear date.</p>`;
  } else {
    summary = `<div class="pile-total">At ${velocity.toFixed(1)} pts/day (last 30 days), the pile clears in ~${daysToClear} days (${formatDate(clearDate, { month: 'short', day: 'numeric', year: 'numeric' })}).</div>`;
  }
  return `
    <div class="dash-card dash-chart-card dash-pile-burndown">
      <h3>Pile Burndown</h3>
      ${summary}
      <div class="chart-wrap"><canvas id="pileBurndownChart"></canvas></div>
    </div>`;
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7)); // roll back to Monday
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: localDateStr(monday),
    end: localDateStr(sunday)
  };
}

function renderWeeklySummary() {
  const { start, end } = getWeekBounds();
  const sessions = (appData.sessions || []).filter(s => s.date >= start && s.date <= end && s.duration);
  const goal = appData.config.weeklyGoal || 0;

  // Points this week
  const weekPts = sessions.reduce((acc, s) => {
    return acc + (s.modelEntries || []).reduce((a, e) => {
      const model = appData.models[e.modelId];
      const stage = (model?.stages || appData.config.stages).find(st => st.id === e.stageId);
      return a + (stage?.points || 1) * (e.qty || 0);
    }, 0);
  }, 0);

  // Days painted
  const daysPainted = new Set(sessions.map(s => s.date)).size;

  // Time spent
  const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const timeStr = totalMins === 0 ? '—' : totalMins >= 60
    ? `${Math.floor(totalMins/60)}h ${totalMins%60}m`
    : `${totalMins}m`;

  // Models worked on
  const modelsWorked = new Set(
    sessions.flatMap(s => (s.modelEntries || []).map(e => e.modelId))
  ).size;

  // Goal progress
  const goalPct = goal > 0 ? Math.min(100, Math.round(weekPts / goal * 100)) : null;
  const urgencyClass = goalPct === null ? '' : goalPct >= 100 ? 'goal-done' : goalPct >= 60 ? 'goal-close' : '';

  // Encouraging message
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const daysLeft = 6 - dayOfWeek;

  let message = '';
  if (goal > 0) {
    if (goalPct >= 100) message = '🎉 Weekly goal smashed!';
    else if (weekPts === 0 && daysLeft <= 1) message = '⚠️ Last chance to paint this week!';
    else if (weekPts === 0) message = '🖌️ Time to get the brushes out!';
    else if (goalPct >= 60) message = '💪 Almost there — keep going!';
    else if (daysLeft <= 2 && goalPct < 50) message = '⏰ Weekend crunch time!';
    else message = '🎨 Good progress — keep it up!';
  } else {
    if (weekPts === 0) message = '🖌️ No painting yet this week.';
    else message = `🎨 ${daysPainted} day${daysPainted !== 1 ? 's' : ''} painted this week!`;
  }

  // Day dots — Mon to Sun
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const sessionDates = new Set(sessions.map(s => s.date));
  const dayDots = dayNames.map((d, i) => {
    const [sy, sm, sd] = start.split('-').map(Number);
    const date = new Date(sy, sm - 1, sd);
    date.setDate(date.getDate() + i);
    const dateStr = localDateStr(date);
    const painted = sessionDates.has(dateStr);
    const isToday = dateStr === localDateStr(new Date());
    return `<div class="week-dot ${painted ? 'painted' : ''} ${isToday ? 'today' : ''}">
      <div class="week-dot-circle"></div>
      <div class="week-dot-label">${d}</div>
    </div>`;
  }).join('');

  return `
    <div class="weekly-day-dots">${dayDots}</div>
    <div class="weekly-stats">
      <div class="weekly-stat"><span class="weekly-stat-val">${weekPts}</span><span class="weekly-stat-lbl">pts</span></div>
      <div class="weekly-stat"><span class="weekly-stat-val">${daysPainted}</span><span class="weekly-stat-lbl">days</span></div>
      <div class="weekly-stat"><span class="weekly-stat-val">${timeStr}</span><span class="weekly-stat-lbl">time</span></div>
      <div class="weekly-stat"><span class="weekly-stat-val">${modelsWorked}</span><span class="weekly-stat-lbl">models</span></div>
    </div>
    ${goal > 0 ? `
      <div class="weekly-goal-row">
        <div class="weekly-goal-label">Weekly goal: ${weekPts} / ${goal} pts</div>
        <div class="prog-bar weekly-goal-bar">
          <div class="prog-fill ${urgencyClass}" style="width:${goalPct}%"></div>
        </div>
      </div>
    ` : `
      <div class="weekly-goal-nudge">
        <p class="goal-nudge-text">Set a weekly painting goal to track your pace and get encouragement messages.</p>
        <button class="btn btn-sm btn-primary" id="setWeeklyGoalBtn">🎯 Set weekly goal</button>
      </div>
    `}
    <div class="weekly-message">${message}</div>
  `;
}

function renderHobbyStats() {
  const sessions = appData.sessions || [];
  if (!sessions.length) return '<p class="empty-text">No sessions logged yet.</p>';

  // Total time
  const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeStr = totalMins === 0 ? 'Not recorded'
    : hours > 0 ? `${hours}h ${mins}m`
    : `${mins}m`;

  // Average session length (only sessions with duration)
  const timed = sessions.filter(s => s.duration);
  const avgMins = timed.length ? Math.round(timed.reduce((a, s) => a + s.duration, 0) / timed.length) : null;
  const avgStr = avgMins ? `${avgMins} mins` : 'Not recorded';

  // Most worked on model — by total minutes in sessions where model was logged
  const modelMins = {};
  sessions.forEach(s => {
    if (!s.duration) return;
    (s.modelEntries || []).forEach(e => {
      modelMins[e.modelId] = (modelMins[e.modelId] || 0) + s.duration;
    });
  });
  const topModelId = Object.entries(modelMins).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topModel = topModelId ? appData.models[topModelId] : null;

  // Current streak — consecutive days with sessions
  const sessionDates = new Set(sessions.map(s => s.date).filter(Boolean));
  let streak = 0;
  const check = new Date();
  check.setHours(0, 0, 0, 0);
  while (true) {
    const dateStr = localDateStr(check);
    if (sessionDates.has(dateStr)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return `
    <div class="hobby-stats-grid">
      <div class="hobby-stat">
        <div class="hobby-stat-icon">⏱️</div>
        <div class="hobby-stat-val">${timeStr}</div>
        <div class="hobby-stat-lbl">Total time painted</div>
      </div>
      <div class="hobby-stat">
        <div class="hobby-stat-icon">📊</div>
        <div class="hobby-stat-val">${avgStr}</div>
        <div class="hobby-stat-lbl">Avg session length</div>
      </div>
      <div class="hobby-stat">
        <div class="hobby-stat-icon">🔥</div>
        <div class="hobby-stat-val">${streak > 0 ? streak + (streak === 1 ? ' day' : ' days') : '—'}</div>
        <div class="hobby-stat-lbl">Current streak</div>
      </div>
      <div class="hobby-stat">
        <div class="hobby-stat-icon">🏅</div>
        <div class="hobby-stat-val">${topModel ? topModel.name : '—'}</div>
        <div class="hobby-stat-lbl">Most worked on</div>
      </div>
    </div>
  `;
}

function deadlineCard(list) {
  const stats = listStats(list);
  const days = daysUntil(list.deadline);
  const ptsLeft = stats.totalPts - stats.donePts;
  const pace = (days && days > 0) ? (ptsLeft / days).toFixed(1) : null;
  const col = appData.collections[list.collectionId];
  const sys = col ? GAME_SYSTEMS[col.gameSystemId] : null;

  let urgency = '';
  let daysLabel = '';
  if (days === null) {
    daysLabel = '';
  } else if (days < 0) {
    urgency = 'urgency-overdue';
    daysLabel = `⚠️ ${Math.abs(days)} days overdue`;
  } else if (days === 0) {
    urgency = 'urgency-overdue';
    daysLabel = '⚠️ Due today!';
  } else if (days <= 7) {
    urgency = 'urgency-soon';
    daysLabel = `${days} day${days === 1 ? '' : 's'} left`;
  } else if (days <= 21) {
    urgency = 'urgency-upcoming';
    daysLabel = `${days} days left`;
  } else {
    daysLabel = `${days} days left`;
  }

  return `
    <div class="deadline-card ${urgency}">
      <div class="deadline-card-header">
        <div class="deadline-card-name">${list.name}</div>
        ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
      </div>
      <div class="deadline-card-date">📅 ${fmtDateShort(list.deadline)} · <span class="deadline-days">${daysLabel}</span></div>
      ${progressBar(stats.pct)}
      <div class="deadline-card-stats">
        <span>${stats.donePts}/${stats.totalPts} pts (${stats.pct}%)</span>
        ${pace ? `<span class="pace-badge">${pace} pts/day needed</span>` : ptsLeft === 0 ? '<span class="pace-badge pace-done">✅ Complete!</span>' : ''}
      </div>
      <button class="btn btn-sm" data-burndown-list="${list.id}">📈 View Burndown</button>
    </div>
  `;
}

function fmtDateShort(dateStr) {
  return formatDate(dateStr, { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderRecentSessions() {
  const sessions = [...appData.sessions].filter(s => s.duration).reverse().slice(0, 5);
  if (!sessions.length) return '<p class="empty-text">No sessions logged yet.</p>';

  return `<div class="session-list">
    ${sessions.map(s => `
      <div class="session-item">
        <div class="session-date">${s.date}</div>
        <div class="session-detail">
          ${s.duration ? `⏱️ ${s.duration} mins` : ''}
          ${s.notes ? `· ${s.notes}` : ''}
        </div>
        <div class="session-models">
          ${(s.modelEntries || []).map(e => {
            const m = appData.models[e.modelId];
            const stage = (m?.stages || appData.config.stages).find(st => st.id === e.stageId);
            return m ? `<span class="session-tag">${m.name} — ${stage?.name || e.stageId} ×${e.qty}</span>` : '';
          }).join('')}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function armyCompletionSection() {
  const lists = Object.values(appData.lists);
  if (!lists.length) return '';
  return `
    <div class="dash-card dash-army-breakdown">
      <div class="pile-card-header">
        <h3>Army Completion Breakdown</h3>
        ${pieModeToggleHtml()}
      </div>
      <div class="army-pie-grid">
        ${lists.map(list => {
          const col = appData.collections[list.collectionId];
          const sys = col ? GAME_SYSTEMS[col.gameSystemId] : null;
          return `
            <div class="army-pie-card">
              <div class="army-pie-title">
                ${list.name}
                ${sys ? `<span class="sys-tag ${sys.theme}">${sys.shortLabel}</span>` : ''}
              </div>
              <div class="chart-wrap"><canvas id="armyPie_${list.id}"></canvas></div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// --- Pile of Potential ---

export function resolveGameSystemId(model) {
  if (model.gameSystemId) return model.gameSystemId;
  // For manually created models, infer from whichever list they belong to
  for (const list of Object.values(appData.lists)) {
    if ((list.modelIds || []).includes(model.id)) {
      const col = appData.collections?.[list.collectionId];
      if (col?.gameSystemId) return col.gameSystemId;
    }
  }
  return null;
}

function getModelDateAdded(model) {
  if (model.dateAdded) return new Date(model.dateAdded);
  // Derive from uid: Date.now().toString(36) prefix (8 chars for current timestamps)
  const id = model.id || '';
  for (const len of [8, 9]) {
    if (id.length < len + 5) continue;
    const ts = parseInt(id.slice(0, len), 36);
    const year = new Date(ts).getFullYear();
    if (year >= 2020 && year <= 2100) return new Date(ts);
  }
  return null;
}

function shameScore(model, unstarted) {
  if (unstarted === 0) return 0;
  let score = unstarted;
  if (modelThreshold(model) === 'not_started') {
    score *= 2;
    const dateAdded = getModelDateAdded(model);
    if (dateAdded) {
      const days = Math.floor((Date.now() - dateAdded.getTime()) / 86400000);
      if (days >= 365) score *= 4;
      else if (days >= 180) score *= 3;
      else if (days >= 90) score *= 2;
      else if (days >= 30) score *= 1.5;
    }
  }
  return score;
}

function shameLabel(model) {
  if (modelThreshold(model) !== 'not_started') return null;
  const dateAdded = getModelDateAdded(model);
  if (!dateAdded) return { text: 'Never started', cls: 'shame-fresh' };
  const days = Math.floor((Date.now() - dateAdded.getTime()) / 86400000);
  if (days >= 365) {
    const yrs = Math.floor(days / 365);
    return { text: `${yrs}yr+ collecting dust`, cls: 'shame-ancient' };
  }
  if (days >= 90) {
    const mos = Math.floor(days / 30);
    return { text: `${mos}mo untouched`, cls: 'shame-veteran' };
  }
  if (days >= 30) {
    const mos = Math.floor(days / 30);
    return { text: `${mos}mo untouched`, cls: 'shame-dusty' };
  }
  return { text: 'Never started', cls: 'shame-fresh' };
}

const PICTO_CAP = 150;
const FIG_MIN_W = 8;
const FIG_MAX_W = 22;
const FIG_ASPECT = 32 / 24; // matches the #miniFig symbol's viewBox (0 0 24 32) — default for any type without its own icon

// Model types with a dedicated silhouette instead of the default standing
// figure, keyed by model type id (not group — Vehicle and Skimmer share a
// color group but get different shapes). `mult` scales the figure up beyond
// its points-driven size so hardware/mounts read as visibly bigger than a
// same-scoring infantry model, not just a bigger person.
const ICON_CONFIG = {
  vehicle: { symbol: 'miniTank',    aspect: 20 / 34, mult: 1.6  },
  skimmer: { symbol: 'miniSkimmer', aspect: 15 / 34, mult: 1.5  },
  cavalry: { symbol: 'miniCavalry', aspect: 28 / 34, mult: 1.15 },
  walker:  { symbol: 'miniWalker',  aspect: 28 / 26, mult: 1.2  },
};

const GROUP_CLASS = {
  'Infantry-scale': 'fig-grp-infantry',
  'Mounted':        'fig-grp-mounted',
  'Large':          'fig-grp-large',
  'Characters':     'fig-grp-characters',
  'Vehicles':       'fig-grp-vehicles',
  'Special':        'fig-grp-special',
  'Custom':         'fig-grp-custom',
  'Other':          'fig-grp-other',
};

// Relative sizing is scaled against the spread of per-model hobby points
// across the whole collection (a single model of each type, not a squad's
// batch total), so a Dragon-sized entry dwarfs an Ogre, which in turn dwarfs
// a rank-and-file infantry model — regardless of how many are in the unit.
function modelPointsRange() {
  const totals = Object.values(appData.models).map(m => singleModelPoints(m) || 1);
  if (!totals.length) return { min: 1, max: 1 };
  return { min: Math.min(...totals), max: Math.max(...totals) };
}

function figSize(pts, minPts, maxPts) {
  if (maxPts <= minPts) return FIG_MIN_W;
  const t = Math.sqrt(Math.max(0, Math.min(1, (pts - minPts) / (maxPts - minPts))));
  return Math.round((FIG_MIN_W + t * (FIG_MAX_W - FIG_MIN_W)) * 10) / 10;
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Renders every model in `entries` as one merged, flowing pile (rather than a
// separate row per model) so figures for the same game system sit together;
// color encodes the model group, size encodes hobby-point "bigness", and each
// figure is clickable/focusable to reveal which model + type it represents.
function pictoPileHtml(entries, sectionCls, minPts, maxPts) {
  let figsHtml = '';
  let shown = 0;
  let totalCount = 0;
  entries.forEach(({ model: m, count }) => {
    totalCount += count;
    const groupCls = GROUP_CLASS[resolveModelGroup(m)] || GROUP_CLASS.Other;
    const type = getModelType(m.modelTypeId);
    const icon = ICON_CONFIG[type?.id];
    const symbolId = icon ? icon.symbol : 'miniFig';
    const name = escAttr(m.name);
    const typeName = escAttr(type ? type.name : 'Unknown type');
    let w = figSize(singleModelPoints(m) || 1, minPts, maxPts);
    if (icon) w = Math.round(w * icon.mult * 10) / 10;
    const h = Math.round(w * (icon ? icon.aspect : FIG_ASPECT) * 10) / 10;
    for (let i = 0; i < count; i++) {
      if (shown >= PICTO_CAP) return;
      shown++;
      figsHtml += `<svg class="fig ${sectionCls} ${groupCls}" width="${w}" height="${h}" tabindex="0" role="button" data-model-name="${name}" data-type-name="${typeName}"><title>${name} — ${typeName}</title><use href="#${symbolId}"></use></svg>`;
    }
  });
  if (totalCount > PICTO_CAP) {
    figsHtml += `<span class="picto-overflow" title="${totalCount - PICTO_CAP} more">+${totalCount - PICTO_CAP}</span>`;
  }
  return `<div class="picto-figs">${figsHtml}</div>`;
}

// Vehicles group uses the tank shape as its representative swatch even
// though Skimmer (also in that group) renders differently in the pile itself
// — the legend communicates color-to-group, not every shape variant within it.
function pictoLegendHtml(entries) {
  const present = new Set(entries.map(({ model: m }) => resolveModelGroup(m)));
  const items = MODEL_GROUP_ORDER.filter(g => present.has(g)).map(g => {
    const icon = g === 'Vehicles' ? ICON_CONFIG.vehicle : null;
    const w = icon ? 15 : 10;
    const h = icon ? Math.round(w * icon.aspect * 10) / 10 : 13;
    return `<span class="picto-legend-item"><svg class="fig ${GROUP_CLASS[g]}" width="${w}" height="${h}"><use href="#${icon ? icon.symbol : 'miniFig'}"></use></svg>${g}</span>`;
  }).join('');
  return `<div class="pictograph-legend">${items}<span class="picto-legend-size-note">larger figure = more hobby points</span></div>`;
}

// Wire click/keyboard activation on pictogram figures to reveal the model
// name + type, since the merged pile no longer has a per-model text label.
function wirePictoFigs(container) {
  container.querySelectorAll('.fig[data-model-name]').forEach(fig => {
    const reveal = () => toast(`${fig.dataset.modelName} — ${fig.dataset.typeName}`, 'info', 3200);
    fig.addEventListener('click', reveal);
    fig.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
    });
  });
}

function pileOfPotentialSection() {
  const withUnstarted = Object.values(appData.models)
    .map(m => ({ model: m, unstarted: unstartedCount(m) }))
    .filter(({ unstarted }) => unstarted > 0)
    .map(entry => ({ ...entry, score: shameScore(entry.model, entry.unstarted) }))
    .sort((a, b) => b.score - a.score);

  const totalCount = withUnstarted.reduce((acc, { unstarted }) => acc + unstarted, 0);

  const bySystem = {};
  withUnstarted.forEach(entry => {
    const key = resolveGameSystemId(entry.model) || 'none';
    if (!bySystem[key]) bySystem[key] = [];
    bySystem[key].push(entry);
  });

  const sortedSystems = Object.entries(bySystem)
    .map(([sysId, entries]) => ({ sysId, entries, maxScore: entries[0].score }))
    .sort((a, b) => b.maxScore - a.maxScore);

  const { min: minPts, max: maxPts } = modelPointsRange();

  const systemSections = sortedSystems.map(({ sysId, entries }) => {
    const sys = GAME_SYSTEMS[sysId];
    const sysCount = entries.reduce((a, { unstarted }) => a + unstarted, 0);
    const sysLabel = sys ? sys.shortLabel : 'Unassigned';
    const sysTheme = sys ? sys.theme : '';
    return `
      <div class="pile-system-group">
        <div class="pile-system-header">
          ${sys ? `<span class="sys-tag ${sysTheme}">${sysLabel}</span>` : `<span class="pile-system-label">Unassigned</span>`}
          <span class="pile-system-count">${sysCount} model${sysCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="pile-items">
          ${entries.map(({ model: m, unstarted }) => {
            const label = shameLabel(m);
            return `
              <div class="pile-item">
                <span class="pile-item-name">${m.name}${label ? `<span class="pile-shame-badge ${label.cls}">${label.text}</span>` : ''}</span>
                <span class="pile-item-qty">×${unstarted}</span>
              </div>`;
          }).join('')}
        </div>
        <hr class="pictograph-divider">
        ${pictoPileHtml(entries.map(({ model, unstarted }) => ({ model, count: unstarted })), 'fig-unstarted', minPts, maxPts)}
      </div>`;
  }).join('');

  const isShameHeavy = withUnstarted.some(({ model }) => shameLabel(model)?.cls === 'shame-ancient');

  return `
    <div class="dash-card dash-pile">
      <div class="pile-card-header">
        <h3>Pile of Potential</h3>
        ${withUnstarted.length ? `<button class="btn btn-sm" id="sharePileBtn">📤 Share</button>` : ''}
      </div>
      ${!withUnstarted.length
        ? `<p class="empty-text">Your pile of potential is empty — no models still on the sprue. Impressive!</p>`
        : `
          <div class="pile-total${isShameHeavy ? ' shame-heavy' : ''}">💀 ${totalCount} model${totalCount !== 1 ? 's' : ''} still on the sprue</div>
          <div class="pile-groups">${systemSections}</div>
          ${pictoLegendHtml(withUnstarted)}
        `
      }
    </div>`;
}

function sharePileOfPotential() {
  const withUnstarted = Object.values(appData.models)
    .map(m => ({ model: m, unstarted: unstartedCount(m) }))
    .filter(({ unstarted }) => unstarted > 0)
    .map(entry => ({ ...entry, score: shameScore(entry.model, entry.unstarted) }))
    .sort((a, b) => b.score - a.score);

  if (!withUnstarted.length) return;

  const totalCount = withUnstarted.reduce((acc, { unstarted }) => acc + unstarted, 0);

  const bySystem = {};
  withUnstarted.forEach(entry => {
    const key = resolveGameSystemId(entry.model) || 'none';
    if (!bySystem[key]) bySystem[key] = [];
    bySystem[key].push(entry);
  });

  const sortedSystems = Object.entries(bySystem)
    .map(([sysId, entries]) => ({ sysId, entries, maxScore: entries[0].score }))
    .sort((a, b) => b.maxScore - a.maxScore);

  const systemLines = sortedSystems.map(({ sysId, entries }) => {
    const sys = GAME_SYSTEMS[sysId];
    const sysLabel = sys ? sys.shortLabel : 'Unassigned';
    const sysCount = entries.reduce((a, { unstarted }) => a + unstarted, 0);
    const modelLines = entries.map(({ model: m, unstarted }) => {
      const label = shameLabel(m);
      return `  • ${m.name} ×${unstarted}${label ? ` [${label.text}]` : ''}`;
    }).join('\n');
    return `📦 ${sysLabel} (${sysCount} model${sysCount !== 1 ? 's' : ''}):\n${modelLines}`;
  }).join('\n\n');

  const text = [
    `💀 My Pile of Potential`,
    `${'━'.repeat(24)}`,
    ``,
    `${totalCount} model${totalCount !== 1 ? 's' : ''} still on the sprue...`,
    ``,
    systemLines,
    ``,
    `🎯 Will they ever leave the sprue? The world may never know.`,
  ].join('\n').trim();

  if (navigator.share) {
    navigator.share({ title: 'My Pile of Potential', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text)
      .then(() => toast('Copied to clipboard!', 'success'))
      .catch(() => showPileShareFallback(text));
  }
}

function showPileShareFallback(text) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:0.75em">
      Copy the text below and paste it into WhatsApp or any messenger:
    </p>
    <textarea class="form-input share-text-area" readonly rows="16">${text}</textarea>
    <div class="modal-actions">
      <button class="btn btn-primary" id="shareCopyBtn">📋 Copy</button>
      <button class="btn" id="shareCloseBtn">Close</button>
    </div>
  `;
  content.querySelector('#shareCopyBtn').addEventListener('click', () => {
    content.querySelector('.share-text-area').select();
    document.execCommand('copy');
    toast('Copied!', 'success');
  });
  content.querySelector('#shareCloseBtn').addEventListener('click', () => closeModal());
  showModal({ title: '📤 Share Pile of Potential', content, wide: true });
}

// --- Grey Brigade ---

function greyBrigadeCount(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];

  // This heuristic assumes a single ordered stage track; multi-part entries
  // (hull + crew) don't map onto it, so skip them rather than report bogus counts.
  if (stages.some(s => s.group === 'crew')) return 0;

  const assemblyStage = stages.find(s => s.threshold === 'table_ready');
  if (!assemblyStage) return 0;

  const assembled = Math.min(model.progress[assemblyStage.id]?.done || 0, model.quantity);
  if (assembled === 0) return 0;

  // Stages after Prime (assemblyIdx + 2 onward) up to and including the painted threshold
  const assemblyIdx = stages.indexOf(assemblyStage);
  const paintedStage = stages.find(s => s.threshold === 'painted');
  const paintedIdx = paintedStage ? stages.indexOf(paintedStage) : stages.length - 1;

  const actualPaintingStages = stages
    .slice(assemblyIdx + 2, paintedIdx + 1)
    .filter(s => !skipped.includes(s.id));

  const maxPainted = actualPaintingStages.reduce((max, s) =>
    Math.max(max, model.progress[s.id]?.done || 0), 0);

  return Math.max(0, assembled - maxPainted);
}

function greyBrigadeSection() {
  const withGrey = Object.values(appData.models)
    .map(m => ({ model: m, greyCount: greyBrigadeCount(m) }))
    .filter(({ greyCount }) => greyCount > 0)
    .sort((a, b) => b.greyCount - a.greyCount);

  const totalCount = withGrey.reduce((acc, { greyCount }) => acc + greyCount, 0);

  const bySystem = {};
  withGrey.forEach(entry => {
    const key = resolveGameSystemId(entry.model) || 'none';
    if (!bySystem[key]) bySystem[key] = [];
    bySystem[key].push(entry);
  });

  const sortedSystems = Object.entries(bySystem)
    .map(([sysId, entries]) => ({
      sysId,
      entries,
      total: entries.reduce((a, e) => a + e.greyCount, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const { min: minPts, max: maxPts } = modelPointsRange();

  const systemSections = sortedSystems.map(({ sysId, entries }) => {
    const sys = GAME_SYSTEMS[sysId];
    const sysCount = entries.reduce((a, { greyCount }) => a + greyCount, 0);
    const sysLabel = sys ? sys.shortLabel : 'Unassigned';
    const sysTheme = sys ? sys.theme : '';
    return `
      <div class="pile-system-group">
        <div class="pile-system-header">
          ${sys ? `<span class="sys-tag ${sysTheme}">${sysLabel}</span>` : `<span class="pile-system-label">Unassigned</span>`}
          <span class="pile-system-count">${sysCount} model${sysCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="pile-items">
          ${entries.map(({ model: m, greyCount }) => `
            <div class="pile-item">
              <span class="pile-item-name">${m.name}</span>
              <span class="pile-item-qty">×${greyCount}</span>
            </div>`).join('')}
        </div>
        <hr class="pictograph-divider">
        ${pictoPileHtml(entries.map(({ model, greyCount }) => ({ model, count: greyCount })), 'fig-grey', minPts, maxPts)}
      </div>`;
  }).join('');

  const isShameHeavy = totalCount >= 15;

  return `
    <div class="dash-card dash-grey-brigade">
      <div class="pile-card-header">
        <h3>Grey Brigade</h3>
        ${withGrey.length ? `<button class="btn btn-sm" id="shareGreyBtn">📤 Share</button>` : ''}
      </div>
      ${!withGrey.length
        ? `<p class="empty-text">No models in the Grey Brigade — everything is either still on the sprue or has had paint applied. Nothing languishing in the middle!</p>`
        : `
          <div class="pile-total${isShameHeavy ? ' shame-heavy' : ''}">🩶 ${totalCount} model${totalCount !== 1 ? 's' : ''} assembled or primed, awaiting paint</div>
          <div class="pile-groups">${systemSections}</div>
          ${pictoLegendHtml(withGrey)}
        `
      }
    </div>`;
}

function shareGreyBrigade() {
  const withGrey = Object.values(appData.models)
    .map(m => ({ model: m, greyCount: greyBrigadeCount(m) }))
    .filter(({ greyCount }) => greyCount > 0)
    .sort((a, b) => b.greyCount - a.greyCount);

  if (!withGrey.length) return;

  const totalCount = withGrey.reduce((acc, { greyCount }) => acc + greyCount, 0);

  const bySystem = {};
  withGrey.forEach(entry => {
    const key = resolveGameSystemId(entry.model) || 'none';
    if (!bySystem[key]) bySystem[key] = [];
    bySystem[key].push(entry);
  });

  const sortedSystems = Object.entries(bySystem)
    .map(([sysId, entries]) => ({
      sysId,
      entries,
      total: entries.reduce((a, e) => a + e.greyCount, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const systemLines = sortedSystems.map(({ sysId, entries }) => {
    const sys = GAME_SYSTEMS[sysId];
    const sysLabel = sys ? sys.shortLabel : 'Unassigned';
    const sysCount = entries.reduce((a, { greyCount }) => a + greyCount, 0);
    const modelLines = entries.map(({ model: m, greyCount }) =>
      `  • ${m.name} ×${greyCount}`
    ).join('\n');
    return `🩶 ${sysLabel} (${sysCount} model${sysCount !== 1 ? 's' : ''}):\n${modelLines}`;
  }).join('\n\n');

  const text = [
    `🩶 My Grey Brigade`,
    `${'━'.repeat(24)}`,
    ``,
    `${totalCount} model${totalCount !== 1 ? 's' : ''} assembled or primed, awaiting the brush...`,
    ``,
    systemLines,
    ``,
    `🎨 One day they will be painted. One day.`,
  ].join('\n').trim();

  if (navigator.share) {
    navigator.share({ title: 'My Grey Brigade', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text)
      .then(() => toast('Copied to clipboard!', 'success'))
      .catch(() => showGreyShareFallback(text));
  }
}

function showGreyShareFallback(text) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:0.75em">
      Copy the text below and paste it into WhatsApp or any messenger:
    </p>
    <textarea class="form-input share-text-area" readonly rows="14">${text}</textarea>
    <div class="modal-actions">
      <button class="btn btn-primary" id="greyCopyBtn">📋 Copy</button>
      <button class="btn" id="greyCloseBtn">Close</button>
    </div>
  `;
  content.querySelector('#greyCopyBtn').addEventListener('click', () => {
    content.querySelector('.share-text-area').select();
    document.execCommand('copy');
    toast('Copied!', 'success');
  });
  content.querySelector('#greyCloseBtn').addEventListener('click', () => closeModal());
  showModal({ title: '📤 Share Grey Brigade', content, wide: true });
}

// --- Per-list burndown modal ---
function showListBurndown(listId) {
  const list = appData.lists[listId];
  if (!list) return;

  const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);
  const stats = listStats(list);
  const days = daysUntil(list.deadline);
  const ptsLeft = stats.totalPts - stats.donePts;
  const pace = (days && days > 0) ? (ptsLeft / days).toFixed(1) : null;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="burndown-summary">
      ${progressBar(stats.pct)}
      <div class="burndown-stats">
        <span>${stats.donePts}/${stats.totalPts} pts · ${stats.pct}%</span>
        ${list.deadline ? `<span>📅 ${fmtDateShort(list.deadline)}${days !== null ? ` · ${days >= 0 ? days + ' days left' : Math.abs(days) + ' days overdue'}` : ''}</span>` : ''}
        ${pace ? `<span class="pace-badge">${pace} pts/day needed</span>` : ''}
      </div>
    </div>
    <div class="burndown-chart-tabs">
      <button class="btn btn-sm burndown-tab active" data-tab="burndown">📈 Burndown</button>
      <button class="btn btn-sm burndown-tab" data-tab="stages">📊 By Stage</button>
    </div>
    <div class="chart-wrap chart-wrap-tall" id="burndownChartWrap">
      <canvas id="listBurndownChart"></canvas>
    </div>
    <div class="chart-wrap chart-wrap-tall" id="stageBarWrap" style="display:none">
      <canvas id="listStageBar"></canvas>
    </div>
  `;

  content.querySelectorAll('.burndown-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      content.querySelectorAll('.burndown-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isBurndown = tab.dataset.tab === 'burndown';
      content.querySelector('#burndownChartWrap').style.display = isBurndown ? '' : 'none';
      content.querySelector('#stageBarWrap').style.display = isBurndown ? 'none' : '';
      if (!isBurndown) {
        requestAnimationFrame(() => renderStageBar('listStageBar', models));
      }
    });
  });

  showModal({ title: `📈 ${list.name}`, content, wide: true });

  requestAnimationFrame(() => renderBurndown('listBurndownChart', models, list.deadline || null));
}
