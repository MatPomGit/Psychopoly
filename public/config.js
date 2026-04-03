'use strict';

window.PSYCHOPOLY_BALANCE_PRESETS = {
  szybka: {
    label: 'Szybka',
    startingMoney: 1200,
    goMoney: 160,
    jailFine: 80,
    developmentCostMultiplier: 0.8,
    penaltyMultiplier: 1.2,
    cardMoneyMultiplier: 1.15,
  },
  standard: {
    label: 'Standard',
    startingMoney: 1500,
    goMoney: 200,
    jailFine: 60,
    developmentCostMultiplier: 0.95,
    penaltyMultiplier: 1.0,
    cardMoneyMultiplier: 1.0,
  },
  strategiczna: {
    label: 'Strategiczna',
    startingMoney: 1750,
    goMoney: 180,
    jailFine: 100,
    developmentCostMultiplier: 1.15,
    penaltyMultiplier: 1.1,
    cardMoneyMultiplier: 0.9,
  },
};

window.PSYCHOPOLY_DEFAULT_CONFIG = {
  animationSpeed: 1, // 0.5 - 2.0
  fontScale: 1,      // 0.8 - 1.4
  renderQuality: 'high', // low | medium | high
  boardFxIntensity: 1,   // 0.5 - 1.5
  theme: 'classic',      // classic | dark | calm
  balancePreset: 'standard',
  actionGuidanceEnabled: true,
};
