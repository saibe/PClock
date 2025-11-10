const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQP4yXvMjqxO-FKxa9fw6flwJ0IzeUH1dO16gUcy_HsDsn_eBDkQFw-6A8hf4zNUol-l2-voplefB6E/pub?gid=1237545506&single=true&output=csv';
const PLAYERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQFOKpdZMMO9sPcpWH6mrQW2S-eaxu-8B6YTZ4ZM93WgbAXuDG8-9nkrO3D644WmxAqHGdm07FGkh7H/pub?gid=137620678&single=true&output=csv';

let levels = [];
let currentLevel = 0;
let timeLeft = 0;
let timerInterval = null;
let running = false;
let structureTitle = "Poker Clock";
let selectedPlayersIndexes = [];
let playerAssignments = []; // [{index, table, seat}]

// Font-size base et ratios
let baseFontSize = 10; // en em
const fontRatios = {
  level: 0.5,
  timer: 1,
  blinds: 1.5,
  nextLevel: 0.3,
  nextBreak: 0.3
};

function applyFontSizes() {
  document.getElementById('level').style.fontSize = (baseFontSize * fontRatios.level) + 'em';
  document.getElementById('timer').style.fontSize = (baseFontSize * fontRatios.timer) + 'em';
  document.getElementById('blinds-info').style.fontSize = (baseFontSize * fontRatios.blinds) + 'em';
  document.getElementById('next-level-info').style.fontSize = (baseFontSize * fontRatios.nextLevel) + 'em';
  document.getElementById('next-break-info').style.fontSize = (baseFontSize * fontRatios.nextBreak) + 'em';
}
applyFontSizes();

document.addEventListener('keydown', function(e) {
  if (e.code === 'PageUp') {
    baseFontSize += 1;
    applyFontSizes();
    e.preventDefault();
  }
  if (e.code === 'PageDown') {
    baseFontSize = Math.max(1, baseFontSize - 1);
    applyFontSizes();
    e.preventDefault();
  }
});

// Date et heure en haut
function updateDateTime() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = now.toLocaleDateString('fr-FR', options);
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('datetime').textContent = dateStr + ' – ' + timeStr;
}
setInterval(updateDateTime, 1000);
updateDateTime();

function parseCSV(text) {
  const lines = text.trim().split('\n');
  // On prend la première ligne comme titre
  structureTitle = lines[0].replace(/,/g, ' ').trim();
  // On saute les 6 premières lignes (0 à 5) pour les données
  const dataLines = lines.slice(6);
  return dataLines.map(line => line.split(',').map(cell => cell.trim()));
}

async function loadStructure() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Erreur de chargement du CSV');
    const csvText = await response.text();
    const data = parseCSV(csvText);

    document.getElementById('structure-title').textContent = structureTitle;

    levels = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const levelNum = row[2];
      const roundDuration = row[3];
      const sb = row[4];
      const bb = row[5];
      const ante = row[6];
      const breakDuration = row[7];

      // Ajoute le niveau si présent
      if (levelNum && roundDuration && sb && bb) {
        levels.push({
          label: `Niveau ${levelNum}`,
          blinds: `${sb} / ${bb}`,
          ante: (ante && parseInt(ante) > 0) ? `Ante: ${ante}` : '',
          duration: parseInt(roundDuration) * 60,
          isPause: false
        });
      }
      // Ajoute le break si présent
      if (breakDuration && parseInt(breakDuration) > 0) {
        levels.push({
          label: `Pause`,
          blinds: '-',
          ante: '',
          duration: parseInt(breakDuration) * 60,
          isPause: true
        });
      }
    }

    if (levels.length === 0) throw new Error('Aucun niveau trouvé dans la structure.');

//    currentLevel = 0;
//    timeLeft = levels[0].duration;
    document.getElementById('loading').style.display = 'none';
    updateDisplay();
    renderStructureTable();
  } catch (e) {
    document.getElementById('loading').textContent = 'Erreur de chargement : ' + e.message;
  }
}

