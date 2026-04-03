/* ============================================================
   PSYCHOPOLY — game.js
   Handles both local (hot-seat) and online (Socket.io) modes.
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const PLAYER_COLORS    = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const AVAILABLE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#f1c40f', '#1abc9c', '#ffffff'];
const PAWN_OPTIONS = [
  { id: 'brain',  name: 'Mózg',      icon: 'assets/pawns/brain.svg' },
  { id: 'lamp',   name: 'Żarówka',   icon: 'assets/pawns/lamp.svg' },
  { id: 'rocket', name: 'Rakieta',   icon: 'assets/pawns/rocket.svg' },
  { id: 'star',   name: 'Gwiazda',   icon: 'assets/pawns/star.svg' },
  { id: 'puzzle', name: 'Puzzle',    icon: 'assets/pawns/puzzle.svg' },
  { id: 'book',   name: 'Książka',   icon: 'assets/pawns/book.svg' },
];
const STARTING_MONEY   = 1500;
const GO_MONEY         = 200;
const JAIL_POSITION    = 14;
const JAIL_FINE        = 50;
const MAX_JAIL_TURNS   = 3;
const STARTING_PRESTIGE = 10;
const STARTING_ENERGY = 50;
const STARTING_ETHICS = 50;
const CRITICAL_BURNOUT = 100;
const MAX_ROUNDS = 12;
const AI_CASH_BUFFER = 300;

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const PHASE_LABELS = {
  rolling:        'Rzuć kostkami',
  buying:         'Kup lub pomiń aktywo',
  card:           'Ciągniesz kartę…',
  'card-select':  'Kliknij odpowiedni stos kart na planszy',
  moving:         'Pionek się porusza…',
  'end-turn':     'Zakończ turę',
  jailed:         'Jesteś w stanie kryzysu',
  end:            'Koniec gry',
};
const PHASE_CHECKLIST_STEP = {
  rolling: 0,
  jailed: 0,
  moving: 1,
  buying: 2,
  card: 2,
  'card-select': 2,
  'end-turn': 3,
  end: 3,
};

// ============================================================
// MODULE-LEVEL STATE
// ============================================================
let gameMode     = null;   // 'local' | 'online'
let localGame    = null;   // full game state object (local mode)
let socket       = null;
let myPlayerId   = null;
let myPlayerName = '';
let myPlayerColor = PLAYER_COLORS[0];
let myPlayerPawn = PAWN_OPTIONS[0].id;
let currentRoomId = null;
let isHost        = false;
let boardRendered = false;
let localSelections = [];
const AUDIO_PREFS_KEY = 'psychopoly-audio-prefs-v1';
const SFX_PRESET_PATH = 'assets/sounds/sfx-presets.json';
const MUSIC_THEME_PATH = 'assets/music/music-theme.json';
const DEFAULT_SFX_PRESETS = {
  click:    [{ freq: 900, duration: 0.05, gain: 0.06, type: 'square' }],
  dice:     [{ freq: 260, duration: 0.08, gain: 0.07 }, { freq: 320, duration: 0.08, gain: 0.07, delay: 0.05 }, { freq: 390, duration: 0.12, gain: 0.06, delay: 0.1 }],
  move:     [{ freq: 520, duration: 0.08, gain: 0.05 }],
  buy:      [{ freq: 660, duration: 0.1, gain: 0.07 }, { freq: 880, duration: 0.12, gain: 0.07, delay: 0.08 }],
  rent:     [{ freq: 220, duration: 0.12, gain: 0.06 }, { freq: 170, duration: 0.14, gain: 0.06, delay: 0.09 }],
  card:     [{ freq: 500, duration: 0.08, gain: 0.06 }, { freq: 760, duration: 0.1, gain: 0.06, delay: 0.08 }],
  jail:     [{ freq: 145, duration: 0.2, gain: 0.07, type: 'sawtooth' }],
  build:    [{ freq: 440, duration: 0.07, gain: 0.06 }, { freq: 554, duration: 0.08, gain: 0.06, delay: 0.06 }, { freq: 659, duration: 0.11, gain: 0.06, delay: 0.12 }],
  sell:     [{ freq: 520, duration: 0.08, gain: 0.06 }, { freq: 390, duration: 0.1, gain: 0.06, delay: 0.07 }],
  mortgage: [{ freq: 320, duration: 0.09, gain: 0.06 }, { freq: 280, duration: 0.12, gain: 0.06, delay: 0.08 }],
  turn:     [{ freq: 700, duration: 0.06, gain: 0.06 }],
  bankrupt: [{ freq: 180, duration: 0.14, gain: 0.07, type: 'sawtooth' }, { freq: 120, duration: 0.18, gain: 0.07, delay: 0.12, type: 'sawtooth' }],
  win:      [{ freq: 523, duration: 0.08, gain: 0.07 }, { freq: 659, duration: 0.1, gain: 0.07, delay: 0.08 }, { freq: 784, duration: 0.2, gain: 0.07, delay: 0.16 }],
};
const DEFAULT_MUSIC_THEME = {
  loopMs: 3200,
  notes: [
    { freq: 220, duration: 0.28, gain: 0.03, delay: 0.0, type: 'triangle' },
    { freq: 277, duration: 0.28, gain: 0.03, delay: 0.35, type: 'triangle' },
    { freq: 330, duration: 0.28, gain: 0.03, delay: 0.7, type: 'triangle' },
    { freq: 392, duration: 0.28, gain: 0.03, delay: 1.05, type: 'triangle' },
    { freq: 440, duration: 0.28, gain: 0.03, delay: 1.4, type: 'triangle' },
    { freq: 392, duration: 0.28, gain: 0.03, delay: 1.75, type: 'triangle' },
    { freq: 330, duration: 0.28, gain: 0.03, delay: 2.1, type: 'triangle' },
    { freq: 277, duration: 0.28, gain: 0.03, delay: 2.45, type: 'triangle' },
  ],
};
let sfxEnabled = true;
let musicEnabled = true;
let audioReady = false;
let sfxPresets = DEFAULT_SFX_PRESETS;
let musicTheme = DEFAULT_MUSIC_THEME;
let audioContext = null;
let musicLoopIntervalId = null;
let masterGainNode = null;
let boardScale = 1;
let boardRotation = 0;
let boardPanX = 0;
let boardPanY = 0;
let isDraggingBoard = false;
let aiStepPending = false;
let dragStartX = 0;
let dragStartY = 0;
let movedPlayersLastUpdate = [];
let isAnimating = false;
let animatingPlayerData = null; // { playerId, animPos }
let gameSettings = { ...(window.PSYCHOPOLY_DEFAULT_CONFIG || {}) };

// Stat colors (matching CSS .stat-* classes)
const STAT_COLORS = {
  money:       '#f1c40f',
  prestige:    '#b39ddb',
  energy:      '#2ecc71',
  ethics:      '#5dade2',
  burnout:     '#e74c3c',
  supervision: '#1abc9c',
  props:       '#f39c12',
  cards:       '#a8e6cf',
};

// ============================================================
// UTILITIES
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

function showToast(msg, duration = 2800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function askPlayerChoice(message) {
  if (localGame && gameMode === 'local') {
    const cur = localGame.players[localGame.currentPlayerIndex];
    if (cur && cur.isAI) {
      return Math.random() < 0.5;
    }
  }
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return false;
}

function formatMoney(n) { return n + ' zł'; }
function clampStat(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }

function getPrestigeScore(player) {
  return player.money + (player.prestige * 12) + (player.energy * 8) + (player.ethics * 8) - (player.burnout * 10);
}

function applyPlayerDelta(gs, player, delta = {}, reason = '') {
  if (!player || player.bankrupt) return;
  const entries = [
    ['money', 'zł'],
    ['prestige', 'prestige'],
    ['energy', 'energia'],
    ['ethics', 'etyka'],
    ['burnout', 'wypalenie'],
  ];
  const summary = [];
  entries.forEach(([key, label]) => {
    const change = delta[key];
    if (!change) return;
    if (key === 'money') player.money += change;
    if (key === 'prestige') player.prestige = clampStat(player.prestige + change);
    if (key === 'energy') player.energy = clampStat(player.energy + change);
    if (key === 'ethics') player.ethics = clampStat(player.ethics + change);
    if (key === 'burnout') player.burnout = clampStat(player.burnout + change);
    summary.push(`${change > 0 ? '+' : ''}${change} ${label}`);
  });
  if (delta.supervision) player.supervisionShield += delta.supervision;
  if (summary.length) addLog(gs, `${player.name}: ${summary.join(', ')}${reason ? ` (${reason})` : ''}.`);
}

function addLog(gs, msg, isTurn = false) {
  gs.log.unshift({ text: msg, isTurn });
  if (gs.log.length > 80) gs.log.pop();
}

function getPawnIcon(pawnId) {
  const opt = PAWN_OPTIONS.find(p => p.id === pawnId);
  return opt ? opt.icon : PAWN_OPTIONS[0].icon;
}

function getInitial(name = '') {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function loadSettings() {
  const defaults = window.PSYCHOPOLY_DEFAULT_CONFIG || {};
  try {
    const raw = localStorage.getItem('psychopoly-settings');
    if (raw) gameSettings = { ...defaults, ...JSON.parse(raw) };
    else gameSettings = { ...defaults };
  } catch (_e) {
    gameSettings = { ...defaults };
  }
}

function saveSettings() {
  localStorage.setItem('psychopoly-settings', JSON.stringify(gameSettings));
}

function applySettings() {
  document.documentElement.style.setProperty('--ui-font-scale', gameSettings.fontScale || 1);
  document.documentElement.style.setProperty('--anim-speed-mult', gameSettings.animationSpeed || 1);
  document.documentElement.style.setProperty('--fx-intensity', gameSettings.boardFxIntensity || 1);
  document.body.classList.remove('quality-low', 'quality-medium', 'quality-high');
  document.body.classList.add(`quality-${gameSettings.renderQuality || 'high'}`);
}

function syncSettingsForm() {
  const anim = document.getElementById('setting-animation-speed');
  const font = document.getElementById('setting-font-scale');
  const quality = document.getElementById('setting-render-quality');
  const fx = document.getElementById('setting-fx-intensity');
  if (anim) anim.value = String(gameSettings.animationSpeed || 1);
  if (font) font.value = String(gameSettings.fontScale || 1);
  if (quality) quality.value = gameSettings.renderQuality || 'high';
  if (fx) fx.value = String(gameSettings.boardFxIntensity || 1);
  refreshSettingsLiveLabels();
}

function getRangeValueText(inputId, value) {
  const numeric = parseFloat(value);
  if (!Number.isFinite(numeric)) return value;
  if (inputId === 'setting-font-scale') return `${numeric.toFixed(2)}×`;
  return `${numeric.toFixed(1)}×`;
}

function refreshSettingsLiveLabels() {
  const pairs = [
    ['setting-animation-speed', 'setting-animation-speed-value'],
    ['setting-font-scale', 'setting-font-scale-value'],
    ['setting-fx-intensity', 'setting-fx-intensity-value']
  ];
  pairs.forEach(([inputId, outputId]) => {
    const inputEl = document.getElementById(inputId);
    const outputEl = document.getElementById(outputId);
    if (!inputEl || !outputEl) return;
    outputEl.textContent = getRangeValueText(inputId, inputEl.value);
  });
}

function openSettingsModal() {
  syncSettingsForm();
  openModal('modal-settings');
}

function applyBoardTransform() {
  const board = document.getElementById('board');
  if (!board) return;
  board.style.transform = `translate(${boardPanX}px, ${boardPanY}px) scale(${boardScale}) rotate(${boardRotation}deg)`;
}

function clampBoardScale(value) {
  return Math.max(0.7, Math.min(2.3, value));
}

function setBoardScale(nextScale) {
  boardScale = clampBoardScale(nextScale);
  document.documentElement.style.setProperty('--board-scale', String(boardScale));
  applyBoardTransform();
}

function setupBoardViewportControls() {
  const zoomIn = document.getElementById('btn-zoom-in');
  const zoomOut = document.getElementById('btn-zoom-out');
  const rotLeft = document.getElementById('btn-rotate-left');
  const rotRight = document.getElementById('btn-rotate-right');
  const reset = document.getElementById('btn-reset-view');
  const boardArea = document.getElementById('board-area');

  if (zoomIn) zoomIn.addEventListener('click', () => setBoardScale(boardScale + 0.15));
  if (zoomOut) zoomOut.addEventListener('click', () => setBoardScale(boardScale - 0.15));
  if (rotLeft) rotLeft.addEventListener('click', () => { boardRotation -= 15; applyBoardTransform(); });
  if (rotRight) rotRight.addEventListener('click', () => { boardRotation += 15; applyBoardTransform(); });
  if (reset) reset.addEventListener('click', () => {
    boardScale = 1;
    document.documentElement.style.setProperty('--board-scale', '1');
    boardRotation = 0;
    boardPanX = 0;
    boardPanY = 0;
    applyBoardTransform();
  });

  if (!boardArea) return;
  boardArea.addEventListener('wheel', (e) => {
    e.preventDefault();
    setBoardScale(boardScale + (e.deltaY < 0 ? 0.08 : -0.08));
  }, { passive: false });

  boardArea.addEventListener('pointerdown', (e) => {
    isDraggingBoard = true;
    dragStartX = e.clientX - boardPanX;
    dragStartY = e.clientY - boardPanY;
  });
  window.addEventListener('pointerup', () => { isDraggingBoard = false; });
  window.addEventListener('pointermove', (e) => {
    if (!isDraggingBoard) return;
    boardPanX = e.clientX - dragStartX;
    boardPanY = e.clientY - dragStartY;
    applyBoardTransform();
  });
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  syncMusicPlayback(id);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initAudioSystem();
  loadSettings();
  applySettings();
  setupMenuHandlers();
  setupLocalSetupHandlers();
  setupOnlineLobbyHandlers();
  setupGameHandlers();
  bindGlobalButtonSfx();
  setupBoardViewportControls();
  showScreen('screen-menu');
});

function initAudioSystem() {
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (raw) {
      const prefs = JSON.parse(raw);
      sfxEnabled = prefs.sfxEnabled !== false;
      musicEnabled = prefs.musicEnabled !== false;
    }
  } catch (_e) {}
  loadAudioDefinitions();
  audioReady = true;
  setupAudioControls();
}

function loadAudioDefinitions() {
  fetch(SFX_PRESET_PATH)
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (data && typeof data === 'object') sfxPresets = data;
    })
    .catch(() => {});
  fetch(MUSIC_THEME_PATH)
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (data && Array.isArray(data.notes)) musicTheme = data;
    })
    .catch(() => {});
}

function setupAudioControls() {
  const sfxBtn = document.getElementById('btn-toggle-sfx');
  const musicBtn = document.getElementById('btn-toggle-music');
  if (!sfxBtn || !musicBtn) return;
  updateAudioButtons();
  sfxBtn.addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    saveAudioPrefs();
    updateAudioButtons();
    playSfx('click');
  });
  musicBtn.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    saveAudioPrefs();
    updateAudioButtons();
    syncMusicPlayback();
    playSfx('click');
  });
}

function bindGlobalButtonSfx() {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.id === 'btn-toggle-sfx' || btn.id === 'btn-toggle-music') return;
    btn.addEventListener('click', () => playSfx('click'));
  });
}

function updateAudioButtons() {
  const sfxBtn = document.getElementById('btn-toggle-sfx');
  const musicBtn = document.getElementById('btn-toggle-music');
  if (!sfxBtn || !musicBtn) return;
  sfxBtn.textContent = `🔊 Dźwięki: ${sfxEnabled ? 'ON' : 'OFF'}`;
  musicBtn.textContent = `🎵 Muzyka: ${musicEnabled ? 'ON' : 'OFF'}`;
  sfxBtn.classList.toggle('disabled', !sfxEnabled);
  musicBtn.classList.toggle('disabled', !musicEnabled);
}

function saveAudioPrefs() {
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ sfxEnabled, musicEnabled }));
  } catch (_e) {}
}

function syncMusicPlayback(activeScreenId) {
  if (!audioReady) return;
  const activeId = activeScreenId || document.querySelector('.screen.active')?.id;
  const shouldPlay = musicEnabled && activeId === 'screen-game';
  if (shouldPlay) {
    startMusicLoop();
  } else {
    stopMusicLoop();
  }
}

function playSfx(name) {
  if (!sfxEnabled) return;
  const preset = sfxPresets[name];
  if (!preset || !preset.length) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  preset.forEach(note => scheduleTone(note, now));
}

function ensureAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) {
    audioContext = new Ctx();
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = 0.8;
    masterGainNode.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function scheduleTone(note, baseTime) {
  const ctx = audioContext;
  if (!ctx || !masterGainNode) return;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const startAt = baseTime + (note.delay || 0);
  const duration = note.duration || 0.1;
  const gain = note.gain || 0.05;
  osc.type = note.type || 'sine';
  osc.frequency.value = note.freq || 440;

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gainNode);
  gainNode.connect(masterGainNode);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function startMusicLoop() {
  if (musicLoopIntervalId !== null) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  playMusicPhrase();
  const loopMs = musicTheme.loopMs || DEFAULT_MUSIC_THEME.loopMs;
  musicLoopIntervalId = window.setInterval(playMusicPhrase, loopMs);
}

function stopMusicLoop() {
  if (musicLoopIntervalId !== null) {
    clearInterval(musicLoopIntervalId);
    musicLoopIntervalId = null;
  }
}

function playMusicPhrase() {
  if (!musicEnabled) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const notes = musicTheme.notes || [];
  const now = ctx.currentTime;
  notes.forEach(note => scheduleTone(note, now));
}

// ============================================================
// MENU HANDLERS
// ============================================================
function setupMenuHandlers() {
  document.getElementById('btn-local').addEventListener('click', () => {
    showScreen('screen-local-setup');
  });
  document.getElementById('btn-online').addEventListener('click', () => {
    initSocket();
    showScreen('screen-online-lobby');
  });
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (socket) socket.disconnect();
    socket = null;
    gameMode = null;
    localGame = null;
    boardRendered = false;
    showScreen('screen-menu');
  });
}

// ============================================================
// LOCAL SETUP HANDLERS
// ============================================================
let localPlayerCount = 2;

function setupLocalSetupHandlers() {
  // Player count buttons
  document.querySelectorAll('.pc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localPlayerCount = parseInt(btn.dataset.count);
      renderPlayerNameInputs(localPlayerCount);
    });
  });

  document.getElementById('btn-local-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  document.getElementById('btn-local-start').addEventListener('click', () => {
    const names = [];
    const colors = [];
    const pawns = [];
    const aiFlags = [];
    let errMsg = '';
    const rows = document.querySelectorAll('#player-names-list .player-name-row');
    rows.forEach((row, i) => {
      const v = row.querySelector('input').value.trim();
      const selectedColor = row.dataset.color;
      const selectedPawn = row.dataset.pawn;
      const isAI = row.dataset.isAi === 'true';
      if (!v) { errMsg = `Wpisz imię gracza ${i + 1}.`; return; }
      if (names.includes(v)) { errMsg = 'Imiona graczy muszą być różne.'; return; }
      if (colors.includes(selectedColor)) { errMsg = 'Kolory graczy muszą być różne.'; return; }
      if (pawns.includes(selectedPawn)) { errMsg = 'Pionki graczy muszą być różne.'; return; }
      names.push(v);
      colors.push(selectedColor);
      pawns.push(selectedPawn);
      aiFlags.push(isAI);
    });
    document.getElementById('local-error').textContent = errMsg;
    if (errMsg || names.length !== localPlayerCount) return;

    startLocalGame(names.map((n, i) => ({ name: n, color: colors[i], pawn: pawns[i], isAI: aiFlags[i] })));
  });

  // Initial render
  renderPlayerNameInputs(2);
}

function renderPlayerNameInputs(count) {
  const container = document.getElementById('player-names-list');
  container.innerHTML = '';
  const defaults = ['Freud', 'Jung', 'Adler', 'Maslow'];
  const aiDefaults = ['AI-Freud', 'AI-Jung', 'AI-Adler', 'AI-Maslow'];
  localSelections = Array.from({ length: count }, (_, i) => ({
    color: AVAILABLE_COLORS[i] || PLAYER_COLORS[i % PLAYER_COLORS.length],
    pawn: PAWN_OPTIONS[i % PAWN_OPTIONS.length].id,
    isAI: false,
  }));
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'player-name-row';
    row.dataset.color = localSelections[i].color;
    row.dataset.pawn = localSelections[i].pawn;
    row.dataset.isAi = 'false';
    row.innerHTML = `
      <div class="form-group" style="flex:1;margin:0">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
          <input type="text" class="player-name-input" placeholder="Gracz ${i + 1} (np. ${defaults[i]})" maxlength="20" value="${defaults[i]}">
          <button type="button" class="ai-toggle-btn" title="Przełącz na gracza AI">🤖 AI</button>
        </div>
        <div class="player-selection-row">
          <div class="token-select-list" data-role="pawn-list"></div>
          <div class="color-select-list" data-role="color-list"></div>
        </div>
      </div>`;
    const nameInput = row.querySelector('.player-name-input');
    const aiBtn = row.querySelector('.ai-toggle-btn');
    aiBtn.addEventListener('click', () => {
      const isAI = row.dataset.isAi !== 'true';
      row.dataset.isAi = String(isAI);
      localSelections[i].isAI = isAI;
      if (isAI) {
        aiBtn.classList.add('active');
        row.classList.add('ai-player');
        if (!nameInput.value.trim() || nameInput.value === defaults[i]) {
          nameInput.value = aiDefaults[i];
        }
        nameInput.disabled = true;
      } else {
        aiBtn.classList.remove('active');
        row.classList.remove('ai-player');
        nameInput.disabled = false;
        if (nameInput.value === aiDefaults[i]) {
          nameInput.value = defaults[i];
        }
      }
    });
    const pawnList = row.querySelector('[data-role="pawn-list"]');
    PAWN_OPTIONS.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `token-choice${opt.id === row.dataset.pawn ? ' active' : ''}`;
      btn.title = opt.name;
      btn.dataset.pawn = opt.id;
      btn.innerHTML = `<img src="${opt.icon}" alt="${opt.name}">`;
      btn.addEventListener('click', () => {
        row.dataset.pawn = opt.id;
        pawnList.querySelectorAll('.token-choice').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      });
      pawnList.appendChild(btn);
    });
    const colorList = row.querySelector('[data-role="color-list"]');
    AVAILABLE_COLORS.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-choice${color === row.dataset.color ? ' active' : ''}`;
      btn.style.background = color;
      btn.dataset.color = color;
      btn.title = color;
      btn.addEventListener('click', () => {
        row.dataset.color = color;
        colorList.querySelectorAll('.color-choice').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      });
      colorList.appendChild(btn);
    });
    container.appendChild(row);
  }
}

// ============================================================
// ONLINE LOBBY HANDLERS
// ============================================================
function setupOnlineLobbyHandlers() {
  renderOnlineSelections();

  document.getElementById('btn-online-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  document.getElementById('btn-online-next').addEventListener('click', () => {
    const name = document.getElementById('online-player-name').value.trim();
    if (!name) { showToast('Wpisz swoje imię!'); return; }
    myPlayerName = name;
    if (!myPlayerColor || !myPlayerPawn) {
      showToast('Wybierz pionek i kolor.');
      return;
    }
    document.getElementById('lobby-step-name').style.display = 'none';
    document.getElementById('lobby-step-choose').style.display = 'block';
  });
  document.getElementById('online-player-name').addEventListener('input', (e) => {
    myPlayerName = e.target.value.trim();
    previewSelection();
  });

  document.getElementById('btn-create-room').addEventListener('click', () => {
    if (!myPlayerName) { showToast('Najpierw wpisz nazwę gracza.'); return; }
    if (!socket) { showToast('Brak połączenia z serwerem online.'); return; }
    if (socket) socket.emit('create-room', { playerName: myPlayerName, color: myPlayerColor, pawn: myPlayerPawn });
  });

  document.getElementById('btn-show-join').addEventListener('click', () => {
    const row = document.getElementById('lobby-join-row');
    row.style.display = row.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    if (!myPlayerName) { showToast('Najpierw wpisz nazwę gracza.'); return; }
    if (!socket) { showToast('Brak połączenia z serwerem online.'); return; }
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!code) { showToast('Wpisz kod pokoju!'); return; }
    if (socket) socket.emit('join-room', { roomId: code, playerName: myPlayerName, color: myPlayerColor, pawn: myPlayerPawn });
  });

  document.getElementById('btn-lobby-back2').addEventListener('click', () => {
    document.getElementById('lobby-step-choose').style.display = 'none';
    document.getElementById('lobby-step-name').style.display = 'block';
  });

  document.getElementById('btn-lobby-leave').addEventListener('click', () => {
    if (socket) socket.disconnect();
    socket = null;
    resetLobbyUI();
    showScreen('screen-menu');
  });

  document.getElementById('btn-lobby-start').addEventListener('click', () => {
    if (!isHost) { showToast('Tylko host może rozpocząć grę.'); return; }
    if (!socket) { showToast('Brak połączenia z serwerem online.'); return; }
    if (socket) socket.emit('start-game');
  });
}

function renderOnlineSelections() {
  const tokenList = document.getElementById('online-token-list');
  const colorList = document.getElementById('online-color-list');
  const preview = document.getElementById('online-preview');
  tokenList.innerHTML = '';
  colorList.innerHTML = '';

  PAWN_OPTIONS.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `token-choice${i === 0 ? ' active' : ''}`;
    btn.innerHTML = `<img src="${opt.icon}" alt="${opt.name}">`;
    btn.title = opt.name;
    btn.addEventListener('click', () => {
      myPlayerPawn = opt.id;
      tokenList.querySelectorAll('.token-choice').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      previewSelection();
    });
    tokenList.appendChild(btn);
  });

  AVAILABLE_COLORS.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `color-choice${i === 0 ? ' active' : ''}`;
    btn.style.background = color;
    btn.addEventListener('click', () => {
      myPlayerColor = color;
      colorList.querySelectorAll('.color-choice').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      previewSelection();
    });
    colorList.appendChild(btn);
  });

  previewSelection();
}

function previewSelection() {
  const preview = document.getElementById('online-preview');
  if (!preview) return;
  preview.innerHTML = `<span>Podgląd: </span>
    <span class="player-token-sm" style="background:${myPlayerColor}; background-image:url('${getPawnIcon(myPlayerPawn)}');">${getInitial(myPlayerName)}</span>`;
}

function resetLobbyUI() {
  document.getElementById('lobby-step-name').style.display = 'block';
  document.getElementById('lobby-step-choose').style.display = 'none';
  document.getElementById('lobby-step-waiting').style.display = 'none';
  document.getElementById('online-player-name').value = '';
  document.getElementById('online-error').textContent = '';
  myPlayerName = '';
  myPlayerColor = AVAILABLE_COLORS[0];
  myPlayerPawn = PAWN_OPTIONS[0].id;
  renderOnlineSelections();
}

// ============================================================
// SOCKET.IO
// ============================================================
function initSocket() {
  if (socket) return;
  if (typeof io !== 'function') {
    showToast('Tryb online jest niedostępny bez serwera Socket.io.');
    return;
  }
  socket = io();

  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
  });

  socket.on('disconnect', () => {
    showToast('Rozłączono z serwerem.');
  });

  socket.on('error', ({ message }) => {
    document.getElementById('online-error').textContent = message;
    showToast('Błąd: ' + message);
  });

  socket.on('room-created', ({ roomId, playerId, players }) => {
    currentRoomId = roomId;
    myPlayerId    = playerId;
    isHost        = true;
    showLobbyWaiting(roomId, players, true);
  });

  socket.on('room-joined', ({ roomId, playerId, players }) => {
    currentRoomId = roomId;
    myPlayerId    = playerId;
    isHost        = false;
    showLobbyWaiting(roomId, players, false);
  });

  socket.on('player-joined', ({ players }) => {
    renderLobbyPlayers(players);
  });

  socket.on('game-started', (gs) => {
    gameMode = 'online';
    startOnlineGame(gs);
  });

  socket.on('game-state', (gs) => {
    if (gameMode === 'online') {
      applyOnlineState(gs);
    }
  });

  socket.on('chat-message', ({ name, text }) => {
    appendChatMsg(name, text);
  });
}

function showLobbyWaiting(roomId, players, host) {
  document.getElementById('lobby-step-choose').style.display = 'none';
  document.getElementById('lobby-step-waiting').style.display = 'block';
  document.getElementById('lobby-room-code').textContent = roomId;
  renderLobbyPlayers(players);
  document.getElementById('btn-lobby-start').style.display = host ? 'inline-flex' : 'none';
  document.getElementById('lobby-status').textContent = host
    ? 'Oczekiwanie na graczy… (min. 2, maks. 4)'
    : 'Oczekiwanie na start gry przez gospodarza…';
}

function renderLobbyPlayers(players) {
  const list = document.getElementById('lobby-players-list');
  list.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'lobby-player-row';
    row.innerHTML = `
      <div class="player-token-sm" style="background:${p.color}; background-image:url('${getPawnIcon(p.pawn)}')">${getInitial(p.name)}</div>
      <span>${p.name}${p.playerId === myPlayerId ? ' (Ty)' : ''}</span>`;
    list.appendChild(row);
  });
}

// ============================================================
// GAME CREATION (LOCAL)
// ============================================================
function createGameState(playerConfigs) {
  return {
    players: playerConfigs.map((p, i) => ({
      id:                 i,
      name:               p.name,
      color:              p.color || PLAYER_COLORS[i],
      pawn:               p.pawn || PAWN_OPTIONS[i % PAWN_OPTIONS.length].id,
      isAI:               p.isAI || false,
      money:              STARTING_MONEY,
      prestige:           STARTING_PRESTIGE,
      energy:             STARTING_ENERGY,
      ethics:             STARTING_ETHICS,
      burnout:            0,
      supervisionShield:  0,
      position:           0,
      inJail:             false,
      jailTurns:          0,
      properties:         [],
      getOutOfJailCards:  0,
      bankrupt:           false,
    })),
    properties:      {},   // spaceId -> { owner, houses, hotel, mortgaged }
    currentPlayerIndex: 0,
    phase:           'rolling',
    dice:            [0, 0],
    doubles:         0,
    turn:            0,
    roundsCompleted: 0,
    insightCards:    shuffleArray([...INSIGHT_CARDS]),
    sessionCards:    shuffleArray([...SESSION_CARDS]),
    insightDiscard:  [],
    sessionDiscard:  [],
    log:             [],
    winner:          null,
    pendingCard:     null,
    pendingCardDeck: null,
    pendingBuy:      null,
    rolledThisTurn:  false,
  };
}

// ============================================================
// START LOCAL GAME
// ============================================================
function startLocalGame(playerConfigs) {
  gameMode  = 'local';
  myPlayerId = 0;   // in local mode all players use same device
  localGame  = createGameState(playerConfigs);
  aiStepPending = false;
  if (!boardRendered) { renderBoard(); boardRendered = true; }
  // Chat offline note for local mode
  const offlineNote = document.getElementById('chat-drawer-offline-note');
  const drawerInput = document.getElementById('chat-drawer-input');
  const drawerSend  = document.getElementById('chat-drawer-send');
  if (offlineNote) offlineNote.style.display = 'block';
  if (drawerInput) drawerInput.disabled = true;
  if (drawerSend)  drawerSend.disabled  = true;
  showScreen('screen-game');
  addLog(localGame, `--- Tura gracza ${localGame.players[0].name} ---`, true);
  updateUI(localGame);
}

// ============================================================
// START ONLINE GAME
// ============================================================
function startOnlineGame(gs) {
  if (!boardRendered) { renderBoard(); boardRendered = true; }
  // Enable chat for online mode
  const offlineNote = document.getElementById('chat-drawer-offline-note');
  const drawerInput = document.getElementById('chat-drawer-input');
  const drawerSend  = document.getElementById('chat-drawer-send');
  if (offlineNote) offlineNote.style.display = 'none';
  if (drawerInput) drawerInput.disabled = false;
  if (drawerSend)  drawerSend.disabled  = false;
  showScreen('screen-game');
  applyOnlineState(gs);
}

function applyOnlineState(gs) {
  localGame = gs;
  updateUI(gs);
}

// ============================================================
// GAME HANDLERS (buttons)
// ============================================================
function setupGameHandlers() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab + '-content').classList.add('active');
    });
  });

  // Roll
  document.getElementById('btn-roll').addEventListener('click', () => {
    if (!localGame) return;
    if (isAnimating) return;
    if (gameMode === 'local') {
      doRoll(localGame);
      updateUI(localGame);
    } else {
      sendOnlineAction('roll');
    }
  });

  // Pay jail
  document.getElementById('btn-pay-jail').addEventListener('click', () => {
    if (!localGame) return;
    if (gameMode === 'local') {
      doPayJail(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('pay-jail'); }
  });

  // Use jail card
  document.getElementById('btn-jail-card').addEventListener('click', () => {
    if (!localGame) return;
    if (gameMode === 'local') {
      doUseJailCard(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('use-jail-card'); }
  });

  // End turn
  document.getElementById('btn-end-turn').addEventListener('click', () => {
    if (!localGame) return;
    if (gameMode === 'local') {
      doEndTurn(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('end-turn'); }
  });

  // Build
  document.getElementById('btn-build').addEventListener('click', () => {
    if (!localGame) return;
    openBuildModal(localGame);
  });

  // Mortgage
  document.getElementById('btn-mortgage').addEventListener('click', () => {
    if (!localGame) return;
    openMortgageModal(localGame);
  });

  // Card OK
  document.getElementById('btn-card-ok').addEventListener('click', () => {
    if (!localGame) return;
    closeModal('modal-card');
    if (gameMode === 'local') {
      doCardOk(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('card-ok'); }
  });

  // Buy confirm
  document.getElementById('btn-buy-confirm').addEventListener('click', () => {
    if (!localGame) return;
    closeModal('modal-buy');
    if (gameMode === 'local') {
      doBuy(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('buy'); }
  });

  // Buy pass
  document.getElementById('btn-buy-pass').addEventListener('click', () => {
    if (!localGame) return;
    closeModal('modal-buy');
    if (gameMode === 'local') {
      doPassBuy(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('pass-buy'); }
  });

  // Build modal close
  document.getElementById('btn-build-close').addEventListener('click', () => {
    closeModal('modal-build');
    if (localGame) updateUI(localGame);
  });

  // Mortgage modal close
  document.getElementById('btn-mortgage-close').addEventListener('click', () => {
    closeModal('modal-mortgage');
    if (localGame) updateUI(localGame);
  });

  // Chat drawer toggle
  const drawerToggle = document.getElementById('chat-drawer-toggle');
  if (drawerToggle) {
    drawerToggle.addEventListener('click', () => {
      const drawer = document.getElementById('chat-drawer');
      if (drawer) drawer.classList.toggle('open');
    });
  }

  // Chat send via drawer
  document.getElementById('chat-drawer-send').addEventListener('click', sendChatMsg);
  document.getElementById('chat-drawer-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMsg();
  });

  const btnSettingsClose = document.getElementById('btn-settings-close');
  if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => closeModal('modal-settings'));

  ['setting-animation-speed', 'setting-font-scale', 'setting-fx-intensity'].forEach(id => {
    const slider = document.getElementById(id);
    if (!slider) return;
    slider.addEventListener('input', () => {
      refreshSettingsLiveLabels();
    });
  });

  const btnExitToMenu = document.getElementById('btn-exit-to-menu');
  if (btnExitToMenu) {
    btnExitToMenu.addEventListener('click', () => {
      if (!window.confirm('Wyjść do menu głównego? Aktualna gra zostanie utracona.')) return;
      if (socket) socket.disconnect();
      socket = null;
      gameMode = null;
      localGame = null;
      boardRendered = false;
      isAnimating = false;
      animatingPlayerData = null;
      // Close chat drawer
      const chatDrawer = document.getElementById('chat-drawer');
      if (chatDrawer) chatDrawer.classList.remove('open');
      showScreen('screen-menu');
    });
  }

  const btnSettingsReset = document.getElementById('btn-settings-reset');
  if (btnSettingsReset) {
    btnSettingsReset.addEventListener('click', () => {
      gameSettings = { ...(window.PSYCHOPOLY_DEFAULT_CONFIG || {}) };
      applySettings();
      syncSettingsForm();
      saveSettings();
      showToast('Przywrócono domyślne ustawienia.');
    });
  }

  const btnSettingsSave = document.getElementById('btn-settings-save');
  if (btnSettingsSave) {
    btnSettingsSave.addEventListener('click', () => {
      gameSettings.animationSpeed = parseFloat(document.getElementById('setting-animation-speed').value) || 1;
      gameSettings.fontScale = parseFloat(document.getElementById('setting-font-scale').value) || 1;
      gameSettings.renderQuality = document.getElementById('setting-render-quality').value || 'high';
      gameSettings.boardFxIntensity = parseFloat(document.getElementById('setting-fx-intensity').value) || 1;
      applySettings();
      saveSettings();
      closeModal('modal-settings');
      showToast('Ustawienia zapisane.');
    });
  }
}

function sendChatMsg() {
  const inp = document.getElementById('chat-drawer-input');
  const text = inp ? inp.value.trim() : '';
  if (!text || !socket) return;
  socket.emit('chat-message', { text });
  inp.value = '';
}

function appendChatMsg(name, text) {
  const el = document.getElementById('chat-drawer-messages');
  if (!el) return;
  const msg = document.createElement('div');
  msg.className = 'chat-msg';
  msg.innerHTML = `<strong>${escHtml(name)}:</strong> ${escHtml(text)}`;
  el.appendChild(msg);
  el.scrollTop = el.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sendOnlineAction(type, data = {}) {
  if (socket) socket.emit('game-action', { type, data });
}

// ============================================================
// BOARD RENDERING
// ============================================================
function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  BOARD_SPACES.forEach(space => {
    const pos = GRID_POSITIONS[space.id];
    const cell = document.createElement('div');
    cell.id    = `space-${space.id}`;
    cell.style.gridRow    = pos.row;
    cell.style.gridColumn = pos.col;

    // Determine orientation
    const isCorner    = [0, 10, 20, 30].includes(space.id);
    const isBottom    = pos.row === 11 && !isCorner;
    const isTop       = pos.row === 1  && !isCorner;
    const isLeft      = pos.col === 1  && !isCorner;
    const isRight     = pos.col === 11 && !isCorner;

    cell.className = `board-space space-type-${space.type}`;
    if (isCorner) cell.classList.add('space-corner');
    if (isBottom) cell.classList.add('space-bottom');
    if (isTop)    cell.classList.add('space-top');
    if (isLeft)   cell.classList.add('space-side-left');
    if (isRight)  cell.classList.add('space-side-right');

    if (isCorner) {
      cell.innerHTML = cornerContent(space);
    } else {
      cell.innerHTML = spaceContent(space, isTop);
    }
    cell.dataset.spaceId = String(space.id);

    // Token layer
    const tokenLayer = document.createElement('div');
    tokenLayer.className = 'token-layer';
    tokenLayer.id = `tokens-${space.id}`;
    cell.appendChild(tokenLayer);

    cell.addEventListener('mouseenter', (e) => {
      showSpaceTooltip(space, cell);
      showSpacePreview(space, 'hover');
    });
    cell.addEventListener('mouseleave', () => hideSpaceTooltip());
    cell.addEventListener('click', () => showSpacePreview(space, 'click'));

    board.appendChild(cell);
  });

  // Center piece
  const center = document.createElement('div');
  center.id = 'board-center';
  center.style.gridRow    = '2 / 11';
  center.style.gridColumn = '2 / 11';
  center.innerHTML = `
    <div class="center-title">PSYCHOPOLY</div>
    <div class="center-subtitle">Psychologiczne Monopoly</div>
    <div class="center-decks">
      <div id="insight-deck" class="card-deck-pile deck-insight">
        <div class="deck-icon">🟧</div>
        <div class="deck-name">Superwizja</div>
        <div class="deck-count" id="insight-deck-count"></div>
      </div>
      <div id="session-deck" class="card-deck-pile deck-session">
        <div class="deck-icon">🟦</div>
        <div class="deck-name">Sesja</div>
        <div class="deck-count" id="session-deck-count"></div>
      </div>
    </div>
    <div class="dice-display" id="center-dice" style="display:none">
      <div class="die" id="center-die1">?</div>
      <div class="die" id="center-die2">?</div>
    </div>
    <div class="center-current-player" id="center-player"></div>
    <div class="center-phase" id="center-phase"></div>
    <div class="turn-player-stats" id="turn-player-stats"></div>
  `;
  board.appendChild(center);

  // Card deck click handlers
  document.getElementById('insight-deck').addEventListener('click', () => {
    if (!localGame) return;
    const gs = localGame;
    if (gs.phase !== 'card-select') return;
    if (gs.pendingCardDeck !== 'insight') { showToast('Ciągnij z właściwego stosu kart!'); return; }
    const player = gs.players[gs.currentPlayerIndex];
    if (gameMode === 'local') {
      doDrawCard(gs, player, 'insight');
      gs.pendingCardDeck = null;
      updateUI(gs);
    } else {
      sendOnlineAction('draw-card', { deck: 'insight' });
    }
  });
  document.getElementById('session-deck').addEventListener('click', () => {
    if (!localGame) return;
    const gs = localGame;
    if (gs.phase !== 'card-select') return;
    if (gs.pendingCardDeck !== 'session') { showToast('Ciągnij z właściwego stosu kart!'); return; }
    const player = gs.players[gs.currentPlayerIndex];
    if (gameMode === 'local') {
      doDrawCard(gs, player, 'session');
      gs.pendingCardDeck = null;
      updateUI(gs);
    } else {
      sendOnlineAction('draw-card', { deck: 'session' });
    }
  });
  applyBoardTransform();
}

function cornerContent(space) {
  const icons = { go: '▶', jail: '🔒', freeparking: '🚗', gotojail: '👮' };
  return `
    <div class="corner-icon">${icons[space.type] || '⭐'}</div>
    <div class="corner-label">${space.name}</div>
  `;
}

function spaceContent(space, isTop) {
  let colorBar = '';
  if (space.type === 'property' && space.group) {
    colorBar = `<div class="color-strip" style="color:${GROUP_COLORS[space.group]}"></div>`;
  }
  const price = space.price ? `<div class="space-price">${space.price} zł</div>` : '';
  const icon  = spaceIcon(space.type);
  return `
    ${colorBar}
    <div class="space-name">${icon}${space.name}</div>
    ${price}
    <div class="building-indicator" id="buildings-${space.id}"></div>
  `;
}

function spaceIcon(type) {
  const icons = { card: '🃏', tax: '💸', railroad: '🚂', utility: '⚙️', jail: '🔒',
                  gotojail: '👮', freeparking: '🚗', go: '▶', property: '' };
  return icons[type] ? icons[type] + ' ' : '';
}

function getSpacePenalty(space) {
  if (!space) return 'Brak danych.';
  if (space.type === 'tax') return `Kara podatkowa: zapłać ${space.amount} zł.`;
  if (space.type === 'gotojail') return 'Kara: trafiasz do Izolacji (pole 10).';
  if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
    return space.price ? `Możliwy koszt: zakup ${space.price} zł lub czynsz.` : 'Pole własności.';
  }
  if (space.type === 'card') return 'Dobierz kartę i wykonaj polecenie.';
  return 'Brak bezpośredniej kary na tym polu.';
}

function showSpacePreview(space, source = 'hover') {
  const box = document.getElementById('space-preview');
  if (!box || !space) return;
  const modeLabel = source === 'click' ? 'Podgląd pola (klik)' : 'Podgląd pola (hover)';
  box.innerHTML = `
    <div class="space-preview-mode">${modeLabel}</div>
    <div class="space-preview-name">${escHtml(space.name)}</div>
    <div class="space-preview-penalty">${escHtml(getSpacePenalty(space))}</div>
  `;
}

function showSpaceTooltip(space, el) {
  const tooltip = document.getElementById('space-tooltip');
  if (!tooltip || !space || !el) return;
  const rect = el.getBoundingClientRect();
  tooltip.style.left = (rect.left + rect.width / 2) + 'px';
  tooltip.style.top  = (rect.top - 8) + 'px';
  const desc = space.description || getSpacePenalty(space);
  tooltip.innerHTML = `<div class="space-tooltip-name">${escHtml(space.name)}</div><div class="space-tooltip-desc">${escHtml(desc)}</div>`;
  tooltip.style.display = 'block';
}

function hideSpaceTooltip() {
  const tooltip = document.getElementById('space-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function animateBoardFocus(fromSpaceId, toSpaceId) {
  const fromEl = document.getElementById(`space-${fromSpaceId}`);
  const toEl = document.getElementById(`space-${toSpaceId}`);
  const boardArea = document.getElementById('board-area');
  if (!fromEl || !toEl || !boardArea) return;

  [fromEl, toEl].forEach((el, idx) => {
    setTimeout(() => {
      el.classList.remove('space-focus-pulse');
      void el.offsetWidth;
      el.classList.add('space-focus-pulse');
    }, idx * 450);
  });

  const toRect = toEl.getBoundingClientRect();
  const areaRect = boardArea.getBoundingClientRect();
  const dx = areaRect.left + areaRect.width / 2 - (toRect.left + toRect.width / 2);
  const dy = areaRect.top + areaRect.height / 2 - (toRect.top + toRect.height / 2);
  boardPanX += dx * 0.55;
  boardPanY += dy * 0.55;
  setBoardScale(Math.max(boardScale, 1.35));
}

function animateCardDraw(deck) {
  const fx = document.getElementById('card-draw-fx');
  if (!fx) return;
  fx.textContent = deck === 'insight' ? '🟧 Karta Szansy' : '🟦 Karta Społeczności';
  fx.classList.remove('playing');
  void fx.offsetWidth;
  fx.classList.add('playing');
}

function animateDiceOnBoard(d1, d2) {
  const fx = document.getElementById('dice-board-fx');
  const die1 = document.getElementById('board-die1');
  const die2 = document.getElementById('board-die2');
  if (!fx || !die1 || !die2) return;
  die1.textContent = DICE_FACES[d1] || '⚀';
  die2.textContent = DICE_FACES[d2] || '⚀';
  fx.classList.remove('playing');
  void fx.offsetWidth;
  fx.classList.add('playing');
}

// ============================================================
// UI UPDATE
// ============================================================
function updateUI(gs) {
  if (!gs) return;

  const prevPositions = movedPlayersLastUpdate.length
    ? movedPlayersLastUpdate
    : gs.players.map(p => p.position);
  const movedIdx = gs.players.findIndex((p, idx) => !p.bankrupt && prevPositions[idx] !== p.position);
  if (movedIdx >= 0) {
    const moved = gs.players[movedIdx];
    animateBoardFocus(prevPositions[movedIdx] ?? moved.position, moved.position);
  }

  renderTokens(gs);
  renderBuildingIndicators(gs);
  renderOwnershipRings(gs);
  updateSidePanel(gs);
  updateTurnQueue(gs);
  updateActionButtons(gs);
  updateCenterInfo(gs);
  movedPlayersLastUpdate = gs.players.map(p => p.position);

  if (gs.phase === 'end' && gs.winner !== null) {
    setTimeout(() => showGameOver(gs), 600);
  }

  const curPlayer = gs.players[gs.currentPlayerIndex];
  const curIsAI = curPlayer && curPlayer.isAI && gameMode === 'local';

  if (gs.phase === 'buying' && gs.pendingBuy) {
    if (!curIsAI) openBuyModal(gs, gs.pendingBuy.spaceId);
  }

  if (gs.phase === 'card' && gs.pendingCard) {
    if (!curIsAI) openCardModal(gs.pendingCard.card, gs.pendingCard.deck);
  }

  if (curIsAI) scheduleAiTurnIfNeeded(gs);
}

// ============================================================
// TOKENS
// ============================================================
function renderTokens(gs) {
  // Clear all token layers
  document.querySelectorAll('.token-layer').forEach(tl => { tl.innerHTML = ''; });

  gs.players.forEach(player => {
    if (player.bankrupt) return;
    // Use animation position when this player is mid-move
    const displayPos = (animatingPlayerData && animatingPlayerData.playerId === player.id)
      ? animatingPlayerData.animPos
      : player.position;
    const layer = document.getElementById(`tokens-${displayPos}`);
    if (!layer) return;
    const token = document.createElement('div');
    token.className = 'player-token';
    if (player.id === gs.currentPlayerIndex) token.classList.add('active');
    token.style.backgroundColor = player.color;
    token.style.backgroundImage = `url('${getPawnIcon(player.pawn)}')`;
    token.textContent = getInitial(player.name);
    token.title = `${player.name} — ${player.money} zł`;
    layer.appendChild(token);
  });
}

function renderBuildingIndicators(gs) {
  // Clear existing
  document.querySelectorAll('.building-indicator').forEach(el => { el.innerHTML = ''; });

  Object.entries(gs.properties).forEach(([spaceId, propState]) => {
    const indEl = document.getElementById(`buildings-${spaceId}`);
    if (!indEl) return;
    if (propState.hotel) {
      const dot = document.createElement('div');
      dot.className = 'hotel-dot';
      dot.title = 'Pełna specjalizacja';
      indEl.appendChild(dot);
    } else if (propState.houses > 0) {
      for (let i = 0; i < propState.houses; i++) {
        const dot = document.createElement('div');
        dot.className = 'house-dot';
        dot.title = `${propState.houses} certyfikat(y)`;
        indEl.appendChild(dot);
      }
    }
  });
}

function renderOwnershipRings(gs) {
  BOARD_SPACES.forEach(space => {
    const el = document.getElementById(`space-${space.id}`);
    if (!el) return;
    const ps = gs.properties[space.id];
    if (ps) {
      el.classList.add('space-owned');
      const ownerColor = gs.players[ps.owner] ? gs.players[ps.owner].color : PLAYER_COLORS[ps.owner];
      el.style.boxShadow = `inset 0 0 0 2px ${ownerColor}`;
      el.classList.toggle('space-mortgaged', ps.mortgaged);
    } else {
      el.classList.remove('space-owned', 'space-mortgaged');
      el.style.boxShadow = '';
    }
  });
}

// ============================================================
// CENTER INFO
// ============================================================
function updateCenterInfo(gs) {
  const cur = gs.players[gs.currentPlayerIndex];
  if (!cur) return;

  const centerPlayer = document.getElementById('center-player');
  const centerPhase  = document.getElementById('center-phase');
  const centerDice   = document.getElementById('center-dice');
  const cd1 = document.getElementById('center-die1');
  const cd2 = document.getElementById('center-die2');

  if (centerPlayer) {
    centerPlayer.textContent = `Tura: ${cur.name}`;
    centerPlayer.style.color = cur.color;
  }
  if (centerPhase) {
    centerPhase.textContent = PHASE_LABELS[gs.phase] || gs.phase;
  }

  const turnStats = document.getElementById('turn-player-stats');
  if (turnStats) {
    const cardCount = cur.getOutOfJailCards || 0;
    const ownedCount = (cur.properties || []).length;
    turnStats.innerHTML = `
      <div class="turn-stats-row"><span>💰 Gotówka</span><strong class="stat-money">${formatMoney(cur.money)}</strong></div>
      <div class="turn-stats-row"><span>⭐ Prestiż</span><strong class="stat-prestige">${cur.prestige}</strong></div>
      <div class="turn-stats-row"><span>🔋 Energia</span><strong class="stat-energy">${cur.energy}</strong></div>
      <div class="turn-stats-row"><span>⚖️ Etyka</span><strong class="stat-ethics">${cur.ethics}</strong></div>
      <div class="turn-stats-row"><span>🔥 Wypalenie</span><strong class="stat-burnout">${cur.burnout}</strong></div>
      <div class="turn-stats-row"><span>🧾 Własności</span><strong class="stat-props">${ownedCount}</strong></div>
      <div class="turn-stats-row"><span>🛡️ Superwizja</span><strong class="stat-supervision">${cur.supervisionShield}</strong></div>
      <div class="turn-stats-row"><span>🎫 Karty</span><strong class="stat-cards">${cardCount}</strong></div>
    `;
  }

  if (gs.dice[0] > 0 && centerDice) {
    centerDice.style.display = 'flex';
    cd1.textContent = DICE_FACES[gs.dice[0]];
    cd2.textContent = DICE_FACES[gs.dice[1]];
  }

  // Update side-panel die display too
  document.getElementById('die1').textContent = gs.dice[0] > 0 ? DICE_FACES[gs.dice[0]] : '?';
  document.getElementById('die2').textContent = gs.dice[1] > 0 ? DICE_FACES[gs.dice[1]] : '?';

  // Card deck counts and active state
  const insightCountEl = document.getElementById('insight-deck-count');
  const sessionCountEl = document.getElementById('session-deck-count');
  if (insightCountEl) insightCountEl.textContent = (gs.insightCards ? gs.insightCards.length : 0) + ' kart';
  if (sessionCountEl) sessionCountEl.textContent = (gs.sessionCards ? gs.sessionCards.length : 0) + ' kart';

  const insightDeckEl = document.getElementById('insight-deck');
  const sessionDeckEl = document.getElementById('session-deck');
  const insightActive = gs.phase === 'card-select' && gs.pendingCardDeck === 'insight';
  const sessionActive = gs.phase === 'card-select' && gs.pendingCardDeck === 'session';
  if (insightDeckEl) insightDeckEl.classList.toggle('deck-active', insightActive);
  if (sessionDeckEl) sessionDeckEl.classList.toggle('deck-active', sessionActive);
}

// ============================================================
// SIDE PANEL
// ============================================================
function updateSidePanel(gs) {
  renderPlayersPanel(gs);
  renderPropertiesPanel(gs);
  renderLogPanel(gs);
}

function getTurnGuidance(gs, { cur, myTurn, curIsAI }) {
  const phase = gs.phase;
  const phaseLabel = PHASE_LABELS[phase] || phase;
  let recommendedMove = phaseLabel;

  if (curIsAI) {
    recommendedMove = 'Poczekaj, aż AI zakończy ruch.';
  } else if (!myTurn) {
    recommendedMove = 'Poczekaj na ruch aktywnego gracza.';
  } else if (phase === 'rolling') {
    if (cur.inJail) {
      recommendedMove = cur.getOutOfJailCards > 0
        ? 'Użyj karty wolności lub opłać karę.'
        : 'Opłać karę albo rzuć kostkami.';
    } else {
      recommendedMove = 'Rzuć kostkami.';
    }
  } else if (phase === 'end-turn') {
    recommendedMove = gs.doubles > 0
      ? 'Masz dublet — rzuć kostkami ponownie.'
      : 'Zakończ turę.';
  } else if (phase === 'buying') {
    recommendedMove = 'Wybierz: kup lub pomiń aktywo.';
  } else if (phase === 'card-select') {
    recommendedMove = gs.pendingCardDeck === 'insight'
      ? 'Kliknij stos „Superwizja” na planszy.'
      : 'Kliknij stos „Sesja” na planszy.';
  } else if (phase === 'moving') {
    recommendedMove = 'Poczekaj na zakończenie ruchu pionka.';
  }

  return {
    phaseLabel,
    recommendedMove,
    checklistStep: PHASE_CHECKLIST_STEP[phase] ?? 0
  };
}

function updateTurnStatusPanel(gs, { cur, myTurn, curIsAI, guidance }) {
  const playerEl = document.getElementById('turn-status-player');
  const phaseEl = document.getElementById('turn-status-phase');
  const recEl = document.getElementById('turn-status-recommendation');
  if (playerEl) {
    if (gameMode === 'online' && !myTurn) playerEl.textContent = `${cur.name} (przeciwnik)`;
    else if (curIsAI) playerEl.textContent = `${cur.name} 🤖`;
    else playerEl.textContent = cur.name;
    playerEl.style.color = cur.color;
  }
  if (phaseEl) phaseEl.textContent = guidance.phaseLabel;
  if (recEl) recEl.textContent = guidance.recommendedMove;

  document.querySelectorAll('#turn-checklist [data-step]').forEach((stepEl) => {
    const step = Number(stepEl.dataset.step);
    stepEl.classList.toggle('is-current', step === guidance.checklistStep);
    stepEl.classList.toggle('is-done', step < guidance.checklistStep);
  });
}

// ============================================================
// TURN QUEUE BAR
// ============================================================
function updateTurnQueue(gs) {
  const el = document.getElementById('turn-queue');
  if (!el) return;
  el.innerHTML = '';
  const n = gs.players.length;
  for (let i = 0; i < n; i++) {
    const idx = (gs.currentPlayerIndex + i) % n;
    const player = gs.players[idx];
    const isCurrent = i === 0;

    const item = document.createElement('div');
    item.className = `tq-item${isCurrent ? ' tq-current' : ''}${player.bankrupt ? ' tq-bankrupt' : ''}`;

    item.innerHTML = `
      <div class="player-token-sm" style="background:${player.color}; background-image:url('${getPawnIcon(player.pawn)}')">${getInitial(player.name)}</div>
      <span class="tq-name">${escHtml(player.name)}</span>
      ${isCurrent ? '<span class="tq-turn-label">TERAZ</span>' : ''}
    `;

    item.addEventListener('mouseenter', () => showPlayerStatsTooltip(player, item));
    item.addEventListener('mouseleave', () => hidePlayerStatsTooltip());

    el.appendChild(item);

    if (i < n - 1) {
      const sep = document.createElement('div');
      sep.className = 'tq-sep';
      sep.textContent = '›';
      el.appendChild(sep);
    }
  }
}

function showPlayerStatsTooltip(player, anchorEl) {
  const tooltip = document.getElementById('player-stats-tooltip');
  if (!tooltip || !anchorEl) return;

  const ownedCount = (player.properties || []).length;
  const jailStatus = player.bankrupt ? '💀 Odpadł' :
                     player.inJail   ? `🔒 Izolacja (${player.jailTurns}/${MAX_JAIL_TURNS})` : '';

  tooltip.innerHTML = `
    <div class="pst-name" style="color:${player.color}">${escHtml(player.name)}</div>
    <div class="pst-row"><span class="pst-label">💰 Gotówka</span><span class="stat-money">${formatMoney(player.money)}</span></div>
    <div class="pst-row"><span class="pst-label">⭐ Prestiż</span><span class="stat-prestige">${player.prestige}</span></div>
    <div class="pst-row"><span class="pst-label">🔋 Energia</span><span class="stat-energy">${player.energy}</span></div>
    <div class="pst-row"><span class="pst-label">⚖️ Etyka</span><span class="stat-ethics">${player.ethics}</span></div>
    <div class="pst-row"><span class="pst-label">🔥 Wypalenie</span><span class="stat-burnout">${player.burnout}</span></div>
    <div class="pst-row"><span class="pst-label">🛡️ Superwizja</span><span class="stat-supervision">${player.supervisionShield}</span></div>
    <div class="pst-row"><span class="pst-label">🧾 Własności</span><span class="stat-props">${ownedCount}</span></div>
    ${jailStatus ? `<div class="pst-row" style="margin-top:4px;opacity:.7">${jailStatus}</div>` : ''}
  `;

  const rect = anchorEl.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top  = (rect.bottom + 6) + 'px';
  tooltip.style.display = 'block';
}

function hidePlayerStatsTooltip() {
  const tooltip = document.getElementById('player-stats-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function renderPlayersPanel(gs) {
  const list = document.getElementById('players-list-panel');
  if (!list) return;
  list.innerHTML = '';
  gs.players.forEach((player, i) => {
    const card = document.createElement('div');
    card.className = `player-card-panel${i === gs.currentPlayerIndex ? ' active-turn' : ''}${player.bankrupt ? ' bankrupt' : ''}`;
    const propDots = player.properties.map(spaceId => {
      const sp = BOARD_SPACES[spaceId];
      const color = sp && sp.group ? GROUP_COLORS[sp.group] : '#999';
      return `<span class="prop-mini-dot" style="background:${color}" title="${sp ? sp.name : spaceId}"></span>`;
    }).join('');

    const statusText = player.bankrupt ? '💀 ODPADŁ' :
                       player.inJail   ? `🔒 Izolacja (${player.jailTurns}/${MAX_JAIL_TURNS})` :
                       player.getOutOfJailCards > 0 ? `🎫 ×${player.getOutOfJailCards}` : '';

    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-token-sm" style="background:${player.color}; background-image:url('${getPawnIcon(player.pawn)}')">${getInitial(player.name)}</div>
        <div class="player-name-label">${escHtml(player.name)}${player.isAI ? '<span class="ai-badge">🤖 AI</span>' : ''}</div>
        <div class="player-money-label"><span class="stat-money">${formatMoney(player.money)}</span> · <span class="stat-prestige">⭐${player.prestige}</span></div>
      </div>
      <div class="player-status-row">${statusText} · <span class="stat-energy">🔋${player.energy}</span> <span class="stat-ethics">⚖️${player.ethics}</span> <span class="stat-burnout">🔥${player.burnout}</span> · Pole: ${player.position}</div>
      <div class="player-props-mini">${propDots}</div>`;
    list.appendChild(card);
  });
}

function renderPropertiesPanel(gs) {
  const panel = document.getElementById('properties-panel');
  if (!panel) return;
  panel.innerHTML = '';

  const groups = {};
  Object.entries(GROUP_COLORS).forEach(([g]) => { groups[g] = []; });
  groups['railroad'] = [];
  groups['utility']  = [];

  BOARD_SPACES.forEach(space => {
    const ps = gs.properties[space.id];
    if (!ps) return;
    const owner = gs.players[ps.owner];
    const key = space.group || space.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ space, ps, owner });
  });

  Object.entries(groups).forEach(([key, items]) => {
    if (!items.length) return;
    const groupDiv = document.createElement('div');
    groupDiv.className = 'prop-group';
    const color = GROUP_COLORS[key] || '#666';
    groupDiv.innerHTML = `
      <div class="prop-group-title">
        <span class="prop-group-color" style="background:${color}"></span>
        ${GROUP_NAMES[key] || (key === 'railroad' ? 'Stacje' : key === 'utility' ? 'Zakłady' : key)}
      </div>`;

    items.forEach(({ space, ps, owner }) => {
      const buildings = ps.hotel ? '🏨' : '🏠'.repeat(ps.houses || 0);
      const mortgageLabel = ps.mortgaged ? ' [ZASTAW]' : '';
      const row = document.createElement('div');
      row.className = 'prop-row';
      row.innerHTML = `
        <span class="prop-mini-dot" style="background:${owner ? owner.color : '#999'}"></span>
        <span class="prop-row-name">${space.name}${mortgageLabel}</span>
        <span class="prop-row-buildings">${buildings}</span>
        <span class="prop-row-price">${space.price || ''}${space.price ? ' zł' : ''}</span>`;
      groupDiv.appendChild(row);
    });
    panel.appendChild(groupDiv);
  });

  if (!panel.innerHTML) panel.innerHTML = '<div style="opacity:.5;font-size:.8rem;padding:8px">Brak kupionych własności.</div>';
}

function renderLogPanel(gs) {
  const list = document.getElementById('log-list');
  if (!list) return;
  list.innerHTML = '';
  gs.log.forEach(entry => {
    const div = document.createElement('div');
    div.className = `log-entry${entry.isTurn ? ' log-turn' : ''}`;
    div.textContent = entry.text;
    list.appendChild(div);
  });
}

// ============================================================
// ACTION BUTTONS
// ============================================================
function updateActionButtons(gs) {
  const cur = gs.players[gs.currentPlayerIndex];
  if (!cur) return;

  // In online mode, only show interactive buttons when it's my turn.
  // In local mode, hide interactive buttons when an AI player is acting.
  const curIsAI = gameMode === 'local' && cur.isAI;
  const myTurn = !curIsAI && (gameMode === 'local' || gs.currentPlayerIndex === myPlayerId);

  const phase = gs.phase;
  const guidance = getTurnGuidance(gs, { cur, myTurn, curIsAI });
  let nextStepText = guidance.recommendedMove;
  let primaryNextButtonId = null;

  const actionButtonIds = [
    'btn-roll',
    'btn-pay-jail',
    'btn-jail-card',
    'btn-end-turn',
    'btn-build',
    'btn-mortgage',
  ];

  function setDisabledReason(button, reason) {
    if (!button) return;
    button.dataset.disabledReason = reason || '';
    button.title = button.disabled ? (reason || 'Niedostępne teraz') : '';
  }

  function clearGuidedState() {
    actionButtonIds.forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.classList.remove('is-primary-next', 'is-secondary-option');
    });
  }

  // Current player banner
  const banner = document.getElementById('current-player-banner');
  if (banner) {
    if (gameMode === 'local') {
      banner.textContent = curIsAI ? `Tura: ${cur.name} 🤖` : `Tura: ${cur.name}`;
      banner.style.color = cur.color;
    } else {
      banner.textContent = myTurn ? `Twoja tura (${cur.name})` : `Tura: ${cur.name}`;
      banner.style.color = myTurn ? cur.color : 'rgba(255,255,255,.45)';
    }
  }
  updateTurnStatusPanel(gs, { cur, myTurn, curIsAI, guidance });

  const phaseInfo = document.getElementById('phase-info');
  if (phaseInfo) {
    if (curIsAI) {
      phaseInfo.innerHTML = `<span class="ai-thinking-indicator">🤖 AI myśli…</span>`;
    } else {
      phaseInfo.innerHTML = 'Szczegóły znajdziesz wyżej w panelu „Status tury”.';
    }
  }

  clearGuidedState();

  // Roll
  const btnRoll = document.getElementById('btn-roll');
  btnRoll.style.display  = (phase === 'rolling' || (phase === 'end-turn' && gs.doubles > 0)) ? 'flex' : 'none';
  btnRoll.disabled       = !myTurn || isAnimating;
  if (btnRoll.style.display !== 'none') {
    if (!myTurn) setDisabledReason(btnRoll, 'To nie jest Twoja tura.');
    else if (isAnimating) setDisabledReason(btnRoll, 'Poczekaj na zakończenie animacji ruchu.');
    else setDisabledReason(btnRoll, '');
  }

  // Jail buttons
  const btnPayJail  = document.getElementById('btn-pay-jail');
  const btnJailCard = document.getElementById('btn-jail-card');
  if (cur.inJail && phase === 'rolling' && myTurn && !isAnimating) {
    btnPayJail.style.display  = 'flex';
    btnJailCard.style.display = cur.getOutOfJailCards > 0 ? 'flex' : 'none';
  } else {
    btnPayJail.style.display  = 'none';
    btnJailCard.style.display = 'none';
  }
  setDisabledReason(btnPayJail, !myTurn ? 'To nie jest Twoja tura.' : 'Dostępne tylko podczas kryzysu.');
  setDisabledReason(btnJailCard, cur.getOutOfJailCards > 0 ? '' : 'Brak karty wyjścia z kryzysu.');

  // End turn
  const btnEnd = document.getElementById('btn-end-turn');
  btnEnd.style.display = 'flex';
  btnEnd.disabled = (phase !== 'end-turn') || !myTurn || isAnimating;
  if (phase !== 'end-turn') setDisabledReason(btnEnd, 'Najpierw wykonaj obowiązkowe działania tej fazy.');
  else if (!myTurn) setDisabledReason(btnEnd, 'To nie jest Twoja tura.');
  else if (isAnimating) setDisabledReason(btnEnd, 'Poczekaj na zakończenie animacji ruchu.');
  else setDisabledReason(btnEnd, '');

  // Build / Mortgage (available during rolling or end-turn on your turn)
  const canManage = myTurn && (phase === 'rolling' || phase === 'end-turn');
  const hasProps  = cur.properties && cur.properties.length > 0;

  const btnBuild    = document.getElementById('btn-build');
  const btnMortgage = document.getElementById('btn-mortgage');
  btnBuild.style.display    = canManage && hasProps ? 'flex' : 'none';
  btnMortgage.style.display = canManage && hasProps ? 'flex' : 'none';

  const managementDisabledReason = !myTurn
    ? 'To nie jest Twoja tura.'
    : !hasProps
      ? 'Nie masz jeszcze aktywów do zarządzania.'
      : (phase === 'rolling' || phase === 'end-turn')
        ? ''
        : 'Zarządzanie aktywami dostępne tylko na początku lub końcu tury.';
  setDisabledReason(btnBuild, managementDisabledReason);
  setDisabledReason(btnMortgage, managementDisabledReason);

  if (!curIsAI) {
    if (myTurn && phase === 'rolling') {
      if (cur.inJail) {
        if (cur.getOutOfJailCards > 0) {
          primaryNextButtonId = 'btn-jail-card';
        } else {
          primaryNextButtonId = 'btn-pay-jail';
        }
      } else {
        primaryNextButtonId = 'btn-roll';
      }
    } else if (myTurn && phase === 'end-turn') {
      if (gs.doubles > 0) {
        primaryNextButtonId = 'btn-roll';
      } else {
        primaryNextButtonId = 'btn-end-turn';
      }
    }

    actionButtonIds.forEach((id) => {
      const button = document.getElementById(id);
      if (!button || button.style.display === 'none') return;
      if (id === primaryNextButtonId && !button.disabled) button.classList.add('is-primary-next');
      else button.classList.add('is-secondary-option');
    });

    if (phaseInfo) {
      phaseInfo.innerHTML = 'Szczegóły znajdziesz wyżej w panelu „Status tury”.';
    }
  }
}

// ============================================================
// GAME MECHANICS (LOCAL)
// ============================================================

function doRoll(gs) {
  if (gs.phase !== 'rolling') return;
  const player = gs.players[gs.currentPlayerIndex];
  if (!player || player.bankrupt) return;

  const d1 = rollDie();
  const d2 = rollDie();
  gs.dice = [d1, d2];
  gs.rolledThisTurn = true;
  const isDoubles = d1 === d2;

  addLog(gs, `${player.name} rzucił ${DICE_FACES[d1]} ${DICE_FACES[d2]}${isDoubles ? ' — DUBLET!' : ''}.`);
  playSfx('dice');

  // Animate dice
  animateDiceOnBoard(d1, d2);
  ['die1','die2','center-die1','center-die2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('rolling');
      void el.offsetWidth;
      el.classList.add('rolling');
      let ticks = 0;
      const timer = setInterval(() => {
        ticks++;
        el.textContent = DICE_FACES[rollDie()];
        if (ticks >= 8) clearInterval(timer);
      }, 55);
    }
  });

  if (player.inJail) {
    handleJailRoll(gs, player, d1, d2, isDoubles);
    return;
  }

  if (isDoubles) {
    gs.doubles++;
    if (gs.doubles >= 3) {
      addLog(gs, `${player.name} rzucił trzy dublety! Idzie do Izolacji.`);
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

function handleJailRoll(gs, player, d1, d2, isDoubles) {
  if (isDoubles) {
    player.inJail    = false;
    player.jailTurns = 0;
    addLog(gs, `${player.name} rzucił dublet i wyszedł z Izolacji!`);
    doMove(gs, player, d1 + d2);
  } else {
    player.jailTurns++;
    if (player.jailTurns >= MAX_JAIL_TURNS) {
      player.money    -= JAIL_FINE;
      player.inJail    = false;
      player.jailTurns = 0;
      addLog(gs, `${player.name} zapłacił karę ${JAIL_FINE} zł i wyszedł z Izolacji.`);
      checkBankruptcy(gs, player, null);
      doMove(gs, player, d1 + d2);
    } else {
      addLog(gs, `${player.name} zostaje w Izolacji (${player.jailTurns}/${MAX_JAIL_TURNS}).`);
      gs.phase = 'end-turn';
    }
  }
}

function doMove(gs, player, steps) {
  const oldPos = player.position;
  gs.phase = 'moving';
  playSfx('move');
  isAnimating = true;

  startMoveAnimation(gs, player, oldPos, steps, () => {
    const newPos = (oldPos + steps) % 40;
    if (oldPos + steps >= 40) {
      applyPlayerDelta(gs, player, { money: GO_MONEY, prestige: 2, energy: 1 }, 'START');
      addLog(gs, `${player.name} przeszedł przez START — bonus miesięczny (+${GO_MONEY} zł, +2 prestiżu, +1 energii).`);
      showToast(`${player.name} przeszedł przez START! +${GO_MONEY} zł / +2⭐ / +1🔋`);
    }
    player.position = newPos;
    isAnimating = false;
    animatingPlayerData = null;
    const spaceName = BOARD_SPACES[newPos] ? BOARD_SPACES[newPos].name : `pole ${newPos}`;
    addLog(gs, `${player.name} wylądował na: ${spaceName}.`);
    handleLanding(gs, player);
    updateUI(gs);
  });
}

function startMoveAnimation(gs, player, oldPos, steps, onComplete) {
  let step = 0;
  // Target total animation ~1800ms; minimum 120ms per step to avoid overly fast movement
  const stepDelay = Math.max(120, Math.floor(1800 / steps));

  function tick() {
    step++;
    animatingPlayerData = { playerId: player.id, animPos: (oldPos + step) % 40 };
    renderTokens(gs);
    // Play move sound only on every other step to avoid audio spam on long moves
    if (step % 2 === 0) playSfx('move');
    if (step < steps) {
      setTimeout(tick, stepDelay);
    } else {
      setTimeout(onComplete, 300);
    }
  }
  setTimeout(tick, stepDelay);
}

function handleLanding(gs, player) {
  const space = BOARD_SPACES[player.position];
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
        applyPlayerDelta(gs, player, { money: -space.amount, energy: 10, ethics: 8, burnout: -8 }, space.name);
        addLog(gs, `${player.name} inwestuje w regenerację: -${space.amount} zł, ale odzyskuje zasoby.`);
        showToast('Terapia własna: -100 zł, +energia, +etyka');
      } else {
        applyPlayerDelta(gs, player, { money: -space.amount, energy: -2 }, space.name);
        addLog(gs, `${player.name} zapłacił koszt systemowy: ${space.amount} zł.`);
        showToast(`Opłata: -${space.amount} zł`);
      }
      checkBankruptcy(gs, player, null);
      gs.phase = 'end-turn';
      break;
    case 'card':
      gs.phase = 'card-select';
      gs.pendingCardDeck = space.deck;
      addLog(gs, `${player.name} musi dobrać kartę ${space.deck === 'insight' ? 'Superwizji' : 'Sesji'}. Kliknij stos kart!`);
      break;
    case 'jail':
      addLog(gs, `${player.name} ma przystanek: ${space.name}.`);
      gs.phase = 'end-turn';
      break;
    case 'gotojail':
      sendToJail(gs, player);
      gs.phase = 'end-turn';
      break;
    case 'freeparking':
      addLog(gs, `${player.name} zatrzymał się na Wolnej Woli.`);
      gs.phase = 'end-turn';
      break;
    default:
      gs.phase = 'end-turn';
  }
}

function handlePropertyLanding(gs, player, space) {
  const propState = gs.properties[space.id];

  if (!propState) {
    // Unowned
    if (player.money >= space.price) {
      gs.phase      = 'buying';
      gs.pendingBuy = { spaceId: space.id };
      // Modal will be opened in updateUI
    } else {
      addLog(gs, `${player.name} nie może kupić ${space.name} (brak środków).`);
      gs.phase = 'end-turn';
    }
  } else if (propState.owner === player.id) {
    addLog(gs, `${player.name} wylądował na swojej własności.`);
    applyPlayerDelta(gs, player, { burnout: -1 }, 'spokojniejsza tura');
    gs.phase = 'end-turn';
  } else if (propState.mortgaged) {
    addLog(gs, `${space.name} jest zastawiona — brak czynszu.`);
    gs.phase = 'end-turn';
  } else {
    const owner = gs.players[propState.owner];
    if (owner && !owner.bankrupt) {
      const rent = calculateRent(gs, space, propState);
      applyPlayerDelta(gs, player, { money: -rent, energy: -4, burnout: 3 }, 'czynsz i obciążenie');
      applyPlayerDelta(gs, owner, { money: rent, prestige: 1, energy: -1 }, 'obsługa kolejnego klienta');
      addLog(gs, `${player.name} zapłacił ${rent} zł czynszu graczowi ${owner.name}.`);
      showToast(`Czynsz: -${rent} zł → ${owner.name}`);
      playSfx('rent');
      checkBankruptcy(gs, player, propState.owner);
    }
    gs.phase = 'end-turn';
  }
}

function calculateRent(gs, space, propState) {
  if (space.type === 'railroad') {
    const owned = BOARD_SPACES.filter(s =>
      s.type === 'railroad' && gs.properties[s.id] && gs.properties[s.id].owner === propState.owner
    ).length;
    return 25 * Math.pow(2, owned - 1); // 25, 50, 100, 200
  }
  if (space.type === 'utility') {
    const owned = BOARD_SPACES.filter(s =>
      s.type === 'utility' && gs.properties[s.id] && gs.properties[s.id].owner === propState.owner
    ).length;
    const diceTotal = gs.dice[0] + gs.dice[1];
    return diceTotal * (owned >= 2 ? 10 : 4);
  }
  // Regular property
  if (propState.hotel)        return space.rent[5];
  if (propState.houses > 0)   return space.rent[Math.min(propState.houses, 4)];

  // Check color monopoly
  const groupProps = BOARD_SPACES.filter(s => s.type === 'property' && s.group === space.group);
  const ownsAll    = groupProps.every(s => gs.properties[s.id] && gs.properties[s.id].owner === propState.owner);
  return ownsAll ? space.rent[0] * 2 : space.rent[0];
}

function sendToJail(gs, player) {
  player.position  = JAIL_POSITION;
  player.inJail    = true;
  player.jailTurns = 0;
  applyPlayerDelta(gs, player, { energy: -10, burnout: 10, prestige: -4 }, 'kryzys zawodowy');
  addLog(gs, `${player.name} trafia do Izolacji!`);
  showToast(`${player.name} trafia do Izolacji! 🔒`);
  playSfx('jail');
}

// ============================================================
// CARD DRAWING
// ============================================================
function doDrawCard(gs, player, deck) {
  let card;
  animateCardDraw(deck);
  if (deck === 'insight') {
    if (!gs.insightCards.length) {
      gs.insightCards = shuffleArray([...gs.insightDiscard]);
      gs.insightDiscard = [];
    }
    card = gs.insightCards.pop();
    if (card.action !== 'get-out-jail') gs.insightDiscard.push(card);
  } else {
    if (!gs.sessionCards.length) {
      gs.sessionCards = shuffleArray([...gs.sessionDiscard]);
      gs.sessionDiscard = [];
    }
    card = gs.sessionCards.pop();
    if (card.action !== 'get-out-jail') gs.sessionDiscard.push(card);
  }

  addLog(gs, `${player.name} ciągnie kartę ${deck === 'insight' ? 'Szansy' : 'Społeczności'}: "${card.text}"`);
  playSfx('card');
  gs.phase       = 'card';
  gs.pendingCard = { card, deck, playerId: player.id };
}

function doCardOk(gs) {
  if (gs.phase !== 'card' || !gs.pendingCard) return;
  const { card } = gs.pendingCard;
  const player   = gs.players[gs.currentPlayerIndex];
  gs.pendingCard = null;
  applyCardEffect(gs, player, card);
}

function applyCardEffect(gs, player, card) {
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
      if (card.ethicsIfNoShield && player.supervisionShield <= 0) {
        applyPlayerDelta(gs, player, { ethics: card.ethicsIfNoShield }, 'brak superwizji');
      }
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
      } else {
        addLog(gs, `${player.name} ignoruje trend i zachowuje status quo.`);
      }
      break;
    case 'choice-rest': {
      const rest = askPlayerChoice(
        'Długi weekend bez pacjentów: OK = odpoczynek (-100 zł, +10 energii), Anuluj = nadrabianie (+120 zł, -8 energii, +6 wypalenia).'
      );
      if (rest) applyPlayerDelta(gs, player, { money: -100, energy: 10 }, 'odpoczynek');
      else applyPlayerDelta(gs, player, { money: 120, energy: -8, burnout: 6 }, 'nadrabianie grafiku');
      break;
    }
    case 'choice-boundary': {
      const clarify = askPlayerChoice(
        'Mylenie psychologa z psychiatrą: OK = spokojnie wyjaśniasz (+1 etyki), Anuluj = tracisz cierpliwość (-3 energii).'
      );
      if (clarify) applyPlayerDelta(gs, player, { ethics: 1 }, 'wyjaśnienie roli');
      else applyPlayerDelta(gs, player, { energy: -3 }, 'frustracja');
      break;
    }
    case 'choice-pricing': {
      const keepPrestige = askPlayerChoice(
        'Zaniżanie cen przez konkurencję: OK = bronisz stawki (-100 zł), Anuluj = tniesz ceny (-5 prestiżu).'
      );
      if (keepPrestige) applyPlayerDelta(gs, player, { money: -100 }, 'utrzymanie stawek');
      else applyPlayerDelta(gs, player, { prestige: -5 }, 'obniżka cen');
      break;
    }
    case 'choice-gossip': {
      const ignore = askPlayerChoice(
        'Plotki środowiskowe: OK = ignorujesz (-5 prestiżu), Anuluj = angażujesz się (-5 energii).'
      );
      if (ignore) applyPlayerDelta(gs, player, { prestige: -5 }, 'plotki środowiskowe');
      else applyPlayerDelta(gs, player, { energy: -5 }, 'dyskusje środowiskowe');
      break;
    }
    case 'choice-pricing-lite': {
      const payCash = askPlayerChoice(
        'Dyskusja o stawkach: OK = płacisz kosztem finansowym (-50 zł), Anuluj = kosztem energii (-5 energii).'
      );
      if (payCash) applyPlayerDelta(gs, player, { money: -50 }, 'kompromis finansowy');
      else applyPlayerDelta(gs, player, { energy: -5 }, 'koszt emocjonalny');
      break;
    }
    case 'choice-boundary-hard': {
      const holdLine = askPlayerChoice(
        'Pacjent testuje granice: OK = bronisz granic (-5 energii), Anuluj = odpuszczasz (-3 etyki).'
      );
      if (holdLine) applyPlayerDelta(gs, player, { energy: -5, ethics: 1 }, 'utrzymanie granic');
      else applyPlayerDelta(gs, player, { ethics: -3 }, 'rozmycie granic');
      break;
    }
    case 'collect':
      applyPlayerDelta(gs, player, { money: card.amount }, 'karta');
      addLog(gs, `${player.name} otrzymuje ${card.amount} zł.`);
      break;
    case 'pay':
      applyPlayerDelta(gs, player, { money: -card.amount }, 'karta');
      addLog(gs, `${player.name} płaci ${card.amount} zł.`);
      checkBankruptcy(gs, player, null);
      break;
    case 'advance-to-go':
      player.position = 0;
      player.money   += GO_MONEY;
      addLog(gs, `${player.name} idzie na START i otrzymuje ${GO_MONEY} zł.`);
      gs.phase = 'end-turn';
      return;
    case 'advance-to': {
      if (card.target < player.position) {
        player.money += GO_MONEY;
        addLog(gs, `${player.name} przeszedł przez START: +${GO_MONEY} zł.`);
      }
      player.position = card.target;
      handleLanding(gs, player);
      return;
    }
    case 'move-forward': {
      const newPos = (player.position + card.steps) % 40;
      if (newPos < player.position) {
        player.money += GO_MONEY;
        addLog(gs, `${player.name} przeszedł przez START: +${GO_MONEY} zł.`);
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
      addLog(gs, `${player.name} otrzymuje kartę "Wyjdź z Izolacji za darmo".`);
      break;
    case 'collect-from-each':
      gs.players.forEach(p => {
        if (p.id !== player.id && !p.bankrupt) {
          // Only collect what the other player can actually pay (non-negative)
          const amt = Math.min(card.amount, Math.max(0, p.money));
          applyPlayerDelta(gs, p, { money: -amt }, 'karta');
          applyPlayerDelta(gs, player, { money: amt }, 'karta');
        }
      });
      addLog(gs, `${player.name} otrzymuje ${card.amount} zł od każdego gracza.`);
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
      addLog(gs, `${player.name} płaci ${total} zł za budynki.`);
      checkBankruptcy(gs, player, null);
      break;
    }
    default:
      break;
  }
  gs.phase = 'end-turn';
}

// ============================================================
// BUY / PASS
// ============================================================
function doBuy(gs) {
  if (!gs.pendingBuy) return;
  const { spaceId } = gs.pendingBuy;
  const space  = BOARD_SPACES[spaceId];
  const player = gs.players[gs.currentPlayerIndex];

  if (!space || !player || player.money < space.price) return;

  applyPlayerDelta(gs, player, { money: -space.price, prestige: 2, energy: -3, burnout: 2 }, 'zakup aktywa');
  gs.properties[spaceId] = { owner: player.id, houses: 0, hotel: false, mortgaged: false };
  if (!player.properties.includes(spaceId)) player.properties.push(spaceId);

  addLog(gs, `${player.name} kupił ${space.name} za ${space.price} zł.`);
  showToast(`${player.name} kupił ${space.name}!`);
  playSfx('buy');
  gs.pendingBuy = null;
  gs.phase      = 'end-turn';
}

function doPassBuy(gs) {
  addLog(gs, `${gs.players[gs.currentPlayerIndex].name} zrezygnował z zakupu.`);
  gs.pendingBuy = null;
  gs.phase      = 'end-turn';
}

// ============================================================
// JAIL
// ============================================================
function doPayJail(gs) {
  const player = gs.players[gs.currentPlayerIndex];
  if (!player.inJail) return;
  player.money    -= JAIL_FINE;
  player.inJail    = false;
  player.jailTurns = 0;
  addLog(gs, `${player.name} zapłacił ${JAIL_FINE} zł i wyszedł z Izolacji.`);
  playSfx('jail');
  checkBankruptcy(gs, player, null);
  gs.phase = 'rolling';
}

function doUseJailCard(gs) {
  const player = gs.players[gs.currentPlayerIndex];
  if (!player.inJail || player.getOutOfJailCards <= 0) return;
  player.getOutOfJailCards--;
  player.inJail    = false;
  player.jailTurns = 0;
  addLog(gs, `${player.name} użył karty i wyszedł z Izolacji.`);
  playSfx('card');
  gs.phase = 'rolling';
}

// ============================================================
// END TURN
// ============================================================
function doEndTurn(gs) {
  if (gs.phase !== 'end-turn') return;
  const cur = gs.players[gs.currentPlayerIndex];
  checkPlayerVitalStatus(gs, cur);

  // Double = roll again
  if (gs.doubles > 0 && !cur.inJail && !cur.bankrupt) {
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
  if (next === 0) {
    gs.roundsCompleted++;
  }
  gs.doubles            = 0;
  gs.turn++;
  gs.phase              = 'rolling';
  gs.rolledThisTurn     = false;

  const active = gs.players.filter(p => !p.bankrupt);
  if (active.length <= 1) {
    gs.winner = active[0] ? active[0].id : null;
    gs.phase = 'end';
    if (active[0]) addLog(gs, `🏆 ${active[0].name} wygrywa przez przetrwanie rynku.`);
    playSfx('win');
    return;
  }
  if (gs.roundsCompleted >= MAX_ROUNDS) {
    const sorted = [...active].sort((a, b) => getPrestigeScore(b) - getPrestigeScore(a));
    gs.winner = sorted[0].id;
    gs.phase = 'end';
    addLog(gs, `🏁 Koniec ${MAX_ROUNDS} rund. Wygrywa ${sorted[0].name} bilansem zawodowym.`);
    playSfx('win');
    return;
  }

  addLog(gs, `--- Tura gracza ${gs.players[next].name} ---`, true);
  playSfx('turn');
}

// ============================================================
// AI PLAYER LOGIC
// ============================================================

/**
 * Schedule an AI step if the current player is an AI.
 * A 900 ms delay lets the human observer see the board state before
 * the AI acts.  The flag `aiStepPending` prevents stacking callbacks.
 */
