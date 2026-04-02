// ============================================================
// BOARD SPACES (40 spaces, clockwise from 0)
// ============================================================
const BOARD_SPACES = [
  { id: 0,  type: 'go',         name: 'START',                    description: 'Zbierz 200 zł przy każdym przejściu' },
  { id: 1,  type: 'property',   name: 'Odruch Bezwarunkowy',       group: 'purple',   price: 60,  rent: [2,10,30,90,160,250],       houseCost: 50,  hotelCost: 50,  mortgage: 30 },
  { id: 2,  type: 'card',       name: 'Karta Sesji',               deck: 'session' },
  { id: 3,  type: 'property',   name: 'Odruch Warunkowy',          group: 'purple',   price: 60,  rent: [4,20,60,180,320,450],       houseCost: 50,  hotelCost: 50,  mortgage: 30 },
  { id: 4,  type: 'tax',        name: 'Podatek od Stresu',         amount: 200 },
  { id: 5,  type: 'railroad',   name: 'Stacja Freud',              price: 200, mortgage: 100 },
  { id: 6,  type: 'property',   name: 'Warunkowanie Klasyczne',    group: 'lightblue', price: 100, rent: [6,30,90,270,400,550],      houseCost: 50,  hotelCost: 50,  mortgage: 50 },
  { id: 7,  type: 'card',       name: 'Karta Wglądu',              deck: 'insight' },
  { id: 8,  type: 'property',   name: 'Warunkowanie Instrumentalne', group: 'lightblue', price: 100, rent: [6,30,90,270,400,550],   houseCost: 50,  hotelCost: 50,  mortgage: 50 },
  { id: 9,  type: 'property',   name: 'Zachowanie Operantne',      group: 'lightblue', price: 120, rent: [8,40,100,300,450,600],    houseCost: 50,  hotelCost: 50,  mortgage: 60 },
  { id: 10, type: 'jail',       name: 'Izolacja',                  description: 'Tylko wizyta / Izolacja' },
  { id: 11, type: 'property',   name: 'Projekcja',                 group: 'pink',     price: 140, rent: [10,50,150,450,625,750],    houseCost: 100, hotelCost: 100, mortgage: 70 },
  { id: 12, type: 'utility',    name: 'Laboratorium Badań',        price: 150, mortgage: 75 },
  { id: 13, type: 'property',   name: 'Racjonalizacja',            group: 'pink',     price: 140, rent: [10,50,150,450,625,750],    houseCost: 100, hotelCost: 100, mortgage: 70 },
  { id: 14, type: 'railroad',   name: 'Stacja Pavlov',             price: 200, mortgage: 100 },
  { id: 15, type: 'property',   name: 'Sublimacja',                group: 'pink',     price: 160, rent: [12,60,180,500,700,900],    houseCost: 100, hotelCost: 100, mortgage: 80 },
  { id: 16, type: 'card',       name: 'Karta Sesji',               deck: 'session' },
  { id: 17, type: 'property',   name: 'Przeniesienie',             group: 'orange',   price: 180, rent: [14,70,200,550,750,950],    houseCost: 100, hotelCost: 100, mortgage: 90 },
  { id: 18, type: 'utility',    name: 'Centrum Terapii',           price: 150, mortgage: 75 },
  { id: 19, type: 'property',   name: 'Identyfikacja',             group: 'orange',   price: 200, rent: [16,80,220,600,800,1000],   houseCost: 100, hotelCost: 100, mortgage: 100 },
  { id: 20, type: 'freeparking',name: 'Wolna Wola',                description: 'Nic się nie dzieje' },
  { id: 21, type: 'property',   name: 'Wyparcie',                  group: 'red',      price: 220, rent: [18,90,250,700,875,1050],   houseCost: 150, hotelCost: 150, mortgage: 110 },
  { id: 22, type: 'card',       name: 'Karta Wglądu',              deck: 'insight' },
  { id: 23, type: 'property',   name: 'Reakcja Obronna',           group: 'red',      price: 220, rent: [18,90,250,700,875,1050],   houseCost: 150, hotelCost: 150, mortgage: 110 },
  { id: 24, type: 'railroad',   name: 'Stacja Adler',              price: 200, mortgage: 100 },
  { id: 25, type: 'property',   name: 'Nadkompensacja',            group: 'yellow',   price: 260, rent: [22,110,330,800,975,1150],  houseCost: 150, hotelCost: 150, mortgage: 130 },
  { id: 26, type: 'property',   name: 'Terapia Gestalt',           group: 'yellow',   price: 260, rent: [22,110,330,800,975,1150],  houseCost: 150, hotelCost: 150, mortgage: 130 },
  { id: 27, type: 'card',       name: 'Karta Sesji',               deck: 'session' },
  { id: 28, type: 'property',   name: 'Samoaktualizacja',          group: 'yellow',   price: 280, rent: [24,120,360,850,1025,1200], houseCost: 150, hotelCost: 150, mortgage: 140 },
  { id: 29, type: 'railroad',   name: 'Stacja Skinner',            price: 200, mortgage: 100 },
  { id: 30, type: 'gotojail',   name: 'Hospitalizacja',            description: 'Idź do Izolacji' },
  { id: 31, type: 'property',   name: 'Mindfulness',               group: 'green',    price: 300, rent: [26,130,390,900,1100,1275], houseCost: 200, hotelCost: 200, mortgage: 150 },
  { id: 32, type: 'property',   name: 'Empatia',                   group: 'green',    price: 300, rent: [26,130,390,900,1100,1275], houseCost: 200, hotelCost: 200, mortgage: 150 },
  { id: 33, type: 'card',       name: 'Karta Wglądu',              deck: 'insight' },
  { id: 34, type: 'tax',        name: 'Podatek Luksusowy',         amount: 100 },
  { id: 35, type: 'railroad',   name: 'Stacja Rogers',             price: 200, mortgage: 100 },
  { id: 36, type: 'property',   name: 'Neuroplastyczność',         group: 'darkblue', price: 350, rent: [35,175,500,1100,1300,1500],houseCost: 200, hotelCost: 200, mortgage: 175 },
  { id: 37, type: 'card',       name: 'Karta Sesji',               deck: 'session' },
  { id: 38, type: 'property',   name: 'Świadomość',                group: 'darkblue', price: 400, rent: [50,200,600,1400,1700,2000],houseCost: 200, hotelCost: 200, mortgage: 200 },
  { id: 39, type: 'property',   name: 'Ego',                       group: 'darkblue', price: 400, rent: [50,200,600,1400,1700,2000],houseCost: 200, hotelCost: 200, mortgage: 200 },
];

