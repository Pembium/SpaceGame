// ---------- Room Library ----------
// Loaded from room-library.js and exposed on window
const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
const templateById = (id) => (window.ROOM_LIBRARY || []).find(r => r.id === id) || null;

// ---------- State ----------
const state = {
  grid: { rows:5, cols:5, cells:[] }, // each cell: null or instanceId
  inventory: [], // array of instances (unplaced)
  placed: new Map(), // instanceId -> instance
  selectedCellIndex: null,
  selectedTemplateId: null, // selection for click-to-place
  pilotSkill: 0, // pilot skill level for maneuverability calculation
  // --- Ship-level battery for surges (separate from room battery stats)
  shipSurge: 0, // current surge energy (max = number of placed rooms)
  // --- Ship size limits: permissible max rooms without cockpit upgrade
  shipMaxRooms: 6, // allowed caps: 6, 9, 12
  // --- Track which rooms are tuned
  tunedRooms: new Set() // instanceIds of rooms with active tuning
};

function makeInstance(templateId){
  const t = templateById(templateId);
  if(!t) throw new Error("Unknown templateId: " + templateId);
  return {
    instanceId: uid(),
    templateId: t.id,
    type: t.type,
    letter: t.letter,
    name: t.name,
    hpMax: t.hpMax,
    hp: t.hpMax,
    cost: t.cost ?? 0,
    damage: t.damage ?? 0,
    defense: t.defense ?? 0,
    battery: t.battery ?? 0,
    maneuverability: t.maneuverability ?? 0,
    class: t.class ?? "",
    traits: [...t.traits],
    disabled: [...t.disabled],
    stabilized: [...t.stabilized],
    notes: t.notes ?? ""
  };
}

function initGrid(){
  state.grid.cells = Array.from({length: state.grid.rows * state.grid.cols}, () => null);
}

function cellToRC(index){
  return { r: Math.floor(index / state.grid.cols), c: index % state.grid.cols };
}

function firstPlacedCellOfInstance(instanceId){
  return state.grid.cells.findIndex(x => x === instanceId);
}

function placedCounts(){
  const counts = new Map();
  for(const inst of state.placed.values()){
    counts.set(inst.type, (counts.get(inst.type) ?? 0) + 1);
  }
  return counts;
}

function isCockpitUpgraded(){
  // Heuristic: any placed cockpit with traits or name indicating upgrade
  for(const inst of state.placed.values()){
    if(inst.type === "Cockpit"){
      const name = (inst.name || "").toLowerCase();
      const traits = (inst.traits || []).map(x => String(x).toLowerCase());
      if(
        name.includes("upgrade") || name.includes("advanced") || name.includes("mk ii") ||
        traits.some(t => t.includes("upgrade") || t.includes("advanced"))
      ){
        return true;
      }
    }
  }
  return false;
}

function coreStatusText(){
  const counts = placedCounts();
  const need = ["Engine","Shield","Cockpit","Life Support"];
  const ok = need.every(t => (counts.get(t) ?? 0) >= 1);
  const parts = need.map(t => `${t}:${counts.get(t) ?? 0}`);
  return (ok ? "✓ OK " : "✗ MISSING ") + " | " + parts.join("  ");
}

function placedValue(){
  let total = 0;
  for(const inst of state.placed.values()){
    total += (inst.cost ?? 0);
  }
  return total;
}

function shipStats(){
  let totalHp = 0, maxHp = 0, totalDefense = 0, totalBattery = 0, totalManeuverability = 0;
  const weapons = [];
  
  for(const inst of state.placed.values()){
    totalHp += (inst.hp ?? 0);
    maxHp += (inst.hpMax ?? 0);
    totalDefense += (inst.defense ?? 0);
    totalBattery += (inst.battery ?? 0);
    totalManeuverability += (inst.maneuverability ?? 0);
    
    // Add engine speed (trait-based) to maneuverability
    if(inst.type === "Engine" && inst.traits){
      for(const trait of inst.traits){
        const match = trait.match(/Engine Speed \+(\d+)/);
        if(match){
          totalManeuverability += parseInt(match[1]);
        }
      }
    }
    
    if(inst.type === "Weapon" && (inst.damage ?? 0) > 0){
      weapons.push({
        name: inst.name,
        damage: inst.damage,
        hp: inst.hp,
        hpMax: inst.hpMax,
        class: inst.class || ""
      });
    }
  }
  
  // Calculate size penalty: based on number of placed rooms
  const sizePenalty = state.placed.size;
  
  const pilotManeuverability = Math.max(0, state.pilotSkill + totalManeuverability - sizePenalty);
  const shipSurgeMax = state.placed.size; // surge max = number of placed rooms
  
  return {
    hp: totalHp,
    maxHp: maxHp,
    defense: totalDefense,
    battery: totalBattery,
    maneuverability: totalManeuverability - sizePenalty,
    pilotManeuverability: pilotManeuverability,
    weapons: weapons,
    surge: state.shipSurge,
    surgeMax: shipSurgeMax,
    roomCap: state.shipMaxRooms,
    cockpitUpgraded: isCockpitUpgraded()
  };
}

