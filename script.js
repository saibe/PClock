const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQP4yXvMjqxO-FKxa9fw6flwJ0IzeUH1dO16gUcy_HsDsn_eBDkQFw-6A8hf4zNUol-l2-voplefB6E/pub?gid=1237545506&single=true&output=csv';
const PLAYERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1jrwdnsvv2XckXTabVCZOrtzBzprDqDNmemQuiyOmGqU/edit?gid=542055167#gid=542055167&single=true&output=csv';



let levels = [];
let currentLevel = 0;
let timeLeft = 0;
let timerInterval = null;
let running = false;
let dateOfTheDay= new Date();
let structureTitle = 'ASL POKER 72 - S14T2 - ' + dateOfTheDay.getDate() + '/' + (dateOfTheDay.getMonth()+1);
let selectedPlayersIndexes = [];
let playerAssignments = []; // [{index, table, seat}]
let classementData = [];
let classementSort = { column: 'rank', asc: true };
let currentRank = 1;
// Variable globale pour gérer le joueur en cours d'élimination
let joueurAEliminerMPLA = null;
let startingStack = 20000;
let championshipData = null;

// Font-size base et ratios
let baseFontSize = 10; // en em
const fontRatios = {
  level: 0.5,
  timer: 1,
  blinds: 1.5,
  nextLevel: 0.3,
  nextBreak: 0.3
};

const POINTS_STORAGE_KEY = 'championshipPointsBareme';
const DEFAULT_POINTS_BAREME = [
    { rank:  1, points: 500 }, { rank:  2, points: 450 }, { rank:  3, points: 400 },
    { rank:  4, points: 350 }, { rank:  5, points: 300 }, { rank:  6, points: 250 },
    { rank:  7, points: 200 }, { rank:  8, points: 150 }, { rank:  9, points: 130 },
    { rank: 10, points: 110 }, { rank: 11, points: 100 }, { rank: 12, points:  90 },
    { rank: 13, points:  80 }, { rank: 14, points:  70 }, { rank: 15, points:  60 },
    { rank: 16, points:  50 }, { rank: 17, points:  45 }, { rank: 18, points:  40 },
    { rank: 19, points:  35 }, { rank: 20, points:  30 }, { rank: 21, points:  25 },
    { rank: 22, points:  20 }, { rank: 23, points:  15 }, { rank: 24, points:  10 }
];
// Rangs 25 à 50 à 5 points
for (let i = 25; i <= 50; i++) {
    DEFAULT_POINTS_BAREME.push({ rank: i, points: 5 });
}
let POINTS_BAREME_DATA = getPointsBareme();

const socket = io('http://zefoumi.cluster121.hosting.ovh.net:3000/');
// Si le serveur envoie une mise à jour, on l'applique
socket.on('sync_game', (data) => {
    timeLeft = data.timeLeft;
    running = data.running;
    currentLevel = data.currentLevel;
    updateUI(); // Rafraîchit l'affichage du chrono et des blinds
});

// Et quand tu modifies quelque chose (ex: bouton Pause)
function broadcastState() {
    socket.emit('update_game', {
        timeLeft: timeLeft,
        running: running,
        currentLevel: currentLevel
    });
}

/**
 * Charge le barème depuis localStorage ou utilise la version par défaut.
 * @returns {Array<Object>} Le barème de points actuel.
 */
function getPointsBareme() {
    const savedData = localStorage.getItem(POINTS_STORAGE_KEY);
    if (savedData) {
        // Parse les données et assure la conversion des points en nombres
        const parsedData = JSON.parse(savedData);
        return parsedData.map(item => ({ 
            rank: parseInt(item.rank, 10), 
            points: parseInt(item.points, 10) 
        }));
    }
    return DEFAULT_POINTS_BAREME;
}

/**
 * Sauvegarde le barème actuel dans localStorage.
 */
function savePointsBareme(bareme) {
    localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(bareme));
}

function applyFontSizes() {
  return;
  document.getElementById('level').style.fontSize           = (baseFontSize * fontRatios.level)     + 'em';
  document.getElementById('timer').style.fontSize           = (baseFontSize * fontRatios.timer)     + 'em';
  document.getElementById('blinds-info').style.fontSize     = (baseFontSize * fontRatios.blinds)    + 'em';
  document.getElementById('next-level-info').style.fontSize = (baseFontSize * fontRatios.nextLevel) + 'em';
  document.getElementById('next-break-info').style.fontSize = (baseFontSize * fontRatios.nextBreak) + 'em';
}

function syncJoueursToClassement() {
  if (!window.joueursImportes || window.joueursImportes.length === 0) {
    alert("Aucun joueur importé !");
    return;
  }
  classementData = window.joueursImportes.map(j => ({
    winamax:  j.winamax,
    nom:      j.nom,
    prenom:   j.prenom,
    mpla:     j.mpla,
    round:    '',
    heure:    '',
    killer:   '',
    rank:     '',
    table:    '',
    seat:     '',
    actif:    false,
    pts:      0,
  }));

  // Réinitialise la liste des anciennes assignations
  playerAssignments = [];

  renderClassement();
  renderTablesPlan();
  exportAppToJSON();
}

function importPlayersCSV(url=PLAYERS_CSV_URL) {
  fetch(url+'?output=csv')
    .then(response => { return response.blob(); })
    .then(blob => {
        return blob.arrayBuffer();
    })
    .then(blob => {
        // 2. Décoder le Blob en texte en utilisant UTF-8
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(blob);
    })
    .then(csvText => {
      const lines = csvText.trim().split('\n');
      let rawData = lines.slice(7).map(line => line.split(',').map(v => v.trim()));
      let data = rawData.filter(row => row.length > 1 && row[1] !== '');
      let html = '<table id="players-table"><thead><tr>';
      html += '<th>Prénom</th><th>MPLA</th><th>Winamax</th></tr></thead><tbody>';
      data.forEach(row => {
        if (row.length >= 7) {
          html += `<tr>
            <td>${row[0] || ''}</td>
            <td>${row[1] || ''}</td>
            <td>${row[2] || ''}</td>
          </tr>`;
        }
      });
      html += '</tbody></table>';
      document.getElementById('players-table-container').innerHTML = html;
      // Stocke la liste brute pour la synchronisation
      window.joueursImportes = data.map(row => ({
        prenom: row[0] || '', mpla: row[1] || '', winamax: row[2] || ''
      }));
    });
}

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
/*
  // On prend la première ligne comme titre
  structureTitle = lines[0].replace(/,/g, ' ').trim();
*/
  // On saute les 6 premières lignes (0 à 5) pour les données
  const dataLines = lines.slice(6);
  return dataLines.map(line => line.split(',').map(cell => cell.trim()));
}