// ============================================================
// GRID POSITIONS — 11×11 CSS grid (1-indexed)
// grid-template-columns: 80px repeat(9,60px) 80px
// grid-template-rows:    80px repeat(9,60px) 80px
//
// space 0  (GO, bottom-right)  : row 11, col 11
// space 1..9 (bottom row, right→left): row 11, cols 10..2
// space 10 (Jail, bottom-left) : row 11, col 1
// space 11..19 (left col, bottom→top): rows 10..2, col 1
// space 20 (Free Parking, top-left): row 1, col 1
// space 21..29 (top row, left→right): row 1, cols 2..10
// space 30 (Go to Jail, top-right): row 1, col 11
// space 31..39 (right col, top→bottom): rows 2..10, col 11
// ============================================================
const GRID_POSITIONS = {
   0: { row: 11, col: 11 },
   1: { row: 11, col: 10 },
   2: { row: 11, col:  9 },
   3: { row: 11, col:  8 },
   4: { row: 11, col:  7 },
   5: { row: 11, col:  6 },
   6: { row: 11, col:  5 },
   7: { row: 11, col:  4 },
   8: { row: 11, col:  3 },
   9: { row: 11, col:  2 },
  10: { row: 11, col:  1 },
  11: { row: 10, col:  1 },
  12: { row:  9, col:  1 },
  13: { row:  8, col:  1 },
  14: { row:  7, col:  1 },
  15: { row:  6, col:  1 },
  16: { row:  5, col:  1 },
  17: { row:  4, col:  1 },
  18: { row:  3, col:  1 },
  19: { row:  2, col:  1 },
  20: { row:  1, col:  1 },
  21: { row:  1, col:  2 },
  22: { row:  1, col:  3 },
  23: { row:  1, col:  4 },
  24: { row:  1, col:  5 },
  25: { row:  1, col:  6 },
  26: { row:  1, col:  7 },
  27: { row:  1, col:  8 },
  28: { row:  1, col:  9 },
  29: { row:  1, col: 10 },
  30: { row:  1, col: 11 },
  31: { row:  2, col: 11 },
  32: { row:  3, col: 11 },
  33: { row:  4, col: 11 },
  34: { row:  5, col: 11 },
  35: { row:  6, col: 11 },
  36: { row:  7, col: 11 },
  37: { row:  8, col: 11 },
  38: { row:  9, col: 11 },
  39: { row: 10, col: 11 },
};

