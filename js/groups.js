// groups.js: handles group/collection rendering and management
import { data, saveData } from './data.js';
import { renderModelsForGroup } from './models.js';
import { showModal, closeModal } from './ui.js';

export function groupTypeIcon(type) {
  switch(type) {
    case "collection": return "📦";
    case "army": return "🛡️";
    case "project": return "🗂️";
    case "regiment": return "⚔️";
    default: return "📁";
  }
}

export function renderGroups() {
  let el = document.getElementById("groupList");
  el.innerHTML = "";
  let roots = Object.values(data.groups).filter(g=>!g.parentId);
  roots.forEach(g=>{
    el.appendChild(renderGroupNode(g));
  });
}

function renderGroupNode(group) {
  let li = document.createElement("li");
  li.className = "group";
  li.style.marginLeft = (group.parentId? "1.5em":"0");
  li.innerHTML = `<span data-group-select="${group.id}" style="cursor:pointer">${groupTypeIcon(group.type)} <b>${group.name}</b></span>`;
  let acts = document.createElement("span");
  acts.className = "model-actions";
  acts.innerHTML = `
    <button data-group-edit="${group.id}" title="Edit">✏️</button>
    <button data-group-delete="${group.id}" title="Delete" class="danger">🗑️</button>
    <button data-subgroup-add="${group.id}">+ Subgroup</button>
    <button data-model-add="${group.id}">+ Model</button>`;
  li.appendChild(acts);
  let subs = Object.values(data.groups).filter(g=>g.parentId===group.id);
  if (subs.length) {
    let ul = document.createElement("ul");
    ul.className = "group-list";
    subs.forEach(sub=> ul.appendChild(renderGroupNode(sub)));
    li.appendChild(ul);
  }
  if (group.modelIds && group.modelIds.length) {
    let ul = document.createElement("ul");
    ul.style.marginLeft="1.3em";
    ul.className="model-list";
    group.modelIds.forEach(mid=>{
      if (data.models[mid]) ul.appendChild(renderModelNode(data.models[mid]));
    });
    li.appendChild(ul);
  }
  return li;
}

function renderModelNode(model) {
  let li = document.createElement("li");
  li.className = "model";
  li.innerHTML = `<span style="cursor:pointer;" data-model-view="${model.id}">${model.name} (<i>${model.quantity}</i>)</span>`;
  let acts = document.createElement("span");
  acts.className = "model-actions";
  acts.innerHTML = `
    <button data-model-edit="${model.id}">✏️</button>
    <button data-model-delete="${model.id}" class="danger">🗑️</button>
    <button data-model-view="${model.id}">View</button>`;
  li.appendChild(acts);
  return li;
}

export function setupGroupHandlers() {
  // Attach document click handling for all group/model action buttons (event delegation).
  document.addEventListener('click', function(e) {
    // Group selection
    const selGroup = e.target.closest('[data-group-select]');
    if(selGroup) {
      window.selectedGroupId = selGroup.getAttribute('data-group-select');
      renderModelsForGroup();
      return;
    }
    // Group edit
    const editBtn = e.target.closest('[data-group-edit]');
    if(editBtn) {
      // ... Show edit form ... (implemented in ui.js)
      window.showGroupForm(editBtn.getAttribute('data-group-edit'));
      return;
    }
    // Group delete
    const delBtn = e.target.closest('[data-group-delete]');
    if(delBtn) {
      if (!confirm("Delete group and all subgroups/models?")) return;
      deleteGroup(delBtn.getAttribute('data-group-delete'));
      return;
    }
    // Subgroup add
    const sgBtn = e.target.closest('[data-subgroup-add]');
    if(sgBtn) {
      window.showGroupForm(null, sgBtn.getAttribute('data-subgroup-add'));
      return;
    }
    // Model add
    const modelBtn = e.target.closest('[data-model-add]');
    if(modelBtn) {
      window.showModelForm({groupId: modelBtn.getAttribute('data-model-add')});
      return;
    }
  });
}

function deleteGroup(gid) {
  function del(gid) {
    let g = data.groups[gid];
    (g.modelIds||[]).forEach(mid=>delete data.models[mid]);
    Object.values(data.groups).filter(sg=>sg.parentId===gid).forEach(sg=>del(sg.id));
    delete data.groups[gid];
  }
  del(gid);
  saveData();
  renderGroups();
  renderModelsForGroup();
}