function updatePlayerStatusDisplay() {
    const totalRegistered = classementData.filter(p => p.actif === true).length;
    const playersIn = classementData.filter(p => p.actif === true && (p.rank === null || p.rank === '')).length;
    const playersOut = classementData.filter(p => p.rank !== null && p.rank !== '').length;

    // Calcul du tapis moyen
    let avgStack = '--';
    if (playersIn > 0) {
        // Le tapis total est : (Joueurs Inscrits * Stack de départ) - (Blinds et Antes totales éliminées)
        // Simplification : Stack total initial / nombre de joueurs restants
        const totalStack = totalRegistered * startingStack;
        avgStack = Math.round(totalStack / playersIn).toLocaleString('fr-FR');
    }

    // Mise à jour des éléments dans la colonne 1
    const currentPlayersSpan = document.getElementById('current-players');
    if (currentPlayersSpan) {
        currentPlayersSpan.textContent = playersIn+'/'+totalRegistered;
    }

    const outPlayersSpan = document.getElementById('out-players');
    if (outPlayersSpan) {
        outPlayersSpan.textContent = playersOut;
    }

    const avgStackSpan = document.getElementById('avg-stack-value');
    if (avgStackSpan) {
        avgStackSpan.textContent = avgStack;
    }
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
          label: `BREAK`,
          blinds: '-',
          ante: '',
          duration: parseInt(breakDuration) * 60,
          isPause: true
        });
      }
    }

    if (levels.length === 0) throw new Error('Aucun niveau trouvé dans la structure.');

    // Sécurisation de l'accès aux variables globales (réinitialisation si la structure est plus courte)
    if (currentLevel >= levels.length) {
        currentLevel = 0;
    }
    if (currentLevel === 0 && timeLeft <= 0) {
        timeLeft = levels[0].duration;
    }
    
    updateDisplay();
    renderStructureTable();
  } catch (e) {
    alert.error("Erreur de chargement de la structure:", e);
  }
}

function updateDisplay() {
    // 1. Déterminer les informations actuelles et suivantes
    const current = levels[currentLevel];
    const next = levels[currentLevel + 1];
    
    // 2. Formatage du temps
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    
    // ===============================================
    // 3. MISE À JOUR SÉCURISÉE DES ÉLÉMENTS DOM
    // ===============================================

    // Vérification de l'élément 'timer'
    const timerElem = document.getElementById('timer');
    if (timerElem) {
        timerElem.textContent = `${minutes}:${seconds}`;
    }

    // Vérification de l'élément 'level'
    const levelElem = document.getElementById('level');
    if (levelElem) {
        levelElem.textContent = current.label;
    }

    // Affichage ou masquage des blinds/ante selon le type de niveau
    const blindsInfoDiv = document.getElementById('blinds-info');
    if (blindsInfoDiv) {
      blindsInfoDiv.textContent =
        levels[currentLevel].blinds +
        (levels[currentLevel].ante ? ' | ' + levels[currentLevel].ante : '');      
    }

    // Vérification de l'élément 'next-level-info'
    const nextLevelElem = document.getElementById('next-level-info');
    if (nextLevelElem) {
        if (next) {
            nextLevelElem.textContent = next.isPause 
                ? `Prochain niveau: break de ${next.duration / 60} min` 
                : `Prochain niveau: ${next.blinds} ${next.ante}`;
        } else {
            nextLevelElem.textContent = 'Fin de la structure';
        }
    }

    // Calcul du temps avant la prochaine pause
    const nextBreakDiv = document.getElementById('next-break-info');
    let timeToBreak = 0;
    let found = false;
    let breakDuration = 0;
    for (let i = currentLevel + 1, t = timeLeft; i < levels.length; i++) {
      t += levels[i].duration;
      if (levels[i].isPause) {
        breakDuration = levels[i].duration;
        timeToBreak = t;
        found = true;
        break;
      }
    }
    if (found) {
      const min = Math.floor((timeToBreak-breakDuration) / 60);
      const sec = timeToBreak % 60;
      nextBreakDiv.textContent = "Break dans : " + min + " min " + (sec < 10 ? "0" : "") + sec + " s";
    } else {
      nextBreakDiv.textContent = "";
    }

    if (levels[currentLevel].isPause) {
      timerElem.classList.add('pause');
      levelElem.textContent='-';
      blindsInfoDiv.textContent = 'BREAK';
      blindsInfoDiv.classList.add('pause');
    } else {
      timerElem.classList.remove('pause');
      blindsInfoDiv.classList.remove('pause');
    }

    // Si le titre de la structure est mis à jour ici
    const structureTitleElem = document.getElementById('structure-title');
    if (structureTitleElem) {
        structureTitleElem.textContent = structureTitle;
    }

    // Appel à la mise à jour des stats dans l'autre colonne
    updatePlayerStatusDisplay(); 
    renderClassementSimplifie();
    renderChampionnatRanking();
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
//    stopTimer();
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
        if (timeLeft === 5) {
            playMultiToneAlert();
        }
        updateDisplay();
      } else {
        nextLevel();
      }
    }, 1000);
    updateDisplay();
  }

    // Gestion de l'affichage des boutons (Démarrer -> Pause)
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-block';


}

function stopTimer() {
    if (!running) return;

    running = false;
    clearInterval(timerInterval);
    timerInterval = null;
    updateDisplay();

    // Gestion des boutons
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (startBtn) {
        startBtn.style.display = 'inline-block'; // Afficher Démarrer
    }
    if (stopBtn) {
        stopBtn.style.display = 'none'; // Masquer Pause
    }
    // Fin du nouveau code
}

function playLongBeep(duration = 2) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine'; // Tu peux essayer 'triangle' ou 'square' ou 'sine' pour un son différent
  o.frequency.value = 660; // Fréquence du son (Hz), modifie pour un son plus grave/aigu
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.value = 0.2;
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  o.stop(ctx.currentTime + duration);
}

function playMultiToneAlert() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  // Tableau des [fréquence en Hz, durée en secondes]

  const tones = [
    [ 800, 0.9],
    [   0, 0.1],
    [ 800, 0.9],
    [   0, 0.1],
    [ 800, 0.9],
    [   0, 0.1],
    [ 800, 0.5], 
    [2500, 0.2], 
    [1000, 0.1], 
    [2500, 0.1], 
    [1000, 0.1], 
    [2500, 0.1], 
    [1000, 0.1], 
    [2500, 0.1], 
    [1000, 0.1], 
    [2500, 0.1], 
    [1000, 0.5], 
  ];

  let currentTime = ctx.currentTime;

  tones.forEach(([freq, duration], i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.2;

    o.start(currentTime);
    g.gain.setValueAtTime(0.2, currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, currentTime + duration);

    o.stop(currentTime + duration);

    currentTime += duration;
  });
}

