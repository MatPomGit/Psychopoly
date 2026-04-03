# QA A11y — lista kontrolna (bazowy standard)

## 1) Klawiatura
- [ ] Wszystkie interaktywne elementy (przyciski, pola, zakładki, kontrolki czatu) są osiągalne z klawiatury (`Tab` / `Shift+Tab`).
- [ ] Widoczny `:focus-visible` pojawia się konsekwentnie i ma wystarczający kontrast względem tła.
- [ ] Kolejność focusu jest logiczna: menu → setup → plansza → panel boczny → modale.
- [ ] W modalach focus pozostaje w kontekście modala do momentu zamknięcia (manualny test użytkownika).

## 2) Kontrast i percepcja
- [ ] Teksty główne i pomocnicze są czytelne na tle (w tym tryb ciemny paneli i toasty).
- [ ] Stany aktywne/nieaktywne nie polegają wyłącznie na kolorze (wspierane etykietą, ikoną lub stylem).
- [ ] Komunikaty błędów (`role="alert"`) są zauważalne i nie znikają natychmiast.

## 3) Focus flow + ARIA
- [ ] Zakładki mają poprawne role/atrybuty: `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`.
- [ ] Modale mają `role="dialog"`, `aria-modal="true"`, powiązany tytuł i opis (`aria-labelledby`/`aria-describedby`).
- [ ] Toast/status ma `aria-live` (`polite`) i jest odczytywany przez czytniki.
- [ ] Przycisk ikonowy ma `aria-label` i sensowny `title`.

## 4) Mobilna czytelność i dotyk
- [ ] Minimalny rozmiar docelowy elementów dotykowych wynosi ~44×44 px.
- [ ] Na breakpointach mobilnych minimalny rozmiar tekstu nie schodzi poniżej 16 px dla kluczowych obszarów UI.
- [ ] Krytyczne informacje (np. podgląd pola) są kompresowane zamiast ukrywane.

## 5) Tryb online / lokalny
- [ ] Wszystkie krytyczne akcje są dostępne i czytelne w trybie lokalnym.
- [ ] W trybie online status lobby, czat i powiadomienia są aktualizowane i odczytywalne.
- [ ] Notyfikacje (toast/status/błędy) działają i w trybie lokalnym, i online.

## Szybki scenariusz regresji (5 minut)
1. Wejdź do menu i przejdź cały flow klawiaturą aż do ekranu gry.
2. Przełącz każdą zakładkę panelu i sprawdź focus + `aria-selected`.
3. Otwórz każdy modal i sprawdź tytuł, opis, zamknięcie i powrót do pracy.
4. Zweryfikuj czytelność na szerokości ~340 px i ~420 px.
5. Powtórz test raz dla trybu lokalnego i raz dla online (jeśli serwer jest dostępny).
