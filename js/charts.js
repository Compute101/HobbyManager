// charts.js — all Chart.js rendering

import { appData, GAME_SYSTEMS } from './data.js';
import { localDateStr } from './ui.js';

// Track chart instances so we can destroy before re-creating
const _charts = {};

function destroyChart(key) {
  if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }
}

function accent() {
  return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#4a9d6f';
}

function gridColor() { return '#2a2a3a'; }
function tickColor() { return '#888'; }

// ----------------------------------------------------------------
// PIE: Collection composition by game system
// ----------------------------------------------------------------
export function renderCompositionPie(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const systemCounts = {};
  let unassigned = 0;

  // Build map: modelId -> set of gameSystemIds it belongs to via lists
  const modelSystems = {};
  Object.values(appData.lists).forEach(list => {
    const col = appData.collections[list.collectionId];
    if (!col) return;
    const sysId = col.gameSystemId;
    (list.modelIds || []).forEach(mid => {
      if (!modelSystems[mid]) modelSystems[mid] = new Set();
      modelSystems[mid].add(sysId);
    });
  });

  // Count quantities per system (model counts in each system it belongs to)
  Object.values(appData.models).forEach(m => {
    const systems = modelSystems[m.id];
    if (!systems || systems.size === 0) {
      unassigned += m.quantity;
    } else {
      systems.forEach(sysId => {
        systemCounts[sysId] = (systemCounts[sysId] || 0) + m.quantity;
      });
    }
  });

  const labels = [];
  const data = [];
  const colors = ['#c8962a', '#c0180c', '#4a9d6f', '#6a5acd', '#e67e22', '#2980b9', '#8e44ad'];
  let colorIdx = 0;
  const bgColors = [];

  Object.entries(systemCounts).forEach(([sysId, count]) => {
    const sys = GAME_SYSTEMS[sysId];
    labels.push(sys ? sys.shortLabel : sysId);
    data.push(count);
    bgColors.push(colors[colorIdx++ % colors.length]);
  });

  if (unassigned > 0) {
    labels.push('Unassigned');
    data.push(unassigned);
    bgColors.push('#444');
  }

  if (!data.length) {
    canvas.parentElement.innerHTML = '<p class="empty-text">Add models to army lists to see composition.</p>';
    return;
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: bgColors, borderColor: '#1a1a2e', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ccc', padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} models` } }
      }
    }
  });
}

// ----------------------------------------------------------------
// PIE: Completion status across whole collection
// ----------------------------------------------------------------
export function renderCompletionPie(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  let finished = 0, painted = 0, tableReady = 0, inProgress = 0;

  Object.values(appData.models).forEach(m => {
    const thresh = calcModelThreshold(m);
    const qty = m.quantity;
    if (thresh === 'finished')     finished   += qty;
    else if (thresh === 'painted') painted    += qty;
    else if (thresh === 'table_ready') tableReady += qty;
    else                           inProgress += qty;
  });

  const total = finished + painted + tableReady + inProgress;
  if (!total) {
    canvas.parentElement.innerHTML = '<p class="empty-text">No models in your pool yet.</p>';
    return;
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['🏆 Finished', '🎨 Painted', '⚔️ Table Ready', '🔧 In Progress'],
      datasets: [{
        data: [finished, painted, tableReady, inProgress],
        backgroundColor: ['#c5a028', '#4a9d6f', '#8b7355', '#2a2a3a'],
        borderColor: '#1a1a2e',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ccc', padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed/total*100)}%)` } }
      }
    }
  });
}

