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
const JAIL_POSITION    = 14;
const MAX_JAIL_TURNS   = 3;
const STARTING_PRESTIGE = 10;
const STARTING_ENERGY = 50;
const STARTING_ETHICS = 50;
const CRITICAL_BURNOUT = 100;
const DEFAULT_MAX_ROUNDS = 12;
const AI_CASH_BUFFER = 300;
const AI_DECISION_DELAY_MS = 850;
const AI_PERSONALITY_TYPES = ['conservative', 'balanced', 'aggressive'];
const ONBOARDING_SEEN_KEY = 'psychopoly-onboarding-seen';
const META_PROGRESS_KEY = 'psychopoly-meta-progress-v1';
const SEASON_JOURNAL_KEY = 'psychopoly-season-journal-v1';

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
let myReady       = false;
let lobbyPlayers  = [];
let currentHostPlayerId = 0;
let socketConnectionStatus = 'reconnecting';
let boardRendered = false;
let localSelections = [];
let lastLocalPlayerConfigs = null;
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
let aiStepTimer = null;
let lastAiDecisionAt = 0;
let dragStartX = 0;
let dragStartY = 0;
let movedPlayersLastUpdate = [];
let isAnimating = false;
let animatingPlayerData = null; // { playerId, animPos }
let gameSettings = { ...(window.PSYCHOPOLY_DEFAULT_CONFIG || {}) };
let logFilterMode = 'all';
const BALANCE_PRESETS = window.PSYCHOPOLY_BALANCE_PRESETS || {};
const DEFAULT_BALANCE_PRESET = (window.PSYCHOPOLY_DEFAULT_CONFIG && window.PSYCHOPOLY_DEFAULT_CONFIG.balancePreset) || "standard";
const MATCH_MODE_KEYS = ['szybka', 'standard', 'ekspercka'];
const DEFAULT_MAX_UNDOS_PER_TURN = Math.max(0, Number((window.PSYCHOPOLY_DEFAULT_CONFIG && window.PSYCHOPOLY_DEFAULT_CONFIG.undoPerTurnLimit) ?? 1) || 1);
let activeBalanceProfile = null;
let ACTIVE_BOARD_SPACES = [...BOARD_SPACES];
let ACTIVE_INSIGHT_CARDS = [...INSIGHT_CARDS];
let ACTIVE_SESSION_CARDS = [...SESSION_CARDS];
let onboardingStepIndex = 0;
let onboardingActive = false;
let onboardingShownThisSession = false;
let onboardingHighlightedEl = null;
let actionSuggestion = null;
let metaProgress = null;
let seasonJournal = null;
let currentRunStats = null;
let endgameMetaRecorded = false;

const ACHIEVEMENTS = [
  { id: 'first_steps', name: 'Pierwsze kroki', description: 'Ukończ 1 partię.', condition: (ctx) => ctx.profile.stats.gamesPlayed >= 1 },
  { id: 'returning_mind', name: 'Powracający umysł', description: 'Ukończ 5 partii.', condition: (ctx) => ctx.profile.stats.gamesPlayed >= 5 },
  { id: 'weekend_clinic', name: 'Weekendowa praktyka', description: 'Ukończ 12 partii.', condition: (ctx) => ctx.profile.stats.gamesPlayed >= 12 },
  { id: 'first_win', name: 'Pierwsza wygrana', description: 'Wygraj partię.', condition: (ctx) => ctx.playerWon },
  { id: 'winning_rhythm', name: 'Rytm zwycięstw', description: 'Wygraj 3 partie z rzędu.', condition: (ctx) => ctx.profile.stats.bestWinStreak >= 3 },
  { id: 'ethics_guardian', name: 'Wysoka etyka do końca', description: 'Zakończ partię z etyką co najmniej 80.', condition: (ctx) => ctx.player.ethics >= 80 },
  { id: 'zero_bankruptcies', name: '0 bankructw', description: 'Ukończ partię bez żadnego bankructwa gracza.', condition: (ctx) => ctx.run.bankruptPlayers === 0 },
  { id: 'survivor', name: 'Niezłomny', description: 'Wygraj bez bankructwa swojej postaci.', condition: (ctx) => ctx.playerWon && !ctx.player.bankrupt },
  { id: 'supervision_master', name: 'Mistrz superwizji', description: 'Zdobądź łącznie 12 punktów superwizji.', condition: (ctx) => ctx.profile.stats.totalSupervisionGained >= 12 },
  { id: 'property_hustle', name: 'Kolekcjoner aktywów', description: 'Kup łącznie 15 aktywów.', condition: (ctx) => ctx.profile.stats.totalPropertiesBought >= 15 },
  { id: 'card_scholar', name: 'Czytelnik kart', description: 'Dobierz łącznie 40 kart.', condition: (ctx) => ctx.profile.stats.totalCardsDrawn >= 40 },
  { id: 'steady_energy', name: 'Stabilna energia', description: 'Wygraj z energią co najmniej 70.', condition: (ctx) => ctx.playerWon && ctx.player.energy >= 70 },
  { id: 'burnout_tamer', name: 'Pogromca wypalenia', description: 'Wygraj z wypaleniem poniżej 25.', condition: (ctx) => ctx.playerWon && ctx.player.burnout < 25 },
  { id: 'rent_machine', name: 'Maszyna czynszowa', description: 'Otrzymaj łącznie 1500 zł czynszu.', condition: (ctx) => ctx.profile.stats.totalRentReceived >= 1500 },
  { id: 'turn_veteran', name: 'Weteran tur', description: 'Zakończ łącznie 120 tur.', condition: (ctx) => ctx.profile.stats.turnsEnded >= 120 },
  { id: 'season_pioneer', name: 'Pionier sezonu', description: 'Odblokuj 5 osiągnięć w jednym sezonie.', condition: (ctx) => getSeasonUnlockedCount(ctx.season) >= 5 },
];
let selectedLocalMatchMode = DEFAULT_BALANCE_PRESET;
let selectedOnlineMatchMode = DEFAULT_BALANCE_PRESET;
let boardTransformRafId = null;
let boardTransformDirty = false;
let boardDelegatedHandlersBound = false;
let lastUiSnapshot = null;
const tokenNodeByPlayerId = new Map();
const domCache = new Map();
const runtimePerf = {
  enabled: true,
  samples: {
    uiTotal: [],
    tokens: [],
    buildings: [],
    ownership: [],
    sidePanel: [],
    actionButtons: [],
  },
  interactionSamples: [],
  frameSamples: [],
  lastFrameTime: 0,
  perfModeReason: null,
};

const ONBOARDING_STEPS = [
  {
    title: 'Cel gry',
    text: 'Budujesz praktykę psychologiczną przez 12 rund. Wygrywa osoba z najwyższym wynikiem całkowitym, nie tylko z największą gotówką.',
    selector: '#phase-info',
  },
  {
    title: 'Rzut i ruch',
    text: 'Zacznij turę od rzutu kostkami. Kliknij ten przycisk, aby ruszyć pionkiem i uruchomić efekt pola.',
    selector: '#btn-roll',
  },
  {
    title: 'Zakup i rozwój',
    text: 'Po wejściu na wolne aktywo możesz je kupić lub pominąć. Rozsądne zakupy zwiększają długofalowe przychody i stabilność.',
    selector: '#phase-info',
  },
  {
    title: 'Koniec tury i gracze',
    text: 'Po wykonaniu akcji zakończ turę. W zakładce Gracze śledzisz zasoby wszystkich uczestników.',
    selector: '#players-list-panel',
    activateTab: 'players',
  },
  {
    title: 'Jak wygrać',
    text: 'Najlepsza strategia to balans zasobów: gotówki, prestiżu, energii i etyki przy kontrolowaniu wypalenia. Sama gotówka nie wystarczy.',
    selector: '#phase-info',
    activateTab: 'actions',
  },
];
const modalFocusReturnMap = new Map();

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

function roundMoney(value) {
  return Math.round(value);
}

function getBalancePresetKey() {
  const key = gameSettings.balancePreset === 'strategiczna' ? 'ekspercka' : (gameSettings.balancePreset || DEFAULT_BALANCE_PRESET);
  return BALANCE_PRESETS[key] ? key : DEFAULT_BALANCE_PRESET;
}

function getBalanceProfile() {
  const standard = BALANCE_PRESETS.standard || {};
  const selected = BALANCE_PRESETS[getBalancePresetKey()] || {};
  return { ...standard, ...selected, name: getBalancePresetKey() };
}

function getMatchModeKey(preferredKey) {
  const normalized = preferredKey === 'strategiczna' ? 'ekspercka' : preferredKey;
  if (MATCH_MODE_KEYS.includes(normalized) && BALANCE_PRESETS[normalized]) return normalized;
  return MATCH_MODE_KEYS.find((key) => BALANCE_PRESETS[key]) || 'standard';
}

function getMatchModeProfile(modeKey) {
  const resolvedKey = getMatchModeKey(modeKey);
  const standard = BALANCE_PRESETS.standard || {};
  const selected = BALANCE_PRESETS[resolvedKey] || {};
  return { ...standard, ...selected, name: resolvedKey };
}

function withCardMoneyMultiplier(card, multiplier) {
  const next = { ...card };
  ['money', 'amount', 'perHouse', 'perHotel'].forEach((field) => {
    if (typeof next[field] === 'number') next[field] = roundMoney(next[field] * multiplier);
  });
  return next;
}

function applyBalanceProfile(profileOrKey = null) {
  activeBalanceProfile = typeof profileOrKey === 'string'
    ? getMatchModeProfile(profileOrKey)
    : (profileOrKey || getBalanceProfile());
  ACTIVE_BOARD_SPACES = BOARD_SPACES.map((space) => {
    const next = { ...space };
    if (space.type === 'property') {
      next.houseCost = roundMoney(space.houseCost * activeBalanceProfile.developmentCostMultiplier);
      next.hotelCost = roundMoney(space.hotelCost * activeBalanceProfile.developmentCostMultiplier);
    }
    if (space.type === 'tax' && typeof space.amount === 'number') {
      next.amount = roundMoney(space.amount * activeBalanceProfile.penaltyMultiplier);
    }
    return next;
  });
  ACTIVE_INSIGHT_CARDS = INSIGHT_CARDS.map((card) => withCardMoneyMultiplier(card, activeBalanceProfile.cardMoneyMultiplier));
  ACTIVE_SESSION_CARDS = SESSION_CARDS.map((card) => withCardMoneyMultiplier(card, activeBalanceProfile.cardMoneyMultiplier));
}

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