// ============================================================
// GROUP COLORS
// ============================================================
const GROUP_COLORS = {
  purple:   '#9b59b6',
  lightblue:'#5dade2',
  pink:     '#e91e8c',
  orange:   '#e67e22',
  red:      '#e74c3c',
  yellow:   '#f1c40f',
  green:    '#27ae60',
  darkblue: '#1a3a6b',
};

const GROUP_NAMES = {
  purple:   'Fioletowy',
  lightblue:'Błękitny',
  pink:     'Różowy',
  orange:   'Pomarańczowy',
  red:      'Czerwony',
  yellow:   'Żółty',
  green:    'Zielony',
  darkblue: 'Granatowy',
};

// ============================================================
// INSIGHT CARDS  (Chance equivalent – 16 cards)
// ============================================================
const INSIGHT_CARDS = [
  { id: 'I1',  text: 'Przełom terapeutyczny! Idź na START, zbierz 200 zł.',                                         action: 'advance-to-go' },
  { id: 'I2',  text: 'Twoja teoria okazała się słuszna. Otrzymaj 150 zł.',                                          action: 'collect',          amount: 150 },
  { id: 'I3',  text: 'Uczestniczyłeś w konferencji naukowej. Zapłać 50 zł.',                                        action: 'pay',              amount: 50  },
  { id: 'I4',  text: 'Osiągnąłeś stan flow. Przesuń się o 3 pola do przodu.',                                       action: 'move-forward',     steps: 3   },
  { id: 'I5',  text: 'Wyjdź z Izolacji za darmo.',                                                                  action: 'get-out-jail',     keep: true  },
  { id: 'I6',  text: 'Sesja z superwizorem. Cofnij się o 3 pola.',                                                  action: 'move-back',        steps: 3   },
  { id: 'I7',  text: 'Twój artykuł został opublikowany. Otrzymaj 100 zł.',                                          action: 'collect',          amount: 100 },
  { id: 'I8',  text: 'Kryzys tożsamości! Idź do Izolacji.',                                                         action: 'go-to-jail'                    },
  { id: 'I9',  text: 'Nagroda za badania naukowe. Otrzymaj 150 zł.',                                                action: 'collect',          amount: 150 },
  { id: 'I10', text: 'Zorganizuj warsztat terapeutyczny. Zapłać 50 zł za każdy dom, 115 zł za hotel.',              action: 'pay-per-building', perHouse: 50, perHotel: 115 },
  { id: 'I11', text: 'Praca z traumą przyniosła owoce. Otrzymaj 100 zł od banku.',                                  action: 'collect',          amount: 100 },
  { id: 'I12', text: 'Regresja. Cofnij się do Odruchu Bezwarunkowego.',                                             action: 'advance-to',       target: 1  },
  { id: 'I13', text: 'Sublimacja zakończona sukcesem. Otrzymaj 50 zł.',                                             action: 'collect',          amount: 50  },
  { id: 'I14', text: 'Przeżyłeś wypalenie zawodowe. Zapłać 150 zł.',                                               action: 'pay',              amount: 150 },
  { id: 'I15', text: 'Twoja intuicja okazała się trafna. Idź na Stację Freud.',                                     action: 'advance-to',       target: 5  },
  { id: 'I16', text: 'Mindfulness pomógł Ci się skupić. Otrzymaj 20 zł od każdego gracza.',                         action: 'collect-from-each',amount: 20  },
  { id: 'I17', text: 'Odkrycie naukowe! Nagroda za przełomowe badania. Otrzymaj 200 zł.',                           action: 'collect',          amount: 200 },
  { id: 'I18', text: 'Błąd metodologiczny w badaniach. Zapłać 100 zł.',                                            action: 'pay',              amount: 100 },
  { id: 'I19', text: 'Nowa technika terapeutyczna okazała się skuteczna. Przesuń się o 2 pola do przodu.',          action: 'move-forward',     steps: 2    },
  { id: 'I20', text: 'Pozytywna ocena od kolegi. Otrzymaj 50 zł.',                                                 action: 'collect',          amount: 50  },
  { id: 'I21', text: 'Naruszenie etyki zawodowej! Idź do Izolacji.',                                               action: 'go-to-jail'                    },
  { id: 'I22', text: 'Pomyślna interwencja kryzysowa. Otrzymaj 75 zł.',                                            action: 'collect',          amount: 75  },
  { id: 'I23', text: 'Konferencja w Wiedniu. Jedź na Stację Pavlov.',                                              action: 'advance-to',       target: 14  },
  { id: 'I24', text: 'Sprawa sądowa pacjenta. Zapłać 200 zł.',                                                     action: 'pay',              amount: 200 },
  { id: 'I25', text: 'Refundacja za szkolenie. Otrzymaj 100 zł.',                                                  action: 'collect',          amount: 100 },
  { id: 'I26', text: 'Nieudana terapia. Cofnij się o 2 pola.',                                                     action: 'move-back',        steps: 2    },
  { id: 'I27', text: 'Inspekcja placówek terapeutycznych. Zapłać 40 zł za każdy dom, 115 zł za hotel.',             action: 'pay-per-building', perHouse: 40, perHotel: 115 },
  { id: 'I28', text: 'Zorganizuj sympozjum psychologiczne. Otrzymaj 25 zł od każdego gracza.',                      action: 'collect-from-each',amount: 25  },
  { id: 'I29', text: 'Zaproszenie na wykład. Jedź na Stację Adler.',                                               action: 'advance-to',       target: 24  },
  { id: 'I30', text: 'Niespodziewane koszty badań klinicznych. Zapłać 75 zł.',                                     action: 'pay',              amount: 75  },
  { id: 'I31', text: 'Skuteczne zastosowanie CBT. Otrzymaj 125 zł.',                                               action: 'collect',          amount: 125 },
  { id: 'I32', text: 'Energia po udanej sesji grupowej. Przesuń się o 4 pola do przodu.',                           action: 'move-forward',     steps: 4    },
];

