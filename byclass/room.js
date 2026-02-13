// Définitions de constantes et structures (à placer ici ou dans un fichier 'data.js' séparé)
const ROOMS_KEY = 'poker_championship_rooms';
let currentRoomData = null; // L'objet RoomData actuellement sélectionné
// Initialisation de la page
document.addEventListener('DOMContentLoaded', renderRoomList);

const manager = new RoomsManager(ROOMS_KEY);

function createRoom() {
    const name = document.getElementById('newRoomName').value;
    const result = manager.addRoom(name); // On utilise le manager
    
    if (result.success) {
        renderRoomList();
    } else {
        alert(result.message);
    }
}

function deleteRoom(uuid) {
    const result = manager.delRoom(uuid); // On utilise le manager
    
    if (result.success) {
        renderRoomList();
    } else {
        alert(result.message);
    }
}

function selectRoom(uuid) {
    const rooms = manager.loadFromLocalStorage();
    const room = rooms.find(r => r.uuid === uuid); // Recherche par UUID

    if (room) {
        currentRoomData = room;
        
        // Mise à jour de l'affichage
        document.getElementById('roomTitle').textContent = room.name;
        document.getElementById('roomMetadata').textContent = `ID : ${room.uuid}`;
        
        document.getElementById('selectedRoomNameR').textContent = room.name;
        document.getElementById('totalChampionshipsR').textContent = room.championships.length;

        document.getElementById('noRoomSelected').style.display = 'none';
        document.getElementById('roomManagementContent').style.display = 'block';
        
        renderChampionshipList(uuid);
        renderRoomList(); 
    }
}

// Remplacez votre fonction actuelle par celle-ci :
function renderChampionshipList(uuid) {
    const room = manager.getRoomByUuid(uuid) || currentRoomData;
    
    if (!room) {
        return;
    }

    const tbody = document.getElementById('championshipsTableBody');
    if (!tbody) return;

    if (room.championships.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aucun championnat créé.</td></tr>';
        return;
    }

    tbody.innerHTML = room.championships.map(champ => {
        return `
            <tr>
                <td>Saison ${champ.name.split(' ')[1] || '?'}</td>
                <td>T${champ.name.split(' ')[3] || '?'}</td>
                <td>${champ.getStatus()}</td>
                <td>${champ.tournaments.length}</td>
                <td>
                    <button onclick="viewChampionship('${champ.uuid}')" style="background: chocolate; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRoomList() {
    const container = document.getElementById('roomListContainer');
    const rooms = manager.loadFromLocalStorage();
    
    if (rooms.length === 0) {
        container.innerHTML = '<p style="color: #999;">Aucune salle créée.</p>';
        return;
    }

    container.innerHTML = rooms.map(room => {
        // Comparaison par UUID pour la classe active
        const isSelected = currentRoomData && currentRoomData.uuid === room.uuid 
            ? 'style="border: 4px solid chocolate; background-color: #666;"' 
            : '';
        
        return `
            <div class="room-item table-block" ${isSelected} onclick="selectRoom('${room.uuid}')">
                <span style="font-size: 1.1em; font-weight: bold;">${room.name}</span>
                <br>
                <span style="font-size: 0.8em; color: #bbb;">(${room.championships.length} Champ.)</span>
                <button style="float: right; background: none; border: none; color: #d9534f; cursor: pointer;" 
                        onclick="event.stopPropagation(); deleteRoom('${room.uuid}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }).join('');
}