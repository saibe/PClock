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
let classementSort = { column: 'rank', asc: true };
let currentRank = 1;
// Variable globale pour gérer le joueur en cours d'élimination
let joueurAEliminerWinamax = null;
let startingStack = 20000;

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

function syncJoueursToClassement() {
  if (!window.joueursImportes || window.joueursImportes.length === 0) {
    alert("Aucun joueur importé !");
    return;
  }
  classementData = window.joueursImportes.map(j => ({
    winamax: j.winamax,
    nom: j.nom,
    prenom: j.prenom,
    mpla: j.mpla,
    round: '', heure: '', killer: '', out: false, rank: '', table: '', seat: '', actif: false
  }));

  // Réinitialise la liste des anciennes assignations
  playerAssignments = [];

  renderClassement();
  renderTablesPlan();
  exportAppToJSON();
}

function importPlayersCSV() {
  fetch(PLAYERS_CSV_URL)
    .then(response => response.text())
    .then(csvText => {
      const lines = csvText.trim().split('\n');
      let data = lines.slice(5).map(line => line.split(',').map(v => v.trim()));
      let html = '<table id="players-table"><thead><tr>';
      html += '<th>Nom</th><th>Prénom</th><th>MPLA</th><th>Winamax</th></tr></thead><tbody>';
      data.forEach(row => {
        if (row.length >= 7) {
          html += `<tr>
            <td>${row[0]}</td>
            <td>${row[1]}</td>
            <td>${row[5]}</td>
            <td>${row[6]}</td>
          </tr>`;
        }
      });
      html += '</tbody></table>';
      document.getElementById('players-table-container').innerHTML = html;
      // Stocke la liste brute pour la synchronisation
      window.joueursImportes = data.map(row => ({
        nom: row[0], prenom: row[1], mpla: row[5], winamax: row[6]
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
  // On prend la première ligne comme titre
  structureTitle = lines[0].replace(/,/g, ' ').trim();
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
        currentPlayersSpan.textContent = playersIn;
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

    // Vérification de l'élément 'blinds-info'
    const blindsElem = document.getElementById('blinds-info');
    if (blindsElem) {
        blindsElem.textContent = `${current.blinds} ${current.ante}`;
    }

    // Vérification de l'élément 'next-level-info'
    const nextLevelElem = document.getElementById('next-level-info');
    if (nextLevelElem) {
        if (next) {
            nextLevelElem.textContent = next.isPause 
                ? `Prochaine: Pause de ${next.duration / 60} min` 
                : `Prochain niveau: ${next.blinds} ${next.ante}`;
        } else {
            nextLevelElem.textContent = 'Fin de la structure';
        }
    }
    
    // Vérification de l'élément 'next-break-info' (si utilisé séparément)
    // ... (appliquez le même pattern pour tous les autres IDs manipulés par updateDisplay)

    // Si le titre de la structure est mis à jour ici
    const structureTitleElem = document.getElementById('structure-title');
    if (structureTitleElem) {
        structureTitleElem.textContent = structureTitle;
    }

    // Appel à la mise à jour des stats dans l'autre colonne
    updatePlayerStatusDisplay(); 
    renderClassementSimplifie();
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
}

function stopTimer() {
  running = false;
  clearInterval(timerInterval);
  updateDisplay();
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
  importPlayersCSV();
  renderClassement();
  renderTablesPlan();
  exportAppToJSON();
}

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tabDiv => tabDiv.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick="showTab('${tab}')"]`).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'joueurs') {
    //importPlayersCSV();
  }
  if (tab === 'tables') {
    renderTablesPlan();
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
    // 1. Filtrer uniquement les joueurs éliminés et classés
    const rankedPlayers = classementData.filter(p => p.rank !== null && p.rank !== '');
    
    // 2. Trier par rang final (du plus petit au plus grand, ex: 1er, 2e, 3e...)
    rankedPlayers.sort((a, b) => parseInt(a.rank) - parseInt(b.rank));
    
    let htmlContent = '';
    
    if (rankedPlayers.length === 0) {
        htmlContent = 'Aucune élimination enregistrée.';
    } else {
        // Affichage des joueurs (Rank. Nom)
        htmlContent = rankedPlayers.map(p => `
            <div>
                <span style="color:#ffb300; font-weight:bold;">${p.rank}.</span> 
                ${p.prenom} ${p.nom.charAt(0)}.
            </div>
        `).join('');
    }

    const container = document.getElementById('simple-ranking-container');
    if (container) {
        container.innerHTML = htmlContent;
    }
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
          if (a.mpla < b.mpla) return -1;
          if (a.mpla > b.mpla) return 1;
          return 0;
      }


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
          ? `<button class="out-btn" onclick="toggleOutClassement('${p.winamax}')">OUT</button>` 
          : ''; // Vide si le joueur est éliminé (OUT)

      // 2. Colonne Killer : Liste déroulante des joueurs encore IN
      let killerContent = p.killer || '';
      
      if (isElimine) {
          // Filtrer les joueurs encore IN (actif: true ET rank null)
          const joueursEnJeu = classementData.filter(j => j.actif && (j.rank === null || j.rank === ''));
          
          killerContent = `<select onchange="updateClassementCell('${p.winamax}', 'killer', this.value)">`;
          killerContent += `<option value="">-- Choisir Killer --</option>`;
          
          // Ajouter les joueurs en jeu à la liste
          joueursEnJeu.forEach(j => {
              const isSelected = j.winamax === p.killer ? 'selected' : '';
              killerContent += `<option value="${j.winamax}" ${isSelected}>${j.winamax}</option>`;
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
          <div class="toggle-switch ${toggleClass}" onclick="toggleActif('${p.winamax}')">
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
}

function toggleActif(winamax) {
    winamax = String(winamax); 
    const index = classementData.findIndex(p => p.winamax === winamax);
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

function toggleOutClassement(winamax) {
    winamax = String(winamax); 
    const index = classementData.findIndex(p => p.winamax === winamax);
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

        // 3. Le joueur RESTE actif: true 
        
        // 4. Retirer l'assignation de table/siège
        classementData[index].table = null;
        classementData[index].seat = null;
        
    } else {
        // ===================================
        // PASSE DE OUT à IN (Réintégration)
        // ===================================

        // 1. Vider les données d'élimination
        classementData[index].rank = null;
        classementData[index].heure = '';
        classementData[index].round = '';
        classementData[index].killer = ''; 
        
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
    const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);
    // On prend seulement les joueurs ACITFS/INSCRITS sans rang pour l'équilibrage
    const joueursActifs = classementData.filter(p => p.actif && (p.rank === null || p.rank === '')).map(p => ({ winamax: p.winamax }));
    classementData.forEach(p => {
        if (p.actif && (p.rank === null || p.rank === '')) {
            p.table = null;
            p.seat = null;
        }
    });
    playerAssignments = playerAssignments.filter(assignment => 
        joueursActifs.some(j => j.winamax === assignment.winamax)
    );
    const { assignments, changes } = equilibrerTables(joueursActifs, perTable, playerAssignments);
    
    playerAssignments = assignments; 
    assignments.forEach(a => {
        const p = classementData.find(j => j.winamax === a.winamax);
        if (p) {
            p.table = a.table;
            p.seat = a.seat;
        }
    });

    if (changes.length > 0) { showPopup(changes); }

    // 6. Mettre à jour l'affichage
    renderClassement();
    renderTablesPlan(); 
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
 * @param {Array} oldAssignments - Assignations précédentes [{winamax, table, seat}]
 * @returns {Object} { assignments: [...], changes: [...], tablesCassees: [...] }
 */
function equilibrerTables(joueurs, perTable, oldAssignments = []) {
  const totalPlayers = joueurs.length;
  const nbTables = Math.max(1, Math.ceil(totalPlayers / perTable));

  console.log("nbTables: " + nbTables);

  // Regrouper les anciens assignments par table
  let oldByTable = {};
  oldAssignments.forEach(a => {
    if (!oldByTable[a.table]) oldByTable[a.table] = [];
    oldByTable[a.table].push(a);
  });

  // 1. Si le nombre de tables diminue, on ferme la table la moins remplie
  let oldTables = Array.from(new Set(oldAssignments.map(a => a.table))).filter(t => !isNaN(Number(t)));
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
  console.log("oldTables:" + oldTables);
  console.log("tablesCassees:" + tablesCassees);
  console.log("joueursToReassign:" + joueursToReassign);

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

  console.log("tableNumbers:" + tableNumbers);

  // 3. Place les joueurs à leur table/siège d'origine si possible (hors tables cassées)
  let assignments = [];
  let usedWinamax = new Set();
  let usedSeatsByTable = {};
  tableNumbers.forEach(tableNum => usedSeatsByTable[tableNum] = new Set());

  tableNumbers.forEach(tableNum => {
    let oldTable = oldByTable[tableNum] || [];
    oldTable.forEach(a => {
      if (joueurs.find(j => j.winamax === a.winamax) && !usedSeatsByTable[tableNum].has(a.seat)) {
        assignments.push({
          winamax: a.winamax,
          table: tableNum,
          seat: a.seat || 1
        });
        usedWinamax.add(a.winamax);
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
      winamax: j.winamax,
      table: destTable,
      seat: s
    });
    console.log("assignments:" + assignments);
    usedWinamax.add(j.winamax);
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
    assignments = assignments.filter(a => a.winamax !== toMove.winamax);
    assignments.push({
      winamax: toMove.winamax,
      table: tMin, // CORRECTION: Utiliser tMin
      seat: newSeat
    });
    usedSeatsByTable[tMin].add(newSeat); 
    usedSeatsByTable[tMax].delete(toMove.seat);
    // Note : Il faudrait aussi supprimer le joueur déplacé de usedWinamax.
    // L'algorithme actuel repose sur la mise à jour des 'assignments', ce qui fonctionne.
    // On boucle jusqu'à équilibre
  }

  console.log("assignments(apres section 5):" + assignments);

  // 6. Pour les joueurs non encore assignés, on leur attribue le premier siège libre sur une table ouverte
  let unassignedJoueurs = joueurs.filter(j => !assignments.find(a => a.winamax === j.winamax));

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
      winamax: j.winamax,
      table: destTable,
      seat: s
    });
    usedSeatsByTable[destTable].add(s);
  });

  console.log("assignments(apres section 6):" + assignments);
  
  // 7. Changements d'assignation (pour la popup)
  let changes = [];
  assignments.forEach(a => {
    let old = oldAssignments.find(o => o.winamax === a.winamax);
    if (!old || old.table !== a.table || old.seat !== a.seat) {
      changes.push({
        winamax: a.winamax,
        from: old ? { table: old.table, seat: old.seat } : { table: '-', seat: '-' },
        to: { table: a.table, seat: a.seat }
      });
    }
  });

  return { assignments, changes, tablesCassees };
}

function syncSelectedPlayersIndexes() {
  selectedPlayersIndexes = [];
  const rows = Array.from(document.querySelectorAll('#players-table tbody tr'));
  rows.forEach((tr, idx) => {
    const winamax = tr.querySelectorAll('td')[4]?.textContent.trim();
    if (classementData.some(p => p.winamax === winamax)) {
      selectedPlayersIndexes.push(idx);
      // Coche la case dans le DOM pour l'affichage immédiat
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = true;
    }
  });
}

function assignSeats() {
  // Prend uniquement les joueurs actif
  const joueurs = classementData.filter(p => p.actif).map(p => ({ winamax: p.winamax }));
  if (joueurs.length === 0) {
    alert("Aucun joueur inscrit !");
    return;
  }

  // Nombre de joueurs max par table
  const perTable = Math.max(2, parseInt(document.getElementById('players-per-table').value) || 8);
  console.log("perTable: " + perTable);

  // Construit oldAssignments à partir de classementData pour les joueurs payés
  const oldAssignments = joueurs.map(j => {
    const p = classementData.find(p => p.winamax === j.winamax);
    return (p && p.table && p.seat && !isNaN(parseInt(p.table)) && !isNaN(parseInt(p.seat)))
      ? { winamax: p.winamax, table: parseInt(p.table), seat: parseInt(p.seat) }
      : { winamax: j.winamax };
  });

  // Appel à la fonction d'équilibrage stricte
  const { assignments, changes, tablesCassees } = equilibrerTables(joueurs, perTable, oldAssignments);

  // Mets à jour classementData pour TOUS les joueurs payés
  assignments.forEach(a => {
    let p = classementData.find(p => p.winamax === a.winamax);
    if (p) {
      p.table = a.table;
      p.seat = a.seat;
    } else {
      classementData.push({
        winamax: a.winamax,
        round: '', heure: '', killer: '', out: false, rank: '', table: a.table, seat: a.seat, actif: true
      });
    }
  });

  // Mets à jour playerAssignments
  playerAssignments = assignments.map(a => ({
    winamax: a.winamax,
    table: a.table,
    seat: a.seat
  }));

  renderClassement();
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
        const playerName = c.winamax;
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
    .filter(p => !p.out && p.table && p.seat)
    .map(p => ({
      table: parseInt(p.table),
      seat: parseInt(p.seat),
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

// Fonction pour restaurer la sélection et l'assignation depuis le JSON
function restorePlayersFromJSON(joueurs) {
  // On reconstruit selectedPlayersIndexes et playerAssignments
  selectedPlayersIndexes = [];
  playerAssignments = [];
  joueurs.forEach((p, idx) => {
    if (p.checked) selectedPlayersIndexes.push(idx);
    if (p.table && p.seat) {
      playerAssignments.push({
        index: idx,
        table: parseInt(p.table),
        seat: parseInt(p.seat)
      });
    }
  });
  // Recharge le tableau des joueurs et le plan des tables
  importPlayersCSV();
  if (typeof renderTablesPlan === 'function') renderTablesPlan();
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
    importPlayersCSV();
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
        joueurAEliminerWinamax: joueurAEliminerWinamax,
        selectedPlayersIndexes: selectedPlayersIndexes,
        // ... ajoutez d'autres variables globales importantes si nécessaire
    };
    const jsonString = JSON.stringify(appData);
    
    // Sauvegarde dans le stockage local du navigateur
    localStorage.setItem('pokerAppData', jsonString);

    // Note: Si vous souhaitez TOUJOURS conserver l'export fichier pour un backup manuel,
    // ajoutez ici le code de téléchargement de fichier que vous aviez. Sinon, il n'est plus nécessaire.
    console.log("Données sauvegardées automatiquement dans localStorage.");
}

function restoreAppFromLocalStorage() {
    const jsonString = localStorage.getItem('pokerAppData');

    if (jsonString) {
        console.log("Restauration des données depuis localStorage...");
        // importAppFromJSON prend la chaîne JSON et met à jour l'état de l'application
        importAppFromJSON(jsonString); 
    } else {
        console.log("Aucune donnée trouvée dans localStorage. Initialisation standard.");
        // Si aucune sauvegarde n'existe, on charge les joueurs depuis le CSV
        importPlayersCSV(); 
        // Et on affiche le classement initial
        renderClassement();
        renderTablesPlan();
        updateDateTime(); // Initialise l'horloge
    }
}

function importAppFromJSON(json) {
  try {
    // NOUVELLE LIGNE : Affiche le type et la longueur pour un diagnostic clair
    console.log("load JSON: Type =", typeof json, "| Longueur =", json ? json.length : 0);
    
    // Si 'json' est undefined ou vide, nous arrêtons l'exécution ici
    if (!json) {
      alert("Le fichier est vide ou n'a pas pu être lu.");
      return;
    }

    const appState = typeof json === 'string' ? JSON.parse(json) : json;
    if (appState.structure) levels = appState.structure;
    if (appState.horloge) {
      stopTimer();
      currentLevel = appState.horloge.currentLevel ?? 0;
      timeLeft = appState.horloge.timeLeft ?? 0;
      baseFontSize = appState.horloge.baseFontSize ?? 2;
      running = !!appState.horloge.running;
      applyFontSizes();
    }
    playerAssignments = (appState.playerAssignments || []).map(a => ({ ...a }));
    if (appState.structureTitle) {
      const titleElem = document.getElementById('structure-title');
      if (titleElem) titleElem.textContent = appState.structureTitle;
    }
    console.log("appState.classement:" + appState.classementData);
    console.log("classementData:" + classementData);
    if (appState.classementData) {
      classementData = appState.classementData.map(p => ({ ...p }));
    }
    console.log("appState.classement:" + appState.classementData);
    console.log("classementData:" + classementData);

    importPlayersCSV();
    setTimeout(() => {
//      syncSelectedPlayersIndexes();
      renderClassement();
      renderTablesPlan();
      updateDisplay();
      if (running) startTimer();
    }, 0);
  } catch (e) {
    alert("Erreur lors de l'import du fichier JSON.");
  }
}

function updateClassementCell(winamax, field, value) {
  const index = classementData.findIndex(p => p.winamax === winamax);
  if (index !== -1) {
    classementData[index][field] = value;
    exportAppToJSON();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  
  // =========================================================
  // 1. CHARGEMENT AUTOMATIQUE DE L'ÉTAT (RESTAURATION)
  // =========================================================
  // Tente de charger l'état depuis localStorage
  restoreAppFromLocalStorage();
  // Si le classement est vide après le chargement, c'est la première exécution.
  if (classementData.length === 0) {
    console.log("Classement VIDE: importPlayersCSV");
    // Appelle la fonction qui charge les joueurs par défaut (via CSV)
    importPlayersCSV(); 
  }
    
  // Afficher l'état chargé ou initialisé
/*
  console.log("==========3============");
  console.log(localStorage.getItem('pokerAppData'));
  console.log("=======================");
*/
  renderClassement(); 
/*
  console.log("==========4============");
  console.log(localStorage.getItem('pokerAppData'));
  console.log("=======================");
*/
  renderTablesPlan();
  console.log("==========5============");
  console.log(localStorage.getItem('pokerAppData'));
  console.log("=======================");
});