// ============================================================
// SESSION CARDS  (Community Chest equivalent – 16 cards)
// ============================================================
const SESSION_CARDS = [
  { id: 'S1',  text: 'Zwrot z ubezpieczenia zdrowotnego. Otrzymaj 200 zł.',                                         action: 'collect',          amount: 200 },
  { id: 'S2',  text: 'Opłata za terapię grupową. Zapłać 50 zł.',                                                   action: 'pay',              amount: 50  },
  { id: 'S3',  text: 'Nagła poprawa stanu zdrowia psychicznego. Otrzymaj 100 zł.',                                  action: 'collect',          amount: 100 },
  { id: 'S4',  text: 'Rachunek za leki. Zapłać 50 zł.',                                                             action: 'pay',              amount: 50  },
  { id: 'S5',  text: 'Wygrałeś grant badawczy. Otrzymaj 100 zł.',                                                   action: 'collect',          amount: 100 },
  { id: 'S6',  text: 'Wakacje regeneracyjne. Idź na START, zbierz 200 zł.',                                         action: 'advance-to-go'                 },
  { id: 'S7',  text: 'Wyjdź z Izolacji za darmo.',                                                                  action: 'get-out-jail',     keep: true  },
  { id: 'S8',  text: 'Diagnoza wymaga dodatkowych badań. Zapłać 100 zł.',                                           action: 'pay',              amount: 100 },
  { id: 'S9',  text: 'Twoje metody terapeutyczne zyskują uznanie. Otrzymaj 50 zł od każdego gracza.',               action: 'collect-from-each',amount: 50  },
  { id: 'S10', text: 'Opłata za superwizję. Zapłać 25 zł za każdy dom, 100 zł za hotel.',                          action: 'pay-per-building', perHouse: 25, perHotel: 100 },
  { id: 'S11', text: 'Przełom w leczeniu. Otrzymaj 50 zł.',                                                         action: 'collect',          amount: 50  },
  { id: 'S12', text: 'Nieprzewidziane wydatki na gabinet. Zapłać 150 zł.',                                          action: 'pay',              amount: 150 },
  { id: 'S13', text: 'Odsetki od depozytów bankowych. Otrzymaj 100 zł.',                                            action: 'collect',          amount: 100 },
  { id: 'S14', text: 'Udane warsztaty psychologiczne. Otrzymaj 150 zł.',                                            action: 'collect',          amount: 150 },
  { id: 'S15', text: 'Spłata kredytu na edukację. Zapłać 100 zł.',                                                  action: 'pay',              amount: 100 },
  { id: 'S16', text: 'Darowizna na cele terapeutyczne. Zapłać 50 zł.',                                              action: 'pay',              amount: 50  },
  { id: 'S17', text: 'Premie za wyniki leczenia. Otrzymaj 75 zł.',                                                 action: 'collect',          amount: 75  },
  { id: 'S18', text: 'Szkolenie z nowych metod diagnozy. Zapłać 75 zł.',                                           action: 'pay',              amount: 75  },
  { id: 'S19', text: 'Motywujesz współpracowników. Otrzymaj 30 zł od każdego gracza.',                              action: 'collect-from-each',amount: 30  },
  { id: 'S20', text: 'Praktyka kliniczna. Idź do Centrum Terapii.',                                                action: 'advance-to',       target: 18  },
  { id: 'S21', text: 'Odszkodowanie za błąd lekarski. Zapłać 200 zł.',                                             action: 'pay',              amount: 200 },
  { id: 'S22', text: 'Udana terapia poznawcza. Otrzymaj 50 zł.',                                                   action: 'collect',          amount: 50  },
  { id: 'S23', text: 'Wypalenie emocjonalne! Idź do Izolacji.',                                                    action: 'go-to-jail'                    },
  { id: 'S24', text: 'Nowa metoda relaksacyjna. Przesuń się o 3 pola do przodu.',                                  action: 'move-forward',     steps: 3    },
  { id: 'S25', text: 'Renowacja gabinetu. Zapłać 40 zł za każdy dom, 115 zł za hotel.',                            action: 'pay-per-building', perHouse: 40, perHotel: 115 },
  { id: 'S26', text: 'Dotacja na badania kliniczne. Otrzymaj 100 zł.',                                             action: 'collect',          amount: 100 },
  { id: 'S27', text: 'Wizyta na konferencji. Jedź na Stację Rogers.',                                              action: 'advance-to',       target: 35  },
  { id: 'S28', text: 'Opłata za certyfikację. Zapłać 100 zł.',                                                     action: 'pay',              amount: 100 },
  { id: 'S29', text: 'Nieudana interwencja. Cofnij się o 2 pola.',                                                 action: 'move-back',        steps: 2    },
  { id: 'S30', text: 'Premie roczne za osiągnięcia. Otrzymaj 150 zł.',                                             action: 'collect',          amount: 150 },
  { id: 'S31', text: 'Wkład na fundusz wsparcia. Zapłać 50 zł.',                                                   action: 'pay',              amount: 50  },
  { id: 'S32', text: 'Stypendium badawcze. Otrzymaj 200 zł.',                                                      action: 'collect',          amount: 200 },
];
