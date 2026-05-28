// dashboard.js — dashboard with pie charts and deadline cards

import { appData, globalStats, listStats, saveData, GAME_SYSTEMS, modelThreshold } from './data.js';
import { progressBar, toast, daysUntil, formatDate, localDateStr } from './ui.js';
import { renderCompositionPie, renderCompletionPie, renderBurndown, renderStageBar, renderListCompletionPie } from './charts.js';
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
        <h3>Completion Status</h3>
        <div class="chart-wrap"><canvas id="completionPie"></canvas></div>
      </div>

      <!-- Collection composition pie -->
      <div class="dash-card dash-chart-card">
        <h3>Collection by Game System</h3>
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

    </div>
  `;

  // Wire up deadline card buttons
  container.querySelectorAll('[data-burndown-list]').forEach(btn => {
    btn.addEventListener('click', () => showListBurndown(btn.dataset.burndownList));
  });

  // Pile of Potential share button
  document.getElementById('sharePileBtn')?.addEventListener('click', sharePileOfPotential);

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

  // Render pie charts
  requestAnimationFrame(() => {
    renderCompletionPie('completionPie');
    renderCompositionPie('compositionPie');
    Object.values(appData.lists).forEach(list => {
      const models = (list.modelIds || []).map(id => appData.models[id]).filter(Boolean);
      renderListCompletionPie(`armyPie_${list.id}`, models);
    });
  });
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

  // Most worked on model — by minutes logged (session duration split evenly across models)
  const modelMins = {};
  sessions.forEach(s => {
    const entries = s.modelEntries || [];
    if (!entries.length || !s.duration) return;
    const minsEach = s.duration / entries.length;
    entries.forEach(e => {
      modelMins[e.modelId] = (modelMins[e.modelId] || 0) + minsEach;
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
      <h3>Army Completion Breakdown</h3>
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

function pileOfPotentialSection() {
  const notStarted = Object.values(appData.models)
    .filter(m => modelThreshold(m) === 'not_started');

  const totalCount = notStarted.reduce((acc, m) => acc + m.quantity, 0);

  const bySystem = {};
  notStarted.forEach(m => {
    const key = m.gameSystemId || 'none';
    if (!bySystem[key]) bySystem[key] = [];
    bySystem[key].push(m);
  });

  const systemSections = Object.entries(bySystem).map(([sysId, models]) => {
    const sys = GAME_SYSTEMS[sysId];
    const sysCount = models.reduce((a, m) => a + m.quantity, 0);
    const sysLabel = sys ? sys.shortLabel : 'Unassigned';
    const sysTheme = sys ? sys.theme : '';
    return `
      <div class="pile-system-group">
        <div class="pile-system-header">
          ${sys ? `<span class="sys-tag ${sysTheme}">${sysLabel}</span>` : `<span class="pile-system-label">Unassigned</span>`}
          <span class="pile-system-count">${sysCount} model${sysCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="pile-items">
          ${models.map(m => `
            <div class="pile-item">
              <span class="pile-item-name">${m.name}</span>
              <span class="pile-item-qty">×${m.quantity}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="dash-card dash-pile">
      <div class="pile-card-header">
        <h3>Pile of Potential</h3>
        ${notStarted.length ? `<button class="btn btn-sm" id="sharePileBtn">📤 Share</button>` : ''}
      </div>
      ${!notStarted.length
        ? `<p class="empty-text">Your pile of potential is empty — every model has been started. Impressive!</p>`
        : `
          <div class="pile-total">⬜ ${totalCount} model${totalCount !== 1 ? 's' : ''} awaiting the brush</div>
          <div class="pile-groups">${systemSections}</div>
        `
      }
    </div>`;
}

function sharePileOfPotential() {
  const notStarted = Object.values(appData.models)
    .filter(m => modelThreshold(m) === 'not_started');

  if (!notStarted.length) return;

  const totalCount = notStarted.reduce((acc, m) => acc + m.quantity, 0);

  const bySystem = {};
  notStarted.forEach(m => {
    const key = m.gameSystemId || 'none';
    if (!bySystem[key]) bySystem[key] = [];
    bySystem[key].push(m);
  });

  const systemLines = Object.entries(bySystem).map(([sysId, models]) => {
    const sys = GAME_SYSTEMS[sysId];
    const sysLabel = sys ? sys.shortLabel : 'Unassigned';
    const sysCount = models.reduce((a, m) => a + m.quantity, 0);
    const modelLines = models.map(m => `  • ${m.name} ×${m.quantity}`).join('\n');
    return `📦 ${sysLabel} (${sysCount} model${sysCount !== 1 ? 's' : ''}):\n${modelLines}`;
  }).join('\n\n');

  const text = [
    `⬜ My Pile of Potential`,
    `${'━'.repeat(24)}`,
    ``,
    `${totalCount} model${totalCount !== 1 ? 's' : ''} awaiting the brush...`,
    ``,
    systemLines,
    ``,
    `🎯 Will they ever get painted? The world may never know.`,
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
