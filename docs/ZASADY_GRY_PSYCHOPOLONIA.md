# Psychopolonia: rynek usług, superwizja i wypalenie

## 1. Tytuł i koncepcja
**Psychopolonia** to satyryczna wariacja na temat Monopoly, osadzona w realiach rynku psychologicznego w Polsce.

Hasło przewodnie: **„Buduj praktykę, lecz nie trać siebie.”**

W tej wersji wygrywa nie ten, kto ma najwięcej gotówki, ale ten, kto najlepiej utrzymuje równowagę między:
- przychodem,
- prestiżem,
- energią,
- etyką,
- ryzykiem wypalenia.

---

## 2. Cel gry
Celem gracza jest zbudowanie stabilnej praktyki zawodowej bez wpadnięcia w kryzys.

Gra kończy się na dwa sposoby:
1. **Tryb eliminacji** – zostaje jeden aktywny gracz.
2. **Tryb rundowy** – po **12 rundach** wygrywa gracz z najwyższym bilansem zawodowym.

Bilans końcowy (używany przez implementację):

`wynik = pieniądze + 12×prestiż + 8×energia + 8×etyka − 10×wypalenie`

---

## 3. Zasoby gracza
Każdy gracz ma następujące wskaźniki:

- **Pieniądze** – płynność finansowa.
- **Prestiż** – reputacja i widoczność zawodowa.
- **Energia** – zdolność do dalszej pracy.
- **Etyka** – bufor przed kryzysem środowiskowym.
- **Wypalenie** – koszt przeciążenia.
- **Tarcza superwizji** – czasowa ochrona przed częścią negatywnych efektów.

### Startowe wartości
- 1500 zł,
- 10 prestiżu,
- 50 energii,
- 50 etyki,
- 0 wypalenia,
- 0 tarczy superwizji.

---

## 4. Przebieg tury
W turze gracz:
1. rzuca 2 kostkami,
2. przesuwa pionek,
3. rozpatruje efekt pola,
4. kończy turę (lub rzuca ponownie przy dublecie, o ile nie jest w stanie kryzysu).

### Premia za START
Przy przejściu przez START gracz dostaje:
- +200 zł,
- +2 prestiżu,
- +1 energii.

---

## 5. Pola planszy (40 pól)
Plansza zachowuje liczbę pól i ekonomię bazową z Monopoly, ale treści zostały przepisane na realia rynku usług psychologicznych.

### Kategorie pól
- **Aktywa (dawne „nieruchomości”)** – specjalizacje, usługi, kanały pozyskiwania klientów, marka.
- **Transport** – kanały dystrybucji i widoczności (np. SEO, B2B).
- **Utility** – narzędzia pracy (testy, oprogramowanie).
- **Szansa** – karty rynkowe i losowe.
- **Społeczność** – karty środowiskowe, relacyjne i absurd codzienności.
- **Podatki / koszty systemowe** – stałe obciążenia.
- **Wypalenie zawodowe / odwiedziny przemęczenia** – pola kryzysowe.

### Konwencja opłat
- ceny i czynsze w zł,
- rozbudowa aktywów to „certyfikaty / specjalizacje / pełna specjalizacja”.

---

## 6. Zakup, czynsz i rozbudowa
### Zakup
Jeżeli pole nie ma właściciela, gracz może je kupić.
Zakup zwiększa potencjał dochodu, ale kosztuje też zasoby psychiczne.

### Czynsz
Gdy gracz staje na cudzym aktywie, płaci czynsz właścicielowi.
W tej wersji płatność ma dodatkowy koszt psychologiczny:
- spadek energii,
- wzrost wypalenia.

Właściciel poza pieniędzmi może zyskać także minimalny prestiż kosztem energii.

### Rozbudowa
Rozbudowa działa jak domy/hotele w Monopoly:
- kolejne poziomy zwiększają czynsz,
- wymagane jest posiadanie pełnego zestawu kolorystycznego.

W warstwie narracyjnej odpowiada to:
- certyfikatom,
- specjalizacji,
- pełnej monetyzacji usługi.

---

## 7. Karty: Szansa i Społeczność
### Szansa
Karty o większej zmienności:
- nagłe polecenia,
- no-show,
- kryzysy formalne,
- ekspozycja medialna,
- zmiany regulacyjne,
- granty i konferencje.

