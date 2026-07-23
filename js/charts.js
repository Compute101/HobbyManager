// charts.js — all Chart.js rendering

import { appData, GAME_SYSTEMS, modelPoints, modelThresholdBreakdown, stageCap, saveData, unstartedCount } from './data.js';

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
// Pie chart weighting mode — by model count or by hobby points.
// A single global, persisted setting shared by all pool/army pies.
// ----------------------------------------------------------------
export function getPieChartMode() {
  return appData.config.pieChartMode === 'points' ? 'points' : 'count';
}

export function pieModeToggleHtml() {
  const mode = getPieChartMode();
  return `
    <div class="pie-mode-toggle">
      <button class="btn btn-xs pie-mode-btn ${mode === 'count' ? 'active' : ''}" data-pie-mode="count">📦 Models</button>
      <button class="btn btn-xs pie-mode-btn ${mode === 'points' ? 'active' : ''}" data-pie-mode="points">⭐ Points</button>
    </div>
  `;
}

export function wirePieModeToggle(container, onChange) {
  container.querySelectorAll('[data-pie-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newMode = btn.dataset.pieMode;
      if (getPieChartMode() === newMode) return;
      appData.config.pieChartMode = newMode;
      saveData();
      onChange();
    });
  });
}

// Weight of a model entry for these pies: head count, or its total hobby points.
function modelWeight(model, mode) {
  return mode === 'points' ? modelPoints(model).total : model.quantity;
}

// Weight of `count` models out of a unit, for these pies: head count, or their share of hobby points.
function tierWeight(model, count, mode) {
  if (mode !== 'points') return count;
  if (!model.quantity) return 0;
  return count * (modelPoints(model).total / model.quantity);
}

// ----------------------------------------------------------------
// PIE: Collection composition by game system
// ----------------------------------------------------------------
export function renderCompositionPie(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const mode = getPieChartMode();
  const unit = mode === 'points' ? 'pts' : 'models';
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

  // Weight (model count or hobby points) per system it belongs to
  Object.values(appData.models).forEach(m => {
    const systems = modelSystems[m.id];
    const weight = modelWeight(m, mode);
    if (!systems || systems.size === 0) {
      unassigned += weight;
    } else {
      systems.forEach(sysId => {
        systemCounts[sysId] = (systemCounts[sysId] || 0) + weight;
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
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} ${unit}` } }
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

  const mode = getPieChartMode();
  const unit = mode === 'points' ? 'pts' : 'models';
  let finished = 0, painted = 0, tableReady = 0, inProgress = 0, notStarted = 0;

  Object.values(appData.models).forEach(m => {
    const b = modelThresholdBreakdown(m);
    finished   += tierWeight(m, b.finished, mode);
    painted    += tierWeight(m, b.painted, mode);
    tableReady += tierWeight(m, b.tableReady, mode);
    inProgress += tierWeight(m, b.inProgress, mode);
    notStarted += tierWeight(m, b.notStarted, mode);
  });

  const total = finished + painted + tableReady + inProgress + notStarted;
  if (!total) {
    canvas.parentElement.innerHTML = '<p class="empty-text">No models in your pool yet.</p>';
    return;
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['🏆 Finished', '🎨 Painted', '⚔️ Table Ready', '🔧 In Progress', '💀 Not Started'],
      datasets: [{
        data: [finished, painted, tableReady, inProgress, notStarted],
        backgroundColor: ['#c5a028', '#4a9d6f', '#8b7355', '#555570', '#1a1a2e'],
        borderColor: '#1a1a2e',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ccc', padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} ${unit} (${Math.round(ctx.parsed/total*100)}%)` } }
      }
    }
  });
}

