'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    // Allow any origin by default so players on any domain can connect.
    // Set the CORS_ORIGIN environment variable to restrict access in production
    // (e.g. CORS_ORIGIN=https://myapp.railway.app).
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

app.set('trust proxy', 1);
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// IN-MEMORY ROOM STORAGE
// ============================================================
// rooms: Map<roomId, roomState>
// roomState: { id, hostSocketId, modeKey, players: [{socketId, playerId, name, color, pawn, ready}], gameState, started }
const rooms = new Map();

function generateRoomId() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function buildRoomPayload(room) {
  const mode = getModePreset(room.modeKey);
  return {
    roomId: room.id,
    modeKey: room.modeKey,
    modeLabel: mode.label,
    modeDescription: mode.description,
    hostPlayerId: room.players.find(p => p.socketId === room.hostSocketId)?.playerId ?? 0,
    players: room.players.map(p => ({
      playerId: p.playerId,
      name: p.name,
      color: p.color,
      pawn: p.pawn,
      ready: Boolean(p.ready),
    })),
  };
}

function emitRoomState(room) {
  io.to(room.id).emit('room-state', buildRoomPayload(room));
}

// ============================================================
// SOCKET.IO HANDLERS
// ============================================================
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ----------------------------------------------------------
  // create-room: { playerName, modeKey }
  // ----------------------------------------------------------
  socket.on('create-room', ({ playerName, color, pawn, modeKey }) => {
    if (!playerName || typeof playerName !== 'string') {
      socket.emit('error', { message: 'Nieprawidłowa nazwa gracza.' });
      return;
    }
    const profile = sanitizePlayerProfile({ playerName, color, pawn }, 0);
    if (!profile.name) {
      socket.emit('error', { message: 'Nieprawidłowa nazwa gracza.' });
      return;
    }
    const roomId = generateRoomId();
    const playerId = 0;

    const roomState = {
      id: roomId,
      hostSocketId: socket.id,
      modeKey: sanitizeModeKey(modeKey),
      players: [{ socketId: socket.id, playerId, name: profile.name, color: profile.color, pawn: profile.pawn, ready: false }],
      gameState: null,
      started: false,
    };
    rooms.set(roomId, roomState);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    socket.data.playerName = profile.name;

    socket.emit('room-created', {
      roomId,
      playerId,
      modeKey: roomState.modeKey,
      players: roomState.players.map(p => ({ playerId: p.playerId, name: p.name, color: p.color, pawn: p.pawn, ready: p.ready })),
    });
    emitRoomState(roomState);
    console.log(`[room-created] ${roomId} by ${profile.name}`);
  });

  // ----------------------------------------------------------
  // join-room: { roomId, playerName }
  // ----------------------------------------------------------
  socket.on('join-room', ({ roomId, playerName, color, pawn }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: `Pokój ${roomId} nie istnieje.` });
      return;
    }
    if (room.started) {
      socket.emit('error', { message: 'Gra już się rozpoczęła.' });
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('error', { message: 'Pokój jest pełny (maks. 4 graczy).' });
      return;
    }
    if (!playerName || typeof playerName !== 'string') {
      socket.emit('error', { message: 'Nieprawidłowa nazwa gracza.' });
      return;
    }
    const profile = sanitizePlayerProfile({ playerName, color, pawn }, room.players.length);
    if (!profile.name) {
      socket.emit('error', { message: 'Nieprawidłowa nazwa gracza.' });
      return;
    }
    if (room.players.some(p => p.name.toLowerCase() === profile.name.toLowerCase())) {
      socket.emit('error', { message: 'To imię gracza jest już zajęte.' });
      return;
    }
    if (room.players.some(p => p.color === profile.color)) {
      socket.emit('error', { message: 'Ten kolor jest już zajęty w pokoju.' });
      return;
    }
    if (room.players.some(p => p.pawn === profile.pawn)) {
      socket.emit('error', { message: 'Ten pionek jest już zajęty w pokoju.' });
      return;
    }
    const playerId = room.players.length;

    room.players.push({ socketId: socket.id, playerId, name: profile.name, color: profile.color, pawn: profile.pawn, ready: false });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    socket.data.playerName = profile.name;

    const playerList = room.players.map(p => ({ playerId: p.playerId, name: p.name, color: p.color, pawn: p.pawn, ready: p.ready }));
    socket.emit('room-joined', { roomId, playerId, modeKey: room.modeKey, players: playerList });
    emitRoomState(room);
    console.log(`[join-room] ${profile.name} joined ${roomId} as player ${playerId}`);
  });

  socket.on('set-ready', (payload = {}) => {
    const data = payload && typeof payload === 'object' ? payload : {};
    if (typeof data.ready !== 'boolean') return;

    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || room.started) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.ready = data.ready;
    emitRoomState(room);
  });

  // ----------------------------------------------------------
  // start-game: host triggers start
  // ----------------------------------------------------------
  socket.on('start-game', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit('error', { message: 'Tylko gospodarz może rozpocząć grę.' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: 'Potrzeba co najmniej 2 graczy.' });
      return;
    }
    const notReady = room.players.filter(p => !p.ready);
    if (notReady.length > 0) {
      socket.emit('error', { message: `Nie wszyscy są gotowi: ${notReady.map(p => p.name).join(', ')}.` });
      return;
    }
    room.started = true;
    room.gameState = createServerGameState(room.players.map(p => ({ name: p.name, color: p.color, pawn: p.pawn })), room.modeKey);
    io.to(roomId).emit('game-started', sanitizeState(room.gameState));
    console.log(`[start-game] Room ${roomId} started with ${room.players.length} players`);
  });

  // ----------------------------------------------------------
  // game-action: { type, data }
  // ----------------------------------------------------------
  socket.on('game-action', ({ type, data }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !room.gameState) return;

    const gs = room.gameState;
    const playerId = socket.data.playerId;

    // Validate it's this player's turn
    if (gs.currentPlayerIndex !== playerId && type !== 'chat') {
      socket.emit('error', { message: 'To nie jest Twoja tura.' });
      return;
    }

    processAction(gs, playerId, type, data || {});
    io.to(roomId).emit('game-state', sanitizeState(gs));

    if (gs.winner !== null) {
      console.log(`[game-over] Room ${roomId} winner: player ${gs.winner}`);
    }
  });

  // ----------------------------------------------------------
  // chat-message
  // ----------------------------------------------------------
  socket.on('chat-message', ({ text }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const name = socket.data.playerName || 'Anonim';
    if (typeof text !== 'string') return;
    io.to(roomId).emit('chat-message', { name, text: text.slice(0, 200) });
  });

  // ----------------------------------------------------------
  // disconnect
  // ----------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (!room.started) {
      room.players = room.players.filter(p => p.socketId !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(roomId);
      } else {
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = room.players[0].socketId;
        }
        room.players.forEach((p, idx) => { p.playerId = idx; });
        emitRoomState(room);
      }
    } else {
      // Mark player as disconnected in game state
      const gs = room.gameState;
      if (gs) {
        const pIdx = socket.data.playerId;
        if (gs.players[pIdx]) {
          gs.players[pIdx].disconnected = true;
          addLog(gs, `${gs.players[pIdx].name} rozłączył się.`);
        }
        io.to(roomId).emit('game-state', sanitizeState(gs));
      }
    }
  });
});