function scheduleAiTurnIfNeeded(gs) {
  if (gameMode !== 'local' || !gs || gs.phase === 'end') return;
  const cur = gs.players[gs.currentPlayerIndex];
  if (!cur || cur.bankrupt || !cur.isAI) return;
  if (aiStepPending) return;
  aiStepPending = true;
  setTimeout(() => {
    aiStepPending = false;
    if (!localGame || localGame.phase === 'end') return;
    const player = localGame.players[localGame.currentPlayerIndex];
    if (!player || !player.isAI) return;
    aiStep(localGame);
    updateUI(localGame);
  }, 900);
}

/**
 * Execute one AI decision based on the current game phase.
 */
function aiStep(gs) {
  const player = gs.players[gs.currentPlayerIndex];
  if (!player || !player.isAI || player.bankrupt) return;

  switch (gs.phase) {
    case 'rolling': {
      if (player.inJail) {
        if (player.getOutOfJailCards > 0) {
          doUseJailCard(gs);
        } else if (player.money >= JAIL_FINE &&
                   (Math.random() < 0.5 || player.jailTurns >= MAX_JAIL_TURNS - 1)) {
          doPayJail(gs);
        } else {
          doRoll(gs);
        }
      } else {
        doRoll(gs);
      }
      break;
    }
    case 'buying': {
      if (gs.pendingBuy) {
        const space = BOARD_SPACES[gs.pendingBuy.spaceId];
        // Buy when the player can afford it and keeps a cash buffer of 300 zł.
        if (space && player.money >= space.price + AI_CASH_BUFFER) {
          doBuy(gs);
        } else {
          doPassBuy(gs);
        }
      }
      break;
    }
    case 'card': {
      doCardOk(gs);
      break;
    }
    case 'end-turn': {
      doEndTurn(gs);
      break;
    }
    default:
      break;
  }
}