async function loadPlayers() {
  try {
    const response = await fetch(PLAYERS_CSV_URL);
    if (!response.ok) throw new Error('Erreur de chargement du CSV joueurs');
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    // On ignore les 4 premières lignes
    let data = lines.slice(5).map(line => line.split(',').map(v => v.trim()));

    // Si assignation, trie les data selon table puis siège
    if (playerAssignments.length > 0) {
      data = data
        .map((row, idx) => {
          const assign = playerAssignments.find(a => a.index === idx);
          return { row, idx, table: assign ? assign.table : 9999, seat: assign ? assign.seat : 9999 };
        })
        .sort((a, b) => a.table - b.table || a.seat - b.seat)
        .map(obj => ({ row: obj.row, idx: obj.idx }));
    } else {
      data = data.map((row, idx) => ({ row, idx }));
    }

    // Génère le tableau HTML
    let html = '<table id="players-table"><thead><tr>';
    html += '<th></th><th>Nom</th><th>Prénom</th><th>MPLA</th><th>Winamax</th><th>Table</th><th>Siège</th>';
    html += '</tr></thead><tbody>';
    data.forEach(({row, idx}) => {
      if (row.length >= 7) {
        const checked = selectedPlayersIndexes.includes(idx) ? 'checked' : '';
        // Cherche l'assignation pour ce joueur
        let tableCell = '', seatCell = '';
        const assign = playerAssignments.find(a => a.index === idx);
        if (assign) {
          tableCell = assign.table;
          seatCell = assign.seat;
        }
        html += `<tr>
          <td><input type="checkbox" class="player-checkbox" data-index="${idx}" ${checked}></td>
          <td>${row[0]}</td>
          <td>${row[1]}</td>
          <td>${row[5]}</td>
          <td>${row[6]}</td>
          <td>${tableCell}</td>
          <td>${seatCell}</td>
        </tr>`;
      }
    });
    html += '</tbody></table>';

    document.getElementById('players-table-container').innerHTML = html;

    // Met à jour la sélection à chaque changement de case
    document.querySelectorAll('.player-checkbox').forEach(cb => {
      cb.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-index'));
        if (this.checked) {
          if (!selectedPlayersIndexes.includes(idx)) selectedPlayersIndexes.push(idx);
        } else {
          selectedPlayersIndexes = selectedPlayersIndexes.filter(i => i !== idx);
        }
      });
    });

    // Ajoute le comportement de clic sur la ligne pour cocher/décocher
    document.querySelectorAll('#players-table tbody tr').forEach(tr => {
      tr.addEventListener('click', function(e) {
        if (e.target.type === 'checkbox') return;
        const checkbox = this.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    });
  } catch (e) {
    document.getElementById('tab-joueurs').innerHTML = '<p style="color:red;">Erreur de chargement des joueurs : ' + e.message + '</p>';
  }

  exportAppToJSON();
}

function updateDisplay() {
  if (!levels || levels.length === 0) return;
  document.getElementById('level').textContent = levels[currentLevel].label;
  document.getElementById('timer').textContent = formatTime(timeLeft);

  // Affichage ou masquage des blinds/ante selon le type de niveau
  const blindsInfoDiv = document.getElementById('blinds-info');
  if (levels[currentLevel].isPause) {
    blindsInfoDiv.style.display = '';
    blindsInfoDiv.textContent = 'PAUSE';
    blindsInfoDiv.classList.add('pause');
  } else {
    blindsInfoDiv.style.display = '';
    blindsInfoDiv.textContent =
      levels[currentLevel].blinds +
      (levels[currentLevel].ante ? ' | ' + levels[currentLevel].ante : '');
    blindsInfoDiv.classList.remove('pause');
  }

  document.getElementById('startStopBtn').textContent = running ? '⏸️ Pause' : '▶️ Démarrer';

  // Affichage du prochain niveau (affiche aussi les breaks)
  const nextLevelDiv = document.getElementById('next-level-info');
  if (currentLevel < levels.length - 1) {
    const next = levels[currentLevel + 1];
    if (next.isPause) {
      nextLevelDiv.textContent = "Prochain niveau : Pause (" + formatTime(next.duration) + ")";
    } else {
      nextLevelDiv.textContent = "Prochain niveau : " + next.blinds +
        (next.ante ? " | " + next.ante : '');
    }
  } else {
    nextLevelDiv.textContent = "";
  }

  // Calcul du temps avant la prochaine pause
  const nextBreakDiv = document.getElementById('next-break-info');
  let timeToBreak = 0;
  let found = false;
  for (let i = currentLevel + 1, t = timeLeft; i < levels.length; i++) {
    t += levels[i].duration;
    if (levels[i].isPause) {
      timeToBreak = t;
      found = true;
      break;
    }
  }
  if (found) {
    const min = Math.floor(timeToBreak / 60);
    const sec = timeToBreak % 60;
    nextBreakDiv.textContent = "Prochaine pause dans : " + min + " min " + (sec < 10 ? "0" : "") + sec + " s";
  } else {
    nextBreakDiv.textContent = "";
  }

  exportAppToJSON();
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function nextLevel() {
  if (currentLevel < levels.length - 1) {
    currentLevel++;
    timeLeft = levels[currentLevel].duration;
    stopTimer();
    updateDisplay();
  }
}

function prevLevel() {
  if (currentLevel > 0) {
    currentLevel--;
    timeLeft = levels[currentLevel].duration;
    stopTimer();
    updateDisplay();
  }
}

function toggleTimer() {
  if (running) {
    stopTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (!running) {
    running = true;
    timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
      } else {
        nextLevel();
      }
    }, 1000);
    updateDisplay();
  }
}