function deepCloneState(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
function getEl(id) {
  if (domCache.has(id)) {
    const cached = domCache.get(id);
    if (cached && cached.isConnected) return cached;
    domCache.delete(id);
  }
  const el = document.getElementById(id);
  if (el) domCache.set(id, el);
  return el;
}

function pushPerfSample(bucket, value, max = 90) {
  if (!runtimePerf.enabled || !runtimePerf.samples[bucket]) return;
  const arr = runtimePerf.samples[bucket];
  arr.push(value);
  if (arr.length > max) arr.shift();
}

function pushArraySample(target, value, max = 90) {
  if (!runtimePerf.enabled || !Array.isArray(target)) return;
  target.push(value);
  if (target.length > max) target.shift();
}

function withPerfMetric(bucket, fn) {
  const start = performance.now();
  const result = fn();
  pushPerfSample(bucket, performance.now() - start);
  return result;
}

function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function p95(arr) {
  if (!arr || !arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

function reportRuntimePerf() {
  const rows = Object.entries(runtimePerf.samples).map(([name, arr]) => ({
    metric: name,
    avgMs: Number(avg(arr).toFixed(2)),
    p95Ms: Number(p95(arr).toFixed(2)),
    samples: arr.length,
  }));
  const interactionAvg = Number(avg(runtimePerf.interactionSamples).toFixed(2));
  const interactionP95 = Number(p95(runtimePerf.interactionSamples).toFixed(2));
  console.table(rows);
  if (runtimePerf.interactionSamples.length) {
    console.info('[Perf] interaction latency ms', { avg: interactionAvg, p95: interactionP95, samples: runtimePerf.interactionSamples.length });
  }
}

function showToast(msg, duration = 2800) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (extraClass) el.classList.add(extraClass);
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function initUndoState(gs) {
  if (!gs) return;
  const maxUndos = Number.isFinite(gs?.undo?.maxUndosPerTurn)
    ? Math.max(0, Math.floor(gs.undo.maxUndosPerTurn))
    : DEFAULT_MAX_UNDOS_PER_TURN;
  gs.undo = {
    snapshot: null,
    message: 'Cofnięcie dostępne po bezpiecznej akcji.',
    turnRef: gs.turn || 0,
    undosUsedThisTurn: gs.undo?.undosUsedThisTurn || 0,
    maxUndosPerTurn: maxUndos,
  };
}

function resetUndoForTurn(gs, message = 'Cofnięcie dostępne po bezpiecznej akcji.') {
  initUndoState(gs);
  gs.undo.snapshot = null;
  gs.undo.message = message;
  gs.undo.turnRef = gs.turn;
  gs.undo.undosUsedThisTurn = 0;
}

function snapshotActionState(gs, options = {}) {
  if (!gs || gameMode !== 'local') return;
  initUndoState(gs);
  const opts = {
    undoSafe: true,
    blockedReason: '',
    label: 'ostatniej akcji',
    ...options,
  };
  gs.undo.turnRef = gs.turn;

  if (!opts.undoSafe) {
    gs.undo.snapshot = null;
    gs.undo.message = opts.blockedReason || 'Tej akcji nie można cofnąć.';
    return;
  }
  if (gs.undo.maxUndosPerTurn <= 0) {
    gs.undo.snapshot = null;
    gs.undo.message = 'Cofanie zostało wyłączone w konfiguracji.';
    return;
  }
  const stateForSnapshot = deepCloneState(gs);
  if (stateForSnapshot.undo) stateForSnapshot.undo.snapshot = null;
  gs.undo.snapshot = stateForSnapshot;
  gs.undo.message = `Możesz cofnąć ${opts.label}.`;
}

function getUndoAvailability(gs, myTurn, curIsAI) {
  initUndoState(gs);
  if (gameMode !== 'local') return { available: false, reason: 'Cofanie działa tylko w trybie lokalnym.' };
  if (curIsAI) return { available: false, reason: 'Nie można cofać ruchów wykonanych przez AI.' };
  if (!myTurn) return { available: false, reason: 'Cofnięcie działa tylko w Twojej turze.' };
  if (gs.phase === 'end') return { available: false, reason: 'Gra jest zakończona.' };
  if (gs.phase !== 'end-turn') return { available: false, reason: 'Cofnięcie jest dostępne tuż przed zakończeniem tury.' };
  if (isAnimating) return { available: false, reason: 'Poczekaj na zakończenie animacji.' };
  if (gs.undo.turnRef !== gs.turn) return { available: false, reason: 'Zacznij nową turę, aby znów cofać.' };
  if (gs.undo.undosUsedThisTurn >= gs.undo.maxUndosPerTurn) {
    return { available: false, reason: `Limit cofnięć na turę: ${gs.undo.maxUndosPerTurn}.` };
  }
  if (!gs.undo.snapshot) return { available: false, reason: gs.undo.message || 'Brak bezpiecznej akcji do cofnięcia.' };
  return { available: true, reason: '' };
}

function doUndo(gs) {
  if (!gs || gameMode !== 'local') return false;
  const cur = gs.players[gs.currentPlayerIndex];
  const availability = getUndoAvailability(gs, true, !!cur?.isAI);
  if (!availability.available) {
    showToast(availability.reason);
    return false;
  }
  const restored = deepCloneState(gs.undo.snapshot);
  initUndoState(restored);
  restored.undo.snapshot = null;
  restored.undo.undosUsedThisTurn = (gs.undo?.undosUsedThisTurn || 0) + 1;
  restored.undo.turnRef = restored.turn;
  restored.undo.message = 'Limit cofnięcia dla tej tury został wykorzystany.';
  localGame = restored;
  showToast('Cofnięto ostatnią bezpieczną akcję.');
  return true;
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

function createDefaultMetaProgress() {
  return {
    version: 1,
    unlocked: {},
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      winStreak: 0,
      bestWinStreak: 0,
      turnsEnded: 0,
      totalPropertiesBought: 0,
      totalCardsDrawn: 0,
      totalRentPaid: 0,
      totalRentReceived: 0,
      totalPassGo: 0,
      totalJailVisits: 0,
      totalDoubleRolls: 0,
      totalSupervisionGained: 0,
      totalBuildActions: 0,
      totalMortgageActions: 0,
      bankruptcies: 0,
    },
  };
}

function loadMetaProgress() {
  try {
    const raw = localStorage.getItem(META_PROGRESS_KEY);
    const defaults = createDefaultMetaProgress();
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    return {
      ...defaults,
      ...parsed,
      unlocked: {
        ...defaults.unlocked,
        ...(parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {}),
      },
      stats: {
        ...defaults.stats,
        ...(parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {}),
      },
    };
  } catch (_e) {
    return createDefaultMetaProgress();
  }
}

function saveMetaProgress() {
  try { localStorage.setItem(META_PROGRESS_KEY, JSON.stringify(metaProgress)); } catch (_e) {}
}

function getCurrentSeasonId() {
  const now = new Date();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${quarter}`;
}

function createDefaultSeasonJournal() {
  const id = getCurrentSeasonId();
  return {
    activeSeasonId: id,
    seasons: [{
      id,
      label: `Sezon ${id}`,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gamesPlayed: 0,
      wins: 0,
      unlockedAchievementIds: [],
      journalEntries: [],
    }],
  };
}

function loadSeasonJournal() {
  try {
    const raw = localStorage.getItem(SEASON_JOURNAL_KEY);
    if (!raw) return createDefaultSeasonJournal();
    return JSON.parse(raw);
  } catch (_e) {
    return createDefaultSeasonJournal();
  }
}

function saveSeasonJournal() {
  try { localStorage.setItem(SEASON_JOURNAL_KEY, JSON.stringify(seasonJournal)); } catch (_e) {}
}

function ensureActiveSeason() {
  const currentId = getCurrentSeasonId();
  if (!seasonJournal || !Array.isArray(seasonJournal.seasons)) seasonJournal = createDefaultSeasonJournal();
  let season = seasonJournal.seasons.find((s) => s.id === currentId);
  if (!season) {
    season = {
      id: currentId,
      label: `Sezon ${currentId}`,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gamesPlayed: 0,
      wins: 0,
      unlockedAchievementIds: [],
      journalEntries: [],
    };
    seasonJournal.seasons.unshift(season);
  }
  seasonJournal.activeSeasonId = currentId;
  return season;
}

function createRunStats() {
  return {
    bankruptPlayers: new Set(),
    doubledRolls: 0,
  };
}

function getSeasonUnlockedCount(season) {
  if (!season || !Array.isArray(season.unlockedAchievementIds)) return 0;
  return new Set(season.unlockedAchievementIds).size;
}

function showAchievementToast(name) {
  showToast(`🏅 Osiągnięcie: ${name}`, 2600, 'toast-subtle');
}

function classifyLogType(msg = '', isTurn = false) {
  if (isTurn) return 'turn';
  const t = String(msg).toLowerCase();
  if (t.includes('💀') || t.includes('zbankrut') || t.includes('odpada') || t.includes('wygrywa') || t.includes('wygrał')) return 'bankrupt';
  if (t.includes('karta') || t.includes('ciągnie') || t.includes('szansy') || t.includes('społeczności')) return 'card';
  if (t.includes('izolacji') || t.includes('kara') || t.includes('płaci') || t.includes('czynsz') || t.includes('podatk')) return 'penalty';
  if (t.includes('zł') || t.includes('kupił') || t.includes('zastawił') || t.includes('odkupił') || t.includes('sprzedał')) return 'money';
  return 'turn';
}

function isLowValueSpamLog(msg = '', type = 'turn') {
  if (type === 'bankrupt' || type === 'penalty' || type === 'card') return false;
  const t = String(msg).toLowerCase();
  if (t.includes('wylądował na swojej własności') || t.includes('zatrzymał się na wolnej woli') || t.includes('ma przystanek')) return true;
  if (type === 'turn' && t.includes('--- tura gracza')) return false;
  return false;
}

function getPrestigeScore(player) {
  return player.money + (player.prestige * 12) + (player.energy * 8) + (player.ethics * 8) - (player.burnout * 10);
}

function getAssetValue(gs, player) {
  if (!gs || !player || !Array.isArray(player.properties)) return 0;
  return player.properties.reduce((sum, spaceId) => {
    const space = ACTIVE_BOARD_SPACES[spaceId];
    const ps = gs.properties[spaceId];
    if (!space) return sum;
    let value = space.price || 0;
    if (ps) {
      value += (ps.houses || 0) * (space.houseCost || 0);
      if (ps.hotel) value += space.hotelCost || 0;
      if (ps.mortgaged) value *= 0.5;
    }
    return sum + value;
  }, 0);
}

function ensureGameAnalytics(gs) {
  if (!gs) return;
  if (!gs.analytics) gs.analytics = { snapshots: [], events: [] };
  if (!Array.isArray(gs.analytics.snapshots)) gs.analytics.snapshots = [];
  if (!Array.isArray(gs.analytics.events)) gs.analytics.events = [];
}

function captureRoundSnapshot(gs, note = '') {
  if (!gs) return;
  ensureGameAnalytics(gs);
  const snapshot = {
    round: gs.roundsCompleted || 0,
    turn: gs.turn || 0,
    ts: Date.now(),
    note,
    players: gs.players.map((p) => ({
      id: p.id,
      name: p.name,
      money: p.money || 0,
      prestige: p.prestige || 0,
      energy: p.energy || 0,
      ethics: p.ethics || 0,
      burnout: p.burnout || 0,
      assetValue: getAssetValue(gs, p),
      propertyCount: Array.isArray(p.properties) ? p.properties.length : 0,
      score: getPrestigeScore(p),
      bankrupt: Boolean(p.bankrupt),
    })),
  };
  gs.analytics.snapshots.push(snapshot);
}

function recordTurningPoint(gs, { type, playerName, text, impact = 0 } = {}) {
  if (!gs || !type || !text) return;
  ensureGameAnalytics(gs);
  gs.analytics.events.push({
    type,
    playerName: playerName || 'Gracz',
    text,
    impact,
    round: gs.roundsCompleted || 0,
    turn: gs.turn || 0,
    ts: Date.now(),
  });
  if (gs.analytics.events.length > 120) gs.analytics.events.shift();
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
  if (delta.supervision && metaProgress) metaProgress.stats.totalSupervisionGained += Math.max(0, delta.supervision);
  if (summary.length) addLog(gs, `${player.name}: ${summary.join(', ')}${reason ? ` (${reason})` : ''}.`);
}

function addLog(gs, msg, isTurn = false, type = null) {
  const resolvedType = type || classifyLogType(msg, isTurn);
  if (isLowValueSpamLog(msg, resolvedType)) {
    const duplicateLowValueCount = gs.log
      .slice(0, 14)
      .filter(entry => entry.type === resolvedType && entry.text === msg)
      .length;
    if (duplicateLowValueCount >= 2) return;
  }
  gs.log.unshift({ text: msg, isTurn, type: resolvedType, ts: Date.now() });
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
  applyBalanceProfile();
}

function saveSettings() {
  localStorage.setItem('psychopoly-settings', JSON.stringify(gameSettings));
}

function getThemeClassName(themeKey) {
  const allowedThemes = ['classic', 'dark', 'calm'];
  const resolved = allowedThemes.includes(themeKey) ? themeKey : 'classic';
  return `theme-${resolved}`;
}

function applySettings() {
  const themeClass = getThemeClassName(gameSettings.theme);
  document.documentElement.style.setProperty('--ui-font-scale', gameSettings.fontScale || 1);
  document.documentElement.style.setProperty('--anim-speed-mult', gameSettings.animationSpeed || 1);
  document.documentElement.style.setProperty('--fx-intensity', gameSettings.boardFxIntensity || 1);
  document.body.classList.remove('theme-classic', 'theme-dark', 'theme-calm');
  document.body.classList.add(themeClass);
  document.documentElement.classList.remove('theme-preload-classic', 'theme-preload-dark', 'theme-preload-calm');
  document.body.classList.remove('quality-low', 'quality-medium', 'quality-high');
  document.body.classList.add(`quality-${gameSettings.renderQuality || 'high'}`);
  document.body.classList.toggle('performance-mode', !!gameSettings.performanceModeActive);
}

function detectPerformanceModeCandidate() {
  const hc = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const saveData = !!navigator.connection?.saveData;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldEnable = hc <= 4 || mem <= 4 || saveData || prefersReducedMotion;
  let reason = null;
  if (saveData) reason = 'save-data';
  else if (prefersReducedMotion) reason = 'reduced-motion';
  else if (mem <= 4) reason = 'low-memory';
  else if (hc <= 4) reason = 'low-cpu';
  return { shouldEnable, reason };
}

function applyAutomaticPerformanceMode() {
  const { shouldEnable, reason } = detectPerformanceModeCandidate();
  gameSettings.performanceModeActive = shouldEnable;
  runtimePerf.perfModeReason = shouldEnable ? reason : null;
  if (!shouldEnable) return;
  if (gameSettings.renderQuality === 'high') gameSettings.renderQuality = 'medium';
  gameSettings.boardFxIntensity = Math.min(gameSettings.boardFxIntensity || 1, 0.85);
  gameSettings.animationSpeed = Math.min(gameSettings.animationSpeed || 1, 0.9);
}

function setupRuntimePerformanceMonitoring() {
  if (!runtimePerf.enabled) return;
  let interactionStart = 0;
  const startInteraction = () => { interactionStart = performance.now(); };
  const endInteraction = () => {
    if (!interactionStart) return;
    requestAnimationFrame(() => {
      pushArraySample(runtimePerf.interactionSamples, performance.now() - interactionStart);
      interactionStart = 0;
    });
  };
  window.addEventListener('pointerdown', startInteraction, { passive: true });
  window.addEventListener('keydown', startInteraction, { passive: true });
  window.addEventListener('pointerup', endInteraction, { passive: true });
  window.addEventListener('keyup', endInteraction, { passive: true });

  const frameLoop = (ts) => {
    if (runtimePerf.lastFrameTime) {
      const delta = ts - runtimePerf.lastFrameTime;
      pushArraySample(runtimePerf.frameSamples, delta, 120);
    }
    runtimePerf.lastFrameTime = ts;
    requestAnimationFrame(frameLoop);
  };
  requestAnimationFrame(frameLoop);
}

function isActionGuidanceEnabled() {
  return gameSettings.actionGuidanceEnabled !== false;
}

function getPlayerUpkeepLoad(gs, player) {
  if (!gs || !player || !Array.isArray(player.properties)) return 0;
  return player.properties.reduce((sum, spaceId) => {
    const ps = gs.properties[spaceId];
    if (!ps) return sum + 1;
    const buildings = (ps.houses || 0) + (ps.hotel ? 2 : 0);
    return sum + 1 + buildings;
  }, 0);
}

function evaluateActionRisk(gs, player, actionType, options = {}) {
  if (!gs || !player) return null;
  const projectedCost = Math.max(0, options.projectedCost || 0);
  const projectedCash = player.money - projectedCost;
  const upkeepLoad = getPlayerUpkeepLoad(gs, player);
  let riskScore = 0;
  const reasons = [];

  if (projectedCash < 150) {
    riskScore += 2;
    reasons.push('niska poduszka gotówki');
  } else if (projectedCash < 300) {
    riskScore += 1;
    reasons.push('mała poduszka gotówki');
  }

  if (player.burnout >= 90) {
    riskScore += 2;
    reasons.push('wysokie wypalenie');
  } else if (player.burnout >= 75) {
    riskScore += 1;
    reasons.push('rosnące wypalenie');
  }

  if (player.ethics <= 15) {
    riskScore += 2;
    reasons.push('krytycznie niska etyka');
  } else if (player.ethics <= 30) {
    riskScore += 1;
    reasons.push('niska etyka');
  }

  if (actionType === 'buy' || actionType === 'build') {
    if (upkeepLoad >= 12) {
      riskScore += 2;
      reasons.push('duży upkeep aktywów');
    } else if (upkeepLoad >= 8) {
      riskScore += 1;
      reasons.push('rosnący upkeep aktywów');
    }
  }

  if (actionType === 'mortgage') {
    if (projectedCash < 200) {
      riskScore = Math.max(0, riskScore - 2);
      reasons.push('zastaw poprawia płynność');
    } else {
      riskScore += 1;
      reasons.push('zastaw ogranicza przychody długofalowe');
    }
  }

  const label = riskScore >= 3 ? 'Ryzykownie' : 'Bezpiecznie';
  return {
    label,
    reasons,
    actionType,
  };
}

function setActionSuggestion(gs, actionType, options = {}) {
  if (!isActionGuidanceEnabled()) {
    actionSuggestion = null;
    return;
  }
  const player = gs && gs.players ? gs.players[gs.currentPlayerIndex] : null;
  actionSuggestion = evaluateActionRisk(gs, player, actionType, options);
}

function clearActionSuggestion() {
  actionSuggestion = null;
}

function syncSettingsForm() {
  const anim = document.getElementById('setting-animation-speed');
  const font = document.getElementById('setting-font-scale');
  const quality = document.getElementById('setting-render-quality');
  const theme = document.getElementById('setting-theme');
  const balancePreset = document.getElementById('setting-balance-preset');
  const fx = document.getElementById('setting-fx-intensity');
  const guidance = document.getElementById('setting-action-guidance');
  if (anim) anim.value = String(gameSettings.animationSpeed || 1);
  if (font) font.value = String(gameSettings.fontScale || 1);
  if (quality) quality.value = gameSettings.renderQuality || 'high';
  if (theme) theme.value = gameSettings.theme || 'classic';
  if (balancePreset) balancePreset.value = getBalancePresetKey();
  if (fx) fx.value = String(gameSettings.boardFxIntensity || 1);
  if (guidance) guidance.checked = gameSettings.actionGuidanceEnabled !== false;
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
  const board = getEl('board');
  if (!board) return;
  board.style.transform = `translate(${boardPanX}px, ${boardPanY}px) scale(${boardScale}) rotate(${boardRotation}deg)`;
}

function scheduleBoardTransform() {
  boardTransformDirty = true;
  if (boardTransformRafId) return;
  boardTransformRafId = requestAnimationFrame(() => {
    boardTransformRafId = null;
    if (!boardTransformDirty) return;
    boardTransformDirty = false;
    applyBoardTransform();
  });
}

function clampBoardScale(value) {
  return Math.max(0.7, Math.min(2.3, value));
}

function setBoardScale(nextScale) {
  boardScale = clampBoardScale(nextScale);
  document.documentElement.style.setProperty('--board-scale', String(boardScale));
  scheduleBoardTransform();
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
  if (rotLeft) rotLeft.addEventListener('click', () => { boardRotation -= 15; scheduleBoardTransform(); });
  if (rotRight) rotRight.addEventListener('click', () => { boardRotation += 15; scheduleBoardTransform(); });
  if (reset) reset.addEventListener('click', () => {
    boardScale = 1;
    document.documentElement.style.setProperty('--board-scale', '1');
    boardRotation = 0;
    boardPanX = 0;
    boardPanY = 0;
    scheduleBoardTransform();
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
    scheduleBoardTransform();
  });
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
  if (id !== 'screen-game' && onboardingActive) stopOnboarding();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  syncMusicPlayback(id);
}

function getOnboardingSeen() {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch (_e) {
    return false;
  }
}

function setOnboardingSeen(seen = true) {
  try {
    if (seen) localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    else localStorage.removeItem(ONBOARDING_SEEN_KEY);
  } catch (_e) {}
}

function setupOnboardingHandlers() {
  const btnSkip = document.getElementById('btn-onboarding-skip');
  const btnPrev = document.getElementById('btn-onboarding-prev');
  const btnNext = document.getElementById('btn-onboarding-next');
  const btnFinish = document.getElementById('btn-onboarding-finish');

  if (btnSkip) {
    btnSkip.addEventListener('click', () => {
      const neverShow = document.getElementById('onboarding-never-show')?.checked;
      if (neverShow) setOnboardingSeen(true);
      stopOnboarding();
    });
  }
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      onboardingStepIndex = Math.max(0, onboardingStepIndex - 1);
      renderOnboardingStep();
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      onboardingStepIndex = Math.min(ONBOARDING_STEPS.length - 1, onboardingStepIndex + 1);
      renderOnboardingStep();
    });
  }
  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      setOnboardingSeen(true);
      stopOnboarding();
      showToast('Powodzenia! Pilnuj balansu zasobów, a nie tylko gotówki.');
    });
  }
}

function maybeStartOnboarding() {
  if (onboardingShownThisSession || onboardingActive || getOnboardingSeen()) return;
  onboardingShownThisSession = true;
  onboardingActive = true;
  onboardingStepIndex = 0;
  const neverInput = document.getElementById('onboarding-never-show');
  if (neverInput) neverInput.checked = false;
  openModal('modal-onboarding');
  renderOnboardingStep();
}

function stopOnboarding() {
  onboardingActive = false;
  clearOnboardingHighlight();
  closeModal('modal-onboarding');
}

function clearOnboardingHighlight() {
  if (onboardingHighlightedEl) onboardingHighlightedEl.classList.remove('onboarding-highlight');
  onboardingHighlightedEl = null;
}

function activateOnboardingTab(tabName) {
  if (!tabName) return;
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (!tabBtn) return;
  tabBtn.click();
}

function renderOnboardingStep() {
  if (!onboardingActive) return;
  const step = ONBOARDING_STEPS[onboardingStepIndex];
  if (!step) return;

  activateOnboardingTab(step.activateTab);
  clearOnboardingHighlight();

  const titleEl = document.getElementById('onboarding-title');
  const textEl = document.getElementById('onboarding-text');
  const indicatorEl = document.getElementById('onboarding-step-indicator');
  const btnPrev = document.getElementById('btn-onboarding-prev');
  const btnNext = document.getElementById('btn-onboarding-next');
  const btnFinish = document.getElementById('btn-onboarding-finish');

  if (titleEl) titleEl.textContent = step.title;
  if (textEl) textEl.textContent = step.text;
  if (indicatorEl) indicatorEl.textContent = `Krok ${onboardingStepIndex + 1}/${ONBOARDING_STEPS.length}`;
  if (btnPrev) btnPrev.disabled = onboardingStepIndex === 0;

  const isLast = onboardingStepIndex === ONBOARDING_STEPS.length - 1;
  if (btnNext) btnNext.style.display = isLast ? 'none' : 'inline-flex';
  if (btnFinish) btnFinish.style.display = isLast ? 'inline-flex' : 'none';

  if (step.selector) {
    const targetEl = document.querySelector(step.selector);
    if (targetEl) {
      onboardingHighlightedEl = targetEl;
      onboardingHighlightedEl.classList.add('onboarding-highlight');
      onboardingHighlightedEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  metaProgress = loadMetaProgress();
  seasonJournal = loadSeasonJournal();
  ensureActiveSeason();
  initAudioSystem();
  loadSettings();
  applyAutomaticPerformanceMode();
  applySettings();
  setupRuntimePerformanceMonitoring();
  setupMenuHandlers();
  setupLocalSetupHandlers();
  setupOnlineLobbyHandlers();
  setupGameHandlers();
  setupOnboardingHandlers();
  bindGlobalButtonSfx();
  setupBoardViewportControls();
  showScreen('screen-menu');
  window.PsychopolyPerf = {
    report: reportRuntimePerf,
    state: runtimePerf,
  };
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
  document.getElementById('btn-achievements').addEventListener('click', () => {
    renderAchievementsScreen();
    showScreen('screen-achievements');
  });
  document.getElementById('btn-achievements-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-rematch-same-settings').addEventListener('click', () => {
    if (!Array.isArray(lastLocalPlayerConfigs) || !lastLocalPlayerConfigs.length) {
      showToast('Brak zapisanych ustawień ostatniej gry lokalnej.');
      showScreen('screen-local-setup');
      return;
    }
    startLocalGame(lastLocalPlayerConfigs.map((cfg) => ({ ...cfg })));
  });
  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (socket) socket.disconnect();
    socket = null;
    gameMode = null;
    localGame = null;
    boardRendered = false;
    showScreen('screen-menu');
  });
}

function renderAchievementsScreen() {
  const container = document.getElementById('achievements-list');
  const summary = document.getElementById('achievements-summary');
  const seasonPreview = document.getElementById('season-journal-preview');
  if (!container || !summary || !seasonPreview) return;

  ensureActiveSeason();
  const unlockedCount = Object.keys(metaProgress.unlocked || {}).length;
  summary.textContent = `Odblokowane: ${unlockedCount}/${ACHIEVEMENTS.length} · Partie: ${metaProgress.stats.gamesPlayed} · Wygrane: ${metaProgress.stats.gamesWon}`;

  container.innerHTML = ACHIEVEMENTS.map((ach) => {
    const unlockedAt = metaProgress.unlocked[ach.id];
    const unlocked = Boolean(unlockedAt);
    const badge = unlocked ? '✅ Odblokowane' : '🔒 Zablokowane';
    const date = unlocked ? new Date(unlockedAt).toLocaleDateString('pl-PL') : '—';
    return `
      <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-row">
          <div class="achievement-name">${escHtml(ach.name)}</div>
          <div>${badge}</div>
        </div>
        <div class="achievement-desc">${escHtml(ach.description)}</div>
        <div class="achievement-desc">Data: ${date}</div>
      </div>
    `;
  }).join('');

  const season = ensureActiveSeason();
  seasonPreview.innerHTML = `
    <strong>📓 Dzienniki sezonowe (fundament)</strong><br>
    Aktywny sezon: ${escHtml(season.label)} · Partie: ${season.gamesPlayed} · Wygrane: ${season.wins}<br>
    Odblokowane w sezonie: ${getSeasonUnlockedCount(season)}<br>
    Wkrótce: szczegółowe wpisy i cele czasowe.
  `;
}

// ============================================================
// LOCAL SETUP HANDLERS
// ============================================================
let localPlayerCount = 2;

function buildMatchModeDescription(profile) {
  if (!profile) return '';
  return `${profile.description || ''} Rundy: ${profile.maxRounds || DEFAULT_MAX_ROUNDS}, ekonomia START ${profile.goMoney} zł, karty ×${(profile.cardIntensity || 1).toFixed(2)}, koszt rozwoju ×${(profile.developmentCostMultiplier || 1).toFixed(2)}.`;
}

function populateMatchModeSelect(selectId, descId, selectedKey, onChange) {
  const selectEl = document.getElementById(selectId);
  const descEl = document.getElementById(descId);
  if (!selectEl || !descEl) return;
  selectEl.innerHTML = '';
  MATCH_MODE_KEYS.forEach((key) => {
    const profile = getMatchModeProfile(key);
    const option = document.createElement('option');
    option.value = key;
    option.textContent = profile.label || key;
    selectEl.appendChild(option);
  });
  selectEl.value = getMatchModeKey(selectedKey);
  const updateDescription = () => {
    const profile = getMatchModeProfile(selectEl.value);
    descEl.textContent = buildMatchModeDescription(profile);
    if (typeof onChange === 'function') onChange(selectEl.value, profile);
  };
  selectEl.addEventListener('change', updateDescription);
  updateDescription();
}

function setupLocalSetupHandlers() {
  populateMatchModeSelect('local-match-mode', 'local-match-mode-desc', selectedLocalMatchMode, (nextMode) => {
    selectedLocalMatchMode = nextMode;
  });
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

    startLocalGame(
      names.map((n, i) => ({ name: n, color: colors[i], pawn: pawns[i], isAI: aiFlags[i] })),
      selectedLocalMatchMode,
    );
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
      btn.setAttribute('aria-label', `Wybierz pionek: ${opt.name}`);
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
      btn.setAttribute('aria-label', `Wybierz kolor: ${color}`);
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
  populateMatchModeSelect('online-match-mode', 'online-match-mode-desc', selectedOnlineMatchMode, (nextMode) => {
    selectedOnlineMatchMode = nextMode;
  });

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
    if (socket) socket.emit('create-room', { playerName: myPlayerName, color: myPlayerColor, pawn: myPlayerPawn, modeKey: selectedOnlineMatchMode });
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

  document.getElementById('btn-lobby-ready').addEventListener('click', () => {
    if (!socket || socketConnectionStatus !== 'połączono') {
      showToast('Brak połączenia z serwerem online.');
      return;
    }
    socket.emit('set-ready', { ready: !myReady });
  });

  document.getElementById('btn-lobby-start').addEventListener('click', () => {
    if (!isHost) { showToast('Tylko host może rozpocząć grę.'); return; }
    if (!socket) { showToast('Brak połączenia z serwerem online.'); return; }
    const reason = getStartBlockReason(lobbyPlayers);
    if (reason) { showToast(reason); return; }
    socket.emit('start-game');
  });

  document.getElementById('btn-copy-room-code').addEventListener('click', async () => {
    const code = (document.getElementById('lobby-room-code').textContent || '').trim();
    if (!code) return;
    const confirmation = document.getElementById('lobby-copy-confirmation');
    try {
      await navigator.clipboard.writeText(code);
      confirmation.textContent = 'Skopiowano kod pokoju.';
      confirmation.style.display = 'block';
      showToast('Kod pokoju skopiowany.');
    } catch (_err) {
      confirmation.textContent = 'Nie udało się skopiować kodu. Skopiuj ręcznie.';
      confirmation.style.display = 'block';
      showToast('Nie udało się skopiować kodu.');
    }
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
    btn.setAttribute('aria-label', `Wybierz pionek: ${opt.name}`);
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
    btn.setAttribute('aria-label', `Wybierz kolor: ${color}`);
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
  document.getElementById('lobby-copy-confirmation').style.display = 'none';
  document.getElementById('lobby-start-block-reason').textContent = '';
  document.getElementById('lobby-connection-status').textContent = 'Status: reconnecting';
  document.getElementById('lobby-ready-count').textContent = 'Gotowi: 0/0';
  myPlayerName = '';
  myPlayerColor = AVAILABLE_COLORS[0];
  myPlayerPawn = PAWN_OPTIONS[0].id;
  currentRoomId = null;
  myPlayerId = null;
  isHost = false;
  myReady = false;
  lobbyPlayers = [];
  currentHostPlayerId = 0;
  socketConnectionStatus = 'reconnecting';
  selectedOnlineMatchMode = getMatchModeKey(DEFAULT_BALANCE_PRESET);
  renderOnlineSelections();
  populateMatchModeSelect('online-match-mode', 'online-match-mode-desc', selectedOnlineMatchMode, (nextMode) => {
    selectedOnlineMatchMode = nextMode;
  });
  const modeSummary = document.getElementById('lobby-match-mode-summary');
  if (modeSummary) modeSummary.textContent = '';
}

function setConnectionStatus(status, message) {
  socketConnectionStatus = status;
  const el = document.getElementById('lobby-connection-status');
  if (el) {
    const base = `Status: ${status}`;
    el.textContent = message ? `${base} — ${message}` : base;
  }
  refreshLobbyControls();
}

function getStartBlockReason(players) {
  if (!Array.isArray(players) || players.length < 2) {
    return 'Start zablokowany: potrzeba co najmniej 2 graczy.';
  }
  const notReady = players.filter(p => !p.ready);
  if (notReady.length > 0) {
    const names = notReady.map(p => p.name).join(', ');
    return `Start zablokowany: czekamy na gotowość (${names}).`;
  }
  return '';
}

function refreshLobbyControls() {
  const matchModeSelect = document.getElementById('online-match-mode');
  if (matchModeSelect) {
    const inWaiting = document.getElementById('lobby-step-waiting')?.style.display === 'block';
    matchModeSelect.disabled = inWaiting;
  }
  const readyBtn = document.getElementById('btn-lobby-ready');
  if (readyBtn) {
    readyBtn.textContent = myReady ? '✅ Gotowy' : '☐ Gotowy';
    readyBtn.classList.toggle('btn-success', myReady);
    readyBtn.classList.toggle('btn-secondary', !myReady);
    readyBtn.disabled = !socket || socketConnectionStatus !== 'połączono';
  }
  const readyCount = lobbyPlayers.filter(p => p.ready).length;
  const readyCountEl = document.getElementById('lobby-ready-count');
  if (readyCountEl) {
    readyCountEl.textContent = `Gotowi: ${readyCount}/${lobbyPlayers.length}`;
  }

  const startBtn = document.getElementById('btn-lobby-start');
  const reason = getStartBlockReason(lobbyPlayers);
  if (startBtn) {
    startBtn.style.display = isHost ? 'inline-flex' : 'none';
    startBtn.disabled = Boolean(reason) || !socket || socketConnectionStatus !== 'połączono';
  }
  const reasonEl = document.getElementById('lobby-start-block-reason');
  if (reasonEl) {
    reasonEl.textContent = isHost ? (reason || 'Możesz rozpocząć grę.') : '';
  }
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
  socket = io({
    timeout: 8000,
    reconnection: true,
    reconnectionAttempts: 6,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 4000,
  });

  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
    setConnectionStatus('połączono');
    if (currentRoomId && myPlayerName) {
      showToast('Połączono ponownie z serwerem. Jeśli byłeś(-aś) w lobby, dołącz ponownie do pokoju.');
    }
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') {
      setConnectionStatus('rozłączono', `rozłączono (${reason})`);
      return;
    }
    setConnectionStatus('reconnecting', `rozłączono (${reason || 'brak powodu'})`);
    showToast('Rozłączono z serwerem. Trwa ponowne łączenie…');
  });

  socket.on('error', ({ message }) => {
    document.getElementById('online-error').textContent = message;
    showToast('Błąd: ' + message);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    setConnectionStatus('reconnecting', `próba ${attempt}/6`);
  });

  socket.io.on('reconnect_error', () => {
    setConnectionStatus('reconnecting', 'błąd podczas ponownego łączenia');
  });

  socket.io.on('reconnect_failed', () => {
    setConnectionStatus('reconnecting', 'nie udało się połączyć ponownie');
    showToast('Nie udało się odzyskać połączenia. Spróbuj wrócić do menu i wejść ponownie.');
  });

  socket.on('connect_error', (err) => {
    const msg = err?.message || 'timeout połączenia';
    document.getElementById('online-error').textContent = `Problem z połączeniem: ${msg}.`;
    setConnectionStatus('reconnecting', msg);
    showToast('Problem z połączeniem. Trwa ponawianie...');
  });

  socket.on('room-created', ({ roomId, playerId, players, modeKey }) => {
    currentRoomId = roomId;
    myPlayerId    = playerId;
    isHost        = true;
    myReady       = false;
    if (modeKey) selectedOnlineMatchMode = getMatchModeKey(modeKey);
    showLobbyWaiting(roomId, players, true, selectedOnlineMatchMode);
  });

  socket.on('room-joined', ({ roomId, playerId, players, modeKey }) => {
    currentRoomId = roomId;
    myPlayerId    = playerId;
    isHost        = false;
    myReady       = false;
    if (modeKey) selectedOnlineMatchMode = getMatchModeKey(modeKey);
    showLobbyWaiting(roomId, players, false, selectedOnlineMatchMode);
  });

  socket.on('room-state', ({ roomId, players, hostPlayerId, modeKey }) => {
    currentRoomId = roomId;
    currentHostPlayerId = hostPlayerId;
    isHost = hostPlayerId === myPlayerId;
    if (modeKey) selectedOnlineMatchMode = getMatchModeKey(modeKey);
    const me = players.find(p => p.playerId === myPlayerId);
    myReady = Boolean(me && me.ready);
    renderLobbyPlayers(players);
    refreshLobbyControls();
    updateLobbyModeSummary(selectedOnlineMatchMode, isHost);
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

function showLobbyWaiting(roomId, players, host, modeKey = selectedOnlineMatchMode) {
  document.getElementById('lobby-step-choose').style.display = 'none';
  document.getElementById('lobby-step-waiting').style.display = 'block';
  document.getElementById('lobby-room-code').textContent = roomId;
  document.getElementById('lobby-copy-confirmation').style.display = 'none';
  setConnectionStatus(socket && socket.connected ? 'połączono' : 'reconnecting');
  isHost = host;
  currentHostPlayerId = host ? myPlayerId : (players.find(p => p.playerId === 0)?.playerId ?? 0);
  renderLobbyPlayers(players);
  updateLobbyModeSummary(modeKey, host);
  document.getElementById('lobby-status').textContent = host
    ? 'Oczekiwanie na graczy… (min. 2, maks. 4)'
    : 'Oczekiwanie na start gry przez gospodarza…';
  refreshLobbyControls();
}

function updateLobbyModeSummary(modeKey, host) {
  const summaryEl = document.getElementById('lobby-match-mode-summary');
  if (!summaryEl) return;
  const profile = getMatchModeProfile(modeKey);
  summaryEl.textContent = `Tryb: ${profile.label}. ${buildMatchModeDescription(profile)}${host ? ' To ustawienie hosta dla całego pokoju.' : ''}`;
}

function renderLobbyPlayers(players) {
  lobbyPlayers = Array.isArray(players) ? players : [];
  const list = document.getElementById('lobby-players-list');
  list.innerHTML = '';
  lobbyPlayers.forEach(p => {
    const row = document.createElement('div');
    row.className = 'lobby-player-row';
    const badges = [
      `<span class="lobby-badge lobby-badge-conn">${socketConnectionStatus}</span>`,
      p.playerId === currentHostPlayerId ? '<span class="lobby-badge lobby-badge-host">host</span>' : '',
      p.ready ? '<span class="lobby-badge lobby-badge-ready">gotowy</span>' : '',
    ].filter(Boolean).join('');
    row.innerHTML = `
      <div class="player-token-sm" style="background:${p.color}; background-image:url('${getPawnIcon(p.pawn)}')">${getInitial(p.name)}</div>
      <span>${p.name}${p.playerId === myPlayerId ? ' (Ty)' : ''}</span>
      <span class="lobby-player-badges">${badges}</span>`;
    list.appendChild(row);
  });
}

// ============================================================
// GAME CREATION (LOCAL)
// ============================================================
function createGameState(playerConfigs, matchProfile) {
  const resolvedProfile = matchProfile || activeBalanceProfile || getMatchModeProfile(DEFAULT_BALANCE_PRESET);
  return {
    players: playerConfigs.map((p, i) => ({
      id:                 i,
      name:               p.name,
      color:              p.color || PLAYER_COLORS[i],
      pawn:               p.pawn || PAWN_OPTIONS[i % PAWN_OPTIONS.length].id,
      isAI:               p.isAI || false,
      aiPersonality:      p.aiPersonality || (p.isAI ? AI_PERSONALITY_TYPES[i % AI_PERSONALITY_TYPES.length] : null),
      money:              resolvedProfile.startingMoney,
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
    maxRounds: resolvedProfile.maxRounds || DEFAULT_MAX_ROUNDS,
    matchProfileKey: resolvedProfile.name || getMatchModeKey(DEFAULT_BALANCE_PRESET),
    matchProfileLabel: resolvedProfile.label || 'Standard',
    insightCards:    shuffleArray([...ACTIVE_INSIGHT_CARDS]),
    sessionCards:    shuffleArray([...ACTIVE_SESSION_CARDS]),
    insightDiscard:  [],
    sessionDiscard:  [],
    log:             [],
    winner:          null,
    pendingCard:     null,
    pendingCardDeck: null,
    pendingBuy:      null,
    rolledThisTurn:  false,
    analytics:       { snapshots: [], events: [] },
    undo:            {
      snapshot: null,
      message: 'Cofnięcie dostępne po bezpiecznej akcji.',
      turnRef: 0,
      undosUsedThisTurn: 0,
      maxUndosPerTurn: DEFAULT_MAX_UNDOS_PER_TURN,
    },
  };
}

// ============================================================
// START LOCAL GAME
// ============================================================
function startLocalGame(playerConfigs, modeKey = DEFAULT_BALANCE_PRESET) {
  gameMode  = 'local';
  myPlayerId = 0;   // in local mode all players use same device
  const profile = getMatchModeProfile(modeKey);
  selectedLocalMatchMode = profile.name;
  applyBalanceProfile(profile);
  localGame  = createGameState(playerConfigs, profile);
  resetUndoForTurn(localGame, 'Cofnięcie dostępne po bezpiecznej akcji.');
  lastLocalPlayerConfigs = playerConfigs.map((p) => ({ ...p }));
  captureRoundSnapshot(localGame, 'start');
  currentRunStats = createRunStats();
  endgameMetaRecorded = false;
  aiStepPending = false;
  if (aiStepTimer) clearTimeout(aiStepTimer);
  aiStepTimer = null;
  lastAiDecisionAt = 0;
  renderBoard();
  boardRendered = true;
  // Chat offline note for local mode
  const offlineNote = document.getElementById('chat-drawer-offline-note');
  const drawerInput = document.getElementById('chat-drawer-input');
  const drawerSend  = document.getElementById('chat-drawer-send');
  if (offlineNote) offlineNote.style.display = 'block';
  if (drawerInput) drawerInput.disabled = true;
  if (drawerSend)  drawerSend.disabled  = true;
  showScreen('screen-game');
  showToast(`Tryb partii: ${profile.label}`);
  addLog(localGame, `--- Tura gracza ${localGame.players[0].name} ---`, true);
  updateUI(localGame);
  window.setTimeout(maybeStartOnboarding, 180);
}

// ============================================================
// START ONLINE GAME
// ============================================================
function startOnlineGame(gs) {
  const profile = getMatchModeProfile(gs && gs.matchProfileKey ? gs.matchProfileKey : selectedOnlineMatchMode);
  applyBalanceProfile(profile);
  if (!boardRendered) { renderBoard(); boardRendered = true; }
  currentRunStats = createRunStats();
  endgameMetaRecorded = false;
  // Enable chat for online mode
  const offlineNote = document.getElementById('chat-drawer-offline-note');
  const drawerInput = document.getElementById('chat-drawer-input');
  const drawerSend  = document.getElementById('chat-drawer-send');
  if (offlineNote) offlineNote.style.display = 'none';
  if (drawerInput) drawerInput.disabled = false;
  if (drawerSend)  drawerSend.disabled  = false;
  showScreen('screen-game');
  applyOnlineState(gs);
  window.setTimeout(maybeStartOnboarding, 180);
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
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const activateTab = (btn) => {
    if (!btn) return;
    const tab = btn.dataset.tab;
    tabs.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
    });
    document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    btn.tabIndex = 0;
    const panel = document.getElementById(tab + '-content');
    if (panel) panel.classList.add('active');
  };
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn);
    });
    btn.addEventListener('keydown', (e) => {
      const currentIndex = tabs.indexOf(btn);
      if (currentIndex === -1) return;
      let nextIndex = null;
      if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') nextIndex = 0;
      if (e.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      e.preventDefault();
      tabs[nextIndex].focus();
      activateTab(tabs[nextIndex]);
    });
  });

  const logFilters = document.getElementById('log-filters');
  if (logFilters) {
    logFilters.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.log-filter-btn');
      if (!btn) return;
      logFilterMode = btn.dataset.logFilter || 'all';
      logFilters.querySelectorAll('.log-filter-btn').forEach((el) => {
        el.classList.toggle('active', el === btn);
      });
      if (localGame) renderLogPanel(localGame);
    });
  }

  const logTopBtn = document.getElementById('btn-log-top');
  if (logTopBtn) {
    logTopBtn.addEventListener('click', () => {
      const logContent = document.getElementById('log-content');
      if (logContent) logContent.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Roll
  document.getElementById('btn-roll').addEventListener('click', () => {
    if (!localGame) return;
    if (isAnimating) return;
    if (gameMode === 'local') {
      snapshotActionState(localGame, {
        undoSafe: false,
        blockedReason: 'Rzut kostką jest losowy i ujawniony — nie można go cofnąć.',
      });
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
      snapshotActionState(localGame, { label: 'opłacenie wyjścia z Izolacji' });
      doPayJail(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('pay-jail'); }
  });

  // Use jail card
  document.getElementById('btn-jail-card').addEventListener('click', () => {
    if (!localGame) return;
    if (gameMode === 'local') {
      snapshotActionState(localGame, { label: 'użycie karty wyjścia z Izolacji' });
      doUseJailCard(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('use-jail-card'); }
  });

  // Undo (local safe action only)
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (!localGame) return;
    if (gameMode !== 'local') return;
    doUndo(localGame);
    if (localGame) updateUI(localGame);
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
      snapshotActionState(localGame, {
        undoSafe: false,
        blockedReason: 'Karta została już ujawniona — cofnięcie jest zablokowane.',
      });
      doCardOk(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('card-ok'); }
  });

  // Buy confirm
  document.getElementById('btn-buy-confirm').addEventListener('click', () => {
    if (!localGame) return;
    clearActionSuggestion();
    closeModal('modal-buy');
    if (gameMode === 'local') {
      snapshotActionState(localGame, { label: 'zakup aktywa' });
      doBuy(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('buy'); }
  });

  // Buy pass
  document.getElementById('btn-buy-pass').addEventListener('click', () => {
    if (!localGame) return;
    clearActionSuggestion();
    closeModal('modal-buy');
    if (gameMode === 'local') {
      snapshotActionState(localGame, { label: 'pominięcie zakupu' });
      doPassBuy(localGame);
      updateUI(localGame);
    } else { sendOnlineAction('pass-buy'); }
  });

  // Build modal close
  document.getElementById('btn-build-close').addEventListener('click', () => {
    clearActionSuggestion();
    closeModal('modal-build');
    if (localGame) updateUI(localGame);
  });

  // Mortgage modal close
  document.getElementById('btn-mortgage-close').addEventListener('click', () => {
    clearActionSuggestion();
    closeModal('modal-mortgage');
    if (localGame) updateUI(localGame);
  });

  // Chat drawer toggle
  const drawerToggle = document.getElementById('chat-drawer-toggle');
  if (drawerToggle) {
    drawerToggle.addEventListener('click', () => {
      const drawer = document.getElementById('chat-drawer');
      if (!drawer) return;
      const isOpen = drawer.classList.toggle('open');
      drawerToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Chat send via drawer
  document.getElementById('chat-drawer-send').addEventListener('click', sendChatMsg);
  document.getElementById('chat-drawer-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMsg();
  });

  const btnSettingsClose = document.getElementById('btn-settings-close');
  if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => closeModal('modal-settings'));

  const btnSpacePreviewClose = document.getElementById('btn-space-preview-close');
  if (btnSpacePreviewClose) {
    btnSpacePreviewClose.addEventListener('click', () => closeModal('modal-space-preview'));
  }

  const modalSpacePreview = document.getElementById('modal-space-preview');
  if (modalSpacePreview) {
    modalSpacePreview.addEventListener('click', (e) => {
      if (e.target === modalSpacePreview) closeModal('modal-space-preview');
    });
  }
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
      applyBalanceProfile();
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
      gameSettings.theme = document.getElementById('setting-theme').value || 'classic';
      gameSettings.boardFxIntensity = parseFloat(document.getElementById('setting-fx-intensity').value) || 1;
      gameSettings.balancePreset = document.getElementById('setting-balance-preset').value || DEFAULT_BALANCE_PRESET;
      gameSettings.actionGuidanceEnabled = !!document.getElementById('setting-action-guidance')?.checked;
      applyBalanceProfile();
      applySettings();
      saveSettings();
      if (!isActionGuidanceEnabled()) clearActionSuggestion();
      if (localGame) updateUI(localGame);
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
  const board = getEl('board');
  if (!board) return;
  board.innerHTML = '';
  const fragment = document.createDocumentFragment();

  ACTIVE_BOARD_SPACES.forEach(space => {
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

    fragment.appendChild(cell);
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
  fragment.appendChild(center);
  board.appendChild(fragment);

  if (!boardDelegatedHandlersBound) {
    boardDelegatedHandlersBound = true;
    board.addEventListener('mouseover', (event) => {
      const cell = event.target.closest('.board-space');
      if (!cell || !board.contains(cell)) return;
      const spaceId = Number(cell.dataset.spaceId);
      const space = ACTIVE_BOARD_SPACES[spaceId];
      if (!space) return;
      showSpaceTooltip(space, cell);
      showSpacePreview(space, 'hover');
    });
    board.addEventListener('mouseout', (event) => {
      const leavingBoard = !event.relatedTarget || !event.relatedTarget.closest('#board');
      if (leavingBoard) hideSpaceTooltip();
    });
    board.addEventListener('click', (event) => {
      const cell = event.target.closest('.board-space');
      if (!cell || !board.contains(cell)) return;
      const spaceId = Number(cell.dataset.spaceId);
      const space = ACTIVE_BOARD_SPACES[spaceId];
      if (!space) return;
      showSpacePreview(space, 'click');
      if (isCompactPreviewViewport()) openSpacePreviewModal(space);
    });
  }

  // Card deck click handlers
  getEl('insight-deck').addEventListener('click', () => {
    if (!localGame) return;
    const gs = localGame;
    if (gs.phase !== 'card-select') return;
    if (gs.pendingCardDeck !== 'insight') { showToast('Ciągnij z właściwego stosu kart!'); return; }
    const player = gs.players[gs.currentPlayerIndex];
    if (gameMode === 'local') {
      snapshotActionState(gs, {
        undoSafe: false,
        blockedReason: 'Dobrana karta została ujawniona publicznie — nie można cofnąć.',
      });
      doDrawCard(gs, player, 'insight');
      gs.pendingCardDeck = null;
      updateUI(gs);
    } else {
      sendOnlineAction('draw-card', { deck: 'insight' });
    }
  });
  getEl('session-deck').addEventListener('click', () => {
    if (!localGame) return;
    const gs = localGame;
    if (gs.phase !== 'card-select') return;
    if (gs.pendingCardDeck !== 'session') { showToast('Ciągnij z właściwego stosu kart!'); return; }
    const player = gs.players[gs.currentPlayerIndex];
    if (gameMode === 'local') {
      snapshotActionState(gs, {
        undoSafe: false,
        blockedReason: 'Dobrana karta została ujawniona publicznie — nie można cofnąć.',
      });
      doDrawCard(gs, player, 'session');
      gs.pendingCardDeck = null;
      updateUI(gs);
    } else {
      sendOnlineAction('draw-card', { deck: 'session' });
    }
  });
  scheduleBoardTransform();
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

function isCompactPreviewViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 340px)').matches;
}

function getCompactPreviewText(space) {
  if (!space) return 'Brak danych.';
  if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
    return space.price ? `Koszt: ${space.price} zł` : 'Pole własności';
  }
  if (space.type === 'tax') return `Podatek: -${space.amount} zł`;
  if (space.type === 'card') return 'Dobierz kartę';
  if (space.type === 'gotojail') return 'Idziesz do Izolacji';
  return getSpacePenalty(space);
}

function getSpaceFullDescription(space) {
  if (!space) return 'Brak danych.';
  if (space.description) return `${space.description} ${getSpacePenalty(space)}`;
  return getSpacePenalty(space);
}

function openSpacePreviewModal(space) {
  if (!space) return;
  const title = document.getElementById('modal-space-preview-title');
  const text = document.getElementById('modal-space-preview-text');
  if (!title || !text) return;
  title.textContent = space.name;
  text.textContent = getSpaceFullDescription(space);
  openModal('modal-space-preview');
}

function showSpacePreview(space, source = 'hover') {
  const box = document.getElementById('space-preview');
  if (!box || !space) return;

  const compact = isCompactPreviewViewport();
  const modeLabel = source === 'click' ? 'Podgląd (tap)' : 'Podgląd';
  const previewText = compact ? getCompactPreviewText(space) : getSpacePenalty(space);
  const compactHint = compact ? '<div class="space-preview-hint">Tapnij pole, aby zobaczyć pełny opis.</div>' : '';

  box.innerHTML = `
    <div class="space-preview-mode">${modeLabel}</div>
    <div class="space-preview-name">${escHtml(space.name)}</div>
    <div class="space-preview-penalty">${escHtml(previewText)}</div>
    ${compactHint}
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
  const fromEl = getEl(`space-${fromSpaceId}`);
  const toEl = getEl(`space-${toSpaceId}`);
  const boardArea = getEl('board-area');
  if (!fromEl || !toEl || !boardArea) return;

  [fromEl, toEl].forEach((el, idx) => {
    setTimeout(() => {
      el.classList.remove('space-focus-pulse');
      requestAnimationFrame(() => el.classList.add('space-focus-pulse'));
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
  const fx = getEl('card-draw-fx');
  if (!fx) return;
  fx.textContent = deck === 'insight' ? '🟧 Karta Szansy' : '🟦 Karta Społeczności';
  fx.classList.remove('playing');
  requestAnimationFrame(() => fx.classList.add('playing'));
}

function animateDiceOnBoard(d1, d2) {
  const fx = getEl('dice-board-fx');
  const die1 = getEl('board-die1');
  const die2 = getEl('board-die2');
  if (!fx || !die1 || !die2) return;
  die1.textContent = DICE_FACES[d1] || '⚀';
  die2.textContent = DICE_FACES[d2] || '⚀';
  fx.classList.remove('playing');
  requestAnimationFrame(() => fx.classList.add('playing'));
}

function getProfilePlayerForMeta(gs) {
  if (!gs || !gs.players || !gs.players.length) return null;
  if (gameMode === 'online') return gs.players.find((p) => p.id === myPlayerId) || gs.players[0];
  return gs.players[0];
}

function processMetaProgressForFinishedGame(gs) {
  if (!gs || endgameMetaRecorded) return;
  endgameMetaRecorded = true;
  if (!metaProgress) metaProgress = createDefaultMetaProgress();
  if (!seasonJournal) seasonJournal = createDefaultSeasonJournal();
  const season = ensureActiveSeason();
  const player = getProfilePlayerForMeta(gs);
  if (!player) return;

  metaProgress.stats.gamesPlayed++;
  season.gamesPlayed++;
  const playerWon = gs.winner === player.id;
  if (playerWon) {
    metaProgress.stats.gamesWon++;
    metaProgress.stats.winStreak++;
    metaProgress.stats.bestWinStreak = Math.max(metaProgress.stats.bestWinStreak, metaProgress.stats.winStreak);
    season.wins++;
  } else {
    metaProgress.stats.winStreak = 0;
  }

  season.updatedAt = new Date().toISOString();
  season.journalEntries.unshift({
    at: season.updatedAt,
    type: 'game-finished',
    winnerId: gs.winner,
    playerId: player.id,
    playerWon,
    bankruptPlayers: currentRunStats ? currentRunStats.bankruptPlayers.size : 0,
  });
  season.journalEntries = season.journalEntries.slice(0, 50);

  const ctx = {
    profile: metaProgress,
    run: {
      bankruptPlayers: currentRunStats ? currentRunStats.bankruptPlayers.size : 0,
      doubledRolls: currentRunStats ? currentRunStats.doubledRolls : 0,
    },
    player,
    playerWon,
    season,
  };
  ACHIEVEMENTS.forEach((ach) => {
    if (metaProgress.unlocked[ach.id]) return;
    if (!ach.condition(ctx)) return;
    const unlockedAt = new Date().toISOString();
    metaProgress.unlocked[ach.id] = unlockedAt;
    season.unlockedAchievementIds.push(ach.id);
    season.journalEntries.unshift({ at: unlockedAt, type: 'achievement', achievementId: ach.id });
    showAchievementToast(ach.name);
  });

  saveMetaProgress();
  saveSeasonJournal();
}

// ============================================================
// UI UPDATE
// ============================================================
function updateUI(gs) {
  if (!gs) return;
  const updateStart = performance.now();
  const uiSnapshot = {
    phase: gs.phase,
    currentPlayerIndex: gs.currentPlayerIndex,
    dice: `${gs.dice[0]}-${gs.dice[1]}`,
    positions: gs.players.map((p) => p.position).join(','),
    playerStats: gs.players.map((p) => `${p.money}|${p.prestige}|${p.energy}|${p.ethics}|${p.burnout}|${p.bankrupt ? 1 : 0}|${p.inJail ? 1 : 0}|${(p.properties || []).length}`).join(';'),
    properties: Object.entries(gs.properties)
      .map(([spaceId, ps]) => `${spaceId}:${ps.owner}-${ps.houses || 0}-${ps.hotel ? 1 : 0}-${ps.mortgaged ? 1 : 0}`)
      .join('|'),
    logTop: (gs.log && gs.log[0] && gs.log[0].ts) || 0,
    logLen: gs.log ? gs.log.length : 0,
  };

  const prevPositions = movedPlayersLastUpdate.length
    ? movedPlayersLastUpdate
    : gs.players.map(p => p.position);
  const movedIdx = gs.players.findIndex((p, idx) => !p.bankrupt && prevPositions[idx] !== p.position);
  if (movedIdx >= 0) {
    const moved = gs.players[movedIdx];
    animateBoardFocus(prevPositions[movedIdx] ?? moved.position, moved.position);
  }

  if (!lastUiSnapshot || lastUiSnapshot.positions !== uiSnapshot.positions || animatingPlayerData) {
    withPerfMetric('tokens', () => renderTokens(gs));
  }
  if (!lastUiSnapshot || lastUiSnapshot.properties !== uiSnapshot.properties) {
    withPerfMetric('buildings', () => renderBuildingIndicators(gs));
    withPerfMetric('ownership', () => renderOwnershipRings(gs));
  }
  if (!lastUiSnapshot || lastUiSnapshot.playerStats !== uiSnapshot.playerStats || lastUiSnapshot.properties !== uiSnapshot.properties || lastUiSnapshot.logTop !== uiSnapshot.logTop || lastUiSnapshot.logLen !== uiSnapshot.logLen) {
    withPerfMetric('sidePanel', () => updateSidePanel(gs));
  }
  if (!lastUiSnapshot || lastUiSnapshot.currentPlayerIndex !== uiSnapshot.currentPlayerIndex || lastUiSnapshot.playerStats !== uiSnapshot.playerStats) {
    updateTurnQueue(gs);
  }
  withPerfMetric('actionButtons', () => updateActionButtons(gs));
  updateCenterInfo(gs);
  movedPlayersLastUpdate = gs.players.map(p => p.position);
  lastUiSnapshot = uiSnapshot;
  pushPerfSample('uiTotal', performance.now() - updateStart);

  if (gs.phase === 'end' && gs.winner !== null) {
    processMetaProgressForFinishedGame(gs);
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
  if (runtimePerf.samples.uiTotal.length && runtimePerf.samples.uiTotal.length % 30 === 0) reportRuntimePerf();
}

// ============================================================
// TOKENS
// ============================================================
function renderTokens(gs) {
  const usedPlayerIds = new Set();
  gs.players.forEach((player) => {
    if (player.bankrupt) return;
    usedPlayerIds.add(player.id);
    // Use animation position when this player is mid-move
    const displayPos = (animatingPlayerData && animatingPlayerData.playerId === player.id)
      ? animatingPlayerData.animPos
      : player.position;
    const layer = getEl(`tokens-${displayPos}`);
    if (!layer) return;
    let token = tokenNodeByPlayerId.get(player.id);
    if (!token) {
      token = document.createElement('div');
      tokenNodeByPlayerId.set(player.id, token);
    }
    token.className = 'player-token';
    if (player.id === gs.currentPlayerIndex) token.classList.add('active');
    token.style.backgroundColor = player.color;
    token.style.backgroundImage = `url('${getPawnIcon(player.pawn)}')`;
    token.textContent = getInitial(player.name);
    token.title = `${player.name} — ${player.money} zł`;
    layer.appendChild(token);
  });

  tokenNodeByPlayerId.forEach((token, playerId) => {
    if (!usedPlayerIds.has(playerId)) {
      token.remove();
      tokenNodeByPlayerId.delete(playerId);
    }
  });
}

function renderBuildingIndicators(gs) {
  ACTIVE_BOARD_SPACES.forEach((space) => {
    const indEl = getEl(`buildings-${space.id}`);
    if (indEl) indEl.textContent = '';
  });

  Object.entries(gs.properties).forEach(([spaceId, propState]) => {
    const indEl = getEl(`buildings-${spaceId}`);
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
  ACTIVE_BOARD_SPACES.forEach(space => {
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

  const centerPlayer = getEl('center-player');
  const centerPhase  = getEl('center-phase');
  const centerDice   = getEl('center-dice');
  const cd1 = getEl('center-die1');
  const cd2 = getEl('center-die2');

  if (centerPlayer) {
    centerPlayer.textContent = `Tura: ${cur.name}`;
    centerPlayer.style.color = cur.color;
  }
  if (centerPhase) {
    centerPhase.textContent = PHASE_LABELS[gs.phase] || gs.phase;
  }

  const turnStats = getEl('turn-player-stats');
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
  const sideDie1 = getEl('die1');
  const sideDie2 = getEl('die2');
  if (sideDie1) sideDie1.textContent = gs.dice[0] > 0 ? DICE_FACES[gs.dice[0]] : '?';
  if (sideDie2) sideDie2.textContent = gs.dice[1] > 0 ? DICE_FACES[gs.dice[1]] : '?';

  // Card deck counts and active state
  const insightCountEl = getEl('insight-deck-count');
  const sessionCountEl = getEl('session-deck-count');
  if (insightCountEl) insightCountEl.textContent = (gs.insightCards ? gs.insightCards.length : 0) + ' kart';
  if (sessionCountEl) sessionCountEl.textContent = (gs.sessionCards ? gs.sessionCards.length : 0) + ' kart';

  const insightDeckEl = getEl('insight-deck');
  const sessionDeckEl = getEl('session-deck');
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
        ? 'Użyj karty wyjścia z kryzysu lub opłać karę.'
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
  const el = getEl('turn-queue');
  if (!el) return;
  el.innerHTML = '';
  const fragment = document.createDocumentFragment();
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

    fragment.appendChild(item);

    if (i < n - 1) {
      const sep = document.createElement('div');
      sep.className = 'tq-sep';
      sep.textContent = '›';
      fragment.appendChild(sep);
    }
  }
  el.appendChild(fragment);
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
  const list = getEl('players-list-panel');
  if (!list) return;
  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  gs.players.forEach((player, i) => {
    const card = document.createElement('div');
    card.className = `player-card-panel${i === gs.currentPlayerIndex ? ' active-turn' : ''}${player.bankrupt ? ' bankrupt' : ''}`;
    const propDots = player.properties.map(spaceId => {
      const sp = ACTIVE_BOARD_SPACES[spaceId];
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
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
}

function renderPropertiesPanel(gs) {
  const panel = getEl('properties-panel');
  if (!panel) return;
  panel.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const groups = {};
  Object.entries(GROUP_COLORS).forEach(([g]) => { groups[g] = []; });
  groups['railroad'] = [];
  groups['utility']  = [];

  ACTIVE_BOARD_SPACES.forEach(space => {
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
    fragment.appendChild(groupDiv);
  });
  panel.appendChild(fragment);

  if (!panel.innerHTML) panel.innerHTML = '<div style="opacity:.5;font-size:.8rem;padding:8px">Brak kupionych własności.</div>';
}

function renderLogPanel(gs) {
  const list = getEl('log-list');
  if (!list) return;
  const filterToTypes = {
    all: null,
    finance: ['money', 'penalty'],
    card: ['card'],
    critical: ['penalty', 'bankrupt'],
  };
  const allowedTypes = filterToTypes[logFilterMode] || null;
  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  gs.log
    .filter((entry) => !allowedTypes || allowedTypes.includes(entry.type || classifyLogType(entry.text, entry.isTurn)))
    .forEach(entry => {
    const div = document.createElement('div');
    const type = entry.type || classifyLogType(entry.text, entry.isTurn);
    div.className = `log-entry log-type-${type}${entry.isTurn ? ' log-turn' : ''}`;
    div.textContent = entry.text;
    fragment.appendChild(div);
    });
  list.appendChild(fragment);
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
  let primaryNextButtonId = null;

  const actionButtonIds = [
    'btn-roll',
    'btn-pay-jail',
    'btn-jail-card',
    'btn-undo',
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

  const modalBuyOpen = !!document.getElementById('modal-buy')?.classList.contains('open');
  const modalBuildOpen = !!document.getElementById('modal-build')?.classList.contains('open');
  const modalMortgageOpen = !!document.getElementById('modal-mortgage')?.classList.contains('open');
  if (!modalBuyOpen && !modalBuildOpen && !modalMortgageOpen) clearActionSuggestion();

  const phaseInfo = document.getElementById('phase-info');
  if (phaseInfo) {
    if (curIsAI) {
      phaseInfo.innerHTML = `<span class="ai-thinking-indicator">Status fazy: 🤖 AI myśli…</span>`;
    } else {
      const suggestionLine = isActionGuidanceEnabled() && actionSuggestion
        ? `<br><strong>Sugestia:</strong> ${actionSuggestion.label}${actionSuggestion.reasons.length ? ` (${actionSuggestion.reasons[0]})` : ''}.`
        : '';
      phaseInfo.innerHTML = `Szczegóły znajdziesz wyżej w panelu „Status tury”.${suggestionLine}`;
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

  const btnUndo = document.getElementById('btn-undo');
  const undoAvailability = getUndoAvailability(gs, myTurn, curIsAI);
  btnUndo.style.display = gameMode === 'local' ? 'flex' : 'none';
  btnUndo.disabled = !undoAvailability.available;
  setDisabledReason(btnUndo, undoAvailability.reason);
  if (phaseInfo && gameMode === 'local' && !undoAvailability.available && !curIsAI) {
    phaseInfo.innerHTML += `<br><span class="undo-status">↩ Cofnij: ${undoAvailability.reason}</span>`;
  }

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

    if (phaseInfo && !curIsAI) {
      const suggestionLine = isActionGuidanceEnabled() && actionSuggestion
        ? `<br><strong>Sugestia:</strong> ${actionSuggestion.label}${actionSuggestion.reasons.length ? ` (${actionSuggestion.reasons[0]})` : ''}.`
        : '';
      phaseInfo.innerHTML = `Szczegóły znajdziesz wyżej w panelu „Status tury”.${suggestionLine}`;
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
    if (metaProgress) metaProgress.stats.totalDoubleRolls++;
    if (currentRunStats) currentRunStats.doubledRolls++;
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
      player.money    -= activeBalanceProfile.jailFine;
      player.inJail    = false;
      player.jailTurns = 0;
      addLog(gs, `${player.name} zapłacił karę ${activeBalanceProfile.jailFine} zł i wyszedł z Izolacji.`);
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
      if (metaProgress) metaProgress.stats.totalPassGo++;
      applyPlayerDelta(gs, player, { money: activeBalanceProfile.goMoney, prestige: 2, energy: 1 }, 'START');
      addLog(gs, `${player.name} przeszedł przez START — bonus miesięczny (+${activeBalanceProfile.goMoney} zł, +2 prestiżu, +1 energii).`);
      showToast(`${player.name} przeszedł przez START! +${activeBalanceProfile.goMoney} zł / +2⭐ / +1🔋`);
    }
    player.position = newPos;
    isAnimating = false;
    animatingPlayerData = null;
    const spaceName = ACTIVE_BOARD_SPACES[newPos] ? ACTIVE_BOARD_SPACES[newPos].name : `pole ${newPos}`;
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
  const space = ACTIVE_BOARD_SPACES[player.position];
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
      if (metaProgress) {
        metaProgress.stats.totalRentPaid += rent;
        metaProgress.stats.totalRentReceived += rent;
      }
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
    const owned = ACTIVE_BOARD_SPACES.filter(s =>
      s.type === 'railroad' && gs.properties[s.id] && gs.properties[s.id].owner === propState.owner
    ).length;
    return 25 * Math.pow(2, owned - 1); // 25, 50, 100, 200
  }
  if (space.type === 'utility') {
    const owned = ACTIVE_BOARD_SPACES.filter(s =>
      s.type === 'utility' && gs.properties[s.id] && gs.properties[s.id].owner === propState.owner
    ).length;
    const diceTotal = gs.dice[0] + gs.dice[1];
    return diceTotal * (owned >= 2 ? 10 : 4);
  }
  // Regular property
  if (propState.hotel)        return space.rent[5];
  if (propState.houses > 0)   return space.rent[Math.min(propState.houses, 4)];

  // Check color monopoly
  const groupProps = ACTIVE_BOARD_SPACES.filter(s => s.type === 'property' && s.group === space.group);
  const ownsAll    = groupProps.every(s => gs.properties[s.id] && gs.properties[s.id].owner === propState.owner);
  return ownsAll ? space.rent[0] * 2 : space.rent[0];
}

function sendToJail(gs, player) {
  player.position  = JAIL_POSITION;
  player.inJail    = true;
  player.jailTurns = 0;
  applyPlayerDelta(gs, player, { energy: -10, burnout: 10, prestige: -4 }, 'kryzys zawodowy');
  addLog(gs, `${player.name} trafia do Izolacji!`);
  if (metaProgress) metaProgress.stats.totalJailVisits++;
  showToast(`${player.name} trafia do Izolacji! 🔒`);
  playSfx('jail');
}

// ============================================================
// CARD DRAWING
// ============================================================
function doDrawCard(gs, player, deck) {
  if (metaProgress) metaProgress.stats.totalCardsDrawn++;
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
  recordTurningPoint(gs, {
    type: 'card',
    playerName: player.name,
    text: `${player.name} dobrał kartę (${deck === 'insight' ? 'Szansy' : 'Społeczności'}).`,
    impact: 1,
  });
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
      player.money   += activeBalanceProfile.goMoney;
      addLog(gs, `${player.name} idzie na START i otrzymuje ${activeBalanceProfile.goMoney} zł.`);
      gs.phase = 'end-turn';
      return;
    case 'advance-to': {
      if (card.target < player.position) {
        player.money += activeBalanceProfile.goMoney;
        addLog(gs, `${player.name} przeszedł przez START: +${activeBalanceProfile.goMoney} zł.`);
      }
      player.position = card.target;
      handleLanding(gs, player);
      return;
    }
    case 'move-forward': {
      const newPos = (player.position + card.steps) % 40;
      if (newPos < player.position) {
        player.money += activeBalanceProfile.goMoney;
        addLog(gs, `${player.name} przeszedł przez START: +${activeBalanceProfile.goMoney} zł.`);
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
  const space  = ACTIVE_BOARD_SPACES[spaceId];
  const player = gs.players[gs.currentPlayerIndex];

  if (!space || !player || player.money < space.price) return;

  applyPlayerDelta(gs, player, { money: -space.price, prestige: 2, energy: -3, burnout: 2 }, 'zakup aktywa');
  gs.properties[spaceId] = { owner: player.id, houses: 0, hotel: false, mortgaged: false };
  if (!player.properties.includes(spaceId)) player.properties.push(spaceId);

  addLog(gs, `${player.name} kupił ${space.name} za ${space.price} zł.`);
  if (metaProgress) metaProgress.stats.totalPropertiesBought++;
  if (space.price >= 220) {
    recordTurningPoint(gs, {
      type: 'investment',
      playerName: player.name,
      text: `${player.name} zrobił dużą inwestycję: ${space.name} (${space.price} zł).`,
      impact: space.price,
    });
  }
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
  player.money    -= activeBalanceProfile.jailFine;
  player.inJail    = false;
  player.jailTurns = 0;
  addLog(gs, `${player.name} zapłacił ${activeBalanceProfile.jailFine} zł i wyszedł z Izolacji.`);
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
    captureRoundSnapshot(gs, `koniec-rundy-${gs.roundsCompleted}`);
  }
  gs.doubles            = 0;
  gs.turn++;
  gs.phase              = 'rolling';
  gs.rolledThisTurn     = false;
  resetUndoForTurn(gs, 'Nowa tura: wykonaj akcję, aby odblokować cofnięcie.');
  if (metaProgress) metaProgress.stats.turnsEnded++;

  const active = gs.players.filter(p => !p.bankrupt);
  if (active.length <= 1) {
    gs.winner = active[0] ? active[0].id : null;
    gs.phase = 'end';
    if (active[0]) addLog(gs, `🏆 ${active[0].name} wygrywa przez przetrwanie rynku.`);
    playSfx('win');
    captureRoundSnapshot(gs, 'finał-przetrwanie');
    return;
  }
  const maxRounds = gs.maxRounds || activeBalanceProfile.maxRounds || DEFAULT_MAX_ROUNDS;
  if (gs.roundsCompleted >= maxRounds) {
    const sorted = [...active].sort((a, b) => getPrestigeScore(b) - getPrestigeScore(a));
    gs.winner = sorted[0].id;
    gs.phase = 'end';
    addLog(gs, `🏁 Koniec ${maxRounds} rund. Wygrywa ${sorted[0].name} bilansem zawodowym.`);
    playSfx('win');
    captureRoundSnapshot(gs, 'finał-limit-rund');
    return;
  }

  addLog(gs, `--- Tura gracza ${gs.players[next].name} ---`, true);
  playSfx('turn');
}

// ============================================================
// AI PLAYER LOGIC
// ============================================================

function getAiPersonalityProfile(player) {
  const personality = player.aiPersonality || 'balanced';
  if (personality === 'conservative') {
    return {
      key: 'conservative',
      label: 'zachowawcza',
      cashBuffer: AI_CASH_BUFFER + 140,
      minCash: 220,
      toleranceDrop: 16,
      burnoutWeight: 17,
      ethicsWeight: 12,
      balanceWeight: 1.2,
    };
  }
  if (personality === 'aggressive') {
    return {
      key: 'aggressive',
      label: 'agresywna',
      cashBuffer: Math.max(120, AI_CASH_BUFFER - 120),
      minCash: 100,
      toleranceDrop: 48,
      burnoutWeight: 12,
      ethicsWeight: 10,
      balanceWeight: 0.8,
    };
  }
  return {
    key: 'balanced',
    label: 'zbalansowana',
    cashBuffer: AI_CASH_BUFFER,
    minCash: 160,
    toleranceDrop: 28,
    burnoutWeight: 15,
    ethicsWeight: 11,
    balanceWeight: 1.0,
  };
}

function getAiBalanceScore(stats) {
  const values = [stats.prestige, stats.energy, stats.ethics, 100 - stats.burnout];
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + ((val - avg) ** 2), 0) / values.length;
  // 100 = very balanced, 0 = heavily skewed.
  return clampStat(100 - Math.sqrt(variance) * 1.6);
}

function getAiStateScore(player, profile) {
  const balance = getAiBalanceScore(player);
  const ethicsDanger = Math.max(0, 30 - player.ethics) * profile.ethicsWeight;
  const burnoutDanger = Math.max(0, player.burnout - 70) * profile.burnoutWeight;
  return (
    player.money +
    player.prestige * 11 +
    player.energy * 10 +
    player.ethics * 12 -
    player.burnout * 14 +
    balance * profile.balanceWeight -
    ethicsDanger -
    burnoutDanger
  );
}

function evaluateAiBuyDecision(player, space) {
  const profile = getAiPersonalityProfile(player);
  const projected = {
    money: player.money - space.price,
    prestige: player.prestige + 2,
    energy: clampStat(player.energy - 3),
    ethics: player.ethics,
    burnout: clampStat(player.burnout + 2),
  };
  const currentScore = getAiStateScore(player, profile);
  const projectedScore = getAiStateScore(projected, profile);
  const scoreDelta = Math.round(projectedScore - currentScore);

  if (projected.money < profile.minCash) {
    return { shouldBuy: false, reason: `${profile.label}: niski bufor gotówki` };
  }
  if (projected.burnout >= 92) {
    return { shouldBuy: false, reason: `${profile.label}: ryzyko krytycznego wypalenia` };
  }
  if (projected.ethics <= 12) {
    return { shouldBuy: false, reason: `${profile.label}: ryzyko załamania etyki` };
  }
  if (projectedScore + profile.toleranceDrop < currentScore) {
    return { shouldBuy: false, reason: `${profile.label}: bilans stats ↓ (${scoreDelta})` };
  }
  return { shouldBuy: true, reason: `${profile.label}: bilans stats ↑ (${scoreDelta})` };
}

function logAiDecision(gs, player, reason) {
  addLog(gs, `🤖 ${player.name}: ${reason}`, false, 'turn');
}

/**
 * Schedule an AI step if the current player is an AI.
 * A stable delay keeps UI pacing predictable and avoids bursty AI input.
 */
function scheduleAiTurnIfNeeded(gs) {
  if (gameMode !== 'local' || !gs || gs.phase === 'end') return;
  const cur = gs.players[gs.currentPlayerIndex];
  if (!cur || cur.bankrupt || !cur.isAI) return;
  if (aiStepPending) return;
  aiStepPending = true;
  if (aiStepTimer) clearTimeout(aiStepTimer);
  const elapsed = Date.now() - lastAiDecisionAt;
  const delay = elapsed >= AI_DECISION_DELAY_MS ? AI_DECISION_DELAY_MS : AI_DECISION_DELAY_MS - elapsed;
  aiStepTimer = setTimeout(() => {
    aiStepTimer = null;
    aiStepPending = false;
    if (!localGame || localGame.phase === 'end') return;
    const player = localGame.players[localGame.currentPlayerIndex];
    if (!player || !player.isAI) return;
    lastAiDecisionAt = Date.now();
    aiStep(localGame);
    updateUI(localGame);
  }, delay);
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
          logAiDecision(gs, player, 'używam karty wyjścia z Izolacji');
          doUseJailCard(gs);
        } else if (player.money >= activeBalanceProfile.jailFine &&
                   (Math.random() < 0.5 || player.jailTurns >= MAX_JAIL_TURNS - 1)) {
          logAiDecision(gs, player, 'płacę karę, żeby odzyskać tempo');
          doPayJail(gs);
        } else {
          logAiDecision(gs, player, 'ryzykuję rzut w Izolacji');
          doRoll(gs);
        }
      } else {
        logAiDecision(gs, player, 'rzucam kośćmi');
        doRoll(gs);
      }
      break;
    }
    case 'buying': {
      if (gs.pendingBuy) {
        const space = ACTIVE_BOARD_SPACES[gs.pendingBuy.spaceId];
        if (!space) break;
        const profile = getAiPersonalityProfile(player);
        const decision = evaluateAiBuyDecision(player, space);
        if (player.money >= space.price + profile.cashBuffer && decision.shouldBuy) {
          logAiDecision(gs, player, `kupuję ${space.name} (${decision.reason})`);
          doBuy(gs);
        } else {
          const reason = player.money < space.price + profile.cashBuffer
            ? `${profile.label}: za mały bufor gotówki`
            : decision.reason;
          logAiDecision(gs, player, `pomijam ${space.name} (${reason})`);
          doPassBuy(gs);
        }
      }
      break;
    }
    case 'card': {
      logAiDecision(gs, player, 'akceptuję efekt karty');
      doCardOk(gs);
      break;
    }
    case 'end-turn': {
      logAiDecision(gs, player, 'kończę turę');
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
  if (metaProgress) metaProgress.stats.bankruptcies++;
  if (currentRunStats) currentRunStats.bankruptPlayers.add(player.id);
  if (player.energy <= 0) addLog(gs, `💥 ${player.name} odpada: energia spadła do zera.`);
  else if (player.ethics <= 0) addLog(gs, `⚠️ ${player.name} odpada: etyka spadła do zera.`);
  else addLog(gs, `🔥 ${player.name} odpada: krytyczne wypalenie.`);
  recordTurningPoint(gs, {
    type: 'bankruptcy',
    playerName: player.name,
    text: `${player.name} odpada z gry przez krytyczne statystyki.`,
    impact: -300,
  });
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
    const sp = ACTIVE_BOARD_SPACES[spaceId];
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
  if (!player.bankrupt) {
    player.bankrupt = true;
    if (metaProgress) metaProgress.stats.bankruptcies++;
    if (currentRunStats) currentRunStats.bankruptPlayers.add(player.id);
  }
  addLog(gs, `💀 ${player.name} zbankrutował!`);
  recordTurningPoint(gs, {
    type: 'bankruptcy',
    playerName: player.name,
    text: `${player.name} zbankrutował i stracił kontrolę nad majątkiem.`,
    impact: -500,
  });
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
    const sp = ACTIVE_BOARD_SPACES[spaceId];
    const ps = gs.properties[spaceId];
    if (!sp || !ps || sp.type !== 'property' || ps.mortgaged) return;

    const groupProps = ACTIVE_BOARD_SPACES.filter(s => s.type === 'property' && s.group === sp.group);
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

  let cheapestBuildCost = Infinity;
  container.querySelectorAll('button[data-action="build"]').forEach((btn) => {
    const spaceId = parseInt(btn.dataset.id, 10);
    const sp = ACTIVE_BOARD_SPACES[spaceId];
    const ps = gs.properties[spaceId];
    if (!sp || !ps) return;
    const cost = ps.houses >= 4 ? sp.hotelCost : sp.houseCost;
    if (cost < cheapestBuildCost) cheapestBuildCost = cost;
  });
  setActionSuggestion(gs, 'build', { projectedCost: Number.isFinite(cheapestBuildCost) ? cheapestBuildCost : 0 });

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action  = btn.dataset.action;
      const spaceId = parseInt(btn.dataset.id);
      if (gameMode === 'local') {
        snapshotActionState(gs, { label: action === 'build' ? 'rozwój aktywa' : 'sprzedaż certyfikatu' });
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
  const sp = ACTIVE_BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps || ps.mortgaged || ps.hotel) return;
  const buildCost = ps.houses >= 4 ? sp.hotelCost : sp.houseCost;
  if (player.money < buildCost) { showToast('Za mało pieniędzy!'); return; }

  const groupProps = ACTIVE_BOARD_SPACES.filter(s => s.type === 'property' && s.group === sp.group);
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
    recordTurningPoint(gs, {
      type: 'investment',
      playerName: player.name,
      text: `${player.name} osiągnął pełną specjalizację na ${sp.name} (${buildCost} zł).`,
      impact: buildCost,
    });
    showToast(`Pełna specjalizacja na ${sp.name}!`);
    playSfx('build');
  } else {
    ps.houses = (ps.houses || 0) + 1;
    addLog(gs, `${player.name} dokupił certyfikat na ${sp.name} (${ps.houses} domów).`);
    if (buildCost >= 150) {
      recordTurningPoint(gs, {
        type: 'investment',
        playerName: player.name,
        text: `${player.name} rozbudował ${sp.name} (+${buildCost} zł inwestycji).`,
        impact: buildCost,
      });
    }
    showToast(`Dodano certyfikat na ${sp.name}!`);
    playSfx('build');
  }
  if (metaProgress) metaProgress.stats.totalBuildActions++;
}

function doSellHouse(gs, player, spaceId) {
  const sp = ACTIVE_BOARD_SPACES[spaceId];
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
    const sp = ACTIVE_BOARD_SPACES[spaceId];
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

  setActionSuggestion(gs, 'mortgage', { projectedCost: 0 });

  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action  = btn.dataset.action;
      const spaceId = parseInt(btn.dataset.id);
      if (gameMode === 'local') {
        snapshotActionState(gs, { label: action === 'mortgage' ? 'zastawienie aktywa' : 'odkupienie aktywa z zastawu' });
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
  const sp = ACTIVE_BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps || ps.mortgaged || ps.hotel || ps.houses) return;
  player.money += sp.mortgage;
  ps.mortgaged = true;
  addLog(gs, `${player.name} zastawił ${sp.name} za ${sp.mortgage} zł.`);
  if (metaProgress) metaProgress.stats.totalMortgageActions++;
  showToast(`Zastawiono ${sp.name} +${sp.mortgage} zł`);
  playSfx('mortgage');
}

function doUnmortgage(gs, player, spaceId) {
  const sp = ACTIVE_BOARD_SPACES[spaceId];
  const ps = gs.properties[spaceId];
  if (!sp || !ps || !ps.mortgaged) return;
  const cost = Math.floor(sp.mortgage * 1.1);
  if (player.money < cost) { showToast('Za mało pieniędzy!'); return; }
  player.money -= cost;
  ps.mortgaged = false;
  addLog(gs, `${player.name} odkupił ${sp.name} za ${cost} zł.`);
  if (metaProgress) metaProgress.stats.totalMortgageActions++;
  showToast(`Odkupiono ${sp.name} -${cost} zł`);
  playSfx('mortgage');
}

// ============================================================
// MODALS
// ============================================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modalFocusReturnMap.set(id, document.activeElement instanceof HTMLElement ? document.activeElement : null);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable instanceof HTMLElement) {
    firstFocusable.focus();
  }
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  const previousFocus = modalFocusReturnMap.get(id);
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
  modalFocusReturnMap.delete(id);
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

  const space  = ACTIVE_BOARD_SPACES[spaceId];
  const player = gs.players[gs.currentPlayerIndex];
  if (!space || !player) return;

  setActionSuggestion(gs, 'buy', { projectedCost: space.price || 0 });

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
  ensureGameAnalytics(gs);
  if (!gs.analytics.snapshots.length) captureRoundSnapshot(gs, 'finał-awaryjny');
  const winner = gs.players[gs.winner];
  document.getElementById('gameover-winner-name').textContent = winner ? winner.name : 'Nieznany';
  const summary = document.getElementById('gameover-summary');
  summary.textContent = `Rundy: ${gs.roundsCompleted}/${MAX_ROUNDS} · Tury: ${gs.turn} · Snapshoty: ${gs.analytics.snapshots.length}`;

  const final = document.getElementById('gameover-final');
  final.innerHTML = '';
  const sorted = [...gs.players].sort((a, b) => getPrestigeScore(b) - getPrestigeScore(a));
  sorted.forEach((p, idx) => {
    const total = getPrestigeScore(p);
    const div = document.createElement('div');
    div.className = 'gameover-player';
    div.innerHTML = `
      <div class="player-token-sm" style="background:${p.color}; background-image:url('${getPawnIcon(p.pawn)}')">${getInitial(p.name)}</div>
      <div class="gameover-player-name">${escHtml(p.name)}${p.bankrupt ? ' 💀' : ''}</div>
      <div class="gameover-player-money">#${idx + 1} · ${formatMoney(p.money)} · ⭐${p.prestige} · 🔋${p.energy} · ⚖️${p.ethics} · 🔥${p.burnout} · Σ ${total}</div>`;
    final.appendChild(div);
  });

  const metricsEl = document.getElementById('gameover-metrics');
  const [leader, runnerUp] = sorted;
  const firstSnapshot = gs.analytics.snapshots[0];
  const lastSnapshot = gs.analytics.snapshots[gs.analytics.snapshots.length - 1];
  const scoreSwing = leader && firstSnapshot
    ? (lastSnapshot.players.find((p) => p.id === leader.id)?.score || getPrestigeScore(leader))
      - (firstSnapshot.players.find((p) => p.id === leader.id)?.score || 0)
    : 0;
  const avgBurnout = sorted.length ? Math.round(sorted.reduce((acc, p) => acc + (p.burnout || 0), 0) / sorted.length) : 0;
  const metricCards = [
    `🥇 Przewaga lidera: <strong>${leader && runnerUp ? (getPrestigeScore(leader) - getPrestigeScore(runnerUp)) : 0} pkt</strong>`,
    `💼 Majątek lidera: <strong>${leader ? formatMoney(getAssetValue(gs, leader)) : '0 zł'}</strong>`,
    `📈 Momentum zwycięzcy: <strong>${scoreSwing >= 0 ? '+' : ''}${scoreSwing} pkt</strong>`,
    `🔥 Średnie wypalenie: <strong>${avgBurnout}</strong>`,
    `🏠 Najwięcej własności: <strong>${Math.max(...sorted.map((p) => (p.properties || []).length), 0)}</strong>`,
  ];
  metricsEl.innerHTML = metricCards.map((txt) => `<div class="gameover-metric-card">${txt}</div>`).join('');

  const turningPointsEl = document.getElementById('gameover-turning-points');
  const interestingEvents = [...gs.analytics.events]
    .sort((a, b) => Math.abs(b.impact || 0) - Math.abs(a.impact || 0))
    .slice(0, 5);
  if (!interestingEvents.length) {
    turningPointsEl.innerHTML = '<h3>Punkty zwrotne</h3><p>Brak wyraźnych zdarzeń krytycznych w tym meczu.</p>';
  } else {
    turningPointsEl.innerHTML = `<h3>Punkty zwrotne</h3><ul>${interestingEvents.map((evt) => (
      `<li><strong>Runda ${evt.round}</strong>: ${escHtml(evt.text)}</li>`
    )).join('')}</ul>`;
  }

  const formulaEl = document.getElementById('gameover-formula');
  formulaEl.innerHTML = `
    <h3>Jak liczony jest wynik końcowy?</h3>
    <p><code>Σ = gotówka + (prestiż × 12) + (energia × 8) + (etyka × 8) - (wypalenie × 10)</code></p>
    <p>W praktyce: zwycięzca to gracz z najwyższym Σ po eliminacjach lub po ${MAX_ROUNDS} rundach.</p>`;

  showScreen('screen-game-over');
}