function resetAll() {
  // 1. Remet le chrono au round 1
  stopTimer();
  currentLevel = 0;
  timeLeft = levels[0]?.duration || 0;
  running = false;
  clearInterval(timerInterval);

  // 2. Réinitialise la sélection des joueurs
  selectedPlayersIndexes = [];

  // 3. Réinitialise le classement
  classementData = [];

  // 4. Réinitialise l’assignation des sièges
  playerAssignments = [];

  // 5. Rafraîchit l’affichage
  updateDisplay();
  renderClassement();
  renderTablesPlan();
  exportAppToJSON();
  updatePlayerStatusDisplay();
}// Génère le tableau de structure complète

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tabDiv => tabDiv.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick="showTab('${tab}')"]`).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'structure') {
    loadStructure();
  }
  if (tab === 'joueurs') {
    importPlayersCSV();
  }
  if (tab === 'tables') {
    renderTablesPlan();
  }
  if (tab === 'tournoi') {
    renderClassement();
  }
  if (tab === 'championnat') { 
    renderChampionnatRanking();
  }
  if (tab === 'points') {
    renderPointsTable(); // Appel de la nouvelle fonction
  }
}

/**
 * Remet tous les joueurs en jeu et retire les assignations de sièges
 * - active tous les joueurs
 * - vide rank/pts/heure/round/killer
 * - retire table et seat
 * - vide playerAssignments
 * - met à jour l'affichage et sauvegarde
 */
function resetTournoi() {
  // Remettre tous les joueurs en jeu
  classementData.forEach(p => {
    // Ne pas modifier `p.actif` (inscrit/non inscrit) — laissé tel quel
    p.rank = '';
    p.pts = 0;
    p.heure = '';
    p.round = '';
    p.killer = '';
    p.table = null;
    p.seat = null;
  });

  // Supprimer toutes les assignations conservées
  playerAssignments = [];

  // Mettre à jour l'affichage
  renderClassement();
  renderClassementSimplifie();
  renderTablesPlan();
  renderChampionnatRanking();
  updatePlayerStatusDisplay();
  exportAppToJSON();
  // Remettre la clock au début de la structure
  try {
    stopTimer();
  } catch (e) { /* ignore if stopTimer not available */ }
  currentLevel = 0;
  timeLeft = levels[0]?.duration || 0;
  running = false;
  updateDisplay();
}

/**
 * Gère l'édition d'une cellule de points et sauvegarde le nouveau barème.
 * @param {HTMLElement} element - La cellule <td> modifiée.
 * @param {number} rank - Le rang associé à cette cellule.
 */
function handlePointEdit(element, rank) {
    let newValue = parseInt(element.textContent.trim(), 10);

    // Valider et nettoyer la valeur
    if (isNaN(newValue) || newValue < 0) {
        // Si la valeur n'est pas valide, on la réinitialise à l'ancienne valeur ou à 0
        newValue = 0; 
        element.textContent = newValue;
    }

    // Mettre à jour l'objet de données
    const itemIndex = POINTS_BAREME_DATA.findIndex(item => item.rank === rank);
    if (itemIndex !== -1) {
      POINTS_BAREME_DATA[itemIndex].points = newValue;
    }
    
    // Sauvegarder les données mises à jour
    savePointsBareme(POINTS_BAREME_DATA);

    // Optionnel : Vous pourriez rappeler renderPointsTable() pour rafraîchir l'affichage
    // mais ici on se contente de mettre à jour le contenu de la cellule
}

function renderPointsTable() {
    const container = document.getElementById('points-table-container');
    if (!container) return;

    let html = '<table class="ranking-table">';
    
    // Message pour indiquer l'éditabilité
    html += '<caption>* Cliquez sur les points pour modifier la valeur.</caption>';
    
    // En-têtes
    html += '<thead><tr><th>Rang</th><th>Points</th></tr></thead><tbody>';

    // Rendu des lignes
    POINTS_BAREME_DATA.forEach(item => {
        html += `
          <tr>
            <td>${item.rank}</td>
            <td contenteditable="true" onblur="handlePointEdit(this, ${item.rank})">${item.points}</td>
          </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Génère le tableau de structure complète
function renderStructureTable() {
  // Vérification de l'existence du conteneur
  const container = document.getElementById('structure-table-container');
  if (!container) {
      // Si on ne trouve pas l'ID, on arrête sans erreur.
      console.error("Erreur: Le conteneur de structure (ID 'structure-table-container') est manquant.");
      return;
  }
  
  if (!levels || levels.length === 0) {
      container.innerHTML = '<p style="color:red;">Aucune structure de niveaux chargée.</p>';
      return;
  }

  let html = '<table id="structure-table"><thead><tr><th>#</th><th>Type</th><th>Blinds</th><th>Ante</th><th>Durée</th></tr></thead><tbody>';
  levels.forEach((lvl, idx) => {
    // La fonction formatTime est déjà définie pour formatter la durée
    const durationDisplay = formatTime(lvl.duration); 
    
    if (lvl.isPause) {
      html += `<tr class="pause-row"><td>${idx + 1}</td><td>Break</td><td colspan="2"></td><td>${durationDisplay}</td></tr>`;
    } else {
      html += `<tr><td>${idx + 1}</td><td>${lvl.label}</td><td>${lvl.blinds}</td><td>${lvl.ante || '-'}</td><td>${durationDisplay}</td></tr>`;
    }
  });
  html += '</tbody></table>';
  
  // Injection dans le conteneur sécurisé
  container.innerHTML = html;
}

function sortClassement(column) {
  if (classementSort.column === column) {
    classementSort.asc = !classementSort.asc;
  } else {
    classementSort.column = column;
    classementSort.asc = true;
  }
  renderClassement();
}

function renderClassementSimplifie() {
// 1. Filtrer uniquement les joueurs éliminés ET inscrits
    const rankedPlayers = classementData.filter(p => 
        // Le joueur doit être inscrit (isIn est true)
        (p.actif === true) 
    );

    // 2. Trier par rang final (du plus petit au plus grand, ex: 1er, 2e, 3e...)
    rankedPlayers.sort((a, b) => {

        const rankA = a.rank === '' || a.rank === null ? 0 : parseInt(a.rank);
        const rankB = b.rank === '' || b.rank === null ? 0 : parseInt(b.rank);

        // Si rankA ou rankB est 0 (signifiant '' ou null), ils seront considérés comme les plus petits
        // (donc premiers dans l'ordre croissant).

        // Si les deux sont en jeu (rankA == 0 et rankB == 0),
        // vous pouvez ajouter ici un critère de tri secondaire (ex: par points ou par nom).
        if (rankA === 0 && rankB === 0) {
            // Optionnel : Critère de tri secondaire pour les joueurs encore en jeu.
            // Ici, on trie par nom (alphabétique) :
            return a.mpla.localeCompare(b.mpla);
        }

        return rankA - rankB; // Tri ascendant normal (1, 2, 3...)
    });

    let htmlContent = '';

    const container = document.getElementById('simple-ranking-container');
    if (!container) return; // Sécurité

    if (rankedPlayers.length === 0) {
        container.innerHTML = 'Aucune élimination enregistrée.';
        return;
    }

    // Démarrer la structure du tableau
    htmlContent = '<table class="simple-ranking-table"><tbody>';

    // 3. Générer les lignes du tableau (Rang | Nom | Bouton OUT)
    rankedPlayers.forEach((p, index) => {
        const ptsLadder = DEFAULT_POINTS_BAREME[index].points+'pts';
        const buttonText = p.rank ?  ptsLadder : 'X'; 
        const buttonClass = p.rank ? '' : 'out-btn';
        const rankText = p.rank ? p.rank : '';
        const ladder = p.rank ? '' : ptsLadder;
        
        // Nous allons ajouter un bouton pour POUVOIR annuler l'élimination ou modifier le statut.
        // Si le joueur est classé (rankedPlayers), le bouton est inutile, car il est déjà OUT.
        // C'est pourquoi ce tableau affiche uniquement les joueurs DÉJÀ éliminés.
        
        // Pour les besoins du développement, nous allons l'ajouter pour potentiellement modifier le rang.

        htmlContent += `
            <tr>
                <td class="rank-cell">
                    ${rankText}.
                </td>
                <td class="name-cell">
                    ${p.mpla}
                </td>
                
                <td class="btn-cell">
                    <button 
                        class="${buttonClass}"
                        title="Eliminer ${p.mpla}"
                        onclick="toggleOutClassement('${p.mpla}')"> ${buttonText}
                    </button>
                </td>
                <td class="pts-ladder">
                    ${ladder}
                </td>
            </tr>
        `;
    });
    
    htmlContent += '</tbody></table>';
    container.innerHTML = htmlContent;
    exportAppToJSON();
    updatePlayerStatusDisplay();
}