// ============================================================
// BANKRUPTCY
// ============================================================
function checkPlayerVitalStatus(gs, player) {
  if (!player || player.bankrupt) return;
  if (player.energy > 0 && player.ethics > 0 && player.burnout < CRITICAL_BURNOUT) return;
  player.bankrupt = true;
  if (player.energy <= 0) addLog(gs, `💥 ${player.name} odpada: energia spadła do zera.`);
  else if (player.ethics <= 0) addLog(gs, `⚠️ ${player.name} odpada: etyka spadła do zera.`);
  else addLog(gs, `🔥 ${player.name} odpada: krytyczne wypalenie.`);
  showToast(`${player.name} wypada z gry.`);
}

function checkBankruptcy(gs, player, creditorId) {
  checkPlayerVitalStatus(gs, player);
  if (player.bankrupt && player.money >= 0) {
    const activeVitals = gs.players.filter(p => !p.bankrupt);
    if (activeVitals.length === 1) {
      gs.winner = activeVitals[0].id;
      gs.phase = 'end';
      playSfx('win');
    }
    return;
  }
  if (player.money >= 0) return;

  // ============================================================
  // Auto-liquidation: sell houses (half price), then mortgage properties,
  // before declaring the player bankrupt.
  // ============================================================
  player.properties.forEach(spaceId => {
    const sp = BOARD_SPACES[spaceId];
    const ps = gs.properties[spaceId];
    if (!sp || !ps) return;
    while ((ps.houses > 0 || ps.hotel) && player.money < 0) {
      const sell = Math.floor(sp.houseCost / 2);
      if (ps.hotel) { ps.hotel = false; ps.houses = 4; }
      else ps.houses--;
      player.money += sell;
    }
    // Auto-mortgage
    if (player.money < 0 && !ps.mortgaged && !ps.hotel && ps.houses === 0) {
      player.money += sp.mortgage;
      ps.mortgaged = true;
    }
  });

  if (player.money >= 0) return;

  // Bankrupt
  player.bankrupt = true;
  addLog(gs, `💀 ${player.name} zbankrutował!`);
  showToast(`${player.name} zbankrutował! 💀`);
  playSfx('bankrupt');

  if (creditorId !== null && gs.players[creditorId] && !gs.players[creditorId].bankrupt) {
    const creditor = gs.players[creditorId];
    player.properties.forEach(spaceId => {
      const ps = gs.properties[spaceId];
      if (ps) {
        ps.owner = creditorId;
        ps.mortgaged = false;
        if (!creditor.properties.includes(spaceId)) creditor.properties.push(spaceId);
      }
    });
  } else {
    player.properties.forEach(spaceId => {
      delete gs.properties[spaceId];
    });
  }
  player.properties = [];
  player.money      = 0;

  const active = gs.players.filter(p => !p.bankrupt);
  if (active.length === 1) {
    gs.winner = active[0].id;
    gs.phase  = 'end';
    addLog(gs, `🏆 ${active[0].name} wygrał grę!`);
    playSfx('win');
  }
}