// ============================================================
// SERVER-SIDE GAME LOGIC  (mirrors client logic)
// ============================================================

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollDie() { return Math.floor(Math.random() * 6) + 1; }

const BOARD_SPACES_SERVER = [
  { id: 0,  type: 'go'         },
  { id: 1,  type: 'property',  group: 'purple',    price: 60,  rent: [2,10,30,90,160,250],       houseCost: 50,  hotelCost: 50,  mortgage: 30  },
  { id: 2,  type: 'card',      deck: 'insight'  },
  { id: 3,  type: 'property',  group: 'purple',    price: 60,  rent: [4,20,60,180,320,450],       houseCost: 50,  hotelCost: 50,  mortgage: 30  },
  { id: 4,  type: 'tax',       amount: 200      },
  { id: 5,  type: 'property',  group: 'lightblue', price: 100, rent: [6,30,90,270,400,550],       houseCost: 50,  hotelCost: 50,  mortgage: 50  },
  { id: 6,  type: 'card',      deck: 'insight'  },
  { id: 7,  type: 'property',  group: 'lightblue', price: 100, rent: [6,30,90,270,400,550],       houseCost: 50,  hotelCost: 50,  mortgage: 50  },
  { id: 8,  type: 'property',  group: 'lightblue', price: 120, rent: [8,40,100,300,450,600],      houseCost: 50,  hotelCost: 50,  mortgage: 60  },
  { id: 9,  type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 10, type: 'property',  group: 'pink',      price: 140, rent: [10,50,150,450,625,750],     houseCost: 100, hotelCost: 100, mortgage: 70  },
  { id: 11, type: 'card',      deck: 'insight'  },
  { id: 12, type: 'property',  group: 'pink',      price: 140, rent: [10,50,150,450,625,750],     houseCost: 100, hotelCost: 100, mortgage: 70  },
  { id: 13, type: 'property',  group: 'pink',      price: 160, rent: [12,60,180,500,700,900],     houseCost: 100, hotelCost: 100, mortgage: 80  },
  { id: 14, type: 'jail'       },
  { id: 15, type: 'property',  group: 'orange',    price: 180, rent: [14,70,200,550,750,950],     houseCost: 100, hotelCost: 100, mortgage: 90  },
  { id: 16, type: 'card',      deck: 'insight'  },
  { id: 17, type: 'property',  group: 'orange',    price: 180, rent: [14,70,200,550,750,950],     houseCost: 100, hotelCost: 100, mortgage: 90  },
  { id: 18, type: 'property',  group: 'orange',    price: 200, rent: [16,80,220,600,800,1000],    houseCost: 100, hotelCost: 100, mortgage: 100 },
  { id: 19, type: 'utility',   price: 150,  mortgage: 75  },
  { id: 20, type: 'property',  group: 'red',       price: 220, rent: [18,90,250,700,875,1050],    houseCost: 150, hotelCost: 150, mortgage: 110 },
  { id: 21, type: 'card',      deck: 'insight'  },
  { id: 22, type: 'property',  group: 'red',       price: 220, rent: [18,90,250,700,875,1050],    houseCost: 150, hotelCost: 150, mortgage: 110 },
  { id: 23, type: 'property',  group: 'red',       price: 240, rent: [20,100,300,750,925,1100],   houseCost: 150, hotelCost: 150, mortgage: 120 },
  { id: 24, type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 25, type: 'property',  group: 'yellow',    price: 260, rent: [22,110,330,800,975,1150],   houseCost: 150, hotelCost: 150, mortgage: 130 },
  { id: 26, type: 'property',  group: 'yellow',    price: 260, rent: [22,110,330,800,975,1150],   houseCost: 150, hotelCost: 150, mortgage: 130 },
  { id: 27, type: 'card',      deck: 'insight'  },
  { id: 28, type: 'property',  group: 'yellow',    price: 280, rent: [24,120,360,850,1025,1200],  houseCost: 150, hotelCost: 150, mortgage: 140 },
  { id: 29, type: 'utility',   price: 150,  mortgage: 75  },
  { id: 30, type: 'property',  group: 'green',     price: 300, rent: [26,130,390,900,1100,1275],  houseCost: 200, hotelCost: 200, mortgage: 150 },
  { id: 31, type: 'property',  group: 'green',     price: 300, rent: [26,130,390,900,1100,1275],  houseCost: 200, hotelCost: 200, mortgage: 150 },
  { id: 32, type: 'card',      deck: 'session'  },
  { id: 33, type: 'property',  group: 'green',     price: 320, rent: [28,150,450,1000,1200,1400], houseCost: 200, hotelCost: 200, mortgage: 160 },
  { id: 34, type: 'gotojail'   },
  { id: 35, type: 'property',  group: 'darkblue',  price: 350, rent: [35,175,500,1100,1300,1500], houseCost: 200, hotelCost: 200, mortgage: 175 },
  { id: 36, type: 'card',      deck: 'insight'  },
  { id: 37, type: 'property',  group: 'darkblue',  price: 400, rent: [50,200,600,1400,1700,2000], houseCost: 200, hotelCost: 200, mortgage: 200 },
  { id: 38, type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 39, type: 'tax',       amount: 100      },
];