function renderClassement() {
  // 1. Triage des données (NOUVELLE LOGIQUE)
  classementData.sort((a, b) => {
      // ----------------------------------------------------
      // 1. INSCRITS (actif: true) en haut, NON-INSCRITS en bas
      // ----------------------------------------------------
      const actifA = a.actif ? 1 : 0;
      const actifB = b.actif ? 1 : 0;
      if (actifA !== actifB) {
          return actifB - actifA; // Descendant (Inscrit avant Non-inscrit)
      }

      // Si les deux sont INACTIFS (Non-inscrit)
      if (actifA === 0) {
          // 2. Tri par RANK (croissant) pour les joueurs éliminés
          const isRankedA = a.rank !== null && a.rank !== '';
          const isRankedB = b.rank !== null && b.rank !== '';

          // Les joueurs classés (avec un rank) viennent avant les non-classés
          if (isRankedA !== isRankedB) {
              return isRankedB - isRankedA; // Classé avant Non-classé
          }

          if (isRankedA) {
              // Les deux sont classés, trier par rank croissant (1, 2, 3...)
              const rankA = parseInt(a.rank);
              const rankB = parseInt(b.rank);
              return rankA - rankB;
          }
          
          // Dernier critère pour les Non-inscrits sans rank : MPLA
          const mplaA = a.mpla ? a.mpla.toLowerCase() : '';
          const mplaB = b.mpla ? b.mpla.toLowerCase() : '';

          if (mplaA < mplaB) return -1;
          if (mplaA > mplaB) return 1;
          return 0;      }

      // ----------------------------------------------------
      // Si les deux sont ACTIFS (Inscrit)
      // ----------------------------------------------------
      
      // 3. Tri par TABLE (croissant)
      const tableA = parseInt(a.table) || Infinity;
      const tableB = parseInt(b.table) || Infinity;
      if (tableA !== tableB) {
          return tableA - tableB;
      }

      // 4. Tri par SIÈGE (croissant)
      const seatA = parseInt(a.seat) || Infinity;
      const seatB = parseInt(b.seat) || Infinity;
      return seatA - seatB;
  });

  let html = '<table id="classement-table"><thead><tr>';
  
  // 2. Génération des en-têtes de colonnes dans l'ordre demandé
  html += `
      <th>Inscrit</th>
      <th>Rank</th>
      <th>MPLA</th>
      <th>Table</th>
      <th>Siège</th>
      <th>Round OUT</th>
      <th>Heure OUT</th>
      <th>Killer</th>
      <th>In/Out</th>               `;
  html += '</tr></thead><tbody>';
  
  classementData.forEach(p => {
      const isElimine = p.rank !== null && p.rank !== '';
      
      // 1. Bouton Action : Afficher OUT uniquement si le joueur n'est pas éliminé
      actionContent = !isElimine 
          ? `<button class="in-btn" onclick="toggleOutClassement('${p.mpla}')">IN</button>` 
          : `<button class="out-btn" onclick="toggleOutClassement('${p.mpla}')">OUT</button>` ; // Vide si le joueur est éliminé (OUT)

      // 2. Colonne Killer : Liste déroulante des joueurs encore IN
      let killerContent = p.killer || '';
      
      if (isElimine) {
          // Filtrer les joueurs encore IN (actif: true ET rank null)
          const joueursEnJeu = classementData.filter(j => j.actif && (j.rank === null || j.rank === ''));
          
          killerContent = `<select onchange="updateClassementCell('${p.mpla}', 'killer', this.value)">`;
          killerContent += `<option value="">-- Choisir Killer --</option>`;
          
          // Ajouter les joueurs en jeu à la liste
          joueursEnJeu.forEach(j => {
              const isSelected = j.mpla === p.killer ? 'selected' : '';
              killerContent += `<option value="${j.mpla}" ${isSelected}>${j.mpla}</option>`;
          });
          killerContent += `</select>`;
      }
      
      const isOut = p.rank !== null && p.rank !== '';
      const rankDisplay = isOut ? p.rank : '';

      // Contenu de la colonne 'Actif' (Gris/Vert)
      // Note: Vous devrez ajouter une fonction 'toggleActif' et un 'onclick' si vous voulez que ce soit un vrai toggle
      const isActif = p.actif;
      const toggleClass = isActif ? 'active' : 'inactive';
      if(!isActif) {
        actionContent ='';
      }
      
      const actifContent = `
          <div class="toggle-switch ${toggleClass}" onclick="toggleActif('${p.mpla}')">
              <span class="switch-slider"></span>
              <span class="switch-label">${isActif ? 'Inscrit' : ''}</span>
          </div>
      `;

      const seatDisplay = p.seat || ''; 
      
      html += `
          <tr class="${isElimine ? 'out-row' : ''}">
            <td>${actifContent}</td>     
            <td>${rankDisplay}</td>
            <td>${p.mpla || ''}</td>
            <td>${p.table || ''}</td>
            <td>${seatDisplay}</td>
            <td>${p.round || ''}</td>
            <td>${p.heure || ''}</td>
            <td>${killerContent}</td>
            <td>${actionContent}</td>
          </tr>
      `;
  });
  
  html += '</tbody></table>';
  document.getElementById('classement-container').innerHTML = html;
  
  exportAppToJSON();
  renderClassementSimplifie();
  renderChampionnatRanking();
}

function toggleActif(mpla) {
    mpla = String(mpla); 
    const index = classementData.findIndex(p => p.mpla === mpla);
    if (index === -1) return;

    const player = classementData[index];
    
    // 1. Inverser le statut actif
    player.actif = !player.actif; 

    if (!player.actif) {
        // 2. Si le joueur devient inactif (désinscrit), il perd son siège
        player.table = null;
        player.seat = null;
    } 
    
    // 3. Si le joueur était éliminé, il doit rester éliminé s'il redevient actif
    // Mais s'il était actif et qu'on le rend inactif, il ne doit pas se classer
    
    // Si un joueur devient Inactif ET qu'il était actif (rank = null), il ne doit pas être affecté au classement
    // Si un joueur devient actif ET qu'il était OUT, il garde son rank. (Ce n'est pas le rôle de toggleActif de le remettre IN)
    
    // 4. Mettre à jour l'affichage et sauvegarder
    renderClassement();
    renderTablesPlan(); // Mise à jour du plan de tables
    exportAppToJSON();
}

