const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQP4yXvMjqxO-FKxa9fw6flwJ0IzeUH1dO16gUcy_HsDsn_eBDkQFw-6A8hf4zNUol-l2-voplefB6E/pub?gid=1237545506&single=true&output=csv';

let levels = [];
let currentLevel = 0;
let timeLeft = 0;
let timerInterval = null;
let running = false;
let structureTitle = "Poker Clock";

// Font-size base et ratios
let baseFontSize = 6; // en em
const fontRatios = {
  level: 0.5,
  timer: 1.5,
  blinds: 1,
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

// Onglets
function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tabDiv => tabDiv.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick="showTab('${tab}')"]`).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
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