// ---------- Placement (click-to-place) ----------
function takeOneFromInventory(templateId){
  const idx = state.inventory.findIndex(x => x.templateId === templateId);
  if(idx < 0) return null;
  return state.inventory.splice(idx, 1)[0];
}

function removeInstanceFromGrid(instanceId){
  const idx = firstPlacedCellOfInstance(instanceId);
  if(idx >= 0) state.grid.cells[idx] = null;
}

function placeSelectedIntoCell(cellIndex){
  const tid = state.selectedTemplateId;
  if(!tid) return;

  const inst = takeOneFromInventory(tid);
  if(!inst){
    alert("No remaining rooms of that type in Inventory. Add more first.");
    return;
  }

  // Enforce ship size (room count) cap unless cockpit is upgraded
  const currentRooms = state.placed.size;
  const cockpitOk = isCockpitUpgraded();
  const willReplace = Boolean(state.grid.cells[cellIndex]);
  if(!cockpitOk && !willReplace && currentRooms >= state.shipMaxRooms){
    alert(`Room cap reached (${state.shipMaxRooms}). Upgrade/replace the Cockpit to increase capacity (9 or 12).`);
    // put inst back into inventory
    state.inventory.push(inst);
    return;
  }

  // If occupied, confirm replace
  const occupantId = state.grid.cells[cellIndex];
  if(occupantId){
    const occupant = state.placed.get(occupantId);
    const ok = confirm(`Replace ${occupant?.name ?? "existing room"} in this cell? It will return to Inventory.`);
    if(!ok){
      // put inst back into inventory
      state.inventory.push(inst);
      return;
    }
    // remove occupant from grid and return to inventory
    removeInstanceFromGrid(occupantId);
    if(occupant){
      state.placed.delete(occupantId);
      state.inventory.push(occupant);
    }
  }

  // place new instance
  state.placed.set(inst.instanceId, inst);
  state.grid.cells[cellIndex] = inst.instanceId;
}

// ---------- Export / Import ----------
function exportJson(){
  return JSON.stringify({
    version: 2,
    grid: {...state.grid},
    inventory: state.inventory,
    placed: [...state.placed.entries()],
    pilotSkill: state.pilotSkill,
    shipSurge: state.shipSurge,
    shipMaxRooms: state.shipMaxRooms,
    tunedRooms: [...state.tunedRooms],
    selectedTemplateId: null
  }, null, 2);
}

