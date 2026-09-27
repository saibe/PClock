let NBQUALIF=0; // nombre de qualifé
let POINTSLADDER = [];
let INITIALSTRUCTURE = [];
let CHAMPIONSHIP_RANKING=[];

const PlayerIdentity = {
  firstname: '',
  mpla: '',
  winamax: ''
};

const StructureItem = {
  round: 0,
  small_blind: 0,
  big_blind: 0,
  duration: 0,
  isBreak: false
};

const TournamentAssignment = {
  table: 0,
  seat: 0
};

const TournamentPlayer = {
  active: true,
  player: PlayerIdentity,
  rank: null,
  assignment: TournamentAssignment,
  score: 0,
  round: StructureItem,
  killer: null
};

const Tournament = {
  uuid: null,
  date: null,
  status: 'ready',
  title: '',
  structure: [],
  ptsladder: [],
  round: 1,
  clock: 0,
  players: []
};

const ChampionshipPlayer = {
  player: PlayerIdentity,
  rank: 0,
  score: 0,
  played: 0,
  scores: []
};

const Championship = {
  uuid: null,
  season: 14,
  quarter: 2,
  ptsladder: POINTSLADDER,
  structure: INITIALSTRUCTURE,
  tournaments: [],
  players: []
};

const RoomData = {
  roomname: '',
  members: [],
  championships: [],
  Tournaments: []
};