// ============================================================
// BUILDING
// ============================================================
function openBuildModal(gs) {
  const player = gs.players[gs.currentPlayerIndex];
  if (!player) return;

  const container = document.getElementById('build-grid-container');
  container.innerHTML = '';

  // Find buildable/sellable properties
  player.properties.forEach(spaceId => {
    const sp = BOARD_SPACES[spaceId];
    const ps = gs.properties[spaceId];
    if (!sp || !ps || sp.type !== 'property' || ps.mortgaged) return;

    const groupProps = BOARD_SPACES.filter(s => s.type === 'property' && s.group === sp.group);
    const ownsAll    = groupProps.every(s => gs.properties[s.id] && gs.properties[s.id].owner === player.id);
    if (!ownsAll) return;

    const buildCost = ps.houses >= 4 ? sp.hotelCost : sp.houseCost;
    const canBuild = !ps.hotel && player.money >= buildCost;
    const canSell  = ps.hotel || ps.houses > 0;
    const currentBuildings = ps.hotel ? '🏆 Pełna specjalizacja' : (ps.houses > 0 ? `📜 ×${ps.houses}` : '(puste)');

    const card = document.createElement('div');
    card.className = `build-card${canBuild ? '' : ' disabled'}`;
    card.innerHTML = `
      <div class="b-name">${sp.name}</div>
      <div class="b-current">${currentBuildings}</div>
      <div class="b-cost">Koszt: ${buildCost} zł</div>
      <div style="display:flex;gap:4px;margin-top:6px">
        ${canBuild ? `<button class="btn btn-success btn-sm" data-action="build" data-id="${spaceId}">+🏠</button>` : ''}
        ${canSell  ? `<button class="btn btn-danger  btn-sm" data-action="sell"  data-id="${spaceId}">-🏠</button>` : ''}
      </div>`;
    container.appendChild(card);
  });

  if (!container.innerHTML) {
    container.innerHTML = '<p style="color:#666;font-size:.85rem">Nie masz pełnych grup, aby budować.</p>';
  }

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action  = btn.dataset.action;
      const spaceId = parseInt(btn.dataset.id);
      if (gameMode === 'local') {
        if (action === 'build') doBuildHouse(gs, player, spaceId);
        else                    doSellHouse(gs, player, spaceId);
        closeModal('modal-build');
        updateUI(gs);
      } else {
        sendOnlineAction(action === 'build' ? 'build-house' : 'sell-house', { spaceId });
        closeModal('modal-build');
      }
    });
  });

  openModal('modal-build');
}