// ----------------------------------------------------------------
// BAR: Stage breakdown for a list (shown in burndown modal)
// ----------------------------------------------------------------
export function renderStageBar(canvasId, models) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const stageMap = {};
  models.forEach(m => {
    (m.stages || appData.config.stages).forEach(s => {
      if (!(m.skippedStages || []).includes(s.id) && !stageMap[s.id]) {
        stageMap[s.id] = { name: s.name, done: 0, total: 0 };
      }
    });
  });

  models.forEach(m => {
    (m.stages || appData.config.stages).forEach(s => {
      if ((m.skippedStages || []).includes(s.id) || !stageMap[s.id]) return;
      stageMap[s.id].total += (s.points || 1) * m.quantity;
      const prog = m.progress[s.id] || { done: 0 };
      stageMap[s.id].done += Math.min(prog.done, m.quantity) * (s.points || 1);
    });
  });

  const labels = Object.values(stageMap).map(s => s.name);
  const doneData = Object.values(stageMap).map(s => s.done);
  const remainData = Object.values(stageMap).map(s => Math.max(0, s.total - s.done));

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Complete', data: doneData, backgroundColor: accent(), borderRadius: 3 },
        { label: 'Remaining', data: remainData, backgroundColor: '#2a2a40', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#ccc' } } },
      scales: {
        x: { stacked: true, ticks: { color: tickColor() }, grid: { color: gridColor() } },
        y: { stacked: true, ticks: { color: tickColor() }, grid: { color: gridColor() },
             title: { display: true, text: 'Points', color: tickColor() } }
      }
    }
  });
}

// ----------------------------------------------------------------
// LINE: Burndown for a specific list (deadline optional)
// ----------------------------------------------------------------
export function renderBurndown(canvasId, models, deadline) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const todayStr = localDateStr(new Date());
  const byDay = {};
  let totalPts = 0;

  models.forEach(m => {
    const stages = m.stages || appData.config.stages;
    const skipped = m.skippedStages || [];
    stages.forEach(s => {
      if (skipped.includes(s.id)) return;
      totalPts += m.quantity * (s.points || 1);
      const prog = m.progress[s.id];
      if (prog?.lastDate && prog.done > 0) {
        const pts = Math.min(prog.done, m.quantity) * (s.points || 1);
        byDay[prog.lastDate] = (byDay[prog.lastDate] || 0) + pts;
      }
    });
  });

  const sortedDates = Object.keys(byDay).sort();
  let cum = 0;
  const cumulativeDates = sortedDates.map(d => { cum += byDay[d]; return { d, cum }; });

  const allDates = new Set([...sortedDates, todayStr]);
  if (deadline) allDates.add(deadline);
  const dateRange = [...allDates].sort();

  let cumSoFar = 0;
  const actualData = dateRange.map(d => {
    const entry = cumulativeDates.find(e => e.d === d);
    if (entry) cumSoFar = entry.cum;
    return d <= todayStr ? cumSoFar : null;
  });

  const datasets = [{
    label: 'Points Done',
    data: actualData,
    borderColor: accent(),
    backgroundColor: accent() + '26',
    pointRadius: 4,
    tension: 0.3,
    fill: true,
    spanGaps: false
  }];

  if (deadline) {
    datasets.push({
      label: 'Ideal',
      data: dateRange.map((_, i) => Math.round((i / (dateRange.length - 1 || 1)) * totalPts)),
      borderColor: '#666',
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
      fill: false
    });
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: dateRange, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ccc' } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { ticks: { color: tickColor(), maxTicksLimit: 8 }, grid: { color: gridColor() } },
        y: {
          min: 0, max: totalPts || 10,
          ticks: { color: tickColor() }, grid: { color: gridColor() },
          title: { display: true, text: 'Points', color: tickColor() }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// Inline threshold helper (avoids circular import)
// ----------------------------------------------------------------
function calcModelThreshold(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const activeStages = stages.filter(s => !skipped.includes(s.id));

  const hasThresholds = stages.some(s => s.threshold);
  if (!hasThresholds) {
    const allDone = activeStages.length > 0 &&
      activeStages.every(s => (model.progress[s.id]?.done || 0) >= model.quantity);
    return allDone ? 'finished' : null;
  }

  for (const thresh of ['finished', 'painted', 'table_ready']) {
    const threshStageIdx = stages.findIndex(s => s.threshold === thresh);
    if (threshStageIdx === -1) continue;
    const allDone = stages.slice(0, threshStageIdx + 1).every(s => {
      if (skipped.includes(s.id)) return true;
      return (model.progress[s.id]?.done || 0) >= model.quantity;
    });
    if (allDone) return thresh;
  }
  return null;
}

export function destroyAllCharts() {
  Object.keys(_charts).forEach(k => { _charts[k].destroy(); delete _charts[k]; });
}
