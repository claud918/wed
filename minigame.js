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

  let groundHeight = height * 50; // altezza terreno (calcolata dinamicamente su resize)

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
  imgBackground.src = "img/background.png";

  const rotateHintImage = new Image();
  rotateHintImage.src = "img/rotate2.gif";

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
    const maxW = Math.round(rect.width * 0.6);
    const maxH = Math.round(rect.height * 0.5);
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
    const leftPos = Math.round(rect.left + (rect.width - drawW) / 2);
    const topPos = Math.round(rect.top + (rect.height - drawH) / 2);
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
    y: height,
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
    y: height - groundHeight,
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
  let jumpPressed = false; // per salto variabile
  let gameStarted = false; // il gioco parte solo dopo click
  // track if the last touch was handled by the game (prevents preventing default when user touched the ground area)
  let lastTouchHandled = false;

  let nuvole = [];
  // Posizione orizzontale della chiesa (scorre con il mondo)
  let chiesaX = 50;
  const chiesaSpeed = 3;
  // valori per regolare la posizione verticale se le immagini hanno padding
  const CHIESA_NUDGE_FACTOR = 0.215; // sposta la chiesa verso il basso di questa frazione dell'altezza finale
  const BG_NUDGE_FACTOR = 0.41; // sposta il background verso il basso di questa frazione
  // Orientamento / device
  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent
  );
  let orientationOk = true; // true se il dispositivo è in landscape o non mobile

  // evita che la logica di update riparta automaticamente dopo la rotazione
  let preventAutoResume = false;
  let startLoopActive = false; // (se non presente già)
  let updateLoopActive = false;
  let rafId = null;
  let pausedByScroll = false;

  function checkOrientation() {
    if (!isMobileDevice) {
      lastOrientationOk = orientationOk = true;
      return;
    }

    const prev = orientationOk;
    orientationOk = window.innerWidth > window.innerHeight;

    // If orientation changed, reset page zoom to 100% to avoid mobile zoom artifacts
    if (prev !== orientationOk) {
      try {
        document.body.style.zoom = "1"; // 100%
        document.documentElement.style.zoom = "1";
        // ensure viewport near top so canvas sizing behaves predictably
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
      sposo.y = height - groundHeight - sposo.height + 5;
      sposa.y = height - groundHeight - sposa.height + 2;

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

  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", checkOrientation);
  checkOrientation();
  updateGroundHeight();

  // aggiorna groundHeight in base all'altezza del canvas per mantenere proporzioni
  function updateGroundHeight() {
    // usa una percentuale dell'altezza, ma non troppo piccolo
    groundHeight = Math.max(30, Math.round(height * 0.09));
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

  // ----- MOUSE (click per salto + restart) -----
  canvas.addEventListener("mousedown", () => {
    if (!gameStarted) {
      // su mobile, non partire in portrait
      if (!orientationOk) return;
      // l'utente avvia il gioco: permetti il resume e parti
      preventAutoResume = false;
      gameStarted = true;
      startUpdate();
      return;
    }

    if (gameOver) restartGame();
    else startJump();
  });

  canvas.addEventListener("mouseup", () => {
    endJump();
  });

  // ----- TOUCH (tap per salto + restart) -----
  // Permetti il tap solo sopra il livello del terreno. Dal terreno in giù permetti lo scroll.
  canvas.addEventListener("touchstart", (e) => {
    // determina la posizione del primo touch relativo alla canvas
    const t = e.touches && e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchY = t ? t.clientY - rect.top : 0;
    const groundTop = height - groundHeight; // y del bordo superiore del terreno nella canvas

    // Se il tocco è sopra il terreno (touchY < groundTop), gestiscilo come tap di gioco
    if (t && touchY < groundTop) {
      e.preventDefault();
      lastTouchHandled = true;

      if (!gameStarted) {
        if (!orientationOk) return;
        preventAutoResume = false;
        gameStarted = true;
        startUpdate();
        return;
      }

      if (gameOver) restartGame();
      else startJump();
    } else {
      // tocco sul terreno o sotto: non impedire lo scroll, lascia che il browser gestisca
      lastTouchHandled = false;
    }
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
    const size = 30 + Math.random() * 30;

    // Se ci sono ostacoli recenti, controlla distanza
    const last = ostacoli[ostacoli.length - 1];
    const secondLast = ostacoli[ostacoli.length - 2];

    const minDist = 120; // distanza minima

    // Se c’è un ostacolo troppo vicino, non spawnare
    if (last && width - last.x < minDist) return;

    // Se ci sono già due ostacoli ravvicinati, stop
    if (last && secondLast && last.x - secondLast.x < minDist) return;

    const obstacle = {
      x: width,
      width: size,
      height: size,
      passed: false,
      hitbox: {
        xOffset: 6,
        yOffset: 6,
        width: size - 12,
        height: size - 12,
      },
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

  function update() {
    if (gameOver) {
      updateLoopActive = false;
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

    // Movimento sposo (fisica)
    sposo.vy += gravity;
    sposo.y += sposo.vy;
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
    sposa.vy += gravity;
    sposa.y += sposa.vy;
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
    if (Math.random() < 0.01) spawnNuvola();

    // Movimento nuvole
    nuvole.forEach((n) => {
      n.x -= n.speed;
    });

    // Rimuovi nuvole fuori dallo schermo
    nuvole = nuvole.filter((n) => n.x + n.width > 0);

    // Spawn ostacoli
    if (Math.random() < 0.02) spawnObstacle();

    // Sposta ostacoli
    ostacoli.forEach((o) => {
      o.x -= 5;
    });

    // Sposta la chiesa verso sinistra
    chiesaX -= chiesaSpeed;

    // Rimuovi ostacoli fuori dallo schermo
    ostacoli = ostacoli.filter((o) => o.x + o.width > 0);

    // Collisioni (sposo vs ostacoli con hitbox)
    ostacoli.forEach((o) => {
      const a = sposo;
      const b = o;

      if (
        a.x + a.hitbox.xOffset < b.x + b.hitbox.xOffset + b.hitbox.width &&
        a.x + a.hitbox.xOffset + a.hitbox.width > b.x + b.hitbox.xOffset &&
        a.y + a.hitbox.yOffset < b.y + b.hitbox.yOffset + b.hitbox.height &&
        a.y + a.hitbox.yOffset + a.hitbox.height > b.y + b.hitbox.yOffset
      ) {
        gameOver = true;
      }
    });

    // Sposa salta automaticamente se un ostacolo è davanti
    ostacoli.forEach((o) => {
      const distanza = o.x - sposa.x;

      if (
        distanza < 60 && // distanza regolabile
        distanza > 0 &&
        sposa.y >= height - groundHeight - sposa.height
      ) {
        sposa.vy = jumpPower * 0.8; // leggermente più basso del marito
      }
    });

    // Aumenta punteggio: 1 punto per ostacolo superato
    ostacoli.forEach((o) => {
      if (!o.passed && o.x + o.width < sposo.x) {
        o.passed = true;
        score++;
      }
    });

    draw();
    rafId = requestAnimationFrame(update);
  }

  // Avvia l'update loop solo se non è già attivo (evita più loop sovrapposti)
  function startUpdate() {
    if (updateLoopActive) return;
    updateLoopActive = true;
    update();
  }

  function pauseGame() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, width, height - groundHeight);
    const pauseSize = Math.round(clamp(height * 0.04, 12, 28));

    const pauseMessage = "Gioco in pausa! Torna su per riprendere a giocare";
    ctx.font = `${pauseSize}px 'Press Start 2P'`;

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

  // DRAW ------------------------------------------------------

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // hide DOM overlay by default; will be shown when needed
    try {
      overlayImg.style.display = "none";
      overlayCaption.style.display = "none";
    } catch (e) {}

    // font sizing responsive
    const titleSize = Math.round(clamp(height * 0.07, 5, 48));
    const titleShadowDistance = titleSize * 0.15;
    const subtitleSize = Math.round(clamp(height * 0.04, 12, 24));
    const subtitleShadowDistance = subtitleSize * 0.11;
    const scoreSize = Math.round(clamp(height * 0.025, 10, 18));
    const gameOverSize = Math.round(clamp(height * 0.12, 28, 72));
    const restartSize = Math.round(clamp(height * 0.04, 12, 28));

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
      ctx.globalAlpha = 0.35; // regola qui l'opacità (0.0 - 1.0)
      ctx.drawImage(imgBackground, x, y, targetWidth, targetHeight);
      ctx.restore();
    }

    // Disegna nuvole
    nuvole.forEach((n) => {
      ctx.drawImage(imgNuvola, n.x, n.y, n.width, n.height);
    });

    // TITOLO CON OUTLINE
    if (!gameStarted && orientationOk) {
      const title = "IL MATRIMONIO DI ELENA E CLAUDIO";
      ctx.font = `${titleSize}px 'Press Start 2P'`;
      ctx.textAlign = "center";

      ctx.fillStyle = "rgb(207, 3, 3)";
      ctx.fillText(title, width / 2 + 2, 80 + titleShadowDistance);

      ctx.fillStyle = "yellow";
      ctx.fillText(title, width / 2, 80);

      // SOTTOTITOLO CON OUTLINE (lampeggiante)
      const subtitle = "CLICCA PER AIUTARE CLAUDIO A FUGGIRE!";
      ctx.font = `${subtitleSize}px 'Press Start 2P'`;
      ctx.textAlign = "center";

      // show/hide based on time -> blink every 600ms
      const showSubtitle = Math.floor(performance.now() / 800) % 2 === 0;
      if (showSubtitle) {
        ctx.fillStyle = "black";
        ctx.fillText(subtitle, width / 2 + 7, 120 + subtitleShadowDistance);

        ctx.fillStyle = "white";
        ctx.fillText(subtitle, width / 2 + 5, 120);
      }
    }

    // Terreno
    ctx.fillStyle = "#3ea043";
    ctx.fillRect(0, height - groundHeight, width, groundHeight);

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
      finalHeight
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

    // Disegna ostacoli
    ostacoli.forEach((o) => {
      ctx.drawImage(imgOstacolo, o.x, o.y, o.width, o.height);
    });

    // Disegna punteggio
    if (gameStarted) {
      ctx.font = `${scoreSize}px 'Press Start 2P'`;

      ctx.fillStyle = "black";
      ctx.fillText(
        `Punti: ${score}`,
        width - Math.round(10 * scoreSize) + 2,
        Math.round(40 + scoreSize) + 2
      );
      ctx.fillStyle = "white";
      ctx.fillText(
        `Punti: ${score}`,
        width - Math.round(10 * scoreSize),
        Math.round(40 + scoreSize)
      );
    }

    // Se siamo in pausa dovuta a scroll su mobile, mostra overlay persistente
    if (pausedByScroll) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, width, height - groundHeight);
      const pauseSize = Math.round(clamp(height * 0.04, 12, 28));
      const pauseMessage = "Gioco in pausa! Torna su per riprendere a giocare";
      ctx.font = `${pauseSize}px 'Press Start 2P'`;
      ctx.textAlign = "center";

      ctx.fillStyle = "black";
      ctx.fillText(pauseMessage, width / 2 + 2, height / 2 + 50 + 2);

      ctx.fillStyle = "white";
      ctx.fillText(pauseMessage, width / 2 + 2, height / 2 + 50);

      return; // non disegnare altro sotto l'overlay
    }

    if (gameOver) {
      // overlay
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, width, height - groundHeight);

      // GAME OVER con outline
      const gameOverMessage = "GAME OVER";
      ctx.font = `${gameOverSize}px 'Press Start 2P'`;

      const textWidth = ctx.measureText(gameOverMessage).width;
      const x = width / 2;
      const y = height / 2;

      ctx.fillStyle = "#cf0303";
      ctx.fillText(gameOverMessage, x + 6, y + 6);

      ctx.fillStyle = "yellow";
      ctx.fillText(gameOverMessage, x, y);

      // messaggio restart con outline
      const restartMessage =
        "Claudio è spacciato! Clicca o premi Invio per riprovare";
      ctx.font = `${restartSize}px 'Press Start 2P'`;

      ctx.fillStyle = "black";
      ctx.fillText(restartMessage, width / 2 + 2, height / 2 + 50 + 2);

      ctx.fillStyle = "white";
      ctx.fillText(restartMessage, width / 2 + 2, height / 2 + 50);
    }
  }

  // RESTART ---------------------------------------------------
  function restartGame() {
    // riposiziona gli sposi: y su terreno, x vicino alla chiesa su mobile
    sposo.y = height - groundHeight - sposo.height;
    sposo.vy = 0;
    sposo.frame = 0;

    sposa.y = height - groundHeight - sposa.height;
    sposa.vy = 0;
    sposa.frame = 0;

    chiesaX = 50;

    positionCoupleNearChiesa();

    ostacoli = [];
    nuvole = [];
    score = 0;
    gameOver = false;
    jumpPressed = false;

    // riattiva il resume perché questo è un restart intenzionale
    preventAutoResume = false;
    startUpdate();
  }

  // AVVIO -----------------------------------------------------

  let loaded = 0;
  [
    imgSposo1,
    imgSposo2,
    imgSposo3,
    imgSposa1,
    imgSposa2,
    imgOstacolo,
    imgChiesa,
    imgNuvola,
    imgBackground,
  ].forEach((img) => {
    img.onload = () => {
      loaded++;
      if (loaded === 9) {
        // Changed from 4 to 8
        canvas.width = Math.round(canvas.clientWidth);
        canvas.height = Math.round(canvas.clientHeight);
        // aggiorna width/height usate nel gioco dopo il resize
        width = canvas.width;
        height = canvas.height;
        updateGroundHeight();
        // riallinea personaggi al terreno e disegna frame iniziale (ma non partire automaticamente)
        sposo.y = height - groundHeight - sposo.height + 5;
        sposa.y = height - groundHeight - sposa.height + 2;
        // se siamo su mobile, posiziona gli sposi vicino alla chiesa
        positionCoupleNearChiesa();
        draw(); // Changed from update() to draw()
        // avvia il loop di start per aggiornare il lampeggio finché non si clicca
        if (!startLoopActive) startLoop();
      }
    };
  });

  // aggiorna dimensioni canvas e groundHeight al resize della finestra
  window.addEventListener("resize", () => {
    canvas.width = Math.round(canvas.clientWidth);
    canvas.height = Math.round(canvas.clientHeight);
    width = canvas.width;
    height = canvas.height;
    updateGroundHeight();
    sposo.y = height - groundHeight - sposo.height;
    sposa.y = height - groundHeight - sposa.height;
    draw();
  });
}