function toggleOutClassement(mpla) {
    mpla = String(mpla); 
    const index = classementData.findIndex(p => p.mpla === mpla);
    if (index === -1) return;

    // Détermine le nombre total de joueurs INscrits (actif: true), y compris ceux qui sont déjà éliminés.
    const N_registered = classementData.filter(p => p.actif === true).length;

    if (classementData[index].rank === null || classementData[index].rank === '') {
        // ===================================
        // PASSE DE IN à OUT (Élimination)
        // ===================================
        
        // Compter le nombre de joueurs déjà classés parmi les inscrits.
        const rankedCount = classementData.filter(p => p.actif === true && p.rank !== null && p.rank !== '').length;

        // 1. Calculer le rang (place finale)
        // Le rang est la place restante (N_registered - Nombre déjà éliminé)
        classementData[index].rank = N_registered - rankedCount; 
        
        // 2. Remplir les colonnes heure et round
        const now = new Date();
        classementData[index].heure = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) 
                                    + ' ' 
                                    + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        classementData[index].round = currentLevel; 

        // 3. Attribution des points au joueur 
        classementData[index].pts = DEFAULT_POINTS_BAREME.find(item => item.rank === classementData[index].rank).points;
        joueurRestantPts = DEFAULT_POINTS_BAREME.find(item => item.rank === (classementData[index].rank - 1)).points;
        classementData.forEach(p => {
          if (p.actif && (p.rank === null || p.rank === '')) {
            p.pts = joueurRestantPts;
          }
        });

        // 4. Retirer l'assignation de table/siège
        classementData[index].table = null;
        classementData[index].seat = null;
        // Si après cette élimination il ne reste qu'UN joueur en jeu,
        // on le marque automatiquement OUT et on arrête le chrono.
        const remainingPlayers = classementData.filter(p => p.actif && (p.rank === null || p.rank === ''));
        if (remainingPlayers.length === 1) {
          const remaining = remainingPlayers[0];
          // Le rang du dernier sera juste au-dessus de celui qui vient d'être marqué
          const lastRank = N_registered - rankedCount - 1; // ex: si N=10, rankedCount=8 -> lastRank=1
          remaining.rank = lastRank;
          const now2 = new Date();
          remaining.heure = now2.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + now2.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          remaining.round = currentLevel;
          remaining.pts = (DEFAULT_POINTS_BAREME.find(item => item.rank === remaining.rank) || {}).points || 0;
          // Retire aussi sa table/siège
          remaining.table = null;
          remaining.seat = null;
          // Stoppe le chrono
          try { stopTimer(); } catch (e) { console.warn('stopTimer failed', e); }
        }
        
    } else {
        // ===================================
        // PASSE DE OUT à IN (Réintégration)
        // ===================================

        // 1. Vider les données d'élimination
        classementData[index].rank = '';
        classementData[index].pts = 0;
        classementData[index].heure = '';
        classementData[index].round = '';
        classementData[index].killer = ''; 

        nbJoueursRestant = classementData.filter(p => p.actif && (p.rank === null || p.rank === '' | p.rank === 0)).length;
        joueurRestantPts = DEFAULT_POINTS_BAREME[nbJoueursRestant-1].points;
        classementData.forEach(p => {
          if (p.actif && (p.rank === null || p.rank === '')) {
            p.pts = joueurRestantPts;
          }
        });
        
        // 2. Le joueur redevient actif (si ce n'est pas déjà le cas)
        classementData[index].actif = true;

        // 3. Récalculer tous les ranks des joueurs éliminés pour corriger la séquence
        // Utilise N_registered pour la base du re-ranking.
        const joueursARanker = classementData.filter(p => p.rank !== null && p.rank !== '').sort((a, b) => parseInt(b.rank) - parseInt(a.rank));

        let rankCounter = N_registered; 
        joueursARanker.forEach(p => {
            p.rank = rankCounter; 
            rankCounter--;
        });
    }
    
    // 5. Équilibrer les tables (si un joueur a quitté un siège ou doit en être réassigné)
    const perTable = getDynamicPerTable();
    // On prend seulement les joueurs ACITFS/INSCRITS sans rang pour l'équilibrage
    const joueursActifs = classementData.filter(p => p.actif && (p.rank === null || p.rank === '')).map(p => ({ mpla: p.mpla }));
    classementData.forEach(p => {
        if (p.actif && (p.rank === null || p.rank === '')) {
            p.table = null;
            p.seat = null;
        }
    });
    playerAssignments = playerAssignments.filter(assignment => 
        joueursActifs.some(j => j.mpla === assignment.mpla)
    );
    const { assignments, changes } = equilibrerTables(joueursActifs, perTable, playerAssignments);
    
    playerAssignments = assignments; 
    assignments.forEach(a => {
        const p = classementData.find(j => j.mpla === a.mpla);
        if (p) {
            p.table = a.table;
            p.seat = a.seat;
        }
    });

    if (changes.length > 0) { showPopup(changes); }

    // 6. Mettre à jour l'affichage
    renderClassementSimplifie();
    renderClassement();
    renderChampionnatRanking();
    renderTablesPlan();
    updateDisplay();
    exportAppToJSON();
}

/**
 * Assigne et équilibre les tables en minimisant les déplacements et en fermant les tables si besoin.
 * @param {Array} joueurs - Liste des joueurs à assigner [{mpla, ...}]
 * @param {number} perTable - Nombre max de joueurs par table
 * @param {Array} oldAssignments - Assignations précédentes [{mpla, table, seat}]
 * @returns {Object} { assignments: [...], changes: [...], tablesCassees: [...] }
 */