function importJson(text){
  const obj = JSON.parse(text);
  if(!obj || (obj.version !== 1 && obj.version !== 2)) throw new Error("Unsupported save version.");
  if(!obj.grid || !Array.isArray(obj.grid.cells)) throw new Error("Invalid grid in save.");

  state.grid.rows = obj.grid.rows;
  state.grid.cols = obj.grid.cols;
  state.grid.cells = obj.grid.cells.slice();
  state.inventory = Array.isArray(obj.inventory) ? obj.inventory : [];
  state.pilotSkill = obj.pilotSkill ?? 0;
  state.shipSurge = obj.shipSurge ?? 0;
  state.shipMaxRooms = obj.shipMaxRooms ?? state.shipMaxRooms;
  state.tunedRooms = new Set(Array.isArray(obj.tunedRooms) ? obj.tunedRooms : []);
  
  // Restore inventory items with missing fields from templates
  for(const inst of state.inventory){
    if(!inst.cost || !inst.damage || !inst.defense || !inst.battery || inst.maneuverability === undefined){
      const t = templateById(inst.templateId);
      if(t){
        inst.cost = inst.cost ?? t.cost ?? 0;
        inst.damage = inst.damage ?? t.damage ?? 0;
        inst.defense = inst.defense ?? t.defense ?? 0;
        inst.battery = inst.battery ?? t.battery ?? 0;
        inst.maneuverability = inst.maneuverability ?? t.maneuverability ?? 0;
      }
    }
  }
  
  state.placed = new Map(Array.isArray(obj.placed) ? obj.placed : []);
  
  // Restore placed items with missing fields from templates
  for(const inst of state.placed.values()){
    if(!inst.cost || !inst.damage || !inst.defense || !inst.battery || inst.maneuverability === undefined){
      const t = templateById(inst.templateId);
      if(t){
        inst.cost = inst.cost ?? t.cost ?? 0;
        inst.damage = inst.damage ?? t.damage ?? 0;
        inst.defense = inst.defense ?? t.defense ?? 0;
        inst.battery = inst.battery ?? t.battery ?? 0;
        inst.maneuverability = inst.maneuverability ?? t.maneuverability ?? 0;
      }
    }
  }
  
  state.selectedCellIndex = null;
  state.selectedTemplateId = null;
}

// ---------- Surge / tuning ----------
function resetSurge(){
  state.shipSurge = state.placed.size; // surge = number of placed rooms
}

function tuneRoom(instanceId, options = { cost: 10, boost: { maneuverability: 1 } }){
  const inst = state.placed.get(instanceId);
  if(!inst) return false;
  const cost = Number(options.cost) || 0;
  
  // Ensure surge is at least at the room count (auto-restore if needed)
  const maxSurge = state.placed.size;
  if(state.shipSurge > maxSurge) state.shipSurge = maxSurge;
  
  if(state.shipSurge < cost){
    alert(`Not enough surge energy. You have ${state.shipSurge}, need ${cost}. Click 'Reset Surge' to refill.`);
    return false;
  }
  state.shipSurge -= cost;
  // Tuning is tracked in state.tunedRooms set
  return true;
}

// ---------- Rendering ----------
const elCatalog = document.getElementById("catalog");
const elInventory = document.getElementById("inventory");
const elGrid = document.getElementById("grid");
const elDetails = document.getElementById("details");
const elCoreStatus = document.getElementById("coreStatus");
const elModeLine = document.getElementById("modeLine");
const elPlaceHint = document.getElementById("placeHint");
const elSummary = document.getElementById("summary");
const elShipSize = document.getElementById("shipSize");
const elBtnResetSurge = document.getElementById("btnResetSurge");
const elBtnTuneSelected = document.getElementById("btnTuneSelected");
const elShipLayout = document.getElementById("shipLayout");
const elRoomsManagement = document.getElementById("roomsManagement");
const elCatalogPanel = document.getElementById("panelCatalog");
const elToggleCatalog = document.getElementById("btnToggleCatalog");

function renderAll(){
  renderCatalog();
  renderInventory();
  renderGrid();
  renderCore();
  renderValue();
  renderSummary();
  renderShipLayout();
  renderRoomsManagement();
  renderDetails();
  renderModeLine();
}

function renderValue(){
  const elValue = document.getElementById("shipValue");
  if(elValue) elValue.textContent = placedValue() + " credits";
}

function renderModeLine(){
  const tid = state.selectedTemplateId;
  if(!tid){
    elModeLine.textContent = "Select a room in Inventory, then click a grid cell to place it.";
    elPlaceHint.innerHTML = "<b>Placement:</b> Select a room below, then click a grid cell.";
    return;
  }
  const t = templateById(tid);
  elModeLine.textContent = `Placing: ${t?.name ?? tid}. Click a grid cell to place (Cancel to stop).`;
  elPlaceHint.innerHTML = `<b>Placing:</b> <span class="tag">${t?.letter ?? "?"}</span> ${t?.name ?? tid} — click a grid cell.`;
}

function renderCore(){
  elCoreStatus.textContent = coreStatusText();
}

