# Psychopolonia

Przeglądarkowa gra planszowa inspirowana Monopoly, osadzona w realiach rynku psychologicznego w Polsce.

## Kluczowe założenie
W tej wersji nie wygrywa gracz z największą gotówką, tylko ten, kto utrzyma równowagę między:
- przychodem,
- prestiżem,
- energią,
- etyką,
- ryzykiem wypalenia.

## Dokumentacja zasad
Pełny opis logiki i zasad gry znajduje się tutaj:

- [`docs/ZASADY_GRY_PSYCHOPOLONIA.md`](docs/ZASADY_GRY_PSYCHOPOLONIA.md)

W tym również:
- karty wyboru (decyzje gracza z kompromisem między zasobami),
- rozszerzone opisy ścieżek rozwoju i ryzyk zawodowych.

## Dostępność (A11y) — QA

Bazowa lista kontrolna dostępności interfejsu znajduje się tutaj:

- [`docs/A11Y_QA_CHECKLIST.md`](docs/A11Y_QA_CHECKLIST.md)

## Uruchomienie lokalne
```bash
npm install
npm run start
```

Aplikacja uruchomi się pod adresem: `http://localhost:3000`.

> **Ważne:** tryb online wymaga uruchomionego serwera Node.js (`npm start`).
> Nie otwieraj `index.html` bezpośrednio z dysku — socket.io nie będzie dostępne.

## Wdrożenie online (gra multiplayer przez internet)

Aby grać online z innymi graczami przez internet, aplikacja musi być uruchomiona
na serwerze z Node.js. Poniżej przykłady darmowych platform.

### Railway

1. Załóż konto na [railway.app](https://railway.app)
2. Kliknij **New Project → Deploy from GitHub repo**
3. Wybierz to repozytorium
4. Railway automatycznie wykryje Node.js i uruchomi `npm start`
5. Udostępnij wygenerowany adres URL innym graczom

> **Opcjonalnie:** ustaw zmienną środowiskową `CORS_ORIGIN=https://twojadomena.railway.app`
> aby ograniczyć połączenia WebSocket tylko do Twojej domeny.

### Render

1. Załóż konto na [render.com](https://render.com)
2. Kliknij **New → Web Service** i połącz z GitHub
3. Ustaw:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Kliknij **Deploy**

### Heroku

```bash
heroku create
git push heroku main
heroku open
```

### Samodzielny serwer (VPS / Linux)

```bash
git clone <repo-url>
cd Psychopoly
npm install
npm start          # serwer działa na porcie 3000
```

Pamiętaj, by otworzyć port 3000 w zaporze (`ufw allow 3000`) lub użyć
reverse proxy (nginx) na porcie 80/443.