function doBuildHouse(gs, player, spaceId) {
  const sp = BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps || ps.mortgaged || ps.hotel) return;
  const buildCost = ps.houses >= 4 ? sp.hotelCost : sp.houseCost;
  if (player.money < buildCost) { showToast('Za mało pieniędzy!'); return; }

  const groupProps = BOARD_SPACES.filter(s => s.type === 'property' && s.group === sp.group);
  const ownsAll    = groupProps.every(s => gs.properties[s.id] && gs.properties[s.id].owner === player.id);
  if (!ownsAll) return;

  // Even building
  const minHouses = Math.min(...groupProps.map(s => {
    const p = gs.properties[s.id];
    return p ? (p.hotel ? 5 : (p.houses || 0)) : 0;
  }));
  const curH = ps.hotel ? 5 : (ps.houses || 0);
  if (curH > minHouses) { showToast('Budujesz nierównomiernie!'); return; }

  player.money -= buildCost;

  if (ps.houses >= 4) {
    ps.houses = 0;
    ps.hotel  = true;
    addLog(gs, `${player.name} rozwinął pełną specjalizację na ${sp.name}.`);
    showToast(`Pełna specjalizacja na ${sp.name}!`);
    playSfx('build');
  } else {
    ps.houses = (ps.houses || 0) + 1;
    addLog(gs, `${player.name} dokupił certyfikat na ${sp.name} (${ps.houses} domów).`);
    showToast(`Dodano certyfikat na ${sp.name}!`);
    playSfx('build');
  }
}