function renderSummary(){
  if(!elSummary) return;
  const stats = shipStats();
  const value = placedValue();
  const counts = placedCounts();
  const coreOk = ["Engine","Shield","Cockpit","Life Support"].every(t => (counts.get(t) ?? 0) >= 1);

  let html = `
    <div class="kvWide" style="margin-bottom:8px;">
      <div class="kvItem"><div class="k">Total Value</div><div class="v" style="color:var(--accent); font-weight:700;">${value} credits</div></div>
      <div class="kvItem"><div class="k">Health</div><div class="v">${stats.hp} / ${stats.maxHp} HP</div></div>
      <div class="kvItem"><div class="k">Shields</div><div class="v">${stats.defense}</div></div>
      <div class="kvItem"><div class="k">Rooms</div><div class="v">${state.placed.size} / ${stats.roomCap} ${stats.cockpitUpgraded ? '(Cockpit upgraded)' : ''}</div></div>
      <div class="kvItem"><div class="k">Ship Surge</div><div class="v">${stats.surge} / ${stats.surgeMax}</div></div>
      <div class="kvItem"><div class="k">Room Battery</div><div class="v">${stats.battery}</div></div>
      <div class="kvItem"><div class="k">Core Status</div><div class="v">${coreOk ? '<span style="color:var(--ok);">✓ OK</span>' : '<span style="color:var(--danger);">✗ MISSING</span>'}</div></div>
      <div class="kvItem"><div class="k">Ship Maneuverability</div><div class="v">${stats.maneuverability}</div></div>
      <div class="kvItem"><div class="k">Pilot Skill</div><div class="v"><input id="pilotSkillInput" type="number" min="0" max="10" value="${state.pilotSkill}" style="width:60px;" /></div></div>
      <div class="kvItem"><div class="k">Total Maneuverability</div><div class="v" style="color:var(--accent); font-weight:700;">${stats.pilotManeuverability}</div></div>
    </div>`;

  if(stats.weapons.length > 0){
    html += `<div class="small" style="margin-top:8px; margin-bottom:4px;"><b>Weapons (${stats.weapons.length})</b></div>`;
    html += `<ul class="list" style="margin-top:2px;">`;
    for(const w of stats.weapons){
      const status = w.hp > 0 ? `<span style="color:var(--ok);">Online</span>` : `<span style="color:var(--danger);">Offline</span>`;
      const classTag = w.class ? `<span class="tag" style="margin-left:6px;">${w.class}</span>` : '';
      html += `<li>${w.name}${classTag}: ${w.damage} dmg (${w.hp}/${w.hpMax} HP) ${status}</li>`;
    }
    html += `</ul>`;
  }

  elSummary.innerHTML = html;

  const pilotSkillInput = document.getElementById("pilotSkillInput");
  if(pilotSkillInput){
    pilotSkillInput.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      state.pilotSkill = Math.max(0, Math.min(10, isFinite(v) ? v : state.pilotSkill));
      renderSummary();
    });
  }

  // Sync ship size selector to state
  if(elShipSize){
    elShipSize.value = String(state.shipMaxRooms);
  }
}

function renderShipLayout(){
  if(!elShipLayout) return;
  
  // Only show cells that have rooms (compact view)
  if(state.placed.size === 0){
    elShipLayout.innerHTML = '<div class="warn" style="text-align:center;">No rooms placed</div>';
    return;
  }
  
  // Find bounding box of placed rooms
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  for(let i=0; i<state.grid.cells.length; i++){
    if(state.grid.cells[i] !== null){
      const {r, c} = cellToRC(i);
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }
  }
  
  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  
  elShipLayout.style.gridTemplateColumns = `repeat(${cols}, minmax(32px, 1fr))`;
  elShipLayout.innerHTML = "";
  
  for(let r = minRow; r <= maxRow; r++){
    for(let c = minCol; c <= maxCol; c++){
      const i = r * state.grid.cols + c;
      const has = state.grid.cells[i] !== null;
      const cell = document.createElement("div");
      cell.className = "miniCell " + (has ? "" : "empty");
      
      if(has){
        const instanceId = state.grid.cells[i];
        const inst = state.placed.get(instanceId);
        if(inst){
          cell.textContent = inst.letter;
          if(state.tunedRooms.has(instanceId)){
            cell.classList.add("tuned");
          }
        }
      }
      
      elShipLayout.appendChild(cell);
    }
  }
}

