// data.js: handles all data storage, retrieval, and blank/defaults.

export const blankStages = [
  { name: "Undercoat", points: 1 },
  { name: "Basecoat",  points: 2 },
  { name: "Shade",     points: 1 },
  { name: "Layer",     points: 1 },
  { name: "Highlight", points: 2 },
  { name: "Base",      points: 1 }
];

export let data = {
  groups: {}, // id -> group
  models: {}, // id -> model
  config: { stages:[...blankStages], deadline:null }
};

export function loadData() {
  try {
    let d = localStorage.getItem("minihobby_v1");
    if(d) {
      data = JSON.parse(d);
      if(!data.config) data.config={stages:[...blankStages]};
      if(!data.groups) data.groups={};
      if(!data.models) data.models={};
      if(!data.config.stages) data.config.stages=[...blankStages];
    }
  } catch (e) { alert("Corrupt data in localStorage. Reset? " + e); }
}

export function saveData() {
  localStorage.setItem("minihobby_v1", JSON.stringify(data));
}

export function shortid() { return Math.random().toString(36).substr(2,7); }
