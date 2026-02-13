class PlayerIdentity {
    constructor(firstname = "", mpla = "", winamax = "") {
        this.firstname = firstname;
        this.mpla = mpla;
        this.winamax = winamax;
    }
}

class StructureItem {
    constructor(round = 0, sb = 0, bb = 0, duration = 0, isBreak = false) {
        this.round = round;
        this.small_blind = sb;
        this.big_blind = bb;
        this.duration = duration;
        this.isBreak = isBreak;
    }
}

class Tournament {
    constructor(uuid = null, date = null, title = "", structure = [], ptsladder = [], round = 1, clock = 0, players = []) {
        this.uuid = uuid || crypto.randomUUID(); //
        this.date = date || new Date().toISOString(); //
        this.title = title; //
        this.structure = Array.isArray(structure) 
            ? structure.map(s => new StructureItem(s.round, s.small_blind, s.big_blind, s.duration, s.isBreak))
            : []; //
        this.ptsladder = Array.isArray(ptsladder) ? ptsladder : []; //
        this.round = round; //
        this.clock = clock; //
        this.players = Array.isArray(players)
            ? players.map(p => new PlayerIdentity(p.firstname, p.mpla, p.winamax))
            : []; //
    }
}

class Championship {
    constructor(uuid = null, name = "", tournaments = [], players = []) {
        this.uuid = uuid || crypto.randomUUID();
        this.name = name;
        this.tournaments = tournaments.map(t => new Tournament(
            t.uuid, t.date, t.title, t.structure, t.ptsladder, t.round, t.clock, t.players
        ));
        this.players = players.map(p => new PlayerIdentity(p.firstname, p.mpla, p.winamax));
    }

    getStatus() {
        return this.tournaments.length > 0 ? "Actif" : "Nouveau";
    }

    addPlayer(player) {
        if (player instanceof PlayerIdentity) {
            this.players.push(player);
        }
    }
}

class Room {
    constructor(name, championships = [], uuid = null) {
        this.uuid = uuid || crypto.randomUUID();
        this.name = name;
        this.championships = championships.map(c => 
            new Championship(c.uuid, c.name, c.tournaments, c.players)
        );
    }

    // Cette fonction appartient à la "famille" Room, mais pas à une salle précise
    static loadFromStorage(data) {
        const raw = JSON.parse(data); // Le JSON.parse est ici !
        return new Room(raw.name, raw.championships);
    }

    addChampionship(name) {
        const exists = this.championships.some(c => c.name === name);
        if (exists) return { success: false, message: "Ce nom de championnat existe déjà." };

        const newChampionship = new Championship(null, name);
        this.championships.push(newChampionship);
        return { success: true, championship: newChampionship };
    }
}

class RoomsManager {
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.allRooms = this.loadFromLocalStorage();
    }

    // Charge tout le LocalStorage et réhydrate chaque salle
    loadFromLocalStorage() {
        const data = localStorage.getItem(this.storageKey);
        const rawArray = data ? JSON.parse(data) : [];
        
        // On passe r.uuid en 3ème paramètre pour conserver l'ID existant
        return rawArray.map(r => new Room(r.name, r.championships, r.uuid)); 
    }
    // Sauvegarde l'état actuel dans le LocalStorage
    saveToLocalStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.allRooms));
    }

    // Trouve une salle par son nom
    getRoom(name) {
        return this.allRooms.find(r => r.name === name);
    }

    // Trouve une salle par son nom
    getRoomByUuid(uuid) {
        return this.allRooms.find(r => r.uuid === uuid);
    }

    // Ajoute une salle et sauvegarde
    addRoom(name) {
        if (this.getRoom(name)) return { success: false, message: "Existe déjà" };
        const newRoom = new Room(name);
        this.allRooms.push(newRoom);
        this.saveToLocalStorage();
        return { success: true, room: newRoom };
    }
    // Supprime une salle et sauvegarde
    delRoom(uuid) {
        const initialLength = this.allRooms.length;
        this.allRooms = this.allRooms.filter(r => r.uuid !== uuid);
        
        if (this.allRooms.length < initialLength) {
            this.saveToLocalStorage();
            return { success: true, message: "Room deleted successfully" };
        }
        return { success: false, message: "Room not found" };
    }
}