function renderRoomsManagement(){
  if(!elRoomsManagement) return;
  elRoomsManagement.innerHTML = "";

  if(state.placed.size === 0){
    const empty = document.createElement("div");
    empty.className = "warn";
    empty.textContent = "No rooms placed yet. Add rooms from the catalog and place them on the grid.";
    elRoomsManagement.appendChild(empty);
    return;
  }

  const rooms = [...state.placed.values()].sort((a, b) => a.name.localeCompare(b.name));

  for(const inst of rooms){
    const card = document.createElement("div");
    card.className = "roomCard" + (state.tunedRooms.has(inst.instanceId) ? " tuned" : "");

    const header = document.createElement("div");
    header.className = "roomHeader";

    const titleDiv = document.createElement("div");
    const title = document.createElement("p");
    title.className = "roomTitle";
    title.textContent = inst.name;
    const letter = document.createElement("span");
    letter.className = "tag";
    letter.textContent = inst.letter;
    letter.style.marginLeft = "6px";
    titleDiv.appendChild(title);
    titleDiv.appendChild(letter);

    const tuneBtn = document.createElement("button");
    tuneBtn.className = "btn" + (state.tunedRooms.has(inst.instanceId) ? " sel" : "");
    tuneBtn.textContent = state.tunedRooms.has(inst.instanceId) ? "Tuned" : "Tune";
    tuneBtn.style.fontSize = "11px";
    tuneBtn.style.padding = "4px 8px";
    tuneBtn.onclick = () => {
      if(state.tunedRooms.has(inst.instanceId)){
        state.tunedRooms.delete(inst.instanceId);
      } else {
        const ok = tuneRoom(inst.instanceId, { cost: 1, boost: { maneuverability: 1 } });
        if(ok){
          state.tunedRooms.add(inst.instanceId);
        }
      }
      renderAll();
    };

    header.appendChild(titleDiv);
    header.appendChild(tuneBtn);
    card.appendChild(header);

    const hpDiv = document.createElement("div");
    hpDiv.className = "roomHP";
    const hpLabel = document.createElement("span");
    hpLabel.textContent = "HP:";
    hpLabel.className = "small";
    const hpInput = document.createElement("input");
    hpInput.type = "number";
    hpInput.min = "0";
    hpInput.max = String(inst.hpMax);
    hpInput.value = String(inst.hp);
    hpInput.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      inst.hp = Math.max(0, Math.min(inst.hpMax, isFinite(v) ? v : inst.hp));
      renderGrid();
      renderShipLayout();
      renderSummary();
      renderRoomsManagement();
    });
    const hpMax = document.createElement("span");
    hpMax.className = "small";
    hpMax.textContent = `/ ${inst.hpMax}`;
    hpDiv.appendChild(hpLabel);
    hpDiv.appendChild(hpInput);
    hpDiv.appendChild(hpMax);
    card.appendChild(hpDiv);

    const status = document.createElement("div");
    status.className = "small";
    status.innerHTML = `<b>Status:</b> ${inst.hp > 0 ? '<span style="color:var(--ok);">Online</span>' : '<span style="color:var(--danger);">Offline</span>'}`;
    card.appendChild(status);

    if(inst.traits && inst.traits.length > 0){
      const abilities = document.createElement("div");
      abilities.className = "abilities";
      abilities.innerHTML = `<b>Abilities:</b><ul class="list" style="margin:4px 0 0 0;">${inst.traits.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`;
      card.appendChild(abilities);
    }

    if(inst.hp === 0 && inst.disabled && inst.disabled.length > 0){
      const disabled = document.createElement("div");
      disabled.className = "abilities";
      disabled.innerHTML = `<b style="color:var(--danger);">Disabled:</b><ul class="list" style="margin:4px 0 0 0;">${inst.disabled.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`;
      card.appendChild(disabled);
    }

    elRoomsManagement.appendChild(card);
  }
}