function equilibrerTables(joueurs, perTable, oldAssignments = []) {
  const totalPlayers = joueurs.length;
  const nbTables = Math.max(1, Math.ceil(totalPlayers / perTable));

  // Regrouper les anciens assignments par table
  let oldByTable = {};
  oldAssignments.forEach(a => {
    if (!oldByTable[a.table]) oldByTable[a.table] = [];
    oldByTable[a.table].push(a);
  });

  console.log(oldByTable);

  // 1. Si le nombre de tables diminue, on ferme la table la moins remplie
  let oldTables = Array.from(new Set(oldAssignments.map(a => a.table))).filter(t => !isNaN(Number(t)));
  console.log(oldTables);
  let tablesCassees = [];
  let joueursToReassign = [];
  if (oldTables.length > nbTables) {
    let tablesToClose = [...oldTables]
      .sort((a, b) => (oldByTable[a]?.length || 0) - (oldByTable[b]?.length || 0))
      .slice(0, oldTables.length - nbTables);
    tablesCassees = tablesToClose.map(Number);
    tablesToClose.forEach(tc => {
      if (oldByTable[tc]) joueursToReassign.push(...oldByTable[tc]);
      delete oldByTable[tc];
    });
  }

  // 2. Génère la liste des tables restantes
  let tableNumbers;
  if (tablesCassees.length > 0) {
    tableNumbers = oldTables.filter(t => !tablesCassees.includes(Number(t))).map(Number).sort((a, b) => a - b);
  } else {
    tableNumbers = oldTables.map(Number).sort((a, b) => a - b);
    while (tableNumbers.length < nbTables) {
      let next = (tableNumbers.length ? Math.max(...tableNumbers) : 0) + 1;
      tableNumbers.push(next);
    }
  }

  // 3. Place les joueurs à leur table/siège d'origine si possible (hors tables cassées)
  let assignments = [];
  let usedMPLA= new Set();
  let usedSeatsByTable = {};
  tableNumbers.forEach(tableNum => usedSeatsByTable[tableNum] = new Set());

  tableNumbers.forEach(tableNum => {
    let oldTable = oldByTable[tableNum] || [];
    oldTable.forEach(a => {
      if (joueurs.find(j => j.mpla === a.mpla) && !usedSeatsByTable[tableNum].has(a.seat)) {
        assignments.push({
          mpla: a.mpla,
          table: tableNum,
          seat: a.seat || 1
        });
        usedMPLA.add(a.mpla);
        usedSeatsByTable[tableNum].add(a.seat || 1);
      }
    });
  });

  // 4. Pour les joueurs à réassigner (tables cassées), on les place sur les tables restantes, sur le premier siège libre
  joueursToReassign.forEach(j => {
    let destTable = tableNumbers
      .sort((a, b) => assignments.filter(x => x.table === a).length - assignments.filter(x => x.table === b).length)[0];
    let usedSeats = usedSeatsByTable[destTable];
    let s = 1;
    while (usedSeats.has(s)) s++;
    assignments.push({
      mpla: j.mpla,
      table: destTable,
      seat: s
    });
    usedMPLA.add(j.mpla);
    usedSeats.add(s);
  });

// 5. Équilibrage strict : on déplace le minimum de joueurs pour que l’écart max soit 1
  let changed = true;
  while (changed) {
    // Calcule la taille de chaque table
    let sizes = tableNumbers.map(t => assignments.filter(a => a.table === t).length);
    let max = Math.max(...sizes);
    let min = Math.min(...sizes);
    if (max - min <= 1) break; // équilibre atteint

    // Trouve la table la plus remplie et la moins remplie
    let tMax = tableNumbers.find(t => assignments.filter(a => a.table === t).length === max);
    let tMin = tableNumbers.find(t => assignments.filter(a => a.table === t).length === min);

    // Prend le joueur avec le plus grand siège de la table la plus remplie
    let toMove = assignments
      .filter(a => a.table === tMax)
      .sort((a, b) => (b.seat || 0) - (a.seat || 0))[0];

    // Cherche le premier siège libre sur la table la moins remplie
    let usedSeats = usedSeatsByTable[tMin];
    let newSeat = 1;
    while (usedSeats.has(newSeat)) newSeat++;

    // Déplace le joueur
    assignments = assignments.filter(a => a.mpla !== toMove.mpla);
    assignments.push({
      mpla: toMove.mpla,
      table: tMin, // CORRECTION: Utiliser tMin
      seat: newSeat
    });
    usedSeatsByTable[tMin].add(newSeat); 
    usedSeatsByTable[tMax].delete(toMove.seat);
    // Note : Il faudrait aussi supprimer le joueur déplacé de usedMPLA.
    // L'algorithme actuel repose sur la mise à jour des 'assignments', ce qui fonctionne.
    // On boucle jusqu'à équilibre
  }

  // 6. Pour les joueurs non encore assignés, on leur attribue le premier siège libre sur une table ouverte
  let unassignedJoueurs = joueurs.filter(j => !assignments.find(a => a.mpla === j.mpla));

  unassignedJoueurs.forEach(j => {
    // Trouvez la table la moins remplie parmi les tables ouvertes
    let destTable = tableNumbers
      .sort((a, b) => assignments.filter(x => x.table === a).length - assignments.filter(x => x.table === b).length)[0];

    // Cherchez le premier siège libre sur cette table
    let usedSeats = usedSeatsByTable[destTable];
    let s = 1;
    while (usedSeats.has(s)) s++;
    
    // Assignez le joueur
    assignments.push({
      mpla: j.mpla,
      table: destTable,
      seat: s
    });
    usedSeatsByTable[destTable].add(s);
  });

  // 7. Changements d'assignation (pour la popup)
  let changes = [];
  assignments.forEach(a => {
    let old = oldAssignments.find(o => o.mpla === a.mpla);
    if (!old || old.table !== a.table || old.seat !== a.seat) {
      changes.push({
        mpla: a.mpla,
        from: old ? { table: old.table, seat: old.seat } : { table: '-', seat: '-' },
        to: { table: a.table, seat: a.seat }
      });
    }
  });

  return { assignments, changes, tablesCassees };
}

/**
 * Retourne le nombre de joueurs par table ajusté dynamiquement.
 * (gestion Table Finale automatique: nombre initial +1)
 */
function getDynamicPerTable() {
  const input = document.getElementById('players-per-table');
  const raw = parseInt(input?.value, 10);
  const initial = Math.max(2, Number.isNaN(raw) ? 8 : raw);
  const N = classementData.filter(p => p.actif && (p.rank === null || p.rank === '')).length;
  const per = (2 * initial > N) ? (initial + 1) : initial;
  // Ne pas modifier le champ DOM `#players-per-table` ici :
  // on garde la valeur affichée telle quelle pour éviter des effets secondaires
  // lors d'un "retable" manuel. La règle est appliquée en interne seulement.
  return per;
}

function syncSelectedPlayersIndexes() {
  selectedPlayersIndexes = [];
  const rows = Array.from(document.querySelectorAll('#players-table tbody tr'));
  rows.forEach((tr, idx) => {
    const mpla = tr.querySelectorAll('td')[4]?.textContent.trim();
    if (classementData.some(p => p.mpla === mpla)) {
      selectedPlayersIndexes.push(idx);
      // Coche la case dans le DOM pour l'affichage immédiat
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = true;
    }
  });
}