function doSellHouse(gs, player, spaceId) {
  const sp = BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps) return;

  const sell = ps.hotel ? Math.floor(sp.hotelCost / 2) : Math.floor(sp.houseCost / 2);
  if (ps.hotel) {
    ps.hotel  = false;
    ps.houses = 4;
    player.money += sell;
    addLog(gs, `${player.name} wycofał pełną specjalizację na ${sp.name} za ${sell} zł.`);
    playSfx('sell');
  } else if (ps.houses > 0) {
    ps.houses--;
    player.money += sell;
    addLog(gs, `${player.name} sprzedał certyfikat na ${sp.name} za ${sell} zł.`);
    playSfx('sell');
  }
}

// ============================================================
// MORTGAGE
// ============================================================
function openMortgageModal(gs) {
  const player = gs.players[gs.currentPlayerIndex];
  if (!player) return;

  const list = document.getElementById('mortgage-list');
  list.innerHTML = '';

  player.properties.forEach(spaceId => {
    const sp = BOARD_SPACES[spaceId];
    const ps = gs.properties[spaceId];
    if (!sp || !ps) return;

    const canMortgage   = !ps.mortgaged && !ps.hotel && !ps.houses;
    const canUnmortgage = ps.mortgaged;
    const unmortgageCost = Math.floor(sp.mortgage * 1.1);

    const row = document.createElement('div');
    row.className = 'mortgage-row';
    row.innerHTML = `
      <span style="flex:1;font-size:.8rem">${sp.name}${ps.mortgaged ? ' [ZASTAW]' : ''}</span>
      ${canMortgage   ? `<button class="btn btn-warning btn-sm" data-action="mortgage"   data-id="${spaceId}">Zastaw (+${sp.mortgage})</button>` : ''}
      ${canUnmortgage ? `<button class="btn btn-success btn-sm" data-action="unmortgage" data-id="${spaceId}">Odkup (-${unmortgageCost})</button>` : ''}`;
    list.appendChild(row);
  });

  if (!list.innerHTML) {
    list.innerHTML = '<p style="color:#666;font-size:.85rem">Brak zarządzalnych własności.</p>';
  }

  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action  = btn.dataset.action;
      const spaceId = parseInt(btn.dataset.id);
      if (gameMode === 'local') {
        if (action === 'mortgage')   doMortgage(gs, player, spaceId);
        else                         doUnmortgage(gs, player, spaceId);
        closeModal('modal-mortgage');
        updateUI(gs);
      } else {
        sendOnlineAction(action, { spaceId });
        closeModal('modal-mortgage');
      }
    });
  });

  openModal('modal-mortgage');
}