function renderCatalog(){
  const q = (document.getElementById("filter").value || "").trim();
  const list = (window.ROOM_LIBRARY || [])
    .filter(t => {
      if(!q) return true;
      return t.type === q;
    })
    .sort((a,b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type)));

  elCatalog.innerHTML = "";
  for(const t of list){
    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "top";

    const left = document.createElement("div");
    left.style.display="flex";
    left.style.flexDirection="column";
    left.style.gap="4px";

    const nm = document.createElement("p");
    nm.className = "name";
    nm.textContent = t.name;

    const meta = document.createElement("div");
    meta.className = "row";
    meta.innerHTML = `<span class="tag">${t.type}</span><span class="tag">Letter ${t.letter}</span><span class="tag">HP ${t.hpMax}</span><span class="tag">${t.cost} cr</span>`;

    const sm = document.createElement("p");
    sm.className = "small";
    sm.textContent = (t.traits?.[0] ?? "—");

    left.appendChild(nm);
    left.appendChild(meta);
    left.appendChild(sm);

    const right = document.createElement("div");
    right.className = "actions";

    const btnAdd = document.createElement("button");
    btnAdd.className = "btn ok";
    btnAdd.textContent = "Add";
    btnAdd.onclick = () => {
      state.inventory.push(makeInstance(t.id));
      renderInventory();
      renderCore();
    };
    right.appendChild(btnAdd);

    top.appendChild(left);
    top.appendChild(right);

    card.appendChild(top);

    const small2 = document.createElement("p");
    small2.className = "small";
    small2.textContent = t.notes || "";
    card.appendChild(small2);

    elCatalog.appendChild(card);
  }
}

function renderInventory(){
  elInventory.innerHTML = "";

  if(state.inventory.length === 0){
    const empty = document.createElement("div");
    empty.className = "warn";
    empty.textContent = "Inventory is empty. Add rooms from the catalog.";
    elInventory.appendChild(empty);
    return;
  }

  // group by templateId
  const groups = new Map();
  for(const inst of state.inventory){
    if(!groups.has(inst.templateId)) groups.set(inst.templateId, []);
    groups.get(inst.templateId).push(inst);
  }

  const templates = [...groups.keys()]
    .map(id => templateById(id))
    .filter(Boolean)
    .sort((a,b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type)));

  for(const t of templates){
    const group = groups.get(t.id);
    const isSelected = state.selectedTemplateId === t.id;

    const card = document.createElement("div");
    card.className = "card" + (isSelected ? " selected" : "");

    const top = document.createElement("div");
    top.className="top";

    const left = document.createElement("div");
    left.style.display="flex";
    left.style.flexDirection="column";
    left.style.gap="4px";

    const nm = document.createElement("p");
    nm.className="name";
    nm.textContent = t.name;

    const meta = document.createElement("div");
    meta.className="row";
    meta.innerHTML = `<span class="tag">${t.type}</span><span class="tag">${t.letter}</span><span class="tag">x${group.length}</span><span class="tag">${t.cost} cr each</span>`;

    left.appendChild(nm);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className="actions";

    const btnSelect = document.createElement("button");
    btnSelect.className = "btn " + (isSelected ? "sel" : "");
    btnSelect.textContent = isSelected ? "Selected" : "Select";
    btnSelect.onclick = () => {
      state.selectedTemplateId = isSelected ? null : t.id;
      renderAll();
    };

    const btnMinus = document.createElement("button");
    btnMinus.className="btn danger";
    btnMinus.textContent="−";
    btnMinus.title="Remove one from inventory (unplaced only)";
    btnMinus.onclick = () => {
      const idx = state.inventory.findIndex(x => x.templateId === t.id);
      if(idx >= 0) state.inventory.splice(idx,1);
      if(state.selectedTemplateId === t.id && !state.inventory.some(x => x.templateId === t.id)){
        state.selectedTemplateId = null;
      }
      renderAll();
    };

    const btnPlus = document.createElement("button");
    btnPlus.className="btn ok";
    btnPlus.textContent="+";
    btnPlus.title="Add one more of this room";
    btnPlus.onclick = () => {
      state.inventory.push(makeInstance(t.id));
      renderAll();
    };

    right.appendChild(btnSelect);
    right.appendChild(btnMinus);
    right.appendChild(btnPlus);

    top.appendChild(left);
    top.appendChild(right);
    card.appendChild(top);

    const sm = document.createElement("p");
    sm.className="small";
    sm.textContent = t.traits?.[0] ?? "—";
    card.appendChild(sm);

    elInventory.appendChild(card);
  }
}