function assignSeats() {
  // Prend uniquement les joueurs actif
  classementData.forEach(j => {
    if (j.actif && parseInt(j.rank) > 0) {
      j.table = '';
      j.seat = '';
    }
  });
  const joueurs = classementData.filter(p => p.actif && (p.rank == '' || p.rank == null)).map(p => ({ mpla: p.mpla }));
  if (joueurs.length === 0) {
    alert("Aucun joueur en jeu !");
    return;
  }

  console.log(joueurs);
  // Nombre de joueurs max par table (ajusté dynamiquement)
  const perTable = getDynamicPerTable();
  console.log('perTables:'+perTable);

  // Construit oldAssignments à partir de classementData pour les joueurs payés
  const oldAssignments = joueurs.map(j => {
    const p = classementData.find(p => p.mpla === j.mpla);
    return (p && p.table && p.seat && !isNaN(parseInt(p.table)) && !isNaN(parseInt(p.seat)))
      ? { mpla: p.mpla, table: parseInt(p.table), seat: parseInt(p.seat) }
      : { mpla: j.mpla, table: '', seat: ''};
  });
  const validOldAssignments = oldAssignments.filter(a => a.table !== ''); // AJOUTEZ CECI

  console.log(oldAssignments);
  console.log(validOldAssignments);
  // Appel à la fonction d'équilibrage stricte
  const { assignments, changes, tablesCassees } = equilibrerTables(joueurs, perTable, validOldAssignments);
  console.log(assignments);

  nbJoueursRestant = classementData.filter(p => p.actif && (p.rank === null || p.rank === '' | p.rank === 0)).length;
  // Mets à jour classementData pour TOUS les joueurs payés
  assignments.forEach(a => {
    let p = classementData.find(p => p.mpla === a.mpla);
    if (p) {
      p.table = a.table;
      p.seat = a.seat;
      p.pts = DEFAULT_POINTS_BAREME[nbJoueursRestant-1].points;
    } else {
      classementData.push({
        mpla: a.mpla,
        round: '',
        heure: '',
        killer: '',
        rank: '',
        table: a.table,
        seat: a.seat,
        actif: true,
        pts: DEFAULT_POINTS_BAREME[nbJoueursRestant-1].points,
      });
    }
  });

  // Mets à jour playerAssignments
  playerAssignments = assignments.map(a => ({
    mpla: a.mpla,
    table: a.table,
    seat: a.seat
  }));

  renderChampionnatRanking();
  renderClassement();
  renderClassementSimplifie();
  renderTablesPlan();
  exportAppToJSON();
}

function closePopup() {
  document.getElementById('popup-modal').style.display = 'none';
}

function showPopup(changes) {
    const modal = document.getElementById('popup-modal');
    const contentList = document.getElementById('popup-modal-body');
    
    // Si l'élément de contenu n'existe pas, on arrête
    if (!modal || !contentList) {
        console.error("Éléments de la modale non trouvés !");
        return;
    }

    let htmlContent = '<h2 style="color:#ffb300;">Changements de Sièges</h2>';
    htmlContent += '<ul style="list-style: none; padding-left: 0;">';

    changes.forEach(c => {
        const playerName = c.mpla;
        const fromTable = c.from.table !== '-' ? `table ${c.from.table} siège ${c.from.seat}` : 'N/A';
        const toTable = `table ${c.to.table} siège ${c.to.seat}`;
        
    htmlContent += `
        <li style="display: flex;">
            <strong style="flex: 1 1 35%; text-align: left; color: #ffb300;">${playerName}</strong> 
            <span style="flex: 1 1 30%; text-align: center; color: #aaa;">${fromTable}</span> 
            <span style="flex: 1 1 35%; text-align: right; font-weight: bold;">${toTable}</span>
        </li>
    `;

    });

    htmlContent += '</ul>';

    // Injecter le contenu et rendre la modale visible
    contentList.innerHTML = htmlContent;
    modal.style.display = 'flex'; // Utiliser 'flex' si le style est positionné pour centrer
}

function renderTablesPlan() {
  // On utilise classementData pour récupérer les joueurs avec une table et un siège
  // On ne prend que les joueurs non éliminés et qui ont une table/siège
  let players = classementData
    .filter(p => (p.rank === '' || p.rank === null) && p.table && p.seat)
    .map(p => ({
      table: parseInt(p.table),
      seat: parseInt(p.seat),
      mpla: p.mpla
    }));

  if (players.length === 0) {
    document.getElementById('tables-plan').innerHTML = '<p style="color:red;">Aucune assignation de sièges.</p>';
    return;
  }

  // Récupère le nombre de joueurs par table (optionnel, pour l'affichage)
  const perTable = getDynamicPerTable();

  // Regroupe par table
  const tables = {};
  players.forEach(p => {
    if (!tables[p.table]) tables[p.table] = [];
    tables[p.table][p.seat - 1] = p.mpla;
  });

  // Génère le HTML
  let html = '<div class="tables-flex">';
  Object.keys(tables).sort((a, b) => a - b).forEach(tableNum => {
    html += `<div class="table-block">
      <strong style="color:#ffb300; font-size:1.3em;">Table ${tableNum}</strong>
      <table style="margin:auto; background:#222; color:#fff; border-radius:8px; min-width:200px;">
        <tbody>`;
    for (let s = 0; s < perTable; s++) {
      const mpla = tables[tableNum][s];
      if (mpla) {
        html += `<tr>
          <td style="width:3em;">${s + 1}</td>
          <td class="player-cell" data-table="${tableNum}" data-seat="${s+1}" data-mpla="${mpla}" draggable="true" style="font-weight:bold; font-size:1.1em;">${mpla || '-'}</td>
        </tr>`;
      } else {
        html += `<tr>
          <td style="width:3em;">${s + 1}</td>
          <td class="player-cell empty" data-table="${tableNum}" data-seat="${s+1}" data-mpla="" style="font-style:italic; color:#bbb;">(vide)</td>
        </tr>`;
      }
    }
    html += `</tbody></table></div>`;
  });
  html += '</div>';
  document.getElementById('tables-plan').innerHTML = html;

  // Ajoute les gestionnaires drag & drop pour échange de joueurs
  const playerCells = document.querySelectorAll('#tables-plan .player-cell');
  playerCells.forEach(td => {
    td.addEventListener('dragstart', onSeatDragStart);
    td.addEventListener('dragover', onSeatDragOver);
    td.addEventListener('dragleave', onSeatDragLeave);
    td.addEventListener('drop', onSeatDrop);
  });
}

// Drag & Drop handlers
function onSeatDragStart(e) {
  const td = e.currentTarget;
  const table = td.dataset.table;
  const seat = td.dataset.seat;
  const mpla = td.dataset.mpla || '';
  // Empêche de drag une case vide
  if (!mpla) { e.preventDefault(); return; }
  e.dataTransfer.setData('text/plain', JSON.stringify({ table: parseInt(table), seat: parseInt(seat), mpla }));
  e.dataTransfer.effectAllowed = 'move';
}

function onSeatDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onSeatDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onSeatDrop(e) {
  e.preventDefault();
  const destTd = e.currentTarget;
  destTd.classList.remove('drag-over');
  const destTable = parseInt(destTd.dataset.table);
  const destSeat = parseInt(destTd.dataset.seat);
  const destMpla = destTd.dataset.mpla || '';
  const src = JSON.parse(e.dataTransfer.getData('text/plain'));

  const srcObj = { table: src.table, seat: src.seat, mpla: src.mpla };
  const destObj = { table: destTable, seat: destSeat, mpla: destMpla };

  swapSeats(srcObj, destObj);
  renderTablesPlan();
  renderClassement();
  exportAppToJSON();
}

