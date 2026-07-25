// data.js — core data model, storage, defaults

export const GAME_SYSTEMS = {
  old_world: {
    id: 'old_world',
    label: 'Warhammer: The Old World',
    shortLabel: 'Old World',
    terms: { army: 'Army', group: 'Regiment', model: 'Warrior', session: 'Campaign' },
    theme: 'theme-old-world'
  },
  wh40k: {
    id: 'wh40k',
    label: 'Warhammer 40,000',
    shortLabel: '40K',
    terms: { army: 'Force', group: 'Squad', model: 'Operative', session: 'Mission' },
    theme: 'theme-40k'
  },
  horus_heresy: {
    id: 'horus_heresy',
    label: 'Horus Heresy',
    shortLabel: 'Heresy',
    terms: { army: 'Legion', group: 'Squad', model: 'Legionary', session: 'Campaign' },
    theme: 'theme-heresy'
  },
  age_of_sigmar: {
    id: 'age_of_sigmar',
    label: 'Age of Sigmar',
    shortLabel: 'AoS',
    terms: { army: 'Warhost', group: 'Warband', model: 'Warrior', session: 'Battle' },
    theme: 'theme-aos'
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    shortLabel: 'Custom',
    terms: { army: 'Army', group: 'Unit', model: 'Model', session: 'Session' },
    theme: 'theme-default'
  }
};

