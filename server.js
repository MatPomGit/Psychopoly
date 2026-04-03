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
  { id: 1,  type: 'property',  group: 'purple',    price: 60,  rent: [2,10,30,90,160,250],       houseCost: 50,  hotelCost: 50,  mortgage: 30 },
  { id: 2,  type: 'card',      deck: 'session'  },
  { id: 3,  type: 'property',  group: 'purple',    price: 60,  rent: [4,20,60,180,320,450],       houseCost: 50,  hotelCost: 50,  mortgage: 30 },
  { id: 4,  type: 'tax',       amount: 200      },
  { id: 5,  type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 6,  type: 'property',  group: 'lightblue', price: 100, rent: [6,30,90,270,400,550],       houseCost: 50,  hotelCost: 50,  mortgage: 50 },
  { id: 7,  type: 'card',      deck: 'insight'  },
  { id: 8,  type: 'property',  group: 'lightblue', price: 100, rent: [6,30,90,270,400,550],       houseCost: 50,  hotelCost: 50,  mortgage: 50 },
  { id: 9,  type: 'property',  group: 'lightblue', price: 120, rent: [8,40,100,300,450,600],      houseCost: 50,  hotelCost: 50,  mortgage: 60 },
  { id: 10, type: 'jail'       },
  { id: 11, type: 'property',  group: 'pink',      price: 140, rent: [10,50,150,450,625,750],     houseCost: 100, hotelCost: 100, mortgage: 70 },
  { id: 12, type: 'utility',   price: 150,  mortgage: 75  },
  { id: 13, type: 'property',  group: 'pink',      price: 140, rent: [10,50,150,450,625,750],     houseCost: 100, hotelCost: 100, mortgage: 70 },
  { id: 14, type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 15, type: 'property',  group: 'pink',      price: 160, rent: [12,60,180,500,700,900],     houseCost: 100, hotelCost: 100, mortgage: 80 },
  { id: 16, type: 'card',      deck: 'session'  },
  { id: 17, type: 'property',  group: 'orange',    price: 180, rent: [14,70,200,550,750,950],     houseCost: 100, hotelCost: 100, mortgage: 90 },
  { id: 18, type: 'utility',   price: 150,  mortgage: 75  },
  { id: 19, type: 'property',  group: 'orange',    price: 200, rent: [16,80,220,600,800,1000],    houseCost: 100, hotelCost: 100, mortgage: 100 },
  { id: 20, type: 'freeparking' },
  { id: 21, type: 'property',  group: 'red',       price: 220, rent: [18,90,250,700,875,1050],    houseCost: 150, hotelCost: 150, mortgage: 110 },
  { id: 22, type: 'card',      deck: 'insight'  },
  { id: 23, type: 'property',  group: 'red',       price: 220, rent: [18,90,250,700,875,1050],    houseCost: 150, hotelCost: 150, mortgage: 110 },
  { id: 24, type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 25, type: 'property',  group: 'yellow',    price: 260, rent: [22,110,330,800,975,1150],   houseCost: 150, hotelCost: 150, mortgage: 130 },
  { id: 26, type: 'property',  group: 'yellow',    price: 260, rent: [22,110,330,800,975,1150],   houseCost: 150, hotelCost: 150, mortgage: 130 },
  { id: 27, type: 'card',      deck: 'session'  },
  { id: 28, type: 'property',  group: 'yellow',    price: 280, rent: [24,120,360,850,1025,1200],  houseCost: 150, hotelCost: 150, mortgage: 140 },
  { id: 29, type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 30, type: 'gotojail'  },
  { id: 31, type: 'property',  group: 'green',     price: 300, rent: [26,130,390,900,1100,1275],  houseCost: 200, hotelCost: 200, mortgage: 150 },
  { id: 32, type: 'property',  group: 'green',     price: 300, rent: [26,130,390,900,1100,1275],  houseCost: 200, hotelCost: 200, mortgage: 150 },
  { id: 33, type: 'card',      deck: 'insight'  },
  { id: 34, type: 'tax',       amount: 100      },
  { id: 35, type: 'railroad',  price: 200,  mortgage: 100 },
  { id: 36, type: 'property',  group: 'darkblue',  price: 350, rent: [35,175,500,1100,1300,1500], houseCost: 200, hotelCost: 200, mortgage: 175 },
  { id: 37, type: 'card',      deck: 'session'  },
  { id: 38, type: 'property',  group: 'darkblue',  price: 400, rent: [50,200,600,1400,1700,2000], houseCost: 200, hotelCost: 200, mortgage: 200 },
  { id: 39, type: 'property',  group: 'darkblue',  price: 400, rent: [50,200,600,1400,1700,2000], houseCost: 200, hotelCost: 200, mortgage: 200 },
];