function stopTimer() {
  running = false;
  clearInterval(timerInterval);
  updateDisplay();
}

function resetTimer() {
  timeLeft = levels[currentLevel].duration;
  stopTimer();
  updateDisplay();
}

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tabDiv => tabDiv.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick="showTab('${tab}')"]`).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'joueurs') {
    loadPlayers();
  }
  if (tab === 'tables') {
    renderTablesFromPlayers();
  }
}

// Génère le tableau de structure complète
function renderStructureTable() {
  if (!levels || levels.length === 0) return;
  let html = '<table id="structure-table"><thead><tr><th>#</th><th>Type</th><th>Blinds</th><th>Ante</th><th>Durée</th></tr></thead><tbody>';
  levels.forEach((lvl, idx) => {
    if (lvl.isPause) {
      html += `<tr class="pause-row"><td>${idx + 1}</td><td>Pause</td><td colspan="2"></td><td>${formatTime(lvl.duration)}</td></tr>`;
    } else {
      html += `<tr><td>${idx + 1}</td><td>${lvl.label}</td><td>${lvl.blinds}</td><td>${lvl.ante || '-'}</td><td>${formatTime(lvl.duration)}</td></tr>`;
    }
  });
  html += '</tbody></table>';
  document.getElementById('structure-table-container').innerHTML = html;
}

restoreAppFromLocalStorage();
loadPlayers();
loadStructure();

// Edition du titre
document.getElementById('edit-title-btn').addEventListener('click', function() {
  const titleElem = document.getElementById('structure-title');
  const currentTitle = titleElem.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentTitle;
  input.style.fontSize = '1.2em';
  input.style.textAlign = 'center';
  input.style.width = '70%';

  // Remplace le titre par l'input
  titleElem.replaceWith(input);
  input.focus();

  // Fonction pour valider la modification
  function saveTitle() {
    const newTitle = input.value.trim() || 'Structure Tournoi';
    const newTitleElem = document.createElement('h1');
    newTitleElem.id = 'structure-title';
    newTitleElem.style.display = 'inline';
    newTitleElem.textContent = newTitle;
    input.replaceWith(newTitleElem);
    // Remettre l'écouteur sur le nouveau h1
    document.getElementById('edit-title-btn').disabled = false;
  }

  // Valide au blur ou sur Entrée
  input.addEventListener('blur', saveTitle);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      input.blur();
    }
  });

  // Désactive le bouton pendant l'édition
  document.getElementById('edit-title-btn').disabled = true;
});

function assignSeats() {
  // Récupère les joueurs cochés selon selectedPlayersIndexes
  const rows = Array.from(document.querySelectorAll('#players-table tbody tr'));
  const checkedRows = rows.filter((tr, idx) => selectedPlayersIndexes.includes(idx));

  if (checkedRows.length === 0) {
    document.getElementById('tables-plan').innerHTML = '<p style="color:red;">Aucun joueur sélectionné.</p>';
    return;
  }

  // Récupère les infos des joueurs cochés
  const players = checkedRows.map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      nom: tds[1].textContent,
      prenom: tds[2].textContent,
      mpla: tds[3].textContent,
      winamax: tds[4].textContent
    };
  });

  // Mélange aléatoirement les joueurs (Fisher-Yates)
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  // Récupère le nombre de joueurs par table
  const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);
  const nbTables = Math.ceil(players.length / perTable);

  // Répartition équilibrée et assignation
  playerAssignments = []; // reset
  let tables = Array.from({length: nbTables}, () => []);
  players.forEach((player, i) => {
    tables[i % nbTables].push({ ...player, originalIndex: selectedPlayersIndexes[i] });
  });

  // Remplir playerAssignments
  for (let t = 0; t < nbTables; t++) {
    for (let s = 0; s < tables[t].length; s++) {
      playerAssignments.push({
        index: tables[t][s].originalIndex,
        table: t + 1,
        seat: s + 1
      });
    }
  }

  // Génération du HTML graphique
  let html = '<div class="tables-flex">';
  for (let t = 0; t < nbTables; t++) {
    const tablePlayers = tables[t];
    html += `<div class="table-block" style="margin:1em;display:inline-block;">
      <strong style="color:#ffb300; font-size:1.3em;">Table ${t + 1}</strong>
      <table style="margin:auto; background:#222; color:#fff; border-radius:8px; min-width:200px;">
        <tbody>`;
    for (let s = 0; s < perTable; s++) {
      if (s < tablePlayers.length) {
        const p = tablePlayers[s];
        html += `<tr>
          <td style="width:3em;">${s + 1}</td>
          <td style="font-weight:bold; font-size:1.1em;">${p.winamax || '-'}</td>
        </tr>`;
      } else {
        html += `<tr>
          <td style="width:3em;">${s + 1}</td>
          <td style="font-style:italic; color:#bbb;">(vide)</td>
        </tr>`;
      }
    }
    html += `</tbody></table></div>`;
  }
  html += '</div>';
  document.getElementById('tables-plan').innerHTML = html;

  // Recharge le tableau des joueurs pour afficher les colonnes Table/Siège triées
  loadPlayers();
  renderTablesFromPlayers();
  exportAppToJSON();
}

function renderTablesFromPlayers() {
  // Récupère les infos du tableau des joueurs
  const rows = Array.from(document.querySelectorAll('#players-table tbody tr'));
  // On ne prend que les joueurs assignés à une table
  let players = [];
  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    const table = parseInt(tds[5]?.textContent);
    const seat = parseInt(tds[6]?.textContent);
    if (!isNaN(table) && !isNaN(seat)) {
      players.push({
        table,
        seat,
        winamax: tds[4].textContent
      });
    }
  });

  if (players.length === 0) {
    document.getElementById('tables-plan').innerHTML = '<p style="color:red;">Aucune assignation de sièges.</p>';
    return;
  }

  // Regroupe par table
  const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);
  const tables = {};
  players.forEach(p => {
    if (!tables[p.table]) tables[p.table] = [];
    tables[p.table][p.seat - 1] = p.winamax;
  });

  // Génère le HTML
  let html = '<div class="tables-flex">';
  Object.keys(tables).sort((a, b) => a - b).forEach(tableNum => {
    html += `<div class="table-block" style="margin:1em;display:inline-block;">
      <strong style="color:#ffb300; font-size:1.3em;">Table ${tableNum}</strong>
      <table style="margin:auto; background:#222; color:#fff; border-radius:8px; min-width:200px;">
        <tbody>`;
    for (let s = 0; s < perTable; s++) {
      const winamax = tables[tableNum][s];
      if (winamax) {
        html += `<tr>
          <td style="width:3em;">${s + 1}</td>
          <td style="font-weight:bold; font-size:1.1em;">${winamax || '-'}</td>
        </tr>`;
      } else {
        html += `<tr>
          <td style="width:3em;">${s + 1}</td>
          <td style="font-style:italic; color:#bbb;">(vide)</td>
        </tr>`;
      }
    }
    html += `</tbody></table></div>`;
  });
  html += '</div>';
  document.getElementById('tables-plan').innerHTML = html;

  exportAppToJSON();
}

function exportPlayersToJSON() {
  const rows = Array.from(document.querySelectorAll('#players-table tbody tr'));
  const players = rows.map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      nom: tds[1]?.textContent.trim(),
      prenom: tds[2]?.textContent.trim(),
      mpla: tds[3]?.textContent.trim(),
      winamax: tds[4]?.textContent.trim(),
      table: tds[5]?.textContent.trim(),
      siege: tds[6]?.textContent.trim(),
      checked: tr.querySelector('input[type="checkbox"]')?.checked || false
    };
  });
  // Stocke dans le localStorage (ou envoie à un serveur si besoin)
  localStorage.setItem('joueurs_export', JSON.stringify(players));
}

document.addEventListener('DOMContentLoaded', function() {
  // Restauration automatique depuis localStorage
  restoreAppFromLocalStorage();

  // Bouton "Charger JSON" (restauration manuelle)
  const loadBtn = document.getElementById('load-json-btn');
  const fileInput = document.getElementById('load-json-file');
  if (loadBtn && fileInput) {
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          importAppFromJSON(e.target.result); // Utilise la fonction d'import globale
        } catch (err) {
          alert("Erreur lors du chargement du fichier JSON.");
        }
      };
      reader.readAsText(file);
    });
  }
});

// Fonction pour restaurer la sélection et l'assignation depuis le JSON
function restorePlayersFromJSON(joueurs) {
  // On reconstruit selectedPlayersIndexes et playerAssignments
  selectedPlayersIndexes = [];
  playerAssignments = [];
  joueurs.forEach((p, idx) => {
    if (p.checked) selectedPlayersIndexes.push(idx);
    if (p.table && p.siege) {
      playerAssignments.push({
        index: idx,
        table: parseInt(p.table),
        seat: parseInt(p.siege)
      });
    }
  });
  // Recharge le tableau des joueurs et le plan des tables
  loadPlayers();
  if (typeof renderTablesFromPlayers === 'function') renderTablesFromPlayers();
}

function restoreAppFromLocalStorage() {
  const appStateJSON = localStorage.getItem('poker_app_export');
  if (!appStateJSON) return;
  try {
    const appState = JSON.parse(appStateJSON);

    // Structure
    if (appState.structure) levels = appState.structure;

    // Horloge
    if (appState.horloge) {
      stopTimer();
      currentLevel = appState.horloge.currentLevel ?? 0;
      timeLeft = appState.horloge.timeLeft ?? 0;
      baseFontSize = appState.horloge.baseFontSize ?? 2;
      running = !!appState.horloge.running;
      applyFontSizes();
    }

    // Joueurs
    selectedPlayersIndexes = appState.selectedPlayersIndexes || [];
    playerAssignments = appState.playerAssignments || [];

    // Titre
    if (appState.structureTitle) {
      const titleElem = document.getElementById('structure-title');
      if (titleElem) titleElem.textContent = appState.structureTitle;
    }

    // Recharge l’affichage
    updateDisplay();
    loadPlayers();
    if (typeof renderTablesFromPlayers === 'function') renderTablesFromPlayers();

    // Redémarre le timer si besoin
    if (running) startTimer();

  } catch (e) {
    alert("Erreur lors de la restauration depuis le localStorage.");
  }
}

function exportAppToJSON() {
  // Sauvegarde la structure du tournoi
  const structure = levels;
  // Sauvegarde l’état de l’horloge
  const horloge = {
    currentLevel,
    timeLeft,
    running,
    baseFontSize
  };
  // Sauvegarde la sélection et l’assignation des joueurs
  const joueurs = Array.from(document.querySelectorAll('#players-table tbody tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      nom: tds[1]?.textContent.trim(),
      prenom: tds[2]?.textContent.trim(),
      mpla: tds[3]?.textContent.trim(),
      winamax: tds[4]?.textContent.trim(),
      table: tds[5]?.textContent.trim(),
      siege: tds[6]?.textContent.trim(),
      checked: tr.querySelector('input[type="checkbox"]')?.checked || false
    };
  });

  const appState = {
    structure,
    horloge,
    selectedPlayersIndexes,
    playerAssignments,
    joueurs,
    structureTitle: document.getElementById('structure-title')?.textContent || ''
  };

  // Sauvegarde dans localStorage
  localStorage.setItem('poker_app_export', JSON.stringify(appState));
}

function importAppFromJSON(json) {
  try {
    const appState = typeof json === 'string' ? JSON.parse(json) : json;

    // Structure
    if (appState.structure) levels = appState.structure;

    // Horloge
    if (appState.horloge) {
      stopTimer();
      currentLevel = appState.horloge.currentLevel ?? 0;
      timeLeft = appState.horloge.timeLeft ?? 0;
      baseFontSize = appState.horloge.baseFontSize ?? 2;
      running = !!appState.horloge.running;
      applyFontSizes();
    }

    // Joueurs
    selectedPlayersIndexes = appState.selectedPlayersIndexes || [];
    playerAssignments = appState.playerAssignments || [];

    // Titre
    if (appState.structureTitle) {
      const titleElem = document.getElementById('structure-title');
      if (titleElem) titleElem.textContent = appState.structureTitle;
    }

    // Recharge l’affichage
    updateDisplay();
    loadPlayers();
    if (typeof renderTablesFromPlayers === 'function') renderTablesFromPlayers();

    // Redémarre le timer si besoin
    if (running) startTimer();

  } catch (e) {
    alert("Erreur lors de l'import du fichier JSON.");
  }
}

// Export
document.addEventListener('DOMContentLoaded', function() {
  const exportBtn = document.getElementById('export-app-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      exportAppToJSON();
      const json = localStorage.getItem('poker_app_export');
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'poker_app.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  // Import
  const importBtn = document.getElementById('import-app-btn');
  const fileInput = document.getElementById('import-app-file');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        importAppFromJSON(e.target.result);
      };
      reader.readAsText(file);
    });
  }
});

