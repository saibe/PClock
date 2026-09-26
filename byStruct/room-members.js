let pendingRoomMemberImport = null;

function addRoomMember() {
    if (!currentRoomData) return;

    const mpla = window.prompt('Pseudo MPLA du membre :')?.trim();
    if (!mpla) return;
    const firstname = window.prompt('Prénom (facultatif) :')?.trim() || '';
    const winamax = window.prompt('Pseudo Winamax (facultatif) :')?.trim() || '';
    saveRoomMembers([{ firstname, mpla, winamax }]);
}

function openRoomMembersImportDialog() {
    if (!currentRoomData) return;
    const dialog = document.getElementById('room-members-import-dialog');
    document.getElementById('room-members-import-status').textContent = '';
    showRoomMembersImportSource('file');
    if (!dialog.open) dialog.showModal();
}

function closeRoomMembersImportDialog() {
    const dialog = document.getElementById('room-members-import-dialog');
    if (dialog.open) dialog.close();
}

function showRoomMembersImportSource(source) {
    const useFile = source === 'file';
    pendingRoomMemberImport = null;
    document.getElementById('room-members-column-mapping').hidden = true;
    document.getElementById('room-import-file-panel').hidden = !useFile;
    document.getElementById('room-import-url-panel').hidden = useFile;
    document.getElementById('room-import-file-tab').classList.toggle('active', useFile);
    document.getElementById('room-import-url-tab').classList.toggle('active', !useFile);
    document.getElementById('room-import-file-tab').setAttribute('aria-selected', String(useFile));
    document.getElementById('room-import-url-tab').setAttribute('aria-selected', String(!useFile));
    document.getElementById(useFile ? 'room-members-file' : 'room-members-url').focus();
}

async function loadRoomMembersFromFile() {
    const file = document.getElementById('room-members-file').files[0];
    if (!file) {
        setRoomMembersImportStatus('Choisissez un fichier CSV ou TSV.');
        return;
    }

    try {
        prepareRoomMembersColumnMapping(parseRoomMembersRows(await file.text()));
    } catch (error) {
        setRoomMembersImportStatus(`Chargement impossible : ${error.message}`);
    }
}

async function loadRoomMembersFromUrl() {
    const input = document.getElementById('room-members-url').value.trim();
    if (!input) {
        setRoomMembersImportStatus('Saisissez le lien du fichier ou de la Google Sheet.');
        return;
    }

    try {
        const response = await fetch(normalizeRoomMembersUrl(input));
        if (!response.ok) throw new Error(`réponse HTTP ${response.status}`);
        prepareRoomMembersColumnMapping(parseRoomMembersRows(await response.text()));
    } catch (error) {
        setRoomMembersImportStatus(`Chargement impossible : ${error.message}. Vérifiez que le lien est accessible et publié en CSV.`);
    }
}

function normalizeRoomMembersUrl(value) {
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

function parseRoomMembersRows(text) {
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) throw new Error('le fichier ne contient aucune ligne');

    const delimiter = [';', ',', '\t'].sort((first, second) =>
        countRoomMembersDelimiter(lines[0], second) - countRoomMembersDelimiter(lines[0], first)
    )[0];
    const rows = lines.map(line => parseRoomMembersRow(line, delimiter));
    const columnCount = Math.max(...rows.map(row => row.length));
    if (columnCount < 3 || rows.length < 2) {
        throw new Error('le fichier doit contenir au moins trois colonnes et une ligne de données');
    }
    return { rows, columns: Array.from({ length: columnCount }, (_, index) => rows[0][index] || '') };
}

function prepareRoomMembersColumnMapping(importData) {
    pendingRoomMemberImport = importData;
    const fields = [
        { id: 'room-firstname-column', headers: ['prenom', 'firstname', 'first name'] },
        { id: 'room-mpla-column', headers: ['mpla', 'pseudo', 'pseudo mpla', 'identifiant'] },
        { id: 'room-winamax-column', headers: ['winamax', 'pseudo winamax'] }
    ];
    const usedIndexes = new Set();

    fields.forEach(({ id, headers }, fieldIndex) => {
        const select = document.getElementById(id);
        select.replaceChildren();
        importData.columns.forEach((column, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `Colonne ${index + 1}${column ? ` : ${column}` : ''}`;
            select.appendChild(option);
        });

        const detectedIndex = importData.columns.findIndex((column, index) =>
            headers.includes(normalizeRoomMemberHeader(column)) && !usedIndexes.has(index)
        );
        let selectedIndex = detectedIndex;
        if (selectedIndex < 0 || usedIndexes.has(selectedIndex)) {
            selectedIndex = Array.from({ length: importData.columns.length }, (_, index) => index).find(index => !usedIndexes.has(index));
        }
        select.value = String(selectedIndex ?? Math.min(fieldIndex, importData.columns.length - 1));
        usedIndexes.add(Number(select.value));
    });

    const headerLabels = importData.columns.map(normalizeRoomMemberHeader);
    const hasHeader = headerLabels.some(label => ['prenom', 'firstname', 'mpla', 'pseudo', 'winamax'].includes(label));
    document.getElementById('room-import-has-header').checked = hasHeader;
    document.getElementById('room-import-file-panel').hidden = true;
    document.getElementById('room-import-url-panel').hidden = true;
    document.getElementById('room-members-column-mapping').hidden = false;
    setRoomMembersImportStatus(`${importData.rows.length} lignes chargées. Vérifiez les colonnes avant l’import.`);
    document.getElementById('room-firstname-column').focus();
}