// ----------------------------------------------------------------
// PIE: Completion status for a specific army list
// ----------------------------------------------------------------
export function renderListCompletionPie(canvasId, models) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const mode = getPieChartMode();
  const unit = mode === 'points' ? 'pts' : 'models';
  let finished = 0, painted = 0, tableReady = 0, inProgress = 0, notStarted = 0;
  models.forEach(m => {
    const b = modelThresholdBreakdown(m);
    finished   += tierWeight(m, b.finished, mode);
    painted    += tierWeight(m, b.painted, mode);
    tableReady += tierWeight(m, b.tableReady, mode);
    inProgress += tierWeight(m, b.inProgress, mode);
    notStarted += tierWeight(m, b.notStarted, mode);
  });

  const total = finished + painted + tableReady + inProgress + notStarted;
  if (!total) {
    canvas.parentElement.innerHTML = '<p class="empty-text">No models in this list.</p>';
    return;
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['🏆 Finished', '🎨 Painted', '⚔️ Table Ready', '🔧 In Progress', '💀 Not Started'],
      datasets: [{
        data: [finished, painted, tableReady, inProgress, notStarted],
        backgroundColor: ['#c5a028', '#4a9d6f', '#8b7355', '#555570', '#1a1a2e'],
        borderColor: '#1a1a2e',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ccc', padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} ${unit} (${Math.round(ctx.parsed/total*100)}%)` } }
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
      const cap = stageCap(s, m);
      stageMap[s.id].total += (s.points || 1) * cap;
      const prog = m.progress[s.id] || { done: 0 };
      stageMap[s.id].done += Math.min(prog.done, cap) * (s.points || 1);
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

  const todayStr = new Date().toISOString().split('T')[0];
  const byDay = {};
  let totalPts = 0;

  models.forEach(m => {
    const stages = m.stages || appData.config.stages;
    const skipped = m.skippedStages || [];
    stages.forEach(s => {
      if (skipped.includes(s.id)) return;
      const cap = stageCap(s, m);
      totalPts += cap * (s.points || 1);
      const prog = m.progress[s.id];
      if (prog?.lastDate && prog.done > 0) {
        const pts = Math.min(prog.done, cap) * (s.points || 1);
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
  const actualData = [];
  dateRange.forEach(d => {
    const entry = cumulativeDates.find(e => e.d === d);
    if (entry) cumSoFar = entry.cum;
    if (d <= todayStr) actualData.push({ x: d, y: cumSoFar });
  });

  const datasets = [{
    label: 'Points Done',
    data: actualData,
    borderColor: accent(),
    backgroundColor: accent() + '26',
    pointRadius: 4,
    tension: 0.3,
    fill: true
  }];

  if (deadline) {
    datasets.push({
      label: 'Ideal',
      data: [
        { x: dateRange[0], y: 0 },
        { x: deadline, y: totalPts }
      ],
      borderColor: '#666',
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
      fill: false
    });
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ccc' } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'yyyy-MM-dd',
            displayFormats: { day: 'MMM d', week: 'MMM d', month: 'MMM yyyy' }
          },
          ticks: { color: tickColor(), maxTicksLimit: 8 },
          grid: { color: gridColor() }
        },
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
// LINE: Global pile burndown — historical painting velocity (across all
// models) projected forward to estimate when the current pile of unstarted
// models would clear at the current rate.
// ----------------------------------------------------------------

// Trailing-window velocity + projected clear date, computed once and shared
// by the chart and its text summary so they never disagree.
export function pileBurndownStats() {
  const byDay = {};
  Object.values(appData.models).forEach(m => {
    const stages = m.stages || appData.config.stages;
    const skipped = m.skippedStages || [];
    stages.forEach(s => {
      if (skipped.includes(s.id)) return;
      const cap = stageCap(s, m);
      const prog = m.progress[s.id];
      if (prog?.lastDate && prog.done > 0) {
        const pts = Math.min(prog.done, cap) * (s.points || 1);
        byDay[prog.lastDate] = (byDay[prog.lastDate] || 0) + pts;
      }
    });
  });

  const pileRemainingPoints = Object.values(appData.models)
    .filter(m => unstartedCount(m) > 0)
    .reduce((sum, m) => {
      const pts = modelPoints(m);
      return sum + Math.max(0, pts.total - pts.done);
    }, 0);

  const sortedDates = Object.keys(byDay).sort();
  const todayStr = new Date().toISOString().split('T')[0];
  const windowStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const recentPts = sortedDates.filter(d => d >= windowStart).reduce((sum, d) => sum + byDay[d], 0);
  const velocity = recentPts / 30;

  let daysToClear = null, clearDate = null;
  if (velocity > 0 && pileRemainingPoints > 0) {
    daysToClear = Math.ceil(pileRemainingPoints / velocity);
    clearDate = new Date(Date.now() + daysToClear * 86400000).toISOString().split('T')[0];
  }

  return { byDay, sortedDates, todayStr, pileRemainingPoints, velocity, daysToClear, clearDate };
}

export function renderPileBurndown(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const { byDay, sortedDates, todayStr, pileRemainingPoints, daysToClear, clearDate } = pileBurndownStats();

  let cum = 0;
  const cumulativeDates = sortedDates.map(d => { cum += byDay[d]; return { d, cum }; });
  const totalDone = cum;

  const allDates = new Set([...sortedDates, todayStr]);
  const dateRange = [...allDates].sort();

  let cumSoFar = 0;
  const actualData = [];
  dateRange.forEach(d => {
    const entry = cumulativeDates.find(e => e.d === d);
    if (entry) cumSoFar = entry.cum;
    if (d <= todayStr) actualData.push({ x: d, y: cumSoFar });
  });

  const datasets = [{
    label: 'Points Done',
    data: actualData,
    borderColor: accent(),
    backgroundColor: accent() + '26',
    pointRadius: 3,
    tension: 0.3,
    fill: true
  }];

  if (daysToClear && clearDate) {
    datasets.push({
      label: 'Projected pile clear',
      data: [
        { x: todayStr, y: totalDone },
        { x: clearDate, y: totalDone + pileRemainingPoints }
      ],
      borderColor: '#c8962a',
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
      fill: false
    });
  }

  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ccc' } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'yyyy-MM-dd',
            displayFormats: { day: 'MMM d', week: 'MMM d', month: 'MMM yyyy' }
          },
          ticks: { color: tickColor(), maxTicksLimit: 8 },
          grid: { color: gridColor() }
        },
        y: {
          min: 0,
          ticks: { color: tickColor() }, grid: { color: gridColor() },
          title: { display: true, text: 'Points', color: tickColor() }
        }
      }
    }
  });
}

export function destroyAllCharts() {
  Object.keys(_charts).forEach(k => { _charts[k].destroy(); delete _charts[k]; });
}
