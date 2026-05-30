# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Progetto

Sito web statico per il matrimonio di Elena e Claudio (11 ottobre 2026), pubblicato tramite GitHub Pages sul dominio `ilmatrimoniodielenaeclaudio.it` (vedi `CNAME`). Tutto in italiano, con estetica pixel-art / 8-bit basata sul font "Press Start 2P".

**Non c'è alcun build system, package manager, né suite di test** — i file vengono serviti così come sono. Per lo sviluppo, apri `index.html` nel browser, oppure servi la cartella con un qualsiasi server statico (es. `python -m http.server`). Dopo le modifiche, basta committare e fare push su `main`; il deploy lo gestisce GitHub Pages.

## Architettura

Tre pagine top-level, tutte condividono `style.css`:

- `index.html` — pagina principale. App Vue 3 montata su `#app`, con il minigioco di matrimonio incorporato come componente `<minigame>` nell'header.
- `parcheggi.html` — pagina statica con info sui parcheggi (no Vue), linkata dall'index.
- Nessuna `404.html` al momento; GitHub Pages userà quella di default.

### App Vue (`app.js`)

Vue 3 è caricato **localmente** da `vendor/vue.global.prod.js` (non da CDN), così il sito funziona quasi offline e sopravvive ai disservizi delle CDN. L'app è una singola chiamata inline `createApp({...})` che:

- Tiene i dati del matrimonio (date, location, IBAN, codice lista nozze) in `data()` — modifica i valori qui, non nell'HTML.
- Gestisce il countdown verso `new Date(2026, 9, 11, 11, 30)` (il mese è 0-based → ottobre).
- Registra il componente `Minigame`, che è solo un wrapper `<canvas>` che chiama la funzione globale `initGame(canvas)` da `minigame.js` al mount.
- Definisce gli handler di copia negli appunti per IBAN / codice lista / password, con una spunta transitoria "copiato".

Due IIFE fuori dall'app Vue gestiscono aspetti trasversali:

- **Viewport guard** — riapplica il meta `width=device-width, initial-scale=1, maximum-scale=1` su orientationchange e su resize significativi, per contrastare i browser mobile che resettano lo zoom.
- **Reveal on scroll** — `IntersectionObserver` aggiunge `.is-visible` alle sezioni `.reveal`.
- **Ciclo di camminata nel footer** — anima gli sprite di sposo/sposa nel footer per 5 secondi quando entra in viewport.

### Minigame (`minigame.js`)

Un runner stile dinosauro di Chrome (~1000 righe, unico entry point `initGame(canvas)`). Tutto lo stato è locale alla closure — niente module exports, niente dipendenze esterne. Cose importanti da sapere prima di modificarlo:

- **Gate di orientamento mobile.** Sui dispositivi mobile (UA sniff in `isMobileDevice`), il gioco rifiuta di girare in portrait e mostra una GIF "ruota il telefono" (`img/rotate2.gif`) iniettata come elementi DOM sopra al canvas. Quando l'utente ruota in landscape, il body riceve `class="game-fullscreen"` (vedi `style.css` ~riga 211) che nasconde tutte le altre sezioni e fa riempire il viewport al canvas. `preventAutoResume` blocca il riavvio automatico dell'update loop dopo la rotazione — l'utente deve toccare per partire.
- **L'altezza del terreno è responsiva.** `updateGroundHeight()` sceglie una percentuale dell'altezza del canvas (più alta su mobile landscape, più bassa su portrait/desktop) e tutte le posizioni Y degli sprite si derivano da `height - groundHeight`. Se riposizioni gli sprite, fallo relativamente a questo.
- **Due loop di update/render.** `startLoop()` gira la schermata iniziale/idle; `startUpdate()` gira il gioco attivo (via `requestAnimationFrame` su `update()`). `pauseGame()` / `resumeGame()` / handler di scroll sospendono il loop attivo quando il canvas esce dal viewport.
- **Costanti di tuning delle hitbox** in cima al file (`OBSTACLE_HITBOX_SCALE`, `OBSTACLE_HITBOX_Y_OFFSET_SCALE`, `COLLISION_GRACE_PX`) — sistema queste, non i numeri per singolo sprite, quando le collisioni sembrano scorrette.
- **L'input è unificato** tra tastiera (Space / ArrowUp / Enter), mouse e touch. L'handler touch tratta come salto solo i tap **sopra** il terreno, così l'utente può ancora scrollare la pagina trascinando sulla zona del terreno.
- **Salto ad altezza variabile**: tenendo premuto continua ad accumularsi `vy`; al rilascio `vy` viene clampato così un tap breve = saltino corto. Vedi `startJump()` / `endJump()`.

I commit recenti mostrano che questo file viene iterato spesso per fix specifici Android (velocità, rendering del terreno, dimensione scritte) — quando cambi fisica o layout, testa sia in desktop landscape sia in mobile emulato portrait+landscape.

### Asset

Tutti gli sprite stanno in `img/`. Esistono diverse varianti numerate sia per i frame di animazione (`sposo-1/2/3.png`, `sposa-1/2.png`) sia per iterazioni di design (`background1.png` … `background5.png`, `chiesa.png` / `chiesa1.png` / `chiesa2.png`). I filename effettivamente usati sono referenziati in `minigame.js` (`imgBackground.src = "img/background5.png"`, ecc.) e in `index.html` — fai un grep prima di assumere che un file sia inutilizzato.
