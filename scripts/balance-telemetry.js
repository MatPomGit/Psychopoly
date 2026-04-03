#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBrowserFile(relPath, context) {
  const fullPath = path.join(__dirname, '..', relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  vm.runInContext(code, context, { filename: relPath });
}

function loadData() {
  const context = vm.createContext({ window: {} });
  loadBrowserFile('public/config.js', context);
  loadBrowserFile('public/board-data.js', context);
  return {
    presets: context.window.PSYCHOPOLY_BALANCE_PRESETS,
    boardSpaces: vm.runInContext('BOARD_SPACES', context),
    insightCards: vm.runInContext('INSIGHT_CARDS', context),
    sessionCards: vm.runInContext('SESSION_CARDS', context),
  };
}

function score(p) {
  return p.money + (p.prestige * 12) + (p.energy * 8) + (p.ethics * 8) - (p.burnout * 10);
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function applyProfile(board, profile) {
  return board.map((s) => {
    const n = { ...s };
    if (n.type === 'property') {
      n.houseCost = Math.round(n.houseCost * profile.developmentCostMultiplier);
      n.hotelCost = Math.round(n.hotelCost * profile.developmentCostMultiplier);
    }
    if (n.type === 'tax' && typeof n.amount === 'number') {
      n.amount = Math.round(n.amount * profile.penaltyMultiplier);
    }
    return n;
  });
}

function scaledCard(card, m) {
  const n = { ...card };
  ['money', 'amount', 'perHouse', 'perHotel'].forEach((k) => {
    if (typeof n[k] === 'number') n[k] = Math.round(n[k] * m);
  });
  return n;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function runGame(data, profile, options = {}) {
  const board = applyProfile(data.boardSpaces, profile);
  const insight = data.insightCards.map((c) => scaledCard(c, profile.cardMoneyMultiplier));
  const session = data.sessionCards.map((c) => scaledCard(c, profile.cardMoneyMultiplier));
  const players = Array.from({ length: options.players || 4 }, (_, i) => ({
    id: i,
    money: profile.startingMoney,
    prestige: 10,
    energy: 50,
    ethics: 50,
    burnout: 0,
    pos: 0,
    bankrupt: false,
    properties: [],
  }));
  const state = { owners: {}, houses: {} };
  const maxTurns = (options.maxRounds || 12) * players.length;

  let cardMoneyImpact = 0;
  let cardDraws = 0;
  let totalMoneyDelta = 0;
  let totalTurns = 0;

  const drawCard = (deck) => deck[randomInt(deck.length)];

  for (let turn = 0; turn < maxTurns; turn++) {
    const p = players[turn % players.length];
    if (p.bankrupt) continue;
    totalTurns++;
    const before = p.money;

    const roll = (randomInt(6) + 1) + (randomInt(6) + 1);
    const raw = p.pos + roll;
    if (raw >= 40) p.money += profile.goMoney;
    p.pos = raw % 40;
    const s = board[p.pos];

    if (s.type === 'property' || s.type === 'railroad' || s.type === 'utility') {
      const owner = state.owners[s.id];
      if (owner == null) {
        if (p.money > s.price + 220) {
          p.money -= s.price;
          p.prestige += 2;
          p.energy = clamp(p.energy - 3);
          p.burnout = clamp(p.burnout + 2);
          state.owners[s.id] = p.id;
          p.properties.push(s.id);
          state.houses[s.id] = 0;
        }
      } else if (owner !== p.id && !players[owner].bankrupt) {
        const rent = (s.rent && s.rent[0]) || 25;
        p.money -= rent;
        players[owner].money += rent;
        p.energy = clamp(p.energy - 4);
        p.burnout = clamp(p.burnout + 2);
      } else if (owner === p.id && s.type === 'property' && state.houses[s.id] < 3) {
        const buildCost = s.houseCost;
        if (p.money > buildCost + 180 && Math.random() < 0.25) {
          p.money -= buildCost;
          state.houses[s.id] += 1;
        }
      }
    } else if (s.type === 'tax') {
      p.money -= s.amount;
      p.energy = clamp(p.energy - 2);
    } else if (s.type === 'card') {
      cardDraws++;
      const card = drawCard(s.deck === 'insight' ? insight : session);
      const delta = (card.money || 0) + (card.amount || 0);
      if (delta !== 0) {
        p.money += delta;
        cardMoneyImpact += Math.abs(delta);
      }
      p.prestige = clamp(p.prestige + (card.prestige || 0));
      p.energy = clamp(p.energy + (card.energy || 0));
      p.ethics = clamp(p.ethics + (card.ethics || 0));
      p.burnout = clamp(p.burnout + (card.burnout || 0));
    } else if (s.type === 'gotojail') {
      p.money -= profile.jailFine;
      p.energy = clamp(p.energy - 10);
      p.burnout = clamp(p.burnout + 10);
      p.pos = 14;
    }

    if (p.money < 0 || p.energy <= 0 || p.ethics <= 0 || p.burnout >= 100) {
      p.bankrupt = true;
      p.properties.forEach((id) => delete state.owners[id]);
    }

    totalMoneyDelta += (p.money - before);
    const alive = players.filter((pl) => !pl.bankrupt);
    if (alive.length <= 1) break;
  }

  const alive = players.filter((p) => !p.bankrupt);
  const ranking = [...(alive.length ? alive : players)].sort((a, b) => score(b) - score(a));
  const winner = ranking[0];
  const richest = [...players].sort((a, b) => b.money - a.money)[0];

  return {
    turns: totalTurns,
    bankruptcies: players.filter((p) => p.bankrupt).length,
    avgCashflowPerTurn: totalTurns ? totalMoneyDelta / totalTurns : 0,
    cardImpactPerDraw: cardDraws ? cardMoneyImpact / cardDraws : 0,
    winnerNotRichestCash: winner.id !== richest.id,
  };
}

function aggregate(results) {
  const n = results.length;
  const sum = (fn) => results.reduce((a, r) => a + fn(r), 0);
  return {
    games: n,
    avgTurns: +(sum((r) => r.turns) / n).toFixed(2),
    avgBankruptcies: +(sum((r) => r.bankruptcies) / n).toFixed(2),
    avgCashflowPerTurn: +(sum((r) => r.avgCashflowPerTurn) / n).toFixed(2),
    avgCardImpactPerDraw: +(sum((r) => r.cardImpactPerDraw) / n).toFixed(2),
    winnerNotRichestCashRate: +((sum((r) => (r.winnerNotRichestCash ? 1 : 0)) / n) * 100).toFixed(2),
  };
}

function main() {
  const data = loadData();
  const games = Number(process.argv[2] || 250);
  const out = {
    createdAt: new Date().toISOString(),
    gamesPerPreset: games,
    presets: {},
  };

  Object.entries(data.presets).forEach(([key, profile]) => {
    const results = Array.from({ length: games }, () => runGame(data, profile));
    out.presets[key] = {
      label: profile.label,
      profile,
      telemetry: aggregate(results),
    };
  });

  const dest = path.join(__dirname, '..', 'docs', 'balance-telemetry-latest.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`Saved telemetry to ${dest}`);
  console.log(JSON.stringify(out, null, 2));
}

main();