export const DEFAULT_STAGES = [
  { id: 's1', name: 'Assembly',  points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready' },
  { id: 's2', name: 'Prime',     points: 1, phase: 'painting', skippable: false, threshold: null },
  { id: 's3', name: 'Basecoat',  points: 2, phase: 'painting', skippable: false, threshold: null },
  { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
  { id: 's5', name: 'Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null },
  { id: 's6', name: 'Highlight', points: 2, phase: 'painting', skippable: true,  threshold: 'painted' },
  { id: 's7', name: 'Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
];

// Built-in model type presets
export const BUILTIN_MODEL_TYPES = [
  {
    id: 'infantry',
    name: 'Infantry',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 2, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'cavalry',
    name: 'Cavalry',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 3, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 6, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'monster',
    name: 'Monster / Large',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 3, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'behemoth',
    name: 'Behemoth',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 6, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 6, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 6, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 4, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'character',
    name: 'Character / Hero',
    builtIn: true,
    defaultSkipped: ['s8', 's9'],
    stages: [
      { id: 's1', name: 'Assembly',     points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',        points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',        points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight',    points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Face Detail',  points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's8', name: 'Freehand',     points: 4, phase: 'painting', skippable: true,  threshold: null },
      { id: 's9', name: 'OSL',          points: 4, phase: 'painting', skippable: true,  threshold: null },
      { id: 's10', name: 'Basing',      points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'warmachine',
    name: 'War Machine',
    builtIn: true,
    // Crew count varies per machine (2-3 typical), so crew stages are tagged
    // group:'crew' and sized against the model's own crewQuantity instead of
    // its quantity (which is always 1 machine per entry). Threshold tags sit
    // on whichever stage — hull or crew — comes last within its phase, so
    // reaching a milestone always requires both halves to be done.
    defaultCrewQuantity: 3,
    stages: [
      { id: 'h1', name: 'Assembly',       points: 6, phase: 'assembly', skippable: false, threshold: null },
      { id: 'c1', name: 'Crew Assembly',  points: 2, phase: 'assembly', skippable: false, threshold: 'table_ready', group: 'crew' },
      { id: 'h2', name: 'Prime',          points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 'c2', name: 'Crew Prime',     points: 1, phase: 'painting', skippable: false, threshold: null, group: 'crew' },
      { id: 'h3', name: 'Basecoat',       points: 6, phase: 'painting', skippable: false, threshold: null },
      { id: 'c3', name: 'Crew Basecoat',  points: 2, phase: 'painting', skippable: false, threshold: null, group: 'crew' },
      { id: 'h4', name: 'Shade',          points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 'c4', name: 'Crew Shade',     points: 1, phase: 'painting', skippable: false, threshold: null, group: 'crew' },
      { id: 'h5', name: 'Layer',          points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 'c5', name: 'Crew Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null, group: 'crew' },
      { id: 'h6', name: 'Highlight',      points: 6, phase: 'painting', skippable: true,  threshold: null },
      { id: 'c6', name: 'Crew Highlight', points: 2, phase: 'painting', skippable: true,  threshold: 'painted', group: 'crew' },
      { id: 'h7', name: 'Basing',         points: 3, phase: 'basing',   skippable: true,  threshold: null },
      { id: 'c7', name: 'Crew Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished', group: 'crew' },
    ]
  },
  {
    id: 'vehicle',
    name: 'Vehicle',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 5, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 3, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'swarm',
    name: 'Swarm',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 1, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 1, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 1, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 1, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'jetbike',
    name: 'Jetbike',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 3, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'monstrous_cavalry',
    name: 'Monstrous Cavalry',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',     points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight', points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 3, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'chariot',
    name: 'Chariot',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',     points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',     points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',        points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight',    points: 3, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Crew Detail',  points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's8', name: 'Basing',       points: 3, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'character_horse',
    name: 'Character on Horseback',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',     points: 3, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',     points: 6, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',        points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight',    points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Horse Detail', points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's8', name: 'Face Detail',  points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's9', name: 'Basing',       points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'walker',
    name: 'Walker / Dreadnought',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',     points: 5, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',     points: 5, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Shade',        points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Layer',        points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's6', name: 'Highlight',    points: 4, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Panel Detail', points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's8', name: 'Basing',       points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'character_monster',
    name: 'Character on Ridden Monster',
    builtIn: true,
    stages: [
      { id: 's1',  name: 'Assembly',         points: 6, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2',  name: 'Prime',            points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's3',  name: 'Monster Basecoat', points: 5, phase: 'painting', skippable: false, threshold: null },
      { id: 's4',  name: 'Monster Shade',    points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's5',  name: 'Rider Basecoat',   points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's6',  name: 'Rider Shade',      points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's7',  name: 'Layer',            points: 3, phase: 'painting', skippable: true,  threshold: null },
      { id: 's8',  name: 'Highlight',        points: 5, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's9',  name: 'Face Detail',      points: 2, phase: 'painting', skippable: true,  threshold: null },
      { id: 's10', name: 'Basing',           points: 2, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
  {
    id: 'terrain',
    name: 'Terrain / Scenery',
    builtIn: true,
    stages: [
      { id: 's1', name: 'Assembly',  points: 4, phase: 'assembly', skippable: false, threshold: 'table_ready' },
      { id: 's2', name: 'Prime',     points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's3', name: 'Basecoat',  points: 3, phase: 'painting', skippable: false, threshold: null },
      { id: 's4', name: 'Drybrush',  points: 4, phase: 'painting', skippable: false, threshold: null },
      { id: 's5', name: 'Wash',      points: 2, phase: 'painting', skippable: false, threshold: null },
      { id: 's6', name: 'Details',   points: 2, phase: 'painting', skippable: true,  threshold: 'painted' },
      { id: 's7', name: 'Basing',    points: 1, phase: 'basing',   skippable: true,  threshold: 'finished' },
    ]
  },
];

// Get all model types (built-in + custom), applying any user overrides to built-in stages
export function getAllModelTypes() {
  const overrides = appData.config.modelTypeOverrides || {};
  const custom = appData.config.modelTypes || [];
  const builtIn = BUILTIN_MODEL_TYPES.map(t =>
    overrides[t.id] ? { ...t, stages: overrides[t.id] } : t
  );
  return [...builtIn, ...custom];
}

export function getModelType(id) {
  return getAllModelTypes().find(t => t.id === id) || null;
}

export function saveModelTypeOverride(typeId, stages) {
  if (!appData.config.modelTypeOverrides) appData.config.modelTypeOverrides = {};
  appData.config.modelTypeOverrides[typeId] = stages;
  saveData();
}

export function resetModelTypeOverride(typeId) {
  if (!appData.config.modelTypeOverrides) return;
  delete appData.config.modelTypeOverrides[typeId];
  saveData();
}

export function saveCustomModelType(typeObj) {
  if (!appData.config.modelTypes) appData.config.modelTypes = [];
  const idx = appData.config.modelTypes.findIndex(t => t.id === typeObj.id);
  if (idx >= 0) {
    appData.config.modelTypes[idx] = typeObj;
  } else {
    appData.config.modelTypes.push(typeObj);
  }
  saveData();
}

export function deleteCustomModelType(id) {
  if (!appData.config.modelTypes) return;
  appData.config.modelTypes = appData.config.modelTypes.filter(t => t.id !== id);
  saveData();
}

// Thresholds: what milestone each model can reach
export const THRESHOLDS = {
  table_ready: { id: 'table_ready', label: 'Table Ready', icon: '⚔️', color: '#8b7355' },
  painted:     { id: 'painted',     label: 'Painted',     icon: '🎨', color: '#4a9d6f' },
  finished:    { id: 'finished',    label: 'Finished',    icon: '🏆', color: '#c5a028' },
};

export let appData = {
  // Global model pool: id -> model
  models: {},
  // Collections / game systems: id -> collection
  collections: {},
  // Army lists: id -> list
  lists: {},
  // Painting sessions: id -> session
  sessions: [],
  // Global config
  config: {
    stages: [...DEFAULT_STAGES],
    deadline: null,
    activeTheme: 'theme-default',
    modelTypes: [],
    modelTypeOverrides: {},
    weeklyGoal: 0,
    imageSize: 'small',
    pieChartMode: 'count',
    monthlyBudgetGBP: 0,
    budgetPeriod: 'monthly' // 'monthly' | 'annual' — display/input preference; monthlyBudgetGBP stays the source of truth
  },
  folders: {}, // id -> { id, name, collapsed }
  queues: {},  // id -> { id, name, entries: [{id, modelId, note}] }
  // id -> { id, name, gameSystemId, worth, reason, plannedMonth, collectionId, itemType, status, promotedModelId, purchaseDate }
  // itemType: 'model' (joins the pile on promotion) | 'gift' | 'codex' | 'sundry' (ledger-only, never joins the pile)
  purchaseQueue: {}
};

// Convert a UTC date string (YYYY-MM-DD) to the equivalent local date string.
// UTC midnight is shifted to local time; for UTC+1 (BST) this stays the same date.
function utcToLocal(utcDateStr) {
  if (!utcDateStr) return utcDateStr;
  const [y, m, d] = utcDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const ly = date.getFullYear();
  const lm = String(date.getMonth() + 1).padStart(2, '0');
  const ld = String(date.getDate()).padStart(2, '0');
  return `${ly}-${lm}-${ld}`;
}

// Convert a local date string back to UTC by treating the local date as local noon
// (noon local always maps to the same UTC date as UTC midnight for that date,
// covering all standard timezones from UTC-11 to UTC+12).
function localToUtc(localDateStr) {
  if (!localDateStr) return localDateStr;
  const [y, m, d] = localDateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString().split('T')[0];
}

export function loadData() {
  try {
    const raw = localStorage.getItem('hobbymanager_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge to ensure new fields exist
      appData = {
        models: parsed.models || {},
        collections: parsed.collections || {},
        lists: parsed.lists || {},
        // Convert stored UTC session dates to local on load
        sessions: (parsed.sessions || []).map(s => s.date ? { ...s, date: utcToLocal(s.date) } : s),
        folders: parsed.folders || {},
        queues: parsed.queues || {},
        purchaseQueue: parsed.purchaseQueue || {},
        config: {
          stages: parsed.config?.stages || [...DEFAULT_STAGES],
          deadline: parsed.config?.deadline || null,
          activeTheme: parsed.config?.activeTheme || 'theme-default',
          modelTypes: parsed.config?.modelTypes || [],
          modelTypeOverrides: parsed.config?.modelTypeOverrides || {},
          weeklyGoal: parsed.config?.weeklyGoal || 0,
          imageSize: parsed.config?.imageSize || 'small',
          pieChartMode: parsed.config?.pieChartMode || 'count',
          monthlyBudgetGBP: parsed.config?.monthlyBudgetGBP || 0,
          budgetPeriod: parsed.config?.budgetPeriod || 'monthly'
        }
      };
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

export function saveData() {
  try {
    // Convert in-memory local session dates back to UTC before persisting
    const dataToSave = {
      ...appData,
      sessions: appData.sessions.map(s => s.date ? { ...s, date: localToUtc(s.date) } : s)
    };
    localStorage.setItem('hobbymanager_v2', JSON.stringify(dataToSave));
    driveSync.callback?.(dataToSave);
  } catch (e) {
    console.error('Failed to save data:', e);
    alert('Could not save data — storage may be full.');
  }
}

// Replace all in-memory data with a parsed snapshot (e.g. loaded from Drive).
// Applies the same UTC→local date conversion as loadData(), then persists to localStorage.
export function replaceData(parsed) {
  if (!parsed?.models || !parsed?.collections) throw new Error('Invalid data structure');
  appData = {
    models: parsed.models || {},
    collections: parsed.collections || {},
    lists: parsed.lists || {},
    sessions: (parsed.sessions || []).map(s => s.date ? { ...s, date: utcToLocal(s.date) } : s),
    folders: parsed.folders || {},
    queues: parsed.queues || {},
    purchaseQueue: parsed.purchaseQueue || {},
    config: {
      stages: parsed.config?.stages || [...DEFAULT_STAGES],
      deadline: parsed.config?.deadline || null,
      activeTheme: parsed.config?.activeTheme || 'theme-default',
      modelTypes: parsed.config?.modelTypes || [],
      modelTypeOverrides: parsed.config?.modelTypeOverrides || {},
      weeklyGoal: parsed.config?.weeklyGoal || 0,
      imageSize: parsed.config?.imageSize || 'small',
      pieChartMode: parsed.config?.pieChartMode || 'count',
      monthlyBudgetGBP: parsed.config?.monthlyBudgetGBP || 0,
      budgetPeriod: parsed.config?.budgetPeriod || 'monthly'
    }
  };
  saveData();
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Set by index.html to trigger a debounced Drive upload after every save.
export const driveSync = { callback: null };

// --- Model helpers ---

export function getModel(id) { return appData.models[id]; }

export function getAllModels() { return Object.values(appData.models); }

export function createModel({ name, quantity = 1, notes = '', gameSystemId = null, stages = null, skippedStages = [], folderId = null, image = null, modelTypeId = null, crewQuantity = null, worth = null, sentimentLove = null, purchaseDate = null, resaleValue = null }) {
  const id = uid();
  const modelStages = stages || appData.config.stages.map(s => ({ ...s }));
  appData.models[id] = {
    id, name, quantity, notes, gameSystemId, folderId, image,
    stages: modelStages,
    skippedStages,
    modelTypeId,
    crewQuantity,
    worth,
    sentimentLove,
    purchaseDate,
    resaleValue,
    dateAdded: new Date().toISOString().slice(0, 10),
    progress: {},
    sessions: []
  };
  saveData();
  return id;
}

// The denominator a stage's progress is tracked against: a model's own
// quantity normally, or its crewQuantity for stages tagged group:'crew'
// (used by multi-part entries like War Machines, where crew count varies
// independently of the 1 machine the entry otherwise represents).
export function stageCap(stage, model) {
  if (stage && stage.group === 'crew') return model.crewQuantity || 0;
  return model.quantity;
}

export function updateModel(id, fields) {
  if (!appData.models[id]) return;
  Object.assign(appData.models[id], fields);
  saveData();
}

export function deleteModel(id) {
  Object.values(appData.lists).forEach(list => {
    list.modelIds = list.modelIds.filter(mid => mid !== id);
    if (list.modelSplits) delete list.modelSplits[id];
  });
  delete appData.models[id];
  saveData();
}

export function logProgress(modelId, stageId, done, date) {
  const model = appData.models[modelId];
  if (!model) return;
  const stage = (model.stages || appData.config.stages).find(s => s.id === stageId);
  const cap = stageCap(stage, model);
  if (!model.progress[stageId]) model.progress[stageId] = { done: 0, lastDate: null };
  model.progress[stageId].done = Math.max(0, Math.min(done, cap));
  model.progress[stageId].lastDate = date;
  saveData();
}

// --- Stats helpers ---

export function modelThreshold(model) {
  // Returns highest threshold reached: 'finished' | 'painted' | 'table_ready' | null | 'not_started'
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const activeStages = stages.filter(s => !skipped.includes(s.id));
  const hasAnyProgress = activeStages.some(s => (model.progress[s.id]?.done || 0) > 0);

  const hasThresholds = stages.some(s => s.threshold);
  if (!hasThresholds) {
    const allDone = activeStages.length > 0 &&
      activeStages.every(s => (model.progress[s.id]?.done || 0) >= stageCap(s, model));
    if (allDone) return 'finished';
    return hasAnyProgress ? null : 'not_started';
  }

  // Standard logic: check highest threshold first
  for (const thresh of ['finished', 'painted', 'table_ready']) {
    const threshStageIdx = stages.findIndex(s => s.threshold === thresh);
    if (threshStageIdx === -1) continue;
    const allDone = stages.slice(0, threshStageIdx + 1).every(s => {
      if (skipped.includes(s.id)) return true;
      return (model.progress[s.id]?.done || 0) >= stageCap(s, model);
    });
    if (allDone) return thresh;
  }
  return hasAnyProgress ? null : 'not_started';
}

export function unstartedCount(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const activeStages = stages.filter(s => !skipped.includes(s.id));
  if (stages.some(s => s.group === 'crew')) {
    // Multi-part entries (e.g. War Machine + crew) are always exactly 1 unit —
    // "on the sprue" just means nothing on either the hull or crew side has begun.
    const hasAnyProgress = activeStages.some(s => (model.progress[s.id]?.done || 0) > 0);
    return hasAnyProgress ? 0 : model.quantity;
  }
  const maxDone = activeStages.reduce((max, s) => Math.max(max, model.progress[s.id]?.done || 0), 0);
  return Math.max(0, model.quantity - maxDone);
}

// Splits a unit's quantity across threshold tiers instead of bucketing the
// whole unit by whether EVERY model in it has crossed a given tier — e.g. a
// unit of 20 with 18 finished and 2 untouched reports {finished:18, ..., notStarted:2}
// rather than treating the whole 20 as a single not-yet-finished blob.
function thresholdBreakdown(stages, skipped, qty, doneAt) {
  const activeStages = stages.filter(s => !skipped.includes(s.id));
  const reachedThrough = idx => {
    let min = qty;
    for (let i = 0; i <= idx; i++) {
      if (skipped.includes(stages[i].id)) continue;
      min = Math.min(min, doneAt(stages[i]));
    }
    return min;
  };
  const maxStarted = activeStages.reduce((max, s) => Math.max(max, doneAt(s)), 0);

  const hasThresholds = stages.some(s => s.threshold);
  if (!hasThresholds) {
    const finished = activeStages.length ? reachedThrough(stages.length - 1) : 0;
    const inProgress = Math.max(0, maxStarted - finished);
    const notStarted = Math.max(0, qty - finished - inProgress);
    return { finished, painted: 0, tableReady: 0, inProgress, notStarted };
  }

  const counts = { finished: 0, painted: 0, tableReady: 0 };
  let prevReached = 0;
  ['finished', 'painted', 'table_ready'].forEach(thresh => {
    const idx = stages.findIndex(s => s.threshold === thresh);
    if (idx === -1) return;
    const reached = reachedThrough(idx);
    counts[thresh === 'table_ready' ? 'tableReady' : thresh] = Math.max(0, reached - prevReached);
    prevReached = reached;
  });

  const inProgress = Math.max(0, maxStarted - prevReached);
  const notStarted = Math.max(0, qty - prevReached - inProgress);
  return { ...counts, inProgress, notStarted };
}

// Per-tier counts for a whole model entry (finished/painted/tableReady/inProgress/notStarted sum to model.quantity).
export function modelThresholdBreakdown(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  if (stages.some(s => s.group === 'crew')) {
    // Mixed-denominator entries (hull qty vs crew qty) aren't a batch that can be
    // bucketed fractionally — they're always 1 unit, gated all-or-nothing by modelThreshold.
    const thresh = modelThreshold(model);
    const counts = { finished: 0, painted: 0, tableReady: 0, inProgress: 0, notStarted: 0 };
    if (thresh === 'finished') counts.finished = model.quantity;
    else if (thresh === 'painted') counts.painted = model.quantity;
    else if (thresh === 'table_ready') counts.tableReady = model.quantity;
    else if (thresh === null) counts.inProgress = model.quantity;
    else counts.notStarted = model.quantity;
    return counts;
  }
  return thresholdBreakdown(stages, skipped, model.quantity, s => Math.min(model.progress[s.id]?.done || 0, model.quantity));
}

// Per-tier counts for a virtual slice of a model (most-finished-first ordering), mirroring splitModelThreshold.
function splitThresholdBreakdown(model, splitSize, offset) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const doneAt = s => {
    const rawDone = model.progress[s.id]?.done || 0;
    return Math.max(0, Math.min(rawDone - offset, splitSize));
  };
  return thresholdBreakdown(stages, skipped, splitSize, doneAt);
}

export function modelPoints(model) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  let total = 0, done = 0;
  stages.forEach(s => {
    if (skipped.includes(s.id)) return;
    const cap = stageCap(s, model);
    const pts = (s.points || 1) * cap;
    const prog = model.progress[s.id] || { done: 0 };
    total += pts;
    done += Math.min(prog.done, cap) * (s.points || 1);
  });
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

export function listStats(list) {
  const modelSplits = list.modelSplits || {};
  let totalPts = 0, donePts = 0;
  let tableReady = 0, painted = 0, finished = 0, total = 0;

  (list.modelIds || []).forEach(id => {
    const m = appData.models[id];
    if (!m) return;
    const splits = modelSplits[id];
    if (splits && splits.length > 0) {
      let offset = 0;
      splits.forEach(split => {
        if (split.inList) {
          const pts = splitModelPoints(m, split.size, offset);
          const b = splitThresholdBreakdown(m, split.size, offset);
          totalPts += pts.total;
          donePts += pts.done;
          total += split.size;
          tableReady += b.finished + b.painted + b.tableReady;
          painted += b.finished + b.painted;
          finished += b.finished;
        }
        offset += split.size;
      });
    } else {
      const pts = modelPoints(m);
      const b = modelThresholdBreakdown(m);
      totalPts += pts.total;
      donePts += pts.done;
      total += m.quantity;
      tableReady += b.finished + b.painted + b.tableReady;
      painted += b.finished + b.painted;
      finished += b.finished;
    }
  });

  return {
    total, tableReady, painted, finished,
    totalPts, donePts,
    pct: totalPts ? Math.round(donePts / totalPts * 100) : 0
  };
}

export function globalStats() {
  const models = getAllModels();
  let totalPts = 0, donePts = 0;
  let tableReady = 0, painted = 0, finished = 0, total = 0;

  models.forEach(m => {
    const pts = modelPoints(m);
    const b = modelThresholdBreakdown(m);
    totalPts += pts.total;
    donePts += pts.done;
    total += m.quantity;
    tableReady += b.finished + b.painted + b.tableReady;
    painted += b.finished + b.painted;
    finished += b.finished;
  });

  return { total, tableReady, painted, finished, totalPts, donePts, pct: totalPts ? Math.round(donePts / totalPts * 100) : 0 };
}

// --- Collection helpers ---

export function createCollection({ name, gameSystemId, deadline = null }) {
  const id = uid();
  appData.collections[id] = { id, name, gameSystemId, deadline, listIds: [] };
  saveData();
  return id;
}

export function deleteCollection(id) {
  const col = appData.collections[id];
  if (col) {
    col.listIds.forEach(lid => delete appData.lists[lid]);
  }
  delete appData.collections[id];
  saveData();
}

// --- List helpers ---

export function createList({ name, collectionId }) {
  const id = uid();
  appData.lists[id] = { id, name, collectionId, modelIds: [] };
  const col = appData.collections[collectionId];
  if (col) col.listIds.push(id);
  saveData();
  return id;
}

export function deleteList(id) {
  const list = appData.lists[id];
  if (list) {
    const col = appData.collections[list.collectionId];
    if (col) col.listIds = col.listIds.filter(lid => lid !== id);
  }
  delete appData.lists[id];
  saveData();
}

export function addModelToList(listId, modelId) {
  const list = appData.lists[listId];
  if (list && !list.modelIds.includes(modelId)) {
    list.modelIds.push(modelId);
    saveData();
  }
}

export function removeModelFromList(listId, modelId) {
  const list = appData.lists[listId];
  if (list) {
    list.modelIds = list.modelIds.filter(id => id !== modelId);
    if (list.modelSplits) delete list.modelSplits[modelId];
    saveData();
  }
}

export function setModelSplits(listId, modelId, splits) {
  const list = appData.lists[listId];
  if (!list) return;
  if (!list.modelSplits) list.modelSplits = {};
  list.modelSplits[modelId] = splits;
  saveData();
}

export function removeModelSplits(listId, modelId) {
  const list = appData.lists[listId];
  if (!list || !list.modelSplits) return;
  delete list.modelSplits[modelId];
  saveData();
}

// Returns points for a virtual slice of a model (most-finished-first ordering).
// offset = number of models in preceding splits; splitSize = models in this split.
export function splitModelPoints(model, splitSize, offset) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  let total = 0, done = 0;
  stages.forEach(s => {
    if (skipped.includes(s.id)) return;
    total += (s.points || 1) * splitSize;
    const rawDone = model.progress[s.id]?.done || 0;
    const splitDone = Math.max(0, Math.min(rawDone - offset, splitSize));
    done += splitDone * (s.points || 1);
  });
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

// Returns threshold for a virtual slice of a model (most-finished-first ordering).
export function splitModelThreshold(model, splitSize, offset) {
  const stages = model.stages || appData.config.stages;
  const skipped = model.skippedStages || [];
  const activeStages = stages.filter(s => !skipped.includes(s.id));

  const getSplitDone = s => {
    const rawDone = model.progress[s.id]?.done || 0;
    return Math.max(0, Math.min(rawDone - offset, splitSize));
  };

  const hasAnyProgress = activeStages.some(s => getSplitDone(s) > 0);

  const hasThresholds = stages.some(s => s.threshold);
  if (!hasThresholds) {
    const allDone = activeStages.length > 0 && activeStages.every(s => getSplitDone(s) >= splitSize);
    if (allDone) return 'finished';
    return hasAnyProgress ? null : 'not_started';
  }

  for (const thresh of ['finished', 'painted', 'table_ready']) {
    const threshStageIdx = stages.findIndex(s => s.threshold === thresh);
    if (threshStageIdx === -1) continue;
    const allDone = stages.slice(0, threshStageIdx + 1).every(s => {
      if (skipped.includes(s.id)) return true;
      return getSplitDone(s) >= splitSize;
    });
    if (allDone) return thresh;
  }
  return hasAnyProgress ? null : 'not_started';
}

// --- Session helpers ---

export function logSession({ date, duration, notes, modelEntries }) {
  // modelEntries: [{modelId, stageId, qty}]
  // Note: progress is applied separately by the caller via logProgress
  const id = uid();
  const session = { id, date, duration, notes, modelEntries };
  appData.sessions.push(session);
  saveData();
  return id;
}

export function deleteSession(id) {
  appData.sessions = appData.sessions.filter(s => s.id !== id);
  saveData();
}

// --- Folder helpers ---

export function createFolder(name) {
  const id = uid();
  appData.folders[id] = { id, name, collapsed: false };
  saveData();
  return id;
}

export function updateFolder(id, fields) {
  if (!appData.folders[id]) return;
  Object.assign(appData.folders[id], fields);
  saveData();
}

export function deleteFolder(id) {
  // Unassign any models in this folder
  Object.values(appData.models).forEach(m => {
    if (m.folderId === id) m.folderId = null;
  });
  delete appData.folders[id];
  saveData();
}

export function getAllFolders() {
  return Object.values(appData.folders).sort((a, b) => a.name.localeCompare(b.name));
}

// --- Export / Import ---

export function exportJSON() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hobbymanager_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.models || !parsed.collections) throw new Error('Invalid file structure');
        if (!confirm('This will replace all current data. Continue?')) return;
        appData = parsed;
        saveData();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
