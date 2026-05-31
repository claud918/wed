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
  overlayImg.style.display = "none";
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
  overlayCaption.style.display = "none";
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
    if (!overlayImg || overlayImg.style.display === "none") return;
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

      // nascondi overlay se presenti
      try {
        overlayImg.style.display = "none";
        overlayCaption.style.display = "none";
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
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      startJump();
    }

    if (e.code === "Enter" && gameOver) {
      restartGame();
    }
  });

  document.addEventListener("keyup", (e) => {
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

    if (!gameStarted) {
      if (!orientationOk) return;
      // Start solo se il click è sul pulsante play
      if (!isInsidePlayButton(cx, cy)) return;
      preventAutoResume = false;
      gameStarted = true;
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
    endJump();
  });

  // ----- TOUCH (tap per salto + start/restart) -----
  // Permetti il tap solo sopra il livello del terreno. Dal terreno in giù permetti lo scroll.
  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const { x: cx, y: cy } = canvasCoords(t.clientX, t.clientY);
    const groundTop = height - groundHeight;

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
  function drawPlayButton(cx, factorOverride) {
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
    const downShift = Math.round(btnH * 0.05);
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

    // hide DOM overlay by default; will be shown when needed
    try {
      overlayImg.style.display = "none";
      overlayCaption.style.display = "none";
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
    const finalSubtitleSizeShared = getFitFontSize(
      "CLICCA PLAY PER AIUTARE CLAUDIO A FUGGIRE!",
      Math.round(
        clamp(Math.min(height * 0.04, width * 0.025), 12, 30),
      ),
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
      const subtitleY = titleEndY + Math.max(28, finalTitleSize * 1.0);
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
          overlayCaption.style.display = "block";
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
      // overlay scuro
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, width, height - groundHeight);

      const x = width / 2;

      // Pulsante: STESSA dimensione/posizione dello start screen (factor di default).
      drawPlayButton(width / 2);

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
      const restartY = goY + Math.max(28, finalGameOverSize * 1.0);

      ctx.fillStyle = "black";
      ctx.fillText(restartMessage, x + 2, restartY + restartShadow);
      ctx.fillStyle = "white";
      ctx.fillText(restartMessage, x, restartY);
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
}