function importMappedRoomMembers() {
    if (!pendingRoomMemberImport || !currentRoomData) {
        setRoomMembersImportStatus('Chargez d’abord un fichier ou un lien dans une room sélectionnée.');
        return;
    }

    const columnIndexes = [
        document.getElementById('room-firstname-column').value,
        document.getElementById('room-mpla-column').value,
        document.getElementById('room-winamax-column').value
    ].map(Number);
    if (columnIndexes.some(index => !Number.isInteger(index) || index < 0) || new Set(columnIndexes).size !== 3) {
        setRoomMembersImportStatus('Choisissez une colonne différente pour le prénom, le MPLA et Winamax.');
        return;
    }

    const hasHeader = document.getElementById('room-import-has-header').checked;
    const members = pendingRoomMemberImport.rows.slice(hasHeader ? 1 : 0).map(row => ({
        firstname: (row[columnIndexes[0]] || '').trim(),
        mpla: (row[columnIndexes[1]] || '').trim(),
        winamax: (row[columnIndexes[2]] || '').trim()
    })).filter(member => member.mpla);

    if (!members.length) {
        setRoomMembersImportStatus('Aucun membre avec un MPLA n’a été trouvé dans les lignes sélectionnées.');
        return;
    }

    saveRoomMembers(members);
    pendingRoomMemberImport = null;
    document.getElementById('room-members-column-mapping').hidden = true;
}

function saveRoomMembers(members) {
    if (!currentRoomData) return;
    currentRoomData.members = Array.isArray(currentRoomData.members) ? currentRoomData.members : [];
    const existing = new Set(currentRoomData.members.map(member => String(member.mpla || '').toLowerCase()));
    let added = 0;
    let skipped = 0;

    members.forEach(member => {
        const key = member.mpla.trim().toLowerCase();
        if (!key || existing.has(key)) {
            skipped++;
            return;
        }
        existing.add(key);
        currentRoomData.members.push({ firstname: member.firstname.trim(), mpla: member.mpla.trim(), winamax: member.winamax.trim() });
        added++;
    });

    saveCurrentRoom();
    renderRoomMembers();
    setRoomMembersImportStatus(`${added} membre${added === 1 ? '' : 's'} ajouté${added === 1 ? '' : 's'}${skipped ? `, ${skipped} doublon${skipped === 1 ? '' : 's'} ignoré${skipped === 1 ? '' : 's'}` : ''}.`);
}

function deleteRoomMember(mpla) {
    if (!currentRoomData || !window.confirm(`Supprimer le membre « ${mpla} » de cette room ?`)) return;
    currentRoomData.members = currentRoomData.members.filter(member => member.mpla !== mpla);
    saveCurrentRoom();
    renderRoomMembers();
}

function renderRoomMembers() {
    const list = document.getElementById('roomMembersList');
    if (!list) return;
    const members = currentRoomData?.members || [];
    list.replaceChildren();
    if (!members.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'Aucun membre dans cette room.';
        row.appendChild(cell);
        list.appendChild(row);
    }
    members.forEach(member => {
        const row = document.createElement('tr');
        [member.firstname, member.mpla, member.winamax].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value || '';
            row.appendChild(cell);
        });

        const actionCell = document.createElement('td');
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'room-member-delete';
        removeButton.title = `Supprimer ${member.mpla}`;
        removeButton.setAttribute('aria-label', `Supprimer ${member.mpla}`);
        const icon = document.createElement('i');
        icon.className = 'fas fa-trash-alt';
        icon.setAttribute('aria-hidden', 'true');
        removeButton.appendChild(icon);
        removeButton.addEventListener('click', () => deleteRoomMember(member.mpla));
        actionCell.appendChild(removeButton);
        row.appendChild(actionCell);
        list.appendChild(row);
    });
    document.getElementById('roomMembersCount').textContent = members.length;
    document.getElementById('totalRoomMembersR').textContent = members.length;
}

function setRoomMembersImportStatus(message) {
    document.getElementById('room-members-import-status').textContent = message;
}

function countRoomMembersDelimiter(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
        if (line[index] === '"') {
            if (quoted && line[index + 1] === '"') index++;
            else quoted = !quoted;
        } else if (!quoted && line[index] === delimiter) {
            count++;
        }
    }
    return count;
}

function parseRoomMembersRow(line, delimiter) {
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

function normalizeRoomMemberHeader(value) {
    return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}