const INSIGHT_CARDS_SERVER = [
  { id: 'I1',  text: 'Nagłe polecenie od psychiatry: +150 zł, +5 prestiżu. „Ktoś jednak czyta Twoje notatki."', action: 'resource', money: 150, prestige: 5 },
  { id: 'I2',  text: 'Pacjent nie przyszedł (no-show): -50 zł, +5 energii. „Strata finansowa, zysk egzystencjalny."', action: 'resource', money: -50, energy: 5 },
  { id: 'I3',  text: 'Wirusowy post psychoedukacyjny: +10 prestiżu, -3 etyki. „Algorytm lubi uproszczenia bardziej niż Ty."', action: 'resource', prestige: 10, ethics: -3 },
  { id: 'I4',  text: 'Kontrola dokumentacji: -5 energii, -5 prestiżu (bez superwizji także -10 etyki).', action: 'resource', energy: -5, prestige: -5, ethicsIfNoShield: -10 },
  { id: 'I5',  text: 'Nowy kurs za 3000 zł — inwestujesz czy odpuszczasz?', action: 'choice-course' },
  { id: 'I6',  text: 'Pacjent kończy terapię sukcesem: +8 prestiżu, +5 energii. „Rzadkie, ale legalne źródło satysfakcji."', action: 'resource', prestige: 8, energy: 5 },
  { id: 'I7',  text: 'Negatywna opinia w internecie: -10 prestiżu, +2 wypalenia.', action: 'resource', prestige: -10, burnout: 2 },
  { id: 'I8',  text: 'Zaproszenie do mediów: +12 prestiżu, -6 energii. „Mówisz 3 minuty, przygotowujesz się 3 godziny."', action: 'resource', prestige: 12, energy: -6 },
  { id: 'I9',  text: 'Zmiana przepisów: -100 zł, -5 energii. „Regulacje zmieniają się szybciej niż formularze."', action: 'resource', money: -100, energy: -5 },
  { id: 'I10', text: 'Przepracowanie tygodnia: +200 zł, -15 energii, +10 wypalenia. „Efektywność rośnie, człowiek maleje."', action: 'resource', money: 200, energy: -15, burnout: 10 },
  { id: 'I11', text: 'Inspirująca konferencja: -100 zł, +8 prestiżu, +5 energii.', action: 'resource', money: -100, prestige: 8, energy: 5 },
  { id: 'I12', text: 'Trudny przypadek kliniczny: +100 zł, -10 energii, +8 wypalenia.', action: 'resource', money: 100, energy: -10, burnout: 8 },
  { id: 'I13', text: 'Grant badawczy: +300 zł, +10 prestiżu, -8 energii.', action: 'resource', money: 300, prestige: 10, energy: -8 },
  { id: 'I14', text: 'Superwizja pogłębiona: -100 zł, +10 etyki, -10 wypalenia i aktywujesz tarczę superwizji.', action: 'resource', money: -100, ethics: 10, burnout: -10, supervision: 1 },
  { id: 'I15', text: 'Przeciążenie grafiku: +150 zł, -12 energii, +10 wypalenia.', action: 'resource', money: 150, energy: -12, burnout: 10 },
  { id: 'I16', text: 'Boom na jedną diagnozę: +200 zł, +5 prestiżu, +5 wypalenia.', action: 'resource', money: 200, prestige: 5, burnout: 5 },
  { id: 'I17', text: 'Zmiana algorytmu platformy: -100 zł, -5 prestiżu.', action: 'resource', money: -100, prestige: -5 },
  { id: 'I18', text: 'Pacjent przerywa terapię bez słowa: -80 zł, +3 wypalenia.', action: 'resource', money: -80, burnout: 3 },
  { id: 'I19', text: 'Szybkie szkolenie weekendowe: -150 zł, +5 prestiżu, -2 etyki.', action: 'resource', money: -150, prestige: 5, ethics: -2 },
  { id: 'I20', text: 'Wywiad ekspercki w mediach: +15 prestiżu, -8 energii.', action: 'resource', prestige: 15, energy: -8 },
  { id: 'I21', text: 'Przeciążenie administracyjne: -120 zł, -6 energii.', action: 'resource', money: -120, energy: -6 },
  { id: 'I22', text: 'Nagły przypływ klientów: +250 zł, -15 energii, +8 wypalenia.', action: 'resource', money: 250, energy: -15, burnout: 8 },
  { id: 'I23', text: 'Zmiana standardów diagnostycznych: -100 zł, -4 energii, +4 etyki.', action: 'resource', money: -100, energy: -4, ethics: 4 },
  { id: 'I24', text: 'Publiczna krytyka wypowiedzi: -12 prestiżu, +5 wypalenia.', action: 'resource', prestige: -12, burnout: 5 },
  { id: 'I25', text: 'Konferencja zagraniczna: -200 zł, +12 prestiżu, -6 energii.', action: 'resource', money: -200, prestige: 12, energy: -6 },
  { id: 'I26', text: 'Pacjent poleca Cię dalej: +120 zł, +6 prestiżu. „Najbardziej efektywna reklama."', action: 'resource', money: 120, prestige: 6 },
  { id: 'I27', text: 'Nieudana interwencja: -6 prestiżu, -6 energii, +6 wypalenia.', action: 'resource', prestige: -6, energy: -6, burnout: 6 },
  { id: 'I28', text: 'Nowy trend terapeutyczny — podążasz za modą czy odpuszczasz?', action: 'choice-trend' },
  { id: 'I29', text: 'Długi weekend bez pacjentów — odpoczynek: -100 zł, +10 energii.', action: 'resource', money: -100, energy: 10 },
  { id: 'I30', text: 'Rozbudowa grafiku ponad możliwości: +180 zł, -12 energii, +10 wypalenia.', action: 'resource', money: 180, energy: -12, burnout: 10 },
  { id: 'I31', text: 'Rekomendacja od instytucji: +200 zł, +8 prestiżu, -5 energii.', action: 'resource', money: 200, prestige: 8, energy: -5 },
  { id: 'I32', text: 'Konsultacja prawna: +4 etyki i aktywna tarcza superwizji.', action: 'resource', ethics: 4, supervision: 1 },
];

