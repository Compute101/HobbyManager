// dashboard.js — dashboard with pie charts and deadline cards

import { appData, globalStats, listStats, saveData, GAME_SYSTEMS } from './data.js';
import { progressBar, toast, daysUntil } from './ui.js';
import { renderCompositionPie, renderCompletionPie, renderBurndown, renderStageBar } from './charts.js';
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

    </div>
  `;

  // Wire up deadline card buttons
  container.querySelectorAll('[data-burndown-list]').forEach(btn => {
    btn.addEventListener('click', () => showListBurndown(btn.dataset.burndownList));
  });

  // Render pie charts
  requestAnimationFrame(() => {
    renderCompletionPie('completionPie');
    renderCompositionPie('compositionPie');
  });
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

  // Most worked on model
  const modelCounts = {};
  sessions.forEach(s => {
    (s.modelEntries || []).forEach(e => {
      modelCounts[e.modelId] = (modelCounts[e.modelId] || 0) + 1;
    });
  });
  const topModelId = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topModel = topModelId ? appData.models[topModelId] : null;

  // Current streak — consecutive days with sessions
  const sessionDates = new Set(sessions.map(s => s.date).filter(Boolean));
  let streak = 0;
  const today = new Date();
  const check = new Date(today);
  while (true) {
    const dateStr = check.toISOString().split('T')[0];
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
      <div class="deadline-card-date">📅 ${formatDate(list.deadline)} · <span class="deadline-days">${daysLabel}</span></div>
      ${progressBar(stats.pct)}
      <div class="deadline-card-stats">
        <span>${stats.donePts}/${stats.totalPts} pts (${stats.pct}%)</span>
        ${pace ? `<span class="pace-badge">${pace} pts/day needed</span>` : ptsLeft === 0 ? '<span class="pace-badge pace-done">✅ Complete!</span>' : ''}
      </div>
      <button class="btn btn-sm" data-burndown-list="${list.id}">📈 View Burndown</button>
    </div>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderRecentSessions() {
  const sessions = [...appData.sessions].reverse().slice(0, 5);
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
        ${list.deadline ? `<span>📅 ${formatDate(list.deadline)}${days !== null ? ` · ${days >= 0 ? days + ' days left' : Math.abs(days) + ' days overdue'}` : ''}</span>` : ''}
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