const INSIGHT_CARDS_SERVER = [
  { id: 'I1',  action: 'advance-to-go' },
  { id: 'I2',  action: 'collect',          amount: 150 },
  { id: 'I3',  action: 'pay',              amount: 50  },
  { id: 'I4',  action: 'move-forward',     steps: 3   },
  { id: 'I5',  action: 'get-out-jail',     keep: true  },
  { id: 'I6',  action: 'move-back',        steps: 3   },
  { id: 'I7',  action: 'collect',          amount: 100 },
  { id: 'I8',  action: 'go-to-jail'                    },
  { id: 'I9',  action: 'collect',          amount: 150 },
  { id: 'I10', action: 'pay-per-building', perHouse: 50, perHotel: 115 },
  { id: 'I11', action: 'collect',          amount: 100 },
  { id: 'I12', action: 'advance-to',       target: 1  },
  { id: 'I13', action: 'collect',          amount: 50  },
  { id: 'I14', action: 'pay',              amount: 150 },
  { id: 'I15', action: 'advance-to',       target: 5  },
  { id: 'I16', action: 'collect-from-each',amount: 20  },
  { id: 'I17', action: 'collect',          amount: 200 },
  { id: 'I18', action: 'pay',              amount: 100 },
  { id: 'I19', action: 'move-forward',     steps: 2    },
  { id: 'I20', action: 'collect',          amount: 50  },
  { id: 'I21', action: 'go-to-jail'                    },
  { id: 'I22', action: 'collect',          amount: 75  },
  { id: 'I23', action: 'advance-to',       target: 14  },
  { id: 'I24', action: 'pay',              amount: 200 },
  { id: 'I25', action: 'collect',          amount: 100 },
  { id: 'I26', action: 'move-back',        steps: 2    },
  { id: 'I27', action: 'pay-per-building', perHouse: 40, perHotel: 115 },
  { id: 'I28', action: 'collect-from-each',amount: 25  },
  { id: 'I29', action: 'advance-to',       target: 24  },
  { id: 'I30', action: 'pay',              amount: 75  },
  { id: 'I31', action: 'collect',          amount: 125 },
  { id: 'I32', action: 'move-forward',     steps: 4    },
];