const ROOMS_STORAGE_KEY = 'poker_championship_rooms';
  let selectedRoomData = null;
  let selectedChampionshipData = null;
  let pendingPlayerImport = null;

  document.addEventListener('DOMContentLoaded', initializeChampionshipPage);

  function initializeChampionshipPage() {
    const params = new URLSearchParams(window.location.search);
    const championshipUuid = params.get('uuid');
    const lastRoomName = localStorage.getItem('last_selected_room');
    let rooms;

    try {
      rooms = JSON.parse(localStorage.getItem(ROOMS_STORAGE_KEY) || '[]');
    } catch (error) {
      rooms = [];
    }

    selectedRoomData = rooms.find(room => (room.championships || []).some(
      championship => String(championship.uuid) === championshipUuid
    )) || rooms.find(room => room.roomname === lastRoomName);
    selectedChampionshipData = selectedRoomData?.championships?.find(
      championship => String(championship.uuid) === championshipUuid
    ) || null;
    if (selectedRoomData && !Array.isArray(selectedRoomData.members)) selectedRoomData.members = [];

    document.getElementById('roomNameDisplay').textContent = selectedRoomData?.roomname || '-';
    if (selectedChampionshipData) {
      const title = `Championnat S${selectedChampionshipData.season}T${selectedChampionshipData.quarter}`;
      document.getElementById('championshipTitle').textContent = title;
    } else {
      document.getElementById('championshipTitle').textContent = 'Championnat introuvable';
    }
    renderChampionshipPlayers();

    const dialog = document.getElementById('player-import-dialog');
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closePlayerImportDialog();
    });
    const addDialog = document.getElementById('add-player-dialog');
    addDialog.addEventListener('click', event => {
      if (event.target === addDialog) closeAddPlayerDialog();
    });
    const tournamentDialog = document.getElementById('new-tournament-dialog');
    tournamentDialog.addEventListener('click', event => {
      if (event.target === tournamentDialog) closeNewTournamentDialog();
    });
  }

  function openPlayerImportDialog() {
    const dialog = document.getElementById('player-import-dialog');
    document.getElementById('player-import-status').textContent = selectedRoomData
      ? ''
      : 'Impossible de trouver la room. Revenez à la liste des rooms et sélectionnez une room.';
    showPlayerImportSource('file');
    if (!dialog.open) dialog.showModal();
  }

  function closePlayerImportDialog() {
    const dialog = document.getElementById('player-import-dialog');
    if (dialog.open) dialog.close();
  }

  function showPlayerImportSource(source) {
    const useFile = source === 'file';
    document.getElementById('player-column-mapping').hidden = true;
    pendingPlayerImport = null;
    document.getElementById('import-file-panel').hidden = !useFile;
    document.getElementById('import-url-panel').hidden = useFile;
    document.getElementById('import-file-tab').classList.toggle('active', useFile);
    document.getElementById('import-url-tab').classList.toggle('active', !useFile);
    document.getElementById('import-file-tab').setAttribute('aria-selected', String(useFile));
    document.getElementById('import-url-tab').setAttribute('aria-selected', String(!useFile));
    document.getElementById(useFile ? 'player-import-file' : 'player-import-url').focus();
  }

  async function loadPlayersFromFile() {
    const file = document.getElementById('player-import-file').files[0];
    if (!file) {
      setPlayerImportStatus('Choisissez un fichier CSV ou TSV.');
      return;
    }

    try {
      preparePlayerColumnMapping(parsePlayerRows(await file.text()));
    } catch (error) {
      setPlayerImportStatus(`Import impossible : ${error.message}`);
    }
  }

  async function loadPlayersFromUrl() {
    const input = document.getElementById('player-import-url').value.trim();
    if (!input) {
      setPlayerImportStatus('Saisissez le lien du fichier ou de la Google Sheet.');
      return;
    }

    try {
      const response = await fetch(normalizePlayerImportUrl(input));
      if (!response.ok) throw new Error(`réponse HTTP ${response.status}`);
      preparePlayerColumnMapping(parsePlayerRows(await response.text()));
    } catch (error) {
      setPlayerImportStatus(`Import impossible : ${error.message}. Vérifiez que le lien est accessible et publié en CSV.`);
    }
  }

  function normalizePlayerImportUrl(value) {
    const url = new URL(value);
    if (url.hostname === 'docs.google.com' && url.pathname.includes('/spreadsheets/d/')) {
      const sheetId = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
      if (!sheetId) throw new Error('lien Google Sheets invalide');
      const hashParams = new URLSearchParams(url.hash.slice(1));
      const gid = url.searchParams.get('gid') || hashParams.get('gid');
      const csvUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
      csvUrl.searchParams.set('format', 'csv');
      if (gid) csvUrl.searchParams.set('gid', gid);
      return csvUrl.toString();
    }
    if (url.pathname.endsWith('/pub')) url.searchParams.set('output', 'csv');
    return url.toString();
  }

  function parsePlayerRows(text) {
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) throw new Error('le fichier ne contient aucune ligne');

    const delimiter = [';', ',', '\t'].sort((a, b) =>
      countCSVDelimiter(lines[0], b) - countCSVDelimiter(lines[0], a)
    )[0];
    const rows = lines.map(line => parseCSVRow(line, delimiter));
    const columnCount = Math.max(...rows.map(row => row.length));
    if (columnCount < 1 || rows.length < 2) throw new Error('le fichier doit contenir des colonnes et au moins une ligne de données');
    return { rows, columns: Array.from({ length: columnCount }, (_, index) => rows[0][index] || '') };
  }

  function preparePlayerColumnMapping(importData) {
    pendingPlayerImport = importData;
    const mappings = [
      { id: 'player-firstname-column', candidates: ['prenom', 'firstname', 'first name'] },
      { id: 'player-mpla-column', candidates: ['mpla', 'pseudo', 'pseudo mpla', 'identifiant'] },
      { id: 'player-winamax-column', candidates: ['winamax', 'pseudo winamax'] }
    ];

    mappings.forEach(({ id, candidates }, fieldIndex) => {
      const select = document.getElementById(id);
      select.replaceChildren();
      importData.columns.forEach((column, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `Colonne ${index + 1}${column ? ` : ${column}` : ''}`;
        select.appendChild(option);
      });
      const headerIndex = importData.columns.findIndex(column => candidates.includes(normalizePlayerHeader(column)));
      select.value = String(headerIndex >= 0 ? headerIndex : Math.min(fieldIndex, importData.columns.length - 1));
    });

    const headerLabels = importData.columns.map(normalizePlayerHeader);
    const hasHeader = headerLabels.some(label => ['prenom', 'firstname', 'mpla', 'pseudo', 'winamax'].includes(label));
    document.getElementById('player-import-has-header').checked = hasHeader;
    document.getElementById('import-file-panel').hidden = true;
    document.getElementById('import-url-panel').hidden = true;
    document.getElementById('player-column-mapping').hidden = false;
    setPlayerImportStatus(`${importData.rows.length} lignes chargées. Vérifiez les colonnes avant l’import.`);
    document.getElementById('player-firstname-column').focus();
  }

  function importMappedChampionshipPlayers() {
    if (!pendingPlayerImport) {
      setPlayerImportStatus('Chargez d’abord un fichier ou un lien.');
      return;
    }

    const columnIndexes = [
      document.getElementById('player-firstname-column').value,
      document.getElementById('player-mpla-column').value,
      document.getElementById('player-winamax-column').value
    ].map(Number);
    if (columnIndexes.some(index => !Number.isInteger(index) || index < 0) || new Set(columnIndexes).size !== 3) {
      setPlayerImportStatus('Choisissez une colonne différente pour le prénom, le MPLA et Winamax.');
      return;
    }

    const hasHeader = document.getElementById('player-import-has-header').checked;
    const players = pendingPlayerImport.rows.slice(hasHeader ? 1 : 0).map(row => ({
      ...PlayerIdentity,
      firstname: (row[columnIndexes[0]] || '').trim(),
      mpla: (row[columnIndexes[1]] || '').trim(),
      winamax: (row[columnIndexes[2]] || '').trim()
    })).filter(player => player.mpla);

    if (!players.length) {
      setPlayerImportStatus('Aucun joueur avec un MPLA n’a été trouvé dans les lignes sélectionnées.');
      return;
    }
    saveImportedPlayers(players);
    pendingPlayerImport = null;
    document.getElementById('player-column-mapping').hidden = true;
  }

  function countCSVDelimiter(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      if (line[index] === '"') {
        if (quoted && line[index + 1] === '"') index++;
        else quoted = !quoted;
      } else if (!quoted && line[index] === delimiter) count++;
    }
    return count;
  }

  function parseCSVRow(line, delimiter) {
    const values = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        values.push(value.trim());
        value = '';
      } else {
        value += character;
      }
    }
    values.push(value.trim());
    return values;
  }

  function normalizePlayerHeader(value) {
    return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function findHeaderIndex(headers, candidates) {
    return headers.findIndex(header => candidates.includes(header));
  }

  function saveImportedPlayers(players, statusElementId = 'player-import-status') {
    if (!selectedRoomData || !selectedChampionshipData) {
      throw new Error('le championnat courant est introuvable');
    }

    selectedChampionshipData.players = selectedChampionshipData.players || [];
    const existing = new Set(selectedChampionshipData.players.map(entry =>
      String(getChampionshipPlayerIdentity(entry).mpla || '').toLowerCase()
    ));
    let added = 0;
    let skipped = 0;
    players.forEach(player => {
      const key = String(player.mpla || '').trim().toLowerCase();
      if (existing.has(key)) {
        skipped++;
        return;
      }
      if (!key) {
        skipped++;
        return;
      }
      existing.add(key);
      selectedChampionshipData.players.push({
        player: { ...PlayerIdentity, ...player },
        rank: 0,
        score: 0,
        played: 0,
        scores: []
      });
      added++;
    });

    persistSelectedRoom();
    renderChampionshipPlayers();
    const status = `${added} joueur${added === 1 ? '' : 's'} ajouté${added === 1 ? '' : 's'}${skipped ? `, ${skipped} doublon${skipped === 1 ? '' : 's'} ou ligne invalide ignoré${skipped === 1 ? '' : 's'}` : ''}.`;
    if (statusElementId === 'player-import-status') setPlayerImportStatus(status);
    else document.getElementById(statusElementId).textContent = status;
    return { added, skipped };
  }

  function setPlayerImportStatus(message) {
    document.getElementById('player-import-status').textContent = message;
  }

  function openAddPlayerDialog() {
    if (!selectedChampionshipData) {
      setChampionshipPlayersStatus('Le championnat courant est introuvable.');
      return;
    }
    document.getElementById('add-player-status').textContent = '';
    document.getElementById('add-player-form').reset();
    document.getElementById('add-player-dialog').showModal();
    document.getElementById('new-player-firstname').focus();
  }

  function closeAddPlayerDialog() {
    const dialog = document.getElementById('add-player-dialog');
    if (dialog.open) dialog.close();
  }

  function addPlayerIdentity(event) {
    event.preventDefault();
    const firstnameInput = document.getElementById('new-player-firstname');
    const mplaInput = document.getElementById('new-player-mpla');
    const winamaxInput = document.getElementById('new-player-winamax');
    const firstname = firstnameInput.value.trim();
    const mpla = mplaInput.value.trim();
    const winamax = winamaxInput.value.trim();

    if (!firstname || !mpla) {
      document.getElementById('add-player-status').textContent = 'Le prénom et le pseudo MPLA sont obligatoires.';
      (!firstname ? firstnameInput : mplaInput).focus();
      return;
    }

    const result = saveImportedPlayers([{ firstname, mpla, winamax }], 'add-player-status');
    if (result.added > 0) {
      closeAddPlayerDialog();
      setChampionshipPlayersStatus(`${firstname} a été ajouté au classement.`);
      const playerRow = Array.from(document.querySelectorAll('#championshipPlayersList tr'))
        .find(row => row.children[2]?.textContent === mpla);
      playerRow?.scrollIntoView({ block: 'nearest' });
    }
  }

  function getChampionshipPlayerIdentity(entry) {
    return entry?.player || entry || {};
  }

  function createNewTournament() {
    if (!selectedRoomData || !selectedChampionshipData) {
      setChampionshipPlayersStatus('Le championnat courant est introuvable.');
      return;
    }

    const tournaments = selectedChampionshipData.tournaments || [];
    const date = formatDayMonth(new Date());
    const title = `${selectedRoomData.roomname} - ${selectedChampionshipData.season}T${selectedChampionshipData.quarter} manche #${tournaments.length + 1}`;
    document.getElementById('new-tournament-date').value = date;
    document.getElementById('new-tournament-title-input').value = title;
    document.getElementById('new-tournament-structure').value = JSON.stringify(selectedChampionshipData.structure || [], null, 2);
    document.getElementById('new-tournament-ptsladder').value = JSON.stringify(selectedChampionshipData.ptsladder || [], null, 2);
    document.getElementById('new-tournament-status').textContent = '';
    document.getElementById('new-tournament-form').reset();
    document.getElementById('new-tournament-date').value = date;
    document.getElementById('new-tournament-title-input').value = title;
    document.getElementById('new-tournament-structure').value = JSON.stringify(selectedChampionshipData.structure || [], null, 2);
    document.getElementById('new-tournament-ptsladder').value = JSON.stringify(selectedChampionshipData.ptsladder || [], null, 2);
    document.getElementById('new-tournament-dialog').showModal();
    document.getElementById('new-tournament-date').focus();
  }

  function closeNewTournamentDialog() {
    const dialog = document.getElementById('new-tournament-dialog');
    if (dialog.open) dialog.close();
  }

  function createChampionshipTournament(event) {
    event.preventDefault();
    if (!selectedRoomData || !selectedChampionshipData) {
      setNewTournamentStatus('Le championnat courant est introuvable.');
      return;
    }

    const date = document.getElementById('new-tournament-date').value.trim();
    const title = document.getElementById('new-tournament-title-input').value.trim();
    let structure;
    let ptsladder;
    try {
      structure = JSON.parse(document.getElementById('new-tournament-structure').value);
      ptsladder = JSON.parse(document.getElementById('new-tournament-ptsladder').value);
    } catch (error) {
      setNewTournamentStatus('La structure et le barème doivent être des tableaux JSON valides.');
      return;
    }

    if (!Array.isArray(structure) || !Array.isArray(ptsladder)) {
      setNewTournamentStatus('La structure et le barème doivent chacun être un tableau JSON.');
      return;
    }
    if (!structure.length) {
      setNewTournamentStatus('Ajoutez au moins un niveau à la structure avant de créer ce tournoi.');
      return;
    }
    if (!isValidDayMonth(date)) {
      setNewTournamentStatus('Saisissez une date valide au format JJ/MM.');
      return;
    }
    if (!title) {
      setNewTournamentStatus('Le titre du tournoi est obligatoire.');
      return;
    }

    const tournamentPlayers = (selectedChampionshipData.players || []).map(entry => ({
      active: true,
      player: { ...PlayerIdentity, ...getChampionshipPlayerIdentity(entry) },
      rank: null,
      assignment: { table: 0, seat: 0 },
      score: 0,
      round: null,
      killer: null
    }));
    const tournament = {
      uuid: createTournamentUuid(),
      date,
      status: 'ready',
      title,
      structure,
      ptsladder,
      round: 1,
      clock: structure[0]?.duration || 0,
      players: tournamentPlayers
    };

    selectedChampionshipData.tournaments = selectedChampionshipData.tournaments || [];
    selectedChampionshipData.tournaments.push(tournament);
    persistSelectedRoom();
    renderChampionshipPlayers();
    closeNewTournamentDialog();
    setChampionshipPlayersStatus(`Tournoi « ${title} » créé. Cliquez sur sa date pour l’ouvrir.`);
  }

  function setNewTournamentStatus(message) {
    document.getElementById('new-tournament-status').textContent = message;
  }

  function createTournamentUuid() {
    return globalThis.crypto?.randomUUID?.() || `tournament-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDayMonth(date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function isValidDayMonth(value) {
    const match = String(value).match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const day = Number(match[1]);
    const month = Number(match[2]);
    return month >= 1 && month <= 12 && day >= 1 && day <= new Date(2024, month, 0).getDate();
  }

  function openTournament(tournamentUuid) {
    if (!selectedChampionshipData || !selectedRoomData) return;
    localStorage.setItem('last_selected_room', selectedRoomData.roomname);
    const params = new URLSearchParams({
      championship: String(selectedChampionshipData.uuid),
      tournament: String(tournamentUuid)
    });
    window.location.href = `../index.html?${params.toString()}`;
  }

  function importAllRoomMembersIntoChampionship() {
    if (!selectedRoomData || !selectedChampionshipData) {
      setChampionshipPlayersStatus('Le championnat courant est introuvable.');
      return;
    }

    const members = selectedRoomData.members || [];
    if (!members.length) {
      setChampionshipPlayersStatus('Cette room ne contient aucun membre à importer.');
      return;
    }

    selectedChampionshipData.players = selectedChampionshipData.players || [];
    const existing = new Set(selectedChampionshipData.players.map(entry =>
      String(getChampionshipPlayerIdentity(entry).mpla || '').toLowerCase()
    ));
    let added = 0;
    let skipped = 0;

    members.forEach(member => {
      const key = String(member.mpla || '').trim().toLowerCase();
      if (!key || existing.has(key)) {
        skipped++;
        return;
      }
      existing.add(key);
      selectedChampionshipData.players.push({
        player: { ...PlayerIdentity, ...member },
        rank: 0,
        score: 0,
        played: 0,
        scores: []
      });
      added++;
    });

    persistSelectedRoom();
    renderChampionshipPlayers();
    setChampionshipPlayersStatus(`${added} joueur${added === 1 ? '' : 's'} importé${added === 1 ? '' : 's'}${skipped ? `, ${skipped} déjà présent${skipped === 1 ? '' : 's'} ou sans MPLA ignoré${skipped === 1 ? '' : 's'}` : ''}.`);
  }

  function removeChampionshipPlayer(mpla) {
    if (!selectedChampionshipData || !window.confirm(`Retirer « ${mpla} » de ce championnat ?`)) return;
    selectedChampionshipData.players = (selectedChampionshipData.players || []).filter(entry =>
      String(getChampionshipPlayerIdentity(entry).mpla || '') !== mpla
    );
    persistSelectedRoom();
    renderChampionshipPlayers();
    setChampionshipPlayersStatus(`${mpla} a été retiré du championnat. Il reste membre de la room.`);
  }

  function persistSelectedRoom() {
    if (!selectedRoomData) return;
    const rooms = JSON.parse(localStorage.getItem(ROOMS_STORAGE_KEY) || '[]');
    const roomIndex = rooms.findIndex(room => room.roomname === selectedRoomData.roomname);
    if (roomIndex === -1) throw new Error('la room n’existe plus dans le stockage local');
    rooms[roomIndex] = selectedRoomData;
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
  }

  function renderChampionshipPlayers() {
    const list = document.getElementById('championshipPlayersList');
    if (!list) return;
    const head = document.getElementById('championshipPlayersHead');
    const tournaments = selectedChampionshipData?.tournaments || [];
    const headerRow = document.createElement('tr');
    ['Rank', 'Firstname', 'MPLA', 'Wina', 'Score', 'Played'].forEach(label => {
      const cell = document.createElement('th');
      cell.textContent = label;
      headerRow.appendChild(cell);
    });
    tournaments.forEach((tournament, index) => {
      const cell = document.createElement('th');
      const dateButton = document.createElement('button');
      dateButton.type = 'button';
      dateButton.className = 'tournament-date-link';
      dateButton.textContent = formatChampionshipTournamentDate(tournament.date, index);
      dateButton.title = `Ouvrir ${tournament.title || dateButton.textContent}`;
      dateButton.addEventListener('click', () => openTournament(tournament.uuid));
      cell.appendChild(dateButton);
      headerRow.appendChild(cell);
    });
    const actionHeader = document.createElement('th');
    actionHeader.textContent = 'Action';
    actionHeader.title = 'removePlayer';
    headerRow.appendChild(actionHeader);
    head.replaceChildren(headerRow);

    const players = (selectedChampionshipData?.players || []).map(entry => {
      const player = getChampionshipPlayerIdentity(entry);
      const score = Number(entry.score);
      const played = Number(entry.played);
      return {
        entry,
        player,
        mpla: String(player.mpla || ''),
        winamax: String(player.winamax || ''),
        score: Number.isFinite(score) ? score : 0,
        played: Number.isFinite(played) ? played : (Array.isArray(entry.scores) ? entry.scores.length : 0)
      };
    }).sort((first, second) => {
      return second.score - first.score || first.mpla.localeCompare(second.mpla, 'fr');
    });
    list.replaceChildren();
    document.getElementById('championshipPlayerCount').textContent = players.length;

    if (!players.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7 + tournaments.length;
      cell.textContent = 'Aucun joueur dans ce championnat.';
      row.appendChild(cell);
      list.appendChild(row);
      return;
    }

    let rank = 0;
    let previousScore = null;
    players.forEach(({ player, mpla, winamax, score, played }, index) => {
      if (score !== previousScore) rank = index + 1;
      previousScore = score;

      const row = document.createElement('tr');
      row.dataset.playerMpla = mpla;
      [rank, player.firstname || '', mpla, winamax, score.toLocaleString('fr-FR'), played].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });

      tournaments.forEach(tournament => {
        const cell = document.createElement('td');
        const tournamentPlayer = (tournament.players || []).find(candidate => {
          const identity = candidate.player || candidate;
          return String(identity.mpla || '').toLowerCase() === mpla.toLowerCase();
        });
        const tournamentRank = tournamentPlayer?.rank;
        cell.textContent = !tournamentPlayer
          ? '-'
          : tournamentRank === null || tournamentRank === undefined || tournamentRank === ''
            ? 'En jeu'
            : tournamentRank;
        row.appendChild(cell);
      });

      const actionCell = document.createElement('td');
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'championship-player-remove';
      removeButton.title = `Retirer ${mpla} du championnat`;
      removeButton.setAttribute('aria-label', `Retirer ${mpla} du championnat`);
      const icon = document.createElement('i');
      icon.className = 'fas fa-user-minus';
      icon.setAttribute('aria-hidden', 'true');
      removeButton.appendChild(icon);
      removeButton.addEventListener('click', () => removeChampionshipPlayer(mpla));
      actionCell.appendChild(removeButton);
      row.appendChild(actionCell);
      list.appendChild(row);
    });
  }

  function formatChampionshipTournamentDate(value, index) {
    if (!value) return `Tournoi ${index + 1}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('fr-FR');
  }

  function setChampionshipPlayersStatus(message) {
    document.getElementById('championship-players-status').textContent = message;
  }