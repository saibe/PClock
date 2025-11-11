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
let classementData = [];

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
    html += '<th></th><th>Nom</th><th>Prénom</th><th>MPLA</th><th>Winamax</th>';
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
        // Ajoute cette ligne :
        if (typeof renderClassement === 'function') renderClassement();
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
  if (tab === 'classement') {
    renderClassement();
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

function renderClassement() {
  // Récupère les joueurs cochés
  const rows = Array.from(document.querySelectorAll('#players-table tbody tr'));
  const checkedRows = rows.filter((tr, idx) => selectedPlayersIndexes.includes(idx));
  const winamaxList = checkedRows.map(tr => tr.querySelectorAll('td')[4]?.textContent.trim());

  // Mets à jour classementData pour ne garder que les joueurs cochés
  classementData = winamaxList.map(winamax => {
    let existing = classementData.find(p => p.winamax === winamax);
    return existing ? { ...existing } : { winamax, round: '', heure: '', killer: '', out: false, rank: '' };
  });

  // Trie par rank croissant (rank vide < 1)
  classementData.sort((a, b) => {
    if (!a.rank && !b.rank) return 0;
    if (!a.rank) return -1;
    if (!b.rank) return 1;
    return a.rank - b.rank;
  });

  // Liste des joueurs encore en jeu (non éliminés)
  const stillIn = classementData.filter(p => !p.out).map(p => p.winamax);

  // Génère le tableau HTML
  let html = '<table id="classement-table"><thead><tr><th>Rank</th><th>Winamax</th><th>Table</th><th>Siège</th><th>Out</th><th>Round</th><th>Heure</th><th>Killer</th></tr></thead><tbody>';
  classementData.forEach((p, i) => {
    // Trouver l'index du joueur dans selectedPlayersIndexes
    const playerIdx = selectedPlayersIndexes.find(idx => {
      // On récupère le winamax du joueur à cet index dans le tableau des joueurs
      const tr = rows[idx];
      if (!tr) return false;
      const winamax = tr.querySelectorAll('td')[4]?.textContent.trim();
      return winamax === p.winamax;
    });

    // Trouver l'assignation table/siège par winamax
    let tableCell = '', seatCell = '';
    const assign = playerAssignments.find(a => a.winamax === p.winamax);
    if (assign) {
      tableCell = assign.table;
      seatCell = assign.seat;
    }
  
    // Pour la colonne killer, on crée une liste déroulante
    let killerSelect = `<select onchange="updateClassementCell(${i},'killer',this.value)" ${p.out ? '' : 'disabled'}>`;
    killerSelect += `<option value="">--</option>`;
    stillIn
      .filter(w => w !== p.winamax) // On ne propose pas soi-même
      .forEach(w => {
        killerSelect += `<option value="${w}"${p.killer === w ? ' selected' : ''}>${w}</option>`;
      });
    killerSelect += '</select>';

    html += `<tr>
      <td>${p.rank || ''}</td>
      <td>${p.winamax}</td>
      <td>${tableCell}</td>
      <td>${seatCell}</td>
      <td><input type="checkbox" ${p.out ? 'checked' : ''} onchange="toggleOutClassement(${i})"></td>
      <td>${p.round}</td>
      <td>${p.heure}</td>
      <td>${killerSelect}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('classement-container').innerHTML = html;
}

function toggleOutClassement(index) {
  if (!classementData[index]) return;

  // 1. Met à jour l'état "out" et les infos d'élimination
  const wasOut = classementData[index].out;
  classementData[index].out = !wasOut;

  if (classementData[index].out) {
    // Remplit round et heure à l'élimination
    const now = new Date();
    const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const roundStr = document.getElementById('level')?.textContent || '';
    classementData[index].round = roundStr;
    classementData[index].heure = heureStr;

    // Calcule le rang : nombre de joueurs non out avant ce clic
    const stillIn = classementData.filter(p => !p.out).length;
    classementData[index].rank = stillIn;
  } else {
    // Si on décoche "out", on vide round, heure, killer, rank, table, siege
    classementData[index].round = '';
    classementData[index].heure = '';
    classementData[index].killer = '';
    classementData[index].rank = '';
    classementData[index].table = '';
    classementData[index].siege = '';
  }

  // 2. Met à jour playerAssignments (supprime l'assignation du joueur out)
  const winamax = classementData[index].winamax;
  playerAssignments = playerAssignments.filter(a => a.winamax !== winamax);

  // 3. Rééquilibrage des tables avec la fonction fusionnée
  const joueurs = classementData
    .filter(p => !p.out)
    .map(p => ({ winamax: p.winamax }));

  const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);

  const oldAssignments = playerAssignments.map(a => ({
    winamax: a.winamax,
    table: a.table,
    siege: a.seat
  }));

  const { assignments, changes, tablesCassees } = equilibrerTables(joueurs, perTable, oldAssignments);

  // 4. Applique les nouvelles assignations à classementData et playerAssignments
  assignments.forEach(a => {
    let p = classementData.find(p => p.winamax === a.winamax);
    if (p) {
      p.table = a.table;
      p.siege = a.seat;
    }
  });
  playerAssignments = assignments.map(a => ({
    winamax: a.winamax,
    table: a.table,
    seat: a.seat
  }));

  // 5. Affiche la popup si besoin
  if (tablesCassees.length > 0 || changes.length > 0) {
    let html = '<h2>Changements d\'assignation</h2><ul>';
    tablesCassees.forEach(tc => {
      html += `<li style="color:#ffb300;"><b>La table ${tc} casse</b></li>`;
    });
    changes.forEach(c => {
      html += `<li><b>${c.winamax}</b> : Table ${c.from.table} Siège ${c.from.siege} → Table ${c.to.table} Siège ${c.to.siege}</li>`;
    });
    html += '</ul>';
    showPopup(html);
  }

  // 6. Rafraîchit l'affichage
  renderClassement();
  renderTablesFromPlayers();
  exportAppToJSON();
}

function getClassementData() {
  const rows = Array.from(document.querySelectorAll('#classement-table tbody tr'));
  return rows.map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      nom: tds[1]?.textContent.trim(),
      prenom: tds[2]?.textContent.trim(),
      winamax: tds[3]?.textContent.trim(),
      round: tds[4]?.textContent.trim(),
      heure: tds[5]?.textContent.trim(),
      killer: tds[6]?.textContent.trim()
    };
  });
}

/**
 * Assigne et équilibre les tables en minimisant les déplacements et en fermant les tables si besoin.
 * @param {Array} joueurs - Liste des joueurs à assigner [{winamax, ...}]
 * @param {number} perTable - Nombre max de joueurs par table
 * @param {Array} oldAssignments - Assignations précédentes [{winamax, table, siege}]
 * @returns {Object} { assignments: [...], changes: [...], tablesCassees: [...] }
 */
function equilibrerTables(joueurs, perTable, oldAssignments = []) {
  // 1. Calcul du nombre de tables nécessaires
  const totalPlayers = joueurs.length;
  const nbTables = Math.ceil(totalPlayers / perTable);

  // 2. Calcul du nombre de joueurs par table pour équilibrer
  const minPerTable = Math.floor(totalPlayers / nbTables);
  const maxPerTable = Math.ceil(totalPlayers / nbTables);
  const tablesWithMax = totalPlayers % nbTables; // nombre de tables à max joueurs

  // 3. Regrouper les anciens assignments par table
  let oldByTable = {};
  oldAssignments.forEach(a => {
    if (!oldByTable[a.table]) oldByTable[a.table] = [];
    oldByTable[a.table].push(a);
  });

  // 4. Préparer la nouvelle répartition
  let assignments = [];
  let changes = [];
  let tablesCassees = [];

  // 5. Générer la liste des tables à utiliser
  let tableNumbers = [];
  for (let t = 1; t <= nbTables; t++) tableNumbers.push(t);

  // 6. Répartir les joueurs en essayant de garder leur place si possible
  // a) On commence par remplir les tables avec les anciens joueurs qui peuvent rester
  let joueursRestants = [...joueurs];
  let usedWinamax = new Set();

  tableNumbers.forEach((tableNum, idx) => {
    const playersThisTable = idx < tablesWithMax ? maxPerTable : minPerTable;
    let oldTable = oldByTable[tableNum] || [];
    let usedSeats = new Set();

    // On place d'abord les anciens joueurs de cette table qui sont encore là et qui n'ont pas déjà été placés
    oldTable.forEach(a => {
      if (joueursRestants.find(j => j.winamax === a.winamax) && assignments.length < totalPlayers && usedSeats.size < playersThisTable) {
        assignments.push({
          winamax: a.winamax,
          table: tableNum,
          seat: a.siege || a.seat || 1
        });
        usedWinamax.add(a.winamax);
        usedSeats.add(a.siege || a.seat || 1);
      }
    });

    // Compléter avec les nouveaux joueurs ou ceux qui n'ont pas pu garder leur place
    for (let s = 1; assignments.filter(a => a.table === tableNum).length < playersThisTable; s++) {
      if (usedSeats.has(s)) continue;
      let nextJoueur = joueursRestants.find(j => !usedWinamax.has(j.winamax));
      if (!nextJoueur) break;
      assignments.push({
        winamax: nextJoueur.winamax,
        table: tableNum,
        seat: s
      });
      usedWinamax.add(nextJoueur.winamax);
      usedSeats.add(s);
    }
  });

  // 7. Détecter les changements et les tables cassées
  // a) Tables cassées = tables de oldAssignments qui ne sont plus dans la nouvelle répartition
  let oldTables = Array.from(new Set(oldAssignments.map(a => a.table)));
  tablesCassees = oldTables.filter(t => !tableNumbers.includes(t));

  // b) Changements d'assignation
  assignments.forEach(a => {
    let old = oldAssignments.find(o => o.winamax === a.winamax);
    if (!old || old.table !== a.table || (old.siege || old.seat) !== a.seat) {
      changes.push({
        winamax: a.winamax,
        from: old ? { table: old.table, siege: old.siege || old.seat } : { table: '-', siege: '-' },
        to: { table: a.table, siege: a.seat }
      });
    }
  });

  return { assignments, changes, tablesCassees };
}

function assignSeats() {
  // 1. Liste des joueurs sélectionnés (non éliminés)
  const joueurs = classementData
    .filter(p => !p.out)
    .map(p => ({ winamax: p.winamax }));

  // 2. Nombre de joueurs max par table
  const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);

  // 3. Appel à la fonction fusionnée (assignation initiale, donc oldAssignments = [])
  const { assignments, changes, tablesCassees } = equilibrerTables(joueurs, perTable, []);

  // 4. Appliquer les résultats
  assignments.forEach(a => {
    let p = classementData.find(p => p.winamax === a.winamax);
    if (p) {
      p.table = a.table;
      p.siege = a.seat;
    }
  });
  playerAssignments = assignments.map(a => ({
    winamax: a.winamax,
    table: a.table,
    seat: a.seat
  }));

  // 5. Rafraîchir l'affichage
  renderClassement();
  renderTablesFromPlayers();
  exportAppToJSON();
}

function showPopup(html) {
  document.getElementById('popup-modal-body').innerHTML = html;
  document.getElementById('popup-modal').style.display = 'flex';
}
function closePopup() {
  document.getElementById('popup-modal').style.display = 'none';
}

function renderTablesFromPlayers() {
  // On utilise classementData pour récupérer les joueurs avec une table et un siège
  // On ne prend que les joueurs non éliminés et qui ont une table/siège
  let players = classementData
    .filter(p => !p.out && p.table && p.siege)
    .map(p => ({
      table: parseInt(p.table),
      seat: parseInt(p.siege),
      winamax: p.winamax
    }));

  if (players.length === 0) {
    document.getElementById('tables-plan').innerHTML = '<p style="color:red;">Aucune assignation de sièges.</p>';
    return;
  }

  // Récupère le nombre de joueurs par table (optionnel, pour l'affichage)
  const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);

  // Regroupe par table
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
  renderClassement();
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
    renderClassement();

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
  const classement = getClassementData();
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
    classement,
    classementData,
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

    // classement
    if (appState.classement) {
      // Stocke dans une variable globale si besoin
      window.classementData = appState.classement;
      // Ou bien, régénère le tableau classement à partir de ces données
      renderClassementFromData(appState.classement);
      renderClassement();
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

function renderClassementFromData(classement) {
  let html = '<table id="classement-table"><thead><tr><th>#</th><th>Nom</th><th>Prénom</th><th>Winamax</th><th>Round</th><th>Heure</th><th>Killer</th></tr></thead><tbody>';
  classement.forEach((p, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${p.nom}</td>
      <td>${p.prenom}</td>
      <td>${p.winamax}</td>
      <td contenteditable="true">${p.round}</td>
      <td contenteditable="true">${p.heure}</td>
      <td contenteditable="true">${p.killer}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('classement-container').innerHTML = html;
}

function updateClassementCell(index, field, value) {
  if (classementData[index]) {
    classementData[index][field] = value;
    exportAppToJSON();
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