const SESSION_CARDS_SERVER = [
  { id: 'S1',  action: 'collect',          amount: 200 },
  { id: 'S2',  action: 'pay',              amount: 50  },
  { id: 'S3',  action: 'collect',          amount: 100 },
  { id: 'S4',  action: 'pay',              amount: 50  },
  { id: 'S5',  action: 'collect',          amount: 100 },
  { id: 'S6',  action: 'advance-to-go'                 },
  { id: 'S7',  action: 'get-out-jail',     keep: true  },
  { id: 'S8',  action: 'pay',              amount: 100 },
  { id: 'S9',  action: 'collect-from-each',amount: 50  },
  { id: 'S10', action: 'pay-per-building', perHouse: 25, perHotel: 100 },
  { id: 'S11', action: 'collect',          amount: 50  },
  { id: 'S12', action: 'pay',              amount: 150 },
  { id: 'S13', action: 'collect',          amount: 100 },
  { id: 'S14', action: 'collect',          amount: 150 },
  { id: 'S15', action: 'pay',              amount: 100 },
  { id: 'S16', action: 'pay',              amount: 50  },
  { id: 'S17', action: 'collect',          amount: 75  },
  { id: 'S18', action: 'pay',              amount: 75  },
  { id: 'S19', action: 'collect-from-each',amount: 30  },
  { id: 'S20', action: 'advance-to',       target: 18  },
  { id: 'S21', action: 'pay',              amount: 200 },
  { id: 'S22', action: 'collect',          amount: 50  },
  { id: 'S23', action: 'go-to-jail'                    },
  { id: 'S24', action: 'move-forward',     steps: 3    },
  { id: 'S25', action: 'pay-per-building', perHouse: 40, perHotel: 115 },
  { id: 'S26', action: 'collect',          amount: 100 },
  { id: 'S27', action: 'advance-to',       target: 35  },
  { id: 'S28', action: 'pay',              amount: 100 },
  { id: 'S29', action: 'move-back',        steps: 2    },
  { id: 'S30', action: 'collect',          amount: 150 },
  { id: 'S31', action: 'pay',              amount: 50  },
  { id: 'S32', action: 'collect',          amount: 200 },
];

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const AVAILABLE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#f1c40f', '#1abc9c', '#ffffff'];
const PAWN_IDS = ['brain', 'lamp', 'rocket', 'star', 'puzzle', 'book'];
const JAIL_POSITION = 10;
const MAX_JAIL_TURNS = 3;
const DEFAULT_MODE_KEY = 'standard';
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
  const next = { ...card };
  ['amount', 'perHouse', 'perHotel'].forEach((field) => {
    if (typeof next[field] === 'number') next[field] = Math.round(next[field] * multiplier);
  });
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
  gs.log.unshift({ text: msg, turn: gs.turn });
  if (gs.log.length > 60) gs.log.pop();
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
  if (newPos < oldPos) { // wrapped around GO
    player.money += gs.goMoney;
    addLog(gs, `${player.name} przeszedł przez START i otrzymał ${gs.goMoney} zł.`);
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
      player.money -= space.amount;
      addLog(gs, `${player.name} zapłacił podatek ${space.amount} zł.`);
      checkBankruptcy(gs, player, null);
      gs.phase = 'end-turn';
      break;
    case 'card':
      doDrawCard(gs, player, space.deck);
      break;
    case 'jail':
      gs.phase = 'end-turn';
      break;
    case 'gotojail':
      sendToJail(gs, player);
      gs.phase = 'end-turn';
      break;
    case 'freeparking':
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
      addLog(gs, `${player.name} nie może kupić tej własności.`);
      gs.phase = 'end-turn';
    }
  } else if (propState.owner === player.id) {
    addLog(gs, `${player.name} wylądował na swojej własności.`);
    gs.phase = 'end-turn';
  } else if (propState.mortgaged) {
    addLog(gs, `Własność jest zastawiona.`);
    gs.phase = 'end-turn';
  } else {
    const owner = gs.players[propState.owner];
    if (owner && !owner.bankrupt) {
      const rent = calculateRent(gs, space, propState);
      player.money -= rent;
      owner.money += rent;
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
    if (card.action !== 'get-out-jail') gs.insightDiscard.push(card);
  } else {
    if (gs.sessionCards.length === 0) {
      gs.sessionCards = shuffleArray([...gs.sessionDiscard]);
      gs.sessionDiscard = [];
    }
    card = gs.sessionCards.pop();
    if (card.action !== 'get-out-jail') gs.sessionDiscard.push(card);
  }
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
    case 'collect':
      player.money += card.amount;
      break;
    case 'pay':
      player.money -= card.amount;
      checkBankruptcy(gs, player, null);
      break;
    case 'advance-to-go':
      player.position = 0;
      player.money += gs.goMoney;
      addLog(gs, `${player.name} idzie na START i otrzymuje ${gs.goMoney} zł.`);
      break;
    case 'advance-to':
      if (card.target < player.position) {
        player.money += gs.goMoney;
        addLog(gs, `${player.name} przeszedł przez START i otrzymał ${gs.goMoney} zł.`);
      }
      player.position = card.target;
      handleLanding(gs, player);
      return;
    case 'move-forward': {
      const newPos = (player.position + card.steps) % 40;
      if (newPos < player.position) {
        player.money += gs.goMoney;
        addLog(gs, `${player.name} przeszedł przez START i otrzymał ${gs.goMoney} zł.`);
      }
      player.position = newPos;
      handleLanding(gs, player);
      return;
    }
    case 'move-back':
      player.position = (player.position - card.steps + 40) % 40;
      handleLanding(gs, player);
      return;
    case 'go-to-jail':
      sendToJail(gs, player);
      break;
    case 'get-out-jail':
      player.getOutOfJailCards++;
      break;
    case 'collect-from-each':
      gs.players.forEach(p => {
        if (p.id !== player.id && !p.bankrupt) {
          const amt = Math.min(card.amount, Math.max(0, p.money));
          p.money -= amt;
          player.money += amt;
        }
      });
      break;
    case 'pay-per-building': {
      let total = 0;
      player.properties.forEach(spaceId => {
        const ps = gs.properties[spaceId];
        if (ps) {
          total += (ps.houses || 0) * card.perHouse;
          if (ps.hotel) total += card.perHotel;
        }
      });
      player.money -= total;
      checkBankruptcy(gs, player, null);
      break;
    }
  }
  gs.phase = 'end-turn';
}

function handleBuy(gs, player) {
  if (gs.phase !== 'buying' || !gs.pendingBuy) return;
  const { spaceId } = gs.pendingBuy;
  const space = gs.boardSpaces[spaceId];
  if (!space || player.money < space.price) return;

  player.money -= space.price;
  gs.properties[spaceId] = { owner: player.id, houses: 0, hotel: false, mortgaged: false };
  player.properties.push(spaceId);
  addLog(gs, `${player.name} kupił ${space.type} (pole ${spaceId}) za ${space.price} zł.`);
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
    const sorted = [...active].sort((a, b) => b.money - a.money);
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
  addLog(gs, `${player.name} trafia do Izolacji!`);
}

function checkBankruptcy(gs, player, creditorId) {
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
  addLog(gs, `${player.name} zbankrutował!`);

  if (creditorId !== null && gs.players[creditorId]) {
    const creditor = gs.players[creditorId];
    player.properties.forEach(spaceId => {
      gs.properties[spaceId].owner = creditorId;
      gs.properties[spaceId].mortgaged = false;
      creditor.properties.push(spaceId);
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
