// charts.js — progress and burndown charts

import { appData, globalStats, listStats, modelPoints } from './data.js';

let pieChart = null;
let burnChart = null;

export function renderDashboardCharts(listId = null) {
  renderProgressChart(listId);
  renderBurndownChart(listId);
}

// --- Stage breakdown bar chart ---

function renderProgressChart(listId) {
  const canvas = document.getElementById('progressChart');
  if (!canvas) return;

  const models = listId
    ? (appData.lists[listId]?.modelIds || []).map(id => appData.models[id]).filter(Boolean)
    : Object.values(appData.models);

  const stages = appData.config.stages;
  const labels = stages.map(s => s.name);

  const doneData = stages.map(s =>
    models.reduce((acc, m) => {
      const skipped = m.skippedStages || [];
      if (skipped.includes(s.id)) return acc;
      const prog = m.progress[s.id] || { done: 0 };
      const mStage = (m.stages || stages).find(ms => ms.id === s.id);
      return acc + Math.min(prog.done, m.quantity) * (mStage?.points || s.points || 1);
    }, 0)
  );

  const totalData = stages.map(s =>
    models.reduce((acc, m) => {
      const skipped = m.skippedStages || [];
      if (skipped.includes(s.id)) return acc;
      const mStage = (m.stages || stages).find(ms => ms.id === s.id);
      return acc + m.quantity * (mStage?.points || s.points || 1);
    }, 0)
  );

  const remainData = totalData.map((t, i) => Math.max(0, t - doneData[i]));

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Complete',
          data: doneData,
          backgroundColor: getComputedStyle(document.body).getPropertyValue('--chart-done').trim() || '#4a9d6f',
          borderRadius: 3
        },
        {
          label: 'Remaining',
          data: remainData,
          backgroundColor: getComputedStyle(document.body).getPropertyValue('--chart-remain').trim() || '#3a3a4a',
          borderRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ccc' } }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#aaa' }, grid: { color: '#333' } },
        y: { stacked: true, ticks: { color: '#aaa' }, grid: { color: '#333' }, title: { display: true, text: 'Points', color: '#aaa' } }
      }
    }
  });
}

// --- Burndown chart ---

function renderBurndownChart(listId) {
  const canvas = document.getElementById('burndownChart');
  if (!canvas) return;

  const models = listId
    ? (appData.lists[listId]?.modelIds || []).map(id => appData.models[id]).filter(Boolean)
    : Object.values(appData.models);

  const deadline = appData.config.deadline;
  const today = new Date().toISOString().split('T')[0];

  // Accumulate points by date
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
  let cumulativeDates = [];
  let cum = 0;

  sortedDates.forEach(d => {
    cum += byDay[d];
    cumulativeDates.push({ d, cum });
  });

  // Build date range for chart
  const startDate = sortedDates[0] || today;
  const endDate = deadline || today;
  const allDates = new Set([...sortedDates, today]);
  if (deadline) allDates.add(deadline);

  const dateRange = [...allDates].sort();

  // Actual line
  let cumSoFar = 0;
  const actualData = dateRange.map(d => {
    const entry = cumulativeDates.find(e => e.d === d);
    if (entry) cumSoFar = entry.cum;
    return d <= today ? cumSoFar : null;
  });

  // Ideal line (from 0 to totalPts across date range)
  const idealData = dateRange.map((d, i) =>
    deadline ? Math.round((i / (dateRange.length - 1 || 1)) * totalPts) : null
  );

  if (burnChart) burnChart.destroy();

  burnChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: dateRange,
      datasets: [
        {
          label: 'Points Done',
          data: actualData,
          borderColor: getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#4a9d6f',
          backgroundColor: 'rgba(74,157,111,0.15)',
          pointRadius: 4,
          tension: 0.3,
          fill: true,
          spanGaps: false
        },
        {
          label: 'Ideal',
          data: idealData,
          borderColor: '#888',
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ccc' } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { ticks: { color: '#aaa', maxTicksLimit: 8 }, grid: { color: '#333' } },
        y: {
          ticks: { color: '#aaa' },
          grid: { color: '#333' },
          min: 0,
          max: totalPts || 10,
          title: { display: true, text: 'Points', color: '#aaa' }
        }
      }
    }
  });
}

export function destroyCharts() {
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (burnChart) { burnChart.destroy(); burnChart = null; }
}
