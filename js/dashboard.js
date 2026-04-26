// dashboard.js — dashboard summary, deadline, pace tracking

import { appData, globalStats, saveData } from './data.js';
import { progressBar, toast, daysUntil, today, createDateInput, getDateValue } from './ui.js';
import { renderDashboardCharts } from './charts.js';
import { THRESHOLDS } from './data.js';

export function renderDashboard() {
  const container = document.getElementById('dashboardView');
  if (!container) return;

  const stats = globalStats();
  const deadline = appData.config.deadline;
  const days = daysUntil(deadline);
  const ptsLeft = stats.totalPts - stats.donePts;
  const pace = (days && days > 0) ? (ptsLeft / days).toFixed(1) : null;

  const urgencyClass = days === null ? '' : days < 0 ? 'danger' : days < 14 ? 'warning' : 'ok';

  container.innerHTML = `
    <div class="dashboard-grid">

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

      <div class="dash-card dash-deadline">
        <h3>Deadline & Pace</h3>
        <div class="deadline-input-row">
          <label>Target date</label>
          ${createDateInput('deadlineInput', deadline || '')}
        </div>
        ${deadline ? `
          <div class="deadline-info ${urgencyClass}">
            ${days === null ? '' : days < 0
              ? `<span class="danger-text">⚠️ ${Math.abs(days)} days overdue</span>`
              : `<span>${days} days remaining</span>`
            }
          </div>
          ${pace ? `
            <div class="pace-info">
              You need <b>${pace}</b> hobby points/day to finish on time.
            </div>
            <div class="pace-bar-wrap">
              <div class="pace-label">Points remaining: ${ptsLeft}</div>
            </div>
          ` : '<div class="pace-info">All done! 🎉</div>'}
        ` : '<div class="deadline-hint">Set a deadline to see pace tracking.</div>'}
      </div>

      <div class="dash-card dash-chart-card">
        <h3>Progress by Stage</h3>
        <div class="chart-wrap"><canvas id="progressChart"></canvas></div>
      </div>

      <div class="dash-card dash-chart-card">
        <h3>Burndown</h3>
        <div class="chart-wrap"><canvas id="burndownChart"></canvas></div>
      </div>

      <div class="dash-card dash-recent">
        <h3>Recent Activity</h3>
        ${renderRecentSessions()}
      </div>

    </div>
  `;

  // Handle deadline changes — works for both native date input and dropdowns
  const deadlineEl = document.getElementById('deadlineInput');
  const saveDeadline = () => {
    const val = getDateValue('deadlineInput');
    if (val !== appData.config.deadline) {
      appData.config.deadline = val || null;
      saveData();
      toast('Deadline saved', 'success');
      renderDashboard();
    }
  };
  if (deadlineEl) {
    if (deadlineEl.tagName === 'INPUT') {
      deadlineEl.addEventListener('change', saveDeadline);
    } else {
      deadlineEl.querySelectorAll('select').forEach(sel => sel.addEventListener('change', saveDeadline));
    }
  }

  // Render charts after DOM is ready
  requestAnimationFrame(() => renderDashboardCharts());
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
