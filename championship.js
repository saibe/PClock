let ROOMNAME='ASL Poker 72'
let SEASON=14; // Saison
let QUARTER=2; // Trimestre
let NBQUALIF=0; // nombre de qualifé
let ROOMPLAYERS = [];
let POINTSLADDER = [];
let INITIALSTRUCTURE = [];
let CHAMPIONSHIP_RANKING=[];


// Structure pour un niveau de blindes ou une pause
const StructureItem = {
    round: 0,       // int
    small_blind: 0, // int
    big_blind: 0,   // int
    duration: 0,    // time (en minutes ou secondes)
    isBreak: false  // bool
};

const assignment = {
    table: 0,       // int
    seat: 0,        // int
};

// Structure pour un joueur dans un tournoi spécifique
const TournamentPlayer = {
    active: true,             // bool
    player: PlayerIdentity,
    rank: null,               // int (null si toujours en jeu)
    assignment : assignment, 
    score: 0,                 // int (points gagnés dans ce tournoi si vous utilisez cette clé)
    round: StructureItem,     // round de sorti du joueur
    killer: PlayerIdentity,   // le killer du joueur (PlayerIdentity)
};

// Structure pour un événement (tournoi)
const Tournament = {
    uuid: 0,
    date: new Date(),           // La date de l'événement
    title: "",                  // Titre du tournoi
    structure: [StructureItem], // Liste des niveaux de blindes pour ce tournoi
    ptsladder: [],              // Liste des points attribués (par rang)
    round: 1,                   // Le niveau de blindes actuel
    clock: 0,                   // Le temps restant sur le niveau actuel
    players: [TournamentPlayer] // La liste des joueurs de ce tournoi
};

// Structure pour le classement général (leaderboard)
const ChampionshipPlayer = {
    player: PlayerIdentity,
    rank: 0,                // int (rang actuel au classement général)
    score: 0,               // int (score total au classement général)
    played: 0,              // int (nombre de tournois joués)
    scores: []              // list of int (liste des scores de chaque tournoi)
};

// Définition de la structure de base pour l'identité d'un joueur
const PlayerIdentity = {
    firstname: "", // string (prénom légal ou d'usage)
    mpla: "",      // string (pseudo MPLA unique, utilisé comme clé)
    winamax: "",   // string (pseudo sur la plateforme de jeu)
};

const Championship = {
    uuid        : 0,
    season      : SEASON   || 14,
    quarter     : QUARTER  || 2,
    ptsladder   : CHAMPIONSHIP_PTS_LADDER,
    structure   : CHAMPIONSHIP_STRUCTURE,
    tournaments : [Tournament],
    players     : [ChampionshipPlayer],
};

const RoomData = {
    roomname    : ROOMNAME || "ASL Poker 72",
    championships:[Championship], // championships
    Tournaments:  [Tournament]    // single tournaments
};

function loadCSV_champ(csvText) {
    let cleanedCsvText = csvText.replace(/\"([^\"]*)\n([^\"]*)\"/g, '$1 $2');
    const lines = cleanedCsvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return []; // Moins de 2 lignes = pas de données

    NBQUALIF = lines[2].split(",")[19];
    nbrounds = Math.max(...lines[4].split(",").filter(el => !isNaN(el.trim())).map(Number));
    console.log("####### nbround:"+nbrounds);
    for (let i = 5; i < lines.length; i++) {
        const [prenom, mpla, winamax, rank, score, played, ...rounds] = lines[i].split(',');
        if(mpla) {
            CHAMPIONSHIP_RANKING.push({
                firstname   : prenom.trim(),
                mpla        : mpla.trim(),
                winamax     : winamax.trim(),
                rank        : parseInt(rank),
                score       : parseInt(score),
                played      : parseInt(played),
                rounds      : rounds.slice(0, nbrounds).map(r => r.trim())
            });
        }
    }

    return CHAMPIONSHIP_RANKING;
}

async function loadChampionnatDataFromURL(urlInput='') {
    console.log("UrlChampionnat(raw):"+urlInput);
    const statusMessage = document.getElementById('championnat-status-message');
    const url = urlInput+"?output=csv";

    console.log("UrlChampionnat:"+url);
    if (!url) {
        statusMessage.textContent = 'Veuillez entrer une URL valide';
        return;
    }
    statusMessage.textContent = 'Chargement des données CSV en cours...';

    try {
        // Récupération du texte brut CSV
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erreur de chargement de l\'URL CSV.');
        
        const csvText = await response.text();
        
        // Analyse du texte CSV
        championshipData = loadCSV_champ(csvText); 
        
        if (championshipData.length === 0) {
            throw new Error('Aucune donnée de classement trouvée dans le fichier CSV.');
        }

        // Sauvegarde réussie
        exportAppToJSON();
        statusMessage.textContent = `Championnat chargé avec succès (${championshipData.length} lignes).`;
        renderChampionnatRanking();

    } catch (e) {
        statusMessage.textContent = `Erreur de chargement: ${e.message}.`;
        console.error("Erreur de chargement du Championnat:", e);
    }
}

