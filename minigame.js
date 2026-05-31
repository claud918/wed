function initGame(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Ensure canvas layout doesn't leave hairline gaps on mobile (remove default margins,
  // make canvas a block element and match page background to the ground color).
  try {
    document.documentElement.style.margin = "0";
    document.body.style.margin = "0";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // set body background to the same color as the ground to avoid thin white gaps
    document.body.style.backgroundColor = "#3ea043";
  } catch (e) {}

  let width = canvas.width;
  let height = canvas.height;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let groundHeight = 50; // altezza terreno iniziale (sarà aggiornata da updateGroundHeight)

  // Carica immagini
  const imgSposo1 = new Image();
  imgSposo1.src = "img/sposo-1.png";

  const imgSposo2 = new Image();
  imgSposo2.src = "img/sposo-2.png";

  const imgSposo3 = new Image();
  imgSposo3.src = "img/sposo-3.png";

  const imgSposa1 = new Image();
  imgSposa1.src = "img/sposa-1.png";

  const imgSposa2 = new Image();
  imgSposa2.src = "img/sposa-2.png";

  const imgOstacolo = new Image();
  imgOstacolo.src = "img/ostacolo.png";

  const imgChiesa = new Image();
  imgChiesa.src = "img/chiesa1.png";

  const imgNuvola = new Image();
  imgNuvola.src = "img/nuvola.png";

  const imgBackground = new Image();
  imgBackground.src = "img/background5.png";

  // Pulsante play (due frame alternati per effetto "premuto")
  const imgPlay1 = new Image();
  imgPlay1.src = "img/play.png";

  const imgPlay2 = new Image();
  imgPlay2.src = "img/play2.png";

  // Bounding box dei pixel opachi del frame "rilasciato" del pulsante play,
  // espresso come rapporti [0..1] rispetto alla dimensione naturale.
  // Serve a stringere la hitbox così che cliccare sulla cornice trasparente
  // non venga interpretato come click sul pulsante.
  let playOpaqueBBoxRatios = null;
  function computePlayOpaqueBBox() {
    if (!imgPlay1.naturalWidth || !imgPlay1.naturalHeight) return;
    try {
      const w = imgPlay1.naturalWidth;
      const h = imgPlay1.naturalHeight;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const cctx = c.getContext("2d");
      cctx.drawImage(imgPlay1, 0, 0);
      const data = cctx.getImageData(0, 0, w, h).data;
      let xMin = w;
      let yMin = h;
      let xMax = -1;
      let yMax = -1;
      const threshold = 20;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = data[(y * w + x) * 4 + 3];
          if (a > threshold) {
            if (x < xMin) xMin = x;
            if (x > xMax) xMax = x;
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
          }
        }
      }
      if (xMax < 0) return;
      playOpaqueBBoxRatios = {
        xMinR: xMin / w,
        yMinR: yMin / h,
        xMaxR: (xMax + 1) / w,
        yMaxR: (yMax + 1) / h,
      };
    } catch (e) {
      playOpaqueBBoxRatios = null;
    }
  }
  if (imgPlay1.complete) computePlayOpaqueBBox();
  imgPlay1.addEventListener("load", computePlayOpaqueBBox);

  // optional rotate GIF (user-provided)
  const imgRotate = new Image();
  imgRotate.src = "img/rotate2.gif";
  let rotateReady = false;
  imgRotate.onload = () => {
    rotateReady = !!(imgRotate.naturalWidth && imgRotate.naturalHeight);
  };
  imgRotate.onerror = () => {
    rotateReady = false;
  };

  // DOM overlay for rotate GIF (so the GIF animates — canvas drawImage may show only one frame)
  const overlayImg = document.createElement("img");
  overlayImg.src = "img/rotate2.gif";
  overlayImg.style.position = "absolute";
  overlayImg.style.zIndex = 9999;
  overlayImg.style.pointerEvents = "none";
  // Manteniamo sempre `display: block`: nascondiamo solo via opacity, così la GIF
  // continua ad animarsi e su Safari iOS non resta congelata sul primo frame.
  overlayImg.style.display = "block";
  overlayImg.style.opacity = "0";
  // ensure parent can position absolute children
  const parent = canvas.parentElement || document.body;
  if (getComputedStyle(parent).position === "static")
    parent.style.position = "relative";
  parent.appendChild(overlayImg);

  // small caption under the GIF
  const overlayCaption = document.createElement("div");
  overlayCaption.style.position = "absolute";
  overlayCaption.style.zIndex = 10000;
  overlayCaption.style.pointerEvents = "none";
  overlayCaption.style.display = "block";
  overlayCaption.style.opacity = "0";
  overlayCaption.style.color = "white";
  overlayCaption.style.fontFamily = "'Press Start 2P', Arial, sans-serif";
  overlayCaption.style.fontSize = "12px";
  overlayCaption.style.textAlign = "center";
  overlayCaption.style.whiteSpace = "nowrap"; // keep on a single line
  overlayCaption.style.wordBreak = "normal";
  overlayCaption.style.boxSizing = "border-box";
  overlayCaption.style.overflow = "visible";
  overlayCaption.style.padding = "4px 6px";
  overlayCaption.style.maxWidth = "90%";
  parent.appendChild(overlayCaption);

  function updateOverlayPosition() {
    if (!overlayImg || overlayImg.style.opacity === "0") return;
    const rect = canvas.getBoundingClientRect();
    const maxW = Math.round(rect.width * 0.42);
    const maxH = Math.round(rect.height * 0.35);
    const r =
      (overlayImg.naturalWidth || imgRotate.naturalWidth) /
      (overlayImg.naturalHeight || imgRotate.naturalHeight || 1);
    let drawW = maxW;
    let drawH = Math.round(drawW / r);
    if (drawH > maxH) {
      drawH = maxH;
      drawW = Math.round(drawH * r);
    }
    overlayImg.style.width = drawW + "px";
    overlayImg.style.height = drawH + "px";
    // small extra offset to compensate for transparent padding in the GIF
    const leftPos = Math.round(rect.left + (rect.width - drawW) / 2);
    // Slightly raise the overlay so it doesn't sit too low on tall portrait screens
    const verticalOffset = Math.round(rect.height * 0.2);
    const topPos = Math.round(
      rect.top + (rect.height - drawH) / 2 - verticalOffset,
    );
    overlayImg.style.left = leftPos + "px";
    overlayImg.style.top = topPos + "px";
    // position caption centered below the gif
    overlayCaption.style.display = overlayImg.style.display;
    overlayCaption.style.left = leftPos + drawW / 2 + "px";
    overlayCaption.style.transform = "translateX(-50%)";
    overlayCaption.style.textAlign = "center";
    overlayCaption.style.top =
      topPos + drawH + Math.round(Math.max(6, drawH * 0.06)) + "px";
    overlayCaption.style.lineHeight = "1.1";
    // responsive caption font-size based on gif width
    const captionFont = Math.max(10, Math.round(drawW * 0.06));
    overlayCaption.style.fontSize = captionFont + "px";
  }

  // Stato del gioco
  let sposo = {
    x: 350,
    y: Math.max(30, height - 60), // posiziona sopra il terreno, almeno 30px dal top
    vy: 0,
    width: 50,
    height: 50,
    frame: 0,
    frameCount: 4,
    hitbox: {
      xOffset: 10,
      yOffset: 5,
      width: 30,
      height: 40,
    },
    frameTimer: 0,
    currentFrame: 0, // 0 = imgSposo1, 1 = imgSposo2, 2 = imgSposo3, 3 = imgSposo2
  };

  let sposa = {
    x: sposo.x - 80,
    y: Math.max(30, height - 60), // stessa altezza dello sposo, sempre visibile
    vy: 0,
    width: 50,
    height: 50,
    frame: 0,
    frameCount: 4,
    offset: -80, // distanza orizzontale dallo sposo
    hitbox: {
      xOffset: 12,
      yOffset: 6,
      width: 26,
      height: 38,
    },
    frameTimer: 0,
    currentFrame: 0, // 0 = imgSposa1, 1 = imgSposa2, 2 = imgSposa1, 3 = imgSposa2
  };

  let ostacoli = [];
  let gravity = 0.7;
  let jumpPower = -14;
  let gameOver = false;
  let score = 0;
  let difficulty = 1; // aumenta con il punteggio
  let baseSpeed = 5; // velocità base degli ostacoli
  let baseSpawnRate = 0.02; // tasso base di spawn
  let jumpPressed = false; // per salto variabile
  let gameStarted = false; // il gioco parte solo dopo click
  // track if the last touch was handled by the game (prevents preventing default when user touched the ground area)
  let lastTouchHandled = false;

  let nuvole = [];
  // Posizione orizzontale della chiesa (scorre con il mondo)
  let chiesaX = 50;
  let chiesaSpeed = 3;
  // Bounding box del pulsante play, aggiornata a ogni draw quando visibile.
  // Usata per restringere il click di avvio/restart al solo pulsante.
  let playButtonBBox = null;
  // Collision tuning: keep gameplay fair vs visible sprite.
  const OBSTACLE_HITBOX_SCALE = 0.46;
  const OBSTACLE_HITBOX_Y_OFFSET_SCALE = 0.38;
  const COLLISION_GRACE_PX = 4;
  // valori per regolare la posizione verticale se le immagini hanno padding
  const CHIESA_NUDGE_FACTOR = 0.215; // sposta la chiesa verso il basso di questa frazione dell'altezza finale
  const BG_NUDGE_FACTOR = 0.36; // sposta il background verso il basso di questa frazione
  // Orientamento / device
  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent,
  );
  const isAndroid = /Android/i.test(navigator.userAgent);
  let orientationOk = true; // true se il dispositivo è in landscape o non mobile
  let lastOrientationOk = true;

  // evita che la logica di update riparta automaticamente dopo la rotazione
  let preventAutoResume = false;
  let startLoopActive = false; // (se non presente già)
  let gameOverLoopActive = false;
  let updateLoopActive = false;
  let rafId = null;
  let lastUpdateTime = performance.now();
  let pausedByScroll = false;

  // CLASSIFICA ------------------------------------------------
  // URL della Web App Google Apps Script (vedi leaderboard.gs).
  // Lascia vuoto per usare solo localStorage (classifica per singolo browser).
  const LEADERBOARD_URL =
    "https://script.google.com/macros/s/AKfycby_HvpULGQYLIXJCjyOJ89Lx3KIjRTIXFtloZE1CZXkx8Zl9KWaUs3q-it4B_lyv-sf/exec";

  const LEADERBOARD_KEY = "minigame_leaderboard_v1";
  const MAX_LEADERBOARD_ENTRIES = 10;
  const NAME_LENGTH = 3;
  const NAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function sanitizeBoard(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (e) =>
          e &&
          typeof e.name === "string" &&
          typeof e.score === "number" &&
          isFinite(e.score),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  }

  function loadLocalLeaderboard() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      if (!raw) return [];
      return sanitizeBoard(JSON.parse(raw));
    } catch (e) {
      return [];
    }
  }

  function saveLocalLeaderboard(board) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    } catch (e) {}
  }

  // Cache in memoria: fonte di verità per qualifiesForLeaderboard/getHighScore.
  // Inizializzata dal localStorage (immediato), poi sovrascritta dal server.
  let leaderboardCache = loadLocalLeaderboard();
  let highScore =
    leaderboardCache.length > 0 ? leaderboardCache[0].score : 0;

  function getHighScore() {
    return leaderboardCache.length > 0 ? leaderboardCache[0].score : 0;
  }

  function qualifiesForLeaderboard(s) {
    if (s <= 0) return false;
    if (leaderboardCache.length < MAX_LEADERBOARD_ENTRIES) return true;
    return s > leaderboardCache[leaderboardCache.length - 1].score;
  }

  function applyBoardUpdate(board) {
    leaderboardCache = sanitizeBoard(board);
    saveLocalLeaderboard(leaderboardCache);
    highScore = getHighScore();
  }

  function fetchLeaderboard() {
    if (!LEADERBOARD_URL) return Promise.resolve(leaderboardCache);
    return fetch(LEADERBOARD_URL, { method: "GET" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) applyBoardUpdate(data);
        return leaderboardCache;
      })
      .catch(() => leaderboardCache);
  }

  function submitScoreRemote(name, s) {
    // Aggiorna subito la cache locale per UX immediata; il server poi
    // ritorna la classifica autorevole e la sovrascrive.
    const merged = leaderboardCache.slice();
    merged.push({ name, score: s });
    applyBoardUpdate(merged);

    if (!LEADERBOARD_URL) return Promise.resolve(leaderboardCache);
    return fetch(LEADERBOARD_URL, {
      method: "POST",
      // text/plain evita il CORS preflight di Apps Script.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ name, score: s }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) applyBoardUpdate(data);
        return leaderboardCache;
      })
      .catch(() => leaderboardCache);
  }

  // INSERIMENTO NOME (3 lettere maiuscole) ---------------------
  let nameEntryActive = false;
  let nameLetters = ["A", "A", "A"];
  let nameIndex = 0;
  let nameEntryHit = null; // bounding box dei comandi, aggiornata ad ogni draw

  function cycleLetter(delta) {
    const idx = NAME_ALPHABET.indexOf(nameLetters[nameIndex]);
    const next =
      (idx + delta + NAME_ALPHABET.length) % NAME_ALPHABET.length;
    nameLetters[nameIndex] = NAME_ALPHABET[next];
  }

  function submitName() {
    if (!nameEntryActive) return;
    submitScoreRemote(nameLetters.join(""), score);
    nameEntryActive = false;
  }

  function skipNameEntry() {
    nameEntryActive = false;
  }

  function pointInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function handleNameEntryClick(cx, cy) {
    if (!nameEntryHit) return;
    const h = nameEntryHit;
    if (pointInRect(cx, cy, h.ok)) {
      submitName();
      return;
    }
    if (pointInRect(cx, cy, h.skip)) {
      skipNameEntry();
      return;
    }
    for (const slot of h.slots) {
      if (pointInRect(cx, cy, slot.up)) {
        nameIndex = slot.index;
        cycleLetter(1);
        return;
      }
      if (pointInRect(cx, cy, slot.down)) {
        nameIndex = slot.index;
        cycleLetter(-1);
        return;
      }
      if (pointInRect(cx, cy, slot.letter)) {
        nameIndex = slot.index;
        return;
      }
    }
  }

  // VISTA CLASSIFICA (top 10) ----------------------------------
  let leaderboardViewActive = false;
  let leaderboardBtnHit = null; // hitbox del pulsante "CLASSIFICA"
  let leaderboardCloseHit = null; // hitbox del pulsante "CHIUDI"

  function openLeaderboardView() {
    leaderboardViewActive = true;
    fetchLeaderboard(); // refresh in background
  }

  function closeLeaderboardView() {
    leaderboardViewActive = false;
  }

  // Il pulsante e la vista sono interattivi solo quando il gioco non è in
  // corso (start screen / game over) e non siamo in inserimento nome.
  function isLeaderboardBtnVisible() {
    return !nameEntryActive && (!gameStarted || gameOver);
  }

  function checkOrientation() {
    if (!isMobileDevice) {
      lastOrientationOk = orientationOk = true;
      return;
    }

    const prev = orientationOk;
    orientationOk = window.innerWidth > window.innerHeight;

    // If orientation changed, reset scroll position so canvas sizing behaves predictably
    if (prev !== orientationOk) {
      try {
        // ensure viewport near top so canvas sizing behaves predictably
        window.scrollTo(0, 0);
      } catch (e) {}
    }

    // se siamo passati da portrait -> landscape su mobile, resetta lo stato
    if (!prev && orientationOk) {
      // comportati come al primo accesso: mostra start screen e resetta dati
      gameStarted = false;
      gameOver = false;
      score = 0;
      chiesaX = 50;
      ostacoli = [];
      nuvole = [];
      jumpPressed = false;
      nameEntryActive = false;
      nameLetters = ["A", "A", "A"];
      nameIndex = 0;
      leaderboardViewActive = false;

      // impedisci che l'update riprenda automaticamente fino al click dell'utente
      preventAutoResume = true;

      // riallinea altezza terreno e personaggi
      updateGroundHeight();
      if (orientationOk) {
        // landscape: posiziona più in basso
        sposo.y = Math.max(30, height - groundHeight - sposo.height);
        sposa.y = Math.max(30, height - groundHeight - sposa.height);
      } else {
        // portrait: posiziona normalmente
        sposo.y = Math.max(30, height - 60);
        sposa.y = Math.max(30, height - 60);
      }

      // nascondi overlay se presenti (usiamo opacity invece di display:none per
      // non bloccare l'animazione della GIF su Safari iOS)
      try {
        overlayImg.style.opacity = "0";
        overlayCaption.style.opacity = "0";
      } catch (e) {}

      draw();
      if (!startLoopActive) startLoop();
    }

    // If on mobile and in landscape, enable fullscreen-only game view (hide other UI and disable scroll)
    if (isMobileDevice) {
      try {
        if (orientationOk) {
          document.body.classList.add("game-fullscreen");
          document.documentElement.classList.add("game-fullscreen");
          document.body.style.overflow = "hidden";
          document.documentElement.style.overflow = "hidden";
          try {
            window.scrollTo(0, 0);
          } catch (e) {}
        } else {
          document.body.classList.remove("game-fullscreen");
          document.documentElement.classList.remove("game-fullscreen");
          document.body.style.overflow = "";
          document.documentElement.style.overflow = "";
        }
      } catch (e) {}
    }

    lastOrientationOk = orientationOk;
  }

  // Resize debounced + DPR-aware
  let _resizeTimer = null;
  function handleResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      // checkOrientation prima: aggiorna .game-fullscreen, così il canvas
      // ha già le dimensioni CSS finali quando resizeCanvas legge clientWidth/Height
      checkOrientation();
      resizeCanvas();
      draw();
    }, 80);
  }
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);
  checkOrientation();
  updateGroundHeight();
  applyResponsiveScale();

  // aggiorna groundHeight in base all'altezza del canvas per mantenere proporzioni
  function updateGroundHeight() {
    let percentage = 0.09; // default per portrait e iOS
    if (isMobileDevice && orientationOk) {
      percentage = 0.20; // mobile landscape: ground più sottile, più cielo visibile
      groundHeight = Math.max(40, Math.round(height * percentage));
    } else {
      groundHeight = Math.max(35, Math.round(height * percentage));
    }
  }

  // Ridimensiona il canvas tenendo conto del devicePixelRatio (testo nitido su retina)
  // e ricalcola tutte le grandezze derivate da width/height.
  function resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const isFullscreen = document.body.classList.contains("game-fullscreen");
    const header = canvas.parentElement;
    let cssW, cssH;
    if (isFullscreen) {
      // Su Firefox mobile 100vw può eccedere window.innerWidth (layout viewport
      // vs visual viewport). Il flex-center del parent finisce per spostare
      // visivamente il canvas a destra, lasciando una banda verde a sinistra.
      // Forziamo sia il parent che il canvas alle dimensioni del visual viewport,
      // così coincidono e il flex non sbilancia nulla.
      cssW = window.innerWidth || canvas.clientWidth;
      cssH = window.innerHeight || canvas.clientHeight;
      if (header) {
        header.style.width = cssW + "px";
        header.style.height = cssH + "px";
      }
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    } else {
      // In non-fullscreen rimuovi gli override del parent e affidati al CSS.
      if (header) {
        header.style.width = "";
        header.style.height = "";
      }
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      cssW = canvas.clientWidth;
      cssH = canvas.clientHeight;
    }
    if (!cssW || !cssH) return;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    width = cssW;
    height = cssH;
    updateGroundHeight();
    applyResponsiveScale();
    sposo.y = height - groundHeight - sposo.height;
    sposa.y = height - groundHeight - sposa.height;
    if (!gameStarted || gameOver) {
      sposo.x = Math.round(width * 0.3);
      sposa.x = sposo.x + sposa.offset;
      positionCoupleNearChiesa();
    }
  }

  // Calibrazione di riferimento: canvas desktop 1200x400 → valori identici a prima.
  // Su mobile landscape (es. 844x390) tutto si riscala in modo coerente.
  function applyResponsiveScale() {
    const spriteH = clamp(Math.round(height * 0.125), 30, 90);
    sposo.width = sposo.height = spriteH;
    sposa.width = sposa.height = spriteH;
    sposa.offset = -Math.round(spriteH * 1.6);

    sposo.hitbox.xOffset = Math.round(spriteH * 0.2);
    sposo.hitbox.yOffset = Math.round(spriteH * 0.1);
    sposo.hitbox.width = Math.round(spriteH * 0.6);
    sposo.hitbox.height = Math.round(spriteH * 0.8);

    sposa.hitbox.xOffset = Math.round(spriteH * 0.24);
    sposa.hitbox.yOffset = Math.round(spriteH * 0.12);
    sposa.hitbox.width = Math.round(spriteH * 0.52);
    sposa.hitbox.height = Math.round(spriteH * 0.76);

    gravity = height * 0.00175;
    jumpPower = -height * 0.035;
    baseSpeed = width * 0.00417;
    chiesaSpeed = width * 0.0025;
  }

  // Posiziona gli sposi vicino alla chiesa (usato su mobile)
  function positionCoupleNearChiesa() {
    if (!isMobileDevice) return;
    // usa le dimensioni naturali se presenti
    const chiesaH = imgChiesa.naturalHeight || imgChiesa.height || 100;
    const chiesaW = imgChiesa.naturalWidth || imgChiesa.width || 100;
    const scale = (height - groundHeight) / chiesaH;
    const finalWidth = chiesaW * scale;
    // posiziona lo sposo appena a destra della chiesa
    sposo.x = Math.round(chiesaX + finalWidth + 12);
    // la sposa mantiene l'offset rispetto allo sposo
    sposa.x = sposo.x + sposa.offset;
  }

  // --------------------------------------
  // INPUT: SALTO + RESTART (PC + MOBILE)
  // --------------------------------------

  function startJump() {
    if (!jumpPressed && sposo.y >= height - groundHeight - sposo.height) {
      sposo.vy = jumpPower;
      jumpPressed = true;
    }
  }

  function endJump() {
    jumpPressed = false;

    // accorcia salto
    if (sposo.vy < -4) {
      sposo.vy = -4;
    }
  }

  // ----- KEYBOARD -----
  document.addEventListener("keydown", (e) => {
    // Vista classifica aperta: qualsiasi tasto principale la chiude.
    if (leaderboardViewActive) {
      if (
        e.code === "Escape" ||
        e.code === "Enter" ||
        e.code === "Space"
      ) {
        e.preventDefault();
        closeLeaderboardView();
      }
      return;
    }

    // Schermata di inserimento nome: intercetta gli input prima del gameplay.
    if (nameEntryActive) {
      if (e.code === "ArrowUp") {
        e.preventDefault();
        cycleLetter(1);
        return;
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        cycleLetter(-1);
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        nameIndex = Math.max(0, nameIndex - 1);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        nameIndex = Math.min(NAME_LENGTH - 1, nameIndex + 1);
        return;
      }
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        if (nameIndex < NAME_LENGTH - 1) {
          nameIndex++;
        } else {
          submitName();
        }
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        skipNameEntry();
        return;
      }
      // Digitazione diretta di una lettera A-Z.
      if (/^Key[A-Z]$/.test(e.code)) {
        e.preventDefault();
        nameLetters[nameIndex] = e.code.substring(3);
        if (nameIndex < NAME_LENGTH - 1) nameIndex++;
        return;
      }
      return;
    }

    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      startJump();
    }

    if (e.code === "Enter" && gameOver) {
      restartGame();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (nameEntryActive) return;
    if (e.code === "Space" || e.code === "ArrowUp") {
      endJump();
    }
  });

  // Hit-test: il punto (canvasX, canvasY) è dentro il pulsante play?
  function isInsidePlayButton(canvasX, canvasY) {
    if (!playButtonBBox) return false;
    const b = playButtonBBox;
    return (
      canvasX >= b.x &&
      canvasX <= b.x + b.w &&
      canvasY >= b.y &&
      canvasY <= b.y + b.h
    );
  }

  // Coordinate del click/tap in CSS pixels rispetto al canvas
  function canvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ----- MOUSE (click per salto + start/restart) -----
  canvas.addEventListener("mousedown", (e) => {
    const { x: cx, y: cy } = canvasCoords(e.clientX, e.clientY);

    if (leaderboardViewActive) {
      // tap ovunque chiude la vista (anche fuori dal pulsante CHIUDI)
      closeLeaderboardView();
      return;
    }

    if (
      isLeaderboardBtnVisible() &&
      leaderboardBtnHit &&
      pointInRect(cx, cy, leaderboardBtnHit)
    ) {
      openLeaderboardView();
      return;
    }

    if (nameEntryActive) {
      handleNameEntryClick(cx, cy);
      return;
    }

    if (!gameStarted) {
      if (!orientationOk) return;
      // Start solo se il click è sul pulsante play
      if (!isInsidePlayButton(cx, cy)) return;
      preventAutoResume = false;
      gameStarted = true;
      fetchLeaderboard();
      startUpdate();
      return;
    }

    if (gameOver) {
      // Restart solo se il click è sul pulsante play
      if (isInsidePlayButton(cx, cy)) restartGame();
      return;
    }

    // Gioco in corso: click ovunque = salto
    startJump();
  });

  canvas.addEventListener("mouseup", () => {
    if (nameEntryActive || leaderboardViewActive) return;
    endJump();
  });

  // ----- TOUCH (tap per salto + start/restart) -----
  // Permetti il tap solo sopra il livello del terreno. Dal terreno in giù permetti lo scroll.
  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const { x: cx, y: cy } = canvasCoords(t.clientX, t.clientY);
    const groundTop = height - groundHeight;

    // Vista classifica aperta: tap ovunque la chiude.
    if (leaderboardViewActive) {
      e.preventDefault();
      lastTouchHandled = true;
      closeLeaderboardView();
      return;
    }

    // Pulsante CLASSIFICA (apre la vista).
    if (
      isLeaderboardBtnVisible() &&
      leaderboardBtnHit &&
      pointInRect(cx, cy, leaderboardBtnHit)
    ) {
      e.preventDefault();
      lastTouchHandled = true;
      openLeaderboardView();
      return;
    }

    // Durante l'inserimento del nome i comandi possono trovarsi anche oltre
    // la linea del terreno: gestiamo i tap su tutta l'area del canvas.
    if (nameEntryActive) {
      e.preventDefault();
      lastTouchHandled = true;
      handleNameEntryClick(cx, cy);
      return;
    }

    // Tap sotto il terreno: lascia scrollare la pagina (non gestire)
    if (cy >= groundTop) {
      lastTouchHandled = false;
      return;
    }

    e.preventDefault();
    lastTouchHandled = true;

    if (!gameStarted) {
      if (!orientationOk) return;
      if (!isInsidePlayButton(cx, cy)) return;
      preventAutoResume = false;
      gameStarted = true;
      fetchLeaderboard();
      startUpdate();
      return;
    }

    if (gameOver) {
      if (isInsidePlayButton(cx, cy)) restartGame();
      return;
    }

    startJump();
  });

  canvas.addEventListener("touchend", (e) => {
    // solo se il touch precedente è stato gestito dal gioco, impediamo il default e terminiamo il salto
    if (lastTouchHandled) {
      e.preventDefault();
      endJump();
      lastTouchHandled = false;
    }
    // se non era gestito, non facciamo nulla per lasciare il comportamento di scorrimento
  });

  // OSTACOLI --------------------------------------------------

  function spawnObstacle() {
    // ostacoli proporzionali allo sposo (~60%-120% della sua altezza)
    const baseSize = Math.max(20, Math.round(sposo.height * 0.6));
    const size = baseSize + Math.random() * baseSize;

    // Se ci sono ostacoli recenti, controlla distanza
    const last = ostacoli[ostacoli.length - 1];
    const secondLast = ostacoli[ostacoli.length - 2];

    // distanza minima proporzionale alla larghezza canvas (120 su desktop 1200)
    const minDist = Math.max(80, Math.round(width * 0.1));

    // Se c’è un ostacolo troppo vicino, non spawnare
    if (last && width - last.x < minDist) return;

    // Se ci sono già due ostacoli ravvicinati, stop
    if (last && secondLast && last.x - secondLast.x < minDist) return;

    const obstacle = {
      x: width,
      width: size,
      height: size,
      passed: false,
      hitbox: {},
    };

    const hitboxWidth = Math.max(12, Math.round(size * OBSTACLE_HITBOX_SCALE));
    const hitboxHeight = Math.max(12, Math.round(size * OBSTACLE_HITBOX_SCALE));
    obstacle.hitbox = {
      xOffset: Math.round((size - hitboxWidth) / 2),
      yOffset: Math.round(size * OBSTACLE_HITBOX_Y_OFFSET_SCALE),
      width: hitboxWidth,
      height: hitboxHeight,
    };

    // appoggia l’ostacolo sul terreno (il bordo inferiore tocca il terreno)
    obstacle.y = height - groundHeight - obstacle.height / 1.5;

    ostacoli.push(obstacle);
  }

  function spawnNuvola() {
    const size = 30 + Math.random() * 40; // simile a ostacoli, leggermente più grande

    const nuvola = {
      x: width,
      y: Math.random() * (height * 0.3), // SOLO parte alta del cielo
      width: size,
      height: size * 0.6, // nuvole più schiacciate
      speed: 1 + Math.random() * 1.5,
    };

    nuvole.push(nuvola);
  }

  // LOOP ------------------------------------------------------

  function update(now) {
    if (gameOver) {
      updateLoopActive = false;
      // Avvia il loop dedicato al game over per animare il pulsante play
      if (!gameOverLoopActive) {
        gameOverLoopActive = true;
        gameOverLoop();
      }
      return;
    }

    // se siamo su mobile e il dispositivo è in portrait, o se abbiamo bloccato
    // il resume dopo una rotazione, non eseguire la logica di gioco
    if (!orientationOk || preventAutoResume) {
      // comunque ridisegna l'overlay / schermata iniziale nel draw
      draw();
      rafId = requestAnimationFrame(update);
      return;
    }

    const delta = Math.min(Math.max((now - lastUpdateTime) / 16.6667, 0.5), 3);
    lastUpdateTime = now;

    // Movimento sposo (fisica)
    sposo.vy += gravity * delta;
    sposo.y += sposo.vy * delta;
    if (sposo.y > height - groundHeight - sposo.height) {
      sposo.y = height - groundHeight - sposo.height + 5;
      sposo.vy = 0;
    }

    // animazione sposo
    sposo.frameTimer++;
    if (sposo.frameTimer > 6) {
      // velocità animazione (più basso = più veloce)
      sposo.currentFrame = (sposo.currentFrame + 1) % 4;
      sposo.frameTimer = 0;
    }

    // Movimento sposa (fisica)
    sposa.vy += gravity * delta;
    sposa.y += sposa.vy * delta;
    if (sposa.y > height - groundHeight - sposa.height) {
      sposa.y = height - groundHeight - sposa.height + 2;
      sposa.vy = 0;
    }

    // animazione sposa
    sposa.frameTimer++;
    if (sposa.frameTimer > 6) {
      // velocità animazione (più basso = più veloce)
      sposa.currentFrame = (sposa.currentFrame + 1) % 4;
      sposa.frameTimer = 0;
    }

    // Aggiorna frame animazione (se in futuro usi sprite sheet)
    sposo.frame += 0.1;
    if (sposo.frame >= sposo.frameCount) sposo.frame = 0;

    sposa.frame += 0.05;
    if (sposa.frame >= sposa.frameCount) sposa.frame = 0;

    // Movimento sposa – segue lo sposo
    sposa.x = sposo.x + sposa.offset;
    if (sposa.x < 0) sposa.x = 0;

    // Spawn nuvole
    if (Math.random() < 0.01 * delta) spawnNuvola();

    // Movimento nuvole
    nuvole.forEach((n) => {
      n.x -= n.speed * delta;
    });

    // Rimuovi nuvole fuori dallo schermo
    nuvole = nuvole.filter((n) => n.x + n.width > 0);

    // Spawn ostacoli con difficoltà crescente
    const currentSpawnRate = baseSpawnRate * difficulty;
    if (Math.random() < currentSpawnRate * delta) spawnObstacle();

    // Sposta ostacoli con velocità crescente
    const currentSpeed = baseSpeed * difficulty;
    ostacoli.forEach((o) => {
      o.x -= currentSpeed * delta;
    });

    // Sposta la chiesa verso sinistra
    chiesaX -= chiesaSpeed * delta;

    // Rimuovi ostacoli fuori dallo schermo
    ostacoli = ostacoli.filter((o) => o.x + o.width > 0);

    // Collisioni (sposo vs ostacoli con hitbox)
    ostacoli.forEach((o) => {
      const a = sposo;
      const b = o;

      if (
        a.x + a.hitbox.xOffset + COLLISION_GRACE_PX <
          b.x + b.hitbox.xOffset + b.hitbox.width &&
        a.x + a.hitbox.xOffset + a.hitbox.width - COLLISION_GRACE_PX >
          b.x + b.hitbox.xOffset &&
        a.y + a.hitbox.yOffset + COLLISION_GRACE_PX <
          b.y + b.hitbox.yOffset + b.hitbox.height &&
        a.y + a.hitbox.yOffset + a.hitbox.height - COLLISION_GRACE_PX >
          b.y + b.hitbox.yOffset
      ) {
        gameOver = true;
      }
    });

    // Se il giocatore è appena entrato in game over e rientra nei top 10,
    // attiva la schermata di inserimento nome PRIMA del game over.
    if (gameOver && qualifiesForLeaderboard(score)) {
      nameEntryActive = true;
      nameLetters = ["A", "A", "A"];
      nameIndex = 0;
    }

    // Sposa salta automaticamente se un ostacolo è davanti
    ostacoli.forEach((o) => {
      const distanza = o.x - sposa.x;

      if (
        distanza < height * 0.15 && // proporzionale (60 su desktop h=400)
        distanza > 0 &&
        sposa.y >= height - groundHeight - sposa.height
      ) {
        sposa.vy = jumpPower * 0.8; // leggermente più basso del marito
      }
    });

    // Aumenta punteggio e difficoltà
    ostacoli.forEach((o) => {
      if (!o.passed && o.x + o.width < sposo.x) {
        o.passed = true;
        score++;
        // Aumenta difficoltà ogni 5 punti (+15% velocità/spawn)
        difficulty = 1 + Math.floor(score / 5) * 0.15;
      }
    });

    draw();
    rafId = requestAnimationFrame(update);
  }

  // Avvia l'update loop solo se non è già attivo (evita più loop sovrapposti)
  function startUpdate() {
    if (updateLoopActive) return;
    updateLoopActive = true;
    lastUpdateTime = performance.now();
    rafId = requestAnimationFrame(update);
  }

  function pauseGame() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, width, height - groundHeight);
    const pauseMessage = "Gioco in pausa! Torna su per riprendere a giocare";
    const maxPauseWidth = width * 0.88;
    const pauseSize = Math.round(
      clamp(Math.min(height * 0.04, width * 0.025), 12, 20),
    );
    let finalPauseSize = getFitFontSize(pauseMessage, pauseSize, maxPauseWidth);
    ctx.font = `${finalPauseSize}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";

    ctx.fillStyle = "black";
    ctx.fillText(pauseMessage, width / 2 + 2, height / 2 + 50 + 2);

    ctx.fillStyle = "white";
    ctx.fillText(pauseMessage, width / 2 + 2, height / 2 + 50);

    updateLoopActive = false;
  }

  function resumeGame() {
    if (updateLoopActive) return;
    if (gameOver) return;
    if (!gameStarted) return;
    if (!orientationOk) return;
    if (preventAutoResume) return;
    startUpdate();
  }

  function handleScroll() {
    // only pause/resume when in landscape/desktop (orientationOk === true)
    if (!orientationOk) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const atTop = scrollY <= 2; // consider "at top" only when very near 0

    // If user scrolls down at all, pause immediately (only in landscape/desktop)
    if (scrollY > 0 && updateLoopActive && !pausedByScroll) {
      pausedByScroll = true;
      pauseGame();
      return;
    }

    // Resume only when user is back at very top of the page
    if (atTop && pausedByScroll) {
      pausedByScroll = false;
      resumeGame();
    }
  }

  window.addEventListener("scroll", handleScroll, { passive: true });

  // Loop di start: ridisegna la schermata iniziale finché il gioco non parte
  function startLoop() {
    if (gameStarted) {
      startLoopActive = false;
      return;
    }
    startLoopActive = true;
    draw();
    requestAnimationFrame(startLoop);
  }

  // Loop di game over: ridisegna per animare il pulsante play finché l'utente
  // non clicca su Restart.
  function gameOverLoop() {
    if (!gameOver) {
      gameOverLoopActive = false;
      return;
    }
    gameOverLoopActive = true;
    draw();
    requestAnimationFrame(gameOverLoop);
  }

  // DRAW ------------------------------------------------------

  // Helper function to fit text within max width by adjusting font size.
  // Press Start 2P è monospace ~1em wide. Su Firefox mobile capita che il
  // canvas usi il font fallback (sans-serif, molto più stretto) per misurare
  // ma poi renda con il vero font caricato dopo → il testo trabocca.
  // Difesa: prendi il massimo tra measureText e una stima geometrica a ~1em.
  function getFitFontSize(text, baseFontSize, maxWidth, minFontSize) {
    if (!minFontSize) {
      minFontSize = Math.max(5, Math.round(baseFontSize * 0.4));
    }
    let fontSize = baseFontSize;

    const widthAt = (sz) => {
      ctx.font = `${sz}px "Press Start 2P", monospace`;
      // Press Start 2P ha advance width = 1em per carattere; uso 1.02 per
      // includere eventuale spacing del font ed evitare overflow su Firefox mobile,
      // dove measureText può restituire valori del font fallback (più stretto).
      return Math.max(ctx.measureText(text).width, text.length * sz * 1.02);
    };

    let textWidth = widthAt(fontSize);

    while (textWidth > maxWidth && fontSize > minFontSize) {
      fontSize = Math.max(minFontSize, Math.round(fontSize * 0.9));
      textWidth = widthAt(fontSize);
    }

    return fontSize;
  }

  // Disegna il pulsante play con TOP in (cx, topY), alternando i 2 frame
  // ogni 400 ms per simulare un'animazione "premuto/rilasciato".
  // Dimensionato in base alla LARGHEZZA del canvas (più grande su PC che su mobile),
  // poi ridotto se non entra nello spazio verticale disponibile sopra lo sposo.
  // Calcola la Y del bordo superiore VISIBILE del pulsante play (escludendo la
  // cornice trasparente del PNG). Replica la logica di drawPlayButton così da
  // poter posizionare il subtitle a metà fra titolo e pulsante.
  function getPlayButtonVisibleTopY(factorOverride, downShiftRatioOverride) {
    if (!imgPlay1.naturalWidth || !imgPlay1.naturalHeight) {
      return height - groundHeight;
    }
    const aspect1 = imgPlay1.naturalWidth / imgPlay1.naturalHeight;
    const isLandscapeMobile = isMobileDevice && orientationOk;
    const factor =
      typeof factorOverride === "number"
        ? factorOverride
        : isLandscapeMobile
          ? 0.9
          : 0.8;
    const downShiftRatio =
      typeof downShiftRatioOverride === "number"
        ? downShiftRatioOverride
        : 0.05;
    const bottomLimit = height - groundHeight;
    let btnH = Math.round(bottomLimit * factor);
    let btnW = Math.round(btnH * aspect1);
    const maxW = width * 0.98;
    if (btnW > maxW) {
      btnW = Math.round(maxW);
      btnH = Math.round(btnW / aspect1);
    }
    const downShift = Math.round(btnH * downShiftRatio);
    const bbBottom = bottomLimit + downShift;
    const bbTop = bbBottom - btnH;
    if (playOpaqueBBoxRatios) {
      return bbTop + playOpaqueBBoxRatios.yMinR * btnH;
    }
    return bbTop;
  }

  function drawPlayButton(cx, factorOverride, downShiftRatioOverride) {
    if (!imgPlay1.complete || !imgPlay2.complete) return;
    const p1W = imgPlay1.naturalWidth;
    const p1H = imgPlay1.naturalHeight;
    if (!p1W || !p1H) return;

    const aspect1 = p1W / p1H;

    // Dimensione SOLO dal canvas. Override possibile (es. nel game over).
    const isLandscapeMobile = isMobileDevice && orientationOk;
    const factor =
      typeof factorOverride === "number"
        ? factorOverride
        : isLandscapeMobile
          ? 0.9
          : 0.8;
    const bottomLimit = height - groundHeight;
    let btnH = Math.round(bottomLimit * factor);
    let btnW = Math.round(btnH * aspect1);

    const maxW = width * 0.98;
    if (btnW > maxW) {
      btnW = Math.round(maxW);
      btnH = Math.round(btnW / aspect1);
    }

    const left = Math.round(cx - btnW / 2);
    // Shift verso il basso: il bbox si estende sotto la linea del terreno
    // così la parte visibile del pulsante appare più in basso (vicino al ground).
    const downShiftRatio =
      typeof downShiftRatioOverride === "number"
        ? downShiftRatioOverride
        : 0.05;
    const downShift = Math.round(btnH * downShiftRatio);
    const bottom = bottomLimit + downShift;
    const top = bottom - btnH;

    // Hit-box: solo l'area effettivamente opaca del frame "rilasciato"
    // (esclude la cornice trasparente intorno all'immagine).
    if (playOpaqueBBoxRatios) {
      const r = playOpaqueBBoxRatios;
      playButtonBBox = {
        x: left + r.xMinR * btnW,
        y: top + r.yMinR * btnH,
        w: (r.xMaxR - r.xMinR) * btnW,
        h: (r.yMaxR - r.yMinR) * btnH,
      };
    } else {
      playButtonBBox = { x: left, y: top, w: btnW, h: btnH };
    }

    const frame = Math.floor(performance.now() / 400) % 2;
    if (frame === 0) {
      ctx.drawImage(imgPlay1, left, top, btnW, btnH);
    } else {
      // Offset Y minore (~3% di btnH) per simulare la pressione.
      const pressOffset = Math.max(2, Math.round(btnH * 0.03));
      const p2W = imgPlay2.naturalWidth || p1W;
      const p2H = imgPlay2.naturalHeight || p1H;
      const p2RenderH = Math.round((btnW * p2H) / p2W);
      ctx.drawImage(
        imgPlay2,
        left,
        bottom + pressOffset - p2RenderH,
        btnW,
        p2RenderH,
      );
    }
  }

  // Disegna una freccia triangolare per i comandi di inserimento nome.
  function drawArrowTriangle(cx, cy, size, dir) {
    ctx.save();
    ctx.beginPath();
    if (dir === "up") {
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx + size / 2, cy + size / 2);
      ctx.lineTo(cx - size / 2, cy + size / 2);
    } else {
      ctx.moveTo(cx, cy + size / 2);
      ctx.lineTo(cx + size / 2, cy - size / 2);
      ctx.lineTo(cx - size / 2, cy - size / 2);
    }
    ctx.closePath();
    ctx.fillStyle = "rgb(255, 221, 69)";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = Math.max(2, Math.round(size * 0.12));
    ctx.stroke();
    ctx.restore();
  }

  // Pulsante stile pixel-art per OK / SKIP nella schermata name entry.
  function drawNameEntryButton(rect, text, fontSize, accent) {
    ctx.save();
    const shadow = Math.max(2, Math.round(fontSize * 0.22));
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(rect.x + shadow, rect.y + shadow, rect.w, rect.h);
    ctx.fillStyle = accent ? "rgb(255, 221, 69)" : "rgb(214, 0, 0)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "black";
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = accent ? "black" : "rgb(255, 221, 69)";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  // Schermata di inserimento nome (3 lettere), mostrata prima del game over
  // se il punteggio rientra nella top 10.
  function drawNameEntry() {
    // overlay scuro sopra il terreno
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, width, height - groundHeight);

    const centerX = width / 2;
    const usableH = height - groundHeight;

    // Titolo "NUOVO RECORD!"
    const titleSize = Math.round(
      clamp(Math.min(usableH * 0.11, width * 0.045), 14, 42),
    );
    const titleShadow = titleSize * 0.1;
    const titleText = "NUOVO RECORD!";
    const titleY = Math.max(
      20 + titleSize,
      Math.round(usableH * 0.14),
    );
    ctx.font = `${titleSize}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgb(214, 0, 0)";
    ctx.fillText(titleText, centerX + 2, titleY + titleShadow);
    ctx.fillStyle = "rgb(255, 221, 69)";
    ctx.fillText(titleText, centerX, titleY);

    // Sottotitolo: punteggio + istruzione
    const subSize = Math.round(
      clamp(Math.min(usableH * 0.05, width * 0.025), 10, 22),
    );
    const subShadow = subSize * 0.11;
    const subY = titleY + Math.max(20, Math.round(titleSize * 1.0));
    ctx.font = `${subSize}px "Press Start 2P", monospace`;
    const subText = `PUNTI: ${score}`;
    ctx.fillStyle = "black";
    ctx.fillText(subText, centerX + 2, subY + subShadow);
    ctx.fillStyle = "white";
    ctx.fillText(subText, centerX, subY);

    const hintSize = Math.max(8, Math.round(subSize * 0.7));
    const hintY = subY + Math.max(16, Math.round(subSize * 1.05));
    ctx.font = `${hintSize}px "Press Start 2P", monospace`;
    const hintText = "INSERISCI IL TUO NOME";
    ctx.fillStyle = "black";
    ctx.fillText(hintText, centerX + 1, hintY + 1);
    ctx.fillStyle = "white";
    ctx.fillText(hintText, centerX, hintY);

    // Calcolo spazio disponibile per lettere + pulsanti
    const remainingH = usableH - hintY - 16;
    const letterSize = Math.round(
      clamp(Math.min(remainingH * 0.22, width * 0.055), 14, 44),
    );
    const cellW = Math.round(letterSize * 1.15);
    const cellGap = Math.round(letterSize * 0.55);
    const totalLettersW = cellW * NAME_LENGTH + cellGap * (NAME_LENGTH - 1);
    const lettersStartX = centerX - totalLettersW / 2;

    const arrowSize = Math.round(letterSize * 0.45);
    const arrowGap = Math.round(letterSize * 0.2);

    // Posiziona la baseline così che la freccia su resti SOTTO la scritta
    // "INSERISCI IL TUO NOME" con un piccolo margine di sicurezza.
    const clearanceTop = Math.max(10, Math.round(letterSize * 0.35));
    const lettersBaselineY =
      hintY +
      clearanceTop +
      arrowSize +
      arrowGap +
      Math.round(letterSize * 0.85);

    const slots = [];
    for (let i = 0; i < NAME_LENGTH; i++) {
      const cellX = lettersStartX + i * (cellW + cellGap);
      const cellCenterX = cellX + cellW / 2;

      const letterRect = {
        x: cellX,
        y: lettersBaselineY - Math.round(letterSize * 0.85),
        w: cellW,
        h: Math.round(letterSize * 1.1),
      };

      // freccia su (sopra la lettera)
      const upRect = {
        x: cellCenterX - arrowSize,
        y: letterRect.y - arrowGap - arrowSize,
        w: arrowSize * 2,
        h: arrowSize,
      };
      drawArrowTriangle(
        cellCenterX,
        upRect.y + arrowSize / 2,
        arrowSize,
        "up",
      );

      // riquadro lettera selezionata
      if (i === nameIndex) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 221, 69, 0.18)";
        ctx.fillRect(letterRect.x, letterRect.y, letterRect.w, letterRect.h);
        ctx.strokeStyle = "rgb(255, 221, 69)";
        ctx.lineWidth = Math.max(2, Math.round(letterSize * 0.08));
        ctx.strokeRect(
          letterRect.x,
          letterRect.y,
          letterRect.w,
          letterRect.h,
        );
        ctx.restore();
      }

      // lettera
      ctx.font = `${letterSize}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "black";
      ctx.fillText(nameLetters[i], cellCenterX + 2, lettersBaselineY + 2);
      ctx.fillStyle = i === nameIndex ? "rgb(255, 221, 69)" : "white";
      ctx.fillText(nameLetters[i], cellCenterX, lettersBaselineY);

      // freccia giù (sotto la lettera)
      const downRect = {
        x: cellCenterX - arrowSize,
        y: letterRect.y + letterRect.h + arrowGap,
        w: arrowSize * 2,
        h: arrowSize,
      };
      drawArrowTriangle(
        cellCenterX,
        downRect.y + arrowSize / 2,
        arrowSize,
        "down",
      );

      slots.push({
        index: i,
        up: upRect,
        down: downRect,
        letter: letterRect,
      });
    }

    // Pulsanti OK e SKIP
    const downArrowsBottom = slots[0].down.y + slots[0].down.h;
    const btnSize = Math.max(10, Math.round(subSize * 0.95));
    const btnPad = Math.round(btnSize * 0.7);
    ctx.font = `${btnSize}px "Press Start 2P", monospace`;
    const okText = "OK";
    const skipText = "SKIP";
    const okTextW = ctx.measureText(okText).width;
    const skipTextW = ctx.measureText(skipText).width;
    const okW = Math.max(Math.round(btnSize * 3.8), okTextW + btnPad * 2);
    const skipW = Math.max(Math.round(btnSize * 4.6), skipTextW + btnPad * 2);
    const btnH = Math.round(btnSize * 2.2);
    const btnGap = Math.max(20, Math.round(width * 0.04));
    const totalBtnW = okW + skipW + btnGap;
    const btnStartX = centerX - totalBtnW / 2;
    const btnYDesired =
      downArrowsBottom + Math.max(20, Math.round(letterSize * 0.5));
    const btnY = Math.min(btnYDesired, usableH - btnH - 10);

    const okRect = { x: btnStartX, y: btnY, w: okW, h: btnH };
    drawNameEntryButton(okRect, okText, btnSize, true);

    const skipRect = {
      x: btnStartX + okW + btnGap,
      y: btnY,
      w: skipW,
      h: btnH,
    };
    drawNameEntryButton(skipRect, skipText, btnSize, false);

    nameEntryHit = { slots, ok: okRect, skip: skipRect };
  }

  // Piccolo pulsante "CLASSIFICA" visibile su start screen e game over.
  // Posizionato in alto a sinistra per non coprire il punteggio (in alto a destra).
  function drawLeaderboardOpenButton() {
    const fontSize = Math.round(
      clamp(Math.min(height * 0.028, width * 0.018), 7, 14),
    );
    ctx.save();
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    const label = "CLASSIFICA";
    const textW = ctx.measureText(label).width;
    const padX = Math.round(fontSize * 0.7);
    const padY = Math.round(fontSize * 0.55);
    const w = Math.round(textW + padX * 2);
    const h = Math.round(fontSize + padY * 2);

    const centerX = width / 2;
    const playBtnDownShift =
      gameOver && isMobileDevice && orientationOk ? 0.18 : 0.05;
    const playVisibleTop = getPlayButtonVisibleTopY(undefined, playBtnDownShift);
    let playVisibleBottom;
    if (imgPlay1.naturalWidth && imgPlay1.naturalHeight) {
      const aspect1 = imgPlay1.naturalWidth / imgPlay1.naturalHeight;
      const isLandscapeMobile = isMobileDevice && orientationOk;
      const factor = isLandscapeMobile ? 0.9 : 0.8;
      const bottomLimit = height - groundHeight;
      let btnH = Math.round(bottomLimit * factor);
      let btnW = Math.round(btnH * aspect1);
      const maxW = width * 0.98;
      if (btnW > maxW) {
        btnW = Math.round(maxW);
        btnH = Math.round(btnW / aspect1);
      }
      const downShift = Math.round(btnH * playBtnDownShift);
      const bbTop = bottomLimit + downShift - btnH;
      playVisibleBottom = playOpaqueBBoxRatios
        ? bbTop + playOpaqueBBoxRatios.yMaxR * btnH
        : bbTop + btnH;
    } else {
      playVisibleBottom = playVisibleTop + Math.round(height * 0.08);
    }

    const x = Math.round(centerX - w / 2);
    const leaderboardGap = Math.max(24, Math.round(height * 0.1));
    const y = Math.min(
      Math.max(8, Math.round(playVisibleBottom + leaderboardGap)),
      Math.max(8, Math.round(height - groundHeight - h - 8)),
    );

    const shadow = Math.max(2, Math.round(fontSize * 0.22));
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(x + shadow, y + shadow, w, h);
    ctx.fillStyle = "rgb(255, 221, 69)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "black";
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.15));
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textBaseline = "alphabetic";
    ctx.restore();

    leaderboardBtnHit = { x, y, w, h };
  }

  // Schermata "CLASSIFICA": overlay con top 10 record.
  function drawLeaderboardView() {
    // overlay scuro sopra il terreno
    ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
    ctx.fillRect(0, 0, width, height - groundHeight);

    const centerX = width / 2;
    const usableH = height - groundHeight;

    // Titolo
    const titleSize = Math.round(
      clamp(Math.min(usableH * 0.1, width * 0.04), 14, 36),
    );
    const titleShadow = titleSize * 0.1;
    const titleY = Math.max(
      20 + titleSize,
      Math.round(usableH * 0.12),
    );
    ctx.font = `${titleSize}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgb(214, 0, 0)";
    ctx.fillText("CLASSIFICA", centerX + 2, titleY + titleShadow);
    ctx.fillStyle = "rgb(255, 221, 69)";
    ctx.fillText("CLASSIFICA", centerX, titleY);

    // Pulsante CHIUDI in basso
    const btnFontSize = Math.round(
      clamp(Math.min(usableH * 0.045, width * 0.022), 9, 18),
    );
    ctx.font = `${btnFontSize}px "Press Start 2P", monospace`;
    const closeText = "CHIUDI";
    const closeTextW = ctx.measureText(closeText).width;
    const closePadX = Math.round(btnFontSize * 0.8);
    const closeW = Math.max(
      Math.round(btnFontSize * 5),
      closeTextW + closePadX * 2,
    );
    const closeH = Math.round(btnFontSize * 2.2);
    const closeY = usableH - closeH - 14;
    const closeX = centerX - closeW / 2;

    // Area lista fra il titolo e il pulsante CHIUDI
    const listTop = titleY + Math.max(28, Math.round(titleSize * 0.8));
    const listBottom = closeY - 14;
    const listH = Math.max(20, listBottom - listTop);

    const board = leaderboardCache;
    const rows = Math.min(board.length, MAX_LEADERBOARD_ENTRIES);

    if (rows === 0) {
      const emptyFont = Math.round(
        clamp(Math.min(usableH * 0.04, width * 0.022), 9, 16),
      );
      ctx.font = `${emptyFont}px "Press Start 2P", monospace`;
      const emptyText = "NESSUN RECORD ANCORA";
      const ty = (listTop + listBottom) / 2;
      ctx.fillStyle = "black";
      ctx.fillText(emptyText, centerX + 1, ty + 1);
      ctx.fillStyle = "white";
      ctx.fillText(emptyText, centerX, ty);
    } else {
      // Calcolo font row: deve entrare in altezza (10 righe possibili)
      // e larghezza (max ~70% del canvas).
      const rowSlots = MAX_LEADERBOARD_ENTRIES; // riserva sempre spazio per 10
      const rowH = listH / rowSlots;
      const rowFontByH = Math.round(rowH * 0.62);
      const rowFontByW = Math.round(
        width * (isMobileDevice ? 0.038 : 0.028),
      );
      const rowFontSize = clamp(
        Math.min(rowFontByH, rowFontByW),
        isMobileDevice ? 12 : 8,
        isMobileDevice ? 24 : 20,
      );
      ctx.font = `${rowFontSize}px "Press Start 2P", monospace`;

      const colPaddingX = Math.max(16, Math.round(width * 0.06));
      const separator = "..........";
      const rowsData = [];
      for (let i = 0; i < rows; i++) {
        const entry = board[i];
        rowsData.push({
          rankStr: (i + 1).toString().padStart(2, " ") + ".",
          text: `${entry.name}${separator}${entry.score}`,
        });
      }

      const maxRankW = Math.max(
        ...rowsData.map((row) => ctx.measureText(row.rankStr).width),
      );
      const maxTextW = Math.max(
        ...rowsData.map((row) => ctx.measureText(row.text).width),
      );
      const textSpacing = Math.round(rowFontSize * 0.9);
      const totalTextW = maxRankW + textSpacing + maxTextW;
      const leftX = Math.round(centerX - totalTextW / 2);

      for (let i = 0; i < rows; i++) {
        const entry = board[i];
        const row = rowsData[i];
        const yBaseline = listTop + (i + 0.7) * rowH;

        ctx.textAlign = "left";
        ctx.fillStyle = "black";
        ctx.fillText(row.rankStr, leftX + 2, yBaseline + 2);
        ctx.fillStyle = "rgb(255, 221, 69)";
        ctx.fillText(row.rankStr, leftX, yBaseline);

        const nameX = leftX + maxRankW + textSpacing;
        ctx.fillStyle = "black";
        ctx.fillText(row.text, nameX + 2, yBaseline + 2);
        ctx.fillStyle = "white";
        ctx.fillText(row.text, nameX, yBaseline);
      }
    }

    const closeRect = { x: closeX, y: closeY, w: closeW, h: closeH };
    drawNameEntryButton(closeRect, closeText, btnFontSize, true);
    leaderboardCloseHit = closeRect;
  }

  // Memorizza i dati di disegno della start screen, da renderizzare DOPO il
  // pulsante (così il pulsante grande non li copre).
  let pendingPlayTopY = null;
  let pendingSubtitle = null;
  let pendingTitle = null;

  function draw() {
    ctx.clearRect(0, 0, width, height);
    pendingPlayTopY = null;
    pendingSubtitle = null;
    pendingTitle = null;

    // hide DOM overlay by default; will be shown when needed.
    // Usiamo opacity (e position fuori dal flusso via z-index/pointer-events già set)
    // invece di display:none, così Safari iOS non blocca i frame della GIF.
    try {
      overlayImg.style.opacity = "0";
      overlayCaption.style.opacity = "0";
    } catch (e) {}

    // font sizing responsive - considera sia l'altezza che la larghezza per mobile landscape
    const titleSize = Math.round(
      clamp(Math.min(height * 0.08, width * 0.04), 5, 32),
    );
    const titleShadowDistance = titleSize * 0.1;
    const subtitleSize = Math.round(
      clamp(Math.min(height * 0.04, width * 0.025), 12, 30),
    );
    const subtitleShadowDistance = subtitleSize * 0.11;
    const scoreSize = Math.round(
      clamp(Math.min(height * 0.025, width * 0.02), 10, 16),
    );
    // Calcolo dimensioni titolo/sottotitolo basato sui testi della start screen.
    // Le STESSE dimensioni vengono usate per "GAME OVER" e per il messaggio di
    // restart, così le due schermate hanno coppie di testi identici per misura.
    const isLandscapeMobile = isMobileDevice && orientationOk;
    const titleStartSize = isLandscapeMobile ? Math.round(width * 0.08) : 50;
    const finalTitleSizeShared = getFitFontSize(
      "IL MATRIMONIO DI ELENA E CLAUDIO",
      titleStartSize,
      width * 0.92,
      10,
    );
    // Il subtitle deve sempre essere largo ~65% del titolo (misurato sul canvas).
    // Calcoliamo la dimensione del font del subtitle in modo che, al netto della
    // monospaziatura di Press Start 2P, la sua larghezza renderizzata sia ~65%
    // di quella del titolo al suo finalTitleSizeShared.
    const titleText = "IL MATRIMONIO DI ELENA E CLAUDIO";
    const subtitleText = "CLICCA PLAY PER AIUTARE CLAUDIO A FUGGIRE!";
    ctx.save();
    ctx.font = `${finalTitleSizeShared}px "Press Start 2P", monospace`;
    const titleMeasuredW = ctx.measureText(titleText).width;
    const subtitleAtTitleSize = ctx.measureText(subtitleText).width;
    ctx.restore();
    const targetSubtitleRatio = 0.75;
    const targetSubtitleW = titleMeasuredW * targetSubtitleRatio;
    let finalSubtitleSizeShared = Math.max(
      8,
      Math.round((targetSubtitleW / subtitleAtTitleSize) * finalTitleSizeShared),
    );
    // Safety: comunque non superare il 92% della larghezza del canvas.
    finalSubtitleSizeShared = getFitFontSize(
      subtitleText,
      finalSubtitleSizeShared,
      width * 0.92,
      8,
    );
    // gameOverSize / restartSize ora derivano dai valori condivisi
    const gameOverSize = finalTitleSizeShared;
    const restartSize = finalSubtitleSizeShared;

    // Disegna nuvole PRIMA del background, così le nuvole basse sono coperte
    // dalle sagome del paese (passano "dietro" all'immagine).
    // Usa drawImage 9-arg per croppare 2 px sul bordo sinistro e inferiore
    // di nuvola.png (il PNG ha un sottile bordo bianco "a L" da quei lati).
    const nW = imgNuvola.naturalWidth || imgNuvola.width;
    const nH = imgNuvola.naturalHeight || imgNuvola.height;
    if (nW > 4 && nH > 4) {
      const cropL = 8; // pixel da scartare a sinistra
      const cropB = 2; // pixel da scartare in basso
      nuvole.forEach((n) => {
        ctx.drawImage(
          imgNuvola,
          cropL,
          0,
          nW - cropL,
          nH - cropB,
          Math.round(n.x),
          Math.round(n.y),
          Math.round(n.width),
          Math.round(n.height),
        );
      });
    } else {
      nuvole.forEach((n) => {
        ctx.drawImage(
          imgNuvola,
          Math.round(n.x),
          Math.round(n.y),
          Math.round(n.width),
          Math.round(n.height),
        );
      });
    }

    // Disegna background fisso esteso oltre i bordi orizzontali mantenendo proporzioni
    if (
      imgBackground.complete &&
      imgBackground.naturalWidth &&
      imgBackground.naturalHeight
    ) {
      const overflow = Math.max(40, Math.round(width * 0.05)); // pixel extra ai lati
      const srcAspect =
        imgBackground.naturalWidth / imgBackground.naturalHeight;
      const targetWidth = width + overflow * 2;
      let targetHeight = targetWidth / srcAspect;
      // non lasciare il background più alto dell'intera canvas
      // posiziona il background in modo che il suo bordo inferiore tocchi il terreno
      const x = -overflow;
      // applica piccolo nudge verso il basso per compensare padding trasparente nelle immagini
      const bgNudge = Math.round(targetHeight * BG_NUDGE_FACTOR);
      const y = height - groundHeight - targetHeight + bgNudge;

      ctx.save();
      // Mobile landscape: opaco al 100% così le case nascondono le nuvole disegnate
      // sotto. Portrait: 0.8 (look tenue dietro la GIF rotate). Desktop: 0.4.
      let bgAlpha;
      if (isMobileDevice && !orientationOk) {
        bgAlpha = 0.8;
      } else {
        bgAlpha = 0.4;
      }
      ctx.globalAlpha = bgAlpha;
      ctx.drawImage(imgBackground, x, y, targetWidth, targetHeight);
      ctx.restore();
    }

    // TITOLO + SOTTOTITOLO (start screen)
    if (!gameStarted && orientationOk) {
      const titleLines = ["IL MATRIMONIO DI ELENA E CLAUDIO"];
      const finalTitleSize = finalTitleSizeShared;
      const finalSubtitleSize = finalSubtitleSizeShared;
      const titleShadowDist = finalTitleSize * 0.1;
      const lineGap = finalTitleSize * 0.25;

      const titleY = Math.max(
        20 + finalTitleSize,
        Math.round((height - groundHeight) * 0.15),
      );

      pendingTitle = {
        lines: titleLines,
        y: titleY,
        size: finalTitleSize,
        shadowDist: titleShadowDist,
        lineGap: lineGap,
      };

      const titleEndY = titleY; // single line

      const subtitle = "CLICCA PLAY PER AIUTARE CLAUDIO A FUGGIRE!";
      const subtitleShadowDist = finalSubtitleSize * 0.11;
      const subtitleY = titleEndY + Math.max(40, finalTitleSize * 1.5);
      pendingSubtitle = {
        text: subtitle,
        y: subtitleY,
        size: finalSubtitleSize,
        shadowDist: subtitleShadowDist,
      };

      pendingPlayTopY = titleEndY + Math.max(16, finalTitleSize * 0.5);
    }

    // Terreno
    ctx.fillStyle = "#3ea043";
    ctx.fillRect(0, height - groundHeight, width, groundHeight);

    // In mobile + portrait, disegna una linea gialla in basso
    if (isMobileDevice && !orientationOk) {
      ctx.save();
      const baseWidth = Math.max(4, Math.round(height * 0.006));
      const yLine = height - groundHeight;

      // ombra scura subito sotto (come i riquadri delle sezioni)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = baseWidth * 0.9;
      const shadowOffset = Math.max(2, Math.round(height * 0.02));
      ctx.beginPath();
      ctx.moveTo(0, yLine + shadowOffset);
      ctx.lineTo(width, yLine + shadowOffset);
      ctx.stroke();

      // linea gialla principale
      ctx.strokeStyle = "rgb(255, 221, 69)";
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(0, yLine);
      ctx.lineTo(width, yLine);
      ctx.stroke();

      ctx.restore();
    }

    // Se orientamento non corretto su mobile, mostra overlay per ruotare
    if (!orientationOk) {
      // if user provided GIF, show the DOM overlay so it animates
      if (rotateReady) {
        try {
          overlayImg.style.display = "block";
          overlayImg.style.opacity = "1";
          overlayCaption.style.display = "block";
          overlayCaption.style.opacity = "1";
          updateOverlayPosition();
        } catch (e) {}
        return; // non disegnare il resto
      }
    }

    // Disegna la chiesa fissa a sinistra
    const chiesaHeight = imgChiesa.naturalHeight || imgChiesa.height || 100;
    const chiesaWidth = imgChiesa.naturalWidth || imgChiesa.width || 100;

    // Scala automaticamente per adattarsi al terreno
    const scale = (height - groundHeight) / chiesaHeight;
    const finalWidth = chiesaWidth * scale;
    const finalHeight = chiesaHeight * scale;
    // piccolo nudge per appoggiare visivamente la chiesa al terreno (compensa padding)
    const chiesaNudge = Math.round(finalHeight * CHIESA_NUDGE_FACTOR);

    ctx.drawImage(
      imgChiesa,
      chiesaX, // posizione orizzontale variabile della chiesa
      height - groundHeight - finalHeight + chiesaNudge, // nudge verso il basso
      finalWidth,
      finalHeight,
    );

    // Disegna sposa
    const frameSequenceSposa = [
      imgSposa1, // 0
      imgSposa2, // 1
      imgSposa1, // 2
      imgSposa2, // 3
    ];

    const frameImgSposa =
      frameSequenceSposa[sposa.currentFrame % frameSequenceSposa.length];
    ctx.drawImage(frameImgSposa, sposa.x, sposa.y, sposa.width, sposa.height);

    // Disegna sposo
    const frameSequenceSposo = [
      imgSposo1, // 0
      imgSposo2, // 1
      imgSposo3, // 2
      imgSposo2, // 3
    ];

    const frameImgSposo =
      frameSequenceSposo[sposo.currentFrame % frameSequenceSposo.length];
    ctx.drawImage(frameImgSposo, sposo.x, sposo.y, sposo.width, sposo.height);

    // Pulsante play della start screen: disegnato dopo lo sposo per stare sopra
    if (pendingPlayTopY !== null) {
      drawPlayButton(width / 2);
      pendingPlayTopY = null;
    }
    // Titolo in overlay sopra il pulsante
    if (pendingTitle) {
      const pt = pendingTitle;
      ctx.font = `${pt.size}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      for (let i = 0; i < pt.lines.length; i++) {
        const line = pt.lines[i];
        const lineY = pt.y + i * (pt.size + pt.lineGap);
        ctx.fillStyle = "rgb(214, 0, 0)";
        ctx.fillText(line, width / 2 + 2, lineY + pt.shadowDist);
        ctx.fillStyle = "rgb(255, 221, 69)";
        ctx.fillText(line, width / 2, lineY);
      }
      pendingTitle = null;
    }
    // Subtitle in overlay sopra il pulsante (lampeggiante)
    if (pendingSubtitle) {
      const ps = pendingSubtitle;
      ctx.font = `${ps.size}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      const show = Math.floor(performance.now() / 800) % 2 === 0;
      if (show) {
        ctx.fillStyle = "black";
        ctx.fillText(ps.text, width / 2 + 2, ps.y + ps.shadowDist);
        ctx.fillStyle = "white";
        ctx.fillText(ps.text, width / 2, ps.y);
      }
      pendingSubtitle = null;
    }

    // Disegna ostacoli
    ostacoli.forEach((o) => {
      ctx.drawImage(imgOstacolo, o.x, o.y, o.width, o.height);
    });

    // Disegna punteggio
    if (gameStarted) {
      ctx.font = `${scoreSize}px "Press Start 2P", monospace`;
      ctx.textAlign = "right";
      const scorePadding = Math.max(6, Math.round(width * 0.02)); // padding dal bordo destro
      const scoreX = width - scorePadding;
      const scoreY = Math.round(25 + scoreSize);

      ctx.fillStyle = "black";
      ctx.fillText(`Punti: ${score}`, scoreX + 2, scoreY + 2);
      ctx.fillStyle = "white";
      ctx.fillText(`Punti: ${score}`, scoreX, scoreY);

      // Record (high score) sotto il punteggio corrente
      if (highScore > 0) {
        const hiY = scoreY + Math.round(scoreSize * 1.5);
        ctx.fillStyle = "black";
        ctx.fillText(`Record: ${highScore}`, scoreX + 2, hiY + 2);
        ctx.fillStyle = "rgb(255, 221, 69)";
        ctx.fillText(`Record: ${highScore}`, scoreX, hiY);
      }

      ctx.textAlign = "start"; // reset
    }

    // Se siamo in pausa dovuta a scroll su mobile, mostra overlay persistente
    if (pausedByScroll) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, width, height - groundHeight);
      const pauseMessage = "Gioco in pausa! Torna su per riprendere a giocare";
      const maxPauseWidth = width * 0.88;
      const pauseSize = Math.round(
        clamp(Math.min(height * 0.04, width * 0.025), 12, 20),
      );
      let finalPauseSize = getFitFontSize(
        pauseMessage,
        pauseSize,
        maxPauseWidth,
      );
      ctx.font = `${finalPauseSize}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";

      ctx.fillStyle = "black";
      ctx.fillText(pauseMessage, width / 2 + 2, height / 2 + 50 + 2);

      ctx.fillStyle = "white";
      ctx.fillText(pauseMessage, width / 2 + 2, height / 2 + 50);

      return; // non disegnare altro sotto l'overlay
    }

    if (gameOver) {
      // Se il punteggio rientra in classifica, mostra prima il name entry.
      if (nameEntryActive) {
        drawNameEntry();
        return;
      }

      // overlay scuro
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, width, height - groundHeight);

      const x = width / 2;

      // Pulsante: stessa dimensione dello start; su mobile lo spostiamo un po'
      // più in basso (downShift maggiore) per dargli più respiro dal restart text.
      const gameOverDownShift =
        isMobileDevice && orientationOk ? 0.18 : 0.05;
      drawPlayButton(width / 2, undefined, gameOverDownShift);

      // GAME OVER: leggermente più grande del titolo dello start screen.
      const gameOverMessage = "GAME OVER";
      const finalGameOverSize = Math.round(finalTitleSizeShared * 1.25);
      const gameOverShadow = finalGameOverSize * 0.1;
      ctx.font = `${finalGameOverSize}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      const goY = Math.max(
        20 + finalGameOverSize,
        Math.round((height - groundHeight) * 0.32),
      );

      ctx.fillStyle = "rgb(214, 0, 0)";
      ctx.fillText(gameOverMessage, x + 2, goY + gameOverShadow);
      ctx.fillStyle = "rgb(255, 221, 69)";
      ctx.fillText(gameOverMessage, x, goY);

      // Messaggio restart: STESSA dimensione/posizione del subtitle.
      const restartMessage =
        "CLAUDIO E' SPACCIATO! CLICCA SU PLAY PER RIPROVARE!";
      const finalRestartSize = finalSubtitleSizeShared;
      const restartShadow = finalRestartSize * 0.11;
      ctx.font = `${finalRestartSize}px "Press Start 2P", monospace`;
      // Restart equidistante fra GAME OVER e bordo superiore visibile del pulsante.
      const playTopYGameOver = getPlayButtonVisibleTopY(
        undefined,
        gameOverDownShift,
      );
      const minRestartGap = Math.max(40, finalGameOverSize * 1.0);
      const naiveRestartY = (goY + playTopYGameOver) / 2;
      const restartY = Math.max(goY + minRestartGap, Math.round(naiveRestartY));

      ctx.fillStyle = "black";
      ctx.fillText(restartMessage, x + 2, restartY + restartShadow);
      ctx.fillStyle = "white";
      ctx.fillText(restartMessage, x, restartY);
    }

    // Pulsante "CLASSIFICA" sopra a tutto (start screen e game over).
    if (isLeaderboardBtnVisible()) {
      drawLeaderboardOpenButton();
    } else {
      leaderboardBtnHit = null;
    }

    // Vista classifica come ultimo strato così copre il resto.
    if (leaderboardViewActive) {
      drawLeaderboardView();
    } else {
      leaderboardCloseHit = null;
    }
  }

  // RESTART ---------------------------------------------------
  function restartGame() {
    // riposiziona gli sposi: y su terreno, x scalato sulla canvas corrente
    sposo.x = Math.round(width * 0.3);
    sposo.y = height - groundHeight - sposo.height;
    sposo.vy = 0;
    sposo.frame = 0;

    sposa.x = sposo.x + sposa.offset;
    sposa.y = height - groundHeight - sposa.height;
    sposa.vy = 0;
    sposa.frame = 0;

    chiesaX = Math.round(width * 0.04);

    positionCoupleNearChiesa();

    ostacoli = [];
    nuvole = [];
    score = 0;
    difficulty = 1; // resetta difficoltà
    gameOver = false;
    jumpPressed = false;

    // reset stato classifica/inserimento nome
    nameEntryActive = false;
    nameLetters = ["A", "A", "A"];
    nameIndex = 0;
    leaderboardViewActive = false;
    highScore = getHighScore();
    fetchLeaderboard();

    // riattiva il resume perché questo è un restart intenzionale
    preventAutoResume = false;
    startUpdate();
  }

  // AVVIO -----------------------------------------------------

  const allImages = [
    imgSposo1,
    imgSposo2,
    imgSposo3,
    imgSposa1,
    imgSposa2,
    imgOstacolo,
    imgChiesa,
    imgNuvola,
    imgBackground,
    imgPlay1,
    imgPlay2,
  ];

  // Su Firefox mobile (Fenix) il canvas usa il font fallback finché Press Start 2P
  // non viene esplicitamente caricato: precarichiamo per evitare il primo render
  // con metrica sbagliata.
  const fontReady =
    document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load('16px "Press Start 2P"'),
          document.fonts.load('32px "Press Start 2P"'),
        ]).catch(() => {})
      : Promise.resolve();

  let loaded = 0;
  allImages.forEach((img) => {
    img.onload = () => {
      loaded++;
      if (loaded === allImages.length) {
        fontReady.then(() => {
          resizeCanvas();
          draw();
          if (!startLoopActive) startLoop();
        });
      }
    };
  });

  // Avvia in background il fetch della classifica remota: alla prima
  // game over la cache sarà già aggiornata. In caso di fallimento si
  // resta sul valore di localStorage caricato in cache.
  fetchLeaderboard();
}
