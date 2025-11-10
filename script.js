const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQP4yXvMjqxO-FKxa9fw6flwJ0IzeUH1dO16gUcy_HsDsn_eBDkQFw-6A8hf4zNUol-l2-voplefB6E/pub?gid=1237545506&single=true&output=csv';

let levels = [];
let currentLevel = 0;
let timeLeft = 0;
let timerInterval = null;
let running = false;
let structureTitle = "Poker Clock";

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

    // data[0] = en-têtes, data[1...] = données
    levels = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const levelNum = row[2];
      const roundDuration = row[3];
      const sb = row[4];
      const bb = row[5];
      const ante = row[6];
      const breakDuration = row[7];

      // 1. Ajoute le niveau si présent
      if (levelNum && roundDuration && sb && bb) {
        levels.push({
          label: `Niveau ${levelNum}`,
          blinds: `${sb} / ${bb}`,
          ante: (ante && parseInt(ante) > 0) ? `Ante: ${ante}` : '',
          duration: parseInt(roundDuration) * 60,
          isPause: false
        });
      }

      // 2. Ajoute le break si présent
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

loadStructure();