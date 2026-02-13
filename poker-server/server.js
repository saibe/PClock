const io = require('socket.io')(3000, {
  cors: { origin: "*" } // Autorise tout le monde à se connecter
});

let gameState = {}; // On stocke l'état du tournoi ici

io.on('connection', (socket) => {
  console.log('Un appareil est connecté');

  // Quand l'admin envoie une mise à jour
  socket.on('update_game', (data) => {
    gameState = data;
    // On renvoie l'info à TOUS les autres immédiatement
    socket.broadcast.emit('sync_game', data);
  });
});