const SESSION_CARDS_SERVER = [
  { id: 'S1',  text: 'Pacjent pyta: „A to na NFZ?" -2 energii.', action: 'resource', energy: -2 },
  { id: 'S2',  text: 'Polecenie od zadowolonego klienta: +100 zł, +5 prestiżu.', action: 'resource', money: 100, prestige: 5 },
  { id: 'S3',  text: 'Mylenie psychologa z psychiatrą: -3 energii lub +1 etyki (wyjaśniasz spokojnie).', action: 'resource', energy: -3, ethics: 1 },
  { id: 'S4',  text: 'Rodzina pacjenta dzwoni bez zgody: -5 energii, +3 etyki.', action: 'resource', energy: -5, ethics: 3 },
  { id: 'S5',  text: 'Student prosi o wywiad: -3 energii, +2 prestiżu.', action: 'resource', energy: -3, prestige: 2 },
  { id: 'S6',  text: 'Dyskusja środowiskowa: -4 energii, +4 prestiżu. „Nikt nie zmienia zdania, wszyscy zyskują."', action: 'resource', energy: -4, prestige: 4 },
  { id: 'S7',  text: 'Współpraca interdyscyplinarna: +6 prestiżu, +4 energii.', action: 'resource', prestige: 6, energy: 4 },
  { id: 'S8',  text: 'Zaniżanie cen przez konkurencję: -100 zł lub -5 prestiżu. (automatycznie: -5 prestiżu)', action: 'resource', prestige: -5 },
  { id: 'S9',  text: 'Pacjent przynosi czekoladki: +3 energii, +1 etyki.', action: 'resource', energy: 3, ethics: 1 },
  { id: 'S10', text: 'Grupa wsparcia dla specjalistów: +8 energii, -5 wypalenia.', action: 'resource', energy: 8, burnout: -5 },
  { id: 'S11', text: 'Konflikt w zespole: -6 energii, +4 wypalenia.', action: 'resource', energy: -6, burnout: 4 },
  { id: 'S12', text: 'Rekomendacja w internecie: +6 prestiżu.', action: 'resource', prestige: 6 },
  { id: 'S13', text: 'Szkolenie RODO: -50 zł, -4 energii, +3 etyki.', action: 'resource', money: -50, energy: -4, ethics: 3 },
  { id: 'S14', text: 'Pacjent wraca po latach: +100 zł, +6 prestiżu, +3 energii.', action: 'resource', money: 100, prestige: 6, energy: 3 },
  { id: 'S15', text: 'Własna terapia: -120 zł, +10 energii, +8 etyki, -8 wypalenia.', action: 'resource', money: -120, energy: 10, ethics: 8, burnout: -8 },
  { id: 'S16', text: 'Plotki środowiskowe: -5 prestiżu lub -5 energii. (automatycznie: -5 prestiżu)', action: 'resource', prestige: -5 },
  { id: 'S17', text: 'Pacjent spóźnia się regularnie: -4 energii.', action: 'resource', energy: -4 },
  { id: 'S18', text: 'Współpraca z lekarzem: +5 prestiżu, +3 energii.', action: 'resource', prestige: 5, energy: 3 },
  { id: 'S19', text: 'Dyskusja o stawkach: -5 energii lub -50 zł. (automatycznie: -50 zł)', action: 'resource', money: -50 },
  { id: 'S20', text: 'Zbyt szeroka oferta usług: -3 etyki, +3 wypalenia.', action: 'resource', ethics: -3, burnout: 3 },
  { id: 'S21', text: 'Pacjent kończy terapię przed czasem: -60 zł, +2 wypalenia.', action: 'resource', money: -60, burnout: 2 },
  { id: 'S22', text: 'Polecenie od kolegi po fachu: +100 zł, +4 prestiżu.', action: 'resource', money: 100, prestige: 4 },
  { id: 'S23', text: 'Konflikt wartości z pacjentem: -5 energii, +3 etyki.', action: 'resource', energy: -5, ethics: 3 },
  { id: 'S24', text: 'Grupa wsparcia zawodowego: +6 energii, -4 wypalenia.', action: 'resource', energy: 6, burnout: -4 },
  { id: 'S25', text: 'Pacjent testuje granice: -5 energii lub -3 etyki. (automatycznie: -5 energii)', action: 'resource', energy: -5 },
  { id: 'S26', text: 'Nadmierna liczba superwizji: -100 zł, +6 etyki, -3 wypalenia.', action: 'resource', money: -100, ethics: 6, burnout: -3 },
  { id: 'S27', text: 'Praca z trudną rodziną: +80 zł, -6 energii, +5 wypalenia.', action: 'resource', money: 80, energy: -6, burnout: 5 },
  { id: 'S28', text: 'Rekomendacja w social media: +5 prestiżu.', action: 'resource', prestige: 5 },
  { id: 'S29', text: 'Koleżeńska krytyka podejścia: -3 prestiżu, -3 energii.', action: 'resource', prestige: -3, energy: -3 },
  { id: 'S30', text: 'Własny rozwój osobisty: -80 zł, +8 energii, +5 etyki.', action: 'resource', money: -80, energy: 8, ethics: 5 },
  { id: 'S31', text: 'Pacjent wraca z poprawą: +6 prestiżu, +4 energii.', action: 'resource', prestige: 6, energy: 4 },
  { id: 'S32', text: 'Zmęczenie materiału: -8 energii, +5 wypalenia.', action: 'resource', energy: -8, burnout: 5 },
];

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const AVAILABLE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#f1c40f', '#1abc9c', '#ffffff'];
const PAWN_IDS = ['brain', 'lamp', 'rocket', 'star', 'puzzle', 'book'];
const JAIL_POSITION = 14;
const MAX_JAIL_TURNS = 3;
const MAX_LOG_ENTRIES = 80;
const DEFAULT_MODE_KEY = 'standard';
const STARTING_PRESTIGE = 10;
const STARTING_ENERGY = 50;
const STARTING_ETHICS = 50;
const CRITICAL_BURNOUT = 100;
const GAME_MODE_PRESETS = {
  szybka: {
    key: 'szybka',
    label: 'Szybka',
    description: 'Krótka partia z dynamiczną ekonomią i częstszymi zwrotami kart.',
    maxRounds: 8,
    startingMoney: 1200,
    goMoney: 160,
    jailFine: 80,
    developmentCostMultiplier: 0.8,
    penaltyMultiplier: 1.2,
    cardMoneyMultiplier: 1.15,
    cardIntensity: 1.2,
  },
  standard: {
    key: 'standard',
    label: 'Standard',
    description: 'Zbalansowany przebieg gry z klasycznym tempem i ekonomią.',
    maxRounds: 12,
    startingMoney: 1500,
    goMoney: 200,
    jailFine: 60,
    developmentCostMultiplier: 0.95,
    penaltyMultiplier: 1,
    cardMoneyMultiplier: 1,
    cardIntensity: 1,
  },
  ekspercka: {
    key: 'ekspercka',
    label: 'Ekspercka',
    description: 'Dłuższa i bardziej wymagająca partia z droższym rozwojem.',
    maxRounds: 16,
    startingMoney: 1750,
    goMoney: 180,
    jailFine: 100,
    developmentCostMultiplier: 1.15,
    penaltyMultiplier: 1.1,
    cardMoneyMultiplier: 0.9,
    cardIntensity: 0.85,
  },
};