function doMortgage(gs, player, spaceId) {
  const sp = BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps || ps.mortgaged || ps.hotel || ps.houses) return;
  player.money += sp.mortgage;
  ps.mortgaged = true;
  addLog(gs, `${player.name} zastawił ${sp.name} za ${sp.mortgage} zł.`);
  showToast(`Zastawiono ${sp.name} +${sp.mortgage} zł`);
  playSfx('mortgage');
}

function doUnmortgage(gs, player, spaceId) {
  const sp = BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps || !ps.mortgaged) return;
  const cost = Math.floor(sp.mortgage * 1.1);
  if (player.money < cost) { showToast('Za mało pieniędzy!'); return; }
  player.money -= cost;
  ps.mortgaged = false;
  addLog(gs, `${player.name} odkupił ${sp.name} za ${cost} zł.`);
  showToast(`Odkupiono ${sp.name} -${cost} zł`);
  playSfx('mortgage');
}

// ============================================================
// MODALS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openCardModal(card, deck) {
  // Don't re-open if already open
  if (document.getElementById('modal-card').classList.contains('open')) return;

  const deckEl = document.getElementById('modal-card-deck');
  const iconEl = document.getElementById('modal-card-icon');
  const textEl = document.getElementById('modal-card-text');

  deckEl.textContent  = deck === 'insight' ? '🎲 Karta Szansy' : '👥 Karta Społeczności';
  deckEl.className    = `card-modal-deck ${deck}`;
  iconEl.textContent  = deck === 'insight' ? '🎲' : '👥';
  textEl.textContent  = card.text;

  openModal('modal-card');
}

