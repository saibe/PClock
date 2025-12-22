// Définitions de constantes et structures (à placer ici ou dans un fichier 'data.js' séparé)
const ROOMS_KEY = 'poker_championship_rooms';
let currentRoomData = null; // L'objet RoomData actuellement sélectionné

const BaseRoomData = {
    roomname: "",
    championships: [],
    Tournaments: [] 
};
// ... Structures Championship, Tournament, etc. (utiliser vos définitions finales)

// =======================================================
// LOGIQUE GLOBALE DE GESTION DES ROOMS (CONTAINER-L)
// =======================================================

function loadAllRooms() {
    const data = localStorage.getItem(ROOMS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAllRooms(rooms) {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

/**
 * Met à jour la RoomData actuelle dans la liste globale du localStorage.
 */
function saveCurrentRoom() {
    if (!currentRoomData) return;
    
    let allRooms = loadAllRooms();
    const index = allRooms.findIndex(r => r.roomname === currentRoomData.roomname);

    if (index !== -1) {
        allRooms[index] = currentRoomData;
    } else {
        allRooms.push(currentRoomData);
    }
    saveAllRooms(allRooms);
}

/**
 * Crée une nouvelle RoomData et met à jour la liste.
 */
function createRoom() {
    const roomNameInput = document.getElementById('newRoomName');
    const roomName = roomNameInput.value.trim();
    const messageElement = document.getElementById('messageL');

    if (!roomName) {
        messageElement.textContent = "Nom requis.";
        messageElement.style.color = 'red';
        return;
    }

    let rooms = loadAllRooms();
    if (rooms.some(r => r.roomname === roomName)) {
        messageElement.textContent = `La salle '${roomName}' existe déjà.`;
        messageElement.style.color = 'orange';
        return;
    }

    const newRoom = { ...BaseRoomData, roomname: roomName };
    rooms.push(newRoom);
    saveAllRooms(rooms);

    messageElement.textContent = `Salle '${roomName}' créée !`;
    messageElement.style.color = 'green';
    roomNameInput.value = '';

    renderRoomList(); // Mettre à jour l'affichage
    selectRoom(roomName); // Sélectionner la nouvelle salle
}

/**
 * Supprime une salle et met à jour l'affichage.
 */
function deleteRoom(roomName) {
    if (!confirm(`Êtes-vous sûr de supprimer la salle '${roomName}' et TOUTES ses données ?`)) {
        return;
    }

    let rooms = loadAllRooms();
    rooms = rooms.filter(r => r.roomname !== roomName);
    saveAllRooms(rooms);
    
    if (currentRoomData && currentRoomData.roomname === roomName) {
        currentRoomData = null; // Désélectionner si la salle actuelle est supprimée
        document.getElementById('roomManagementContent').style.display = 'none';
        document.getElementById('noRoomSelected').style.display = 'block';
    }
    
    renderRoomList();
    document.getElementById('messageL').textContent = `Salle '${roomName}' supprimée.`;
    document.getElementById('messageL').style.color = 'gray';
}

/**
 * Affiche la liste des RoomData en 'tiles' dans container-L.
 */
function renderRoomList() {
    const container = document.getElementById('roomListContainer');
    const rooms = loadAllRooms();
    
    if (rooms.length === 0) {
        container.innerHTML = '<p style="color: #999;">Aucune salle créée.</p>';
        return;
    }

    container.innerHTML = rooms.map(room => {
        const isSelected = currentRoomData && currentRoomData.roomname === room.roomname ? 'style="border: 2px solid chocolate;"' : '';
        
        return `
            <div class="room-item table-block" ${isSelected} onclick="selectRoom('${room.roomname}')" style="cursor: pointer; margin-bottom: 10px; padding: 10px; border-radius: 8px;">
                <span style="font-size: 1.1em; font-weight: bold;">${room.roomname}</span>
                <span style="font-size: 0.9em; color: #bbb;">(${room.championships.length} Ch.)</span>
                <button style="float: right; background: none; border: none; color: #d9534f;" 
                        onclick="event.stopPropagation(); deleteRoom('${room.roomname}')" title="Supprimer la salle">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Sélectionne une RoomData et affiche son contenu dans container.
 */
function selectRoom(roomName) {
    const allRooms = loadAllRooms();
    const room = allRooms.find(r => r.roomname === roomName);

    if (room) {
        currentRoomData = room;
        
        // 1. Mettre à jour les titres et les métadonnées
        document.getElementById('roomTitle').textContent = room.roomname;
        document.getElementById('roomMetadata').textContent = `ID de salle : ${roomName.hashCode()}`; // Fonction de hash simple à ajouter
        
        // 2. Mettre à jour les stats du Container-R
        document.getElementById('selectedRoomNameR').textContent = room.roomname;
        document.getElementById('totalChampionshipsR').textContent = room.championships.length;
        document.getElementById('totalTournamentsR').textContent = room.Tournaments.length;

        // 3. Afficher le contenu de gestion
        document.getElementById('noRoomSelected').style.display = 'none';
        document.getElementById('roomManagementContent').style.display = 'block';
        
        // 4. Rendu des listes spécifiques à la Room
        renderChampionshipList();
        renderRoomList(); // Pour mettre en évidence la tile sélectionnée
    }
}

// =======================================================
// LOGIQUE INTERNE À LA ROOM SÉLECTIONNÉE (CONTAINER)
// =======================================================

/**
 * Crée un nouvel objet Championship et l'ajoute à la RoomData actuelle.
 */
function createChampionship() {
    if (!currentRoomData) return;
    
    const season = parseInt(document.getElementById('newSeasonInput').value);
    const quarter = parseInt(document.getElementById('newQuarterInput').value);
    const messageElement = document.getElementById('championshipMessage');

    // ... (logique de validation omise pour la concision)

    // Vérifier les doublons
    if (currentRoomData.championships.some(c => c.season === season && c.quarter === quarter)) {
        messageElement.textContent = `Championnat S${season}Q${quarter} existe déjà.`;
        messageElement.style.color = 'orange';
        return;
    }

    const newChampionship = {
        uuid: Date.now(), 
        season: season,
        quarter: quarter,
        ptsladder: [], 
        structure: [], 
        tournaments: [],
        players: [],
    };

    currentRoomData.championships.push(newChampionship);
    saveCurrentRoom();
    renderChampionshipList();
    
    document.getElementById('totalChampionshipsR').textContent = currentRoomData.championships.length;
    messageElement.textContent = `Championnat S${season}Q${quarter} créé !`;
    messageElement.style.color = 'green';
}

/**
 * Affiche la liste des championnats de la Room sélectionnée.
 */
function renderChampionshipList() {
    const tbody = document.getElementById('championshipsTableBody');
    
    if (!currentRoomData || currentRoomData.championships.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aucun championnat défini.</td></tr>';
        return;
    }

    tbody.innerHTML = currentRoomData.championships.map(c => {
        const tournamentCount = c.tournaments ? c.tournaments.length : 0;
        const status = tournamentCount > 0 ? "Actif" : "Nouveau";
        
        return `
            <tr>
                <td>${c.season}</td>
                <td>${c.quarter}</td>
                <td>${status}</td>
                <td>${tournamentCount}</td>
                <td>
                    <button onclick="manageChampionship('${c.uuid}')" style="background: chocolate;">Gérer</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Redirige l'utilisateur vers la page de gestion d'un championnat spécifique.
 * @param {string} uuid - L'identifiant unique du championnat.
 */
function manageChampionship(uuid) {
    if (!currentRoomData || !uuid) {
        console.error("Erreur : Données de salle ou UUID manquants.");
        return;
    }

    // On stocke le nom de la room actuelle pour que la page suivante sache où chercher
    localStorage.setItem('last_selected_room', currentRoomData.roomname);

    // Redirection vers la page de gestion avec l'UUID en paramètre URL
    window.location.href = `championship.html?uuid=${uuid}`;
}

// Fonction utilitaire simple pour donner un ID
String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

// Initialisation de la page
document.addEventListener('DOMContentLoaded', renderRoomList);