function sanitizeModeKey(modeKey) {
  if (modeKey === 'strategiczna') return 'ekspercka';
  return GAME_MODE_PRESETS[modeKey] ? modeKey : DEFAULT_MODE_KEY;
}

function getModePreset(modeKey) {
  return GAME_MODE_PRESETS[sanitizeModeKey(modeKey)] || GAME_MODE_PRESETS[DEFAULT_MODE_KEY];
}

function withCardMoneyMultiplier(card, multiplier) {
  if (multiplier === 1) return card;
  const next = { ...card };
  if (next.action === 'resource') {
    if (typeof next.money === 'number') next.money = Math.round(next.money * multiplier);
  }
  return next;
}

function sanitizePlayerProfile({ playerName, color, pawn }, fallbackIndex = 0) {
  const name = String(playerName || '').trim().slice(0, 20);
  const safeColor = AVAILABLE_COLORS.includes(color) ? color : PLAYER_COLORS[fallbackIndex % PLAYER_COLORS.length];
  const safePawn = PAWN_IDS.includes(pawn) ? pawn : PAWN_IDS[fallbackIndex % PAWN_IDS.length];
  return { name, color: safeColor, pawn: safePawn };
}

function createServerGameState(playerConfigs, modeKey = DEFAULT_MODE_KEY) {
  const mode = getModePreset(modeKey);
  const boardSpaces = BOARD_SPACES_SERVER.map((space) => {
    const next = { ...space };
    if (next.type === 'property') {
      next.houseCost = Math.round(next.houseCost * mode.developmentCostMultiplier);
      next.hotelCost = Math.round(next.hotelCost * mode.developmentCostMultiplier);
    }
    if (next.type === 'tax' && typeof next.amount === 'number') {
      next.amount = Math.round(next.amount * mode.penaltyMultiplier);
    }
    return next;
  });
  const insightCards = INSIGHT_CARDS_SERVER.map((card) => withCardMoneyMultiplier(card, mode.cardMoneyMultiplier));
  const sessionCards = SESSION_CARDS_SERVER.map((card) => withCardMoneyMultiplier(card, mode.cardMoneyMultiplier));
  return {
    matchProfileKey: mode.key,
    matchProfileLabel: mode.label,
    maxRounds: mode.maxRounds,
    roundsCompleted: 0,
    goMoney: mode.goMoney,
    jailFine: mode.jailFine,
    boardSpaces,
    players: playerConfigs.map((p, i) => ({
      id: i,
      name: p.name,
      color: p.color || PLAYER_COLORS[i],
      pawn: p.pawn || PAWN_IDS[i % PAWN_IDS.length],
      money: mode.startingMoney,
      prestige: STARTING_PRESTIGE,
      energy: STARTING_ENERGY,
      ethics: STARTING_ETHICS,
      burnout: 0,
      supervisionShield: 0,
      position: 0,
      inJail: false,
      jailTurns: 0,
      properties: [],
      getOutOfJailCards: 0,
      bankrupt: false,
      disconnected: false,
    })),
    properties: {},
    currentPlayerIndex: 0,
    phase: 'rolling',
    dice: [0, 0],
    doubles: 0,
    turn: 0,
    insightCards: shuffleArray([...insightCards]),
    sessionCards: shuffleArray([...sessionCards]),
    insightDiscard: [],
    sessionDiscard: [],
    log: [],
    winner: null,
    pendingCard: null,
    pendingBuy: null,
    rolledThisTurn: false,
  };
}

function sanitizeState(gs) {
  // Deep clone so we don't accidentally mutate
  return JSON.parse(JSON.stringify(gs));
}

function addLog(gs, msg) {
  gs.log.unshift({ text: msg, turn: gs.turn, ts: Date.now() });
  if (gs.log.length > MAX_LOG_ENTRIES) gs.log.pop();
}