function renderChampionnatRanking() {
    const container = document.getElementById('championnat-ranking-container');
    const statusMessage = document.getElementById('championnat-status-message');
    
    if (!container) return;

    if (!championshipData || championshipData.length === 0) {
        container.innerHTML = '<p>Aucun classement de championnat à afficher.</p>';
        statusMessage.textContent = 'Aucune donnée de championnat chargée.';
        return;
    }
    
    // Ceci est crucial pour que la mise en évidence du top 33% s'applique correctement
    championshipData.sort((a, b) => {
        // Convertir la chaîne de caractères 'rank' en nombre pour un tri numérique
        const pointA = parseInt(a.score, 10);
        const pointB = parseInt(b.score, 10);
        
        // Gérer les cas où le rang n'est pas un nombre (pour les mettre à la fin, par exemple)
        if (isNaN(pointA)) return 1;
        if (isNaN(pointB)) return -1;

        joueurA = classementData.find(item => item.mpla === a.mpla);
        addPtsA = joueurA ? (joueurA.pts || 0) : 0;
        joueurB = classementData.find(item => item.mpla === b.mpla);
        addPtsB = joueurB ? (joueurB.pts || 0) : 0;

        return (pointB+addPtsB) - (pointA+addPtsA);
    });
    
    // reecrit le rank de joueurs prit dans l'ordre
    let newrank = 1;
    championshipData.forEach(p => {
      p.rank = newrank;
      newrank = newrank +1;
    });
    
    // CALCUL DU SEUIL DES 33%
    const totalPlayers = championshipData.length;
    // Math.ceil assure que même si 33% donne un nombre décimal, on inclut le joueur correspondant (arrondi au supérieur)
    const topCount = NBQUALIF; 
    

    // DÉFINITION DE L'ORDRE ET DES LABELS AFFICHÉS
    const columnsToDisplay = [
        { key: 'rank', label: 'Rang' },
        { key: 'mpla', label: 'Pseudo MPLA' },
        { key: 'score', label: 'Points' },
        { key: 'pts', label: '' }
    ];

    statusMessage.textContent = `Affichage du classement (${championshipData.length} joueurs). Les ${topCount} premiers sont mis en évidence.`;
    statusMessage.style.display = 'none';

    // Rendu du tableau
    let html = '<table class="simple-ranking-table">';
    
    // Ligne d'en-têtes
    html += '<thead><tr>';
    columnsToDisplay.forEach(col => {
        html += `<th>${col.label}</th>`; 
    });
    html += '</tr></thead><tbody>';
    
    // Lignes de données
    championshipData.forEach(p => {
        // Le rang est maintenant lu après le tri, garantissant la bonne position
        const rank = parseInt(p.rank); 
        
        // Ajout de la classe si le joueur fait partie du top 33%
        let rowClass = '';
        if (rank > 0 && rank <= topCount) {
          rowClass = (rank % 2 == 0) ? 'top-33-percent-even': 'top-33-percent';
        }
        joueur = classementData.find(item => item.mpla === p.mpla);
        addPts = joueur ? parseInt(joueur.pts) || 0 : 0;
        isRank = joueur ? joueur.rank || 0 : 0;
        if (addPts>0){
          rowClass += (isRank > 0) ? " ranking-virtual-out" : " ranking-virtual-in";
        }

        html += `<tr class="${rowClass}">`;
        columnsToDisplay.forEach(col => {
          if(col.key === "pts") {
            field=(isRank > 0) ? '' : '+'+addPts;
            // propose to disable the 'addPts' coloumn
            field='';
            html += `<td>${field}</td>`; 
          } else if(col.key === "mpla") {
            html += `<td style="text-align:center">${p[col.key] || ''}</td>`; 
          } else if(col.key === "score") {
            score=parseInt(p[col.key])+parseInt(addPts);
            field=parseInt(score);
            html += `<td>${field}</td>`; 
          } else {
            html += `<td>${p[col.key] || ''}</td>`; 
          }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}