function renderGrid(){
  elGrid.style.gridTemplateColumns = `repeat(${state.grid.cols}, minmax(56px, 1fr))`;
  elGrid.innerHTML = "";

  for(let i=0;i<state.grid.cells.length;i++){
    const has = state.grid.cells[i] !== null;
    const cell = document.createElement("div");
    cell.className = "cell " + (has ? "" : "empty") + (state.selectedCellIndex === i ? " selected" : "");
    cell.dataset.index = String(i);

    cell.addEventListener("click", () => {
      state.selectedCellIndex = i;

      // If we're in placement mode, clicking places into the cell
      if(state.selectedTemplateId){
        placeSelectedIntoCell(i);
      }

      renderAll();
    });

    if(has){
      const instanceId = state.grid.cells[i];
      const inst = state.placed.get(instanceId);
      if(inst){
        const tile = document.createElement("div");
        tile.className="tile";

        const mini = document.createElement("div");
        mini.className="mini";
        mini.textContent = inst.name.split(" ")[0];

        const letter = document.createElement("div");
        letter.className="letter";
        letter.textContent = inst.letter;

        const hp = document.createElement("div");
        hp.className="hp";
        hp.textContent = `HP ${inst.hp}/${inst.hpMax}`;

        tile.appendChild(mini);
        tile.appendChild(letter);
        tile.appendChild(hp);
        cell.appendChild(tile);
      }
    }

    elGrid.appendChild(cell);
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function renderDetails(){
  const idx = state.selectedCellIndex;
  if(idx === null || idx === undefined){
    elDetails.innerHTML = `<div class="warn">Click a placed room to view its full stats.</div>`;
    return;
  }
  const instanceId = state.grid.cells[idx];
  if(!instanceId){
    const {r,c} = cellToRC(idx);
    elDetails.innerHTML = `
      <div class="warn">Cell (${r+1}, ${c+1}) is empty.</div>
      <div class="hint">Select a room in Inventory and click this cell to place it.</div>
    `;
    return;
  }
  const inst = state.placed.get(instanceId);
  if(!inst){
    elDetails.innerHTML = `<div class="warn">Room not found.</div>`;
    return;
  }
  const {r,c} = cellToRC(idx);

  elDetails.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div>
        <div class="tag">${inst.type}</div>
        <h3 style="margin:8px 0 4px 0; font-size:14px;">${escapeHtml(inst.name)}</h3>
        <div class="small">Grid: (${r+1}, ${c+1}) · Letter: <b>${escapeHtml(inst.letter)}</b> · Instance: <span class="mono">${escapeHtml(inst.instanceId.slice(0,10))}…</span></div>
      </div>
      <div class="row">
        <button class="btn danger" id="btnRemoveFromGrid">Remove</button>
      </div>
    </div>

    <div class="divider"></div>

    <div class="kv">
      <div class="k">HP</div>
      <div class="v">
        <input id="hpNow" type="number" min="0" max="${inst.hpMax}" value="${inst.hp}" />
        <span class="small"> / ${inst.hpMax}</span>
      </div>
      <div class="k">Cost</div>
      <div class="v">${inst.cost} credits</div>
      <div class="k">Template</div>
      <div class="v mono">${escapeHtml(inst.templateId)}</div>
      ${inst.damage > 0 ? `<div class="k">Damage</div><div class="v">${inst.damage}</div>` : ''}
      ${inst.defense > 0 ? `<div class="k">Defense</div><div class="v">${inst.defense}</div>` : ''}
      ${inst.battery > 0 ? `<div class="k">Battery</div><div class="v">${inst.battery}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="small"><b>Traits</b></div>
    <ul class="list">${inst.traits.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>

    <div class="small" style="margin-top:10px;"><b>Disabled (HP 0)</b></div>
    <ul class="list">${inst.disabled.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>

    <div class="small" style="margin-top:10px;"><b>Stabilized (in combat)</b></div>
    <ul class="list">${inst.stabilized.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>

    <div class="hint" style="margin-top:10px;"><b>Notes:</b> ${escapeHtml(inst.notes || "—")}</div>
  `;

  document.getElementById("btnRemoveFromGrid").onclick = () => {
    removeInstanceFromGrid(inst.instanceId);
    state.placed.delete(inst.instanceId);
    state.inventory.push(inst);
    state.selectedCellIndex = null;
    renderAll();
  };

  document.getElementById("hpNow").addEventListener("input", (e) => {
    const v = Number(e.target.value);
    inst.hp = Math.max(0, Math.min(inst.hpMax, isFinite(v) ? v : inst.hp));
    renderGrid();
  });

  // Pilot skill input now lives in the summary panel.
}

// ---------- Grid resize ----------
function resizeGrid(newRows, newCols){
  newRows = Math.max(1, Math.min(20, newRows));
  newCols = Math.max(1, Math.min(20, newCols));

  const oldRows = state.grid.rows;
  const oldCols = state.grid.cols;
  const oldCells = state.grid.cells.slice();

  state.grid.rows = newRows;
  state.grid.cols = newCols;
  initGrid();

  const minRows = Math.min(oldRows, newRows);
  const minCols = Math.min(oldCols, newCols);

  for(let r=0;r<minRows;r++){
    for(let c=0;c<minCols;c++){
      const oldIndex = r * oldCols + c;
      const newIndex = r * newCols + c;
      state.grid.cells[newIndex] = oldCells[oldIndex];
    }
  }

  // Return overflow rooms to inventory
  const kept = new Set(state.grid.cells.filter(Boolean));
  const allOld = oldCells.filter(Boolean);
  for(const instanceId of allOld){
    if(!kept.has(instanceId)){
      const inst = state.placed.get(instanceId);
      if(inst){
        state.inventory.push(inst);
        state.placed.delete(instanceId);
      }
    }
  }

  state.selectedCellIndex = null;
}

// ---------- Core helpers ----------
function addCoreSet(){
  const coreTemplateIds = ["eng_standard","sh_standard","cp_standard","ls_standard"];
  for(const tid of coreTemplateIds) state.inventory.push(makeInstance(tid));
}

// ---------- Events ----------
document.getElementById("filter").addEventListener("input", () => renderCatalog());

document.getElementById("btnResize").addEventListener("click", () => {
  const r = Number(document.getElementById("rows").value);
  const c = Number(document.getElementById("cols").value);
  resizeGrid(r,c);
  renderAll();
});

document.getElementById("btnClear").addEventListener("click", () => {
  if(!confirm("Clear the ship layout and inventory?")) return;
  state.grid.cells = state.grid.cells.map(() => null);
  state.inventory = [];
  state.placed.clear();
  state.selectedCellIndex = null;
  state.selectedTemplateId = null;
  renderAll();
});

document.getElementById("btnAutoCore").addEventListener("click", () => {
  addCoreSet();
  renderAll();
});

document.getElementById("btnCancelPlace").addEventListener("click", () => {
  state.selectedTemplateId = null;
  renderAll();
});

document.getElementById("btnExport").addEventListener("click", async () => {
  const json = exportJson();
  await navigator.clipboard.writeText(json).catch(() => {});
  prompt("Copy your ship JSON:", json);
});

document.getElementById("btnImport").addEventListener("click", () => {
  const txt = prompt("Paste ship JSON:");
  if(!txt) return;
  try{
    importJson(txt);
    document.getElementById("rows").value = state.grid.rows;
    document.getElementById("cols").value = state.grid.cols;
    renderAll();
  }catch(err){
    alert("Import failed: " + err.message);
  }
});

// ---------- Boot ----------
(function boot(){
  initGrid();
  renderAll();
})();

// --- Collapsible: Room Catalog ---
if(elToggleCatalog && elCatalogPanel){
  elToggleCatalog.addEventListener("click", () => {
    const isCollapsed = elCatalogPanel.classList.toggle("collapsed");
    elToggleCatalog.setAttribute("aria-expanded", String(!isCollapsed));
    elToggleCatalog.textContent = isCollapsed ? "Expand" : "Collapse";
  });
}

// --- Summary controls ---
if(elShipSize){
  elShipSize.addEventListener("change", () => {
    const v = Number(elShipSize.value);
    if(v === 6 || v === 9 || v === 12){
      state.shipMaxRooms = v;
      renderSummary();
    }
  });
}

if(elBtnResetSurge){
  elBtnResetSurge.addEventListener("click", () => {
    resetSurge();
    renderSummary();
  });
}

if(elBtnTuneSelected){
  elBtnTuneSelected.addEventListener("click", () => {
    const idx = state.selectedCellIndex;
    if(idx === null || idx === undefined){
      alert("Select a placed room on the grid first.");
      return;
    }
    const instanceId = state.grid.cells[idx];
    if(!instanceId){
      alert("Selected cell is empty.");
      return;
    }
    if(state.tunedRooms.has(instanceId)){
      alert("This room is already tuned.");
      return;
    }
    const ok = tuneRoom(instanceId, { cost: 1, boost: { maneuverability: 1 } });
    if(ok){
      state.tunedRooms.add(instanceId);
      renderAll();
    }
  });
}