function clampStat(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

function applyPlayerDelta(gs, player, delta, reason) {
  if (!player || player.bankrupt) return;
  if (typeof delta.money === 'number') player.money += delta.money;
  if (typeof delta.prestige === 'number') player.prestige = clampStat(player.prestige + delta.prestige);
  if (typeof delta.energy === 'number') player.energy = clampStat(player.energy + delta.energy);
  if (typeof delta.ethics === 'number') player.ethics = clampStat(player.ethics + delta.ethics);
  if (typeof delta.burnout === 'number') player.burnout = clampStat(player.burnout + delta.burnout);
  if (typeof delta.supervision === 'number') player.supervisionShield = (player.supervisionShield || 0) + delta.supervision;
}

function processAction(gs, playerId, type, data) {
  const player = gs.players[playerId];
  if (!player || player.bankrupt) return;

  switch (type) {
    case 'roll':       handleRoll(gs, player);      break;
    case 'buy':        handleBuy(gs, player);        break;
    case 'pass-buy':   handlePassBuy(gs, player);    break;
    case 'card-ok':    handleCardOk(gs, player);     break;
    case 'end-turn':   handleEndTurn(gs);            break;
    case 'pay-jail':   handlePayJail(gs, player);    break;
    case 'use-jail-card': handleUseJailCard(gs, player); break;
    case 'build-house':handleBuildHouse(gs, player, data.spaceId); break;
    case 'sell-house': handleSellHouse(gs, player, data.spaceId);  break;
    case 'mortgage':   handleMortgage(gs, player, data.spaceId);   break;
    case 'unmortgage': handleUnmortgage(gs, player, data.spaceId); break;
  }
}

function handleRoll(gs, player) {
  if (gs.phase !== 'rolling') return;
  if (gs.rolledThisTurn && gs.doubles === 0) return;

  const d1 = rollDie();
  const d2 = rollDie();
  gs.dice = [d1, d2];
  gs.rolledThisTurn = true;
  const isDoubles = d1 === d2;

  addLog(gs, `${player.name} rzucił ${d1} i ${d2}${isDoubles ? ' (dublet!)' : ''}.`);

  if (player.inJail) {
    if (isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      addLog(gs, `${player.name} rzucił dublet i wyszedł z Izolacji!`);
      doMove(gs, player, d1 + d2);
    } else {
      player.jailTurns++;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        player.money -= gs.jailFine;
        player.inJail = false;
        player.jailTurns = 0;
        addLog(gs, `${player.name} zapłacił karę ${gs.jailFine} zł i wyszedł z Izolacji.`);
        checkBankruptcy(gs, player, null);
        doMove(gs, player, d1 + d2);
      } else {
        addLog(gs, `${player.name} zostaje w Izolacji (tura ${player.jailTurns}/${MAX_JAIL_TURNS}).`);
        gs.phase = 'end-turn';
      }
    }
    return;
  }

  if (isDoubles) {
    gs.doubles++;
    if (gs.doubles >= 3) {
      sendToJail(gs, player);
      gs.doubles = 0;
      gs.phase = 'end-turn';
      return;
    }
  } else {
    gs.doubles = 0;
  }

  doMove(gs, player, d1 + d2);
}

function doMove(gs, player, steps) {
  const oldPos = player.position;
  const newPos = (player.position + steps) % 40;
  if (oldPos + steps >= 40) { // wrapped around GO
    applyPlayerDelta(gs, player, { money: gs.goMoney, prestige: 2, energy: 1 }, 'START');
    addLog(gs, `${player.name} przeszedł przez START — bonus miesięczny (+${gs.goMoney} zł, +2 prestiżu, +1 energii).`);
  }
  player.position = newPos;
  addLog(gs, `${player.name} wylądował na polu ${newPos} (${gs.boardSpaces[newPos] ? gs.boardSpaces[newPos].type : ''}).`);
  handleLanding(gs, player);
}

function handleLanding(gs, player) {
  const space = gs.boardSpaces[player.position];
  if (!space) { gs.phase = 'end-turn'; return; }

  switch (space.type) {
    case 'go':
      gs.phase = 'end-turn';
      break;
    case 'property':
    case 'railroad':
    case 'utility':
      handlePropertyLanding(gs, player, space);
      break;
    case 'tax':
      if (space.id === 39) {
        // Space 39: Kosztowna terapia własna — money loss but energy/ethics recovery
        applyPlayerDelta(gs, player, { money: -space.amount, energy: 10, ethics: 8, burnout: -8 }, 'terapia własna');
        addLog(gs, `${player.name} inwestuje w regenerację: -${space.amount} zł, ale odzyskuje zasoby.`);
      } else {
        applyPlayerDelta(gs, player, { money: -space.amount, energy: -2 }, 'koszt systemowy');
        addLog(gs, `${player.name} zapłacił koszt systemowy: ${space.amount} zł.`);
      }
      checkBankruptcy(gs, player, null);
      gs.phase = 'end-turn';
      break;
    case 'card':
      doDrawCard(gs, player, space.deck);
      break;
    case 'jail':
      addLog(gs, `${player.name} ma przystanek w Izolacji.`);
      gs.phase = 'end-turn';
      break;
    case 'gotojail':
      sendToJail(gs, player);
      gs.phase = 'end-turn';
      break;
    default:
      gs.phase = 'end-turn';
  }
}

function handlePropertyLanding(gs, player, space) {
  const propState = gs.properties[space.id];
  if (!propState) {
    if (player.money >= space.price) {
      gs.phase = 'buying';
      gs.pendingBuy = { spaceId: space.id };
    } else {
      addLog(gs, `${player.name} nie może kupić tej własności (brak środków).`);
      gs.phase = 'end-turn';
    }
  } else if (propState.owner === player.id) {
    addLog(gs, `${player.name} wylądował na swojej własności.`);
    applyPlayerDelta(gs, player, { burnout: -1 }, 'spokojniejsza tura');
    gs.phase = 'end-turn';
  } else if (propState.mortgaged) {
    addLog(gs, `Własność jest zastawiona — brak czynszu.`);
    gs.phase = 'end-turn';
  } else {
    const owner = gs.players[propState.owner];
    if (owner && !owner.bankrupt) {
      const rent = calculateRent(gs, space, propState);
      applyPlayerDelta(gs, player, { money: -rent, energy: -4, burnout: 3 }, 'czynsz i obciążenie');
      applyPlayerDelta(gs, owner, { money: rent, prestige: 1, energy: -1 }, 'obsługa kolejnego klienta');
      addLog(gs, `${player.name} zapłacił ${rent} zł czynszu graczowi ${owner.name}.`);
      checkBankruptcy(gs, player, propState.owner);
    }
    gs.phase = 'end-turn';
  }
}

function calculateRent(gs, space, propState) {
  if (space.type === 'railroad') {
    const owned = gs.boardSpaces
      .filter(s => s.type === 'railroad' && gs.properties[s.id] && gs.properties[s.id].owner === propState.owner)
      .length;
    return 25 * Math.pow(2, owned - 1);
  }
  if (space.type === 'utility') {
    const owned = gs.boardSpaces
      .filter(s => s.type === 'utility' && gs.properties[s.id] && gs.properties[s.id].owner === propState.owner)
      .length;
    const diceTotal = gs.dice[0] + gs.dice[1];
    return diceTotal * (owned >= 2 ? 10 : 4);
  }
  if (propState.hotel) return space.rent[5];
  if (propState.houses > 0) return space.rent[Math.min(propState.houses, 4)];
  const groupProps = gs.boardSpaces.filter(s => s.type === 'property' && s.group === space.group);
  const ownsAll = groupProps.every(s => gs.properties[s.id] && gs.properties[s.id].owner === propState.owner);
  return ownsAll ? space.rent[0] * 2 : space.rent[0];
}

