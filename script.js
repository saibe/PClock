const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQP4yXvMjqxO-FKxa9fw6flwJ0IzeUH1dO16gUcy_HsDsn_eBDkQFw-6A8hf4zNUol-l2-voplefB6E/pub?gid=1237545506&single=true&output=csv';
const PLAYERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQFOKpdZMMO9sPcpWH6mrQW2S-eaxu-8B6YTZ4ZM93WgbAXuDG8-9nkrO3D644WmxAqHGdm07FGkh7H/pub?gid=137620678&single=true&output=csv';

let levels = [];
let currentLevel = 0;
let timeLeft = 0;
let timerInterval = null;
let running = false;
let structureTitle = "Poker Clock";
let selectedPlayersIndexes = [];

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

    currentLevel = 0;
    timeLeft = levels[0].duration;
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
    const data = lines.slice(5).map(line => line.split(',').map(v => v.trim()));

    // Génère le tableau HTML
    let html = '<table id="players-table"><thead><tr>';
    html += '<th></th><th>Nom</th><th>Prénom</th><th>MPLA</th><th>Winamax</th>';
    html += '</tr></thead><tbody>';
    data.forEach((row, idx) => {
      if (row.length >= 7) {
        const checked = selectedPlayersIndexes.includes(idx) ? 'checked' : '';
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

    document.getElementById('tab-joueurs').innerHTML = html;

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

function generateTablePlan() {
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

  // Répartition équilibrée
  let tables = Array.from({length: nbTables}, () => []);
  players.forEach((player, i) => {
    tables[i % nbTables].push(player);
  });

  // Génération du HTML graphique
  let html = '<div class="table-graphic-container">';
  for (let t = 0; t < nbTables; t++) {
    const tablePlayers = tables[t];
    const n = tablePlayers.length;
    html += `<div class="table-graphic">
      <div class="table-graphic-title">Table ${t + 1}</div>
      <div class="seats-circle">`;

    // Disposition circulaire des sièges
    const radius = 110;
    const centerX = 130, centerY = 130;
    tablePlayers.forEach((p, s) => {
      const angle = (2 * Math.PI * s) / n - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle) - 45; // 45 = seat width / 2
      const y = centerY + radius * Math.sin(angle) - 25; // 25 = seat height / 2
      html += `<div class="seat" style="left:${x}px;top:${y}px;">
      <div class="seat-number">Siège ${s + 1}</div>
      <div style="font-size:1.1em; font-weight:bold;">${p.winamax || '-'}</div>
    </div>`;
    });

    html += `</div></div>`;
  }
  html += '</div>';
  document.getElementById('tables-plan').innerHTML = html;
}