### Społeczność
Karty środowiskowe i relacyjne:
- sytuacje graniczne z pacjentami,
- interakcje z innymi specjalistami,
- presja cenowa,
- konflikty zespołowe,
- wsparcie branżowe.

Efekty kart wpływają na:
- pieniądze,
- prestiż,
- energię,
- etykę,
- wypalenie,
- czasem na tarczę superwizji.

---

## 8. Wypalenie, etyka i energia (warunki odpadnięcia)
Gracz odpada z gry, gdy wystąpi jedno z poniższych:
- **energia ≤ 0**,
- **etyka ≤ 0**,
- **wypalenie ≥ 100**,
- klasyczne bankructwo (brak środków po likwidacji aktywów).

To kluczowe odwrócenie klasycznego Monopoly:
**nadmierna ekspansja bez dbania o zasoby osobiste może zakończyć grę szybciej niż brak gotówki.**

---

## 9. Mechanika kryzysu i superwizji
- Pole „Wypalenie zawodowe” wysyła gracza do stanu kryzysu.
- Część kart i zdarzeń zwiększa wypalenie oraz obniża energię.
- Karty superwizyjne i niektóre wydarzenia mogą:
  - obniżać wypalenie,
  - podnosić etykę,
  - dodawać tarczę superwizji.

---

## 10. Warianty zakończenia
Rekomendowany wariant projektowy:
- **12 pełnych rund** i porównanie wyniku końcowego.

Wariant alternatywny:
- gra do jednego aktywnego gracza (eliminacje).

---

## 11. Styl i ton projektu
Gra ma charakter **komedii systemowej**:
- humor wynika z codziennych realiów zawodu,
- sukces jest możliwy, ale obciążony kosztami ukrytymi,
- nie ma strategii „bez kosztu psychicznego”.

Typowe źródła satyry:
- chaos grafiku,
- no-show,
- drogie szkolenia,
- presja marketingu,
- biurokracja,
- przeciążenie i wypalenie.

---

## 12. Notatka implementacyjna (stan repo)
W kodzie gry zaimplementowano już kluczowe elementy modelu:
- nowe wskaźniki gracza,
- nowe talie kart i opisy pól,
- punktację końcową po 12 rundach,
- warunki odpadnięcia zależne od dobrostanu zawodowego.

Dokument opisuje docelowy design i aktualny kierunek rozwoju.

---

## 13. Rozszerzone opisy decyzji (karty wyboru)
W tej wersji część kart nie ma jednego, stałego efektu — gracz podejmuje decyzję:

1. **Kurs specjalistyczny**  
   - inwestujesz teraz (koszt finansowy, zysk prestiżu),  
   - albo odpuszczasz (mniejszy koszt, ale utrata momentum).

2. **Trend terapeutyczny**  
   - podążasz za modą (zysk prestiżu, koszt etyczny),  
   - albo utrzymujesz standard i nie zyskujesz natychmiastowego hype’u.

3. **Długi weekend bez pacjentów**  
   - regeneracja (zysk energii, spadek przychodu),  
   - albo „nadrabianie” (doraźny zysk finansowy, wzrost wypalenia).

4. **Sytuacje graniczne w relacjach zawodowych**  
   - bronisz granic (koszt energii, ochrona etyki),  
   - albo odpuszczasz granice (oszczędzasz energię krótkoterminowo, koszt etyczny).

Ten moduł ma podkreślać centralny motyw gry: **każda decyzja ma koszt ukryty**.

---

## 14. Zakładany charakter rozgrywki
Psychopolonia nie premiuje jednowymiarowej strategii „maksymalizuj przychód”.
Najlepiej działają strategie mieszane:
- umiarkowany rozwój aktywów,
- regularna regeneracja energii,
- inwestowanie w etykę i superwizję,
- kontrolowanie ryzyka wypalenia poniżej strefy krytycznej.

W praktyce oznacza to, że gracz może:
- prowadzić bardziej dochodową ścieżkę prywatną (wyższe ryzyko przeciążenia),
- albo bardziej stabilną ścieżkę instytucjonalną (niższy potencjał przychodu, lepsza przewidywalność).

Docelowo gra ma generować „zabawne, ale znajome” dylematy zawodowe zamiast czystej optymalizacji pieniądza.