function doDrawCard(gs, player, deck) {
  let card;
  if (deck === 'insight') {
    if (gs.insightCards.length === 0) {
      gs.insightCards = shuffleArray([...gs.insightDiscard]);
      gs.insightDiscard = [];
    }
    card = gs.insightCards.pop();
    gs.insightDiscard.push(card);
  } else {
    if (gs.sessionCards.length === 0) {
      gs.sessionCards = shuffleArray([...gs.sessionDiscard]);
      gs.sessionDiscard = [];
    }
    card = gs.sessionCards.pop();
    gs.sessionDiscard.push(card);
  }
  addLog(gs, `${player.name} ciągnie kartę ${deck === 'insight' ? 'Szansy' : 'Społeczności'}.`);
  gs.pendingCard = { card, playerId: player.id, deck };
  gs.phase = 'card';
}

function handleCardOk(gs, player) {
  if (gs.phase !== 'card' || !gs.pendingCard) return;
  const card = gs.pendingCard.card;
  gs.pendingCard = null;
  applyCard(gs, player, card);
}

function applyCard(gs, player, card) {
  switch (card.action) {
    case 'resource':
      applyPlayerDelta(gs, player, {
        money: card.money || 0,
        prestige: card.prestige || 0,
        energy: card.energy || 0,
        ethics: card.ethics || 0,
        burnout: card.burnout || 0,
        supervision: card.supervision || 0,
      }, 'karta');
      if (card.ethicsIfNoShield && (player.supervisionShield || 0) <= 0) {
        applyPlayerDelta(gs, player, { ethics: card.ethicsIfNoShield }, 'brak superwizji');
      }
      checkBankruptcy(gs, player, null);
      break;
    case 'choice-course':
      if (player.money >= 300) {
        applyPlayerDelta(gs, player, { money: -300, prestige: 10, energy: -2 }, 'kurs');
      } else {
        applyPlayerDelta(gs, player, { prestige: -2 }, 'odrzucony kurs');
      }
      break;
    case 'choice-trend':
      if (player.ethics >= 35) {
        applyPlayerDelta(gs, player, { prestige: 8, ethics: -4 }, 'trend terapeutyczny');
      }
      break;
    default:
      break;
  }
  gs.phase = 'end-turn';
}

function handleBuy(gs, player) {
  if (gs.phase !== 'buying' || !gs.pendingBuy) return;
  const { spaceId } = gs.pendingBuy;
  const space = gs.boardSpaces[spaceId];
  if (!space || player.money < space.price) return;

  applyPlayerDelta(gs, player, { money: -space.price, prestige: 2, energy: -3, burnout: 2 }, 'zakup aktywa');
  gs.properties[spaceId] = { owner: player.id, houses: 0, hotel: false, mortgaged: false };
  player.properties.push(spaceId);
  addLog(gs, `${player.name} kupił pole ${spaceId} za ${space.price} zł.`);
  gs.pendingBuy = null;
  gs.phase = 'end-turn';
}

function handlePassBuy(gs, player) {
  if (gs.phase !== 'buying') return;
  addLog(gs, `${player.name} zrezygnował z zakupu.`);
  gs.pendingBuy = null;
  gs.phase = 'end-turn';
}

function handlePayJail(gs, player) {
  if (!player.inJail) return;
  player.money -= gs.jailFine;
  player.inJail = false;
  player.jailTurns = 0;
  addLog(gs, `${player.name} zapłacił ${gs.jailFine} zł i wyszedł z Izolacji.`);
  checkBankruptcy(gs, player, null);
  gs.phase = 'rolling';
}

function handleUseJailCard(gs, player) {
  if (!player.inJail || player.getOutOfJailCards <= 0) return;
  player.getOutOfJailCards--;
  player.inJail = false;
  player.jailTurns = 0;
  addLog(gs, `${player.name} użył karty "Wyjdź z Izolacji za darmo".`);
  gs.phase = 'rolling';
}

function getPrestigeScore(player) {
  // Psychopolonia final score: money is the base, prestige and ethics reflect long-term reputation,
  // energy reflects sustainable practice, burnout is a penalty for overexertion.
  return player.money + (player.prestige || 0) * 12 + (player.energy || 0) * 8 + (player.ethics || 0) * 8 - (player.burnout || 0) * 10;
}

function handleEndTurn(gs) {
  if (gs.phase !== 'end-turn') return;
  const cur = gs.players[gs.currentPlayerIndex];

  if (gs.doubles > 0 && !cur.inJail) {
    gs.phase = 'rolling';
    gs.rolledThisTurn = false;
    return;
  }

  let next = (gs.currentPlayerIndex + 1) % gs.players.length;
  let loops = 0;
  while (gs.players[next].bankrupt && loops < gs.players.length) {
    next = (next + 1) % gs.players.length;
    loops++;
  }
  gs.currentPlayerIndex = next;
  if (next === 0) gs.roundsCompleted++;
  gs.doubles = 0;
  gs.turn++;
  gs.phase = 'rolling';
  gs.rolledThisTurn = false;

  const active = gs.players.filter(p => !p.bankrupt);
  if (active.length <= 1) {
    gs.winner = active[0] ? active[0].id : null;
    gs.phase = 'end';
    if (active[0]) addLog(gs, `🏆 ${active[0].name} wygrał grę!`);
    return;
  }
  if (gs.roundsCompleted >= (gs.maxRounds || 12)) {
    const sorted = [...active].sort((a, b) => getPrestigeScore(b) - getPrestigeScore(a));
    gs.winner = sorted[0].id;
    gs.phase = 'end';
    addLog(gs, `🏁 Koniec ${gs.maxRounds} rund. Wygrywa ${sorted[0].name}.`);
    return;
  }
  addLog(gs, `--- Tura gracza ${gs.players[next].name} ---`);
}

