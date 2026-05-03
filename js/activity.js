// activity.js — painting activity calendar and session history

import { appData } from './data.js';
import { formatDate } from './ui.js';

export function renderActivity() {
  const container = document.getElementById('activityView');
  if (!container) return;

  const sessions = [...appData.sessions].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="activity-layout">
      <div class="dash-card activity-calendar-card">
        <h3>Painting Activity</h3>
        <div id="activityCalendar"></div>
      </div>
      <div class="dash-card activity-history-card">
        <h3>Session History</h3>
        <div id="sessionHistory"></div>
      </div>
    </div>
  `;

  renderCalendar(sessions);
  renderSessionHistory(sessions);
}

// --- Calendar (GitHub contribution graph style) ---

function renderCalendar(sessions) {
  const container = document.getElementById('activityCalendar');
  if (!container) return;

  // Build a map of date -> points earned (exclude historical sessions with no duration)
  sessions = sessions.filter(s => s.duration);
  const byDate = {};
  sessions.forEach(s => {
    if (!s.date) return;
    const pts = (s.modelEntries || []).reduce((acc, e) => {
      const model = appData.models[e.modelId];
      if (!model) return acc;
      const stage = (model.stages || appData.config.stages).find(st => st.id === e.stageId);
      return acc + (stage?.points || 1);
    }, 0);
    byDate[s.date] = (byDate[s.date] || 0) + pts;
  });

  // Build 52 weeks of dates ending today (all UTC, matching stored session dates)
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Start from the Sunday 52 weeks ago
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (52 * 7) + 1);
  // Rewind to previous Sunday
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const days = [];
  const d = new Date(start);
  while (d <= today) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  // Max points in a day for intensity scaling
  const maxPts = Math.max(1, ...Object.values(byDate));

  // Month labels
  const months = [];
  let lastMonth = -1;
  const weeks = [];
  let week = [];

  days.forEach((date, i) => {
    const pts = byDate[date] || 0;
    const intensity = pts === 0 ? 0 : Math.ceil((pts / maxPts) * 4);
    const month = parseInt(date.split('-')[1]);

    if (month !== lastMonth) {
      months.push({ label: formatDate(date, { month: 'short' }), weekIdx: Math.floor(i / 7) });
      lastMonth = month;
    }

    week.push({ date, pts, intensity });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length) weeks.push(week);

  // Day labels
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  const totalSessions = sessions.length;
  const totalPts = Object.values(byDate).reduce((a, b) => a + b, 0);
  const activeDays = Object.keys(byDate).length;

  container.innerHTML = `
    <div class="cal-summary">
      <span>${totalSessions} sessions</span>
      <span>·</span>
      <span>${totalPts} pts earned</span>
      <span>·</span>
      <span>${activeDays} active days</span>
    </div>
    <div class="cal-outer">
      <div class="cal-wrap">
        <div class="cal-grid-wrap">
          <div class="cal-month-labels">
            ${months.map(m => `<div class="cal-month-label" style="grid-column:${m.weekIdx + 1}">${m.label}</div>`).join('')}
          </div>
          <div class="cal-grid">
            ${weeks.map(week => `
              <div class="cal-week">
                ${week.map(day => `
                  <div class="cal-day cal-intensity-${day.intensity}"
                    title="${day.date}${day.pts ? ': ' + day.pts + ' pts' : ''}"
                    data-date="${day.date}" data-pts="${day.pts}">
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="cal-day-labels">
        ${dayLabels.map(l => `<div class="cal-day-label">${l}</div>`).join('')}
      </div>
    </div>
    <div class="cal-legend">
      <span>Less</span>
      <div class="cal-day cal-intensity-0"></div>
      <div class="cal-day cal-intensity-1"></div>
      <div class="cal-day cal-intensity-2"></div>
      <div class="cal-day cal-intensity-3"></div>
      <div class="cal-day cal-intensity-4"></div>
      <span>More</span>
    </div>
  `;

  // Auto-scroll to show most recent activity (right side)
  requestAnimationFrame(() => {
    const calWrap = container.querySelector('.cal-wrap');
    if (calWrap) calWrap.scrollLeft = calWrap.scrollWidth;
  });

  // Tooltip on hover/tap
  container.querySelectorAll('[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      const date = el.dataset.date;
      const pts = el.dataset.pts;
      if (pts > 0) {
        const daySessions = sessions.filter(s => s.date === date);
        showDayDetail(date, daySessions);
      }
    });
  });
}

function showDayDetail(date, daySessions) {
  const label = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lines = daySessions.map(s => {
    const models = (s.modelEntries || []).map(e => {
      const model = appData.models[e.modelId];
      const stage = (model?.stages || appData.config.stages).find(st => st.id === e.stageId);
      return model ? `${model.name} — ${stage?.name || e.stageId}` : null;
    }).filter(Boolean);
    return `${s.duration ? `⏱️ ${s.duration} mins` : ''}${models.length ? '\n' + models.join('\n') : ''}`;
  }).join('\n\n');

  alert(`${label}\n\n${lines || 'No details recorded.'}`);
}

// --- Session history ---

function renderSessionHistory(sessions) {
  const container = document.getElementById('sessionHistory');
  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = '<p class="empty-text">No sessions logged yet.</p>';
    return;
  }

  // Group by month
  const byMonth = {};
  sessions.forEach(s => {
    const key = s.date?.substring(0, 7) || 'unknown';
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(s);
  });

  container.innerHTML = Object.entries(byMonth).map(([month, monthSessions]) => {
    const label = formatDate(month + '-01', { month: 'long', year: 'numeric' });
    const totalMins = monthSessions.reduce((a, s) => a + (s.duration || 0), 0);
    const totalPts = monthSessions.reduce((acc, s) => {
      return acc + (s.modelEntries || []).reduce((a, e) => {
        const model = appData.models[e.modelId];
        const stage = (model?.stages || appData.config.stages).find(st => st.id === e.stageId);
        return a + (stage?.points || 1);
      }, 0);
    }, 0);

    return `
      <div class="history-month">
        <div class="history-month-header">
          <span class="history-month-label">${label}</span>
          <span class="history-month-stats">${monthSessions.length} sessions · ${totalMins ? totalMins + ' mins · ' : ''}${totalPts} pts</span>
        </div>
        ${monthSessions.map(s => sessionRow(s)).join('')}
      </div>
    `;
  }).join('');
}

function sessionRow(s) {
  const models = (s.modelEntries || []).map(e => {
    const model = appData.models[e.modelId];
    const stage = (model?.stages || appData.config.stages).find(st => st.id === e.stageId);
    return model ? `<span class="session-tag">${model.name} — ${stage?.name || e.stageId}</span>` : null;
  }).filter(Boolean).join('');

  return `
    <div class="session-item">
      <div class="session-item-header">
        <span class="session-date">${s.date}</span>
        ${s.duration ? `<span class="session-dur">⏱️ ${s.duration} mins</span>` : ''}
      </div>
      ${models ? `<div class="session-models">${models}</div>` : ''}
      ${s.notes ? `<div class="session-notes">${s.notes}</div>` : ''}
    </div>
  `;
}