function swapSeats(src, dest) {
  // Recherche des assignments dans playerAssignments
  const srcIdx = playerAssignments.findIndex(a => parseInt(a.table) === parseInt(src.table) && parseInt(a.seat) === parseInt(src.seat));
  const destIdx = playerAssignments.findIndex(a => parseInt(a.table) === parseInt(dest.table) && parseInt(a.seat) === parseInt(dest.seat));

  // Met à jour classementData en fonction des échanges
  const pSrc = classementData.find(p => p.mpla === src.mpla);
  const pDest = classementData.find(p => p.mpla === dest.mpla);

  // Si on déplace vers une case vide
  if ((!dest.mpla || dest.mpla === '') && src.mpla) {
    // Met à jour playerAssignments
    if (srcIdx !== -1) {
      playerAssignments[srcIdx].table = dest.table;
      playerAssignments[srcIdx].seat = dest.seat;
    } else {
      // Ajouter si absent
      playerAssignments.push({ mpla: src.mpla, table: dest.table, seat: dest.seat });
    }

    // Met à jour classementData
    if (pSrc) { pSrc.table = dest.table; pSrc.seat = dest.seat; }

    // Supprime éventuelle ancienne assignation dest (vide donc rien à faire)
    if (srcIdx !== -1 && destIdx !== -1 && srcIdx !== destIdx) {
      // cas improbable
    }
    return;
  }

  // Si les deux sont remplis, échange
  if (src.mpla && dest.mpla) {
    // Met à jour playerAssignments
    if (srcIdx !== -1) {
      playerAssignments[srcIdx].table = dest.table;
      playerAssignments[srcIdx].seat = dest.seat;
    }
    if (destIdx !== -1) {
      playerAssignments[destIdx].table = src.table;
      playerAssignments[destIdx].seat = src.seat;
    }
    // Si un des deux n'existait pas dans playerAssignments, on le crée
    if (srcIdx === -1) playerAssignments.push({ mpla: src.mpla, table: dest.table, seat: dest.seat });
    if (destIdx === -1) playerAssignments.push({ mpla: dest.mpla, table: src.table, seat: src.seat });

    // Met à jour classementData
    if (pSrc) { pSrc.table = dest.table; pSrc.seat = dest.seat; }
    if (pDest) { pDest.table = src.table; pDest.seat = src.seat; }
    return;
  }
}

function restoreAppFromLocalStorage() {
  const appStateJSON = localStorage.getItem('pokerAppData');
  if (!appStateJSON) return;
  try {
    const appState = JSON.parse(appStateJSON);
/*
    console.log("restoring ... pokerAppData file");
    console.log(appState);
*/
    // Structure
    if (appState.levels) levels = appState.levels;
/*
    console.log("restoring levels ...");
    console.log(levels);
*/
    // Horloge
    if (appState.horloge) {
      stopTimer();
      currentLevel = appState.horloge.currentLevel ?? 0;
      timeLeft = appState.horloge.timeLeft ?? 0;
      baseFontSize = appState.horloge.baseFontSize ?? 2;
      running = !!appState.horloge.running;
      applyFontSizes();
    }
/*
    console.log("restoring horloge ...");
    console.log(currentLevel);
    console.log(timeLeft);
    console.log(baseFontSize);
    console.log(running);
*/
    // Joueurs
    selectedPlayersIndexes = appState.selectedPlayersIndexes || [];
    playerAssignments = appState.playerAssignments || [];
/*    
    console.log("restoring playerAssignments ...");
    console.log(playerAssignments);
*/
    // ClassementData
/*
    console.log("restoring classementData ...");
    console.log(appState.classementData);
*/
    if (appState.classementData) classementData = appState.classementData;
/*
    console.log(classementData);
*/
    // Titre
    if (appState.structureTitle) {
      const titleElem = document.getElementById('structure-title');
      if (titleElem) titleElem.textContent = appState.structureTitle;
      structureTitle = appState.structureTitle;
    }
/*
    console.log("restoring structureTitle ...");
    console.log(structureTitle);
*/
    if (appState.championshipData) {
        championshipData = appState.championshipData;
    }

    if (appState.startingStack) {
        startingStack = appState.startingStack;
    }

    // Recharge l’affichage
    updateDisplay();
    if (typeof renderTablesPlan === 'function') renderTablesPlan();
    renderClassement();

    // Redémarre le timer si besoin
    if (running) startTimer();

  } catch (e) {
    alert("Erreur lors de la restauration depuis le localStorage.");
  }
}

function exportAppToJSON() {
    // Collecte de toutes les données importantes de l'application
    const appData = {
        levels: levels,
        horloge: { 
            currentLevel: currentLevel,
            timeLeft: timeLeft,
            running: running,
            baseFontSize: baseFontSize, 
        },
        structureTitle: structureTitle,
        playerAssignments: playerAssignments,
        classementData: classementData,
        currentRank: currentRank, 
        joueurAEliminerMPLA: joueurAEliminerMPLA,
        selectedPlayersIndexes: selectedPlayersIndexes,
        championshipData: championshipData,
        startingStack: startingStack
    };
    const jsonString = JSON.stringify(appData);
    
    // Sauvegarde dans le stockage local du navigateur
    localStorage.setItem('pokerAppData', jsonString);

    // Note: Si vous souhaitez TOUJOURS conserver l'export fichier pour un backup manuel,
    // ajoutez ici le code de téléchargement de fichier que vous aviez. Sinon, il n'est plus nécessaire.
    console.log("Données sauvegardées automatiquement dans localStorage.");
    console.log(appData);
//    console.log(jsonString);
}

function updateClassementCell(mpla, field, value) {
  const index = classementData.findIndex(p => p.mpla === mpla);
  if (index !== -1) {
    classementData[index][field] = value;
    exportAppToJSON();
  }
}

function updateStartingStackValue() {
    const startingStackElement = document.getElementById('starting-stack');
    
    // 1. Mise à jour de la variable globale (si nécessaire, bien que nous lisions directement ci-dessous)
    if (startingStackElement) {
        // Mettre à jour la variable globale avec la nouvelle valeur
        startingStack = parseInt(startingStackElement.value) || 20000; 
    }
    // 2. Appel des fonctions de rendu/calcul impactées
//    updateAverageStack();
    updatePlayerStatusDisplay(); // Mise à jour de l'affichage des joueurs et des stats
}

document.addEventListener('DOMContentLoaded', function() {
  
  // =========================================================
  // 1. CHARGEMENT AUTOMATIQUE DE L'ÉTAT (RESTAURATION)
  // =========================================================
  // Tente de charger l'état depuis localStorage
  restoreAppFromLocalStorage();
    
  // S'assurer que le script ne tente de lier l'écouteur que si l'élément existe
  const startingStackInput = document.getElementById('starting-stack');
  
  if (startingStackInput) {
    startingStackInput.value = startingStack;
    // 'input' se déclenche immédiatement à chaque frappe de touche, 
    // 'change' se déclenche lorsque le champ perd le focus. 'input' est souvent préférable.
    startingStackInput.addEventListener('input', updateStartingStackValue);
  }

  updateDisplay();
  renderClassement(); 
  renderTablesPlan();
});

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