function handleBuildHouse(gs, player, spaceId) {
  const space = gs.boardSpaces[spaceId];
  if (!space || space.type !== 'property') return;
  const propState = gs.properties[spaceId];
  if (!propState || propState.owner !== player.id || propState.mortgaged) return;

  const groupProps = gs.boardSpaces.filter(s => s.type === 'property' && s.group === space.group);
  const ownsAll = groupProps.every(s => gs.properties[s.id] && gs.properties[s.id].owner === player.id);
  if (!ownsAll) return;

  if (propState.hotel) return;
  if (propState.houses >= 4) {
    // Upgrade to hotel
    if (player.money < space.hotelCost) return;
    player.money -= space.hotelCost;
    propState.houses = 0;
    propState.hotel = true;
    addLog(gs, `${player.name} zbudował hotel na polu ${spaceId}.`);
  } else {
    if (player.money < space.houseCost) return;
    // Even building check
    const minH = Math.min(...groupProps.map(s => gs.properties[s.id] ? (gs.properties[s.id].houses || 0) : 0));
    if ((propState.houses || 0) > minH) return;
    player.money -= space.houseCost;
    propState.houses = (propState.houses || 0) + 1;
    addLog(gs, `${player.name} zbudował dom na polu ${spaceId} (${propState.houses} domów).`);
  }
}

function handleSellHouse(gs, player, spaceId) {
  const space = gs.boardSpaces[spaceId];
  if (!space) return;
  const propState = gs.properties[spaceId];
  if (!propState || propState.owner !== player.id) return;

  const sellPrice = propState.hotel ? Math.floor(space.hotelCost / 2) : Math.floor(space.houseCost / 2);
  if (propState.hotel) {
    propState.hotel = false;
    propState.houses = 4;
    player.money += sellPrice;
    addLog(gs, `${player.name} sprzedał hotel na polu ${spaceId} za ${sellPrice} zł.`);
  } else if (propState.houses > 0) {
    propState.houses--;
    player.money += sellPrice;
    addLog(gs, `${player.name} sprzedał dom na polu ${spaceId} za ${sellPrice} zł.`);
  }
}

function handleMortgage(gs, player, spaceId) {
  const space = gs.boardSpaces[spaceId];
  if (!space) return;
  const propState = gs.properties[spaceId];
  if (!propState || propState.owner !== player.id || propState.mortgaged) return;
  if (propState.houses > 0 || propState.hotel) return;

  player.money += space.mortgage;
  propState.mortgaged = true;
  addLog(gs, `${player.name} zastawił pole ${spaceId} za ${space.mortgage} zł.`);
}

function handleUnmortgage(gs, player, spaceId) {
  const space = gs.boardSpaces[spaceId];
  if (!space) return;
  const propState = gs.properties[spaceId];
  if (!propState || propState.owner !== player.id || !propState.mortgaged) return;
  const cost = Math.floor(space.mortgage * 1.1);
  if (player.money < cost) return;

  player.money -= cost;
  propState.mortgaged = false;
  addLog(gs, `${player.name} odkupił pole ${spaceId} za ${cost} zł.`);
}

function sendToJail(gs, player) {
  player.position = JAIL_POSITION;
  player.inJail = true;
  player.jailTurns = 0;
  applyPlayerDelta(gs, player, { energy: -10, burnout: 10, prestige: -4 }, 'kryzys zawodowy');
  addLog(gs, `${player.name} trafia do Izolacji!`);
}

function checkVitalStatus(gs, player) {
  if (!player || player.bankrupt) return;
  if (player.energy > 0 && player.ethics > 0 && player.burnout < CRITICAL_BURNOUT) return;
  player.bankrupt = true;
  if (player.energy <= 0) addLog(gs, `💥 ${player.name} odpada: energia spadła do zera.`);
  else if (player.ethics <= 0) addLog(gs, `⚠️ ${player.name} odpada: etyka spadła do zera.`);
  else addLog(gs, `🔥 ${player.name} odpada: krytyczne wypalenie.`);
  player.properties.forEach(spaceId => { delete gs.properties[spaceId]; });
  player.properties = [];
  player.money = 0;
  const active = gs.players.filter(p => !p.bankrupt);
  if (active.length === 1) {
    gs.winner = active[0].id;
    gs.phase = 'end';
    addLog(gs, `🏆 ${active[0].name} wygrał grę!`);
  }
}

function checkBankruptcy(gs, player, creditorId) {
  checkVitalStatus(gs, player);
  if (player.bankrupt) return;
  if (player.money >= 0) return;
  // Try to raise funds by selling houses first (simple auto-liquidation)
  player.properties.forEach(spaceId => {
    const space = gs.boardSpaces[spaceId];
    const ps = gs.properties[spaceId];
    if (!ps || !space) return;
    while ((ps.houses > 0 || ps.hotel) && player.money < 0) {
      const sell = Math.floor(space.houseCost / 2);
      if (ps.hotel) { ps.hotel = false; ps.houses = 4; }
      else if (ps.houses > 0) { ps.houses--; }
      player.money += sell;
    }
    if (player.money < 0 && !ps.mortgaged && ps.houses === 0 && !ps.hotel) {
      player.money += space.mortgage;
      ps.mortgaged = true;
    }
  });

  if (player.money >= 0) return;

  // Truly bankrupt
  player.bankrupt = true;
  addLog(gs, `💀 ${player.name} zbankrutował!`);

  if (creditorId !== null && gs.players[creditorId] && !gs.players[creditorId].bankrupt) {
    const creditor = gs.players[creditorId];
    player.properties.forEach(spaceId => {
      if (gs.properties[spaceId]) {
        gs.properties[spaceId].owner = creditorId;
        gs.properties[spaceId].mortgaged = false;
        if (!creditor.properties.includes(spaceId)) creditor.properties.push(spaceId);
      }
    });
  } else {
    player.properties.forEach(spaceId => {
      delete gs.properties[spaceId];
    });
  }
  player.properties = [];
  player.money = 0;

  const active = gs.players.filter(p => !p.bankrupt);
  if (active.length === 1) {
    gs.winner = active[0].id;
    gs.phase = 'end';
    addLog(gs, `🏆 ${active[0].name} wygrał grę!`);
  }
}

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Psychopoly server running on http://localhost:${PORT}`);
});
