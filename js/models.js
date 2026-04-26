// models.js: Model-related UI and logic
import { data, saveData, shortid } from './data.js';
import { renderGroups } from './groups.js';
import { showModal, closeModal } from './ui.js';

export let selectedGroupId = null;
window.selectedGroupId = selectedGroupId;

export function renderModelsForGroup() {
  const col = document.getElementById('modelsCol');
  if (!window.selectedGroupId) {
    col.innerHTML = '<em>Select a collection or subgroup.</em>';
    return;
  }
  const group = data.groups[window.selectedGroupId];
  if (!group) {
    col.innerHTML = '<em>Not found.</em>';
    return;
  }
  col.innerHTML = `<h3>${group.name}</h3>`;
  if (group.modelIds && group.modelIds.length) {
    const ul = document.createElement('ul');
    ul.className = 'model-list';
    group.modelIds.forEach(mid => {
      if (data.models[mid]) ul.appendChild(renderModelNode(data.models[mid]));
    });
    col.appendChild(ul);
  } else {
    col.innerHTML += `<div>No models. <button id="addModelBtn">Add Model/Regiment</button></div>`;
  }
  col.innerHTML += `<button id="addModelBtnBottom">+ Add Model / Regiment</button>`;
}

function renderModelNode(model) {
  const li = document.createElement('li');
  li.className = 'model';
  li.innerHTML = `<span style="cursor:pointer;" data-model-view="${model.id}">${model.name} (<i>${model.quantity}</i>)</span>`;
  let acts = document.createElement('span');
  acts.className = 'model-actions';
  acts.innerHTML = `
    <button data-model-edit="${model.id}">✏️</button>
    <button data-model-delete="${model.id}" class="danger">🗑️</button>
    <button data-model-view="${model.id}">View</button>`;
  li.appendChild(acts);
  return li;
}
