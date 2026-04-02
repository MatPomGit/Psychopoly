# TODO — Psychopolonia

## Priorytet: mechanika i balans
- [ ] Dodać formalny model balansu (np. wariant Markowa dla stanu wypalenia i energii).
- [ ] Przeprowadzić symulacje AI-vs-AI dla 1000+ partii i stroić współczynniki punktacji końcowej.
- [ ] Zbalansować tempo utraty energii względem dochodu dla strategii „agresywnej” i „stabilnej”.
- [ ] Wprowadzić miękki limit nadmiernego wzrostu (np. koszt operacyjny skaluje się z liczbą aktywów).

## Rozszerzenia zasad
- [ ] Dodać tryb „hard realism” zgodny z opisem satyrycznym (wyższe koszty kursów, niższy ROI marketingu).
- [ ] Wprowadzić tryb „rekonwalescencja” zamiast pełnej eliminacji (pomijanie tur + koszty powrotu).
- [ ] Rozbudować negocjacje między graczami o kontrakty współpracy i wymianę usług.
- [ ] Dodać wariant długości gry: 12 / 16 / 20 rund.

## UX / interfejs
- [ ] Dodać panel „wyjaśnij decyzję” pokazujący skąd wynikają zmiany: energia/etyka/wypalenie.
- [ ] Dodać podgląd trendu zasobów gracza (mini wykresy na osi tur).
- [ ] Ujednolicić nazewnictwo UI (tam gdzie jeszcze pojawiają się klasyczne terminy Monopoly).
- [ ] Dodać onboarding: skrócona instrukcja „jak wygrać bez wypalenia”.

## Karty i content
- [ ] Rozszerzyć talię Szansy do 50+ kart z wariantami wyboru (trade-off teraz vs później).
- [ ] Rozszerzyć talię Społeczności o karty kontekstowe zależne od etyki i prestiżu.
- [ ] Dodać system tagów kart (rynek, etyka, media, administracja, kryzys).

## Techniczne
- [ ] Dodać testy jednostkowe dla: punktacji końcowej, eliminacji, efektów kart i przejścia przez START.
- [ ] Dodać testy integracyjne tur (rzut -> ruch -> efekt pola -> koniec tury).
- [ ] Dodać walidację danych planszy i kart (schemat JSON + sprawdzanie przy starcie).
- [ ] Przygotować eksport/import stanu gry (JSON) dla testów i debugowania.

## Multiplayer / backend
- [ ] Wyrównać logikę local i online przez wspólną warstwę „rules engine”.
- [ ] Dodać reconnect i odzyskiwanie stanu pokoju po utracie połączenia.
- [ ] Dodać tryb obserwatora oraz replay zakończonych partii.

## Produkt
- [ ] Przygotować „instrukcję pudełkową” PDF z ikonografią zasobów.
- [ ] Dodać przykładowe scenariusze rozgrywki (2, 4 i 6 graczy).
- [ ] Opracować balans pod warsztaty/edukację (krótsza sesja 45–60 min).