function openBuyModal(gs, spaceId) {
  // Don't re-open if already open
  if (document.getElementById('modal-buy').classList.contains('open')) return;

  const space  = BOARD_SPACES[spaceId];
  const player = gs.players[gs.currentPlayerIndex];
  if (!space || !player) return;

  document.getElementById('modal-buy-name').textContent  = space.name;
  document.getElementById('modal-buy-price').textContent = `Cena: ${space.price} zł`;
  document.getElementById('modal-buy-balance').textContent =
    `Twoje saldo: ${player.money} zł → po zakupie: ${player.money - space.price} zł`;

  // Color bar
  const colorBar = document.getElementById('modal-buy-colorbar');
  colorBar.style.backgroundColor = space.group ? GROUP_COLORS[space.group] : '#ddd';

  // Rent table
  const tbody = document.getElementById('modal-buy-rent-rows');
  tbody.innerHTML = '';

  if (space.type === 'property' && space.rent) {
    const labels = ['Opłata bazowa', '1 certyfikat', '2 certyfikaty', '3 certyfikaty', '4 certyfikaty', 'Pełna specjalizacja'];
    space.rent.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${labels[i]}</td><td>${r} zł</td>`;
      tbody.appendChild(tr);
    });
    // Monopoly double rent row
    const tr2 = document.createElement('tr');
    tr2.innerHTML = `<td>Pakiet (bez certyfikatów)</td><td>${space.rent[0] * 2} zł</td>`;
    tbody.insertBefore(tr2, tbody.children[1]);
  } else if (space.type === 'railroad') {
    ['1 stacja: 25 zł','2 stacje: 50 zł','3 stacje: 100 zł','4 stacje: 200 zł'].forEach(txt => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="2">${txt}</td>`;
      tbody.appendChild(tr);
    });
  } else if (space.type === 'utility') {
    ['1 zakład: 4× kostkę','2 zakłady: 10× kostkę'].forEach(txt => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="2">${txt}</td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('modal-buy-rent-table').style.display =
    (space.type === 'railroad' || space.type === 'utility' || space.rent) ? 'table' : 'none';

  openModal('modal-buy');
}

// ============================================================
// GAME OVER
// ============================================================
function showGameOver(gs) {
  const winner = gs.players[gs.winner];
  document.getElementById('gameover-winner-name').textContent = winner ? winner.name : 'Nieznany';

  const final = document.getElementById('gameover-final');
  final.innerHTML = '';
  const sorted = [...gs.players].sort((a, b) => getPrestigeScore(b) - getPrestigeScore(a));
  sorted.forEach(p => {
    const total = getPrestigeScore(p);
    const div = document.createElement('div');
    div.className = 'gameover-player';
    div.innerHTML = `
      <div class="player-token-sm" style="background:${p.color}; background-image:url('${getPawnIcon(p.pawn)}')">${getInitial(p.name)}</div>
      <div class="gameover-player-name">${escHtml(p.name)}${p.bankrupt ? ' 💀' : ''}</div>
      <div class="gameover-player-money">${formatMoney(p.money)} · ⭐${p.prestige} · 🔋${p.energy} · ⚖️${p.ethics} · 🔥${p.burnout} · Σ ${total}</div>`;
    final.appendChild(div);
  });

  showScreen('screen-game-over');
}
